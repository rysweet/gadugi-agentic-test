/**
 * File system utilities - backward-compatible re-export facade
 *
 * Implementation has been split into focused sub-modules in src/utils/files/:
 *   - FileReader.ts  - Read operations (readJsonFile, exists, getMetadata)
 *   - FileWriter.ts  - Write operations (ensureDirectory, writeJsonFile, move, delete, temp files)
 *   - FileSearch.ts  - File discovery (findFiles, calculateHash, filterByAge)
 *   - FileArchiver.ts - Archive/copy/backup/sync/cleanup operations
 *
 * The FileUtils class (static API) and all types are preserved for backward compatibility.
 * Duplicate standalone convenience functions (ensureDir, readJson, writeJson, exists,
 * remove, copy, findFiles) have been removed - use FileUtils static methods directly.
 *
 * Standalone helpers (added for issue #118):
 *   - validateDirectory(path) - verifies a path exists and is a directory
 */

// Re-export all types
export type { FileMetadata, CleanupOptions, ArchiveOptions, SyncOptions } from './files/types';
export { FileOperationError } from './files/types';

import * as fsPromises from 'fs/promises';

// Import sub-modules for FileUtils class composition
import {
  FileMetadata,
  CleanupOptions,
  SyncOptions
} from './files/types';

/**
 * Verify that `dirPath` exists and is a directory.
 *
 * Shared by TUIAgent and CLIAgent (issue #118). Throws a descriptive Error on
 * failure so callers can wrap it in a single try/catch inside `initialize()`.
 *
 * @throws Error when the path does not exist or is not a directory
 */
export async function validateDirectory(dirPath: string): Promise<void> {
  try {
    await fsPromises.access(dirPath);
  } catch (error: unknown) {
    // In some environments (e.g. Jest/ts-jest sandboxed VM) Node's native
    // errors fail `instanceof Error`, so check `.code` directly.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Working directory does not exist: ${dirPath}`);
    }
    throw error;
  }
  const stats = await fsPromises.stat(dirPath);
  if (!stats.isDirectory()) {
    throw new Error(`Working directory is not a directory: ${dirPath}`);
  }
}
import { readJsonFile, exists, getMetadata } from './files/FileReader';
import {
  ensureDirectory,
  writeJsonFile,
  appendToFile,
  move,
  deleteFileOrDir,
  createTempFile,
  createTempDirectory
} from './files/FileWriter';
import { findFiles, calculateHash, filterByPatterns } from './files/FileSearch';
import { copy, backup, cleanup, sync } from './files/FileArchiver';

/**
 * File system utility class - backward-compatible static API.
 * Delegates to focused sub-modules in src/utils/files/.
 */
export class FileUtils {
  static async ensureDirectory(dirPath: string): Promise<void> {
    return ensureDirectory(dirPath);
  }

  static async readJsonFile<T = any>(filePath: string): Promise<T> {
    return readJsonFile<T>(filePath);
  }

  static async writeJsonFile(filePath: string, data: any, pretty: boolean = true): Promise<void> {
    return writeJsonFile(filePath, data, pretty);
  }

  static async appendToFile(filePath: string, content: string): Promise<void> {
    return appendToFile(filePath, content);
  }

  static async copy(source: string, destination: string, overwrite: boolean = true): Promise<void> {
    return copy(source, destination, overwrite);
  }

  static async move(source: string, destination: string): Promise<void> {
    return move(source, destination);
  }

  static async delete(filePath: string, recursive: boolean = false): Promise<void> {
    return deleteFileOrDir(filePath, recursive);
  }

  static async exists(filePath: string): Promise<boolean> {
    return exists(filePath);
  }

  static async getMetadata(filePath: string): Promise<FileMetadata> {
    return getMetadata(filePath);
  }

  static async calculateHash(filePath: string, algorithm: string = 'md5'): Promise<string> {
    return calculateHash(filePath, algorithm);
  }

  static async findFiles(
    patterns: string | string[],
    options?: { cwd?: string; ignore?: string[]; absolute?: boolean }
  ): Promise<string[]> {
    return findFiles(patterns, options);
  }

  static async cleanup(
    directory: string,
    options: CleanupOptions = {}
  ): Promise<{
    deletedFiles: string[];
    deletedDirectories: string[];
    totalSize: number;
    errors: Array<{ path: string; error: string }>;
  }> {
    return cleanup(directory, options);
  }

  static async backup(source: string, backupDir?: string): Promise<string> {
    return backup(source, backupDir);
  }

  static async sync(
    source: string,
    destination: string,
    options: SyncOptions = {}
  ): Promise<{
    copied: string[];
    updated: string[];
    deleted: string[];
    errors: Array<{ path: string; error: string }>;
  }> {
    return sync(source, destination, options);
  }

  static async getDirectorySize(directory: string): Promise<number> {
    const files = await findFiles('**/*', { cwd: directory, absolute: true });
    let totalSize = 0;
    for (const filePath of files) {
      try {
        const meta = await getMetadata(filePath);
        if (!meta.isDirectory) {
          totalSize += meta.size;
        }
      } catch {
        // Skip files that can't be accessed
      }
    }
    return totalSize;
  }

  static async createTempFile(prefix: string = 'temp', suffix: string = '.tmp'): Promise<string> {
    return createTempFile(prefix, suffix);
  }

  static async createTempDirectory(prefix: string = 'temp'): Promise<string> {
    return createTempDirectory(prefix);
  }

  /**
   * Filter a list of file paths by glob patterns.
   * When exclude=true, returns files that do NOT match any pattern.
   * When exclude=false, returns files that match at least one pattern.
   */
  static filterByPatterns(files: string[], patterns: string[], exclude: boolean): string[] {
    return filterByPatterns(files, patterns, exclude);
  }
}
