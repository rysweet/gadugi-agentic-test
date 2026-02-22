/**
 * File system utilities for test artifact management
 * Handles directory creation, cleanup, archiving, and file operations
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';

/**
 * File operation error class
 */
export class FileOperationError extends Error {
  constructor(message: string, public operation: string, public filePath?: string) {
    super(message);
    this.name = 'FileOperationError';
  }
}

/**
 * File metadata interface
 */
export interface FileMetadata {
  /** File path */
  filePath: string;
  /** File name */
  fileName: string;
  /** File size in bytes */
  size: number;
  /** Creation time */
  createdAt: Date;
  /** Last modification time */
  modifiedAt: Date;
  /** File extension */
  extension: string;
  /** MIME type (if determinable) */
  mimeType?: string;
  /** File hash for integrity checking */
  hash?: string;
  /** Whether file is directory */
  isDirectory: boolean;
  /** File permissions */
  permissions?: string;
}

/**
 * Directory cleanup options
 */
export interface CleanupOptions {
  /** Maximum age of files to keep in milliseconds */
  maxAge?: number;
  /** File patterns to include in cleanup (glob patterns) */
  includePatterns?: string[];
  /** File patterns to exclude from cleanup */
  excludePatterns?: string[];
  /** Whether to remove empty directories after cleanup */
  removeEmptyDirs?: boolean;
  /** Dry run mode - don't actually delete anything */
  dryRun?: boolean;
  /** Maximum number of files to delete */
  maxFiles?: number;
}

/**
 * Archive options
 */
export interface ArchiveOptions {
  /** Archive format */
  format: 'zip' | 'tar' | 'tar.gz';
  /** Compression level (0-9 for gzip) */
  compressionLevel?: number;
  /** Whether to include directory structure */
  preservePaths?: boolean;
  /** Files to exclude from archive */
  exclude?: string[];
  /** Base directory for relative paths */
  baseDir?: string;
}

/**
 * Directory synchronization options
 */
export interface SyncOptions {
  /** Whether to delete files in destination not in source */
  deleteExtra?: boolean;
  /** Whether to preserve timestamps */
  preserveTimestamps?: boolean;
  /** Files to exclude from sync */
  exclude?: string[];
  /** Whether to use checksums for comparison */
  useChecksum?: boolean;
}

/**
 * File system utility class
 */
