import { checkSource } from '../src/sources/checkSource';
import { filenameFromContentDisposition, interpretProbe } from '../src/sources/directMedia';
import { parseArchiveMetadata } from '../src/sources/internetArchive';
import { parseUrl, routeUrl } from '../src/sources/urlRules';

describe('parseUrl', () => {
  it('parses host, path and strips www/port/userinfo', () => {
    const u = parseUrl('https://user@www.Example.com:8443/a/b.mp4?x=1#t');
    expect(u).toMatchObject({ protocol: 'https', host: 'example.com', pathname: '/a/b.mp4', search: '?x=1' });
  });
  it.each(['', 'hello', 'ftp://x.com/a', 'https://', 'https://nodot/a', 'https://exa mple.com'])(
    'rejects %p',
    (s) => expect(parseUrl(s)).toBeNull(),
  );
});

describe('routeUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=abc',
    'https://youtu.be/abc',
    'https://m.youtube.com/watch?v=abc',
    'https://music.youtube.com/watch?v=abc',
    'youtube.com/shorts/abc',
  ])('blocks YouTube link %p with an official action', (s) => {
    const r = routeUrl(s);
    expect(r.type).toBe('final');
    if (r.type === 'final' && r.result.status === 'blocked') {
      expect(r.result.platform).toBe('YouTube');
      expect(r.result.officialAction?.label).toBe('Open in YouTube');
    } else throw new Error('expected blocked');
  });

  it('blocks other streaming platforms', () => {
    for (const s of ['https://www.instagram.com/reel/x', 'https://open.spotify.com/track/x', 'https://www.netflix.com/title/1']) {
      const r = routeUrl(s);
      expect(r.type === 'final' && r.result.status).toBe('blocked');
    }
  });

  it('does not confuse look-alike domains with YouTube', () => {
    const r = routeUrl('https://notyoutube.com/video.mp4');
    expect(r.type).toBe('direct');
  });

  it('rejects empty input and plain text', () => {
    expect(routeUrl('').type === 'final' && (routeUrl('') as any).result.status).toBe('invalid');
    expect((routeUrl('not a link') as any).result.status).toBe('invalid');
  });

  it('rejects http:// and streaming manifests', () => {
    expect((routeUrl('http://example.com/a.mp4') as any).result.status).toBe('unsupported');
    expect((routeUrl('https://cdn.example.com/live/master.m3u8') as any).result.status).toBe('unsupported');
  });

  it('routes Internet Archive items', () => {
    expect(routeUrl('https://archive.org/details/Popeye_forPresident')).toEqual({
      type: 'archive',
      identifier: 'Popeye_forPresident',
      pageUrl: 'https://archive.org/details/Popeye_forPresident',
    });
  });

  it('routes direct media links and adds https:// when missing', () => {
    const r = routeUrl('example.com/media/Talk%20One.mp3');
    expect(r.type).toBe('direct');
    if (r.type === 'direct') expect(r.extension).toBe('mp3');
  });
});

const headers = (h: Record<string, string>) => (n: string) => h[n.toLowerCase()] ?? null;
const url = parseUrl('https://files.example.com/v/My%20Clip.mp4')!;

describe('interpretProbe', () => {
  it('accepts an MP4 with size', () => {
    const r = interpretProbe(url, {
      ok: true,
      status: 200,
      finalUrl: url.href,
      header: headers({ 'content-type': 'video/mp4', 'content-length': '5242880' }),
    });
    expect(r.status).toBe('ready');
    if (r.status === 'ready') {
      expect(r.requiresPermissionConfirm).toBe(true);
      expect(r.options[0]).toMatchObject({ kind: 'video', format: 'mp4', sizeBytes: 5242880, fileName: 'My Clip.mp4' });
    }
  });

  it('reads total size from Content-Range after a 1-byte GET', () => {
    const r = interpretProbe(url, {
      ok: true,
      status: 206,
      finalUrl: url.href,
      header: headers({ 'content-type': 'video/mp4', 'content-range': 'bytes 0-0/999', 'content-length': '1' }),
    });
    expect(r.status === 'ready' && r.options[0].sizeBytes).toBe(999);
  });

  it('refuses web pages, logins and unknown types', () => {
    const html = interpretProbe(url, { ok: true, status: 200, finalUrl: '', header: headers({ 'content-type': 'text/html' }) });
    expect(html.status).toBe('unsupported');
    const auth = interpretProbe(url, { ok: false, status: 403, finalUrl: '', header: headers({}) });
    expect(auth.status === 'unsupported' && auth.message).toMatch(/login/);
    const zip = interpretProbe(parseUrl('https://x.com/a.zip')!, {
      ok: true,
      status: 200,
      finalUrl: '',
      header: headers({ 'content-type': 'application/zip' }),
    });
    expect(zip.status).toBe('unsupported');
  });

  it('uses Content-Disposition file names', () => {
    expect(filenameFromContentDisposition('attachment; filename="song.mp3"')).toBe('song.mp3');
    expect(filenameFromContentDisposition("attachment; filename*=UTF-8''%E0%B4%AA%E0%B4%BE.mp3")).toBe('പാ.mp3');
  });
});

