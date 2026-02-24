/**
 * FileArchiver additional tests — expands coverage for sync, backup,
 * cleanup, and copy beyond what the baseline test already covers.
 *
 * All fs/promises calls and glob are mocked so tests run fast and in
 * isolation (no disk I/O).
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
    stat:       (...args: unknown[]) => mockStat(...args),
    mkdir:      (...args: unknown[]) => mockMkdir(...args),
    writeFile:  (...args: unknown[]) => mockWriteFile(...args),
    appendFile: (...args: unknown[]) => mockAppendFile(...args),
    copyFile:   (...args: unknown[]) => mockCopyFile(...args),
    rename:     (...args: unknown[]) => mockRename(...args),
    rm:         (...args: unknown[]) => mockRm(...args),
    rmdir:      (...args: unknown[]) => mockRmdir(...args),
    unlink:     (...args: unknown[]) => mockUnlink(...args),
    readdir:    (...args: unknown[]) => mockReaddir(...args),
    access:     (...args: unknown[]) => mockAccess(...args),
  }
}));

// ---------- mock crypto ----------
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
// Helpers
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
  const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
  err.code = 'ENOENT';
  return err;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// copy — preserving directory structure (recursive copy)
// ===========================================================================
describe('copy — directory', () => {
  it('copies a directory recursively, preserving structure', async () => {
    // ensureDirectory for destination parent
    mockStat
      .mockResolvedValueOnce(makeDirStats())  // ensureDirectory: dst parent stat
      .mockResolvedValueOnce(makeDirStats()); // stat source → it's a directory

    // readdir of source directory
    mockReaddir.mockResolvedValueOnce(['file-a.ts', 'file-b.ts']);

    // ensureDirectory for destination dir itself
    mockStat.mockResolvedValueOnce(makeDirStats()); // inside ensureDirectory for dest

    // stat each file in the directory
    mockStat
      .mockResolvedValueOnce(makeFileStats()) // file-a.ts
      .mockResolvedValueOnce(makeFileStats()); // file-b.ts

    mockCopyFile.mockResolvedValue(undefined);

    await copy('/src/lib', '/dst/lib');

    expect(mockCopyFile).toHaveBeenCalledTimes(2);
    expect(mockCopyFile).toHaveBeenCalledWith('/src/lib/file-a.ts', '/dst/lib/file-a.ts');
    expect(mockCopyFile).toHaveBeenCalledWith('/src/lib/file-b.ts', '/dst/lib/file-b.ts');
  });

  it('skips existing file in directory when overwrite=false', async () => {
    // stat source parent → dir exists
    mockStat
      .mockResolvedValueOnce(makeDirStats())  // ensureDirectory: dst parent
      .mockResolvedValueOnce(makeDirStats()); // stat source → it's a directory

    mockReaddir.mockResolvedValueOnce(['existing.ts']);

    // ensureDirectory for dst dir
    mockStat.mockResolvedValueOnce(makeDirStats());

    // stat entry → file
    mockStat.mockResolvedValueOnce(makeFileStats());

    // exists() check for dest file → exists (access resolves)
    mockAccess.mockResolvedValueOnce(undefined);

    mockCopyFile.mockResolvedValue(undefined);

    await copy('/src/lib', '/dst/lib', false);

    // File already exists and overwrite=false → should NOT be copied
    expect(mockCopyFile).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// backup — timestamp format
// ===========================================================================
describe('backup', () => {
  it('embeds ISO timestamp in backup filename (dashes, no colons)', async () => {
    mockStat
      .mockRejectedValueOnce(makeEnoent())    // ensureDirectory(backupDir): not found
      .mockResolvedValueOnce(makeDirStats())  // ensureDirectory inside copy
      .mockResolvedValueOnce(makeFileStats()); // stat source in copy

    mockMkdir.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);

    const result = await backup('/project/src/index.ts', '/backups');

    // Must not contain colons (Windows path-safe)
    expect(result).not.toContain(':');
    // Must match timestamp pattern
    expect(result).toMatch(/index\.ts\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });

  it('throws FileOperationError when source cannot be copied', async () => {
    // ensureDirectory passes, then copy fails
    mockStat
      .mockRejectedValueOnce(makeEnoent())    // ensureDirectory ENOENT
      .mockResolvedValueOnce(makeDirStats())  // copy: ensureDirectory dest parent
      .mockRejectedValueOnce(new Error('EACCES: permission denied')); // stat source fails

    mockMkdir.mockResolvedValue(undefined);

    await expect(backup('/locked/file.ts', '/backups')).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// cleanup — ENOENT handling and other options
// ===========================================================================
describe('cleanup', () => {
  it('returns empty result (no throw) when directory does not exist', async () => {
    // exists() returns false
    mockAccess.mockRejectedValue(makeEnoent());

    const result = await cleanup('/nonexistent/path');

    expect(result.deletedFiles).toHaveLength(0);
    expect(result.deletedDirectories).toHaveLength(0);
    expect(result.totalSize).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects path-traversal patterns (../../secrets paths are silently filtered)', async () => {
    // Directory exists
    mockAccess.mockResolvedValue(undefined);

    // glob returns a path that resolves OUTSIDE /workdir
    const outsidePath = path.resolve('/workdir/../../secrets/token');
    mockGlob.mockResolvedValue([outsidePath]);

    mockStat.mockResolvedValue(makeFileStats());
    mockUnlink.mockResolvedValue(undefined);

    const result = await cleanup('/workdir');

    // The traversal path must be silently filtered — nothing deleted
    expect(result.deletedFiles).toHaveLength(0);
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it('handles deletion errors per-file without aborting the entire cleanup', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockGlob.mockResolvedValue([
      '/tmp/test/good.log',
      '/tmp/test/locked.log',
    ]);

    // stat calls — two files
    mockStat
      .mockResolvedValueOnce(makeFileStats({ size: 100 })) // good.log stat
      .mockResolvedValueOnce(makeFileStats({ size: 100 })) // locked.log stat
      .mockResolvedValueOnce(makeFileStats({ size: 100 })); // good.log inside deleteFileOrDir

    // first delete succeeds, second fails
    mockUnlink
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('EACCES: permission denied'));

    const result = await cleanup('/tmp/test');

    // The successful delete is still tracked
    expect(result.deletedFiles).toContain('/tmp/test/good.log');
    // The failure is recorded in errors, not re-thrown
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('skips files excluded by excludePatterns', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockGlob.mockResolvedValue([
      '/tmp/test/app.log',
      '/tmp/test/app.ts',
    ]);

    // stat for app.log
    mockStat.mockResolvedValue(makeFileStats({ size: 50 }));
    mockUnlink.mockResolvedValue(undefined);

    // Exclude .ts files from deletion
    const result = await cleanup('/tmp/test', { excludePatterns: ['*.ts'] });

    // .ts file should NOT appear in deletedFiles
    expect(result.deletedFiles).not.toContain('/tmp/test/app.ts');
  });

  it('respects maxFiles limit', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockGlob.mockResolvedValue([
      '/tmp/test/a.log',
      '/tmp/test/b.log',
      '/tmp/test/c.log',
    ]);

    mockStat.mockResolvedValue(makeFileStats({ size: 100 }));
    mockUnlink.mockResolvedValue(undefined);

    const result = await cleanup('/tmp/test', { maxFiles: 2 });

    // Only the first 2 should be processed
    expect(result.deletedFiles.length).toBeLessThanOrEqual(2);
  });

  it('includes directories in deletedDirectories when glob returns them', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockGlob.mockResolvedValue(['/tmp/test/subdir']);

    // stat says it's a directory
    mockStat.mockResolvedValueOnce(makeDirStats());

    // deleteFileOrDir: rm is called on directories
    mockRm.mockResolvedValue(undefined);

    const result = await cleanup('/tmp/test');

    expect(result.deletedDirectories).toContain('/tmp/test/subdir');
  });
});

// ===========================================================================
// sync — deleteExtra, checksum comparison
// ===========================================================================
describe('sync', () => {
  it('deletes files in destination that are not in source when deleteExtra=true', async () => {
    // ensureDirectory for destination
    mockStat.mockResolvedValueOnce(makeDirStats());

    // source files
    mockGlob
      .mockResolvedValueOnce(['a.ts'])  // source
      .mockResolvedValueOnce(['a.ts', 'extra.ts']); // dest

    // dest file exists for a.ts
    mockAccess.mockResolvedValueOnce(undefined);

    // stat source and dest for a.ts (same mtime → no update)
    const sameMtime = new Date('2024-06-01');
    mockStat
      .mockResolvedValueOnce(makeFileStats({ mtime: sameMtime }))  // source a.ts
      .mockResolvedValueOnce(makeFileStats({ mtime: sameMtime })); // dest a.ts

    // deleteFileOrDir for extra.ts
    mockStat.mockResolvedValueOnce(makeFileStats());
    mockUnlink.mockResolvedValue(undefined);

    const result = await sync('/src', '/dst', { deleteExtra: true });

    expect(result.deleted).toContain('extra.ts');
    expect(result.errors).toHaveLength(0);
  });

  it('skips update when useChecksum=true and hashes match', async () => {
    mockStat.mockResolvedValueOnce(makeDirStats()); // ensureDirectory

    mockGlob.mockResolvedValueOnce(['config.json']);

    // dest exists
    mockAccess.mockResolvedValueOnce(undefined);

    // stat source and dest
    mockStat
      .mockResolvedValueOnce(makeFileStats())
      .mockResolvedValueOnce(makeFileStats());

    // Both hash calls return the same value → no update
    mockDigest
      .mockReturnValue('same-hash');

    mockCopyFile.mockResolvedValue(undefined);

    const result = await sync('/src', '/dst', { useChecksum: true });

    // Same hash → no copy
    expect(result.updated).toHaveLength(0);
    expect(result.copied).toHaveLength(0);
    expect(mockCopyFile).not.toHaveBeenCalled();
  });

  it('excludes files matching exclude patterns', async () => {
    mockStat.mockResolvedValueOnce(makeDirStats()); // ensureDirectory dest

    // glob returns both .ts and .js files relative paths
    mockGlob.mockResolvedValueOnce(['index.ts', 'index.js']);

    // For index.ts: dest does not exist → will be copied
    mockAccess.mockRejectedValueOnce(makeEnoent());

    // copy index.ts: ensureDirectory parent + stat source
    mockStat
      .mockResolvedValueOnce(makeDirStats())    // copy: ensureDirectory parent
      .mockResolvedValueOnce(makeFileStats());  // copy: stat source for index.ts

    mockCopyFile.mockResolvedValue(undefined);

    const result = await sync('/src', '/dst', { exclude: ['*.js'] });

    // .js file should be excluded from filteredSourceFiles entirely — not in copied
    expect(result.copied).not.toContain('index.js');
    // .ts file should be copied since dest does not exist
    expect(result.copied).toContain('index.ts');
  });

  it('records error per-file without aborting when copy fails for one file', async () => {
    mockStat.mockResolvedValueOnce(makeDirStats()); // ensureDirectory

    mockGlob.mockResolvedValueOnce(['ok.ts', 'bad.ts']);

    // ok.ts: dest does not exist → copy succeeds
    mockAccess
      .mockRejectedValueOnce(makeEnoent())  // ok.ts: does not exist
      .mockRejectedValueOnce(makeEnoent()); // bad.ts: does not exist

    // ok.ts copy: ensureDirectory + stat source
    mockStat
      .mockResolvedValueOnce(makeDirStats())
      .mockResolvedValueOnce(makeFileStats());

    mockCopyFile.mockResolvedValueOnce(undefined);

    // bad.ts copy: ensureDirectory stat succeeds but copyFile throws
    mockStat
      .mockResolvedValueOnce(makeDirStats())
      .mockResolvedValueOnce(makeFileStats());

    mockCopyFile.mockRejectedValueOnce(new Error('EACCES'));

    const result = await sync('/src', '/dst');

    expect(result.copied).toContain('ok.ts');
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].path).toBe('bad.ts');
  });
});
