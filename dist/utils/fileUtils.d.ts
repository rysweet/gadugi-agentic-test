/**
 * File system utilities for test artifact management
 * Handles directory creation, cleanup, archiving, and file operations
 */
/**
 * File operation error class
 */
export declare class FileOperationError extends Error {
    operation: string;
    filePath?: string | undefined;
    constructor(message: string, operation: string, filePath?: string | undefined);
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
export declare class FileUtils {
    /**
     * Ensure a directory exists, creating it if necessary
     */
    static ensureDirectory(dirPath: string): Promise<void>;
    /**
     * Read a JSON file and parse it
     */
    static readJsonFile<T = any>(filePath: string): Promise<T>;
    /**
     * Write an object to a JSON file
     */
    static writeJsonFile(filePath: string, data: any, pretty?: boolean): Promise<void>;
    /**
     * Append content to a file
     */
    static appendToFile(filePath: string, content: string): Promise<void>;
    /**
     * Copy a file or directory
     */
    static copy(source: string, destination: string, overwrite?: boolean): Promise<void>;
    /**
     * Copy a directory recursively
     */
    private static copyDirectory;
    /**
     * Move/rename a file or directory
     */
    static move(source: string, destination: string): Promise<void>;
    /**
     * Delete a file or directory
     */
    static delete(filePath: string, recursive?: boolean): Promise<void>;
    /**
     * Check if file or directory exists
     */
    static exists(filePath: string): Promise<boolean>;
    /**
     * Get file metadata
     */
    static getMetadata(filePath: string): Promise<FileMetadata>;
    /**
     * Calculate file hash
     */
    static calculateHash(filePath: string, algorithm?: string): Promise<string>;
    /**
     * Find files matching patterns
     */
    static findFiles(patterns: string | string[], options?: {
        cwd?: string;
        ignore?: string[];
        absolute?: boolean;
    }): Promise<string[]>;
    /**
     * Clean up files and directories based on criteria
     */
    static cleanup(directory: string, options?: CleanupOptions): Promise<{
        deletedFiles: string[];
        deletedDirectories: string[];
        totalSize: number;
        errors: Array<{
            path: string;
            error: string;
        }>;
    }>;
    /**
     * Create a backup of a file or directory
     */
    static backup(source: string, backupDir?: string): Promise<string>;
    /**
     * Synchronize directories
     */
    static sync(source: string, destination: string, options?: SyncOptions): Promise<{
        copied: string[];
        updated: string[];
        deleted: string[];
        errors: Array<{
            path: string;
            error: string;
        }>;
    }>;
    /**
     * Get directory size recursively
     */
    static getDirectorySize(directory: string): Promise<number>;
    /**
     * Create a temporary file
     */
    static createTempFile(prefix?: string, suffix?: string): Promise<string>;
    /**
     * Create a temporary directory
     */
    static createTempDirectory(prefix?: string): Promise<string>;
    /**
     * Filter files by age
     */
    private static filterByAge;
    /**
     * Filter files by patterns
     */
    private static filterByPatterns;
    /**
     * Remove empty directories recursively
     */
    private static removeEmptyDirectories;
}
/**
 * Convenience functions for common operations
 */
/**
 * Ensure directory exists
 */
export declare function ensureDir(dirPath: string): Promise<void>;
/**
 * Read JSON file
 */
export declare function readJson<T = any>(filePath: string): Promise<T>;
/**
 * Write JSON file
 */
export declare function writeJson(filePath: string, data: any, pretty?: boolean): Promise<void>;
/**
 * Check if file exists
 */
export declare function exists(filePath: string): Promise<boolean>;
/**
 * Delete file or directory
 */
export declare function remove(filePath: string, recursive?: boolean): Promise<void>;
/**
 * Copy file or directory
 */
export declare function copy(source: string, destination: string, overwrite?: boolean): Promise<void>;
/**
 * Find files matching patterns
 */
export declare function findFiles(patterns: string | string[], cwd?: string): Promise<string[]>;
//# sourceMappingURL=fileUtils.d.ts.map