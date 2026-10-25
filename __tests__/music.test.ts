import { buildSearchUrl, parseSearchResponse, searchMusic, trackToOption, MusicSearchError } from '../src/music/openverse';
import { planImport } from '../src/library/importFiles';

jest.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: {} }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const sample = {
  result_count: 2,
  page_count: 3,
  results: [
    {
      id: 'a1',
      title: 'Wedding Dhol',
      creator: 'Artist One',
      url: 'https://cdn.example.org/a1.mp3',
      filetype: 'mp3',
      license: 'by',
      license_version: '4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: '"Wedding Dhol" by Artist One is licensed under CC BY 4.0.',
      duration: 125400,
      filesize: 3000000,
      foreign_landing_url: 'https://example.org/track/a1',
      source: 'jamendo',
    },
    { id: 'b2', title: 'Calm', creator: 'Two', url: 'https://x.org/b2.ogg', license: 'cc0', duration: null },
    { id: 'c3', title: 'Insecure', url: 'http://x.org/c.mp3', license: 'by' },
    { id: 'd4', title: 'Flac?', url: 'https://x.org/d.aiff', license: 'by', filetype: 'aiff' },
    { id: 'e5', title: 'Mature', url: 'https://x.org/e.mp3', license: 'by', mature: true },
    { id: 'f6', title: 'No licence', url: 'https://x.org/f.mp3' },
  ],
};

describe('Openverse music search', () => {
  it('always asks for commercial-use music only', () => {
    const url = buildSearchUrl(' wedding songs ', 2);
    expect(url).toContain('license_type=commercial');
    expect(url).toContain('category=music');
    expect(url).toContain('mature=false');
    expect(url).toContain('q=wedding%20songs');
    expect(url).toContain('page=2');
  });

  it('keeps only safe, playable, https tracks and marks credit requirements', () => {
    const page = parseSearchResponse(sample, 1);
    expect(page.tracks.map((t) => t.id)).toEqual(['a1', 'b2']);
    expect(page.pageCount).toBe(3);
    const [a, b] = page.tracks;
    expect(a).toMatchObject({ durationSec: 125, licenseLabel: 'CC BY 4.0', needsCredit: true, format: 'mp3', source: 'jamendo' });
    expect(a.attribution).toMatch(/Artist One/);
    expect(b).toMatchObject({ needsCredit: false, licenseLabel: 'CC0 (public domain)', format: 'ogg', durationSec: null });
  });

  it('copes with junk responses', () => {
    expect(parseSearchResponse(null).tracks).toEqual([]);
    expect(parseSearchResponse({ results: 'x' }).tracks).toEqual([]);
  });

  it('turns a track into a download option with a safe file name', () => {
    const [a] = parseSearchResponse(sample).tracks;
    const o = trackToOption(a);
    expect(o).toMatchObject({ kind: 'audio', format: 'mp3', fileName: 'Wedding Dhol - Artist One.mp3', sizeBytes: 3000000 });
    expect(o.label).toBe('MP3 · 2:05 · 2.9 MB');
  });

  it('reports network, rate-limit and server errors in plain language', async () => {
    const fail = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(searchMusic('x', 1, fail)).rejects.toThrow(/internet connection/);
    const limited = jest.fn(async () => ({ ok: false, status: 429 })) as unknown as typeof fetch;
    await expect(searchMusic('x', 1, limited)).rejects.toBeInstanceOf(MusicSearchError);
    const ok = jest.fn(async () => ({ ok: true, status: 200, json: async () => sample })) as unknown as typeof fetch;
    expect((await searchMusic('x', 1, ok)).tracks).toHaveLength(2);
    expect((await searchMusic('   ', 1, ok)).tracks).toHaveLength(0);
  });
});

describe('planImport', () => {
  it('accepts audio/video and avoids name clashes', () => {
    expect(planImport('My Song.mp3', 'audio/mpeg', [])).toEqual({ ok: true, fileName: 'My Song.mp3', kind: 'audio' });
    expect(planImport('My Song.mp3', 'audio/mpeg', ['my song.mp3'])).toMatchObject({ fileName: 'My Song (1).mp3' });
    expect(planImport('clip', 'video/mp4', [])).toMatchObject({ ok: true, fileName: 'clip.mp4', kind: 'video' });
    expect(planImport('ഗാനം.m4a', null, [])).toMatchObject({ ok: true, kind: 'audio' });
  });
  it('rejects other files', () => {
    expect(planImport('notes.pdf', 'application/pdf', []).ok).toBe(false);
  });
});
