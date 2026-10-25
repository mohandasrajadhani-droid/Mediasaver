import type { MediaFormat, MediaKind } from './types';

/** Known file extensions → kind, format and MIME type. */
export const MEDIA_EXTENSIONS: Record<string, { kind: MediaKind; format: MediaFormat; mime: string }> = {
  mp4: { kind: 'video', format: 'mp4', mime: 'video/mp4' },
  m4v: { kind: 'video', format: 'm4v', mime: 'video/x-m4v' },
  mov: { kind: 'video', format: 'mov', mime: 'video/quicktime' },
  webm: { kind: 'video', format: 'webm', mime: 'video/webm' },
  mkv: { kind: 'video', format: 'mkv', mime: 'video/x-matroska' },
  mp3: { kind: 'audio', format: 'mp3', mime: 'audio/mpeg' },
  m4a: { kind: 'audio', format: 'm4a', mime: 'audio/mp4' },
  aac: { kind: 'audio', format: 'aac', mime: 'audio/aac' },
  ogg: { kind: 'audio', format: 'ogg', mime: 'audio/ogg' },
  oga: { kind: 'audio', format: 'ogg', mime: 'audio/ogg' },
  opus: { kind: 'audio', format: 'opus', mime: 'audio/opus' },
  wav: { kind: 'audio', format: 'wav', mime: 'audio/wav' },
  flac: { kind: 'audio', format: 'flac', mime: 'audio/flac' },
};

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/x-m4v': 'm4v',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

/** Streaming playlists: often DRM-protected and not single files. */
export const STREAM_MANIFEST_EXT = ['m3u8', 'mpd', 'ism', 'f4m'];

export function extensionFromPath(pathname: string): string | null {
  const last = decodeSafe(pathname).split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  if (dot <= 0 || dot === last.length - 1) return null;
  return last.slice(dot + 1).toLowerCase();
}

export function extensionFromMime(mime: string | null | undefined): string | null {
  if (!mime) return null;
  const clean = mime.split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT[clean] ?? null;
}

export function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
