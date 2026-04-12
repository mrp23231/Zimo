// Firebase SDK loaded but we use localStorage mode only (Firebase quota exceeded)
// This file provides Firebase-compatible API using localStorage
import { initializeApp } from 'firebase/app';
import { getAuth, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, uploadBytesResumable } from 'firebase/storage';
// Dummy config - we won't actually connect to Firebase
const firebaseConfig = {
  apiKey: 'dummy',
  authDomain: 'local',
  projectId: 'local',
  storageBucket: 'local',
  messagingSenderId: '000000000000',
  appId: 'local:000000000000',
  firestoreDatabaseId: '(default)'
};

// Generate local user ID without Firebase auth (works from any IP)
const generateLocalUserId = () => {
  const stored = localStorage.getItem('zimo_local_user_id');
  if (stored) return stored;
  const newId = 'local_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('zimo_local_user_id', newId);
  return newId;
};

export const localUserId = generateLocalUserId();

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Re-export for compatibility
export type { User };
export { uploadBytesResumable };

// localStorage-based database (works when Firebase quota exceeded and Appwrite has issues)
const LS_KEY = 'zimo_local_data';

// Simple in-memory store for fast access
const memStore: Record<string, any> = {};

// Helper to get/set data
const getData = <T>(key: string): T | null => {
  // Try memory first
  if (memStore[key]) return memStore[key];
  // Fallback to localStorage
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

const setData = <T>(key: string, data: T) => {
  memStore[key] = data;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.warn('localStorage quota exceeded');
  }
};

// Firebase-compatible API using localStorage
export const doc = (db: any, coll: string, id?: string) => ({
  collName: coll,
  docId: id
});

export const collection = (db: any, coll: string) => ({
  collName: coll,
  docId: undefined
});

export const getDoc = async (ref: any) => {
  const key = `${LS_KEY}_${ref.collName}_${ref.docId}`;
  const data = getData(key);
  const result = data 
    ? { exists: () => true, data: () => data, id: ref.docId }
    : { exists: () => false, data: () => null, id: ref.docId };
  return result;
};

export const setDoc = async (ref: any, data: any, opts?: any) => {
  const key = `${LS_KEY}_${ref.collName}_${ref.docId || ref.collName + '_' + Date.now()}`;
  const id = ref.docId || key.split('_').pop();
  
  if (opts?.merge) {
    const existing = getData(key) || {};
    setData(key, { ...(existing as object), ...(data as object), id });
  } else {
    setData(key, { ...data, id, createdAt: new Date().toISOString() });
  }
  return { id };
};

export const updateDoc = async (ref: any, data: any) => {
  const key = `${LS_KEY}_${ref.collName}_${ref.docId}`;
  const existing = getData(key) || {};
  setData(key, { ...(existing as object), ...(data as object) });
};

export const deleteDoc = async (ref: any) => {
  const key = `${LS_KEY}_${ref.collName}_${ref.docId}`;
  delete memStore[key];
  localStorage.removeItem(key);
};

export const addDoc = async (ref: any, data: any) => {
  const id = ref.collName + '_' + Date.now();
  const key = `${LS_KEY}_${ref.collName}_${id}`;
  setData(key, { ...data, id, createdAt: new Date().toISOString() });
  return { id };
};

export const getDocFromServer = async (ref: any) => getDoc(ref);

export const onSnapshot = (ref: any, callback: (docSnap: any) => void) => {
  // Poll for changes
  const interval = setInterval(async () => {
    const docSnap = await getDoc(ref);
    // Pass callback-compatible object with exists() method
    if (docSnap.exists()) callback(docSnap);
  }, 2000);
  return () => clearInterval(interval);
};

export const query = (ref: any, ...args: any[]) => ref;

export const where = (field: string, op: string, value: any) => ({ field, op, value });

export const orderBy = (field: string, dir: string = 'asc') => ({ field, dir });

export const limit = (n: number) => ({ limit: n });

export const serverTimestamp = () => new Date().toISOString();

export const arrayRemove = (...args: any[]) => args;

export const arrayUnion = (...args: any[]) => args;

export const Timestamp = { 
  now: () => new Date(),
  toDate: (d?: any) => d instanceof Date ? d : new Date(d?.seconds * 1000 || Date.now())
};

export type Timestamp = Date & { toDate(): Date };

export const getDocs = async (ref: any) => ({
  docs: [],
  empty: true
});
