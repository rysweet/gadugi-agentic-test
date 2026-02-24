/**
 * CLIAgent unit tests.
 *
 * All sub-modules (CLICommandRunner, CLIOutputParser, validateDirectory)
 * are mocked so no real processes are spawned. Tests cover:
 *   - constructor wiring
 *   - initialize() happy path and error path
 *   - executeStep() for each supported action
 *   - kill(), cleanup(), captureOutput()
 *   - createCLIAgent() factory
 */

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE imports
// ---------------------------------------------------------------------------

const mockRunnerInstance = {
  setupInteractiveResponses: jest.fn(),
  setEnvironmentVariables:   jest.fn(),
  setEnvironmentVariable:    jest.fn(),
  executeCommand:            jest.fn().mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' }),
  killProcess:               jest.fn().mockResolvedValue(undefined),
  killAllProcesses:          jest.fn().mockResolvedValue(undefined),
  getOutputBuffer:           jest.fn().mockReturnValue([]),
  getCommandHistory:         jest.fn().mockReturnValue([]),
  reset:                     jest.fn(),
};

const mockParserInstance = {
  getScenarioLogs:  jest.fn().mockReturnValue([]),
  waitForOutput:    jest.fn().mockResolvedValue('found'),
  validateOutput:   jest.fn().mockResolvedValue(true),
  validateExitCode: jest.fn().mockReturnValue(true),
  captureOutput:    jest.fn().mockReturnValue({ stdout: '', stderr: '', combined: '' }),
  getLatestOutput:  jest.fn().mockReturnValue('latest output'),
};

jest.mock('../agents/cli/CLICommandRunner', () => ({
  CLICommandRunner: jest.fn().mockImplementation(() => mockRunnerInstance),
}));

jest.mock('../agents/cli/CLIOutputParser', () => ({
  CLIOutputParser: jest.fn().mockImplementation(() => mockParserInstance),
}));

jest.mock('../utils/fileUtils', () => ({
  validateDirectory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => {
  const actual = jest.requireActual<typeof import('../utils/logger')>('../utils/logger');
  return {
    ...actual,
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  };
});

jest.mock('fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
  stat:   jest.fn().mockResolvedValue({ isDirectory: () => true }),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { CLIAgent, createCLIAgent } from '../agents/CLIAgent';
import { validateDirectory } from '../utils/fileUtils';
import * as fs from 'fs/promises';
import { TestStatus } from '../models/TestModels';

// ---------------------------------------------------------------------------

function makeStep(action: string, target = 'cmd', value?: string, timeout?: number) {
  return { action, target, value, timeout, description: '' };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset default mock behaviour
  mockRunnerInstance.executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });
  mockParserInstance.validateOutput.mockResolvedValue(true);
  mockParserInstance.captureOutput.mockReturnValue({ stdout: 'out', stderr: '', combined: 'out' });
  mockParserInstance.waitForOutput.mockResolvedValue('found');
});

// ===========================================================================
// constructor & factory
// ===========================================================================
describe('CLIAgent constructor', () => {
  it('constructs without throwing', () => {
    expect(() => new CLIAgent()).not.toThrow();
  });

  it('accepts a config override', () => {
    expect(() => new CLIAgent({ defaultTimeout: 9999 })).not.toThrow();
  });
});

describe('createCLIAgent()', () => {
  it('returns a CLIAgent instance', () => {
    const agent = createCLIAgent();
    expect(agent).toBeInstanceOf(CLIAgent);
  });
});

// ===========================================================================
// initialize()
// ===========================================================================
describe('CLIAgent.initialize()', () => {
  it('validates the working directory and sets isInitialized', async () => {
    const agent = new CLIAgent({ workingDirectory: '/tmp/workspace' });
    await agent.initialize();

    expect(validateDirectory).toHaveBeenCalledWith('/tmp/workspace');
    expect(mockRunnerInstance.setupInteractiveResponses).toHaveBeenCalled();
  });

  it('throws when validateDirectory rejects', async () => {
    (validateDirectory as jest.Mock).mockRejectedValueOnce(new Error('no such dir'));
    const agent = new CLIAgent();
    await expect(agent.initialize()).rejects.toThrow('Failed to initialize CLIAgent');
  });
});

