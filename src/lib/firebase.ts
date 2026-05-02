import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, type User } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, addDoc, query, where, orderBy, limit, getDocs, getDocFromServer, onSnapshot, serverTimestamp, Timestamp, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { getStorage, uploadBytesResumable } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const normalizeStorageBucket = (config: any) => {
  const envBucket = (import.meta as any)?.env?.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;
  if (envBucket && envBucket.trim()) return envBucket.trim();
  const bucket = String(config?.storageBucket || '').trim();
  const projectId = String(config?.projectId || '').trim();
  if (!bucket) return bucket;
  // Some configs end up with `*.firebasestorage.app` which is a host, not the bucket id used by SDK.
  // Firebase Storage bucket id is typically `PROJECT_ID.appspot.com`.
  if (bucket.endsWith('.firebasestorage.app') && projectId) return `${projectId}.appspot.com`;
  return bucket;
};

// Initialize Firebase
const resolvedConfig = {
  ...firebaseConfig,
  storageBucket: normalizeStorageBucket(firebaseConfig),
};

export const app = initializeApp(resolvedConfig);
const dbId = firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId;
// Some networks/proxies break Firestore's streaming transport (WebChannel), causing 400/404 spam.
// Auto-detect long polling and disable fetch streams as a compatibility fallback.
export const db = initializeFirestore(
  app,
  { experimentalAutoDetectLongPolling: true, useFetchStreams: false } as any,
  dbId
);
export const auth = getAuth(app);
export const storage = resolvedConfig.storageBucket
  ? getStorage(app, `gs://${resolvedConfig.storageBucket}`)
  : getStorage(app);

// Re-export everything from Firebase
export { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile };
export type { User };
export { uploadBytesResumable, serverTimestamp, Timestamp, arrayUnion, arrayRemove };
export { increment };

// Re-export Firestore functions
export { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, addDoc, query, where, orderBy, limit, getDocs, getDocFromServer, onSnapshot };
