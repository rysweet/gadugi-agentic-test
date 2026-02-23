/**
 * FileReader tests — all fs/promises calls are mocked.
 *
 * Coverage targets:
 *   readJsonFile
 *   exists
 *   getMetadata
 */

import path from 'path';

// ---------- mock fs/promises before importing the module under test ----------
const mockReadFile = jest.fn();
const mockAccess = jest.fn();
const mockStat = jest.fn();

jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    access: (...args: unknown[]) => mockAccess(...args),
    stat: (...args: unknown[]) => mockStat(...args),
  }
}));

import {
  readJsonFile,
  exists,
  getMetadata,
} from '../../utils/files/FileReader';
import { FileOperationError } from '../../utils/files/types';

// ---------------------------------------------------------------------------

function makeStats(overrides: {
  isDirectory?: boolean;
  size?: number;
  mtime?: Date;
  birthtime?: Date;
  mode?: number;
} = {}) {
  return {
    isDirectory: () => overrides.isDirectory ?? false,
    isFile: () => !(overrides.isDirectory ?? false),
    size: overrides.size ?? 1024,
    mtime: overrides.mtime ?? new Date('2024-06-01T12:00:00Z'),
    birthtime: overrides.birthtime ?? new Date('2024-01-01T00:00:00Z'),
    mode: overrides.mode ?? 0o100644,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// readJsonFile
// ===========================================================================
describe('readJsonFile', () => {
  it('reads and parses a valid JSON file', async () => {
    const data = { foo: 'bar', count: 3 };
    mockReadFile.mockResolvedValue(JSON.stringify(data));

    const result = await readJsonFile<typeof data>('/some/file.json');

    expect(result).toEqual(data);
    expect(mockReadFile).toHaveBeenCalledWith('/some/file.json', 'utf-8');
  });

  it('throws FileOperationError when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(readJsonFile('/missing/file.json')).rejects.toThrow(FileOperationError);
  });

  it('throws FileOperationError when content is invalid JSON', async () => {
    mockReadFile.mockResolvedValue('not valid json {{{');

    await expect(readJsonFile('/bad/file.json')).rejects.toThrow(FileOperationError);
  });

  it('returns an empty object for an empty JSON object file', async () => {
    mockReadFile.mockResolvedValue('{}');

    const result = await readJsonFile('/empty/object.json');

    expect(result).toEqual({});
  });

  it('returns a typed result using the generic parameter', async () => {
    const arr = [1, 2, 3];
    mockReadFile.mockResolvedValue(JSON.stringify(arr));

    const result = await readJsonFile<number[]>('/array.json');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([1, 2, 3]);
  });
});

// ===========================================================================
// exists
// ===========================================================================
describe('exists', () => {
  it('returns true when fs.access resolves (file exists)', async () => {
    mockAccess.mockResolvedValue(undefined);

    const result = await exists('/existing/file.txt');

    expect(result).toBe(true);
  });

  it('returns false when fs.access throws (file does not exist)', async () => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockAccess.mockRejectedValue(err);

    const result = await exists('/missing/file.txt');

    expect(result).toBe(false);
  });

  it('returns false for any access error (e.g. permission denied)', async () => {
    const err = new Error('EACCES') as NodeJS.ErrnoException;
    err.code = 'EACCES';
    mockAccess.mockRejectedValue(err);

    const result = await exists('/locked/file.txt');

    expect(result).toBe(false);
  });
});

// ===========================================================================
// getMetadata
// ===========================================================================
describe('getMetadata', () => {
  it('returns correct metadata for a regular file', async () => {
    const mtime = new Date('2024-06-15T10:00:00Z');
    const birthtime = new Date('2024-01-10T08:00:00Z');
    mockStat.mockResolvedValue(makeStats({
      isDirectory: false,
      size: 2048,
      mtime,
      birthtime,
      mode: 0o100644,
    }));

    const meta = await getMetadata('/data/report.json');

    expect(meta.filePath).toBe('/data/report.json');
    expect(meta.fileName).toBe('report.json');
    expect(meta.extension).toBe('.json');
    expect(meta.size).toBe(2048);
    expect(meta.modifiedAt).toEqual(mtime);
    expect(meta.createdAt).toEqual(birthtime);
    expect(meta.isDirectory).toBe(false);
    expect(meta.permissions).toBe('644');
  });

  it('returns correct metadata for a directory', async () => {
    mockStat.mockResolvedValue(makeStats({
      isDirectory: true,
      size: 4096,
      mode: 0o040755,
    }));

    const meta = await getMetadata('/data/subdir');

    expect(meta.isDirectory).toBe(true);
    expect(meta.fileName).toBe('subdir');
    expect(meta.extension).toBe('');
    expect(meta.size).toBe(4096);
    expect(meta.permissions).toBe('755');
  });

  it('lowercases the extension', async () => {
    mockStat.mockResolvedValue(makeStats({ isDirectory: false }));

    const meta = await getMetadata('/data/IMAGE.PNG');

    expect(meta.extension).toBe('.png');
  });

  it('throws FileOperationError when stat fails', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT'));

    await expect(getMetadata('/missing/file.txt')).rejects.toThrow(FileOperationError);
  });
});
