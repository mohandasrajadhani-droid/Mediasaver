/**
 * Pure decision helpers used by the download manager. No native code here,
 * so every rule is covered by unit tests.
 */
import type { DownloadItem } from '../library/types';

/** Treat links that differ only by "#fragment" or trailing spaces as the same file. */
export function normalizeMediaUrl(url: string): string {
  return url.trim().replace(/#.*$/, '');
}

export type Duplicate = { kind: 'active' | 'completed'; item: DownloadItem } | null;

export function findDuplicate(items: DownloadItem[], mediaUrl: string): Duplicate {
  const key = normalizeMediaUrl(mediaUrl);
  const same = items.filter((i) => normalizeMediaUrl(i.mediaUrl) === key);
  const active = same.find((i) => i.status === 'downloading' || i.status === 'paused');
  if (active) return { kind: 'active', item: active };
  const done = same.find((i) => i.status === 'completed' && !i.missing);
  if (done) return { kind: 'completed', item: done };
  return null;
}

/** Keep a safety margin so the phone never fills up completely. */
export const STORAGE_SAFETY_BYTES = 200 * 1024 * 1024;

export function hasRoomFor(sizeBytes: number | undefined, freeBytes: number): boolean {
  if (!sizeBytes || sizeBytes <= 0) return freeBytes > STORAGE_SAFETY_BYTES; // unknown size: just require margin
  return freeBytes - sizeBytes >= STORAGE_SAFETY_BYTES;
}

export type ErrorKind = 'network' | 'storage' | 'cancelled' | 'http' | 'unknown';

/** Turn low-level errors into short messages a non-technical user understands. */
export function describeError(e: unknown): { kind: ErrorKind; message: string } {
  const raw = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? '');
  const text = raw.toLowerCase();
  if (/aborterror|cancel/.test(text)) return { kind: 'cancelled', message: 'Download cancelled.' };
  if (/enospc|no space|not enough space|disk full|storage/.test(text)) {
    return { kind: 'storage', message: 'Not enough storage space. Free up space on your phone and retry.' };
  }
  const http = /\b(?:status|code|http)\D{0,3}([45]\d\d)\b/.exec(text);
  if (http) return { kind: 'http', message: `The server refused the download (error ${http[1]}).` };
  if (/network|unable to resolve host|timeout|timed out|socket|connection|unreachable|offline|failed to connect/.test(text)) {
    return { kind: 'network', message: 'Network problem — the download stopped. Check your connection and tap Retry.' };
  }
  return { kind: 'unknown', message: 'The download failed. Tap Retry to try again.' };
}

/**
 * After the app restarts, in-flight downloads are gone (their native task died
 * with the app). Mark them as failed so the user can retry.
 */
export function reconcileAfterRestart(items: DownloadItem[]): DownloadItem[] {
  return items.map((i) =>
    i.status === 'downloading' || i.status === 'paused'
      ? { ...i, status: 'failed', error: 'Interrupted because the app was closed. Tap Retry.' }
      : i,
  );
}
