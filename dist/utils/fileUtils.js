"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUtils = exports.FileOperationError = void 0;
exports.validateDirectory = validateDirectory;
var types_1 = require("./files/types");
Object.defineProperty(exports, "FileOperationError", { enumerable: true, get: function () { return types_1.FileOperationError; } });
const fsPromises = __importStar(require("fs/promises"));
/**
 * Verify that `dirPath` exists and is a directory.
 *
 * Shared by TUIAgent and CLIAgent (issue #118). Throws a descriptive Error on
 * failure so callers can wrap it in a single try/catch inside `initialize()`.
 *
 * @throws Error when the path does not exist or is not a directory
 */
async function validateDirectory(dirPath) {
    try {
        await fsPromises.access(dirPath);
    }
    catch (error) {
        // In some environments (e.g. Jest/ts-jest sandboxed VM) Node's native
        // errors fail `instanceof Error`, so check `.code` directly.
        if (error.code === 'ENOENT') {
            throw new Error(`Working directory does not exist: ${dirPath}`);
        }
        throw error;
    }
    const stats = await fsPromises.stat(dirPath);
    if (!stats.isDirectory()) {
        throw new Error(`Working directory is not a directory: ${dirPath}`);
    }
}
const FileReader_1 = require("./files/FileReader");
const FileWriter_1 = require("./files/FileWriter");
const FileSearch_1 = require("./files/FileSearch");
const FileArchiver_1 = require("./files/FileArchiver");
/**
 * File system utility class - backward-compatible static API.
 * Delegates to focused sub-modules in src/utils/files/.
 */
class FileUtils {
    static async ensureDirectory(dirPath) {
        return (0, FileWriter_1.ensureDirectory)(dirPath);
    }
    static async readJsonFile(filePath) {
        return (0, FileReader_1.readJsonFile)(filePath);
    }
    static async writeJsonFile(filePath, data, pretty = true) {
        return (0, FileWriter_1.writeJsonFile)(filePath, data, pretty);
    }
    static async appendToFile(filePath, content) {
        return (0, FileWriter_1.appendToFile)(filePath, content);
    }
    static async copy(source, destination, overwrite = true) {
        return (0, FileArchiver_1.copy)(source, destination, overwrite);
    }
    static async move(source, destination) {
        return (0, FileWriter_1.move)(source, destination);
    }
    static async delete(filePath, recursive = false) {
        return (0, FileWriter_1.deleteFileOrDir)(filePath, recursive);
    }
    static async exists(filePath) {
        return (0, FileReader_1.exists)(filePath);
    }
    static async getMetadata(filePath) {
        return (0, FileReader_1.getMetadata)(filePath);
    }
    static async calculateHash(filePath, algorithm = 'md5') {
        return (0, FileSearch_1.calculateHash)(filePath, algorithm);
    }
    static async findFiles(patterns, options) {
        return (0, FileSearch_1.findFiles)(patterns, options);
    }
    static async cleanup(directory, options = {}) {
        return (0, FileArchiver_1.cleanup)(directory, options);
    }
    static async backup(source, backupDir) {
        return (0, FileArchiver_1.backup)(source, backupDir);
    }
    static async sync(source, destination, options = {}) {
        return (0, FileArchiver_1.sync)(source, destination, options);
    }
    static async getDirectorySize(directory) {
        const files = await (0, FileSearch_1.findFiles)('**/*', { cwd: directory, absolute: true });
        let totalSize = 0;
        for (const filePath of files) {
            try {
                const meta = await (0, FileReader_1.getMetadata)(filePath);
                if (!meta.isDirectory) {
                    totalSize += meta.size;
                }
            }
            catch {
                // Skip files that can't be accessed
            }
        }
        return totalSize;
    }
    static async createTempFile(prefix = 'temp', suffix = '.tmp') {
        return (0, FileWriter_1.createTempFile)(prefix, suffix);
    }
    static async createTempDirectory(prefix = 'temp') {
        return (0, FileWriter_1.createTempDirectory)(prefix);
    }
    /**
     * Filter a list of file paths by glob patterns.
     * When exclude=true, returns files that do NOT match any pattern.
     * When exclude=false, returns files that match at least one pattern.
     */
    static filterByPatterns(files, patterns, exclude) {
        return (0, FileSearch_1.filterByPatterns)(files, patterns, exclude);
    }
}
exports.FileUtils = FileUtils;
//# sourceMappingURL=fileUtils.js.map