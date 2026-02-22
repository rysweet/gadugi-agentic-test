/**
 * FileReader - Read operations for file system utilities
 */

import fs from 'fs/promises';
import path from 'path';
import { FileOperationError, FileMetadata } from './types';

/**
 * Read a JSON file and parse it
 */
export async function readJsonFile<T = any>(filePath: string): Promise<T> {
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
 * Check if file or directory exists
 */
export async function exists(filePath: string): Promise<boolean> {
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
export async function getMetadata(filePath: string): Promise<FileMetadata> {
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
 * Get directory size recursively
 */
export async function getDirectorySize(directory: string, findFiles: (patterns: string | string[], options?: { cwd?: string; ignore?: string[]; absolute?: boolean }) => Promise<string[]>): Promise<number> {
  let totalSize = 0;

  try {
    const files = await findFiles('**/*', { cwd: directory, absolute: true });

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
