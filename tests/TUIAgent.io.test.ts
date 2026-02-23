/**
 * TUIAgent I/O tests
 *
 * Covers: Input Simulation (sendInput, special keys, InputSimulation object,
 * keystroke timing, error cases, and input events).
 *
 * Split from tests/TUIAgent.test.ts (1368 LOC) which was too large for
 * effective maintenance. This file preserves all original test cases for
 * the input/output interaction concern area.
 */

import { TUIAgent, createTUIAgent, TUIAgentConfig, InputSimulation } from '../src/agents/TUIAgent';
import { spawn, ChildProcess } from 'child_process';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn((_cmd: string, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    cb(null, '', '');
    return {} as any;
  }),
}));

describe('TUIAgent I/O', () => {
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
  // Input Simulation
  // -------------------------------------------------------------------------

  describe('Input Simulation', () => {
    let sessionId: string;

    beforeEach(async () => {
      await agent.initialize();
      sessionId = await agent.spawnTUI('test-app');
    });

    it('should send simple string input', async () => {
      await agent.sendInput(sessionId, 'hello world');

      expect(mockProcess.stdin?.write).toHaveBeenCalledTimes(11); // One call per character
      expect(mockProcess.stdin?.write).toHaveBeenCalledWith('h');
      expect(mockProcess.stdin?.write).toHaveBeenCalledWith('e');
      expect(mockProcess.stdin?.write).toHaveBeenCalledWith('l');
    });

    it('should process special keys correctly', async () => {
      await agent.sendInput(sessionId, '{Enter}{Tab}{Escape}');

      // Depends on platform, but should convert special keys
      expect(mockProcess.stdin?.write).toHaveBeenCalled();
    });

    it('should handle InputSimulation object', async () => {
      const inputSim: InputSimulation = {
        keys: 'test input',
        timing: 25,
        waitForStabilization: true,
        timeout: 5000
      };

      await agent.sendInput(sessionId, inputSim);

      expect(mockProcess.stdin?.write).toHaveBeenCalledTimes(10); // "test input" = 10 chars
    });

    it('should respect keystroke timing', async () => {
      const startTime = Date.now();

      const inputSim: InputSimulation = {
        keys: 'abc',
        timing: 100
      };

      await agent.sendInput(sessionId, inputSim);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should take at least 200ms (2 delays between 3 characters) + response delay
      expect(elapsed).toBeGreaterThan(250);
    });

    it('should handle non-existent session', async () => {
      await expect(agent.sendInput('invalid-session', 'test')).rejects.toThrow(/Session not found/);
    });

    it('should handle killed session', async () => {
      await agent.killSession(sessionId);
      await expect(agent.sendInput(sessionId, 'test')).rejects.toThrow(/Session not found or not running/);
    });

    it('should emit inputSent event', async () => {
      const inputSentSpy = jest.fn();
      agent.on('inputSent', inputSentSpy);

      await agent.sendInput(sessionId, 'test');

      expect(inputSentSpy).toHaveBeenCalledWith({
        sessionId,
        input: 'test'
      });
    });

    it('should handle input with special characters', async () => {
      const specialInput = 'hello\nworld\ttab\x1b[A'; // newline, tab, escape sequence
      await agent.sendInput(sessionId, specialInput);

      expect(mockProcess.stdin?.write).toHaveBeenCalledTimes(specialInput.length);
    });
  });
});