export class FileUtils {
  /**
   * Ensure a directory exists, creating it if necessary
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new FileOperationError(
          `Path exists but is not a directory: ${dirPath}`,
          'ensureDirectory',
          dirPath
        );
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        try {
          await fs.mkdir(dirPath, { recursive: true });
        } catch (mkdirError: unknown) {
          throw new FileOperationError(
            `Failed to create directory: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`,
            'ensureDirectory',
            dirPath
          );
        }
      } else if (!(error instanceof FileOperationError)) {
        throw new FileOperationError(
          `Failed to check directory: ${error instanceof Error ? error.message : String(error)}`,
          'ensureDirectory',
          dirPath
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Read a JSON file and parse it
   */
  static async readJsonFile<T = any>(filePath: string): Promise<T> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to read JSON file: ${error instanceof Error ? error.message : String(error)}`,
        'readJsonFile',
        filePath
      );
    }
  }

  /**
   * Write an object to a JSON file
   */
  static async writeJsonFile(filePath: string, data: any, pretty: boolean = true): Promise<void> {
    try {
      await this.ensureDirectory(path.dirname(filePath));
      const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to write JSON file: ${error instanceof Error ? error.message : String(error)}`,
        'writeJsonFile',
        filePath
      );
    }
  }

  /**
   * Append content to a file
   */
  static async appendToFile(filePath: string, content: string): Promise<void> {
    try {
      await this.ensureDirectory(path.dirname(filePath));
      await fs.appendFile(filePath, content);
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to append to file: ${error instanceof Error ? error.message : String(error)}`,
        'appendToFile',
        filePath
      );
    }
  }

  /**
   * Copy a file or directory
   */
  static async copy(source: string, destination: string, overwrite: boolean = true): Promise<void> {
    try {
      await this.ensureDirectory(path.dirname(destination));
      
      const stats = await fs.stat(source);
      
      if (stats.isDirectory()) {
        await this.copyDirectory(source, destination, overwrite);
      } else {
        if (!overwrite && await this.exists(destination)) {
          throw new FileOperationError(
            `Destination file already exists: ${destination}`,
            'copy',
            destination
          );
        }
        await fs.copyFile(source, destination);
      }
    } catch (error: unknown) {
      if (!(error instanceof FileOperationError)) {
        throw new FileOperationError(
          `Failed to copy: ${error instanceof Error ? error.message : String(error)}`,
          'copy',
          source
        );
      }
      throw error;
    }
  }

  /**
   * Copy a directory recursively
   */
  private static async copyDirectory(source: string, destination: string, overwrite: boolean): Promise<void> {
    await this.ensureDirectory(destination);
    
    const items = await fs.readdir(source);
    
    for (const item of items) {
      const srcPath = path.join(source, item);
      const destPath = path.join(destination, item);
      
      const stats = await fs.stat(srcPath);
      
      if (stats.isDirectory()) {
        await this.copyDirectory(srcPath, destPath, overwrite);
      } else {
        if (!overwrite && await this.exists(destPath)) {
          continue;
        }
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Move/rename a file or directory
   */
  static async move(source: string, destination: string): Promise<void> {
    try {
      await this.ensureDirectory(path.dirname(destination));
      await fs.rename(source, destination);
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to move: ${error instanceof Error ? error.message : String(error)}`,
        'move',
        source
      );
    }
  }

  /**
   * Delete a file or directory
   */
  static async delete(filePath: string, recursive: boolean = false): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        if (recursive) {
          await fs.rm(filePath, { recursive: true, force: true });
        } else {
          await fs.rmdir(filePath);
        }
      } else {
        await fs.unlink(filePath);
      }
    } catch (error: unknown) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw new FileOperationError(
          `Failed to delete: ${error instanceof Error ? error.message : String(error)}`,
          'delete',
          filePath
        );
      }
    }
  }

  /**
   * Check if file or directory exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  static async getMetadata(filePath: string): Promise<FileMetadata> {
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const extension = path.extname(fileName).toLowerCase();
      
      return {
        filePath,
        fileName,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        extension,
        isDirectory: stats.isDirectory(),
        permissions: stats.mode.toString(8).slice(-3)
      };
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to get metadata: ${error instanceof Error ? error.message : String(error)}`,
        'getMetadata',
        filePath
      );
    }
  }

  /**
   * Calculate file hash
   */
  static async calculateHash(filePath: string, algorithm: string = 'md5'): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      return crypto.createHash(algorithm).update(buffer).digest('hex');
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to calculate hash: ${error instanceof Error ? error.message : String(error)}`,
        'calculateHash',
        filePath
      );
    }
  }

  /**
   * Find files matching patterns
   */
  static async findFiles(patterns: string | string[], options?: {
    cwd?: string;
    ignore?: string[];
    absolute?: boolean;
  }): Promise<string[]> {
    try {
      const globPatterns = Array.isArray(patterns) ? patterns : [patterns];
      const results: string[] = [];
      
      for (const pattern of globPatterns) {
        const matches = await glob(pattern, {
          cwd: options?.cwd,
          ignore: options?.ignore,
          absolute: options?.absolute ?? true
        });
        results.push(...matches);
      }
      
      // Remove duplicates
      return [...new Set(results)];
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to find files: ${error instanceof Error ? error.message : String(error)}`,
        'findFiles'
      );
    }
  }

  /**
   * Clean up files and directories based on criteria
   */
  static async cleanup(directory: string, options: CleanupOptions = {}): Promise<{
    deletedFiles: string[];
    deletedDirectories: string[];
    totalSize: number;
    errors: Array<{ path: string; error: string }>;
  }> {
    const result = {
      deletedFiles: [] as string[],
      deletedDirectories: [] as string[],
      totalSize: 0,
      errors: [] as Array<{ path: string; error: string }>
    };

    try {
      if (!await this.exists(directory)) {
        return result;
      }

      const files = await this.findFiles(
        options.includePatterns || ['**/*'],
        { cwd: directory, absolute: true }
      );

      // Security fix (issue #106): verify every resolved path is inside
      // the target directory.  Patterns like '../../secrets/**' can resolve
      // outside the intended directory; we must reject those paths to
      // prevent unintended deletion of files outside the cleanup scope.
      const safeDirectory = path.resolve(directory);
      const safeSeparator = safeDirectory.endsWith(path.sep)
        ? safeDirectory
        : safeDirectory + path.sep;

      const safeFiles = files.filter(f => {
        const resolved = path.resolve(f);
        // Accept paths that are exactly the directory itself or start with it
        return resolved === safeDirectory || resolved.startsWith(safeSeparator);
      });

      let filesToDelete = safeFiles;

      // Filter by age if specified
      if (options.maxAge) {
        const cutoffTime = Date.now() - options.maxAge;
        filesToDelete = await this.filterByAge(filesToDelete, cutoffTime);
      }

      // Apply exclude patterns
      if (options.excludePatterns) {
        filesToDelete = await this.filterByPatterns(filesToDelete, options.excludePatterns, true);
      }

      // Limit number of files if specified
      if (options.maxFiles && filesToDelete.length > options.maxFiles) {
        filesToDelete = filesToDelete.slice(0, options.maxFiles);
      }

      // Delete files
      for (const filePath of filesToDelete) {
        try {
          if (options.dryRun) {
            const stats = await fs.stat(filePath);
            result.totalSize += stats.size;
            if (stats.isDirectory()) {
              result.deletedDirectories.push(filePath);
            } else {
              result.deletedFiles.push(filePath);
            }
          } else {
            const stats = await fs.stat(filePath);
            result.totalSize += stats.size;
            
            await this.delete(filePath, true);
            
            if (stats.isDirectory()) {
              result.deletedDirectories.push(filePath);
            } else {
              result.deletedFiles.push(filePath);
            }
          }
        } catch (error: unknown) {
          result.errors.push({
            path: filePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Remove empty directories if requested
      if (options.removeEmptyDirs && !options.dryRun) {
        await this.removeEmptyDirectories(directory);
      }

    } catch (error: unknown) {
      throw new FileOperationError(
        `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        'cleanup',
        directory
      );
    }

    return result;
  }

  /**
   * Create a backup of a file or directory
   */
  static async backup(source: string, backupDir?: string): Promise<string> {
    try {
      if (!backupDir) {
        backupDir = path.join(path.dirname(source), 'backups');
      }

      await this.ensureDirectory(backupDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const sourceName = path.basename(source);
      const backupName = `${sourceName}.backup.${timestamp}`;
      const backupPath = path.join(backupDir, backupName);

      await this.copy(source, backupPath);
      return backupPath;

    } catch (error: unknown) {
      throw new FileOperationError(
        `Backup failed: ${error instanceof Error ? error.message : String(error)}`,
        'backup',
        source
      );
    }
  }

  /**
   * Synchronize directories
   */
  static async sync(source: string, destination: string, options: SyncOptions = {}): Promise<{
    copied: string[];
    updated: string[];
    deleted: string[];
    errors: Array<{ path: string; error: string }>;
  }> {
    const result = {
      copied: [] as string[],
      updated: [] as string[],
      deleted: [] as string[],
      errors: [] as Array<{ path: string; error: string }>
    };

    try {
      await this.ensureDirectory(destination);

      // Get source files
      const sourceFiles = await this.findFiles('**/*', { cwd: source, absolute: false });
      
      // Filter by exclude patterns
      const filteredSourceFiles = options.exclude 
        ? await this.filterByPatterns(sourceFiles, options.exclude, true)
        : sourceFiles;

      // Process each source file
      for (const relativePath of filteredSourceFiles) {
        const sourcePath = path.join(source, relativePath);
        const destPath = path.join(destination, relativePath);

        try {
          if (await this.exists(destPath)) {
            // File exists, check if update needed
            const sourceStats = await fs.stat(sourcePath);
            const destStats = await fs.stat(destPath);

            let needsUpdate = false;

            if (options.useChecksum) {
              const sourceHash = await this.calculateHash(sourcePath);
              const destHash = await this.calculateHash(destPath);
              needsUpdate = sourceHash !== destHash;
            } else {
              needsUpdate = sourceStats.mtime > destStats.mtime;
            }

            if (needsUpdate) {
              await this.copy(sourcePath, destPath);
              result.updated.push(relativePath);
            }
          } else {
            // File doesn't exist, copy it
            await this.copy(sourcePath, destPath);
            result.copied.push(relativePath);
          }
        } catch (error: unknown) {
          result.errors.push({
            path: relativePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Handle deletion of extra files
      if (options.deleteExtra) {
        const destFiles = await this.findFiles('**/*', { cwd: destination, absolute: false });
        const extraFiles = destFiles.filter(f => !filteredSourceFiles.includes(f));

        for (const extraFile of extraFiles) {
          try {
            const extraPath = path.join(destination, extraFile);
            await this.delete(extraPath, true);
            result.deleted.push(extraFile);
          } catch (error: unknown) {
            result.errors.push({
              path: extraFile,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

    } catch (error: unknown) {
      throw new FileOperationError(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        'sync',
        source
      );
    }

    return result;
  }

  /**
   * Get directory size recursively
   */
  static async getDirectorySize(directory: string): Promise<number> {
    let totalSize = 0;

    try {
      const files = await this.findFiles('**/*', { cwd: directory, absolute: true });
      
      for (const filePath of files) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch {
          // Skip files that can't be accessed
        }
      }
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to get directory size: ${error instanceof Error ? error.message : String(error)}`,
        'getDirectorySize',
        directory
      );
    }

    return totalSize;
  }

  /**
   * Create a temporary file
   */
  static async createTempFile(prefix: string = 'temp', suffix: string = '.tmp'): Promise<string> {
    const tempDir = process.env.TMPDIR || process.env.TMP || '/tmp';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${prefix}_${timestamp}_${random}${suffix}`;
    const tempPath = path.join(tempDir, fileName);

    try {
      await fs.writeFile(tempPath, '');
      return tempPath;
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to create temp file: ${error instanceof Error ? error.message : String(error)}`,
        'createTempFile',
        tempPath
      );
    }
  }

  /**
   * Create a temporary directory
   */
  static async createTempDirectory(prefix: string = 'temp'): Promise<string> {
    const tempDir = process.env.TMPDIR || process.env.TMP || '/tmp';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const dirName = `${prefix}_${timestamp}_${random}`;
    const tempPath = path.join(tempDir, dirName);

    try {
      await this.ensureDirectory(tempPath);
      return tempPath;
    } catch (error: unknown) {
      throw new FileOperationError(
        `Failed to create temp directory: ${error instanceof Error ? error.message : String(error)}`,
        'createTempDirectory',
        tempPath
      );
    }
  }

  /**
   * Filter files by age
   */
  private static async filterByAge(files: string[], cutoffTime: number): Promise<string[]> {
    const filtered: string[] = [];
    
    for (const filePath of files) {
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < cutoffTime) {
          filtered.push(filePath);
        }
      } catch {
        // Skip files that can't be accessed
      }
    }
    
    return filtered;
  }

  /**
   * Convert a glob pattern to a RegExp safely.
   *
   * Security: user-supplied patterns must have all regex metacharacters
   * escaped before wildcard substitution, otherwise an attacker can inject
   * a ReDoS-prone pattern such as `(a+)+` via a YAML config file.
   *
   * Escaping order matters:
   *   1. Escape the backslash first (it is the escape character itself).
   *   2. Escape every other regex metacharacter as a literal.
   *   3. Replace glob wildcards (* and ?) with their regex equivalents.
   */
  private static globToRegex(glob: string): RegExp {
    const escaped = glob
      // Step 1: escape backslashes first so later replacements are not affected
      .replace(/\\/g, '\\\\')
      // Step 2: escape all other regex metacharacters except * and ?
      //         (which are the glob wildcards we intentionally convert below)
      .replace(/[.+^${}()|[\]]/g, '\\$&')
      // Step 3: convert glob wildcards to regex equivalents
      .replace(/\*/g, '.*')   // * matches any sequence of characters
      .replace(/\?/g, '.');   // ? matches exactly one character
    // Anchor to the full string so 'foo.txt' does not match 'bar/foo.txt'
    // when used as a simple name-only pattern.
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Filter files by patterns
   *
   * Security fix (issue #106): patterns are now converted to RegExp via
   * globToRegex() which escapes all metacharacters before substituting
   * wildcards, preventing ReDoS through user-supplied config patterns.
   */
  private static async filterByPatterns(files: string[], patterns: string[], exclude: boolean): Promise<string[]> {
    // Pre-compile all regexes outside the inner loop; globToRegex() safely
    // escapes metacharacters so no user input reaches the RegExp engine raw.
    const regexes = patterns.map(p => FileUtils.globToRegex(p));

    return files.filter(filePath => {
      const fileName = path.basename(filePath);
      // Match against both the full path and the file name so that patterns
      // like '*.log' work for both '/tmp/foo.log' and 'foo.log' inputs.
      const matches = regexes.some(re => re.test(filePath) || re.test(fileName));
      return exclude ? !matches : matches;
    });
  }

  /**
   * Remove empty directories recursively
   */
  private static async removeEmptyDirectories(directory: string): Promise<void> {
    try {
      const items = await fs.readdir(directory);
      
      for (const item of items) {
        const itemPath = path.join(directory, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await this.removeEmptyDirectories(itemPath);
          
          // Check if directory is now empty
          const remainingItems = await fs.readdir(itemPath);
          if (remainingItems.length === 0) {
            await fs.rmdir(itemPath);
          }
        }
      }
    } catch {
      // Ignore errors when removing empty directories
    }
  }
}

/**
 * Convenience functions for common operations
 */

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  return FileUtils.ensureDirectory(dirPath);
}

/**
 * Read JSON file
 */
export async function readJson<T = any>(filePath: string): Promise<T> {
  return FileUtils.readJsonFile<T>(filePath);
}

/**
 * Write JSON file
 */
export async function writeJson(filePath: string, data: any, pretty: boolean = true): Promise<void> {
  return FileUtils.writeJsonFile(filePath, data, pretty);
}

/**
 * Check if file exists
 */
export async function exists(filePath: string): Promise<boolean> {
  return FileUtils.exists(filePath);
}

/**
 * Delete file or directory
 */
export async function remove(filePath: string, recursive: boolean = false): Promise<void> {
  return FileUtils.delete(filePath, recursive);
}

/**
 * Copy file or directory
 */
export async function copy(source: string, destination: string, overwrite: boolean = true): Promise<void> {
  return FileUtils.copy(source, destination, overwrite);
}

/**
 * Find files matching patterns
 */
export async function findFiles(patterns: string | string[], cwd?: string): Promise<string[]> {
  return FileUtils.findFiles(patterns, { cwd, absolute: true });
}