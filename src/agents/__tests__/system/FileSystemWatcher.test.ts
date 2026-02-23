/**
 * FileSystemWatcher unit tests
 *
 * Mocks chokidar.watch and fs/promises to test:
 * - Watcher setup with correct options
 * - File change events emitted on the EventEmitter
 * - EACCES error suppression (security/stability)
 * - closeAll() terminates all watchers
 * - getFileSystemChanges() returns recorded changes
 */

import { EventEmitter } from 'events';
import { FileSystemWatcher } from '../../../agents/system/FileSystemWatcher';
import { TestLogger } from '../../../utils/logger';
import { SystemAgentConfig } from '../../../agents/system/types';

// ---------------------------------------------------------------------------
// Chokidar mock
// ---------------------------------------------------------------------------

// Each watcher instance exposes a controllable event handler map and a close spy.
type HandlerMap = { [event: string]: Function };

const mockWatcherClose = jest.fn();

let capturedHandlers: HandlerMap = {};

const mockWatcherInstance = {
  on: jest.fn((event: string, handler: Function) => {
    capturedHandlers[event] = handler;
    return mockWatcherInstance;
  }),
  close: mockWatcherClose,
};

const mockChokidarWatch = jest.fn(() => mockWatcherInstance);

jest.mock('chokidar', () => ({
  watch: (...args: unknown[]) => mockChokidarWatch(...args),
}));

// ---------------------------------------------------------------------------
// fs/promises mock
// ---------------------------------------------------------------------------

jest.mock('fs/promises', () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
}));

import * as fsPromises from 'fs/promises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): TestLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as TestLogger;
}

