import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { doc, updateDoc } from './firebase';
import type { Firestore } from 'firebase/firestore';

let messagingSingleton: Messaging | null = null;

async function getMessagingIfSupported(app: any): Promise<Messaging | null> {
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  if (!messagingSingleton) messagingSingleton = getMessaging(app);
  return messagingSingleton;
}

export async function registerMessagingSW() {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch {
    return null;
  }
}

export async function enableWebPush(opts: {
  app: any;
  db: Firestore;
  userUid: string;
  vapidKey: string;
}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return { ok: false as const, reason: 'unsupported' as const };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false as const, reason: 'denied' as const };

  const messaging = await getMessagingIfSupported(opts.app);
  if (!messaging) return { ok: false as const, reason: 'unsupported' as const };

  const registration = await registerMessagingSW();
  const token = await getToken(messaging, {
    vapidKey: opts.vapidKey,
    serviceWorkerRegistration: registration ?? undefined,
  }).catch(() => null);

  if (!token) return { ok: false as const, reason: 'token_failed' as const };

  // Store token in user profile for server-side sending later.
  await updateDoc(doc(opts.db as any, 'users', opts.userUid), {
    pushToken: token,
    pushEnabled: true,
    pushUpdatedAt: new Date(),
  }).catch(() => {});

  return { ok: true as const, token };
}

export async function disableWebPush(opts: { db: Firestore; userUid: string }) {
  await updateDoc(doc(opts.db as any, 'users', opts.userUid), {
    pushEnabled: false,
    pushToken: '',
    pushUpdatedAt: new Date(),
  }).catch(() => {});
}

export async function attachForegroundPushListener(opts: {
  app: any;
  onPayload: (payload: any) => void;
}) {
  const messaging = await getMessagingIfSupported(opts.app);
  if (!messaging) return () => {};
  const unsub = onMessage(messaging, (payload) => opts.onPayload(payload));
  return unsub;
}

