/**
 * Tests for src/cli/commands/run.ts
 * Covers: registerRunCommand, directory validation, scenario loading, orchestrator invocation
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

jest.mock('cli-progress', () => ({
  SingleBar: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
  })),
  Presets: { rect: {} },
}));

jest.mock('fs/promises');

// Mock ScenarioLoader
const mockLoadFromFile = jest.fn();
const mockLoadFromDirectory = jest.fn();
jest.mock('../../scenarios', () => ({
  ScenarioLoader: {
    loadFromFile: (...args: unknown[]) => mockLoadFromFile(...args),
    loadFromDirectory: (...args: unknown[]) => mockLoadFromDirectory(...args),
  },
}));

// Mock ConfigManager and logger
const mockLoadFromFileCfg = jest.fn();
const mockGetConfig = jest.fn();
jest.mock('../../utils', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  ConfigManager: jest.fn().mockImplementation(() => ({
    loadFromFile: mockLoadFromFileCfg,
    getConfig: mockGetConfig,
  })),
}));

// Mock createDefaultConfig from lib
jest.mock('../../lib', () => ({
  createDefaultConfig: jest.fn().mockReturnValue({
    execution: {
      defaultTimeout: 30000,
      resourceLimits: { maxExecutionTime: 300000 },
    },
    cli: { defaultTimeout: 30000 },
    ui: { defaultTimeout: 30000 },
    tui: { defaultTimeout: 30000 },
  }),
}));

// Mock TestOrchestrator (used via dynamic import inside the run action)
const mockRunWithScenarios = jest.fn();
jest.mock('../../orchestrator', () => ({
  TestOrchestrator: jest.fn().mockImplementation(() => ({
    runWithScenarios: mockRunWithScenarios,
  })),
}));

import { Command } from 'commander';
import * as fs from 'fs/promises';
import { registerRunCommand } from '../../cli/commands/run';

const mockFs = jest.mocked(fs);

// Build a fresh program and invoke the run command using Commander's parseAsync
async function invokeRun(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerRunCommand(program);
  await program.parseAsync(['run', ...args], { from: 'user' });
}

describe('registerRunCommand', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`);
    }) as unknown as jest.SpyInstance;

    // Default: directory accessible
    mockFs.access.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('registers a "run" command on the Commander program', () => {
    const program = new Command();
    registerRunCommand(program);
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('run');
  });

  it('loads scenarios from --directory option', async () => {
    mockLoadFromDirectory.mockResolvedValue([{ name: 'scen1', steps: [], assertions: [] }]);
    mockRunWithScenarios.mockResolvedValue({ summary: { passed: 1, failed: 0 } });

    await invokeRun(['--directory', './my-scenarios']);

    expect(mockLoadFromDirectory).toHaveBeenCalledWith('./my-scenarios');
  });

  it('loads a specific scenario via --scenario option', async () => {
    mockLoadFromFile.mockResolvedValue({ name: 'login', steps: [], assertions: [] });
    mockRunWithScenarios.mockResolvedValue({ summary: { passed: 1, failed: 0 } });

    await invokeRun(['--directory', './scenarios', '--scenario', 'login']);

    // path.join('./scenarios', 'login.yaml') normalizes to 'scenarios/login.yaml'
    expect(mockLoadFromFile).toHaveBeenCalledWith('scenarios/login.yaml');
  });

  it('applies --parallel flag without throwing', async () => {
    mockLoadFromDirectory.mockResolvedValue([{ name: 's1', steps: [], assertions: [] }]);
    mockRunWithScenarios.mockResolvedValue({ summary: { passed: 1, failed: 0 } });

    await expect(
      invokeRun(['--directory', './scenarios', '--parallel'])
    ).resolves.not.toThrow();
  });

  it('throws CLIError (process.exit 1) when directory is missing', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'));

    await expect(invokeRun(['--directory', './missing'])).rejects.toThrow('process.exit(1)');

    const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
    const hasDirError = allCalls.some(
      (c) => c.includes('missing') || c.includes('not found') || c.includes('Directory')
    );
    expect(hasDirError).toBe(true);
  });

  it('outputs pass and fail counts on successful run', async () => {
    mockLoadFromDirectory.mockResolvedValue([
      { name: 's1', steps: [], assertions: [] },
      { name: 's2', steps: [], assertions: [] },
    ]);
    mockRunWithScenarios.mockResolvedValue({ summary: { passed: 2, failed: 0 } });

    await invokeRun(['--directory', './scenarios']);

    const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
    const hasPassedCount = allCalls.some(
      (c) => c.includes('2') && (c.includes('Passed') || c.includes('passed'))
    );
    expect(hasPassedCount).toBe(true);
  });

  it('calls process.exit(1) when some tests fail', async () => {
    mockLoadFromDirectory.mockResolvedValue([{ name: 's1', steps: [], assertions: [] }]);
    mockRunWithScenarios.mockResolvedValue({ summary: { passed: 0, failed: 1 } });

    await expect(invokeRun(['--directory', './scenarios'])).rejects.toThrow('process.exit(1)');
  });

  it('does not call process.exit when all tests pass', async () => {
    mockLoadFromDirectory.mockResolvedValue([{ name: 's1', steps: [], assertions: [] }]);
    mockRunWithScenarios.mockResolvedValue({ summary: { passed: 1, failed: 0 } });

    await invokeRun(['--directory', './scenarios']);

    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('routes unknown errors through handleCommandError (raw error to console.error)', async () => {
    mockLoadFromDirectory.mockRejectedValue(new Error('Unexpected crash'));

    await expect(invokeRun(['--directory', './scenarios'])).rejects.toThrow('process.exit(1)');

    // Non-CLIError should be passed to console.error as the raw object
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('warns when no scenarios found', async () => {
    mockLoadFromDirectory.mockResolvedValue([]);

    await invokeRun(['--directory', './scenarios']);

    const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
    const hasWarning = allCalls.some(
      (c) => c.includes('No scenarios') || c.includes('no scenarios')
    );
    expect(hasWarning).toBe(true);
  });
});
