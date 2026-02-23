/**
 * FileWriter tests — all fs/promises calls are mocked.
 *
 * Coverage targets:
 *   writeFile       (via appendToFile public surface)
 *   appendToFile
 *   writeJsonFile
 *   ensureDirectory
 *   move
 *   deleteFileOrDir
 *   createTempFile
 *   createTempDirectory
 *   removeEmptyDirectories
 */

import path from 'path';

// ---------- mock fs/promises before importing the module under test ----------
const mockStat = jest.fn();
const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();
const mockAppendFile = jest.fn();
const mockRename = jest.fn();
const mockRm = jest.fn();
const mockRmdir = jest.fn();
const mockUnlink = jest.fn();
const mockReaddir = jest.fn();
const mockCopyFile = jest.fn();

jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    stat: (...args: unknown[]) => mockStat(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    appendFile: (...args: unknown[]) => mockAppendFile(...args),
    rename: (...args: unknown[]) => mockRename(...args),
    rm: (...args: unknown[]) => mockRm(...args),
    rmdir: (...args: unknown[]) => mockRmdir(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
    copyFile: (...args: unknown[]) => mockCopyFile(...args),
  }
}));

import {
  ensureDirectory,
  writeJsonFile,
  appendToFile,
  move,
  deleteFileOrDir,
  createTempFile,
  createTempDirectory,
  removeEmptyDirectories,
} from '../../utils/files/FileWriter';
import { FileOperationError } from '../../utils/files/types';

// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<{ isDirectory: boolean; size: number; mtime: Date }> = {}) {
  return {
    isDirectory: () => overrides.isDirectory ?? false,
    isFile: () => !(overrides.isDirectory ?? false),
    size: overrides.size ?? 100,
    mtime: overrides.mtime ?? new Date('2024-01-01'),
    birthtime: new Date('2024-01-01'),
    mode: 0o100644,
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
// ensureDirectory
// ===========================================================================
describe('ensureDirectory', () => {
  it('is a no-op when the directory already exists', async () => {
    mockStat.mockResolvedValue(makeStats({ isDirectory: true }));

    await ensureDirectory('/existing/dir');

    expect(mockStat).toHaveBeenCalledWith('/existing/dir');
    expect(mockMkdir).not.toHaveBeenCalled();
  });

  it('creates the directory (recursively) when it does not exist', async () => {
    mockStat.mockRejectedValue(makeEnoent());
    mockMkdir.mockResolvedValue(undefined);

    await ensureDirectory('/new/dir');

    expect(mockMkdir).toHaveBeenCalledWith('/new/dir', { recursive: true });
  });

  it('throws FileOperationError when path exists but is not a directory', async () => {
    mockStat.mockResolvedValue(makeStats({ isDirectory: false }));

    await expect(ensureDirectory('/existing/file')).rejects.toThrow(FileOperationError);
  });

  it('throws FileOperationError when mkdir fails', async () => {
    mockStat.mockRejectedValue(makeEnoent());
    mockMkdir.mockRejectedValue(new Error('Permission denied'));

    await expect(ensureDirectory('/protected/dir')).rejects.toThrow(FileOperationError);
  });

  it('throws FileOperationError for non-ENOENT stat errors', async () => {
    const err = new Error('EACCES') as NodeJS.ErrnoException;
    err.code = 'EACCES';
    mockStat.mockRejectedValue(err);

    await expect(ensureDirectory('/locked/dir')).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// writeJsonFile
// ===========================================================================
describe('writeJsonFile', () => {
  beforeEach(() => {
    // ensureDirectory will call stat then (if ENOENT) mkdir
    mockStat.mockResolvedValue(makeStats({ isDirectory: true }));
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('writes JSON content to the file', async () => {
    const data = { key: 'value', num: 42 };

    await writeJsonFile('/some/dir/file.json', data);

    expect(mockWriteFile).toHaveBeenCalledWith(
      '/some/dir/file.json',
      expect.any(String),
      'utf-8'
    );
    const written = mockWriteFile.mock.calls[0][1] as string;
    expect(JSON.parse(written)).toEqual(data);
  });

  it('uses 2-space indentation when pretty=true (default)', async () => {
    const data = { a: 1 };

    await writeJsonFile('/out/file.json', data, true);

    const written = mockWriteFile.mock.calls[0][1] as string;
    expect(written).toBe(JSON.stringify(data, null, 2));
  });

  it('produces compact JSON when pretty=false', async () => {
    const data = { a: 1 };

    await writeJsonFile('/out/file.json', data, false);

    const written = mockWriteFile.mock.calls[0][1] as string;
    expect(written).toBe(JSON.stringify(data));
  });

  it('throws FileOperationError when writeFile fails', async () => {
    mockWriteFile.mockRejectedValue(new Error('disk full'));

    await expect(writeJsonFile('/out/file.json', {})).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// appendToFile
// ===========================================================================
describe('appendToFile', () => {
  it('appends content to an existing file', async () => {
    mockStat.mockResolvedValue(makeStats({ isDirectory: true }));
    mockAppendFile.mockResolvedValue(undefined);

    await appendToFile('/some/dir/log.txt', 'new line\n');

    expect(mockAppendFile).toHaveBeenCalledWith('/some/dir/log.txt', 'new line\n');
  });

  it('creates and appends to a new file (directory must exist)', async () => {
    mockStat.mockRejectedValue(makeEnoent());
    mockMkdir.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);

    await appendToFile('/new/dir/log.txt', 'first line\n');

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockAppendFile).toHaveBeenCalledWith('/new/dir/log.txt', 'first line\n');
  });

  it('throws FileOperationError when appendFile fails', async () => {
    mockStat.mockResolvedValue(makeStats({ isDirectory: true }));
    mockAppendFile.mockRejectedValue(new Error('EROFS'));

    await expect(appendToFile('/ro/file.txt', 'data')).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// move
// ===========================================================================
describe('move', () => {
  it('renames the file to the destination', async () => {
    // ensureDirectory for destination parent
    mockStat.mockResolvedValue(makeStats({ isDirectory: true }));
    mockRename.mockResolvedValue(undefined);

    await move('/src/file.txt', '/dst/file.txt');

    expect(mockRename).toHaveBeenCalledWith('/src/file.txt', '/dst/file.txt');
  });

  it('throws FileOperationError when rename fails', async () => {
    mockStat.mockResolvedValue(makeStats({ isDirectory: true }));
    mockRename.mockRejectedValue(new Error('EXDEV'));

    await expect(move('/src/file.txt', '/dst/file.txt')).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// deleteFileOrDir
// ===========================================================================
describe('deleteFileOrDir', () => {
  it('deletes a regular file', async () => {
    mockStat.mockResolvedValue(makeStats({ isDirectory: false }));
    mockUnlink.mockResolvedValue(undefined);

    await deleteFileOrDir('/path/to/file.txt');

    expect(mockUnlink).toHaveBeenCalledWith('/path/to/file.txt');
  });

  it('deletes a directory recursively when recursive=true', async () => {
    mockStat.mockResolvedValue(makeStats({ isDirectory: true }));
    mockRm.mockResolvedValue(undefined);

    await deleteFileOrDir('/path/to/dir', true);

    expect(mockRm).toHaveBeenCalledWith('/path/to/dir', { recursive: true, force: true });
  });

  it('deletes an empty directory when recursive=false', async () => {
    mockStat.mockResolvedValue(makeStats({ isDirectory: true }));
    mockRmdir.mockResolvedValue(undefined);

    await deleteFileOrDir('/path/to/dir', false);

    expect(mockRmdir).toHaveBeenCalledWith('/path/to/dir');
  });

  it('silently ignores ENOENT (file not found)', async () => {
    mockStat.mockRejectedValue(makeEnoent());

    await expect(deleteFileOrDir('/non/existent/file.txt')).resolves.toBeUndefined();
  });

  it('throws FileOperationError for non-ENOENT errors', async () => {
    const err = new Error('EACCES') as NodeJS.ErrnoException;
    err.code = 'EACCES';
    mockStat.mockRejectedValue(err);

    await expect(deleteFileOrDir('/locked/file.txt')).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// createTempFile
// ===========================================================================
describe('createTempFile', () => {
  it('creates a temp file in the system temp directory and returns its path', async () => {
    mockWriteFile.mockResolvedValue(undefined);

    const tmpDir = process.env.TMPDIR || process.env.TMP || '/tmp';
    const result = await createTempFile('test', '.tmp');

    expect(result).toMatch(new RegExp(`^${tmpDir.replace(/\\/g, '\\\\')}`));
    expect(result).toMatch(/test_\d+_[a-z0-9]+\.tmp$/);
    expect(mockWriteFile).toHaveBeenCalledWith(result, '');
  });

  it('uses default prefix and suffix when none provided', async () => {
    mockWriteFile.mockResolvedValue(undefined);

    const result = await createTempFile();

    expect(result).toMatch(/temp_\d+_[a-z0-9]+\.tmp$/);
  });

  it('throws FileOperationError when writeFile fails', async () => {
    mockWriteFile.mockRejectedValue(new Error('ENOSPC'));

    await expect(createTempFile()).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// createTempDirectory
// ===========================================================================
describe('createTempDirectory', () => {
  it('creates a temp directory and returns its path', async () => {
    // ensureDirectory inside createTempDirectory: stat throws ENOENT → mkdir succeeds
    mockStat.mockRejectedValue(makeEnoent());
    mockMkdir.mockResolvedValue(undefined);

    const tmpDir = process.env.TMPDIR || process.env.TMP || '/tmp';
    const result = await createTempDirectory('myprefix');

    expect(result).toMatch(new RegExp(`^${tmpDir.replace(/\\/g, '\\\\')}`));
    expect(result).toMatch(/myprefix_\d+_[a-z0-9]+$/);
    expect(mockMkdir).toHaveBeenCalled();
  });

  it('uses default prefix when none provided', async () => {
    mockStat.mockRejectedValue(makeEnoent());
    mockMkdir.mockResolvedValue(undefined);

    const result = await createTempDirectory();

    expect(result).toMatch(/temp_\d+_[a-z0-9]+$/);
  });

  it('throws FileOperationError when mkdir fails', async () => {
    mockStat.mockRejectedValue(makeEnoent());
    mockMkdir.mockRejectedValue(new Error('ENOSPC'));

    await expect(createTempDirectory()).rejects.toThrow(FileOperationError);
  });
});

// ===========================================================================
// removeEmptyDirectories
// ===========================================================================
describe('removeEmptyDirectories', () => {
  it('removes a subdirectory that becomes empty after recursion', async () => {
    // directory contains one subdir ('sub') which is itself empty
    mockReaddir
      .mockResolvedValueOnce(['sub'])           // top-level readdir
      .mockResolvedValueOnce([])                // readdir for 'sub' (empty) — recursion
      .mockResolvedValueOnce([]);               // re-check 'sub' is empty

    const subPath = path.join('/parent', 'sub');
    mockStat.mockImplementation((p: string) => {
      if (p === subPath) return Promise.resolve(makeStats({ isDirectory: true }));
      return Promise.reject(makeEnoent());
    });
    mockRmdir.mockResolvedValue(undefined);

    await removeEmptyDirectories('/parent');

    expect(mockRmdir).toHaveBeenCalledWith(subPath);
  });

  it('skips a non-empty subdirectory', async () => {
    // directory contains one subdir ('sub') which has a file inside
    mockReaddir
      .mockResolvedValueOnce(['sub'])          // top-level readdir
      .mockResolvedValueOnce(['file.txt'])     // readdir for 'sub' — recursion
      .mockResolvedValueOnce(['file.txt']);    // re-check 'sub' — still has a file

    const subPath = path.join('/parent', 'sub');
    mockStat.mockImplementation((p: string) => {
      if (p === subPath) return Promise.resolve(makeStats({ isDirectory: true }));
      return Promise.reject(makeEnoent());
    });

    await removeEmptyDirectories('/parent');

    expect(mockRmdir).not.toHaveBeenCalled();
  });

  it('silently ignores errors during cleanup', async () => {
    mockReaddir.mockRejectedValue(new Error('EACCES'));

    // Should not throw
    await expect(removeEmptyDirectories('/locked')).resolves.toBeUndefined();
  });

  it('does nothing when directory is empty (no items to recurse into)', async () => {
    mockReaddir.mockResolvedValue([]);

    await removeEmptyDirectories('/empty');

    expect(mockRmdir).not.toHaveBeenCalled();
  });
});
