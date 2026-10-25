/**
 * @jest-environment node
 *
 * Live check against the real Openverse API. Skipped by default; the GitHub
 * build runs it with LIVE_API=1 to confirm the response format still matches
 * what the parser expects.
 */
import { parseSearchResponse, searchMusic } from '../src/music/openverse';

const live = process.env.LIVE_API ? test : test.skip;

live(
  'real Openverse search returns commercial-use, playable tracks',
  async () => {
    const page = await searchMusic('piano', 1, fetch);
    // eslint-disable-next-line no-console
    console.log(`Openverse live: ${page.total} results, ${page.tracks.length} usable on page 1`);
    expect(page.tracks.length).toBeGreaterThan(0);
    for (const t of page.tracks) {
      expect(t.fileUrl.startsWith('https://')).toBe(true);
      expect(t.licenseLabel).toBeTruthy();
      expect(t.attribution).toBeTruthy();
    }
    expect(parseSearchResponse({}).tracks).toEqual([]);
  },
  30000,
);