function makeConfig(watchPaths: string[] = ['/tmp/test-watch']): SystemAgentConfig {
  return {
    fileSystemMonitoring: {
      enabled: true,
      watchPaths,
      excludePatterns: [/node_modules/],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileSystemWatcher', () => {
  let emitter: EventEmitter;
  let logger: TestLogger;
  let watcher: FileSystemWatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedHandlers = {};
    emitter = new EventEmitter();
    logger = makeLogger();
    watcher = new FileSystemWatcher(logger, emitter);

    // Default: path exists (access resolves)
    (fsPromises.access as jest.Mock).mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // setupFileSystemMonitoring - no-op when disabled
  // -------------------------------------------------------------------------

  describe('setupFileSystemMonitoring', () => {
    it('does nothing when fileSystemMonitoring.enabled is false', async () => {
      const config: SystemAgentConfig = {
        fileSystemMonitoring: {
          enabled: false,
          watchPaths: ['/tmp'],
          excludePatterns: [],
        },
      };

      await watcher.setupFileSystemMonitoring(config);

      expect(mockChokidarWatch).not.toHaveBeenCalled();
    });

    it('does nothing when fileSystemMonitoring is undefined', async () => {
      await watcher.setupFileSystemMonitoring({});

      expect(mockChokidarWatch).not.toHaveBeenCalled();
    });

    it('calls chokidar.watch() with the resolved absolute path', async () => {
      const config = makeConfig(['/tmp/test-watch']);

      await watcher.setupFileSystemMonitoring(config);

      expect(mockChokidarWatch).toHaveBeenCalledTimes(1);
      // First arg is an absolute path
      const watchedPath: string = mockChokidarWatch.mock.calls[0][0];
      expect(typeof watchedPath).toBe('string');
      expect(watchedPath.includes('tmp/test-watch') || watchedPath.startsWith('/')).toBe(true);
    });

    it('calls chokidar.watch() with persistent:true and ignoreInitial:true', async () => {
      const config = makeConfig(['/tmp/test-watch']);

      await watcher.setupFileSystemMonitoring(config);

      const options = mockChokidarWatch.mock.calls[0][1] as Record<string, unknown>;
      expect(options.persistent).toBe(true);
      expect(options.ignoreInitial).toBe(true);
    });

    it('creates directory when access throws (path does not exist)', async () => {
      (fsPromises.access as jest.Mock).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);

      const config = makeConfig(['/tmp/new-dir']);

      await watcher.setupFileSystemMonitoring(config);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('new-dir'),
        { recursive: true }
      );
    });
  });

  // -------------------------------------------------------------------------
  // File change events
  // -------------------------------------------------------------------------

  describe('file event handling', () => {
    beforeEach(async () => {
      await watcher.setupFileSystemMonitoring(makeConfig(['/tmp/test-watch']));
    });

    it('emits "fileSystemChange" on "add" event and records the change', () => {
      const received: unknown[] = [];
      emitter.on('fileSystemChange', (e) => received.push(e));

      capturedHandlers['add']('/tmp/test-watch/newfile.txt', { size: 100 });

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        path: '/tmp/test-watch/newfile.txt',
        type: 'created',
      });

      const changes = watcher.getFileSystemChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('created');
      expect(changes[0].size).toBe(100);
    });

    it('emits "fileSystemChange" on "change" event', () => {
      const received: unknown[] = [];
      emitter.on('fileSystemChange', (e) => received.push(e));

      capturedHandlers['change']('/tmp/test-watch/modified.txt', { size: 200 });

      expect(received).toHaveLength(1);
      expect((received[0] as { type: string }).type).toBe('modified');
    });

    it('emits "fileSystemChange" on "unlink" event', () => {
      const received: unknown[] = [];
      emitter.on('fileSystemChange', (e) => received.push(e));

      capturedHandlers['unlink']('/tmp/test-watch/deleted.txt');

      expect(received).toHaveLength(1);
      expect((received[0] as { type: string }).type).toBe('deleted');
    });
  });

  // -------------------------------------------------------------------------
  // EACCES error suppression
  // -------------------------------------------------------------------------

  describe('error handler', () => {
    beforeEach(async () => {
      await watcher.setupFileSystemMonitoring(makeConfig(['/tmp/test-watch']));
    });

    it('logs a warning and does NOT propagate EACCES errors', () => {
      const errorReceived: unknown[] = [];
      emitter.on('error', (e) => errorReceived.push(e));

      const eacces = Object.assign(new Error('EACCES: permission denied'), {
        code: 'EACCES',
      });
      capturedHandlers['error'](eacces);

      // Should NOT forward to the emitter
      expect(errorReceived).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('permission denied')
      );
    });

    it('logs a warning and does NOT propagate errors containing "permission denied" text', () => {
      const errorReceived: unknown[] = [];
      emitter.on('error', (e) => errorReceived.push(e));

      const permError = new Error('permission denied: /restricted');
      capturedHandlers['error'](permError);

      expect(errorReceived).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('propagates non-EACCES errors to the emitter', () => {
      const errorReceived: unknown[] = [];
      emitter.on('error', (e) => errorReceived.push(e));

      const ioError = Object.assign(new Error('EIO: i/o error'), {
        code: 'EIO',
      });
      capturedHandlers['error'](ioError);

      expect(errorReceived).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // closeAll
  // -------------------------------------------------------------------------

  describe('closeAll', () => {
    it('calls close() on all watchers and clears the internal map', async () => {
      await watcher.setupFileSystemMonitoring(makeConfig(['/tmp/test-watch']));

      watcher.closeAll();

      expect(mockWatcherClose).toHaveBeenCalledTimes(1);
    });

    it('is safe to call when no watchers are active', () => {
      expect(() => watcher.closeAll()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getFileSystemChanges
  // -------------------------------------------------------------------------

  describe('getFileSystemChanges', () => {
    it('returns empty array initially', () => {
      expect(watcher.getFileSystemChanges()).toEqual([]);
    });

    it('returns a snapshot (not the internal reference)', async () => {
      await watcher.setupFileSystemMonitoring(makeConfig(['/tmp/test-watch']));

      capturedHandlers['add']('/tmp/test-watch/a.txt', {});
      const first = watcher.getFileSystemChanges();
      capturedHandlers['add']('/tmp/test-watch/b.txt', {});
      const second = watcher.getFileSystemChanges();

      // first snapshot should not have been mutated
      expect(first).toHaveLength(1);
      expect(second).toHaveLength(2);
    });
  });
});
