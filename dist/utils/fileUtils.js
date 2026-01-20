"use strict";
/**
 * File system utilities for test artifact management
 * Handles directory creation, cleanup, archiving, and file operations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUtils = exports.FileOperationError = void 0;
exports.ensureDir = ensureDir;
exports.readJson = readJson;
exports.writeJson = writeJson;
exports.exists = exists;
exports.remove = remove;
exports.copy = copy;
exports.findFiles = findFiles;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const glob_1 = require("glob");
/**
 * File operation error class
 */
class FileOperationError extends Error {
    constructor(message, operation, filePath) {
        super(message);
        this.operation = operation;
        this.filePath = filePath;
        this.name = 'FileOperationError';
    }
}
exports.FileOperationError = FileOperationError;
/**
 * File system utility class
 */
class FileUtils {
    /**
     * Ensure a directory exists, creating it if necessary
     */
    static async ensureDirectory(dirPath) {
        try {
            const stats = await promises_1.default.stat(dirPath);
            if (!stats.isDirectory()) {
                throw new FileOperationError(`Path exists but is not a directory: ${dirPath}`, 'ensureDirectory', dirPath);
            }
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                try {
                    await promises_1.default.mkdir(dirPath, { recursive: true });
                }
                catch (mkdirError) {
                    throw new FileOperationError(`Failed to create directory: ${mkdirError.message}`, 'ensureDirectory', dirPath);
                }
            }
            else if (!(error instanceof FileOperationError)) {
                throw new FileOperationError(`Failed to check directory: ${error.message}`, 'ensureDirectory', dirPath);
            }
            else {
                throw error;
            }
        }
    }
    /**
     * Read a JSON file and parse it
     */
    static async readJsonFile(filePath) {
        try {
            const content = await promises_1.default.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            throw new FileOperationError(`Failed to read JSON file: ${error.message}`, 'readJsonFile', filePath);
        }
    }
    /**
     * Write an object to a JSON file
     */
    static async writeJsonFile(filePath, data, pretty = true) {
        try {
            await this.ensureDirectory(path_1.default.dirname(filePath));
            const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
            await promises_1.default.writeFile(filePath, content, 'utf-8');
        }
        catch (error) {
            throw new FileOperationError(`Failed to write JSON file: ${error.message}`, 'writeJsonFile', filePath);
        }
    }
    /**
     * Append content to a file
     */
    static async appendToFile(filePath, content) {
        try {
            await this.ensureDirectory(path_1.default.dirname(filePath));
            await promises_1.default.appendFile(filePath, content);
        }
        catch (error) {
            throw new FileOperationError(`Failed to append to file: ${error.message}`, 'appendToFile', filePath);
        }
    }
    /**
     * Copy a file or directory
     */
    static async copy(source, destination, overwrite = true) {
        try {
            await this.ensureDirectory(path_1.default.dirname(destination));
            const stats = await promises_1.default.stat(source);
            if (stats.isDirectory()) {
                await this.copyDirectory(source, destination, overwrite);
            }
            else {
                if (!overwrite && await this.exists(destination)) {
                    throw new FileOperationError(`Destination file already exists: ${destination}`, 'copy', destination);
                }
                await promises_1.default.copyFile(source, destination);
            }
        }
        catch (error) {
            if (!(error instanceof FileOperationError)) {
                throw new FileOperationError(`Failed to copy: ${error.message}`, 'copy', source);
            }
            throw error;
        }
    }
    /**
     * Copy a directory recursively
     */
    static async copyDirectory(source, destination, overwrite) {
        await this.ensureDirectory(destination);
        const items = await promises_1.default.readdir(source);
        for (const item of items) {
            const srcPath = path_1.default.join(source, item);
            const destPath = path_1.default.join(destination, item);
            const stats = await promises_1.default.stat(srcPath);
            if (stats.isDirectory()) {
                await this.copyDirectory(srcPath, destPath, overwrite);
            }
            else {
                if (!overwrite && await this.exists(destPath)) {
                    continue;
                }
                await promises_1.default.copyFile(srcPath, destPath);
            }
        }
    }
    /**
     * Move/rename a file or directory
     */
    static async move(source, destination) {
        try {
            await this.ensureDirectory(path_1.default.dirname(destination));
            await promises_1.default.rename(source, destination);
        }
        catch (error) {
            throw new FileOperationError(`Failed to move: ${error.message}`, 'move', source);
        }
    }
    /**
     * Delete a file or directory
     */
    static async delete(filePath, recursive = false) {
        try {
            const stats = await promises_1.default.stat(filePath);
            if (stats.isDirectory()) {
                if (recursive) {
                    await promises_1.default.rm(filePath, { recursive: true, force: true });
                }
                else {
                    await promises_1.default.rmdir(filePath);
                }
            }
            else {
                await promises_1.default.unlink(filePath);
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw new FileOperationError(`Failed to delete: ${error.message}`, 'delete', filePath);
            }
        }
    }
    /**
     * Check if file or directory exists
     */
    static async exists(filePath) {
        try {
            await promises_1.default.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get file metadata
     */
    static async getMetadata(filePath) {
        try {
            const stats = await promises_1.default.stat(filePath);
            const fileName = path_1.default.basename(filePath);
            const extension = path_1.default.extname(fileName).toLowerCase();
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
        }
        catch (error) {
            throw new FileOperationError(`Failed to get metadata: ${error.message}`, 'getMetadata', filePath);
        }
    }
    /**
     * Calculate file hash
     */
    static async calculateHash(filePath, algorithm = 'md5') {
        try {
            const buffer = await promises_1.default.readFile(filePath);
            return crypto_1.default.createHash(algorithm).update(buffer).digest('hex');
        }
        catch (error) {
            throw new FileOperationError(`Failed to calculate hash: ${error.message}`, 'calculateHash', filePath);
        }
    }
    /**
     * Find files matching patterns
     */
    static async findFiles(patterns, options) {
        try {
            const globPatterns = Array.isArray(patterns) ? patterns : [patterns];
            const results = [];
            for (const pattern of globPatterns) {
                const matches = await (0, glob_1.glob)(pattern, {
                    cwd: options?.cwd,
                    ignore: options?.ignore,
                    absolute: options?.absolute ?? true
                });
                results.push(...matches);
            }
            // Remove duplicates
            return [...new Set(results)];
        }
        catch (error) {
            throw new FileOperationError(`Failed to find files: ${error.message}`, 'findFiles');
        }
    }
    /**
     * Clean up files and directories based on criteria
     */
    static async cleanup(directory, options = {}) {
        const result = {
            deletedFiles: [],
            deletedDirectories: [],
            totalSize: 0,
            errors: []
        };
        try {
            if (!await this.exists(directory)) {
                return result;
            }
            const files = await this.findFiles(options.includePatterns || ['**/*'], { cwd: directory, absolute: true });
            let filesToDelete = files;
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
                        const stats = await promises_1.default.stat(filePath);
                        result.totalSize += stats.size;
                        if (stats.isDirectory()) {
                            result.deletedDirectories.push(filePath);
                        }
                        else {
                            result.deletedFiles.push(filePath);
                        }
                    }
                    else {
                        const stats = await promises_1.default.stat(filePath);
                        result.totalSize += stats.size;
                        await this.delete(filePath, true);
                        if (stats.isDirectory()) {
                            result.deletedDirectories.push(filePath);
                        }
                        else {
                            result.deletedFiles.push(filePath);
                        }
                    }
                }
                catch (error) {
                    result.errors.push({
                        path: filePath,
                        error: error.message
                    });
                }
            }
            // Remove empty directories if requested
            if (options.removeEmptyDirs && !options.dryRun) {
                await this.removeEmptyDirectories(directory);
            }
        }
        catch (error) {
            throw new FileOperationError(`Cleanup failed: ${error.message}`, 'cleanup', directory);
        }
        return result;
    }
    /**
     * Create a backup of a file or directory
     */
    static async backup(source, backupDir) {
        try {
            if (!backupDir) {
                backupDir = path_1.default.join(path_1.default.dirname(source), 'backups');
            }
            await this.ensureDirectory(backupDir);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
            const sourceName = path_1.default.basename(source);
            const backupName = `${sourceName}.backup.${timestamp}`;
            const backupPath = path_1.default.join(backupDir, backupName);
            await this.copy(source, backupPath);
            return backupPath;
        }
        catch (error) {
            throw new FileOperationError(`Backup failed: ${error.message}`, 'backup', source);
        }
    }
    /**
     * Synchronize directories
     */
    static async sync(source, destination, options = {}) {
        const result = {
            copied: [],
            updated: [],
            deleted: [],
            errors: []
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
                const sourcePath = path_1.default.join(source, relativePath);
                const destPath = path_1.default.join(destination, relativePath);
                try {
                    if (await this.exists(destPath)) {
                        // File exists, check if update needed
                        const sourceStats = await promises_1.default.stat(sourcePath);
                        const destStats = await promises_1.default.stat(destPath);
                        let needsUpdate = false;
                        if (options.useChecksum) {
                            const sourceHash = await this.calculateHash(sourcePath);
                            const destHash = await this.calculateHash(destPath);
                            needsUpdate = sourceHash !== destHash;
                        }
                        else {
                            needsUpdate = sourceStats.mtime > destStats.mtime;
                        }
                        if (needsUpdate) {
                            await this.copy(sourcePath, destPath);
                            result.updated.push(relativePath);
                        }
                    }
                    else {
                        // File doesn't exist, copy it
                        await this.copy(sourcePath, destPath);
                        result.copied.push(relativePath);
                    }
                }
                catch (error) {
                    result.errors.push({
                        path: relativePath,
                        error: error.message
                    });
                }
            }
            // Handle deletion of extra files
            if (options.deleteExtra) {
                const destFiles = await this.findFiles('**/*', { cwd: destination, absolute: false });
                const extraFiles = destFiles.filter(f => !filteredSourceFiles.includes(f));
                for (const extraFile of extraFiles) {
                    try {
                        const extraPath = path_1.default.join(destination, extraFile);
                        await this.delete(extraPath, true);
                        result.deleted.push(extraFile);
                    }
                    catch (error) {
                        result.errors.push({
                            path: extraFile,
                            error: error.message
                        });
                    }
                }
            }
        }
        catch (error) {
            throw new FileOperationError(`Sync failed: ${error.message}`, 'sync', source);
        }
        return result;
    }
    /**
     * Get directory size recursively
     */
    static async getDirectorySize(directory) {
        let totalSize = 0;
        try {
            const files = await this.findFiles('**/*', { cwd: directory, absolute: true });
            for (const filePath of files) {
                try {
                    const stats = await promises_1.default.stat(filePath);
                    if (stats.isFile()) {
                        totalSize += stats.size;
                    }
                }
                catch {
                    // Skip files that can't be accessed
                }
            }
        }
        catch (error) {
            throw new FileOperationError(`Failed to get directory size: ${error.message}`, 'getDirectorySize', directory);
        }
        return totalSize;
    }
    /**
     * Create a temporary file
     */
    static async createTempFile(prefix = 'temp', suffix = '.tmp') {
        const tempDir = process.env.TMPDIR || process.env.TMP || '/tmp';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const fileName = `${prefix}_${timestamp}_${random}${suffix}`;
        const tempPath = path_1.default.join(tempDir, fileName);
        try {
            await promises_1.default.writeFile(tempPath, '');
            return tempPath;
        }
        catch (error) {
            throw new FileOperationError(`Failed to create temp file: ${error.message}`, 'createTempFile', tempPath);
        }
    }
    /**
     * Create a temporary directory
     */
    static async createTempDirectory(prefix = 'temp') {
        const tempDir = process.env.TMPDIR || process.env.TMP || '/tmp';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const dirName = `${prefix}_${timestamp}_${random}`;
        const tempPath = path_1.default.join(tempDir, dirName);
        try {
            await this.ensureDirectory(tempPath);
            return tempPath;
        }
        catch (error) {
            throw new FileOperationError(`Failed to create temp directory: ${error.message}`, 'createTempDirectory', tempPath);
        }
    }
    /**
     * Filter files by age
     */
    static async filterByAge(files, cutoffTime) {
        const filtered = [];
        for (const filePath of files) {
            try {
                const stats = await promises_1.default.stat(filePath);
                if (stats.mtime.getTime() < cutoffTime) {
                    filtered.push(filePath);
                }
            }
            catch {
                // Skip files that can't be accessed
            }
        }
        return filtered;
    }
    /**
     * Filter files by patterns
     */
    static async filterByPatterns(files, patterns, exclude) {
        // This is a simplified implementation
        // In a real implementation, you'd use a proper glob matching library
        return files.filter(filePath => {
            const matches = patterns.some(pattern => {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(filePath);
            });
            return exclude ? !matches : matches;
        });
    }
    /**
     * Remove empty directories recursively
     */
    static async removeEmptyDirectories(directory) {
        try {
            const items = await promises_1.default.readdir(directory);
            for (const item of items) {
                const itemPath = path_1.default.join(directory, item);
                const stats = await promises_1.default.stat(itemPath);
                if (stats.isDirectory()) {
                    await this.removeEmptyDirectories(itemPath);
                    // Check if directory is now empty
                    const remainingItems = await promises_1.default.readdir(itemPath);
                    if (remainingItems.length === 0) {
                        await promises_1.default.rmdir(itemPath);
                    }
                }
            }
        }
        catch {
            // Ignore errors when removing empty directories
        }
    }
}
exports.FileUtils = FileUtils;
/**
 * Convenience functions for common operations
 */
/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
    return FileUtils.ensureDirectory(dirPath);
}
/**
 * Read JSON file
 */
async function readJson(filePath) {
    return FileUtils.readJsonFile(filePath);
}
/**
 * Write JSON file
 */
async function writeJson(filePath, data, pretty = true) {
    return FileUtils.writeJsonFile(filePath, data, pretty);
}
/**
 * Check if file exists
 */
async function exists(filePath) {
    return FileUtils.exists(filePath);
}
/**
 * Delete file or directory
 */
async function remove(filePath, recursive = false) {
    return FileUtils.delete(filePath, recursive);
}
/**
 * Copy file or directory
 */
async function copy(source, destination, overwrite = true) {
    return FileUtils.copy(source, destination, overwrite);
}
/**
 * Find files matching patterns
 */
async function findFiles(patterns, cwd) {
    return FileUtils.findFiles(patterns, { cwd, absolute: true });
}
//# sourceMappingURL=fileUtils.js.map