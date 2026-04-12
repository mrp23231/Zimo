// Firebase-compatible API using Supabase backend
// This provides the same interface as Firebase but uses Supabase as the database

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import supabaseConfig from '../../supabase-config.json';

// Create Supabase client
const supabase: SupabaseClient = createClient(
    supabaseConfig.url, 
    supabaseConfig.anonKey
);

// Log connection status
console.log('🎯 Supabase connected:', supabaseConfig.url);

// Generate local user ID (works without authentication)
const generateLocalUserId = () => {
    const stored = localStorage.getItem('zimo_local_user_id');
    if (stored) return stored;
    const newId = 'local_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('zimo_local_user_id', newId);
    return newId;
};

export const localUserId = generateLocalUserId();

// Re-export supabase for direct access if needed
export { supabase };

// Firebase-compatible document reference
export const doc = (db: any, coll: string, id?: string) => ({
    collName: coll,
    docId: id
});

export const collection = (db: any, coll: string) => ({
    collName: coll,
    docId: undefined
});

// Get a single document
export const getDoc = async (ref: any) => {
    try {
        const { data, error } = await supabase
            .from(ref.collName)
            .select('*')
            .eq('id', ref.docId)
            .single();
        
        if (error || !data) {
            return { exists: () => false, data: () => null, id: ref.docId };
        }
        return { exists: () => true, data: () => data, id: data.id };
    } catch {
        return { exists: () => false, data: () => null, id: ref.docId };
    }
};

// Set a document (create or overwrite)
export const setDoc = async (ref: any, data: any, opts?: any) => {
    const id = ref.docId || crypto.randomUUID();
    try {
        const { data: result, error } = await supabase
            .from(ref.collName)
            .upsert({ ...data, id }, { onConflict: 'id' })
            .select()
            .single();
        
        if (error) throw error;
        return { id: result?.id };
    } catch (e) {
        console.error('setDoc error:', e);
        throw e;
    }
};

// Update a document
export const updateDoc = async (ref: any, data: any) => {
    try {
        const { data: result, error } = await supabase
            .from(ref.collName)
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', ref.docId)
            .select()
            .single();
        
        if (error) throw error;
        return result;
    } catch (e) {
        console.error('updateDoc error:', e);
        throw e;
    }
};

// Delete a document
export const deleteDoc = async (ref: any) => {
    try {
        const { error } = await supabase
            .from(ref.collName)
            .delete()
            .eq('id', ref.docId);
        
        if (error) throw error;
    } catch (e) {
        console.error('deleteDoc error:', e);
        throw e;
    }
};

// Query documents
export const getDocs = async (ref: any, constraints?: any[]) => {
    try {
        let query = supabase.from(ref.collName).select('*');
        
        if (constraints) {
            for (const c of constraints) {
                if (c[0] === 'where') {
                    query = query.eq(c[1], c[2]);
                } else if (c[0] === 'orderBy') {
                    query = query.order(c[1], { ascending: c[2] !== 'desc' });
                } else if (c[0] === 'limit') {
                    query = query.limit(c[1]);
                }
            }
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('getDocs error:', e);
        return [];
    }
};

// Add document (with auto ID)
export const addDoc = async (ref: any, data: any) => {
    try {
        const id = crypto.randomUUID();
        const { data: result, error } = await supabase
            .from(ref.collName)
            .insert({ ...data, id })
            .select()
            .single();
        
        if (error) throw error;
        return { id: result?.id };
    } catch (e) {
        console.error('addDoc error:', e);
        throw e;
    }
};

// Real-time subscription
export const onSnapshot = (ref: any, callback: (docs: any[]) => void) => {
    const channel = supabase
        .channel(`${ref.collName}_changes`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: ref.collName },
            (payload: any) => {
                // For now, just re-fetch all
                supabase.from(ref.collName).select('*').then(({ data }) => {
                    callback(data || []);
                });
            }
        )
        .subscribe();
    
    // Initial fetch
    supabase.from(ref.collName).select('*').then(({ data }) => {
        callback(data || []);
    });
    
    // Return unsubscribe function
    return () => {
        supabase.removeChannel(channel);
    };
};

// Query constraint helpers
export const query = {
    where: (field: string, value: any) => ['where', field, value],
    orderBy: (field: string, direction: string) => ['orderBy', field, direction],
    limit: (count: number) => ['limit', count]
};

// Dummy firebase initialization (not actually used)
export const db = supabase;

export const auth = {
    currentUser: null,
    onAuthStateChanged: (callback: (user: any) => void) => {
        // Call with null initially
        callback(null);
        // Return unsubscribe function
        return () => {};
    }
};

// Auth helper functions
export const onAuthStateChanged = (authObj: any, callback: (user: any) => void) => callback(null);
export const GoogleAuthProvider = class { constructor() {} };
export const signInWithPopup = async (authObj: any, provider: any) => { throw new Error('Use Supabase auth instead'); };
export const signOut = async (authObj: any) => {};
export const createUserWithEmailAndPassword = async (authObj: any, email: string, pass: string) => ({ user: null });
export const signInWithEmailAndPassword = async (authObj: any, email: string, pass: string) => ({ user: null });
export const updateProfile = async (user: any, data: any) => {};

export const storage = null;
// Firebase-compatible query helpers
export const where = (field: string, op: string, value: any) => [field, op, value];
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc') => [field, direction];
export const limit = (count: number) => count;
export const serverTimestamp = () => new Date().toISOString();

// Timestamp can be used as both type and value
export const Timestamp = { now: () => new Date().toISOString() };
export type Timestamp = string;

export const getDocFromServer = getDoc;
export const arrayUnion = (...items: any[]) => items;
export const arrayRemove = (...items: any[]) => items;

// Query helper (compatible with Firebase)
export function fbQuery(ref: any, ...constraints: any[]) {
    return { ref, constraints };
}
