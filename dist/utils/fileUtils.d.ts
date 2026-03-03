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
export type { FileMetadata, CleanupOptions, ArchiveOptions, SyncOptions } from './files/types';
export { FileOperationError } from './files/types';
import { FileMetadata, CleanupOptions, SyncOptions } from './files/types';
/**
 * Verify that `dirPath` exists and is a directory.
 *
 * Shared by TUIAgent and CLIAgent (issue #118). Throws a descriptive Error on
 * failure so callers can wrap it in a single try/catch inside `initialize()`.
 *
 * @throws Error when the path does not exist or is not a directory
 */
export declare function validateDirectory(dirPath: string): Promise<void>;
/**
 * File system utility class - backward-compatible static API.
 * Delegates to focused sub-modules in src/utils/files/.
 */
export declare class FileUtils {
    static ensureDirectory(dirPath: string): Promise<void>;
    static readJsonFile<T = any>(filePath: string): Promise<T>;
    static writeJsonFile(filePath: string, data: unknown, pretty?: boolean): Promise<void>;
    static appendToFile(filePath: string, content: string): Promise<void>;
    static copy(source: string, destination: string, overwrite?: boolean): Promise<void>;
    static move(source: string, destination: string): Promise<void>;
    static delete(filePath: string, recursive?: boolean): Promise<void>;
    static exists(filePath: string): Promise<boolean>;
    static getMetadata(filePath: string): Promise<FileMetadata>;
    static calculateHash(filePath: string, algorithm?: string): Promise<string>;
    static findFiles(patterns: string | string[], options?: {
        cwd?: string;
        ignore?: string[];
        absolute?: boolean;
    }): Promise<string[]>;
    static cleanup(directory: string, options?: CleanupOptions): Promise<{
        deletedFiles: string[];
        deletedDirectories: string[];
        totalSize: number;
        errors: Array<{
            path: string;
            error: string;
        }>;
    }>;
    static backup(source: string, backupDir?: string): Promise<string>;
    static sync(source: string, destination: string, options?: SyncOptions): Promise<{
        copied: string[];
        updated: string[];
        deleted: string[];
        errors: Array<{
            path: string;
            error: string;
        }>;
    }>;
    static getDirectorySize(directory: string): Promise<number>;
    static createTempFile(prefix?: string, suffix?: string): Promise<string>;
    static createTempDirectory(prefix?: string): Promise<string>;
    /**
     * Filter a list of file paths by glob patterns.
     * When exclude=true, returns files that do NOT match any pattern.
     * When exclude=false, returns files that match at least one pattern.
     */
    static filterByPatterns(files: string[], patterns: string[], exclude: boolean): string[];
}
//# sourceMappingURL=fileUtils.d.ts.map