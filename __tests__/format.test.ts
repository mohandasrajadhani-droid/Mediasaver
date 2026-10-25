import { formatBytes, formatDuration, progressRatio, sanitizeFileName, uniqueFileName } from '../src/utils/format';

describe('format helpers', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB');
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
  });

  it('formats durations', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('computes progress or null when total unknown', () => {
    expect(progressRatio(50, 100)).toBe(0.5);
    expect(progressRatio(150, 100)).toBe(1);
    expect(progressRatio(10, -1)).toBeNull();
  });

  it('sanitizes file names', () => {
    expect(sanitizeFileName('a/b:c*?.mp3', 'mp3')).toBe('a b c.mp3');
    expect(sanitizeFileName('song.MP3', 'mp3')).toBe('song.mp3');
    expect(sanitizeFileName('   ', 'mp4')).toBe('download.mp4');
    expect(sanitizeFileName('x'.repeat(200), 'mp4').length).toBe(84);
    expect(sanitizeFileName('മലയാളം ഗാനം', '.mp3')).toBe('മലയാളം ഗാനം.mp3');
  });

  it('creates unique names for duplicates', () => {
    expect(uniqueFileName('a.mp3', [])).toBe('a.mp3');
    expect(uniqueFileName('a.mp3', ['A.mp3'])).toBe('a (1).mp3');
    expect(uniqueFileName('a.mp3', ['a.mp3', 'a (1).mp3'])).toBe('a (2).mp3');
  });
});
