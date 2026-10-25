/**
 * Internet Archive (archive.org) — a source that openly offers downloads,
 * often in several formats and qualities (e.g. h.264 MP4 and VBR MP3).
 * We read its public metadata API and list only files it already provides.
 */
import { formatBytes, sanitizeFileName } from '../utils/format';
import { MEDIA_EXTENSIONS, extensionFromPath } from './mediaTypes';
import type { MediaOption, SourceCheck } from './types';

interface ArchiveFile {
  name?: string;
  format?: string;
  size?: string | number;
  height?: string | number;
  private?: string | boolean;
  source?: string;
}

interface ArchiveMetadata {
  error?: string;
  is_dark?: boolean;
  nodownload?: boolean;
  files?: ArchiveFile[];
  metadata?: {
    title?: string | string[];
    licenseurl?: string;
    rights?: string | string[];
    'access-restricted-item'?: string | boolean;
  };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const truthy = (v: unknown) => v === true || v === 'true';

function audioKbps(format: string): number {
  const m = /(\d+)\s*kbps/i.exec(format);
  if (m) return Number(m[1]);
  if (/vbr/i.test(format)) return 192; // VBR MP3 is typically the best MP3 on IA
  return 96;
}

/** Pure parser — unit-tested with sample metadata. */
export function parseArchiveMetadata(identifier: string, json: unknown): SourceCheck {
  const data = (json ?? {}) as ArchiveMetadata;
  if (!data || typeof data !== 'object' || Array.isArray(json) || !data.files) {
    return { status: 'unsupported', message: 'This Internet Archive item was not found.' };
  }
  if (data.error) return { status: 'unsupported', message: `Internet Archive: ${data.error}` };
  if (data.is_dark || data.nodownload || truthy(data.metadata?.['access-restricted-item'])) {
    return {
      status: 'blocked',
      platform: 'Internet Archive (restricted item)',
      message:
        'This item is restricted (for example, a lending-library item). The Internet Archive does not permit downloading it.',
      officialAction: { label: 'Open on archive.org', url: `https://archive.org/details/${identifier}` },
    };
  }

  const options: MediaOption[] = [];
  for (const f of data.files) {
    if (!f.name || truthy(f.private)) continue;
    const ext = extensionFromPath(f.name);
    const info = ext ? MEDIA_EXTENSIONS[ext] : undefined;
    if (!info) continue;
    if (info.format !== 'mp4' && info.format !== 'mp3') continue; // the formats this app offers
    const size = f.size != null ? Number(f.size) : undefined;
    const height = f.height != null ? Number(f.height) : 0;
    const fmt = f.format || info.format.toUpperCase();
    const quality = info.kind === 'video' ? height || (/512kb/i.test(fmt) ? 360 : 480) : audioKbps(fmt);
    const qualityText = info.kind === 'video' ? (height ? `${height}p` : fmt) : fmt;
    options.push({
      id: f.name,
      url: `https://archive.org/download/${encodeURIComponent(identifier)}/${f.name
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      kind: info.kind,
      format: info.format,
      label: `${qualityText}${size ? ` · ${formatBytes(size)}` : ''}`,
      quality,
      sizeBytes: Number.isFinite(size) ? size : undefined,
      mimeType: info.mime,
      fileName: sanitizeFileName(f.name.split('/').pop() || identifier, info.format),
    });
  }

  if (options.length === 0) {
    return {
      status: 'unsupported',
      message: 'This item has no MP4 video or MP3 audio files to download.',
    };
  }

  options.sort((a, b) => (a.kind === b.kind ? b.quality - a.quality : a.kind === 'video' ? -1 : 1));
  const license = data.metadata?.licenseurl || first(data.metadata?.rights);
  return {
    status: 'ready',
    sourceName: 'Internet Archive',
    title: first(data.metadata?.title) || identifier,
    pageUrl: `https://archive.org/details/${identifier}`,
    requiresPermissionConfirm: false,
    licenseNote: license
      ? `License / rights: ${license}`
      : 'Check the item page for its license before reusing or sharing it.',
    options,
  };
}

export async function checkArchiveItem(
  identifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SourceCheck> {
  try {
    const res = await fetchImpl(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
    if (!res.ok) {
      return { status: 'unsupported', message: `Internet Archive returned error ${res.status}. Try again later.` };
    }
    return parseArchiveMetadata(identifier, await res.json());
  } catch {
    return { status: 'unsupported', message: "Couldn't reach the Internet Archive. Check your connection." };
  }
}
