/**
 * FileArchiver - Archive, copy, backup and sync operations
 */

import fs from 'fs/promises';
import path from 'path';
import { FileOperationError, CleanupOptions, SyncOptions } from './types';
import { ensureDirectory, deleteFileOrDir, removeEmptyDirectories } from './FileWriter';
import { exists } from './FileReader';
import { findFiles, calculateHash, filterByAge, filterByPatterns } from './FileSearch';


/**
 * Copy a file or directory
 */
export async function copy(source: string, destination: string, overwrite: boolean = true): Promise<void> {
  try {
    await ensureDirectory(path.dirname(destination));

    const stats = await fs.stat(source);

    if (stats.isDirectory()) {
      await copyDirectory(source, destination, overwrite);
    } else {
      if (!overwrite && await exists(destination)) {
        throw new FileOperationError(
          `Destination file already exists: ${destination}`,
          'copy',
          destination
        );
      }
      await fs.copyFile(source, destination);
    }
  } catch (error: unknown) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Failed to copy: ${error instanceof Error ? error.message : String(error)}`,
      'copy',
      source
    );
  }
}

/**
 * Copy a directory recursively
 */
async function copyDirectory(source: string, destination: string, overwrite: boolean): Promise<void> {
  await ensureDirectory(destination);

  const items = await fs.readdir(source);

  for (const item of items) {
    const srcPath = path.join(source, item);
    const destPath = path.join(destination, item);

    const stats = await fs.stat(srcPath);

    if (stats.isDirectory()) {
      await copyDirectory(srcPath, destPath, overwrite);
    } else {
      if (!overwrite && await exists(destPath)) {
        continue;
      }
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Create a backup of a file or directory
 */
export async function backup(source: string, backupDir?: string): Promise<string> {
  try {
    if (!backupDir) {
      backupDir = path.join(path.dirname(source), 'backups');
    }

    await ensureDirectory(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const sourceName = path.basename(source);
    const backupName = `${sourceName}.backup.${timestamp}`;
    const backupPath = path.join(backupDir, backupName);

    await copy(source, backupPath);
    return backupPath;
  } catch (error: unknown) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Backup failed: ${error instanceof Error ? error.message : String(error)}`,
      'backup',
      source
    );
  }
}

/**
 * Clean up files and directories based on criteria
 */
export async function cleanup(directory: string, options: CleanupOptions = {}): Promise<{
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
    if (!await exists(directory)) {
      return result;
    }

    const files = await findFiles(
      options.includePatterns || ['**/*'],
      { cwd: directory, absolute: true }
    );

    // Security fix (issue #106): verify every resolved path is inside
    // the target directory. Patterns like '../../secrets/**' can resolve
    // outside the intended directory; we must reject those paths to
    // prevent unintended deletion of files outside the cleanup scope.
    const safeDirectory = path.resolve(directory);
    const safeSeparator = safeDirectory.endsWith(path.sep)
      ? safeDirectory
      : safeDirectory + path.sep;

    const safeFiles = files.filter(f => {
      const resolved = path.resolve(f);
      return resolved === safeDirectory || resolved.startsWith(safeSeparator);
    });

    let filesToDelete = safeFiles;

    // Filter by age if specified
    if (options.maxAge) {
      const cutoffTime = Date.now() - options.maxAge;
      filesToDelete = await filterByAge(filesToDelete, cutoffTime);
    }

    // Apply exclude patterns
    if (options.excludePatterns) {
      filesToDelete = filterByPatterns(filesToDelete, options.excludePatterns, true);
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

          await deleteFileOrDir(filePath, true);

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
      await removeEmptyDirectories(directory);
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
 * Synchronize directories
 */
export async function sync(source: string, destination: string, options: SyncOptions = {}): Promise<{
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
    await ensureDirectory(destination);

    // Get source files
    const sourceFiles = await findFiles('**/*', { cwd: source, absolute: false });

    // Filter by exclude patterns
    const filteredSourceFiles = options.exclude
      ? filterByPatterns(sourceFiles, options.exclude, true)
      : sourceFiles;

    // Process each source file
    for (const relativePath of filteredSourceFiles) {
      const sourcePath = path.join(source, relativePath);
      const destPath = path.join(destination, relativePath);

      try {
        if (await exists(destPath)) {
          // File exists, check if update needed
          const sourceStats = await fs.stat(sourcePath);
          const destStats = await fs.stat(destPath);

          let needsUpdate = false;

          if (options.useChecksum) {
            const sourceHash = await calculateHash(sourcePath);
            const destHash = await calculateHash(destPath);
            needsUpdate = sourceHash !== destHash;
          } else {
            needsUpdate = sourceStats.mtime > destStats.mtime;
          }

          if (needsUpdate) {
            await copy(sourcePath, destPath);
            result.updated.push(relativePath);
          }
        } else {
          // File doesn't exist, copy it
          await copy(sourcePath, destPath);
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
      const destFiles = await findFiles('**/*', { cwd: destination, absolute: false });
      const extraFiles = destFiles.filter(f => !filteredSourceFiles.includes(f));

      for (const extraFile of extraFiles) {
        try {
          const extraPath = path.join(destination, extraFile);
          await deleteFileOrDir(extraPath, true);
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
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
      'sync',
      source
    );
  }

  return result;
}
