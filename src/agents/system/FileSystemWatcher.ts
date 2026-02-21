/**
 * FileSystemWatcher - File system monitoring using chokidar
 *
 * Manages chokidar watchers and tracks file system changes.
 * Uses a proper import instead of dynamic require().
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { watch as chokidarWatch, FSWatcher as ChokidarFSWatcher } from 'chokidar';
import { TestLogger } from '../../utils/logger';
import { SystemAgentConfig, FileSystemChange } from './types';

export class FileSystemWatcher {
  private fsWatchers: Map<string, ChokidarFSWatcher> = new Map();
  private fileSystemChanges: FileSystemChange[] = [];

  constructor(
    private readonly logger: TestLogger,
    private readonly emitter: EventEmitter
  ) {}

  /**
   * Set up file system monitoring for configured paths
   */
  async setupFileSystemMonitoring(config: SystemAgentConfig): Promise<void> {
    if (!config.fileSystemMonitoring?.enabled) {
      return;
    }

    const { watchPaths, excludePatterns } = config.fileSystemMonitoring;

    for (const watchPath of watchPaths) {
      try {
        const absolutePath = path.resolve(watchPath);

        // Check if path exists, create if it does not
        await fs.access(absolutePath).catch((err) => {
          this.logger.debug(
            `Path ${absolutePath} does not exist, creating it`,
            { error: err }
          );
          return fs.mkdir(absolutePath, { recursive: true });
        });

        // Set up watcher
        const watcher = chokidarWatch(absolutePath, {
          ignored: (filePath: string) =>
            excludePatterns?.some((pattern) => pattern.test(filePath)) || false,
          persistent: true,
          ignoreInitial: true,
        });

        watcher
          .on('add', (filePath: string, stats: any) => {
            this.fileSystemChanges.push({
              path: filePath,
              type: 'created',
              timestamp: new Date(),
              size: stats?.size,
            });
            this.emitter.emit('fileSystemChange', {
              path: filePath,
              type: 'created',
            });
          })
          .on('change', (filePath: string, stats: any) => {
            this.fileSystemChanges.push({
              path: filePath,
              type: 'modified',
              timestamp: new Date(),
              size: stats?.size,
            });
            this.emitter.emit('fileSystemChange', {
              path: filePath,
              type: 'modified',
            });
          })
          .on('unlink', (filePath: string) => {
            this.fileSystemChanges.push({
              path: filePath,
              type: 'deleted',
              timestamp: new Date(),
            });
            this.emitter.emit('fileSystemChange', {
              path: filePath,
              type: 'deleted',
            });
          });

        this.fsWatchers.set(absolutePath, watcher);
        this.logger.info(
          `File system monitoring set up for: ${absolutePath}`
        );
      } catch (error) {
        this.logger.error(`Failed to set up monitoring for ${watchPath}`, {
          error,
        });
      }
    }
  }

  /**
   * Close all file system watchers
   */
  closeAll(): void {
    this.fsWatchers.forEach((watcher) => {
      if (watcher.close) {
        watcher.close();
      }
    });
    this.fsWatchers.clear();
  }

  /**
   * Get recorded file system changes
   */
  getFileSystemChanges(): FileSystemChange[] {
    return [...this.fileSystemChanges];
  }
}
