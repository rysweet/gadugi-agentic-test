/**
 * FileArchiver tests — fs/promises and glob are mocked.
 *
 * Coverage targets:
 *   copy          — file copy
 *   backup        — timestamped backup
 *   cleanup       — pattern-based deletion + path-traversal guard
 *   sync          — source → destination sync
 */

// ---------- mock glob before importing ----------
const mockGlob = jest.fn();
jest.mock('glob', () => ({ glob: (...args: unknown[]) => mockGlob(...args) }));

// ---------- mock fs/promises ----------
const mockStat = jest.fn();
const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();
const mockAppendFile = jest.fn();
const mockCopyFile = jest.fn();
const mockRename = jest.fn();
const mockRm = jest.fn();
const mockRmdir = jest.fn();
const mockUnlink = jest.fn();
const mockReaddir = jest.fn();
const mockAccess = jest.fn();

jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    stat: (...args: unknown[]) => mockStat(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    appendFile: (...args: unknown[]) => mockAppendFile(...args),
    copyFile: (...args: unknown[]) => mockCopyFile(...args),
    rename: (...args: unknown[]) => mockRename(...args),
    rm: (...args: unknown[]) => mockRm(...args),
    rmdir: (...args: unknown[]) => mockRmdir(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
    access: (...args: unknown[]) => mockAccess(...args),
  }
}));

// ---------- mock crypto (used transitively by FileSearch.calculateHash) ----------
const mockDigest = jest.fn(() => 'abc123');
const mockUpdate = jest.fn(() => ({ digest: mockDigest }));
jest.mock('crypto', () => ({
  __esModule: true,
  default: { createHash: jest.fn(() => ({ update: mockUpdate })) },
}));

import path from 'path';
import {
  copy,
  backup,
  cleanup,
  sync,
} from '../../utils/files/FileArchiver';
import { FileOperationError } from '../../utils/files/types';

// ---------------------------------------------------------------------------

function makeFileStats(overrides: { size?: number; mtime?: Date } = {}) {
  return {
    isDirectory: () => false,
    isFile: () => true,
    size: overrides.size ?? 512,
    mtime: overrides.mtime ?? new Date('2024-01-01'),
    birthtime: new Date('2024-01-01'),
    mode: 0o100644,
  };
}

function makeDirStats() {
  return {
    isDirectory: () => true,
    isFile: () => false,
    size: 4096,
    mtime: new Date('2024-01-01'),
    birthtime: new Date('2024-01-01'),
    mode: 0o040755,
  };
}

