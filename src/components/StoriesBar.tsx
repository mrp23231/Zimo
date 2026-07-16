import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Pause, Play, Eye, ChevronLeft, ChevronRight, Send, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
  updateDoc,
  arrayUnion,
  orderBy,
} from '../lib/firebase';
import { db, storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { STORAGE_ENABLED, MAX_INLINE_DATAURL_CHARS, blobToDataUrl } from '../lib/storageConfig';
import { safeOnSnapshot } from '../lib/firestoreListen';
import { formatDistanceToNow } from 'date-fns';
import { cn, chunkArray } from '../lib/utils';

export interface StoryItem {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  videoDurationSec?: number | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  viewedBy?: string[];
}

type StoryAuthorGroup = {
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  stories: StoryItem[];
};

type StoriesBarProps = {
  profile: {
    uid: string;
    displayName: string;
    photoURL?: string;
  } | null;
  followingUids: string[];
  onOpenProfile: (uid: string) => void;
  t: (key: string) => string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  readOnly?: boolean;
};

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const STORY_IMAGE_MS = 5500;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const SEEN_STORAGE_KEY = 'zimo_story_seen_ids';

const loadSeenIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
};

const saveSeenIds = (ids: Set<string>) => {
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-500)));
  } catch {}
};

const compressStoryImage = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode_failed'));
      img.onload = () => {
        const max = 1080;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          if (w >= h) {
            h = Math.round((h * max) / w);
            w = max;
          } else {
            w = Math.round((w * max) / h);
            h = max;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas_failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('blob_failed'))),
          'image/jpeg',
          0.88
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const uploadStoryFile = (
  path: string,
  blob: Blob,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<string> =>
  new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob, { contentType });
    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes) {
          onProgress?.((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        }
      },
      reject,
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(err);
        }
      }
    );
  });

const getVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const d = Math.round(video.duration || 0);
      if (!Number.isFinite(d) || d <= 0) reject(new Error('invalid'));
      else if (d > MAX_VIDEO_SECONDS) reject(new Error('too_long'));
      else resolve(d);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('invalid'));
    };
    video.src = url;
  });

