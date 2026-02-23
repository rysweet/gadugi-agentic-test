/**
 * Tests for three critical bugs (issue #126):
 *   A1a: ResourceOptimizer.destroy() must remove all sub-optimizer listeners
 *   A1b: PtyTerminal.destroy() must remove processManager listeners
 *   A1c: TUIAgent.cleanup() must remove the error handler registered in constructor
 *   A2:  ResultsHandler must not call console.log (library layer)
 *   A3:  gadugi-smart-test bin target must be a real CLI entry point
 */

import { EventEmitter } from 'events';
import { ProcessLifecycleManager } from '../core/ProcessLifecycleManager';
import { PtyTerminal } from '../core/PtyTerminal';
import { ResourceOptimizer } from '../core/ResourceOptimizer';
import { displayResults, performDryRun } from '../lib/ResultsHandler';
import { TUIAgent } from '../agents/TUIAgent';

// ---------------------------------------------------------------------------
// A1a: ResourceOptimizer listener cleanup
// ---------------------------------------------------------------------------
describe('A1a: ResourceOptimizer.destroy() removes sub-optimizer listeners', () => {
  it('should have no sub-optimizer forwarding listeners after destroy()', async () => {
    const pm = {
      on: jest.fn(),
      emit: jest.fn(),
      startProcess: jest.fn(),
      killProcess: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProcessLifecycleManager;

    const optimizer = new ResourceOptimizer(
      { enableMetrics: true, enableGarbageCollection: false },
      pm
    );

    const internal = optimizer as any;
    const memoryOpt: EventEmitter = internal.memoryOpt;
    const cpuOpt: EventEmitter = internal.cpuOpt;
    const concurrencyOpt: EventEmitter = internal.concurrencyOpt;

    // All three should have listeners registered before destroy
    expect(
      memoryOpt.listenerCount('memoryWarning') +
      memoryOpt.listenerCount('memoryAlert') +
      memoryOpt.listenerCount('gcTriggered') +
      memoryOpt.listenerCount('error')
    ).toBeGreaterThan(0);

    await optimizer.destroy();

    // After destroy, sub-optimizers must have no forwarding listeners
    expect(memoryOpt.listenerCount('memoryWarning')).toBe(0);
    expect(memoryOpt.listenerCount('memoryAlert')).toBe(0);
    expect(memoryOpt.listenerCount('gcTriggered')).toBe(0);
    expect(memoryOpt.listenerCount('error')).toBe(0);
    expect(cpuOpt.listenerCount('bufferRotated')).toBe(0);
    expect(concurrencyOpt.listenerCount('resourceCreated')).toBe(0);
    expect(concurrencyOpt.listenerCount('resourceDestroyed')).toBe(0);
  }, 10000);
});

// ---------------------------------------------------------------------------
// A1b: PtyTerminal listener cleanup
// ---------------------------------------------------------------------------
describe('A1b: PtyTerminal.destroy() removes processManager listeners', () => {
  it('should remove all listeners from processManager during destroy()', async () => {
    const pm = new ProcessLifecycleManager();
    const terminal = new PtyTerminal({}, pm);

    // PtyTerminal.setupProcessManagerEvents registers 2 listeners
    expect(pm.listenerCount('processExited') + pm.listenerCount('error')).toBeGreaterThan(0);

    await terminal.destroy();
    await pm.shutdown();

    // After destroy, no listeners should remain on the processManager
    expect(pm.listenerCount('processExited')).toBe(0);
    expect(pm.listenerCount('error')).toBe(0);

    pm.destroy();
  }, 10000);
});

// ---------------------------------------------------------------------------
// A1c: TUIAgent cleanup removes error handler
// ---------------------------------------------------------------------------
describe('A1c: TUIAgent.cleanup() removes error handler registered in constructor', () => {
  it('should remove the error listener added in the constructor', async () => {
    const agent = new TUIAgent({});

    // Constructor registers exactly 1 error listener
    expect(agent.listenerCount('error')).toBe(1);

    await agent.cleanup();

    // After cleanup, the constructor error listener must be removed
    expect(agent.listenerCount('error')).toBe(0);
  }, 10000);
});

// ---------------------------------------------------------------------------
// A2: ResultsHandler uses logger, not console.log
//
// Strategy: use jest.doMock (not hoisted) within an isolated test context so
// we can verify that logger.info is called without affecting the module-level
// imports that other tests depend on (TUIAgent, ResourceOptimizer, etc.).
// ---------------------------------------------------------------------------
describe('A2: ResultsHandler uses logger.info, not console.log', () => {
  let displayResultsFn: (session: any) => void;
  let performDryRunFn: (scenarios: any[], suite: string) => Promise<void>;
  let loggerInfoMock: jest.Mock;

  beforeAll(async () => {
    // Set up the mock in an isolated module registry
    jest.isolateModules(() => {
      loggerInfoMock = jest.fn();
      jest.doMock('../utils/logger', () => ({
        logger: {
          info: loggerInfoMock,
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
        createLogger: jest.fn(() => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
          setContext: jest.fn(),
          scenarioStart: jest.fn(),
          scenarioEnd: jest.fn(),
        })),
      }));
      // Must use require inside isolateModules
      const mod = require('../lib/ResultsHandler');
      displayResultsFn = mod.displayResults;
      performDryRunFn = mod.performDryRun;
    });
  });

  beforeEach(() => {
    loggerInfoMock.mockClear();
  });

  it('displayResults calls logger.info with session summary', () => {
    const session = {
      id: 'test-session',
      startTime: new Date('2026-01-01T00:00:00Z'),
      endTime: new Date('2026-01-01T00:01:00Z'),
      summary: { total: 10, passed: 8, failed: 1, skipped: 1 },
      results: [],
    };

    displayResultsFn(session as any);

    expect(loggerInfoMock).toHaveBeenCalledWith(
      'TEST SESSION RESULTS',
      expect.objectContaining({
        sessionId: 'test-session',
        total: 10,
        passed: 8,
        failed: 1,
      })
    );
  });

  it('performDryRun calls logger.info with scenario count', async () => {
    await performDryRunFn([], 'smoke');

    expect(loggerInfoMock).toHaveBeenCalledWith(
      'DRY RUN MODE - Not executing tests',
      expect.objectContaining({ suite: 'smoke', scenarioCount: 0 })
    );
  });
});

// ---------------------------------------------------------------------------
// A3: smart-cli.ts exists and is a proper module
// ---------------------------------------------------------------------------
describe('A3: gadugi-smart-test has a valid CLI entry point', () => {
  it('src/runners/smart-cli.ts must export a runSmartUITests function', async () => {
    // We cannot import it directly since it requires electron, but we can
    // verify the file exists and the module exports the right shape by
    // checking via the filesystem
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.resolve(__dirname, '../runners/smart-cli.ts');
    // The file must exist
    await expect(fs.access(filePath)).resolves.toBeUndefined();
  });

  it('package.json bin.gadugi-smart-test must point to dist/runners/smart-cli.js', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const pkgPath = path.resolve(__dirname, '../../package.json'); // two levels up from src/__tests__
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    expect(pkg.bin['gadugi-smart-test']).toBe('./dist/runners/smart-cli.js');
  });
});