function makeEnoent(): NodeJS.ErrnoException {
  const err = new Error('ENOENT') as NodeJS.ErrnoException;
  err.code = 'ENOENT';
  return err;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// copy
// ===========================================================================
describe('copy', () => {
  it('copies a file to the destination', async () => {
    // ensureDirectory: stat says parent dir exists
    mockStat
      .mockResolvedValueOnce(makeDirStats())   // ensureDirectory: stat parent of dst
      .mockResolvedValueOnce(makeFileStats()); // copy: stat source

    mockCopyFile.mockResolvedValue(undefined);

    await copy('/src/file.txt', '/dst/file.txt');

    expect(mockCopyFile).toHaveBeenCalledWith('/src/file.txt', '/dst/file.txt');
  });

  it('throws FileOperationError when source stat fails', async () => {
    mockStat
      .mockResolvedValueOnce(makeDirStats()) // ensureDirectory parent dir
      .mockRejectedValueOnce(new Error('ENOENT')); // source stat fails

    await expect(copy('/missing/file.txt', '/dst/file.txt')).rejects.toThrow(FileOperationError);
  });

  it('throws FileOperationError when destination exists and overwrite=false', async () => {
    mockStat
      .mockResolvedValueOnce(makeDirStats())   // ensureDirectory parent
      .mockResolvedValueOnce(makeFileStats()); // source stat

    // exists() uses access — returns successfully meaning dest exists
    mockAccess.mockResolvedValue(undefined);

    await expect(copy('/src/file.txt', '/dst/file.txt', false)).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// backup
// ===========================================================================
describe('backup', () => {
  it('creates a timestamped backup copy and returns the backup path', async () => {
    // Multiple stat calls:
    // 1. ensureDirectory for backupDir → ENOENT → mkdir
    // 2. ensureDirectory for copy destination parent → already handled by backup
    // 3. copy's ensureDirectory for backup parent
    // 4. stat of source inside copy
    mockStat
      .mockRejectedValueOnce(makeEnoent())    // ensureDirectory(backupDir): ENOENT
      .mockResolvedValueOnce(makeDirStats())  // ensureDirectory inside copy
      .mockResolvedValueOnce(makeFileStats()); // source stat inside copy

    mockMkdir.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);

    const backupPath = await backup('/data/config.yaml', '/backups');

    expect(backupPath).toMatch(/\/backups\/config\.yaml\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    expect(mockCopyFile).toHaveBeenCalled();
  });

  it('uses a sibling "backups" directory when no backupDir is provided', async () => {
    mockStat
      .mockRejectedValueOnce(makeEnoent())
      .mockResolvedValueOnce(makeDirStats())
      .mockResolvedValueOnce(makeFileStats());

    mockMkdir.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);

    const backupPath = await backup('/data/config.yaml');

    expect(backupPath).toContain('/data/backups/');
  });
});

// ===========================================================================
// cleanup
// ===========================================================================
describe('cleanup', () => {
  it('deletes files matching includePatterns', async () => {
    // exists() for the directory
    mockAccess.mockResolvedValue(undefined);

    // findFiles (glob) returns two log files
    mockGlob.mockResolvedValue([
      '/work/app.log',
      '/work/debug.log',
    ]);

    mockStat.mockResolvedValue(makeFileStats({ size: 256 }));
    mockUnlink.mockResolvedValue(undefined);

    const result = await cleanup('/work', { includePatterns: ['*.log'] });

    expect(result.deletedFiles).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.totalSize).toBe(512); // 2 × 256
  });

  it('blocks path-traversal patterns (../../ paths rejected)', async () => {
    // exists() passes
    mockAccess.mockResolvedValue(undefined);

    // glob returns a path that resolves OUTSIDE /work
    const traversalPath = path.resolve('/work/../../secrets/key.pem');
    mockGlob.mockResolvedValue([traversalPath]);

    // stat would only be called for safe paths; should NOT be called
    mockStat.mockResolvedValue(makeFileStats());
    mockUnlink.mockResolvedValue(undefined);

    const result = await cleanup('/work');

    // The traversal path must be silently filtered — nothing deleted
    expect(result.deletedFiles).toHaveLength(0);
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it('returns an empty result when the directory does not exist', async () => {
    mockAccess.mockRejectedValue(makeEnoent());

    const result = await cleanup('/nonexistent');

    expect(result.deletedFiles).toHaveLength(0);
    expect(result.deletedDirectories).toHaveLength(0);
    expect(result.totalSize).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('respects dryRun option — does not actually delete files', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockGlob.mockResolvedValue(['/work/old.log']);
    mockStat.mockResolvedValue(makeFileStats({ size: 100 }));

    const result = await cleanup('/work', { dryRun: true });

    expect(result.deletedFiles).toHaveLength(1);
    expect(mockUnlink).not.toHaveBeenCalled();
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('records errors without throwing when a single file deletion fails', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockGlob.mockResolvedValue(['/work/locked.log']);
    mockStat.mockResolvedValueOnce(makeFileStats({ size: 100 }));
    mockUnlink.mockRejectedValue(new Error('EACCES'));

    // deleteFileOrDir calls stat again inside it
    mockStat.mockResolvedValue(makeFileStats({ size: 100 }));

    const result = await cleanup('/work');

    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// sync
// ===========================================================================
describe('sync', () => {
  it('copies files from source to destination', async () => {
    // ensureDirectory for destination
    mockStat
      .mockResolvedValueOnce(makeDirStats());    // ensureDirectory dest

    // findFiles returns relative paths
    mockGlob.mockResolvedValueOnce(['file.ts']); // source files

    // exists() for dest file → ENOENT (does not exist yet)
    mockAccess.mockRejectedValue(makeEnoent());

    // copy: ensureDirectory parent + stat source
    mockStat
      .mockResolvedValueOnce(makeDirStats())    // ensureDirectory inside copy
      .mockResolvedValueOnce(makeFileStats());  // stat source

    mockCopyFile.mockResolvedValue(undefined);

    const result = await sync('/src', '/dst');

    expect(result.copied).toContain('file.ts');
    expect(result.errors).toHaveLength(0);
  });

  it('updates a file when source is newer than destination', async () => {
    const oldMtime = new Date('2024-01-01');
    const newMtime = new Date('2024-06-01');

    // ensureDirectory dest
    mockStat.mockResolvedValueOnce(makeDirStats());

    mockGlob.mockResolvedValueOnce(['config.json']);

    // exists() dest → true
    mockAccess.mockResolvedValueOnce(undefined);

    // stat source and stat dest for mtime comparison
    mockStat
      .mockResolvedValueOnce(makeFileStats({ mtime: newMtime })) // source
      .mockResolvedValueOnce(makeFileStats({ mtime: oldMtime })) // dest
      // copy: ensureDirectory parent
      .mockResolvedValueOnce(makeDirStats())
      // copy: stat source again
      .mockResolvedValueOnce(makeFileStats({ mtime: newMtime }));

    mockCopyFile.mockResolvedValue(undefined);

    const result = await sync('/src', '/dst');

    expect(result.updated).toContain('config.json');
  });

  it('does not update a file when destination is up to date', async () => {
    const sameMtime = new Date('2024-06-01');

    mockStat.mockResolvedValueOnce(makeDirStats());  // ensureDirectory
    mockGlob.mockResolvedValueOnce(['config.json']);
    mockAccess.mockResolvedValueOnce(undefined);     // dest exists

    mockStat
      .mockResolvedValueOnce(makeFileStats({ mtime: sameMtime }))  // source
      .mockResolvedValueOnce(makeFileStats({ mtime: sameMtime })); // dest — same time

    const result = await sync('/src', '/dst');

    expect(result.updated).toHaveLength(0);
    expect(result.copied).toHaveLength(0);
    expect(mockCopyFile).not.toHaveBeenCalled();
  });
});
