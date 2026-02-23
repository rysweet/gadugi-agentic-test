/**
 * Tests for src/cli/output.ts
 * Covers: logSuccess, logError, logWarning, logInfo, CLIError, handleCommandError
 */

// Mock chalk BEFORE importing anything that uses it.
// chalk v5 is ESM-only; jest runs in CJS mode, so we provide a CJS stub.
jest.mock('chalk', () => {
  const identity = (s: string) => s;
  const proxy: Record<string, unknown> = {};
  const colors = ['green', 'red', 'yellow', 'blue', 'gray', 'cyan', 'bold'];
  colors.forEach((c) => { proxy[c] = identity; });
  proxy.level = 0;
  // Allow chalk.green('x') style calls AND chalk('x') as a function
  const callable = Object.assign(identity, proxy);
  return { default: callable, __esModule: true };
});

// Mock cli-progress (used by createProgressBar — not under test here but imported)
jest.mock('cli-progress', () => ({
  SingleBar: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
  })),
  Presets: { rect: {} },
}));

import { logSuccess, logError, logWarning, logInfo, CLIError, handleCommandError } from '../../cli/output';

describe('output helpers', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`);
    }) as unknown as jest.SpyInstance;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('logSuccess', () => {
    it('writes the message to stdout via console.log', () => {
      logSuccess('everything is fine');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const args = consoleLogSpy.mock.calls[0];
      expect(args[1]).toBe('everything is fine');
    });

    it('includes an icon as the first argument', () => {
      logSuccess('ok');
      const args = consoleLogSpy.mock.calls[0];
      expect(args).toHaveLength(2);
      expect(typeof args[0]).toBe('string');
    });
  });

  describe('logError', () => {
    it('writes the message to stdout via console.log', () => {
      logError('something broke');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const args = consoleLogSpy.mock.calls[0];
      expect(args[1]).toBe('something broke');
    });
  });

  describe('logWarning', () => {
    it('writes the message to stdout via console.log', () => {
      logWarning('heads up');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const args = consoleLogSpy.mock.calls[0];
      expect(args[1]).toBe('heads up');
    });
  });

  describe('logInfo', () => {
    it('writes the message to stdout via console.log', () => {
      logInfo('for your information');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const args = consoleLogSpy.mock.calls[0];
      expect(args[1]).toBe('for your information');
    });
  });

  describe('CLIError', () => {
    it('has correct message', () => {
      const err = new CLIError('bad input');
      expect(err.message).toBe('bad input');
    });

    it('has name "CLIError"', () => {
      const err = new CLIError('bad input');
      expect(err.name).toBe('CLIError');
    });

    it('stores optional code', () => {
      const err = new CLIError('not found', 'ENOENT');
      expect(err.code).toBe('ENOENT');
    });

    it('code is undefined when not provided', () => {
      const err = new CLIError('no code');
      expect(err.code).toBeUndefined();
    });

    it('is an instance of Error', () => {
      const err = new CLIError('test');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('handleCommandError', () => {
    it('logs CLIError message and exits with code 1', () => {
      const err = new CLIError('invalid directory');
      expect(() => handleCommandError(err)).toThrow('process.exit(1)');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), 'invalid directory');
    });

    it('logs CLIError code when present', () => {
      const err = new CLIError('not found', 'DIR_NOT_FOUND');
      expect(() => handleCommandError(err)).toThrow('process.exit(1)');
      const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const codeCall = allCalls.some((c) => c.includes('DIR_NOT_FOUND'));
      expect(codeCall).toBe(true);
    });

    it('does not log CLIError code when absent', () => {
      const err = new CLIError('simple error');
      expect(() => handleCommandError(err)).toThrow('process.exit(1)');
      const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const codeCall = allCalls.some((c) => c.includes('Error code'));
      expect(codeCall).toBe(false);
    });

    it('passes unknown errors to console.error (not as a string)', () => {
      const unknownErr = new Error('some system error');
      expect(() => handleCommandError(unknownErr)).toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(unknownErr);
    });

    it('logs "Command failed:" message for generic errors', () => {
      const unknownErr = new Error('sys');
      expect(() => handleCommandError(unknownErr)).toThrow('process.exit(1)');
      const allLogCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const hasFailed = allLogCalls.some((c) => c.includes('Command failed'));
      expect(hasFailed).toBe(true);
    });

    it('exits with code 1 for CLIError', () => {
      const err = new CLIError('boom');
      try {
        handleCommandError(err);
      } catch {
        // swallow
      }
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 for generic error', () => {
      const err = new Error('generic');
      try {
        handleCommandError(err);
      } catch {
        // swallow
      }
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
