/** Small, pure helpers for display text and file names. Fully unit-tested. */

export function formatBytes(bytes: number | undefined | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 0..1, or null when the total size is unknown. */
export function progressRatio(written: number, total: number): number | null {
  if (!total || total <= 0) return null;
  return Math.min(1, Math.max(0, written / total));
}

const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;

/** Make a string safe to use as an Android file name and keep the extension. */
export function sanitizeFileName(raw: string, extension: string): string {
  const ext = extension.replace(/^\./, '').toLowerCase();
  let base = (raw || '')
    .replace(ILLEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Drop an existing extension if it matches, so we don't get "song.mp3.mp3".
  if (base.toLowerCase().endsWith(`.${ext}`)) base = base.slice(0, -(ext.length + 1));
  base = base.replace(/^\.+/, '').replace(/[. ]+$/, '');
  if (!base) base = 'download';
  if (base.length > 80) base = base.slice(0, 80).trim();
  return `${base}.${ext}`;
}

/** "song.mp3" → "song (1).mp3" when the name is already taken. */
export function uniqueFileName(name: string, taken: Iterable<string>): string {
  const used = new Set(Array.from(taken, (n) => n.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 1; i < 10000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
