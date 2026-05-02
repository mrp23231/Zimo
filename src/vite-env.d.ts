/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE_ENABLED?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FCM_VAPID_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

