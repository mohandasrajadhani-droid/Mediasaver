import { describeError, findDuplicate, hasRoomFor, reconcileAfterRestart, STORAGE_SAFETY_BYTES } from '../src/download/rules';
import type { DownloadItem } from '../src/library/types';

const base: DownloadItem = {
  id: '1',
  title: 't',
  fileName: 't.mp3',
  pageUrl: 'https://x.com/t.mp3',
  mediaUrl: 'https://x.com/t.mp3',
  sourceName: 'x.com',
  kind: 'audio',
  format: 'mp3',
  mimeType: 'audio/mpeg',
  status: 'completed',
  bytesWritten: 10,
  totalBytes: 10,
  createdAt: 0,
};

describe('findDuplicate', () => {
  it('finds completed and active duplicates, ignoring #fragments', () => {
    expect(findDuplicate([base], 'https://x.com/t.mp3#a')?.kind).toBe('completed');
    expect(findDuplicate([{ ...base, status: 'downloading' }], base.mediaUrl)?.kind).toBe('active');
    expect(findDuplicate([{ ...base, status: 'paused' }, base], base.mediaUrl)?.kind).toBe('active');
  });
  it('ignores failed, cancelled and missing files', () => {
    expect(findDuplicate([{ ...base, status: 'failed' }], base.mediaUrl)).toBeNull();
    expect(findDuplicate([{ ...base, status: 'cancelled' }], base.mediaUrl)).toBeNull();
    expect(findDuplicate([{ ...base, missing: true }], base.mediaUrl)).toBeNull();
    expect(findDuplicate([base], 'https://x.com/other.mp3')).toBeNull();
  });
});

describe('hasRoomFor', () => {
  const GB = 1024 ** 3;
  it('keeps a safety margin', () => {
    expect(hasRoomFor(100, GB)).toBe(true);
    expect(hasRoomFor(GB, GB)).toBe(false);
    expect(hasRoomFor(undefined, STORAGE_SAFETY_BYTES + 1)).toBe(true);
    expect(hasRoomFor(undefined, STORAGE_SAFETY_BYTES - 1)).toBe(false);
  });
});

describe('describeError', () => {
  it.each([
    [new Error('java.net.UnknownHostException: Unable to resolve host'), 'network'],
    [new Error('SocketTimeoutException: timeout'), 'network'],
    [new Error('ENOSPC: No space left on device'), 'storage'],
    [Object.assign(new Error('aborted'), { name: 'AbortError' }), 'cancelled'],
    [new Error('Download failed with status 404'), 'http'],
    ['weird', 'unknown'],
  ])('%p → %p', (err, kind) => expect(describeError(err).kind).toBe(kind));
});

describe('reconcileAfterRestart', () => {
  it('turns interrupted downloads into retryable failures', () => {
    const out = reconcileAfterRestart([{ ...base, status: 'downloading' }, { ...base, status: 'paused' }, base]);
    expect(out.map((i) => i.status)).toEqual(['failed', 'failed', 'completed']);
    expect(out[0].error).toMatch(/Retry/);
  });
});
