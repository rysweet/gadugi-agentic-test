/**
 * Tests for src/cli/commands/watch.ts
 * Covers: registerWatchCommand, directory validation, file watcher setup,
 *         file change triggers test re-run, cleanup on exit
 */

// Mock chalk BEFORE any imports that use it (chalk v5 is ESM-only)
jest.mock('chalk', () => {
  const identity = (s: string) => s;
  const proxy: Record<string, unknown> = {};
  ['green', 'red', 'yellow', 'blue', 'gray', 'cyan', 'bold'].forEach((c) => {
    proxy[c] = identity;
  });
  proxy.level = 0;
  return { default: Object.assign(identity, proxy), __esModule: true };
});

jest.mock('fs/promises');

// Chokidar mock: returns a controllable FSWatcher stub
const mockWatcherOn = jest.fn();
const mockWatcherClose = jest.fn().mockResolvedValue(undefined);

jest.mock('chokidar', () => ({
  watch: jest.fn().mockImplementation(() => ({
    on: mockWatcherOn,
    close: mockWatcherClose,
  })),
}));

const mockLoadFromDirectory = jest.fn();
jest.mock('../../scenarios', () => ({
  ScenarioLoader: {
    loadFromFile: jest.fn(),
    loadFromDirectory: (...args: unknown[]) => mockLoadFromDirectory(...args),
  },
}));

const mockLoadFromFileCfg = jest.fn();
const mockGetConfig = jest.fn();
jest.mock('../../utils', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  ConfigManager: jest.fn().mockImplementation(() => ({
    loadFromFile: mockLoadFromFileCfg,
    getConfig: mockGetConfig,
  })),
}));

jest.mock('../../lib', () => ({
  createDefaultConfig: jest.fn().mockReturnValue({
    execution: { defaultTimeout: 30000, resourceLimits: { maxExecutionTime: 300000 } },
    cli: { defaultTimeout: 30000 },
    ui: { defaultTimeout: 30000 },
    tui: { defaultTimeout: 30000 },
  }),
}));

const mockRunWithScenarios = jest.fn();
jest.mock('../../orchestrator', () => ({
  TestOrchestrator: jest.fn().mockImplementation(() => ({
    runWithScenarios: mockRunWithScenarios,
  })),
}));

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as chokidar from 'chokidar';
import { registerWatchCommand } from '../../cli/commands/watch';

const mockFs = jest.mocked(fs);
const mockChokidar = jest.mocked(chokidar);

async function invokeWatch(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerWatchCommand(program);
  await program.parseAsync(['watch', ...args], { from: 'user' });
}

