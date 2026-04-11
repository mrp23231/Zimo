import { createClient, SupabaseClient } from '@supabase/supabase-js';
import supabaseConfig from '../../supabase-config.json';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (!supabase) {
        supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    }
    return supabase;
}

// Test connection
getSupabase()
    .from('_placeholder')
    .select('*')
    .then(() => {
        console.log('Supabase connected!');
    })
    .catch(() => {
        console.error('Supabase connection error - may need tables');
    });

export const db = {
    // Table names
    users: 'users',
    posts: 'posts',
    messages: 'messages',
    notifications: 'notifications',
    follows: 'follows',
    
    // Generic helpers
    async get(table: string, query?: any) {
        let q = getSupabase().from(table).select('*');
        if (query?.eq) q = q.eq(query.eq.field, query.eq.value);
        if (query?.order) q = q.order(query.order.field, { ascending: query.order.dir === 'asc' });
        if (query?.limit) q = q.limit(query.limit);
        return q;
    },
    
    async getOne(table: string, id: string) {
        return getSupabase().from(table).select('*').eq('id', id).single();
    },
    
    async create(table: string, data: any) {
        return getSupabase().from(table).insert(data).select();
    },
    
    async update(table: string, id: string, data: any) {
        return getSupabase().from(table).update(data).eq('id', id).select();
    },
    
    async delete(table: string, id: string) {
        return getSupabase().from(table).delete().eq('id', id);
    }
};

// Auth helpers (placeholder - need to configure OAuth in Supabase)
export const auth = {
    async signInWithGoogle() {
        // Would need OAuth configured in Supabase
        console.log('Supabase OAuth not configured yet');
    },
    
    async getUser() {
        const { data: { user } } = await getSupabase().auth.getUser();
        return user;
    },
    
    async signOut() {
        await getSupabase().auth.signOut();
    }
};

export default getSupabase();