/**
 * TUIAgent lifecycle tests
 *
 * Covers: Initialization, Terminal Spawning, Session Management,
 * Cross-Platform Behavior, and Error Handling.
 *
 * Split from tests/TUIAgent.test.ts (1368 LOC) which was too large for
 * effective maintenance. This file preserves all original test cases for
 * the lifecycle/session concern area.
 */

import { TUIAgent, createTUIAgent, TUIAgentConfig, TerminalSession, TerminalOutput, ColorInfo, InputSimulation, MenuNavigation } from '../src/agents/TUIAgent';
import { AgentType } from '../src/agents/index';
import { TestStatus } from '../src/models/TestModels';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock child_process for controlled testing.
// exec must be included because DockerMonitor.ts calls promisify(exec) at
// module load time (line 12). Without exec in the mock, promisify receives
// undefined and throws immediately when the module is imported. (#37)
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn((_cmd: string, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    cb(null, '', '');
    return {} as any;
  }),
}));

describe('TUIAgent lifecycle', () => {
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
  // Initialization
  // -------------------------------------------------------------------------

  describe('Initialization', () => {
    it('should have correct type and name', () => {
      expect(agent.type).toBe(AgentType.TUI);
      expect(agent.name).toBe('TUIAgent');
    });

    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<TUIAgentConfig> = {
        terminalSize: { cols: 120, rows: 30 },
        defaultTimeout: 45000,
        terminalType: 'xterm-256color',
        inputTiming: {
          keystrokeDelay: 25,
          responseDelay: 150,
          stabilizationTimeout: 3000
        }
      };

      const customAgent = createTUIAgent(customConfig);
      expect(customAgent).toBeInstanceOf(TUIAgent);
    });

    it('should setup platform-specific configuration', async () => {
      const config: Partial<TUIAgentConfig> = {
        crossPlatform: {
          keyMappings: {
            'linux': {
              'Enter': '\n',
              'Tab': '\t'
            }
          }
        }
      };

      const platformAgent = createTUIAgent(config);
      await expect(platformAgent.initialize()).resolves.not.toThrow();
      await platformAgent.cleanup();
    });

    it('should validate working directory', async () => {
      const invalidConfig: Partial<TUIAgentConfig> = {
        workingDirectory: '/nonexistent/directory/path'
      };

      const invalidAgent = createTUIAgent(invalidConfig);
      await expect(invalidAgent.initialize()).rejects.toThrow(/Working directory does not exist/);
    });

    it('should setup performance monitoring when enabled', async () => {
      const config: Partial<TUIAgentConfig> = {
        performance: {
          enabled: true,
          sampleRate: 500,
          memoryThreshold: 50,
          cpuThreshold: 70
        }
      };

      const perfAgent = createTUIAgent(config);
      await expect(perfAgent.initialize()).resolves.not.toThrow();
      await perfAgent.cleanup();
    });
  });

  // -------------------------------------------------------------------------
  // Terminal Spawning
  // -------------------------------------------------------------------------

  describe('Terminal Spawning', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should spawn TUI application successfully', async () => {
      const sessionId = await agent.spawnTUI('test-app', ['--interactive']);

      expect(mockSpawn).toHaveBeenCalledWith('test-app', ['--interactive'], expect.objectContaining({
        cwd: expect.any(String),
        env: expect.any(Object),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      }));

      expect(sessionId).toMatch(/^tui_\d+_[a-z0-9]+$/);
    });

    it('should handle spawn failure gracefully', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await expect(agent.spawnTUI('invalid-command')).rejects.toThrow(/Failed to spawn TUI application/);
    });

    it('should setup session handlers correctly', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      expect(mockProcess.stdout?.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockProcess.stderr?.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should emit sessionStarted event', async () => {
      const sessionStartedSpy = jest.fn();
      agent.on('sessionStarted', sessionStartedSpy);

      const sessionId = await agent.spawnTUI('test-app');

      expect(sessionStartedSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: sessionId,
        pid: 12345,
        command: 'test-app',
        status: 'running'
      }));
    });

    it('should handle missing process ID', async () => {
      Object.defineProperty(mockProcess, 'pid', { value: undefined, writable: true });

      await expect(agent.spawnTUI('test-app')).rejects.toThrow(/Failed to spawn process/);
    });

    it('should pass environment variables correctly', async () => {
      const config: Partial<TUIAgentConfig> = {
        environment: {
          CUSTOM_VAR: 'test-value',
          TERM: 'xterm-256color'
        }
      };

      const envAgent = createTUIAgent(config);
      await envAgent.initialize();

      await envAgent.spawnTUI('test-app');

      expect(mockSpawn).toHaveBeenCalledWith('test-app', [], expect.objectContaining({
        env: expect.objectContaining({
          CUSTOM_VAR: 'test-value',
          TERM: 'xterm-256color'
        })
      }));

      await envAgent.cleanup();
    });
  });

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------

  describe('Session Management', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should kill session gracefully', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      await agent.killSession(sessionId);

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should force kill session if graceful kill fails', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      Object.defineProperty(mockProcess, 'killed', { value: false, writable: true });

      await agent.killSession(sessionId);

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Wait for force kill timeout simulation
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    it('should emit sessionKilled event', async () => {
      const sessionKilledSpy = jest.fn();
      agent.on('sessionKilled', sessionKilledSpy);

      const sessionId = await agent.spawnTUI('test-app');
      await agent.killSession(sessionId);

      expect(sessionKilledSpy).toHaveBeenCalledWith({ sessionId });
    });

    it('should handle killing non-existent session', async () => {
      await expect(agent.killSession('invalid-session')).resolves.not.toThrow();
    });

    it('should capture output from session', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('Test output'));

      const captured = agent.captureOutput(sessionId);
      expect(captured).toEqual(expect.objectContaining({
        type: 'stdout',
        text: 'Test output'
      }));
    });

    it('should get all output from session', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('First output'));
      stdoutHandler(Buffer.from('Second output'));

      const allOutput = agent.getAllOutput(sessionId);
      expect(allOutput).toHaveLength(2);
      expect(allOutput[0].text).toBe('First output');
      expect(allOutput[1].text).toBe('Second output');
    });

    it('should handle process close event', async () => {
      const sessionClosedSpy = jest.fn();
      agent.on('sessionClosed', sessionClosedSpy);

      const sessionId = await agent.spawnTUI('test-app');

      const closeHandler = (mockProcess.on as jest.Mock).mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeHandler(0);

      expect(sessionClosedSpy).toHaveBeenCalledWith({
        sessionId,
        exitCode: 0
      });
    });

    it('should handle process error event', async () => {
      const sessionErrorSpy = jest.fn();
      agent.on('sessionError', sessionErrorSpy);

      const sessionId = await agent.spawnTUI('test-app');

      const errorHandler = (mockProcess.on as jest.Mock).mock.calls.find(
        call => call[0] === 'error'
      )[1];
      const testError = new Error('Process error');
      errorHandler(testError);

      expect(sessionErrorSpy).toHaveBeenCalledWith({
        sessionId,
        error: testError
      });
    });
  });

  // -------------------------------------------------------------------------
  // Cross-Platform Behavior
  // -------------------------------------------------------------------------

  describe('Cross-Platform Behavior', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should handle Windows platform correctly', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });

      const config: Partial<TUIAgentConfig> = {
        crossPlatform: {
          windowsPrefix: 'cmd /c',
          keyMappings: {
            'win32': {
              'Enter': '\r\n',
              'Tab': '\t'
            }
          }
        }
      };

      const winAgent = createTUIAgent(config);
      await winAgent.initialize();

      const sessionId = await winAgent.spawnTUI('test-app');
      await winAgent.sendInput(sessionId, '{Enter}');

      expect(mockProcess.stdin?.write).toHaveBeenCalledWith('\r');
      expect(mockProcess.stdin?.write).toHaveBeenCalledWith('\n');

      await winAgent.cleanup();
    });

    it('should handle macOS platform correctly', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });

      const config: Partial<TUIAgentConfig> = {
        crossPlatform: {
          keyMappings: {
            'darwin': {
              'Enter': '\n',
              'ArrowUp': '\u001b[A'
            }
          }
        }
      };

      const macAgent = createTUIAgent(config);
      await macAgent.initialize();

      const sessionId = await macAgent.spawnTUI('test-app');
      await macAgent.sendInput(sessionId, '{Enter}{ArrowUp}');

      expect(mockProcess.stdin?.write).toHaveBeenCalledWith('\n');
      expect(mockProcess.stdin?.write).toHaveBeenCalledWith('\u001b[A');

      await macAgent.cleanup();
    });

    it('should use fallback key mappings for unknown platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'unknown'
      });

      const agent = createTUIAgent();
      await agent.initialize();

      const sessionId = await agent.spawnTUI('test-app');
      await agent.sendInput(sessionId, '{Enter}');

      // Should fall back to Linux mappings
      expect(mockProcess.stdin?.write).toHaveBeenCalledWith('\n');

      await agent.cleanup();
    });
  });

  // -------------------------------------------------------------------------
  // Error Handling and Recovery
  // -------------------------------------------------------------------------

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should handle spawn errors gracefully', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Command not found');
      });

      await expect(agent.spawnTUI('nonexistent-command'))
        .rejects.toThrow(/Failed to spawn TUI application/);
    });

    it('should handle stdin write errors gracefully', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      (mockProcess.stdin?.write as jest.Mock).mockImplementation(() => {
        throw new Error('Broken pipe');
      });

      await expect(agent.sendInput(sessionId, 'test')).rejects.toThrow();
    });

    it('should handle process kill errors gracefully', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      (mockProcess.kill as jest.Mock).mockImplementation(() => {
        throw new Error('Kill failed');
      });

      await expect(agent.killSession(sessionId)).rejects.toThrow(/Failed to kill session/);
    });

    it('should handle initialization errors', async () => {
      const invalidConfig: Partial<TUIAgentConfig> = {
        workingDirectory: '\0invalid\0path'
      };

      const invalidAgent = createTUIAgent(invalidConfig);
      await expect(invalidAgent.initialize()).rejects.toThrow();
    });

    it('should handle execution without initialization', async () => {
      const uninitializedAgent = createTUIAgent();

      const scenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        steps: []
      };

      await expect(uninitializedAgent.execute(scenario))
        .rejects.toThrow(/Agent not initialized/);
    });

    it('should handle cleanup errors gracefully', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      (mockProcess.kill as jest.Mock).mockImplementation(() => {
        throw new Error('Kill error');
      });

      // Cleanup should not throw even if individual session cleanup fails
      await expect(agent.cleanup()).resolves.not.toThrow();
    });
  });
});
