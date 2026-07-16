/** Firebase Storage is opt-in (paid on most projects). Default: inline media in Firestore. */
export const STORAGE_ENABLED = import.meta.env.VITE_STORAGE_ENABLED === 'true';

/** ~1 MiB Firestore doc limit; base64 adds overhead. */
export const MAX_INLINE_DATAURL_CHARS = 900 * 1024;

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
