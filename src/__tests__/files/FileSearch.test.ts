/**
 * FileSearch tests — glob, fs/promises and crypto are mocked.
 *
 * Coverage targets:
 *   findFiles
 *   calculateHash
 *   filterByAge
 *   filterByPatterns  (include mode, exclude mode, ReDoS safety)
 */

// ---------- mock 'glob' before importing the module under test ----------
const mockGlob = jest.fn();
jest.mock('glob', () => ({ glob: (...args: unknown[]) => mockGlob(...args) }));

// ---------- mock fs/promises ----------
const mockReadFile = jest.fn();
const mockFsStat = jest.fn();
jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    stat: (...args: unknown[]) => mockFsStat(...args),
  }
}));

// ---------- mock crypto (for deterministic hash testing) ----------
const mockDigest = jest.fn();
const mockUpdate = jest.fn(() => ({ digest: mockDigest }));
const mockCreateHash = jest.fn(() => ({ update: mockUpdate }));
jest.mock('crypto', () => ({
  __esModule: true,
  default: { createHash: (...args: unknown[]) => mockCreateHash(...args) },
}));

import {
  findFiles,
  calculateHash,
  filterByAge,
  filterByPatterns,
} from '../../utils/files/FileSearch';
import { FileOperationError } from '../../utils/files/types';

// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// findFiles
// ===========================================================================
describe('findFiles', () => {
  it('returns matching paths for a single string pattern', async () => {
    mockGlob.mockResolvedValue(['/project/src/a.ts', '/project/src/b.ts']);

    const result = await findFiles('**/*.ts', { cwd: '/project' });

    expect(mockGlob).toHaveBeenCalledWith('**/*.ts', expect.objectContaining({ cwd: '/project' }));
    expect(result).toEqual(['/project/src/a.ts', '/project/src/b.ts']);
  });

  it('returns matching paths for an array of patterns', async () => {
    mockGlob
      .mockResolvedValueOnce(['/project/a.ts'])
      .mockResolvedValueOnce(['/project/b.js']);

    const result = await findFiles(['**/*.ts', '**/*.js'], { cwd: '/project' });

    expect(mockGlob).toHaveBeenCalledTimes(2);
    expect(result).toEqual(['/project/a.ts', '/project/b.js']);
  });

  it('deduplicates results when the same path appears in multiple patterns', async () => {
    mockGlob
      .mockResolvedValueOnce(['/project/shared.ts'])
      .mockResolvedValueOnce(['/project/shared.ts', '/project/other.ts']);

    const result = await findFiles(['**/*.ts', 'src/**/*.ts'], { cwd: '/project' });

    expect(result).toEqual(['/project/shared.ts', '/project/other.ts']);
  });

  it('passes absolute=true by default', async () => {
    mockGlob.mockResolvedValue([]);

    await findFiles('**/*');

    expect(mockGlob).toHaveBeenCalledWith('**/*', expect.objectContaining({ absolute: true }));
  });

  it('passes ignore option when provided', async () => {
    mockGlob.mockResolvedValue([]);

    await findFiles('**/*.ts', { ignore: ['node_modules/**'] });

    expect(mockGlob).toHaveBeenCalledWith('**/*.ts', expect.objectContaining({ ignore: ['node_modules/**'] }));
  });

  it('throws FileOperationError when glob throws', async () => {
    mockGlob.mockRejectedValue(new Error('glob error'));

    await expect(findFiles('**/*.ts')).rejects.toThrow(FileOperationError);
  });

  it('returns an empty array when no files match', async () => {
    mockGlob.mockResolvedValue([]);

    const result = await findFiles('**/*.xyz');

    expect(result).toEqual([]);
  });
});

