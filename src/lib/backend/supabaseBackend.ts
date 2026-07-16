import { supabase } from '../supabase/client';
import type {
  BackendFriendship,
  BackendPost,
  BackendPostDraft,
  BackendProfile,
  SocialBackend,
} from './types';

const mapProfile = (row: any): BackendProfile => ({
  id: row.id,
  username: row.username ?? null,
  displayName: row.display_name || 'Zimo user',
  avatarUrl: row.avatar_url ?? null,
  bio: row.bio ?? null,
  city: row.city ?? null,
  statusText: row.status_text ?? null,
  statusEmoji: row.status_emoji ?? null,
  creativeMode: row.creative_mode === true,
  createdAt: row.created_at,
});

const mapPost = (row: any): BackendPost => ({
  id: row.id,
  authorId: row.author_id,
  content: row.content || '',
  imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
  videoUrl: row.video_url ?? null,
  audience: row.audience || 'public',
  circleId: row.circle_id ?? null,
  creativeType: row.creative_type ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
};

export const supabaseBackend: SocialBackend = {
  provider: 'supabase',

  async getCurrentProfile() {
    const userId = await getUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data ? mapProfile(data) : null;
  },

  async createPost(draft: BackendPostDraft) {
    const userId = await getUserId();
    if (!userId) throw new Error('Not signed in');

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: userId,
        content: draft.content,
        image_urls: draft.imageUrls ?? [],
        video_url: draft.videoUrl ?? null,
        audience: draft.audience,
        circle_id: draft.circleId ?? null,
        creative_type: draft.creativeType ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapPost(data);
  },

  async listFeed(limit = 30) {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapPost);
  },

  async sendFriendRequest(userId: string) {
    const currentUserId = await getUserId();
    if (!currentUserId) throw new Error('Not signed in');

    const { data, error } = await supabase
      .from('friendships')
      .insert({
        requester_id: currentUserId,
        addressee_id: userId,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw error;
    return {
      id: data.id,
      requesterId: data.requester_id,
      addresseeId: data.addressee_id,
      status: data.status,
      isBestFriend: data.is_best_friend === true,
      createdAt: data.created_at,
    } as BackendFriendship;
  },

  async setStatus(statusText: string, statusEmoji = null) {
    const userId = await getUserId();
    if (!userId) throw new Error('Not signed in');

    const { error } = await supabase
      .from('profiles')
      .update({
        status_text: statusText.trim().slice(0, 80),
        status_emoji: statusEmoji,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
  },
};

