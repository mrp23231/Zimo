/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  Timestamp,
  where,
  limit,
  getDocFromServer,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  uploadBytesResumable
} from 'firebase/storage';
import { auth, db, storage } from './lib/firebase';
import { cn } from './lib/utils';
import { 
  Home, 
  User, 
  MessageSquare, 
  PlusCircle, 
  LogOut, 
  Moon, 
  Sun, 
  Heart, 
  Send,
  ArrowLeft,
  Bell,
  Image as ImageIcon,
  X,
  Search,
  Camera,
  MoreVertical,
  Plus,
  MessageCircle,
  Compass,
  Bookmark,
  Share2,
  Check,
  Info,
  Trash2,
  Flag,
  Repeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, format } from 'date-fns';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

function handleStorageError(error: unknown, path: string) {
  console.error(`Storage Error at ${path}:`, error);
  const message = error instanceof Error ? error.message : String(error);
  return message;
}

// --- Types ---

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  headerURL?: string;
  bio?: string;
  createdAt: Timestamp;
  followersCount?: number;
  followingCount?: number;
  bookmarks?: string[];
  isOnline?: boolean;
  lastSeen?: Timestamp;
  blockedUsers?: string[];
}

interface Follow {
  id: string;
  followerUid: string;
  followingUid: string;
  createdAt: Timestamp;
}

interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  imageUrl?: string;
  imageUrls?: string[];
  createdAt: Timestamp;
  likes: number;
  likedBy: string[];
  repostId?: string;
  repostCount?: number;
}

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'repost';
  fromUid: string;
  fromName: string;
  fromPhoto: string;
  toUid: string;
  postId?: string;
  createdAt: Timestamp;
  read: boolean;
}

interface Comment {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  createdAt: Timestamp;
}

interface Message {
  id: string;
  senderUid: string;
  receiverUid: string;
  text: string;
  imageUrl?: string;
  createdAt: Timestamp;
  read?: boolean;
}

type View = 'feed' | 'profile' | 'messages' | 'chat' | 'notifications' | 'post_detail' | 'user_profile' | 'explore' | 'bookmarks';

// --- Context ---

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastContext = createContext<{
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
} | null>(null);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-xs px-4">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border",
                toast.type === 'success' ? "bg-green-500/90 border-green-400 text-white" :
                toast.type === 'error' ? "bg-red-500/90 border-red-400 text-white" :
                "bg-zinc-900/90 border-zinc-800 text-white"
              )}
            >
              {toast.type === 'success' && <Check size={18} />}
              {toast.type === 'error' && <X size={18} />}
              {toast.type === 'info' && <Info size={18} />}
              <span className="text-sm font-bold">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const AuthContext = createContext<{
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Set online status
    const userDocRef = doc(db, 'users', user.uid);
    updateDoc(userDocRef, { 
      isOnline: true, 
      lastSeen: serverTimestamp() 
    }).catch(console.error);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateDoc(userDocRef, { isOnline: true, lastSeen: serverTimestamp() }).catch(console.error);
      } else {
        updateDoc(userDocRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const unsubProfile = onSnapshot(
      userDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: user.uid,
            displayName: user.displayName || 'Anonymous',
            email: user.email || '',
            photoURL: user.photoURL || '',
            createdAt: Timestamp.now(),
            isOnline: true,
            lastSeen: Timestamp.now()
          };
          await setDoc(userDocRef, newProfile);
          setProfile(newProfile);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore profile listener failed:", err);
        setProfile({
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email || '',
          photoURL: user.photoURL || '',
          createdAt: Timestamp.now()
        });
        setLoading(false);
      }
    );

    return () => {
      unsubProfile();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      updateDoc(userDocRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(console.error);
    };
  }, [user]);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Sign in error:", error);
      alert("Ошибка входа: " + (error.message || "Неизвестная ошибка"));
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

function Lightbox({ url, onClose }: { url: string, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X size={24} />
      </button>
      <motion.img 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        src={url} 
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        referrerPolicy="no-referrer"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}

function Explore({ onOpenPost, onOpenProfile, onOpenImage, onShowLikes }: { 
  onOpenPost: (post: Post) => void, 
  onOpenProfile: (uid: string) => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string
}) {
  const { profile } = useAuth();
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('likes', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (s) => {
      let allPosts = s.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      if (profile?.blockedUsers && profile.blockedUsers.length > 0) {
        allPosts = allPosts.filter(p => !profile.blockedUsers?.includes(p.authorUid));
      }
      setTrendingPosts(allPosts.slice(0, 10));
      setLoading(false);
    });
    return unsubscribe;
  }, [profile?.blockedUsers]);

  return (
    <div className="max-w-4xl mx-auto py-20 px-4">
      <h2 className="text-3xl font-bold mb-8 tracking-tight">Explore</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Popular Posts</h3>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
            </div>
          ) : (
            trendingPosts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onOpen={onOpenPost} 
                onOpenProfile={onOpenProfile} 
                onOpenImage={onOpenImage}
                onShowLikes={onShowLikes}
              />
            ))
          )}
        </div>
        
        <aside className="space-y-6">
          <WhoToFollow onOpenProfile={onOpenProfile} />
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-lg mb-4 tracking-tight">Community Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl">
                <div className="text-2xl font-bold">1.2k</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest">Members</div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl">
                <div className="text-2xl font-bold">8.5k</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest">Posts</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Bookmarks({ onOpenPost, onOpenProfile, onOpenImage, onShowLikes }: { 
  onOpenPost: (post: Post) => void, 
  onOpenProfile: (uid: string) => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string
}) {
  const { profile } = useAuth();
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.bookmarks?.length) {
      setBookmarkedPosts([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'posts'), where('__name__', 'in', profile.bookmarks));
    const unsubscribe = onSnapshot(q, (s) => {
      setBookmarkedPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
      setLoading(false);
    });
    return unsubscribe;
  }, [profile]);

  return (
    <div className="max-w-xl mx-auto py-20 px-4">
      <h2 className="text-3xl font-bold mb-8 tracking-tight">Bookmarks</h2>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
        </div>
      ) : bookmarkedPosts.length > 0 ? (
        <div className="space-y-6">
          {bookmarkedPosts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              onOpen={onOpenPost} 
              onOpenProfile={onOpenProfile} 
              onOpenImage={onOpenImage}
              onShowLikes={onShowLikes}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
          <Bookmark size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-4" />
          <p className="text-gray-400">No bookmarks yet. Save posts to see them here!</p>
        </div>
      )}
    </div>
  );
}

