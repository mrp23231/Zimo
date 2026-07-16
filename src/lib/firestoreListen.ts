import { onSnapshot } from './firebase';
import type { DocumentReference, Query, Unsubscribe } from 'firebase/firestore';

type FirestoreListenTarget = DocumentReference<any> | Query<any>;

/** Stop listening after index/permission errors to avoid Firestore SDK assertion crashes. */
export const shouldStopFirestoreListen = (err: unknown) => {
  const code = String((err as { code?: string })?.code || '');
  return code === 'failed-precondition' || code === 'permission-denied';
};

export const safeOnSnapshot = <T,>(
  refOrQuery: FirestoreListenTarget,
  onNext: (snapshot: T) => void,
  label: string
) => {
  let unsub: Unsubscribe = () => {};
  unsub = (onSnapshot as any)(
    refOrQuery,
    onNext,
    (err) => {
      console.warn(label, err);
      if (shouldStopFirestoreListen(err)) {
        try {
          unsub();
        } catch {
          /* ignore */
        }
      }
    }
  );
  return unsub;
};
