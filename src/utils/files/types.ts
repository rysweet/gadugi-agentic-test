/**
 * Shared types for file utilities
 */

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
