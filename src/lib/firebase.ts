import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, type User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, where, orderBy, limit, getDocs, getDocFromServer, onSnapshot, serverTimestamp, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getStorage, uploadBytesResumable } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Re-export everything from Firebase
export { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile };
export type { User };
export { uploadBytesResumable, serverTimestamp, Timestamp, arrayUnion, arrayRemove };

// Re-export Firestore functions
export { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, where, orderBy, limit, getDocs, getDocFromServer, onSnapshot };
