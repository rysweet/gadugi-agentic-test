/**
 * FileWriter - Write operations for file system utilities
 */

import fs from 'fs/promises';
import path from 'path';
import { FileOperationError } from './types';

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
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
 * Write an object to a JSON file
 */
export async function writeJsonFile(filePath: string, data: any, pretty: boolean = true): Promise<void> {
  try {
    await ensureDirectory(path.dirname(filePath));
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error: unknown) {
    if (error instanceof FileOperationError) throw error;
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
export async function appendToFile(filePath: string, content: string): Promise<void> {
  try {
    await ensureDirectory(path.dirname(filePath));
    await fs.appendFile(filePath, content);
  } catch (error: unknown) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Failed to append to file: ${error instanceof Error ? error.message : String(error)}`,
      'appendToFile',
      filePath
    );
  }
}

/**
 * Move/rename a file or directory
 */
export async function move(source: string, destination: string): Promise<void> {
  try {
    await ensureDirectory(path.dirname(destination));
    await fs.rename(source, destination);
  } catch (error: unknown) {
    if (error instanceof FileOperationError) throw error;
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
export async function deleteFileOrDir(filePath: string, recursive: boolean = false): Promise<void> {
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
 * Create a temporary file
 */
export async function createTempFile(prefix: string = 'temp', suffix: string = '.tmp'): Promise<string> {
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
export async function createTempDirectory(prefix: string = 'temp'): Promise<string> {
  const tempDir = process.env.TMPDIR || process.env.TMP || '/tmp';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const dirName = `${prefix}_${timestamp}_${random}`;
  const tempPath = path.join(tempDir, dirName);

  try {
    await ensureDirectory(tempPath);
    return tempPath;
  } catch (error: unknown) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Failed to create temp directory: ${error instanceof Error ? error.message : String(error)}`,
      'createTempDirectory',
      tempPath
    );
  }
}

/**
 * Remove empty directories recursively
 */
export async function removeEmptyDirectories(directory: string): Promise<void> {
  try {
    const items = await fs.readdir(directory);

    for (const item of items) {
      const itemPath = path.join(directory, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        await removeEmptyDirectories(itemPath);

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
