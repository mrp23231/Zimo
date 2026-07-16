import { SUPABASE_ENABLED } from '../supabase/client';
import { supabaseBackend } from './supabaseBackend';
import type { SocialBackend } from './types';

const firebasePlaceholderBackend: SocialBackend = {
  provider: 'firebase',
  async getCurrentProfile() {
    throw new Error('Firebase backend adapter is still wired directly in App.tsx');
  },
  async createPost() {
    throw new Error('Firebase backend adapter is still wired directly in App.tsx');
  },
  async listFeed() {
    throw new Error('Firebase backend adapter is still wired directly in App.tsx');
  },
  async sendFriendRequest() {
    throw new Error('Firebase backend adapter is still wired directly in App.tsx');
  },
  async setStatus() {
    throw new Error('Firebase backend adapter is still wired directly in App.tsx');
  },
};

export const socialBackend = SUPABASE_ENABLED ? supabaseBackend : firebasePlaceholderBackend;

export type {
  Audience,
  BackendFriendship,
  BackendPost,
  BackendPostDraft,
  BackendProfile,
  BackendProvider,
  CreativeWorkType,
  FriendRequestStatus,
  SocialBackend,
} from './types';

