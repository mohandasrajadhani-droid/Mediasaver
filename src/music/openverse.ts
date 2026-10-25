/**
 * Royalty-free music search using Openverse (by WordPress.org) — a public
 * catalogue of openly licensed audio (Jamendo, Freesound, Wikimedia, …).
 *
 * We always ask for license_type=commercial, so every result may be used in
 * business reels. Some licences (CC BY) require crediting the artist; the app
 * keeps that credit text with the download so it can be copied into a caption.
 *
 * No API key is needed for normal use, so nothing secret ships in the app.
 */
import { MEDIA_EXTENSIONS, extensionFromPath } from '../sources/mediaTypes';
import type { MediaOption } from '../sources/types';
import { formatBytes, formatDuration, sanitizeFileName } from '../utils/format';

export const OPENVERSE_AUDIO_URL = 'https://api.openverse.org/v1/audio/';
export const PAGE_SIZE = 20;

export interface MusicTrack {
  id: string;
  title: string;
  creator: string;
  durationSec: number | null;
  fileUrl: string;
  format: 'mp3' | 'm4a' | 'ogg' | 'wav' | 'flac';
  mimeType: string;
  sizeBytes?: number;
  licenseLabel: string; // e.g. "CC BY 4.0", "CC0"
  licenseUrl?: string;
  needsCredit: boolean;
  attribution: string;
  landingUrl?: string;
  source?: string;
}

export interface MusicPage {
  tracks: MusicTrack[];
  page: number;
  pageCount: number;
  total: number;
}

const PLAYABLE = new Set(['mp3', 'm4a', 'ogg', 'wav', 'flac']);

export function buildSearchUrl(query: string, page = 1): string {
  const params = [
    ['q', query.trim()],
    ['license_type', 'commercial'],
    ['category', 'music'],
    ['mature', 'false'],
    ['page_size', String(PAGE_SIZE)],
    ['page', String(page)],
  ];
  return `${OPENVERSE_AUDIO_URL}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

function licenseLabel(license: string, version?: string): string {
  const l = license.toLowerCase();
  if (l === 'cc0') return 'CC0 (public domain)';
  if (l === 'pdm') return 'Public domain';
  return `CC ${l.toUpperCase()}${version ? ` ${version}` : ''}`;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Pure parser — tolerant of missing fields; drops anything we can't play or use. */
export function parseSearchResponse(json: unknown, page = 1): MusicPage {
  const data = (json ?? {}) as Record<string, unknown>;
  const results = Array.isArray(data.results) ? (data.results as Record<string, unknown>[]) : [];
  const tracks: MusicTrack[] = [];

  for (const r of results) {
    const id = str(r.id);
    const fileUrl = str(r.url);
    const license = str(r.license);
    if (!id || !fileUrl.startsWith('https://') || !license) continue;
    if (r.mature === true) continue;

    const ext = (str(r.filetype) || extensionFromPath(fileUrl) || '').toLowerCase();
    if (!PLAYABLE.has(ext)) continue;
    const info = MEDIA_EXTENSIONS[ext];
    if (!info || info.kind !== 'audio') continue;

    const title = str(r.title) || 'Untitled track';
    const creator = str(r.creator) || 'Unknown artist';
    const durationMs = num(r.duration);
    const label = licenseLabel(license, str(r.license_version) || undefined);
    const needsCredit = !['cc0', 'pdm'].includes(license.toLowerCase());
    const attribution =
      str(r.attribution) ||
      `"${title}" by ${creator}, licensed under ${label}${str(r.license_url) ? ` (${str(r.license_url)})` : ''}.`;

    tracks.push({
      id,
      title,
      creator,
      durationSec: durationMs != null ? Math.round(durationMs / 1000) : null,
      fileUrl,
      format: info.format as MusicTrack['format'],
      mimeType: info.mime,
      sizeBytes: num(r.filesize) ?? undefined,
      licenseLabel: label,
      licenseUrl: str(r.license_url) || undefined,
      needsCredit,
      attribution,
      landingUrl: str(r.foreign_landing_url) || undefined,
      source: str(r.source) || str(r.provider) || undefined,
    });
  }

  return {
    tracks,
    page,
    pageCount: num(data.page_count) ?? page,
    total: num(data.result_count) ?? tracks.length,
  };
}

export class MusicSearchError extends Error {}

export async function searchMusic(query: string, page = 1, fetchImpl: typeof fetch = fetch): Promise<MusicPage> {
  if (!query.trim()) return { tracks: [], page: 1, pageCount: 0, total: 0 };
  let res: Response;
  try {
    res = await fetchImpl(buildSearchUrl(query, page), { headers: { Accept: 'application/json' } });
  } catch {
    throw new MusicSearchError("Couldn't reach the music library. Check your internet connection.");
  }
  if (res.status === 429) throw new MusicSearchError('Too many searches in a short time. Wait a minute and try again.');
  if (!res.ok) throw new MusicSearchError(`The music library returned an error (${res.status}). Try again later.`);
  return parseSearchResponse(await res.json(), page);
}

/** Convert a track into the same option shape the download manager already uses. */
export function trackToOption(t: MusicTrack): MediaOption {
  const base = `${t.title} - ${t.creator}`;
  return {
    id: t.id,
    url: t.fileUrl,
    kind: 'audio',
    format: t.format,
    label: `${t.format.toUpperCase()}${t.durationSec ? ` · ${formatDuration(t.durationSec)}` : ''}${t.sizeBytes ? ` · ${formatBytes(t.sizeBytes)}` : ''}`,
    quality: 0,
    sizeBytes: t.sizeBytes,
    mimeType: t.mimeType,
    fileName: sanitizeFileName(base, t.format),
  };
}