export const StoriesBar: React.FC<StoriesBarProps> = ({
  profile,
  followingUids,
  onOpenProfile,
  t,
  showToast,
  readOnly,
}) => {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadSeenIds());
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{
    file: File;
    url: string;
    mediaType: 'image' | 'video';
    durationSec?: number;
  } | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [authorIdx, setAuthorIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [segmentProgress, setSegmentProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoDurationSec, setVideoDurationSec] = useState(5);
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState<Array<{ id: string; text: string; senderName: string; createdAt: Timestamp }>>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const recordedViewsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  // Load stories: yours + everyone you follow (Instagram-style), not a global dump.
  useEffect(() => {
    if (!profile?.uid) {
      setStories([]);
      return;
    }

    const merge = new Map<string, StoryItem>();
    const unsubs: Array<() => void> = [];

    const commit = () => {
      const now = Date.now();
      setStories(
        Array.from(merge.values())
          .filter((s) => {
            const ms = s.expiresAt?.toMillis?.();
            return typeof ms === 'number' && ms > now;
          })
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      );
    };

    const applySnap = (snap: { docs: Array<{ id: string; data: () => object }> }) => {
      snap.docs.forEach((d) => {
        merge.set(d.id, { id: d.id, ...(d.data() as object) } as StoryItem);
      });
      commit();
    };

    const listen = (q: ReturnType<typeof query>, label: string) => {
      unsubs.push(safeOnSnapshot(q, applySnap, label));
    };

    // Single-field filter only — no composite index required; sort client-side.
    listen(
      query(collection(db, 'stories'), where('authorUid', '==', profile.uid), limit(30)),
      'Stories (mine):'
    );

    const followTargets = [...new Set(followingUids)].filter(
      (uid) => uid && uid !== profile.uid
    );
    // `in` + orderBy needs another composite index per chunk; fetch without orderBy, sort client-side.
    chunkArray(followTargets, 30).forEach((chunk, i) => {
      listen(
        query(collection(db, 'stories'), where('authorUid', 'in', chunk), limit(60)),
        `Stories (following #${i}):`
      );
    });

    return () => {
      unsubs.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
    };
  }, [profile?.uid, followingUids]);

  const authorGroups = useMemo(() => {
    const byAuthor = new Map<string, StoryItem[]>();
    for (const s of stories) {
      const list = byAuthor.get(s.authorUid) || [];
      list.push(s);
      byAuthor.set(s.authorUid, list);
    }

    const groups: StoryAuthorGroup[] = [];
    byAuthor.forEach((list, authorUid) => {
      const sorted = [...list].sort(
        (a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
      );
      const first = sorted[0];
      groups.push({
        authorUid,
        authorName: first.authorName,
        authorPhoto: first.authorPhoto,
        stories: sorted,
      });
    });

    const isGroupSeen = (g: StoryAuthorGroup) =>
      g.stories.every((s) => seenIds.has(s.id) || (s.viewedBy || []).includes(profile?.uid || ''));

    groups.sort((a, b) => {
      const aSeen = isGroupSeen(a);
      const bSeen = isGroupSeen(b);
      if (aSeen !== bSeen) return aSeen ? 1 : -1;
      const aMax = Math.max(...a.stories.map((s) => s.createdAt?.toMillis?.() ?? 0));
      const bMax = Math.max(...b.stories.map((s) => s.createdAt?.toMillis?.() ?? 0));
      return bMax - aMax;
    });

    // Your story first, then subscriptions (unseen first).
    const mineIdx = profile?.uid ? groups.findIndex((g) => g.authorUid === profile.uid) : -1;
    const mine = mineIdx >= 0 ? groups.splice(mineIdx, 1)[0] : null;
    const followingOnly = groups.filter((g) => g.authorUid !== profile?.uid);

    return mine ? [mine, ...followingOnly] : followingOnly;
  }, [stories, seenIds, profile?.uid]);

  const followingGroups = useMemo(
    () => authorGroups.filter((g) => g.authorUid !== profile?.uid),
    [authorGroups, profile?.uid]
  );

  const myGroup = profile ? authorGroups.find((g) => g.authorUid === profile.uid) : undefined;

  const markSeen = useCallback((story: StoryItem) => {
    setSeenIds((prev) => {
      if (prev.has(story.id)) return prev;
      const next = new Set<string>(prev);
      next.add(story.id);
      saveSeenIds(next);
      return next;
    });
  }, []);

  const recordView = useCallback(
    async (story: StoryItem) => {
      if (!profile || profile.uid === story.authorUid) return;
      if (recordedViewsRef.current.has(story.id)) return;
      recordedViewsRef.current.add(story.id);
      markSeen(story);
      try {
        await updateDoc(doc(db, 'stories', story.id), {
          viewedBy: arrayUnion(profile.uid),
        });
      } catch {
        /* rules or offline — local seen state still applies */
      }
    },
    [profile, markSeen]
  );

  const currentGroup = viewerOpen ? authorGroups[authorIdx] : null;
  const currentStory = currentGroup?.stories[storyIdx] ?? null;

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    setPaused(false);
    setSegmentProgress(0);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    if (storyIdx < currentGroup.stories.length - 1) {
      setStoryIdx((i) => i + 1);
      setSegmentProgress(0);
      return;
    }
    if (authorIdx < authorGroups.length - 1) {
      setAuthorIdx((i) => i + 1);
      setStoryIdx(0);
      setSegmentProgress(0);
      return;
    }
    closeViewer();
  }, [authorIdx, storyIdx, currentGroup, authorGroups.length, closeViewer]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setSegmentProgress(0);
      return;
    }
    if (authorIdx > 0) {
      const prevGroup = authorGroups[authorIdx - 1];
      setAuthorIdx((i) => i - 1);
      setStoryIdx(Math.max(0, prevGroup.stories.length - 1));
      setSegmentProgress(0);
    }
  }, [authorIdx, storyIdx, authorGroups]);

  const openViewer = (uid: string, startStoryId?: string) => {
    const aIdx = authorGroups.findIndex((g) => g.authorUid === uid);
    if (aIdx < 0) return;
    let sIdx = 0;
    if (startStoryId) {
      const found = authorGroups[aIdx].stories.findIndex((s) => s.id === startStoryId);
      if (found >= 0) sIdx = found;
    }
    setAuthorIdx(aIdx);
    setStoryIdx(sIdx);
    setSegmentProgress(0);
    setPaused(false);
    setViewerOpen(true);
  };

  useEffect(() => {
    if (!viewerOpen || !currentStory || paused) return;

    const isVideo =
      currentStory.mediaType === 'video' ||
      /\.(mp4|webm|mov)(\?|$)/i.test(currentStory.mediaUrl);
    const storedDur = currentStory.videoDurationSec;
    const durationMs = isVideo
      ? Math.min(
          MAX_VIDEO_SECONDS,
          typeof storedDur === 'number' && storedDur > 0 ? storedDur : videoDurationSec
        ) * 1000
      : STORY_IMAGE_MS;

    const started = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const p = Math.min(1, elapsed / durationMs);
      setSegmentProgress(p);
      if (p >= 1) goNext();
    }, 40);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [viewerOpen, currentStory?.id, paused, videoDurationSec, goNext, currentStory]);

  useEffect(() => {
    if (currentStory) {
      markSeen(currentStory);
      void recordView(currentStory);
    }
  }, [currentStory?.id, markSeen, recordView, currentStory]);

  useEffect(() => {
    if (!viewerOpen || !currentStory) return;
    setShowReplies(false);
    setReplies([]);
    
    const q = query(
      collection(db, 'stories', currentStory.id, 'replies'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const storyReplies = snapshot.docs.map(doc => ({
        id: doc.id,
        text: doc.data().text || '',
        senderName: doc.data().senderName || 'Unknown',
        createdAt: doc.data().createdAt || serverTimestamp()
      })) as Array<{ id: string; text: string; senderName: string; createdAt: Timestamp }>;
      setReplies(storyReplies);
    }, 'Failed to load story replies:');
    return unsubscribe;
  }, [viewerOpen, currentStory?.id]);

  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerOpen, closeViewer, goNext, goPrev]);

  const pickFile = () => fileRef.current?.click();

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile || readOnly) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      showToast(t('invalidFileType'), 'error');
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      showToast(t('storyVideoTooLarge'), 'error');
      return;
    }
    if (isVideo && !STORAGE_ENABLED) {
      showToast(t('storyVideoNeedsStorage'), 'error');
      return;
    }

    try {
      let durationSec: number | undefined;
      if (isVideo) durationSec = await getVideoDuration(file);
      const url = URL.createObjectURL(file);
      setPreview({
        file,
        url,
        mediaType: isVideo ? 'video' : 'image',
        durationSec,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'too_long') showToast(t('storyVideoTooLong'), 'error');
      else showToast(t('storyInvalidMedia'), 'error');
    }
  };

  const cancelPreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const publishPreview = async () => {
    if (!preview || !profile) return;
    setUploading(true);
    try {
      const stamp = Date.now();
      let blob: Blob = preview.file;
      let ext = preview.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      let contentType = preview.file.type;

      if (preview.mediaType === 'image') {
        blob = await compressStoryImage(preview.file);
        ext = 'jpg';
        contentType = 'image/jpeg';
      }

      let mediaUrl: string;
      if (STORAGE_ENABLED) {
        const path = `stories/${profile.uid}/${stamp}.${ext}`;
        mediaUrl = await uploadStoryFile(path, blob, contentType);
      } else {
        mediaUrl = await blobToDataUrl(blob);
        if (mediaUrl.length > MAX_INLINE_DATAURL_CHARS) {
          showToast(t('storyImageTooLarge'), 'error');
          return;
        }
      }
      const expiresAt = Timestamp.fromMillis(Date.now() + STORY_TTL_MS);

      await addDoc(collection(db, 'stories'), {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL || '',
        mediaUrl,
        mediaType: preview.mediaType,
        videoDurationSec: preview.durationSec ?? null,
        createdAt: serverTimestamp(),
        expiresAt,
        viewedBy: [],
      });

      showToast(t('storyPublished'), 'success');
      cancelPreview();
    } catch (err) {
      console.error('Story upload failed:', err);
      showToast(t('storyPublishFailed'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const isGroupUnseen = (g: StoryAuthorGroup) =>
    g.stories.some(
      (s) =>
        !seenIds.has(s.id) &&
        !(s.viewedBy || []).includes(profile?.uid || '') &&
        s.authorUid !== profile?.uid
    );

  const viewerCount =
    currentStory && profile?.uid === currentStory.authorUid
      ? (currentStory.viewedBy || []).length
      : 0;

  const sendReply = async () => {
    if (!replyText.trim() || !currentStory || !profile || sendingReply) return;
    setSendingReply(true);
    try {
      await addDoc(collection(db, 'stories', currentStory.id, 'replies'), {
        text: replyText.trim(),
        senderUid: profile.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL || '',
        createdAt: serverTimestamp(),
      });
      setReplyText('');
      showToast('Reply sent!', 'success');
    } catch {
      showToast(t('genericError'), 'error');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <>
      <div className="mb-6 -mx-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-1 pb-1 min-w-min">
          {profile && (
            <div className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]">
              <div className="relative">
                <button
                  type="button"
                  disabled={uploading || readOnly}
                  onClick={() =>
                    myGroup ? openViewer(profile.uid) : pickFile()
                  }
                  className="flex flex-col items-center"
                >
                  <div
                    className={cn(
                      'relative w-16 h-16 rounded-full p-[2px]',
                      myGroup
                        ? 'bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600'
                        : 'bg-gray-200 dark:bg-zinc-700'
                    )}
                  >
                    <img
                      src={profile.photoURL || 'https://picsum.photos/seed/me/100/100'}
                      alt=""
                      className="w-full h-full rounded-full object-cover border-2 border-white dark:border-zinc-900"
                      referrerPolicy="no-referrer"
                    />
                    {!myGroup && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center border-2 border-white dark:border-zinc-900">
                        <Plus size={12} />
                      </span>
                    )}
                  </div>
                </button>
                {myGroup && !readOnly && (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={pickFile}
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow"
                    title={t('storyAddAnother')}
                  >
                    <Plus size={12} />
                  </button>
                )}
                {myGroup && myGroup.stories.length > 1 && (
                  <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] font-bold flex items-center justify-center">
                    {myGroup.stories.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-gray-500 truncate w-full text-center">
                {uploading ? '…' : t('yourStory')}
              </span>
            </div>
          )}

          {followingUids.length === 0 && (
            <div className="flex items-center shrink-0 px-2 text-[10px] text-gray-400 max-w-[120px] leading-tight">
              {t('storiesFollowHint')}
            </div>
          )}

          {followingGroups.map((g) => {
              const unseen = isGroupUnseen(g);
              return (
                <button
                  key={g.authorUid}
                  type="button"
                  onClick={() => openViewer(g.authorUid)}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]"
                >
                  <div
                    className={cn(
                      'relative w-16 h-16 rounded-full p-[2px]',
                      unseen
                        ? 'bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600'
                        : 'bg-gray-300 dark:bg-zinc-600'
                    )}
                  >
                    <img
                      src={g.authorPhoto || 'https://picsum.photos/seed/user/100/100'}
                      alt=""
                      className="w-full h-full rounded-full object-cover border-2 border-white dark:border-zinc-900"
                      referrerPolicy="no-referrer"
                    />
                    {g.stories.length > 1 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black/70 text-white text-[9px] font-bold flex items-center justify-center">
                        {g.stories.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 truncate w-full text-center">
                    {g.authorName?.split(' ')[0] || t('story')}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={STORAGE_ENABLED ? 'image/*,video/*' : 'image/*'}
        className="hidden"
        onChange={onFilePicked}
      />

      {/* Upload preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[390] bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border border-gray-100 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b dark:border-zinc-800 font-bold text-sm">{t('storyPreview')}</div>
              <div className="bg-black flex items-center justify-center max-h-[50vh]">
                {preview.mediaType === 'video' ? (
                  <video src={preview.url} className="max-h-[50vh] w-full object-contain" controls playsInline />
                ) : (
                  <img src={preview.url} alt="" className="max-h-[50vh] w-full object-contain" />
                )}
              </div>
              <div className="p-4 flex gap-2">
                <button
                  type="button"
                  onClick={cancelPreview}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-200 dark:border-zinc-700"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void publishPreview()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-black dark:bg-white text-white dark:text-black disabled:opacity-50"
                >
                  {uploading ? t('uploading') : t('storyPublish')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {viewerOpen && currentGroup && currentStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black flex flex-col select-none"
          >
            {/* Progress segments */}
            <div className="flex gap-1 px-3 pt-3 pb-2" onClick={(e) => e.stopPropagation()}>
              {currentGroup.stories.map((s, i) => (
                <div
                  key={s.id}
                  className="flex-1 h-0.5 rounded-full bg-white/25 overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-[width] duration-75 ease-linear"
                    style={{
                      width:
                        i < storyIdx
                          ? '100%'
                          : i === storyIdx
                            ? `${segmentProgress * 100}%`
                            : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-between px-4 py-2 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex items-center gap-2 min-w-0"
                onClick={() => onOpenProfile(currentStory.authorUid)}
              >
                <img
                  src={currentStory.authorPhoto || 'https://picsum.photos/seed/user/100/100'}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                  alt=""
                />
                <div className="text-left min-w-0">
                  <div className="font-bold text-sm truncate">{currentStory.authorName}</div>
                  <div className="text-[10px] text-white/60">
                    {currentStory.createdAt?.toDate
                      ? formatDistanceToNow(currentStory.createdAt.toDate(), { addSuffix: true })
                      : ''}
                    {currentGroup.stories.length > 1 &&
                      ` · ${storyIdx + 1}/${currentGroup.stories.length}`}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                {viewerCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-white/10 mr-1">
                    <Eye size={14} />
                    {viewerCount}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="p-2 rounded-full bg-white/10"
                  title={paused ? t('storyResume') : t('storyPause')}
                >
                  {paused ? <Play size={18} /> : <Pause size={18} />}
                </button>
                {profile?.uid === currentStory.authorUid && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'stories', currentStory.id));
                        if (currentGroup.stories.length <= 1) {
                          closeViewer();
                        } else {
                          goNext();
                        }
                        showToast(t('storyDeleted'), 'info');
                      } catch {
                        showToast(t('genericError'), 'error');
                      }
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10"
                  >
                    {t('delete')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeViewer}
                  className="p-2 rounded-full bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="relative flex-1 flex items-center justify-center overflow-hidden">
              <button
                type="button"
                className="absolute left-0 top-0 bottom-0 w-[30%] z-10"
                aria-label={t('storyPrev')}
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
              />
              <button
                type="button"
                className="absolute right-0 top-0 bottom-0 w-[30%] z-10"
                aria-label={t('storyNext')}
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
              />

              {currentStory.mediaType === 'video' ||
              /\.(mp4|webm|mov)(\?|$)/i.test(currentStory.mediaUrl) ? (
                <video
                  key={currentStory.id}
                  src={currentStory.mediaUrl}
                  className="max-h-full max-w-full object-contain"
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    const d = Math.round(e.currentTarget.duration || 5);
                    setVideoDurationSec(Math.min(MAX_VIDEO_SECONDS, Math.max(1, d)));
                  }}
                  onEnded={goNext}
                />
              ) : (
                <img
                  key={currentStory.id}
                  src={currentStory.mediaUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              )}

              <div className="absolute bottom-6 left-0 right-0 flex justify-between px-4 pointer-events-none text-white/50">
                <ChevronLeft size={28} />
                <ChevronRight size={28} />
              </div>
            </div>

            {/* Reply section */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setShowReplies(!showReplies)}
                  className="text-xs text-white/70 hover:text-white flex items-center gap-1"
                >
                  <MessageCircle size={14} />
                  {replies.length > 0 && <span>{replies.length}</span>}
                </button>
              </div>
              
              {showReplies && replies.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-2 mb-2 bg-white/10 rounded-xl p-2">
                  {replies.map((reply) => (
                    <div key={reply.id} className="text-xs">
                      <span className="font-bold">{reply.senderName}: </span>
                      <span className="text-white/80">{reply.text}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {profile?.uid !== currentStory.authorUid && (
                <div className="flex gap-2">
                  <input
                    ref={replyInputRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="Reply..."
                    className="flex-1 bg-white/20 text-white placeholder:text-white/50 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/50"
                    disabled={sendingReply}
                  />
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={!replyText.trim() || sendingReply}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 disabled:opacity-50 transition-colors"
                  >
                    <Send size={16} className="text-white" />
                  </button>
                </div>
              )}
            </div>

            <p className="text-center text-[10px] text-white/40 pb-4">{t('storyNavHint')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
