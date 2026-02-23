/**
 * CLIAgent sub-module unit tests
 *
 * Tests for CLICommandRunner and CLIOutputParser.
 * Closes issue #130 (WS-F).
 */

import { EventEmitter } from 'events';
import { CLICommandRunner } from '../cli/CLICommandRunner';
import { CLIOutputParser } from '../cli/CLIOutputParser';
import { DEFAULT_CLI_CONFIG, StreamData } from '../cli/types';
import { TestLogger, LogLevel } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): TestLogger {
  return new TestLogger('test', LogLevel.ERROR);
}

function makeRunner(overrides: Partial<typeof DEFAULT_CLI_CONFIG> = {}): CLICommandRunner {
  const cfg = {
    ...DEFAULT_CLI_CONFIG,
    ...overrides,
    retryConfig: { maxRetries: 0, retryDelay: 0, retryOnExitCodes: [] }
  };
  return new CLICommandRunner(cfg as any, makeLogger());
}

// Spawn runner with shell:false so bash -c args are passed directly
function makeSpawnRunner(overrides: Partial<typeof DEFAULT_CLI_CONFIG> = {}): CLICommandRunner {
  const cfg = {
    ...DEFAULT_CLI_CONFIG,
    executionMode: 'spawn' as const,
    shell: false,
    ...overrides,
    retryConfig: { maxRetries: 0, retryDelay: 0, retryOnExitCodes: [] }
  };
  return new CLICommandRunner(cfg as any, makeLogger());
}

// ---------------------------------------------------------------------------
// CLICommandRunner tests
// ---------------------------------------------------------------------------

