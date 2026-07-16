import { createClient } from '@supabase/supabase-js';
import fallbackConfig from '../../../supabase-config.json';

const env = import.meta.env as Record<string, string | undefined>;

const supabaseUrl = env.VITE_SUPABASE_URL || fallbackConfig.url;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || fallbackConfig.anonKey;

export const SUPABASE_ENABLED =
  env.VITE_BACKEND_PROVIDER === 'supabase' &&
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