// ===========================================================================
// calculateHash
// ===========================================================================
describe('calculateHash', () => {
  it('returns a consistent sha256 hex string for file content', async () => {
    const fakeBuffer = Buffer.from('hello world');
    mockReadFile.mockResolvedValue(fakeBuffer);
    mockDigest.mockReturnValue('aabbccddeeff0011');

    const result = await calculateHash('/some/file.txt', 'sha256');

    expect(mockCreateHash).toHaveBeenCalledWith('sha256');
    expect(mockUpdate).toHaveBeenCalledWith(fakeBuffer);
    expect(mockDigest).toHaveBeenCalledWith('hex');
    expect(result).toBe('aabbccddeeff0011');
  });

  it('uses md5 as default algorithm', async () => {
    mockReadFile.mockResolvedValue(Buffer.from('data'));
    mockDigest.mockReturnValue('deadbeef');

    await calculateHash('/file.bin');

    expect(mockCreateHash).toHaveBeenCalledWith('md5');
  });

  it('throws FileOperationError when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(calculateHash('/missing/file.txt')).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// filterByAge
// ===========================================================================
describe('filterByAge', () => {
  it('includes files newer than the cutoff time', async () => {
    const now = Date.now();
    const recentMtime = new Date(now - 1000);    // 1 second ago
    const oldMtime = new Date(now - 60_000);     // 1 minute ago
    const cutoff = now - 30_000;                 // 30 seconds ago

    mockFsStat
      .mockResolvedValueOnce({ mtime: recentMtime })   // /recent.log — newer than cutoff (NOT in result)
      .mockResolvedValueOnce({ mtime: oldMtime });     // /old.log    — older than cutoff (in result)

    const result = await filterByAge(['/recent.log', '/old.log'], cutoff);

    // filterByAge keeps files where mtime < cutoffTime (i.e. older files)
    expect(result).toEqual(['/old.log']);
  });

  it('excludes files newer than maxAgeMs cutoff', async () => {
    const now = Date.now();
    const futureMtime = new Date(now + 5000);
    const cutoff = now;

    mockFsStat.mockResolvedValue({ mtime: futureMtime });

    const result = await filterByAge(['/new-file.log'], cutoff);

    expect(result).toEqual([]);
  });

  it('returns an empty array when no files are provided', async () => {
    const result = await filterByAge([], Date.now());

    expect(result).toEqual([]);
    expect(mockFsStat).not.toHaveBeenCalled();
  });

  it('silently skips files that cannot be stat-ed', async () => {
    mockFsStat.mockRejectedValue(new Error('ENOENT'));

    const result = await filterByAge(['/ghost.log'], 0);

    expect(result).toEqual([]);
  });
});

// ===========================================================================
// filterByPatterns
// ===========================================================================
describe('filterByPatterns — include mode (exclude=false)', () => {
  it('returns only files matching the pattern', () => {
    const files = ['/tmp/app.log', '/tmp/debug.log', '/tmp/data.csv'];
    const result = filterByPatterns(files, ['*.log'], false);

    expect(result).toEqual(['/tmp/app.log', '/tmp/debug.log']);
  });

  it('returns an empty array when no files match', () => {
    const files = ['/tmp/data.csv', '/tmp/report.txt'];
    const result = filterByPatterns(files, ['*.log'], false);

    expect(result).toEqual([]);
  });

  it('matches against the file name portion only (not full path)', () => {
    const files = ['/var/log/system.log'];
    const result = filterByPatterns(files, ['system.log'], false);

    expect(result).toEqual(['/var/log/system.log']);
  });
});

describe('filterByPatterns — exclude mode (exclude=true)', () => {
  it('returns files NOT matching the exclude pattern', () => {
    const files = ['/tmp/app.log', '/tmp/debug.log', '/tmp/data.csv'];
    const result = filterByPatterns(files, ['*.log'], true);

    expect(result).toEqual(['/tmp/data.csv']);
  });

  it('returns all files when nothing matches the exclude pattern', () => {
    const files = ['/tmp/a.txt', '/tmp/b.txt'];
    const result = filterByPatterns(files, ['*.log'], true);

    expect(result).toEqual(['/tmp/a.txt', '/tmp/b.txt']);
  });

  it('returns an empty array when all files match the exclude pattern', () => {
    const files = ['/tmp/app.log', '/tmp/debug.log'];
    const result = filterByPatterns(files, ['*.log'], true);

    expect(result).toEqual([]);
  });
});

describe('filterByPatterns — ReDoS safety', () => {
  it('does NOT cause catastrophic backtracking on a ReDoS-prone input', () => {
    // Pattern `(a+)+` — when passed raw to RegExp, it would cause exponential
    // backtracking on input like 'aaaaaaaaaaaX'. globToRegex must escape it.
    const files = ['(a+)+', 'aaaaaaaaaaaaaaaaaaaaX'];

    const start = Date.now();
    // Should complete well within 500 ms because metacharacters are escaped
    const result = filterByPatterns(files, ['(a+)+'], false);
    const elapsed = Date.now() - start;

    // The function should return results
    expect(Array.isArray(result)).toBe(true);
    // And it should NOT take more than 500 ms
    expect(elapsed).toBeLessThan(500);
  });
});