describe('CLICommandRunner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeCommand() - stdout capture', () => {
    it('captures stdout from a spawned process', async () => {
      // Use exec mode with a real echo command for portability
      const runner = makeRunner({ executionMode: 'exec' });
      const result = await runner.executeCommand('echo', ['hello-world']);
      expect(result.stdout).toContain('hello-world');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('executeCommand() - stderr capture', () => {
    it('captures stderr separately from stdout', async () => {
      // Use spawn mode with shell:false so bash receives its args directly
      const runner = makeSpawnRunner();
      const result = await runner.executeCommand(
        'bash',
        ['-c', 'echo out-msg; echo err-msg >&2']
      );
      expect(result.stdout).toContain('out-msg');
      expect(result.stderr).toContain('err-msg');
      expect(result.stdout).not.toContain('err-msg');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('executeCommand() - timeout', () => {
    it('rejects with a timeout error when the command exceeds the limit', async () => {
      const runner = makeRunner({ executionMode: 'spawn', defaultTimeout: 100 });
      // sleep 10 seconds - should be killed after 100ms
      await expect(
        runner.executeCommand('sleep', ['10'], { timeout: 100 })
      ).rejects.toThrow(/timeout/i);
    }, 5000);
  });

  describe('executeCommand() - exit code', () => {
    it('returns the correct non-zero exit code when a command fails', async () => {
      // Use spawn with shell:false so bash receives its args directly
      const runner = makeSpawnRunner();
      const result = await runner.executeCommand(
        'bash',
        ['-c', 'exit 42'],
        { expectedExitCodes: [42] }
      );
      expect(result.exitCode).toBe(42);
    });

    it('throws when the exit code is not in expectedExitCodes', async () => {
      const runner = makeSpawnRunner();
      await expect(
        runner.executeCommand('bash', ['-c', 'exit 3'], { expectedExitCodes: [0] })
      ).rejects.toThrow(/exit code/i);
    });
  });

  describe('getCommandHistory()', () => {
    it('records successful commands in history', async () => {
      const runner = makeRunner({ executionMode: 'exec' });
      await runner.executeCommand('echo', ['history-test']);
      const history = runner.getCommandHistory();
      expect(history.length).toBe(1);
      expect(history[0].stdout).toContain('history-test');
    });
  });

  describe('reset()', () => {
    it('clears output buffer and command history', async () => {
      const runner = makeRunner({ executionMode: 'exec' });
      await runner.executeCommand('echo', ['clear-test']);
      runner.reset();
      expect(runner.getCommandHistory()).toHaveLength(0);
      expect(runner.getOutputBuffer()).toHaveLength(0);
    });
  });

  describe('setEnvironmentVariable()', () => {
    it('injects custom environment variables into subsequent commands', async () => {
      // Use spawn with shell:false so bash receives its args directly
      const runner = makeSpawnRunner();
      runner.setEnvironmentVariable('MY_TEST_VAR', 'my-value');
      const result = await runner.executeCommand('bash', ['-c', 'echo $MY_TEST_VAR']);
      expect(result.stdout).toContain('my-value');
    });
  });
});

// ---------------------------------------------------------------------------
// CLIOutputParser tests
// ---------------------------------------------------------------------------

describe('CLIOutputParser', () => {
  const parser = new CLIOutputParser(5000);

  describe('validateOutput() - string exact match', () => {
    it('passes when output exactly matches the expected string', async () => {
      const result = await parser.validateOutput('hello world', 'hello world');
      expect(result).toBe(true);
    });

    it('fails when output does not match expected string', async () => {
      const result = await parser.validateOutput('hello world', 'goodbye world');
      expect(result).toBe(false);
    });
  });

  describe('validateOutput() - contains: prefix', () => {
    it('passes when output contains the expected substring', async () => {
      const result = await parser.validateOutput('hello world foo', 'contains:world');
      expect(result).toBe(true);
    });

    it('fails when output does not contain the expected substring', async () => {
      const result = await parser.validateOutput('hello world', 'contains:missing');
      expect(result).toBe(false);
    });
  });

  describe('validateOutput() - regex: prefix', () => {
    it('passes when output matches the regex pattern', async () => {
      const result = await parser.validateOutput('Error: something went wrong', 'regex:error');
      expect(result).toBe(true);
    });

    it('fails when output does not match the regex pattern', async () => {
      const result = await parser.validateOutput('all good here', 'regex:^Error');
      expect(result).toBe(false);
    });
  });

  describe('validateOutput() - object type validators', () => {
    it('passes for type:contains when substring present', async () => {
      const result = await parser.validateOutput('hello world', { type: 'contains', value: 'world' });
      expect(result).toBe(true);
    });

    it('passes for type:not_contains when substring absent', async () => {
      const result = await parser.validateOutput('hello world', { type: 'not_contains', value: 'xyz' });
      expect(result).toBe(true);
    });

    it('passes for type:empty when output is whitespace only', async () => {
      const result = await parser.validateOutput('   ', { type: 'empty' });
      expect(result).toBe(true);
    });

    it('passes for type:not_empty when output has content', async () => {
      const result = await parser.validateOutput('some content', { type: 'not_empty' });
      expect(result).toBe(true);
    });

    it('passes for type:starts_with', async () => {
      const result = await parser.validateOutput('hello world', { type: 'starts_with', value: 'hello' });
      expect(result).toBe(true);
    });

    it('passes for type:ends_with', async () => {
      const result = await parser.validateOutput('hello world', { type: 'ends_with', value: 'world' });
      expect(result).toBe(true);
    });

    it('passes for type:json when data matches deeply', async () => {
      const result = await parser.validateOutput(JSON.stringify({ a: 1 }), { type: 'json', value: { a: 1 } });
      expect(result).toBe(true);
    });

    it('fails for type:json when JSON is malformed', async () => {
      const result = await parser.validateOutput('not-json', { type: 'json', value: { a: 1 } });
      expect(result).toBe(false);
    });

    it('throws for unsupported validation type', async () => {
      await expect(parser.validateOutput('x', { type: 'unknown_type' })).rejects.toThrow(/unsupported/i);
    });
  });

  describe('captureOutput()', () => {
    it('separates stdout and stderr from the output buffer', () => {
      const now = new Date();
      const buffer: StreamData[] = [
        { type: 'stdout', data: 'out-line\n', timestamp: new Date(now.getTime() + 1) },
        { type: 'stderr', data: 'err-line\n', timestamp: new Date(now.getTime() + 2) },
        { type: 'stdout', data: 'out-line2\n', timestamp: new Date(now.getTime() + 3) }
      ];
      const { stdout, stderr, combined } = parser.captureOutput(buffer);
      expect(stdout).toBe('out-line\nout-line2\n');
      expect(stderr).toBe('err-line\n');
      expect(combined).toContain('out-line');
      expect(combined).toContain('err-line');
    });

    it('returns empty strings for an empty buffer', () => {
      const { stdout, stderr, combined } = parser.captureOutput([]);
      expect(stdout).toBe('');
      expect(stderr).toBe('');
      expect(combined).toBe('');
    });
  });

  describe('validateExitCode()', () => {
    it('returns the correct exit code from the last command in history', () => {
      const history = [
        { command: 'cmd1', exitCode: 0, stdout: '', stderr: '', duration: 1 },
        { command: 'cmd2', exitCode: 42, stdout: '', stderr: '', duration: 2 }
      ];
      expect(parser.validateExitCode(history, 42)).toBe(true);
      expect(parser.validateExitCode(history, 0)).toBe(false);
    });

    it('throws when command history is empty', () => {
      expect(() => parser.validateExitCode([], 0)).toThrow(/no command history/i);
    });
  });

  describe('getLatestOutput()', () => {
    it('returns combined stdout+stderr from the last command', () => {
      const history = [
        { command: 'cmd', exitCode: 0, stdout: 'out-text', stderr: 'err-text', duration: 1 }
      ];
      const output = parser.getLatestOutput(history, []);
      expect(output).toContain('out-text');
      expect(output).toContain('err-text');
    });

    it('falls back to output buffer when history is empty', () => {
      const buffer: StreamData[] = [
        { type: 'stdout', data: 'buffered', timestamp: new Date() }
      ];
      const output = parser.getLatestOutput([], buffer);
      expect(output).toContain('buffered');
    });
  });

  describe('waitForOutput()', () => {
    it('resolves when the pattern appears in the output supplier', async () => {
      let callCount = 0;
      const getOutput = () => {
        callCount++;
        return callCount >= 3 ? 'found the pattern here' : 'not yet';
      };
      const result = await parser.waitForOutput('found the pattern', getOutput, 2000);
      expect(result).toContain('found the pattern');
    });

    it('rejects when the pattern does not appear within the timeout', async () => {
      const getOutput = () => 'never matches';
      await expect(parser.waitForOutput('will-never-match', getOutput, 150)).rejects.toThrow(/timeout/i);
    }, 3000);
  });
});
