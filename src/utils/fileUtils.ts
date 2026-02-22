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
 */

// Re-export all types
export type { FileMetadata, CleanupOptions, ArchiveOptions, SyncOptions } from './files/types';
export { FileOperationError } from './files/types';

// Import sub-modules for FileUtils class composition
import {
  FileOperationError,
  FileMetadata,
  CleanupOptions,
  SyncOptions
} from './files/types';
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
import { findFiles, calculateHash } from './files/FileSearch';
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
}
