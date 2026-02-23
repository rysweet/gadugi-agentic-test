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
});