describe('parseArchiveMetadata', () => {
  const sample = {
    metadata: { title: 'Popeye for President', licenseurl: 'http://creativecommons.org/publicdomain/mark/1.0/' },
    files: [
      { name: 'Popeye_forPresident_512kb.mp4', format: '512Kb MPEG4', size: '29171880' },
      { name: 'Popeye_forPresident.mp4', format: 'h.264', size: '60000000', height: '480' },
      { name: 'Popeye_forPresident.ogv', format: 'Ogg Video', size: '1' },
      { name: 'audio/track 1.mp3', format: 'VBR MP3', size: '4000000' },
      { name: 'secret.mp4', format: 'h.264', private: 'true' },
      { name: 'Popeye_forPresident_meta.xml', format: 'Metadata' },
    ],
  };

  it('lists MP4 and MP3 only, best quality first, with encoded URLs', () => {
    const r = parseArchiveMetadata('Popeye_forPresident', sample);
    expect(r.status).toBe('ready');
    if (r.status !== 'ready') return;
    expect(r.title).toBe('Popeye for President');
    expect(r.requiresPermissionConfirm).toBe(false);
    expect(r.options.map((o) => o.format)).toEqual(['mp4', 'mp4', 'mp3']);
    expect(r.options[0].quality).toBeGreaterThanOrEqual(r.options[1].quality);
    expect(r.options[2].url).toBe('https://archive.org/download/Popeye_forPresident/audio/track%201.mp3');
    expect(r.options.find((o) => o.id === 'secret.mp4')).toBeUndefined();
    expect(r.licenseNote).toMatch(/creativecommons/);
  });

  it('blocks restricted items and handles missing ones', () => {
    expect(parseArchiveMetadata('x', { ...sample, metadata: { 'access-restricted-item': 'true' } }).status).toBe('blocked');
    expect(parseArchiveMetadata('x', {}).status).toBe('unsupported');
    expect(parseArchiveMetadata('x', []).status).toBe('unsupported');
  });
});

describe('checkSource (with a fake network)', () => {
  const fakeFetch = (status: number, h: Record<string, string>, body?: unknown) =>
    jest.fn(async (input: any, init?: any) => ({
      ok: status >= 200 && status < 300,
      status,
      url: String(input),
      headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
      json: async () => body,
      _init: init,
    })) as unknown as typeof fetch;

  it('never calls the network for YouTube links', async () => {
    const f = fakeFetch(200, {});
    const r = await checkSource('https://youtu.be/xyz', f);
    expect(r.status).toBe('blocked');
    expect(f).not.toHaveBeenCalled();
  });

  it('falls back to a ranged GET when HEAD is not allowed', async () => {
    let call = 0;
    const f = jest.fn(async (input: any) => {
      call++;
      const isHead = call === 1;
      return {
        ok: !isHead,
        status: isHead ? 405 : 206,
        url: String(input),
        headers: { get: (n: string) => (isHead ? null : ({ 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-0/2048' } as any)[n]) },
      };
    }) as unknown as typeof fetch;
    const r = await checkSource('https://cdn.example.com/a.mp3', f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.status === 'ready' && r.options[0].sizeBytes).toBe(2048);
  });

  it('reports network failures in plain language', async () => {
    const f = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const r = await checkSource('https://cdn.example.com/a.mp3', f);
    expect(r.status === 'unsupported' && r.message).toMatch(/internet connection/);
  });
});
