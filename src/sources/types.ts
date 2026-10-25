/**
 * Shared types for "sources" — the places a media link can come from.
 * A source checker turns a pasted URL into a SourceCheck result that the
 * Home screen can show: blocked, unsupported, or ready with options.
 */

export type MediaKind = 'video' | 'audio';

export type MediaFormat =
  | 'mp4'
  | 'm4v'
  | 'mov'
  | 'webm'
  | 'mkv'
  | 'mp3'
  | 'm4a'
  | 'aac'
  | 'ogg'
  | 'opus'
  | 'wav'
  | 'flac';

/** One downloadable file the source actually offers (we never convert formats). */
export interface MediaOption {
  id: string;
  url: string;
  kind: MediaKind;
  format: MediaFormat;
  /** Human label, e.g. "720p · 84 MB" or "VBR MP3 · 6.1 MB". */
  label: string;
  /** Sort key: higher = better quality (pixel height for video, kbps for audio). */
  quality: number;
  sizeBytes?: number;
  mimeType: string;
  fileName: string;
}

export type SourceCheck =
  | { status: 'invalid'; message: string }
  | {
      status: 'blocked';
      platform: string;
      message: string;
      officialAction?: { label: string; url: string };
    }
  | { status: 'unsupported'; message: string }
  | {
      status: 'ready';
      sourceName: string;
      title: string;
      pageUrl: string;
      options: MediaOption[];
      /** Direct links need the user to confirm they have the right to download. */
      requiresPermissionConfirm: boolean;
      licenseNote?: string;
    };
