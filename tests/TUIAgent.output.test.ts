/**
 * TUIAgent output tests
 *
 * Covers: Output Parsing (stdout/stderr capture, ANSI stripping, color parsing,
 * timing, buffers), Output Validation (exact match, contains, regex, complex objects,
 * length), Color and Formatting Validation.
 *
 * Split from tests/TUIAgent.test.ts (1368 LOC) which was too large for
 * effective maintenance. This file preserves all original test cases for
 * the output parsing and validation concern area.
 */

import { TUIAgent, createTUIAgent, TUIAgentConfig, TerminalOutput, ColorInfo } from '../src/agents/TUIAgent';
import { spawn, ChildProcess } from 'child_process';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn((_cmd: string, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    cb(null, '', '');
    return {} as any;
  }),
}));

describe('TUIAgent output', () => {
  let agent: TUIAgent;
  let mockProcess: Partial<ChildProcess>;
  const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProcess = {
      pid: 12345,
      stdin: {
        write: jest.fn(),
        end: jest.fn()
      } as any,
      stdout: {
        on: jest.fn(),
        setRawMode: jest.fn()
      } as any,
      stderr: {
        on: jest.fn()
      } as any,
      on: jest.fn(),
      kill: jest.fn(),
      killed: false
    };

    mockSpawn.mockReturnValue(mockProcess as ChildProcess);
    agent = createTUIAgent();
  });

  afterEach(async () => {
    await agent.cleanup();
  });

  // -------------------------------------------------------------------------
  // Output Parsing
  // -------------------------------------------------------------------------

  describe('Output Parsing', () => {
    let sessionId: string;

    beforeEach(async () => {
      await agent.initialize();
      sessionId = await agent.spawnTUI('test-app');
    });

    it('should capture stdout data', async () => {
      const outputSpy = jest.fn();
      agent.on('output', outputSpy);

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      stdoutHandler(Buffer.from('Hello World'));

      expect(outputSpy).toHaveBeenCalledWith({
        sessionId,
        output: expect.objectContaining({
          type: 'stdout',
          raw: 'Hello World',
          text: 'Hello World',
          timestamp: expect.any(Date)
        })
      });
    });

    it('should capture stderr data', async () => {
      const outputSpy = jest.fn();
      agent.on('output', outputSpy);

      const stderrHandler = (mockProcess.stderr?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      stderrHandler(Buffer.from('Error message'));

      expect(outputSpy).toHaveBeenCalledWith({
        sessionId,
        output: expect.objectContaining({
          type: 'stderr',
          raw: 'Error message',
          text: 'Error message',
          timestamp: expect.any(Date)
        })
      });
    });

    it('should strip ANSI codes from text', async () => {
      const outputSpy = jest.fn();
      agent.on('output', outputSpy);

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Text with ANSI color codes
      stdoutHandler(Buffer.from('\u001b[31mRed Text\u001b[0m'));

      expect(outputSpy).toHaveBeenCalledWith({
        sessionId,
        output: expect.objectContaining({
          raw: '\u001b[31mRed Text\u001b[0m',
          text: 'Red Text'
        })
      });
    });

    it('should parse color information', async () => {
      const outputSpy = jest.fn();
      agent.on('output', outputSpy);

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      stdoutHandler(Buffer.from('\u001b[31m\u001b[1mBold Red\u001b[0m'));

      expect(outputSpy).toHaveBeenCalledWith({
        sessionId,
        output: expect.objectContaining({
          colors: expect.arrayContaining([
            expect.objectContaining({
              text: 'Bold Red',
              fg: 'red',
              styles: expect.arrayContaining(['bold'])
            })
          ])
        })
      });
    });

    it('should capture output with timing', async () => {
      const config: Partial<TUIAgentConfig> = {
        outputCapture: {
          preserveColors: true,
          bufferSize: 1024,
          captureTiming: true
        }
      };

      const timingAgent = createTUIAgent(config);
      await timingAgent.initialize();
      const sessionId = await timingAgent.spawnTUI('test-app');

      const outputSpy = jest.fn();
      timingAgent.on('output', outputSpy);

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      const before = Date.now();
      stdoutHandler(Buffer.from('Timed output'));
      const after = Date.now();

      expect(outputSpy).toHaveBeenCalledWith({
        sessionId,
        output: expect.objectContaining({
          timestamp: expect.any(Date)
        })
      });

      const capturedTimestamp = outputSpy.mock.calls[0][0].output.timestamp.getTime();
      expect(capturedTimestamp).toBeGreaterThanOrEqual(before);
      expect(capturedTimestamp).toBeLessThanOrEqual(after);

      await timingAgent.cleanup();
    });

    it('should handle large output buffers', async () => {
      const config: Partial<TUIAgentConfig> = {
        outputCapture: {
          preserveColors: true,
          bufferSize: 100, // Small buffer for testing
          captureTiming: false
        }
      };

      const bufferAgent = createTUIAgent(config);
      await bufferAgent.initialize();
      const sessionId = await bufferAgent.spawnTUI('test-app');

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      const largeOutput = 'x'.repeat(200);
      stdoutHandler(Buffer.from(largeOutput));

      const allOutput = bufferAgent.getAllOutput(sessionId);
      expect(allOutput).toHaveLength(1);
      expect(allOutput[0].text).toBe(largeOutput);

      await bufferAgent.cleanup();
    });
  });

  // -------------------------------------------------------------------------
  // Output Validation
  // -------------------------------------------------------------------------

  describe('Output Validation', () => {
    let sessionId: string;

    beforeEach(async () => {
      await agent.initialize();
      sessionId = await agent.spawnTUI('test-app');

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('Welcome to the app\nSelect an option:\n1. Start\n2. Exit'));
    });

    it('should validate exact string match', async () => {
      const result = await agent.validateOutput(sessionId, 'Welcome to the app\nSelect an option:\n1. Start\n2. Exit');
      expect(result).toBe(true);
    });

    it('should validate contains pattern', async () => {
      const result = await agent.validateOutput(sessionId, 'contains:Welcome to the app');
      expect(result).toBe(true);

      const failResult = await agent.validateOutput(sessionId, 'contains:Not present');
      expect(failResult).toBe(false);
    });

    it('should validate regex patterns', async () => {
      const result = await agent.validateOutput(sessionId, 'regex:Welcome.*app');
      expect(result).toBe(true);

      const failResult = await agent.validateOutput(sessionId, 'regex:^Exit');
      expect(failResult).toBe(false);
    });

    it('should validate complex object patterns', async () => {
      const result = await agent.validateOutput(sessionId, {
        type: 'contains',
        value: 'Select an option'
      });
      expect(result).toBe(true);

      const failResult = await agent.validateOutput(sessionId, {
        type: 'starts_with',
        value: 'Exit'
      });
      expect(failResult).toBe(false);
    });

    it('should validate empty/not_empty patterns', async () => {
      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from(''));

      const result = await agent.validateOutput(sessionId, {
        type: 'not_empty',
        value: ''
      });
      expect(result).toBe(true); // Should use previous non-empty output
    });

    it('should handle validation with no output', async () => {
      const emptySessionId = await agent.spawnTUI('empty-app');
      const result = await agent.validateOutput(emptySessionId, 'any text');
      expect(result).toBe(false);
    });

    it('should validate length patterns', async () => {
      const result = await agent.validateOutput(sessionId, {
        type: 'length',
        value: 58 // Length of the test output
      });
      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Color and Formatting Validation
  // -------------------------------------------------------------------------

  describe('Color and Formatting Validation', () => {
    let sessionId: string;

    beforeEach(async () => {
      await agent.initialize();
      sessionId = await agent.spawnTUI('test-app');
    });

    it('should validate color formatting', async () => {
      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('\u001b[31m\u001b[1mError:\u001b[0m \u001b[32mSuccess\u001b[0m'));

      const expectedColors: ColorInfo[] = [
        {
          text: 'Error:',
          fg: 'red',
          styles: ['bold'],
          position: { start: 0, end: 6 }
        },
        {
          text: 'Success',
          fg: 'green',
          styles: [],
          position: { start: 7, end: 14 }
        }
      ];

      const result = await agent.validateFormatting(sessionId, expectedColors);
      expect(result).toBe(true);
    });

    it('should fail validation for incorrect colors', async () => {
      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('\u001b[31mRed text\u001b[0m'));

      const expectedColors: ColorInfo[] = [
        {
          text: 'Red text',
          fg: 'blue', // Wrong color
          styles: [],
          position: { start: 0, end: 8 }
        }
      ];

      const result = await agent.validateFormatting(sessionId, expectedColors);
      expect(result).toBe(false);
    });

    it('should handle sessions with no output', async () => {
      const emptySessionId = await agent.spawnTUI('empty-app');
      const result = await agent.validateFormatting(emptySessionId, []);
      expect(result).toBe(false);
    });

    it('should validate background colors', async () => {
      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('\u001b[31m\u001b[42mRed on Green\u001b[0m'));

      const expectedColors: ColorInfo[] = [
        {
          text: 'Red on Green',
          fg: 'red',
          bg: 'green',
          styles: [],
          position: { start: 0, end: 12 }
        }
      ];

      const result = await agent.validateFormatting(sessionId, expectedColors);
      expect(result).toBe(true);
    });

    it('should validate multiple text styles', async () => {
      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('\u001b[1m\u001b[3m\u001b[4mBold Italic Underline\u001b[0m'));

      const expectedColors: ColorInfo[] = [
        {
          text: 'Bold Italic Underline',
          styles: ['bold', 'italic', 'underline'],
          position: { start: 0, end: 21 }
        }
      ];

      const result = await agent.validateFormatting(sessionId, expectedColors);
      expect(result).toBe(true);
    });
  });
});
