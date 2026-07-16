export type BackendProvider = 'firebase' | 'supabase';

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type Audience = 'public' | 'friends' | 'close_friends' | 'circle' | 'private';
export type CreativeWorkType = 'post' | 'album' | 'challenge' | 'space' | 'collab';

export interface BackendProfile {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  statusText: string | null;
  statusEmoji: string | null;
  creativeMode: boolean;
  createdAt: string;
}

export interface BackendPostDraft {
  content: string;
  imageUrls?: string[];
  videoUrl?: string | null;
  audience: Audience;
  circleId?: string | null;
  creativeType?: CreativeWorkType | null;
}

export interface BackendPost extends BackendPostDraft {
  id: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendFriendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendRequestStatus;
  isBestFriend: boolean;
  createdAt: string;
}

export interface SocialBackend {
  provider: BackendProvider;
  getCurrentProfile(): Promise<BackendProfile | null>;
  createPost(draft: BackendPostDraft): Promise<BackendPost>;
  listFeed(limit?: number): Promise<BackendPost[]>;
  sendFriendRequest(userId: string): Promise<BackendFriendship>;
  setStatus(statusText: string, statusEmoji?: string | null): Promise<void>;
}