describe('registerWatchCommand', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let processOnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`);
    }) as unknown as jest.SpyInstance;
    processOnSpy = jest.spyOn(process, 'on').mockImplementation((_event, _handler) => process);

    mockFs.access.mockResolvedValue(undefined);
    // Ensure watcher.on returns the mock itself for potential chaining
    mockWatcherOn.mockReturnValue({ on: mockWatcherOn, close: mockWatcherClose });
    (mockChokidar.watch as jest.Mock).mockImplementation(() => ({
      on: mockWatcherOn,
      close: mockWatcherClose,
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    processOnSpy.mockRestore();
  });

  it('registers a "watch" command on the Commander program', () => {
    const program = new Command();
    registerWatchCommand(program);
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('watch');
  });

  it('starts a chokidar file watcher on the specified directory', async () => {
    mockLoadFromDirectory.mockResolvedValue([]);

    await invokeWatch(['--directory', './my-scenarios']);

    expect(mockChokidar.watch).toHaveBeenCalledWith(
      './my-scenarios',
      expect.objectContaining({ persistent: true })
    );
  });

  it('throws CLIError when directory does not exist', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'));

    await expect(invokeWatch(['--directory', './missing'])).rejects.toThrow('process.exit(1)');
  });

  it('registers change, add, unlink, and error event handlers on watcher', async () => {
    mockLoadFromDirectory.mockResolvedValue([]);

    await invokeWatch(['--directory', './scenarios']);

    const registeredEvents = mockWatcherOn.mock.calls.map((c: unknown[]) => c[0]);
    expect(registeredEvents).toContain('change');
    expect(registeredEvents).toContain('add');
    expect(registeredEvents).toContain('unlink');
    expect(registeredEvents).toContain('error');
  });

  it('runs initial test execution on start', async () => {
    mockLoadFromDirectory.mockResolvedValue([{ name: 's1', steps: [], assertions: [] }]);
    mockRunWithScenarios.mockResolvedValue({ summary: { passed: 1, failed: 0 } });

    await invokeWatch(['--directory', './scenarios']);

    expect(mockLoadFromDirectory).toHaveBeenCalled();
    expect(mockRunWithScenarios).toHaveBeenCalled();
  });

  it('registers SIGINT handler for graceful shutdown', async () => {
    mockLoadFromDirectory.mockResolvedValue([]);

    await invokeWatch(['--directory', './scenarios']);

    const sigintCalls = processOnSpy.mock.calls.filter((c: unknown[]) => c[0] === 'SIGINT');
    expect(sigintCalls.length).toBeGreaterThan(0);
  });

  it('reports passed and failed counts in watch mode results', async () => {
    mockLoadFromDirectory.mockResolvedValue([{ name: 's1', steps: [], assertions: [] }]);
    mockRunWithScenarios.mockResolvedValue({ summary: { passed: 1, failed: 0 } });

    await invokeWatch(['--directory', './scenarios']);

    const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('1');
  });

  it('warns about failed tests in watch mode output', async () => {
    mockLoadFromDirectory.mockResolvedValue([{ name: 's1', steps: [], assertions: [] }]);
    mockRunWithScenarios.mockResolvedValue({ summary: { passed: 0, failed: 1 } });

    await invokeWatch(['--directory', './scenarios']);

    const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('failed');
  });

  it('handles test execution errors gracefully without crashing watch mode', async () => {
    mockLoadFromDirectory.mockResolvedValue([{ name: 's1', steps: [], assertions: [] }]);
    mockRunWithScenarios.mockRejectedValue(new Error('orchestrator failed'));

    // Should NOT throw — watch mode catches test errors and continues watching
    await expect(invokeWatch(['--directory', './scenarios'])).resolves.not.toThrow();
  });

  it('outputs watch mode started message after setup', async () => {
    mockLoadFromDirectory.mockResolvedValue([]);

    await invokeWatch(['--directory', './scenarios']);

    const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Watch mode started');
  });

  describe('config loading', () => {
    it('loads configuration from file when --config is provided', async () => {
      const fakeConfig = {
        execution: { defaultTimeout: 30000, resourceLimits: { maxExecutionTime: 300000 } },
        cli: { defaultTimeout: 30000 },
        ui: { defaultTimeout: 30000 },
        tui: { defaultTimeout: 30000 },
      };
      mockLoadFromFileCfg.mockResolvedValue(undefined);
      mockGetConfig.mockReturnValue(fakeConfig);
      mockLoadFromDirectory.mockResolvedValue([]);

      await invokeWatch(['--directory', './scenarios', '--config', './my-config.yaml']);

      expect(mockLoadFromFileCfg).toHaveBeenCalledWith('./my-config.yaml');
      expect(mockGetConfig).toHaveBeenCalled();
    });

    it('exits with error when config file cannot be loaded', async () => {
      mockLoadFromFileCfg.mockRejectedValue(new Error('file not found'));
      mockLoadFromDirectory.mockResolvedValue([]);

      await expect(invokeWatch(['--directory', './scenarios', '--config', './bad.yaml']))
        .rejects.toThrow('process.exit(1)');
    });
  });

  describe('file change event handlers', () => {
    it('change event handler clears previous debounce timeout and schedules runTests', async () => {
      mockLoadFromDirectory.mockResolvedValue([]);

      await invokeWatch(['--directory', './scenarios']);

      // Get the 'change' handler registered with the watcher
      const changeCall = mockWatcherOn.mock.calls.find((c: unknown[]) => c[0] === 'change');
      expect(changeCall).toBeDefined();

      const changeHandler = changeCall![1] as (filePath: string) => void;

      // Use fake timers to test debounce
      jest.useFakeTimers();

      // Simulate multiple rapid changes
      changeHandler('/scenarios/test1.yaml');
      changeHandler('/scenarios/test2.yaml');
      changeHandler('/scenarios/test3.yaml');

      // Only one timer should be pending (debounce cleared the previous ones)
      expect(jest.getTimerCount()).toBe(1);

      jest.useRealTimers();
    });

    it('add event handler logs new file and schedules debounced runTests', async () => {
      mockLoadFromDirectory.mockResolvedValue([]);

      await invokeWatch(['--directory', './scenarios']);

      const addCall = mockWatcherOn.mock.calls.find((c: unknown[]) => c[0] === 'add');
      expect(addCall).toBeDefined();

      const addHandler = addCall![1] as (filePath: string) => void;

      jest.useFakeTimers();
      addHandler('/scenarios/new-scenario.yaml');

      // One timer pending after add event
      expect(jest.getTimerCount()).toBe(1);

      jest.useRealTimers();
    });

    it('unlink event handler logs deleted file and schedules debounced runTests', async () => {
      mockLoadFromDirectory.mockResolvedValue([]);

      await invokeWatch(['--directory', './scenarios']);

      const unlinkCall = mockWatcherOn.mock.calls.find((c: unknown[]) => c[0] === 'unlink');
      expect(unlinkCall).toBeDefined();

      const unlinkHandler = unlinkCall![1] as (filePath: string) => void;

      jest.useFakeTimers();
      unlinkHandler('/scenarios/deleted.yaml');

      expect(jest.getTimerCount()).toBe(1);

      jest.useRealTimers();
    });

    it('error event handler logs the error message without crashing', async () => {
      mockLoadFromDirectory.mockResolvedValue([]);

      await invokeWatch(['--directory', './scenarios']);

      const errorCall = mockWatcherOn.mock.calls.find((c: unknown[]) => c[0] === 'error');
      expect(errorCall).toBeDefined();

      const errorHandler = errorCall![1] as (error: Error) => void;

      // Calling the error handler should not throw
      expect(() => errorHandler(new Error('EACCES: permission denied'))).not.toThrow();

      // logError uses console.log (with chalk.red prefix)
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('error event handler accepts non-Error objects', async () => {
      mockLoadFromDirectory.mockResolvedValue([]);

      await invokeWatch(['--directory', './scenarios']);

      const errorCall = mockWatcherOn.mock.calls.find((c: unknown[]) => c[0] === 'error');
      const errorHandler = errorCall![1] as (error: unknown) => void;

      // Should handle non-Error thrown values gracefully
      expect(() => errorHandler('string error')).not.toThrow();
    });

    it('debounce: multiple changes within window trigger only one test run', async () => {
      let resolveInitial!: () => void;
      const initialRunPromise = new Promise<void>((res) => { resolveInitial = res; });

      mockLoadFromDirectory.mockResolvedValueOnce([]).mockResolvedValue([]);

      // Track how many times runTests is called via loadFromDirectory calls
      let loadCallCount = 0;
      mockLoadFromDirectory.mockImplementation(() => {
        loadCallCount++;
        return Promise.resolve([]);
      });

      jest.useFakeTimers();

      await invokeWatch(['--directory', './scenarios']);

      // Reset count after initial run
      const countAfterInit = loadCallCount;

      const changeCall = mockWatcherOn.mock.calls.find((c: unknown[]) => c[0] === 'change');
      const changeHandler = changeCall![1] as (filePath: string) => void;

      // Fire multiple changes rapidly
      changeHandler('/a.yaml');
      changeHandler('/b.yaml');
      changeHandler('/c.yaml');

      // Advance timers by debounce amount
      await jest.runAllTimersAsync();

      jest.useRealTimers();

      // Only one additional call should have happened after the debounce fires
      expect(loadCallCount - countAfterInit).toBe(1);
    });
  });

  describe('SIGINT graceful shutdown', () => {
    it('SIGINT handler closes the watcher', async () => {
      mockLoadFromDirectory.mockResolvedValue([]);

      await invokeWatch(['--directory', './scenarios']);

      const sigintCall = processOnSpy.mock.calls.find((c: unknown[]) => c[0] === 'SIGINT');
      expect(sigintCall).toBeDefined();

      const sigintHandler = sigintCall![1] as () => void;

      // Temporarily suppress the process.exit throw to allow watcher.close() assertion
      processExitSpy.mockImplementation(() => { /* swallow exit(0) */ });

      sigintHandler();

      // Allow the .then() callback to execute
      await Promise.resolve();
      await Promise.resolve();

      expect(mockWatcherClose).toHaveBeenCalled();
    });
  });

  describe('no scenarios found', () => {
    it('logs warning when no scenarios are found in directory', async () => {
      mockLoadFromDirectory.mockResolvedValue([]);

      await invokeWatch(['--directory', './empty-dir']);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n') +
        consoleErrorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      // The warning about no scenarios should be output
      expect(allOutput).toContain('No scenarios');
    });
  });
});