function WhoToFollow({ onOpenProfile }: { onOpenProfile: (uid: string) => void }) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [followingUids, setFollowingUids] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    
    // Get users I'm not following
    const qUsers = query(collection(db, 'users'), limit(20));
    const unsubUsers = onSnapshot(qUsers, (s) => {
      setUsers(s.docs.map(d => d.data() as UserProfile).filter(u => u.uid !== profile.uid));
    });

    const qFollows = query(collection(db, 'follows'), where('followerUid', '==', profile.uid));
    const unsubFollows = onSnapshot(qFollows, (s) => {
      setFollowingUids(s.docs.map(d => (d.data() as Follow).followingUid));
    });

    return () => { unsubUsers(); unsubFollows(); };
  }, [profile]);

  const suggestions = users
    .filter(u => !followingUids.includes(u.uid))
    .slice(0, 3);

  if (suggestions.length === 0) return null;

  const handleFollow = async (targetUid: string) => {
    if (!profile) return;
    await setDoc(doc(db, 'follows', profile.uid + '_' + targetUid), {
      followerUid: profile.uid,
      followingUid: targetUid,
      createdAt: serverTimestamp()
    });
    
    await addDoc(collection(db, 'notifications'), {
      type: 'follow',
      fromUid: profile.uid,
      fromName: profile.displayName,
      fromPhoto: profile.photoURL,
      toUid: targetUid,
      createdAt: serverTimestamp(),
      read: false
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
      <h3 className="font-bold text-lg mb-4 tracking-tight">Who to follow</h3>
      <div className="space-y-4">
        {suggestions.map(user => (
          <div key={user.uid} className="flex items-center justify-between gap-2">
            <button 
              onClick={() => onOpenProfile(user.uid)}
              className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity flex-1 min-w-0"
            >
              <img src={user.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{user.displayName}</div>
                <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
              </div>
            </button>
            <button 
              onClick={() => handleFollow(user.uid)}
              className="bg-black dark:bg-white text-white dark:text-black px-4 py-1.5 rounded-full text-[10px] font-bold hover:opacity-80 transition-opacity"
            >
              Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Navbar({ currentView, setView, darkMode, setDarkMode, onSearchUser }: { 
  currentView: View, 
  setView: (v: View) => void,
  darkMode: boolean,
  setDarkMode: (d: boolean) => void,
  onSearchUser: (uid: string) => void
}) {
  const { logout, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const q = query(
      collection(db, 'users'),
      where('displayName', '>=', searchQuery),
      where('displayName', '<=', searchQuery + '\uf8ff'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (s) => {
      setSearchResults(s.docs.map(d => d.data() as UserProfile));
    });
    return unsubscribe;
  }, [searchQuery]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'), 
      where('toUid', '==', profile.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (s) => setUnreadCount(s.size));
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'messages'),
      where('receiverUid', '==', profile.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (s) => setUnreadMessagesCount(s.size));
    return unsubscribe;
  }, [profile]);

  const navItems = [
    { id: 'feed', icon: Home, label: 'Feed' },
    { id: 'explore', icon: Compass, label: 'Explore' },
    { id: 'notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
    { id: 'bookmarks', icon: Bookmark, label: 'Bookmarks' },
    { id: 'messages', icon: MessageSquare, label: 'Messages', badge: unreadMessagesCount },
    { id: 'profile', icon: profile?.photoURL ? () => <img src={profile.photoURL} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" /> : User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto bg-white/80 dark:bg-black/80 backdrop-blur-md border-t md:border-t-0 md:border-b border-gray-200 dark:border-gray-800 z-50">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="hidden md:block font-bold text-xl tracking-tighter cursor-pointer" onClick={() => setView('feed')}>MINIMAL</div>
        
        <div className="flex-1 max-w-xs relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearching(true)}
            className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
          />
          <AnimatePresence>
            {isSearching && searchQuery.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50"
              >
                {searchResults.length > 0 ? searchResults.map(u => (
                  <button
                    key={u.uid}
                    onClick={() => {
                      onSearchUser(u.uid);
                      setSearchQuery('');
                      setIsSearching(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <img src={u.photoURL} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{u.displayName}</div>
                      <div className="text-[10px] text-gray-400 truncate">{u.email}</div>
                    </div>
                  </button>
                )) : (
                  <div className="p-4 text-center text-xs text-gray-400">No users found</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {isSearching && (
            <div className="fixed inset-0 z-[-1]" onClick={() => setIsSearching(false)} />
          )}
        </div>

        <div className="flex flex-1 justify-around md:justify-center md:gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as View)}
              className={cn(
                "p-2 transition-colors relative",
                currentView === item.id ? "text-black dark:text-white" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              )}
            >
              {typeof item.icon === 'function' ? <item.icon /> : <item.icon size={24} />}
              {item.badge ? (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] border-2 border-white dark:border-black">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={logout} className="p-2 text-gray-500 hover:text-red-500 transition-colors hidden sm:block">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}

function PostCard({ post, onOpen, onOpenProfile, onHashtagClick, onOpenImage, onShowLikes }: { 
  post: Post, 
  onOpen?: (post: Post) => void, 
  onOpenProfile?: (uid: string) => void, 
  onHashtagClick?: (tag: string) => void, 
  onOpenImage?: (url: string) => void,
  onShowLikes?: (postId: string) => void,
  key?: string 
}) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [repostedPost, setRepostedPost] = useState<Post | null>(null);
  const [showRepostDialog, setShowRepostDialog] = useState(false);
  const [repostText, setRepostText] = useState('');
  const [isReposting, setIsReposting] = useState(false);
  const isLiked = post.likedBy?.includes(profile?.uid || '');
  const isBookmarked = profile?.bookmarks?.includes(post.id);

  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
    return unsubscribe;
  }, [showComments, post.id]);

  useEffect(() => {
    if (!post.repostId) return;
    const fetchReposted = async () => {
      const d = await getDoc(doc(db, 'posts', post.repostId!));
      if (d.exists()) {
        setRepostedPost({ id: d.id, ...d.data() } as Post);
      }
    };
    fetchReposted();
  }, [post.repostId]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    const postRef = doc(db, 'posts', post.id);
    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: post.likes - 1,
          likedBy: arrayRemove(profile.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: post.likes + 1,
          likedBy: arrayUnion(profile.uid)
        });
        
        // Create notification
        if (post.authorUid !== profile.uid) {
          await addDoc(collection(db, 'notifications'), {
            type: 'like',
            fromUid: profile.uid,
            fromName: profile.displayName,
            fromPhoto: profile.photoURL,
            toUid: post.authorUid,
            postId: post.id,
            createdAt: serverTimestamp(),
            read: false
          });
        }
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    const userRef = doc(db, 'users', profile.uid);
    try {
      if (isBookmarked) {
        await updateDoc(userRef, {
          bookmarks: arrayRemove(post.id)
        });
        showToast("Removed from bookmarks", "info");
      } else {
        await updateDoc(userRef, {
          bookmarks: arrayUnion(post.id)
        });
        showToast("Added to bookmarks", "success");
      }
    } catch (err) {
      console.error("Error bookmarking post:", err);
      showToast("Failed to bookmark", "error");
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(url);
    showToast("Link copied to clipboard!", "success");
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentText.trim() || !profile) return;

    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        text: commentText.trim(),
        createdAt: serverTimestamp()
      });
      
      // Create notification
      if (post.authorUid !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'comment',
          fromUid: profile.uid,
          fromName: profile.displayName,
          fromPhoto: profile.photoURL,
          toUid: post.authorUid,
          postId: post.id,
          createdAt: serverTimestamp(),
          read: false
        });
      }
      
      setCommentText('');
    } catch (err) {
      console.error("Error commenting:", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this post?')) {
      try {
        await deleteDoc(doc(db, 'posts', post.id));
        showToast("Post deleted", "info");
      } catch (err) {
        showToast("Failed to delete post", "error");
      }
    }
  };

  const handleUpdate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editContent.trim()) return;
    try {
      await updateDoc(doc(db, 'posts', post.id), { content: editContent.trim() });
      setIsEditing(false);
      showToast("Post updated", "success");
    } catch (err) {
      showToast("Failed to update post", "error");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', post.id, 'comments', commentId));
      showToast("Comment deleted", "info");
    } catch (err) {
      showToast("Failed to delete comment", "error");
    }
  };

  const handleReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Report this post for inappropriate content?')) {
      try {
        await addDoc(collection(db, 'reports'), {
          postId: post.id,
          reporterUid: profile?.uid,
          authorUid: post.authorUid,
          createdAt: serverTimestamp(),
          status: 'pending'
        });
        showToast("Post reported. Thank you for keeping our community safe.", "success");
      } catch (err) {
        showToast("Failed to report post", "error");
      }
    }
  };

  const handleRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    setShowRepostDialog(true);
  };

  const handleConfirmRepost = async () => {
    if (!profile || isReposting) return;
    setIsReposting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        content: repostText.trim(),
        repostId: post.id,
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
        repostCount: 0
      });
      
      await updateDoc(doc(db, 'posts', post.id), {
        repostCount: (post.repostCount || 0) + 1
      });

      if (post.authorUid !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'repost',
          fromUid: profile.uid,
          fromName: profile.displayName,
          fromPhoto: profile.photoURL,
          toUid: post.authorUid,
          postId: post.id,
          createdAt: serverTimestamp(),
          read: false
        });
      }
      
      setShowRepostDialog(false);
      setRepostText('');
      showToast(repostText.trim() ? "Quote reposted!" : "Post reposted!", "success");
    } catch (err) {
      console.error("Error reposting:", err);
      showToast("Failed to repost", "error");
    } finally {
      setIsReposting(false);
    }
  };

  const handleCloseRepost = () => {
    if (isReposting) return;
    setShowRepostDialog(false);
    setRepostText('');
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(\s+)/);
    return parts.map((part, i) => {
      if (part.startsWith('#') && part.length > 1) {
        return (
          <span 
            key={i} 
            onClick={(e) => {
              e.stopPropagation();
              onHashtagClick?.(part);
            }}
            className="text-blue-500 font-medium hover:underline cursor-pointer"
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('@') && part.length > 1) {
        return (
          <span 
            key={i} 
            onClick={(e) => {
              e.stopPropagation();
              // In a real app, we'd find the user ID by username
              // For now, we'll just highlight it
            }}
            className="text-indigo-500 font-medium hover:underline cursor-pointer"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => !isEditing && onOpen?.(post)}
      className={cn(
        "bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm group transition-all",
        onOpen && !isEditing ? "hover:border-gray-300 dark:hover:border-zinc-600 cursor-pointer" : ""
      )}
    >
      {post.repostId && (
        <div className="mb-3 flex items-center gap-2 text-xs text-gray-400">
          <Repeat size={14} />
          <span>Reposted</span>
        </div>
      )}
      <div className="flex justify-between items-start mb-4">
        <button 
          onClick={(e) => { e.stopPropagation(); onOpenProfile?.(post.authorUid); }}
          className="flex gap-3 text-left hover:opacity-80 transition-opacity"
        >
          <img src={post.authorPhoto || 'https://picsum.photos/seed/user/100/100'} className="w-11 h-11 rounded-full object-cover border border-gray-100 dark:border-zinc-800" referrerPolicy="no-referrer" />
          <div>
            <div className="font-bold text-sm tracking-tight">{post.authorName}</div>
            <div className="text-[11px] text-gray-400 font-medium">
              {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
            </div>
          </div>
        </button>
        {profile?.uid === post.authorUid ? (
          <div className="flex gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }} 
              className="p-2 text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <PlusCircle size={16} className="rotate-45" />
            </button>
            <button onClick={handleDelete} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleReport}
            className="p-2 text-gray-300 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-orange-50 dark:hover:bg-orange-900/20"
            title="Report Post"
          >
            <Flag size={16} />
          </button>
        )}
      </div>
      
      {post.repostId && repostedPost && (
        <div className="mb-4 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/20">
          <div className="flex items-center gap-2 mb-2">
            <img src={repostedPost.authorPhoto} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
            <span className="font-bold text-xs">{repostedPost.authorName}</span>
            <span className="text-[10px] text-gray-400">
              {repostedPost.createdAt ? formatDistanceToNow(repostedPost.createdAt.toDate(), { addSuffix: true }) : ''}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
            {repostedPost.content}
          </p>
          {(repostedPost.imageUrls?.[0] || repostedPost.imageUrl) && (
            <img 
              src={repostedPost.imageUrls?.[0] || repostedPost.imageUrl} 
              className="mt-2 w-full h-32 object-cover rounded-xl opacity-50" 
              referrerPolicy="no-referrer" 
            />
          )}
        </div>
      )}

      {isEditing ? (
        <div className="mb-4" onClick={e => e.stopPropagation()}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 p-3 rounded-xl border dark:border-zinc-700 text-sm focus:outline-none"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleUpdate} className="flex-1 bg-black dark:bg-white text-white dark:text-black py-1.5 rounded-lg text-xs font-bold">Save</button>
            <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-100 dark:bg-zinc-800 py-1.5 rounded-lg text-xs font-bold">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="text-[15px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed mb-4">
          {renderContent(post.content)}
        </p>
      )}
      
      {post.imageUrls && post.imageUrls.length > 0 && (
        <div className={cn(
          "mb-4 grid gap-2 rounded-2xl overflow-hidden",
          post.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
        )}>
          {post.imageUrls.map((url, idx) => (
            <div 
              key={idx} 
              className="aspect-square bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-800 cursor-zoom-in overflow-hidden"
              onClick={(e) => { e.stopPropagation(); onOpenImage?.(url); }}
            >
              <img 
                src={url} 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" 
                referrerPolicy="no-referrer" 
                alt={`Post image ${idx + 1}`}
              />
            </div>
          ))}
        </div>
      )}

      {post.imageUrl && !post.imageUrls && (
        <div 
          className="mb-4 rounded-2xl overflow-hidden border dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 cursor-zoom-in"
          onClick={(e) => { e.stopPropagation(); onOpenImage?.(post.imageUrl!); }}
        >
          <img src={post.imageUrl} className="w-full h-auto max-h-[400px] object-cover hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="flex items-center justify-between text-gray-400 border-t dark:border-zinc-800 pt-4">
        <div className="flex items-center gap-6">
          <button 
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1.5 transition-all active:scale-125",
              isLiked ? "text-red-500" : "hover:text-red-500"
            )}
          >
            <motion.div
              animate={isLiked ? { scale: [1, 1.4, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
            </motion.div>
            <span 
              className="text-xs font-bold hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onShowLikes?.(post.id);
              }}
            >
              {post.likes || 0}
            </span>
          </button>
          <button 
            onClick={handleRepost}
            className="flex items-center gap-1.5 hover:text-green-500 transition-colors"
          >
            <Repeat size={20} />
            <span className="text-xs font-bold">{post.repostCount || 0}</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
            className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
          >
            <MessageCircle size={20} />
            <span className="text-xs font-bold">{comments.length || 0}</span>
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center gap-1.5 hover:text-green-500 transition-colors"
          >
            <Share2 size={20} />
          </button>
        </div>
        <button 
          onClick={handleBookmark}
          className={cn(
            "p-2 rounded-full transition-all active:scale-125",
            isBookmarked ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" : "hover:bg-gray-100 dark:hover:bg-zinc-800"
          )}
        >
          <Bookmark size={20} fill={isBookmarked ? "currentColor" : "none"} />
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t dark:border-zinc-800 space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3 group/comment">
                  <img src={comment.authorPhoto} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div className="flex-1 relative">
                    <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-2xl">
                      <div className="font-semibold text-xs mb-1">{comment.authorName}</div>
                      <p className="text-sm dark:text-gray-300">{comment.text}</p>
                    </div>
                    {profile?.uid === comment.authorUid && (
                      <button 
                        onClick={() => handleDeleteComment(comment.id)}
                        className="absolute -right-2 -top-2 p-1.5 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-full text-gray-400 hover:text-red-500 opacity-0 group-hover/comment:opacity-100 transition-all shadow-sm"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <form onSubmit={handleComment} className="flex gap-2 mt-4">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 bg-gray-50 dark:bg-zinc-800 rounded-full px-4 py-2 text-sm focus:outline-none"
                />
                <button type="submit" disabled={!commentText.trim()} className="p-2 text-black dark:text-white disabled:opacity-30">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRepostDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseRepost}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
                <h3 className="font-bold">Repost</h3>
                <button onClick={handleCloseRepost} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4">
                <textarea
                  value={repostText}
                  onChange={(e) => setRepostText(e.target.value)}
                  placeholder="Add a comment (optional)"
                  className="w-full bg-gray-50 dark:bg-zinc-800 p-3 rounded-2xl border dark:border-zinc-700 text-sm focus:outline-none min-h-[110px]"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleCloseRepost}
                    disabled={isReposting}
                    className="flex-1 bg-gray-100 dark:bg-zinc-800 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRepost}
                    disabled={isReposting}
                    className="flex-1 bg-black dark:bg-white text-white dark:text-black py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {isReposting ? "Reposting..." : (repostText.trim() ? "Quote Repost" : "Repost")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Feed({ onOpenPost, onOpenProfile, searchHashtag: externalHashtag, onClearHashtag, onOpenImage, onShowLikes }: { 
  onOpenPost: (post: Post) => void, 
  onOpenProfile: (uid: string) => void, 
  searchHashtag?: string | null, 
  onClearHashtag?: () => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  const [feedTab, setFeedTab] = useState<'global' | 'following'>('global');
  const [searchHashtag, setSearchHashtag] = useState<string | null>(null);
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const { profile } = useAuth();

  useEffect(() => {
    if (externalHashtag) {
      setSearchHashtag(externalHashtag);
    }
  }, [externalHashtag]);

  const handleClearHashtag = () => {
    setSearchHashtag(null);
    onClearHashtag?.();
  };

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'follows'), where('followerUid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFollowingUids(snapshot.docs.map(doc => (doc.data() as Follow).followingUid));
    });
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      
      // Filter blocked users
      if (profile?.blockedUsers && profile.blockedUsers.length > 0) {
        allPosts = allPosts.filter(p => !profile.blockedUsers?.includes(p.authorUid));
      }

      // Filter by following if tab is following
      if (feedTab === 'following') {
        allPosts = allPosts.filter(p => followingUids.includes(p.authorUid) || p.authorUid === profile?.uid);
      }

      // Filter by hashtag if search is active
      if (searchHashtag) {
        allPosts = allPosts.filter(p => p.content.toLowerCase().includes(searchHashtag.toLowerCase()));
      }

      setPosts(allPosts.slice(0, 50));
    });
    return unsubscribe;
  }, [feedTab, followingUids, profile?.blockedUsers, searchHashtag]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !profile || uploading) return;

    try {
      await addDoc(collection(db, 'posts'), {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        content: content.trim(),
        imageUrls: imageUrls.filter(url => url.trim() !== ''),
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: []
      });
      setContent('');
      setImageUrls([]);
    } catch (err) {
      const errInfo = handleFirestoreError(err, OperationType.CREATE, 'posts');
      setError(`Failed to post: ${errInfo.error}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !profile) return;

    setUploading(true);
    setUploadProgress(0);
    const newUrls: string[] = [];

    if (!auth.currentUser) {
      setError("Session expired. Please log in again.");
      setUploading(false);
      return;
    }

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > 5 * 1024 * 1024) {
          setError(`File ${file.name} is too large (max 5MB)`);
          continue;
        }

        const storageRef = ref(storage, `posts/${profile.uid}/${Date.now()}_${file.name}`);
        
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            uploadTask.cancel();
            reject(new Error("Upload timed out (30s)"));
          }, 30000);

          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            }, 
            (error) => {
              clearTimeout(timeout);
              reject(error);
            }, 
            () => {
              clearTimeout(timeout);
              resolve();
            }
          );
        });

        const url = await getDownloadURL(uploadTask.snapshot.ref);
        newUrls.push(url);
      }
      setImageUrls(prev => [...prev, ...newUrls]);
    } catch (err) {
      const msg = handleStorageError(err, `posts/${profile.uid}`);
      setError(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeImageUrl = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const clearImages = () => {
    setImageUrls([]);
    if (uploading) {
      // We can't easily cancel the uploadTask without keeping a ref to it, 
      // but we can at least clear the UI state.
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getTrendingHashtags = () => {
    const counts: Record<string, number> = {};
    posts.forEach(p => {
      const tags = p.content.match(/#[a-zA-Z0-9_]+/g);
      if (tags) {
        tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  };

  const trending = getTrendingHashtags();

  return (
    <div className="max-w-4xl mx-auto py-20 px-4 flex flex-col md:flex-row gap-8">
      <div className="flex-1 max-w-xl">
        {searchHashtag && (
          <div className="mb-6 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <span className="font-bold text-lg">#{searchHashtag.replace('#', '')}</span>
              <span className="text-sm opacity-70">results</span>
            </div>
            <button 
              onClick={handleClearHashtag}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full animate-pulse" />
              {error}
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-xs underline hover:no-underline opacity-70"
            >
              Dismiss
            </button>
          </div>
        )}

        {uploading && (
          <div className="mb-6 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between text-xs font-medium mb-2">
              <span className="text-gray-500">Uploading images...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-black dark:bg-white"
              />
            </div>
          </div>
        )}

        <div className="flex gap-4 mb-8 border-b dark:border-zinc-800">
          <button 
            onClick={() => setFeedTab('global')}
            className={cn(
              "pb-2 px-2 text-sm font-semibold transition-all",
              feedTab === 'global' ? "border-b-2 border-black dark:border-white text-black dark:text-white" : "text-gray-400"
            )}
          >
            Global
          </button>
          <button 
            onClick={() => setFeedTab('following')}
            className={cn(
              "pb-2 px-2 text-sm font-semibold transition-all",
              feedTab === 'following' ? "border-b-2 border-black dark:border-white text-black dark:text-white" : "text-gray-400"
            )}
          >
            Following
          </button>
        </div>

        <form onSubmit={handlePost} className="mb-8 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-transparent resize-none focus:outline-none text-lg min-h-[100px]"
            maxLength={1000}
          />
          
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2 mb-4">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img src={url} className="w-full h-32 object-cover rounded-xl border dark:border-zinc-800" referrerPolicy="no-referrer" />
                  <button 
                    type="button"
                    onClick={() => removeImageUrl(idx)}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center mt-4 border-t border-gray-50 dark:border-zinc-800 pt-4">
            <div className="flex items-center gap-2">
              <label className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer">
                <ImageIcon size={20} />
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                {imageUrls.length > 0 && <span className="text-xs font-bold">{imageUrls.length}</span>}
              </label>
              {imageUrls.length > 0 && !uploading && (
                <button 
                  type="button"
                  onClick={clearImages}
                  className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:underline"
                >
                  Clear
                </button>
              )}
              {uploading && <div className="w-4 h-4 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />}
              <span className="text-xs text-gray-400">{content.length}/1000</span>
            </div>
            <button 
              type="submit"
              disabled={!content.trim() || uploading}
              className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-full font-medium disabled:opacity-50 transition-opacity"
            >
              {uploading ? 'Uploading...' : 'Post'}
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                onOpen={onOpenPost} 
                onOpenProfile={onOpenProfile}
                onHashtagClick={(tag) => setSearchHashtag(tag)}
                onOpenImage={onOpenImage}
                onShowLikes={onShowLikes}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <aside className="hidden lg:block w-64 space-y-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4 tracking-tight">Trending</h3>
          <div className="space-y-4">
            {trending.length > 0 ? trending.map(([tag, count]) => (
              <div 
                key={tag} 
                onClick={() => setSearchHashtag(tag)}
                className="group cursor-pointer"
              >
                <div className="text-sm font-bold text-black dark:text-white group-hover:underline">{tag}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest">{count} posts</div>
              </div>
            )) : (
              <div className="text-sm text-gray-400">No trends yet</div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/20">
          <h3 className="font-bold text-sm mb-2 text-blue-600 dark:text-blue-400">Pro Tip</h3>
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            Use hashtags to make your posts discoverable by everyone in the community!
          </p>
        </div>

        <WhoToFollow onOpenProfile={onOpenProfile} />
      </aside>
    </div>
  );
}

function Profile({ userId, onOpenPost, onOpenProfile, onHashtagClick, onBack, onOpenImage, onShowLikes }: { 
  userId?: string, 
  onOpenPost: (post: Post) => void, 
  onOpenProfile?: (uid: string) => void, 
  onHashtagClick?: (tag: string) => void, 
  onBack?: () => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string
}) {
  const { profile: currentProfile } = useAuth();
  const { showToast } = useToast();
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'followers' | 'following'>('posts');
  const [followerProfiles, setFollowerProfiles] = useState<UserProfile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const effectiveUid = userId || currentProfile?.uid;

  useEffect(() => {
    if (!effectiveUid) return;
    setLoading(true);

    const fetchProfile = async () => {
      const docRef = doc(db, 'users', effectiveUid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setTargetProfile(data);
        setNewBio(data.bio || '');
      }
    };

    fetchProfile();

    const q = query(
      collection(db, 'posts'), 
      where('authorUid', '==', effectiveUid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUserPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
      setLoading(false);
    });

    const followersQ = query(collection(db, 'follows'), where('followingUid', '==', effectiveUid));
    const followingQ = query(collection(db, 'follows'), where('followerUid', '==', effectiveUid));
    
    const unsubFollowing = onSnapshot(followingQ, (s) => {
      setStats(prev => ({ ...prev, following: s.size }));
      const uids = s.docs.map(d => (d.data() as Follow).followingUid);
      if (uids.length > 0) {
        const q = query(collection(db, 'users'), where('uid', 'in', uids.slice(0, 10)));
        getDocs(q).then(snap => setFollowingProfiles(snap.docs.map(d => d.data() as UserProfile)));
      } else {
        setFollowingProfiles([]);
      }
    });

    const unsubFollowers = onSnapshot(followersQ, (s) => {
      setStats(prev => ({ ...prev, followers: s.size }));
      const uids = s.docs.map(d => (d.data() as Follow).followerUid);
      if (uids.length > 0) {
        const q = query(collection(db, 'users'), where('uid', 'in', uids.slice(0, 10)));
        getDocs(q).then(snap => setFollowerProfiles(snap.docs.map(d => d.data() as UserProfile)));
      } else {
        setFollowerProfiles([]);
      }
    });

    if (currentProfile && effectiveUid !== currentProfile.uid) {
      const followRef = doc(db, 'follows', currentProfile.uid + '_' + effectiveUid);
      const unsubFollowStatus = onSnapshot(followRef, (doc) => setIsFollowing(doc.exists()));
      return () => {
        unsubscribe();
        unsubFollowers();
        unsubFollowing();
        unsubFollowStatus();
      };
    }

    return () => {
      unsubscribe();
      unsubFollowers();
      unsubFollowing();
    };
  }, [effectiveUid, currentProfile]);

  const handleUpdateBio = async () => {
    if (!currentProfile) return;
    try {
      await updateDoc(doc(db, 'users', currentProfile.uid), { bio: newBio });
      setTargetProfile(prev => prev ? { ...prev, bio: newBio } : null);
      setIsEditing(false);
    } catch (err) {
      const errInfo = handleFirestoreError(err, OperationType.UPDATE, `users/${currentProfile.uid}`);
      setError(`Failed to update bio: ${errInfo.error}`);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProfile) return;

    setUploadingAvatar(true);
    setAvatarProgress(0);
    
    if (!auth.currentUser) {
      setError("Session expired. Please log in again.");
      setUploadingAvatar(false);
      return;
    }

    try {
      if (file.size > 2 * 1024 * 1024) {
        setError("Avatar image must be less than 2MB");
        setUploadingAvatar(false);
        return;
      }

      const storageRef = ref(storage, `avatars/${currentProfile.uid}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          uploadTask.cancel();
          reject(new Error("Upload timed out (30s)"));
        }, 30000);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setAvatarProgress(progress);
          }, 
          (error) => {
            clearTimeout(timeout);
            reject(error);
          }, 
          () => {
            clearTimeout(timeout);
            resolve();
          }
        );
      });

      const url = await getDownloadURL(uploadTask.snapshot.ref);
      
      const userDocRef = doc(db, 'users', currentProfile.uid);
      await updateDoc(userDocRef, { photoURL: url });
      setTargetProfile(prev => prev ? { ...prev, photoURL: url } : null);
    } catch (err) {
      const msg = handleStorageError(err, `avatars/${currentProfile.uid}`);
      setError(`Avatar upload failed: ${msg}`);
    } finally {
      setUploadingAvatar(false);
      setAvatarProgress(0);
    }
  };

  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [headerProgress, setHeaderProgress] = useState(0);

  const handleHeaderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProfile) return;

    setUploadingHeader(true);
    setHeaderProgress(0);
    
    if (!auth.currentUser) {
      setError("Session expired. Please log in again.");
      setUploadingHeader(false);
      return;
    }

    try {
      if (file.size > 5 * 1024 * 1024) {
        setError("Header image must be less than 5MB");
        setUploadingHeader(false);
        return;
      }

      const storageRef = ref(storage, `headers/${currentProfile.uid}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          uploadTask.cancel();
          reject(new Error("Upload timed out (30s)"));
        }, 30000);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setHeaderProgress(progress);
          }, 
          (error) => {
            clearTimeout(timeout);
            reject(error);
          }, 
          () => {
            clearTimeout(timeout);
            resolve();
          }
        );
      });

      const url = await getDownloadURL(uploadTask.snapshot.ref);
      
      const userDocRef = doc(db, 'users', currentProfile.uid);
      await updateDoc(userDocRef, { headerURL: url });
      setTargetProfile(prev => prev ? { ...prev, headerURL: url } : null);
    } catch (err) {
      const msg = handleStorageError(err, `headers/${currentProfile.uid}`);
      setError(`Header upload failed: ${msg}`);
    } finally {
      setUploadingHeader(false);
      setHeaderProgress(0);
    }
  };

  const handleFollow = async () => {
    if (!currentProfile || !effectiveUid) return;
    const followId = currentProfile.uid + '_' + effectiveUid;
    if (isFollowing) {
      await deleteDoc(doc(db, 'follows', followId));
    } else {
      await setDoc(doc(db, 'follows', followId), {
        followerUid: currentProfile.uid,
        followingUid: effectiveUid,
        createdAt: serverTimestamp()
      });
      
      // Notification
      await addDoc(collection(db, 'notifications'), {
        type: 'follow',
        fromUid: currentProfile.uid,
        fromName: currentProfile.displayName,
        fromPhoto: currentProfile.photoURL,
        toUid: effectiveUid,
        createdAt: serverTimestamp(),
        read: false
      });
    }
  };

  const handleBlock = async () => {
    if (!currentProfile || !targetProfile) return;
    const isBlocked = currentProfile.blockedUsers?.includes(targetProfile.uid);
    
    if (isBlocked) {
      if (window.confirm(`Unblock ${targetProfile.displayName}?`)) {
        try {
          await updateDoc(doc(db, 'users', currentProfile.uid), {
            blockedUsers: arrayRemove(targetProfile.uid)
          });
          showToast(`Unblocked ${targetProfile.displayName}`, "success");
        } catch (err) {
          showToast("Failed to unblock user", "error");
        }
      }
    } else {
      if (window.confirm(`Block ${targetProfile.displayName}? This user's posts will be hidden from your feed.`)) {
        try {
          await updateDoc(doc(db, 'users', currentProfile.uid), {
            blockedUsers: arrayUnion(targetProfile.uid)
          });
          showToast(`Blocked ${targetProfile.displayName}`, "info");
          if (isFollowing) handleFollow(); // Unfollow if blocking
        } catch (err) {
          showToast("Failed to block user", "error");
        }
      }
    }
  };

  if (loading) return (
    <div className="max-w-xl mx-auto py-40 flex justify-center">
      <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
    </div>
  );

  if (!targetProfile) return <div className="text-center py-40">User not found</div>;

  const isOwnProfile = currentProfile?.uid === effectiveUid;

  return (
    <div className="max-w-xl mx-auto py-20 px-4">
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium shadow-xl flex items-center justify-between gap-4 backdrop-blur-md min-w-[300px]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full animate-pulse" />
            {error}
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-xs underline hover:no-underline opacity-70 whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white mb-6 transition-colors group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back</span>
        </button>
      )}

      <div className="relative mb-16">
        <div className="h-40 w-full bg-gray-100 dark:bg-zinc-800 rounded-3xl overflow-hidden relative group border border-gray-100 dark:border-zinc-800 shadow-sm">
          {targetProfile.headerURL ? (
            <img src={targetProfile.headerURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900" />
          )}
          {isOwnProfile && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-[2px]">
              <div className="bg-white/20 p-2 rounded-full backdrop-blur-md border border-white/30">
                <Camera size={20} className="text-white" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleHeaderChange} disabled={uploadingHeader} />
            </label>
          )}
          {uploadingHeader && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="w-6 h-6 border-2 border-white border-t-transparent animate-spin rounded-full mb-2" />
              <span className="text-[10px] text-white font-bold">{Math.round(headerProgress)}%</span>
            </div>
          )}
        </div>

        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
          <div className="relative w-24 h-24 group">
            <img 
              src={targetProfile.photoURL} 
              className={cn(
                "w-24 h-24 rounded-full border-4 border-white dark:border-zinc-900 shadow-lg object-cover transition-opacity",
                uploadingAvatar ? "opacity-50" : ""
              )} 
              referrerPolicy="no-referrer" 
            />
            {isOwnProfile && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <ImageIcon size={24} className="text-white" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                />
              </label>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-full">
                <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin rounded-full mb-2" />
                <span className="text-[10px] text-white font-bold">{Math.round(avatarProgress)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center mb-12">
        <h1 className="text-2xl font-bold tracking-tight">{targetProfile.displayName}</h1>
        <p className="text-gray-500 text-sm mt-1">{targetProfile.email}</p>
        
        {isOwnProfile ? (
          isEditing ? (
            <div className="mt-4 max-w-xs mx-auto">
              <textarea
                value={newBio}
                onChange={(e) => setNewBio(e.target.value)}
                className="w-full p-2 rounded-lg border dark:bg-zinc-900 dark:border-zinc-800 text-sm"
                placeholder="Tell us about yourself..."
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleUpdateBio} className="flex-1 bg-black dark:bg-white text-white dark:text-black py-1 rounded-lg text-sm font-bold">Save</button>
                <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-100 dark:bg-zinc-800 py-1 rounded-lg text-sm font-bold">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-gray-700 dark:text-gray-300 italic">"{targetProfile.bio || 'No bio yet'}"</p>
              <button onClick={() => setIsEditing(true)} className="text-xs text-blue-500 mt-2 hover:underline">Edit Bio</button>
            </div>
          )
        ) : (
          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-gray-700 dark:text-gray-300 italic">"{targetProfile.bio || 'No bio yet'}"</p>
            <div className="flex gap-2">
              <button 
                onClick={handleFollow}
                className={cn(
                  "px-8 py-2 rounded-full font-bold transition-all",
                  isFollowing 
                    ? "bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border border-gray-200 dark:border-zinc-700" 
                    : "bg-black dark:bg-white text-white dark:text-black"
                )}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button 
                onClick={handleBlock}
                className={cn(
                  "px-4 py-2 rounded-full font-bold transition-all text-xs",
                  currentProfile?.blockedUsers?.includes(targetProfile.uid)
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-400 hover:text-red-500"
                )}
              >
                {currentProfile?.blockedUsers?.includes(targetProfile.uid) ? 'Blocked' : 'Block'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-12 border-y border-gray-100 dark:border-zinc-800 py-4">
          <button 
            onClick={() => setActiveTab('posts')}
            className={cn(
              "text-center transition-all hover:scale-105",
              activeTab === 'posts' ? "opacity-100" : "opacity-50"
            )}
          >
            <div className="font-bold text-lg">{userPosts.length}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">Posts</div>
          </button>
          <button 
            onClick={() => setActiveTab('followers')}
            className={cn(
              "text-center transition-all hover:scale-105",
              activeTab === 'followers' ? "opacity-100" : "opacity-50"
            )}
          >
            <div className="font-bold text-lg">{stats.followers}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">Followers</div>
          </button>
          <button 
            onClick={() => setActiveTab('following')}
            className={cn(
              "text-center transition-all hover:scale-105",
              activeTab === 'following' ? "opacity-100" : "opacity-50"
            )}
          >
            <div className="font-bold text-lg">{stats.following}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">Following</div>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'posts' && (
          <motion.div 
            key="posts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 gap-4"
          >
            {userPosts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onOpen={onOpenPost} 
                onOpenProfile={onBack ? (uid) => onOpenProfile?.(uid) : undefined} 
                onHashtagClick={onHashtagClick}
                onOpenImage={onOpenImage}
                onShowLikes={onShowLikes}
              />
            ))}
            {userPosts.length === 0 && (
              <div className="text-center py-20 text-gray-400">No posts yet</div>
            )}
          </motion.div>
        )}

        {activeTab === 'followers' && (
          <motion.div 
            key="followers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {followerProfiles.map(u => (
              <div key={u.uid} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <button 
                  onClick={() => onOpenProfile?.(u.uid)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <img src={u.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div className="text-left">
                    <div className="font-bold text-sm">{u.displayName}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest">{u.email}</div>
                  </div>
                </button>
              </div>
            ))}
            {followerProfiles.length === 0 && (
              <div className="text-center py-20 text-gray-400">No followers yet</div>
            )}
          </motion.div>
        )}

        {activeTab === 'following' && (
          <motion.div 
            key="following"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {followingProfiles.map(u => (
              <div key={u.uid} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <button 
                  onClick={() => onOpenProfile?.(u.uid)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <img src={u.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div className="text-left">
                    <div className="font-bold text-sm">{u.displayName}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest">{u.email}</div>
                  </div>
                </button>
              </div>
            ))}
            {followingProfiles.length === 0 && (
              <div className="text-center py-20 text-gray-400">Not following anyone yet</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Messages({ onSelectChat, onOpenProfile }: { onSelectChat: (uid: string) => void, onOpenProfile: (uid: string) => void, key?: string }) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const [recentChats, setRecentChats] = useState<UserProfile[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile).filter(u => u.uid !== profile?.uid));
    });
    
    if (profile) {
      const q = query(collection(db, 'follows'), where('followerUid', '==', profile.uid));
      const unsubFollows = onSnapshot(q, (snapshot) => {
        setFollowingUids(snapshot.docs.map(doc => (doc.data() as Follow).followingUid));
      });

      // Listen for unread messages
      const qUnread = query(
        collection(db, 'messages'),
        where('receiverUid', '==', profile.uid),
        where('read', '==', false)
      );
      const unsubUnread = onSnapshot(qUnread, (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach(doc => {
          const m = doc.data() as Message;
          counts[m.senderUid] = (counts[m.senderUid] || 0) + 1;
        });
        setUnreadCounts(counts);
      });

      // Get recent messages to find people you've chatted with
      const qMsgs = query(
        collection(db, 'messages'),
        where('senderUid', '==', profile.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const unsubMsgs = onSnapshot(qMsgs, async (snapshot) => {
        const uids = Array.from(new Set(snapshot.docs.map(d => (d.data() as Message).receiverUid)));
        const chatUsers: UserProfile[] = [];
        for (const uid of uids) {
          const d = await getDoc(doc(db, 'users', uid));
          if (d.exists()) chatUsers.push(d.data() as UserProfile);
        }
        setRecentChats(chatUsers);
      });

      return () => { unsubscribe(); unsubFollows(); unsubMsgs(); unsubUnread(); };
    }
    return unsubscribe;
  }, [profile]);

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const followingUsers = users.filter(u => followingUids.includes(u.uid));

  return (
    <div className="max-w-xl mx-auto py-20 px-4">
      <h2 className="text-3xl font-bold mb-8 tracking-tight">Messages</h2>
      
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
          className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl pl-12 pr-4 py-4 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all shadow-sm"
        />
      </div>

      {search.length === 0 && (
        <>
          {recentChats.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Recent Chats</h3>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {recentChats.map(user => (
                  <button
                    key={user.uid}
                    onClick={() => onSelectChat(user.uid)}
                    className="flex flex-col items-center gap-2 min-w-[80px] group"
                  >
                    <div className="relative">
                      <img src={user.photoURL} className="w-16 h-16 rounded-full object-cover border-2 border-transparent group-hover:border-black dark:group-hover:border-white transition-all" referrerPolicy="no-referrer" />
                      {user.isOnline && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-black rounded-full" />
                      )}
                      {unreadCounts[user.uid] > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-black min-w-[20px] text-center">
                          {unreadCounts[user.uid]}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold truncate w-full text-center">{user.displayName.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {followingUsers.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Following</h3>
              <div className="space-y-3">
                {followingUsers.map(user => (
                  <div
                    key={user.uid}
                    onClick={() => onSelectChat(user.uid)}
                    className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 hover:border-black dark:hover:border-white transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img src={user.photoURL} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                        {user.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-black rounded-full" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2">
                          {user.displayName}
                          {unreadCounts[user.uid] > 0 && (
                            <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                              {unreadCounts[user.uid]}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">{user.email}</div>
                      </div>
                    </div>
                    <MessageSquare size={18} className="text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {search.length > 0 && (
        <div className="space-y-3">
          {filteredUsers.map(user => (
            <div
              key={user.uid}
              onClick={() => onSelectChat(user.uid)}
              className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 hover:border-black dark:hover:border-white transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <img src={user.photoURL} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div>
                  <div className="font-bold text-sm">{user.displayName}</div>
                  <div className="text-[10px] text-gray-400">{user.email}</div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectChat(user.uid);
                }}
                className="bg-black dark:bg-white text-white dark:text-black px-4 py-1.5 rounded-full text-[10px] font-bold"
              >
                Message
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chat({ receiverUid, onBack, onOpenImage }: { receiverUid: string, onBack: () => void, onOpenImage: (url: string) => void, key?: string }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [receiver, setReceiver] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubReceiver = onSnapshot(doc(db, 'users', receiverUid), (d) => {
      setReceiver(d.data() as UserProfile);
    });
    
    if (!profile) return;
    
    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      const filtered = allMsgs.filter(m => 
        (m.senderUid === profile.uid && m.receiverUid === receiverUid) ||
        (m.senderUid === receiverUid && m.receiverUid === profile.uid)
      );
      setMessages(filtered);

      // Mark unread messages as read
      filtered.forEach(m => {
        if (m.senderUid === receiverUid && m.receiverUid === profile.uid && !m.read) {
          updateDoc(doc(db, 'messages', m.id), { read: true }).catch(console.error);
        }
      });
    });
    return () => {
      unsubscribe();
      unsubReceiver();
    };
  }, [receiverUid, profile]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !uploading) || !profile) return;

    const messageData: any = {
      senderUid: profile.uid,
      receiverUid,
      text: text.trim(),
      createdAt: serverTimestamp(),
      read: false
    };

    await addDoc(collection(db, 'messages'), messageData);
    setText('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    const storageRef = ref(storage, `chats/${profile.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      },
      (error) => {
        console.error("Upload error:", error);
        setUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, 'messages'), {
          senderUid: profile.uid,
          receiverUid,
          text: '',
          imageUrl: downloadURL,
          createdAt: serverTimestamp(),
          read: false
        });
        setUploading(false);
        setProgress(0);
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto h-screen flex flex-col bg-white dark:bg-black">
      <div className="p-4 border-b dark:border-zinc-800 flex items-center justify-between bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          {receiver && (
            <div className="flex items-center gap-3">
              <img src={receiver.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
              <div>
                <div className="font-bold text-sm">{receiver.displayName}</div>
                {receiver.isOnline ? (
                  <div className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Online</div>
                ) : (
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Last seen {receiver.lastSeen ? formatDistanceToNow(receiver.lastSeen.toDate(), { addSuffix: true }) : 'recently'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-zinc-900/20">
        {messages.map((m, idx) => {
          const isMe = m.senderUid === profile?.uid;
          const showAvatar = idx === 0 || messages[idx-1].senderUid !== m.senderUid;
          
          return (
            <div key={m.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
              {!isMe && (
                <div className="w-8 flex-shrink-0">
                  {showAvatar && <img src={receiver?.photoURL} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />}
                </div>
              )}
              <div className={cn(
                "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                isMe 
                  ? "bg-black dark:bg-white text-white dark:text-black rounded-tr-none" 
                  : "bg-white dark:bg-zinc-800 text-black dark:text-white rounded-tl-none border border-gray-100 dark:border-zinc-700"
              )}>
                {m.imageUrl && (
                  <img 
                    src={m.imageUrl} 
                    className="rounded-xl mb-2 max-w-full h-auto cursor-zoom-in" 
                    referrerPolicy="no-referrer" 
                    onClick={() => onOpenImage(m.imageUrl!)}
                  />
                )}
                {m.text}
                <div className={cn(
                  "text-[9px] mt-1 opacity-50 flex items-center gap-1",
                  isMe ? "justify-end" : "justify-start"
                )}>
                  {m.createdAt ? format(m.createdAt.toDate(), 'HH:mm') : ''}
                  {isMe && (
                    <span className={cn(m.read ? "text-blue-500" : "text-gray-400")}>
                      {m.read ? 'Read' : 'Sent'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
            <div className="p-4 bg-gray-100 dark:bg-zinc-800 rounded-full">
              <MessageSquare size={32} />
            </div>
            <p className="text-sm font-medium">Start a conversation with {receiver?.displayName}</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white dark:bg-black border-t dark:border-zinc-800">
        {uploading && (
          <div className="mb-2 px-2">
            <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-black dark:bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex gap-2 bg-gray-100 dark:bg-zinc-900 rounded-2xl p-2 items-center">
          <label className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
            <Plus size={20} />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2"
            disabled={uploading}
          />
          <button 
            type="submit"
            disabled={(!text.trim() && !uploading) || uploading}
            className="bg-black dark:bg-white text-white dark:text-black p-2 rounded-xl disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

function Login() {
  const { signIn } = useAuth();
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4">
      <div className="text-center max-w-sm w-full">
        <div className="w-16 h-16 bg-black dark:bg-white rounded-2xl mx-auto mb-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white dark:border-black rounded-full" />
        </div>
        <h1 className="text-4xl font-bold tracking-tighter mb-4">MINIMAL</h1>
        <p className="text-gray-500 mb-8">A social space for clear thoughts and meaningful connections.</p>
        <button 
          onClick={signIn}
          className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-3 shadow-xl"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}

// --- Main App ---

function PostDetail({ post, onBack, onOpenProfile, onHashtagClick, onOpenImage, onShowLikes }: { 
  post: Post, 
  onBack: () => void, 
  onOpenProfile: (uid: string) => void, 
  onHashtagClick?: (tag: string) => void,
  onOpenImage: (url: string) => void,
  onShowLikes: (postId: string) => void,
  key?: string
}) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [likedByUsers, setLikedByUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
    return unsubscribe;
  }, [post.id]);

  useEffect(() => {
    if (!post.likedBy?.length) {
      setLikedByUsers([]);
      return;
    }
    // Fetch profiles of users who liked
    const fetchLikers = async () => {
      const likers: UserProfile[] = [];
      // Firestore 'in' query limit is 10, so we chunk or just take first 10 for preview
      const likerUids = post.likedBy!.slice(0, 10);
      const q = query(collection(db, 'users'), where('uid', 'in', likerUids));
      const s = await getDocs(q);
      setLikedByUsers(s.docs.map(d => d.data() as UserProfile));
    };
    fetchLikers();
  }, [post.likedBy]);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !profile) return;

    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        text: commentText.trim(),
        createdAt: serverTimestamp()
      });
      
      if (post.authorUid !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'comment',
          fromUid: profile.uid,
          fromName: profile.displayName,
          fromPhoto: profile.photoURL,
          toUid: post.authorUid,
          postId: post.id,
          createdAt: serverTimestamp(),
          read: false
        });
      }
      
      setCommentText('');
    } catch (err) {
      console.error("Error commenting:", err);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-20 px-4">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white mb-6 transition-colors group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium">Back</span>
      </button>

      <PostCard post={post} onOpenProfile={onOpenProfile} onHashtagClick={onHashtagClick} onOpenImage={onOpenImage} onShowLikes={onShowLikes} />

      {likedByUsers.length > 0 && (
        <div className="mt-6 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-50 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={14} className="text-red-500 fill-red-500" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Liked by</span>
          </div>
          <div className="flex -space-x-2 overflow-hidden">
            {likedByUsers.map(user => (
              <button 
                key={user.uid}
                onClick={() => onOpenProfile(user.uid)}
                className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-zinc-900 hover:scale-110 transition-transform"
                title={user.displayName}
              >
                <img src={user.photoURL} className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
            {post.likes > likedByUsers.length && (
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 dark:bg-zinc-800 ring-2 ring-white dark:ring-zinc-900 text-[10px] font-bold">
                +{post.likes - likedByUsers.length}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-bold text-lg mb-4">Comments ({comments.length})</h3>
        
        <form onSubmit={handleComment} className="flex gap-2 mb-8">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-black dark:focus:border-white transition-colors"
          />
          <button 
            type="submit"
            disabled={!commentText.trim()}
            className="bg-black dark:bg-white text-white dark:text-black p-2 rounded-full disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </form>

        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-50 dark:border-zinc-800">
              <img src={comment.authorPhoto} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs">{comment.authorName}</span>
                  <span className="text-[10px] text-gray-400">
                    {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No comments yet. Be the first to comment!</div>
          )}
        </div>
      </div>
    </div>
  );
}

function LikesModal({ postId, onClose, onOpenProfile }: { postId: string, onClose: () => void, onOpenProfile: (uid: string) => void }) {
  const [likes, setLikes] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLikes = async () => {
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (postDoc.exists()) {
        const likedBy = (postDoc.data() as Post).likedBy || [];
        const users: UserProfile[] = [];
        for (const uid of likedBy) {
          const uDoc = await getDoc(doc(db, 'users', uid));
          if (uDoc.exists()) users.push(uDoc.data() as UserProfile);
        }
        setLikes(users);
      }
      setLoading(false);
    };
    fetchLikes();
  }, [postId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
          <h3 className="font-bold">Liked by</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
            </div>
          ) : likes.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No likes yet</div>
          ) : (
            likes.map(user => (
              <button
                key={user.uid}
                onClick={() => { onOpenProfile(user.uid); onClose(); }}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl transition-colors text-left"
              >
                <img src={user.photoURL} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div>
                  <div className="font-bold text-sm">{user.displayName}</div>
                  <div className="text-[10px] text-gray-400">{user.email}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Notifications({ onOpenPost }: { onOpenPost: (post: Post) => void, key?: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'), 
      where('toUid', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (s) => {
      setNotifications(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });
    return unsubscribe;
  }, [profile]);

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
    if (n.postId) {
      const postDoc = await getDoc(doc(db, 'posts', n.postId));
      if (postDoc.exists()) {
        onOpenPost({ id: postDoc.id, ...postDoc.data() } as Post);
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Clear all notifications?')) {
      try {
        const batch = notifications.map(n => deleteDoc(doc(db, 'notifications', n.id)));
        await Promise.all(batch);
        showToast("Notifications cleared", "info");
      } catch (err) {
        showToast("Failed to clear notifications", "error");
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      const batch = unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
      await Promise.all(batch);
      showToast("All marked as read", "success");
    } catch (err) {
      showToast("Failed to mark as read", "error");
    }
  };

  const getMessage = (n: Notification) => {
    switch(n.type) {
      case 'like': return 'liked your post';
      case 'comment': return 'commented on your post';
      case 'follow': return 'started following you';
      case 'repost': return 'reposted your post';
      default: return 'interacted with you';
    }
  };

  return (
    <div className="max-w-xl mx-auto py-20 px-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            <button 
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-full transition-colors"
            >
              Mark all as read
            </button>
            <button 
              onClick={handleClearAll}
              className="text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-full transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {notifications.length === 0 && (
          <div className="text-center py-10 text-gray-400">No notifications yet</div>
        )}
        {notifications.map(n => (
          <div 
            key={n.id} 
            onClick={() => handleNotificationClick(n)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-2xl border transition-all",
              n.postId ? "cursor-pointer hover:border-gray-300 dark:hover:border-zinc-700" : "",
              n.read ? "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800" : "bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
            )}
          >
            <img src={n.fromPhoto} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-bold">{n.fromName}</span> {getMessage(n)}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                {n.createdAt ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialApp() {
  const { user, loading, profile, logout } = useAuth();
  const [view, setView] = useState<View>('feed');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center dark:bg-black">
      <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent animate-spin rounded-full" />
    </div>
  );

  if (!user) return <Login />;

  const handleOpenPost = (post: Post) => {
    setSelectedPost(post);
    setView('post_detail');
  };

  const handleOpenProfile = (uid: string) => {
    if (uid === profile?.uid) {
      setView('profile');
    } else {
      setSelectedUser(uid);
      setView('user_profile');
    }
  };

  const handleHashtagClick = (tag: string) => {
    setActiveHashtag(tag);
    setView('feed');
  };

  const handleOpenImage = (url: string) => {
    setSelectedImage(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white transition-colors">
      <Navbar 
        currentView={view} 
        setView={setView} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
        onSearchUser={handleOpenProfile}
      />
      
      <main className="pb-20 md:pt-16">
        <AnimatePresence mode="wait">
          {view === 'feed' && (
            <Feed 
              key="feed"
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              searchHashtag={activeHashtag}
              onClearHashtag={() => setActiveHashtag(null)}
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'explore' && (
            <Explore 
              key="explore"
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'bookmarks' && (
            <Bookmarks 
              key="bookmarks"
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'notifications' && <Notifications key="notifications" onOpenPost={handleOpenPost} />}
          {view === 'profile' && (
            <Profile 
              key="profile"
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              onHashtagClick={handleHashtagClick} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'user_profile' && selectedUser && (
            <Profile 
              key={`user_${selectedUser}`}
              userId={selectedUser} 
              onOpenPost={handleOpenPost} 
              onOpenProfile={handleOpenProfile} 
              onHashtagClick={handleHashtagClick} 
              onBack={() => setView('feed')} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'post_detail' && selectedPost && (
            <PostDetail 
              key={`post_${selectedPost.id}`}
              post={selectedPost} 
              onBack={() => setView('feed')} 
              onOpenProfile={handleOpenProfile} 
              onHashtagClick={handleHashtagClick} 
              onOpenImage={handleOpenImage}
              onShowLikes={setLikesPostId}
            />
          )}
          {view === 'messages' && (
            <Messages 
              key="messages"
              onSelectChat={(uid) => { setSelectedChat(uid); setView('chat'); }} 
              onOpenProfile={handleOpenProfile} 
            />
          )}
          {view === 'chat' && selectedChat && (
            <Chat 
              key={`chat_${selectedChat}`}
              receiverUid={selectedChat} 
              onBack={() => setView('messages')} 
              onOpenImage={handleOpenImage}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedImage && (
          <Lightbox url={selectedImage} onClose={() => setSelectedImage(null)} />
        )}
        {likesPostId && (
          <LikesModal 
            postId={likesPostId} 
            onClose={() => setLikesPostId(null)} 
            onOpenProfile={handleOpenProfile} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ErrorFallback({ error, resetErrorBoundary }: { error: any, resetErrorBoundary: () => void }) {
  let displayMessage = "Something went wrong.";
  try {
    const parsed = JSON.parse(error.message || "");
    if (parsed.error && parsed.error.includes("insufficient permissions")) {
      displayMessage = `Security Error: You don't have permission to ${parsed.operationType} at ${parsed.path}. Please check your rules.`;
    } else {
      displayMessage = parsed.error || error.message || displayMessage;
    }
  } catch (e) {
    displayMessage = error.message || displayMessage;
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-900/10 text-center">
      <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Oops!</h1>
      <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-md">{displayMessage}</p>
      <button 
        onClick={() => window.location.reload()} 
        className="bg-red-600 text-white px-6 py-2 rounded-full font-bold hover:bg-red-700 transition-colors"
      >
        Reload App
      </button>
    </div>
  );
}

// Since standard ErrorBoundary requires a class, and we are having TS issues, 
// let's use a simpler approach for now or ensure the class is correctly defined.
// Actually, let's try one more time with a very standard class definition.

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SocialApp />
      </ToastProvider>
    </AuthProvider>
  );
}
