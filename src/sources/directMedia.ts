/**
 * Direct media links (e.g. https://example.com/files/talk.mp4).
 * We ask the server about the file first (a HEAD request) so we can show the
 * size and type, and refuse things that aren't media or need a login.
 */
import { formatBytes, sanitizeFileName } from '../utils/format';
import { MEDIA_EXTENSIONS, decodeSafe, extensionFromMime, extensionFromPath } from './mediaTypes';
import type { ParsedUrl } from './urlRules';
import type { SourceCheck } from './types';

export interface ProbeResponse {
  ok: boolean;
  status: number;
  finalUrl: string;
  header: (name: string) => string | null;
}

export function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)?'[^']*'([^;]+)/.exec(value);
  if (star) return decodeSafe(star[1].trim().replace(/^"|"$/g, ''));
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(value);
  return plain ? plain[1].trim() : null;
}

export function sizeFromHeaders(header: ProbeResponse['header']): number | undefined {
  const range = header('content-range'); // "bytes 0-0/123456"
  const total = range ? /\/(\d+)\s*$/.exec(range) : null;
  if (total) return Number(total[1]);
  const len = header('content-length');
  const n = len ? Number(len) : NaN;
  return Number.isFinite(n) && n > 1 ? n : undefined;
}

/** Turn the server's answer into something the UI can show. Pure → unit-tested. */
export function interpretProbe(url: ParsedUrl, res: ProbeResponse): SourceCheck {
  if (res.status === 401 || res.status === 403) {
    return {
      status: 'unsupported',
      message:
        "This file needs a login or isn't public. MediaSaver doesn't bypass sign-ins or access restrictions — download it from the site while signed in instead.",
    };
  }
  if (res.status === 404 || res.status === 410) {
    return { status: 'unsupported', message: 'The file was not found at this link (error ' + res.status + ').' };
  }
  if (!res.ok) {
    return { status: 'unsupported', message: `The server refused the request (error ${res.status}). Try again later.` };
  }

  const contentType = (res.header('content-type') || '').toLowerCase();
  const dispositionName = filenameFromContentDisposition(res.header('content-disposition'));
  const ext =
    (dispositionName && extensionFromPath(dispositionName)) ||
    extensionFromMime(contentType) ||
    extensionFromPath(url.pathname);
  const info = ext ? MEDIA_EXTENSIONS[ext] : undefined;

  if (contentType.startsWith('text/html')) {
    return {
      status: 'unsupported',
      message:
        'This link opens a web page, not a media file. Paste a direct link to the file itself (it usually ends in .mp4 or .mp3), or use the site\'s own Download button.',
    };
  }
  if (!info) {
    return {
      status: 'unsupported',
      message: `This isn't a supported audio or video file${contentType ? ` (type: ${contentType.split(';')[0]})` : ''}.`,
    };
  }

  const size = sizeFromHeaders(res.header);
  const rawName =
    dispositionName || decodeSafe(url.pathname.split('/').pop() || '') || `download.${info.format}`;
  const fileName = sanitizeFileName(rawName, ext!);
  const title = fileName.replace(/\.[^.]+$/, '');

  return {
    status: 'ready',
    sourceName: url.host,
    title,
    pageUrl: url.href,
    requiresPermissionConfirm: true,
    options: [
      {
        id: 'direct',
        url: res.finalUrl || url.href,
        kind: info.kind,
        format: info.format,
        label: `${info.format.toUpperCase()} · original file${size ? ` · ${formatBytes(size)}` : ''}`,
        quality: 0,
        sizeBytes: size,
        mimeType: info.mime,
        fileName,
      },
    ],
  };
}

function toProbe(res: Response): ProbeResponse {
  return {
    ok: res.ok,
    status: res.status,
    finalUrl: res.url,
    header: (n) => res.headers.get(n),
  };
}

/** Network part: HEAD first; some servers reject HEAD, so fall back to a 1-byte GET. */
export async function checkDirectUrl(
  url: ParsedUrl,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<SourceCheck> {
  const attempt = async (init: RequestInit) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetchImpl(url.href, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let res = await attempt({ method: 'HEAD' });
    if (res.status === 405 || res.status === 501 || (res.ok && !res.headers.get('content-type'))) {
      res = await attempt({ method: 'GET', headers: { Range: 'bytes=0-0' } });
    }
    return interpretProbe(url, toProbe(res));
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return {
      status: 'unsupported',
      message: aborted
        ? 'The server took too long to respond. Check your connection and try again.'
        : "Couldn't reach this link. Check your internet connection and the address.",
    };
  }
}
