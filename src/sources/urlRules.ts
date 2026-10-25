/**
 * Step 1 of every check: look at the pasted text WITHOUT touching the network
 * and decide which route it takes. Pure functions → easy to unit-test.
 *
 * We parse URLs ourselves because React Native's built-in URL class does not
 * reliably implement properties like `hostname` on every version.
 */
import { MEDIA_EXTENSIONS, STREAM_MANIFEST_EXT, extensionFromPath } from './mediaTypes';
import type { SourceCheck } from './types';

export interface ParsedUrl {
  href: string;
  protocol: 'http' | 'https';
  host: string; // lower-case, no port, no "www."
  pathname: string;
  search: string;
}

const URL_RE = /^(https?):\/\/([^/?#\s]+)([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i;
const HOST_RE = /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

export function parseUrl(input: string): ParsedUrl | null {
  const text = (input || '').trim();
  const m = URL_RE.exec(text);
  if (!m) return null;
  const authority = m[2].split('@').pop() ?? '';
  let host = authority.replace(/:\d+$/, '').toLowerCase();
  if (!HOST_RE.test(host)) return null;
  if (host.startsWith('www.')) host = host.slice(4);
  return {
    href: text,
    protocol: m[1].toLowerCase() as 'http' | 'https',
    host,
    pathname: m[3] || '/',
    search: m[4] || '',
  };
}

export function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

interface BlockedPlatform {
  name: string;
  domains: string[];
  message: string;
  action?: string; // label for "open in official app"
}

const STREAMING_MSG =
  "This platform's terms don't allow third-party apps to download its media. Use the platform's own app — many offer an official offline or download option.";

export const BLOCKED_PLATFORMS: BlockedPlatform[] = [
  {
    name: 'YouTube',
    domains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
    message:
      "YouTube's Terms of Service don't allow downloading videos or audio with third-party apps. To watch offline, use the Download button inside the YouTube app (YouTube Premium). If it's your own video, you can download it from YouTube Studio.",
    action: 'Open in YouTube',
  },
  { name: 'Instagram', domains: ['instagram.com'], message: STREAMING_MSG, action: 'Open in Instagram' },
  { name: 'Facebook', domains: ['facebook.com', 'fb.watch', 'fb.com'], message: STREAMING_MSG, action: 'Open in Facebook' },
  { name: 'TikTok', domains: ['tiktok.com'], message: STREAMING_MSG, action: 'Open in TikTok' },
  { name: 'X (Twitter)', domains: ['twitter.com', 'x.com'], message: STREAMING_MSG },
  { name: 'Netflix', domains: ['netflix.com'], message: STREAMING_MSG },
  { name: 'Prime Video', domains: ['primevideo.com'], message: STREAMING_MSG },
  { name: 'JioHotstar', domains: ['hotstar.com', 'jiohotstar.com'], message: STREAMING_MSG },
  { name: 'Disney+', domains: ['disneyplus.com'], message: STREAMING_MSG },
  { name: 'ZEE5', domains: ['zee5.com'], message: STREAMING_MSG },
  { name: 'SonyLIV', domains: ['sonyliv.com'], message: STREAMING_MSG },
  { name: 'Spotify', domains: ['spotify.com'], message: STREAMING_MSG },
  { name: 'JioSaavn', domains: ['jiosaavn.com', 'saavn.com'], message: STREAMING_MSG },
  { name: 'Gaana', domains: ['gaana.com'], message: STREAMING_MSG },
  { name: 'Apple Music', domains: ['music.apple.com'], message: STREAMING_MSG },
  {
    name: 'SoundCloud',
    domains: ['soundcloud.com'],
    message:
      'SoundCloud only allows downloads when the artist turns on the download button on the track page. Use that button on soundcloud.com — it gives you a direct file link you can paste here.',
  },
  {
    name: 'Vimeo',
    domains: ['vimeo.com'],
    message:
      "Vimeo only allows downloads when the video owner enables them. Use the Download button on the Vimeo page if it's shown — it gives a direct file link you can paste here.",
  },
];

export type Route =
  | { type: 'final'; result: SourceCheck }
  | { type: 'archive'; identifier: string; pageUrl: string }
  | { type: 'direct'; url: ParsedUrl; extension: string | null };

const ARCHIVE_ID_RE = /^\/(?:details|download)\/([A-Za-z0-9._-]+)/;

export function routeUrl(input: string): Route {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { type: 'final', result: { status: 'invalid', message: 'Paste a link first.' } };
  }
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = parseUrl(withScheme);
  if (!url) {
    return {
      type: 'final',
      result: { status: 'invalid', message: "That doesn't look like a valid web link. Check it and try again." },
    };
  }

  const blocked = BLOCKED_PLATFORMS.find((p) => p.domains.some((d) => hostMatches(url.host, d)));
  if (blocked) {
    return {
      type: 'final',
      result: {
        status: 'blocked',
        platform: blocked.name,
        message: blocked.message,
        officialAction: blocked.action ? { label: blocked.action, url: url.href } : undefined,
      },
    };
  }

  if (url.protocol !== 'https') {
    return {
      type: 'final',
      result: {
        status: 'unsupported',
        message: 'Only secure (https://) links are supported. Android blocks insecure downloads by default.',
      },
    };
  }

  if (hostMatches(url.host, 'archive.org')) {
    const m = ARCHIVE_ID_RE.exec(url.pathname);
    if (m) {
      return { type: 'archive', identifier: m[1], pageUrl: `https://archive.org/details/${m[1]}` };
    }
  }

  const ext = extensionFromPath(url.pathname);
  if (ext && STREAM_MANIFEST_EXT.includes(ext)) {
    return {
      type: 'final',
      result: {
        status: 'unsupported',
        message:
          'This is a streaming playlist (HLS/DASH), not a single file. These streams are often DRM-protected, so they are not supported.',
      },
    };
  }

  return { type: 'direct', url, extension: ext && MEDIA_EXTENSIONS[ext] ? ext : null };
}