// ===========================================================================
// executeStep() — each action
// ===========================================================================
describe('CLIAgent.executeStep()', () => {
  let agent: CLIAgent;

  beforeEach(async () => {
    agent = new CLIAgent();
    await agent.initialize();
  });

  it('execute action runs executeCommand and returns PASSED', async () => {
    const result = await agent.executeStep(makeStep('execute', 'echo hello'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockRunnerInstance.executeCommand).toHaveBeenCalled();
  });

  it('run action is an alias for execute', async () => {
    const result = await agent.executeStep(makeStep('run', 'echo'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('command action runs executeCommand', async () => {
    const result = await agent.executeStep(makeStep('command', 'ls'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('execute_with_input sends input to the command', async () => {
    const result = await agent.executeStep(makeStep('execute_with_input', 'cat /dev/stdin', 'hello'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockRunnerInstance.executeCommand).toHaveBeenCalled();
  });

  it('wait_for_output calls parser.waitForOutput', async () => {
    const result = await agent.executeStep(makeStep('wait_for_output', 'Ready'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockParserInstance.waitForOutput).toHaveBeenCalled();
  });

  it('validate_output calls parser.validateOutput', async () => {
    const result = await agent.executeStep(makeStep('validate_output', '', 'expected text'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockParserInstance.validateOutput).toHaveBeenCalled();
  });

  it('validate_exit_code calls parser.validateExitCode', async () => {
    const result = await agent.executeStep(makeStep('validate_exit_code', '', '0'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockParserInstance.validateExitCode).toHaveBeenCalled();
  });

  it('capture_output calls parser.captureOutput', async () => {
    const result = await agent.executeStep(makeStep('capture_output'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockParserInstance.captureOutput).toHaveBeenCalled();
  });

  it('kill action calls runner.killProcess with the target ID', async () => {
    const result = await agent.executeStep(makeStep('kill', '12345'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockRunnerInstance.killProcess).toHaveBeenCalledWith('12345');
  });

  it('kill_process action calls runner.killProcess', async () => {
    const result = await agent.executeStep(makeStep('kill_process', '99'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockRunnerInstance.killProcess).toHaveBeenCalledWith('99');
  });

  it('wait action delays and returns PASSED', async () => {
    jest.useFakeTimers();
    const promise = agent.executeStep(makeStep('wait', '', '10'), 0);
    jest.runAllTimersAsync();
    const result = await promise;
    expect(result.status).toBe(TestStatus.PASSED);
    jest.useRealTimers();
  });

  it('set_environment calls runner.setEnvironmentVariable', async () => {
    const result = await agent.executeStep(makeStep('set_environment', 'MY_VAR', 'my_value'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockRunnerInstance.setEnvironmentVariable).toHaveBeenCalledWith('MY_VAR', 'my_value');
  });

  it('change_directory updates working directory', async () => {
    const result = await agent.executeStep(makeStep('change_directory', '/tmp'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('file_exists returns PASSED when file accessible', async () => {
    (fs.access as jest.Mock).mockResolvedValueOnce(undefined);
    const result = await agent.executeStep(makeStep('file_exists', 'app.ts'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('file_exists returns PASSED (not throw) when access fails', async () => {
    (fs.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));
    const result = await agent.executeStep(makeStep('file_exists', 'missing.ts'), 0);
    // Returns false, not throws — still PASSED with false result
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('directory_exists returns PASSED when dir stat succeeds', async () => {
    (fs.stat as jest.Mock).mockResolvedValueOnce({ isDirectory: () => true });
    const result = await agent.executeStep(makeStep('directory_exists', '/tmp'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('unsupported action returns FAILED', async () => {
    const result = await agent.executeStep(makeStep('unknown_action'), 0);
    expect(result.status).toBe(TestStatus.FAILED);
    expect(result.error).toContain('Unsupported CLI action');
  });

  it('execute action with JSON env value parses it', async () => {
    const result = await agent.executeStep(
      makeStep('execute', 'node', '{"NODE_ENV":"test"}'),
      0
    );
    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockRunnerInstance.executeCommand).toHaveBeenCalled();
  });

  it('execute action with non-JSON value uses it as input', async () => {
    const result = await agent.executeStep(
      makeStep('execute', 'cat', 'plain-input'),
      0
    );
    expect(result.status).toBe(TestStatus.PASSED);
  });
});

// ===========================================================================
// executeCommand() public API
// ===========================================================================
describe('CLIAgent.executeCommand()', () => {
  it('delegates to runner.executeCommand', async () => {
    const agent = new CLIAgent();
    mockRunnerInstance.executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'result', stderr: '' });

    const result = await agent.executeCommand('echo', ['hello']);

    expect(mockRunnerInstance.executeCommand).toHaveBeenCalledWith('echo', ['hello'], {});
    expect(result.exitCode).toBe(0);
  });
});

// ===========================================================================
// validateOutput() / waitForOutput() / captureOutput()
// ===========================================================================
describe('CLIAgent public API wrappers', () => {
  let agent: CLIAgent;
  beforeEach(() => { agent = new CLIAgent(); });

  it('validateOutput() delegates to parser', async () => {
    mockParserInstance.validateOutput.mockResolvedValue(true);
    const result = await agent.validateOutput('actual output', 'expected');
    expect(result).toBe(true);
    expect(mockParserInstance.validateOutput).toHaveBeenCalledWith('actual output', 'expected');
  });

  it('waitForOutput() delegates to parser', async () => {
    mockParserInstance.waitForOutput.mockResolvedValue('matched');
    const result = await agent.waitForOutput('pattern');
    expect(result).toBe('matched');
  });

  it('captureOutput() delegates to parser', () => {
    mockParserInstance.captureOutput.mockReturnValue({ stdout: 'a', stderr: 'b', combined: 'ab' });
    const result = agent.captureOutput();
    expect(result.stdout).toBe('a');
  });
});

// ===========================================================================
// kill()
// ===========================================================================
describe('CLIAgent.kill()', () => {
  it('calls killProcess when a processId is given', async () => {
    const agent = new CLIAgent();
    await agent.kill('pid-123');
    expect(mockRunnerInstance.killProcess).toHaveBeenCalledWith('pid-123');
  });

  it('calls killAllProcesses when no processId given', async () => {
    const agent = new CLIAgent();
    await agent.kill();
    expect(mockRunnerInstance.killAllProcesses).toHaveBeenCalled();
  });
});

// ===========================================================================
// cleanup()
// ===========================================================================
describe('CLIAgent.cleanup()', () => {
  it('kills all processes and resets the runner', async () => {
    const agent = new CLIAgent();
    await agent.cleanup();

    expect(mockRunnerInstance.killAllProcesses).toHaveBeenCalled();
    expect(mockRunnerInstance.reset).toHaveBeenCalled();
  });

  it('does not throw when killAllProcesses fails (best-effort)', async () => {
    mockRunnerInstance.killAllProcesses.mockRejectedValueOnce(new Error('kill failed'));
    const agent = new CLIAgent();
    await expect(agent.cleanup()).resolves.not.toThrow();
  });
});
