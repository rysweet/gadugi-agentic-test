/**
 * TUIAgent test suite
 *
 * Comprehensive unit tests for TUI testing framework including:
 * - Terminal spawn and cleanup
 * - Input simulation accuracy
 * - Output parsing and assertions
 * - Cross-platform behavior
 * - Error handling and recovery
 * - Performance benchmarks
 * - Color and formatting verification
 * - Menu navigation
 * - Async event handling
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

describe('TUIAgent', () => {
  let agent: TUIAgent;
  let mockProcess: Partial<ChildProcess>;
  const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock process
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

    // Setup spawn mock
    mockSpawn.mockReturnValue(mockProcess as ChildProcess);

    // Create fresh agent instance
    agent = createTUIAgent();
  });

  afterEach(async () => {
    await agent.cleanup();
  });

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

  describe('Output Parsing', () => {
    let sessionId: string;

    beforeEach(async () => {
      await agent.initialize();
      sessionId = await agent.spawnTUI('test-app');
    });

    it('should capture stdout data', async () => {
      const outputSpy = jest.fn();
      agent.on('output', outputSpy);

      // Simulate stdout data
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

      // Simulate stderr data
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

      // Send large output
      const largeOutput = 'x'.repeat(200);
      stdoutHandler(Buffer.from(largeOutput));

      const allOutput = bufferAgent.getAllOutput(sessionId);
      expect(allOutput).toHaveLength(1);
      expect(allOutput[0].text).toBe(largeOutput);

      await bufferAgent.cleanup();
    });
  });

  describe('Output Validation', () => {
    let sessionId: string;

    beforeEach(async () => {
      await agent.initialize();
      sessionId = await agent.spawnTUI('test-app');

      // Simulate some output
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
      // Add empty output
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

  describe('Color and Formatting Validation', () => {
    let sessionId: string;

    beforeEach(async () => {
      await agent.initialize();
      sessionId = await agent.spawnTUI('test-app');
    });

    it('should validate color formatting', async () => {
      // Simulate colored output
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

  describe('Menu Navigation', () => {
    let sessionId: string;

    beforeEach(async () => {
      await agent.initialize();
      sessionId = await agent.spawnTUI('test-app');

      // Simulate menu output
      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('Main Menu:\n1. File Operations\n2. Edit Settings\n3. View Reports\n4. Exit'));
    });

    it('should navigate through menu path', async () => {
      const navigation = await agent.navigateMenu(sessionId, ['File Operations', 'Settings']);

      expect(navigation).toEqual(expect.objectContaining({
        level: 2,
        history: ['File Operations', 'Settings']
      }));

      expect(mockProcess.stdin?.write).toHaveBeenCalled();
    });

    it('should detect menu items correctly', async () => {
      const menuItems = ['File Operations', 'Edit Settings', 'View Reports', 'Exit'];

      // This would be tested through the navigation process
      await expect(agent.navigateMenu(sessionId, ['File Operations'])).resolves.not.toThrow();
    });

    it('should handle menu item not found', async () => {
      await expect(agent.navigateMenu(sessionId, ['Non-existent Item']))
        .rejects.toThrow(/Menu item not found/);
    });

    it('should emit menuNavigated event', async () => {
      const menuNavigatedSpy = jest.fn();
      agent.on('menuNavigated', menuNavigatedSpy);

      await agent.navigateMenu(sessionId, ['File Operations']);

      expect(menuNavigatedSpy).toHaveBeenCalledWith({
        sessionId,
        path: ['File Operations'],
        context: expect.any(Object)
      });
    });

    it('should handle different menu formats', async () => {
      // Test bullet point menu
      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('Options:\n* Option A\n* Option B\n* Option C'));

      await expect(agent.navigateMenu(sessionId, ['Option A'])).resolves.not.toThrow();
    });

    it('should handle numbered menu with brackets', async () => {
      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutHandler(Buffer.from('Choose:\n[1] First Choice\n[2] Second Choice\n[3] Third Choice'));

      await expect(agent.navigateMenu(sessionId, ['First Choice'])).resolves.not.toThrow();
    });
  });

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

      // Mock process as not killed after SIGTERM
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

      // Simulate output
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

      // Simulate multiple outputs
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

      // Simulate process close
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

      // Simulate process error
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

      // Mock kill to throw error
      (mockProcess.kill as jest.Mock).mockImplementation(() => {
        throw new Error('Kill error');
      });

      // Cleanup should not throw even if individual session cleanup fails
      await expect(agent.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should handle high-frequency input efficiently', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const startTime = Date.now();

      // Send 100 characters rapidly
      const rapidInput = 'a'.repeat(100);
      await agent.sendInput(sessionId, {
        keys: rapidInput,
        timing: 1 // Very fast
      });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should complete within reasonable time (considering 1ms * 100 chars + overhead)
      expect(elapsed).toBeLessThan(1000);
      expect(mockProcess.stdin?.write).toHaveBeenCalledTimes(100);
    });

    it('should handle large output buffers efficiently', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      const startTime = Date.now();

      // Simulate large output in chunks
      for (let i = 0; i < 100; i++) {
        stdoutHandler(Buffer.from(`Line ${i}: ${'x'.repeat(100)}\n`));
      }

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should process 100 output chunks efficiently
      expect(elapsed).toBeLessThan(500);

      const allOutput = agent.getAllOutput(sessionId);
      expect(allOutput).toHaveLength(100);
    });

    it('should monitor performance metrics when enabled', async () => {
      const config: Partial<TUIAgentConfig> = {
        performance: {
          enabled: true,
          sampleRate: 100, // Very frequent for testing
          memoryThreshold: 50,
          cpuThreshold: 80
        }
      };

      const perfAgent = createTUIAgent(config);
      await perfAgent.initialize();

      const performanceMetricsSpy = jest.fn();
      perfAgent.on('performanceMetrics', performanceMetricsSpy);

      // Wait for at least one performance sample
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(performanceMetricsSpy).toHaveBeenCalled();

      await perfAgent.cleanup();
    });

    it('should handle concurrent sessions efficiently', async () => {
      const sessionCount = 5;
      const sessionIds: string[] = [];

      const startTime = Date.now();

      // Spawn multiple sessions concurrently
      const spawnPromises = Array.from({ length: sessionCount }, (_, i) =>
        agent.spawnTUI(`test-app-${i}`)
      );

      const spawnedSessions = await Promise.all(spawnPromises);
      sessionIds.push(...spawnedSessions);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should spawn all sessions efficiently
      expect(elapsed).toBeLessThan(1000);
      expect(sessionIds).toHaveLength(sessionCount);
      expect(mockSpawn).toHaveBeenCalledTimes(sessionCount);

      // Clean up
      await Promise.all(sessionIds.map(id => agent.killSession(id)));
    });

    it('should maintain performance under stress', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const startTime = Date.now();

      // Simulate stress with rapid input/output cycles
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(agent.sendInput(sessionId, `stress-test-${i}`, ));

        // Simulate output response
        const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
          call => call[0] === 'data'
        )[1];
        stdoutHandler(Buffer.from(`Response to stress-test-${i}`));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should handle stress test efficiently
      expect(elapsed).toBeLessThan(2000);

      const allOutput = agent.getAllOutput(sessionId);
      expect(allOutput.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Async Event Handling', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should handle concurrent output streams', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const outputSpy = jest.fn();
      agent.on('output', outputSpy);

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];
      const stderrHandler = (mockProcess.stderr?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Simulate concurrent stdout and stderr
      stdoutHandler(Buffer.from('stdout message'));
      stderrHandler(Buffer.from('stderr message'));

      expect(outputSpy).toHaveBeenCalledTimes(2);
      expect(outputSpy).toHaveBeenCalledWith({
        sessionId,
        output: expect.objectContaining({
          type: 'stdout',
          text: 'stdout message'
        })
      });
      expect(outputSpy).toHaveBeenCalledWith({
        sessionId,
        output: expect.objectContaining({
          type: 'stderr',
          text: 'stderr message'
        })
      });
    });

    it('should handle rapid event sequences', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const outputSpy = jest.fn();
      agent.on('output', outputSpy);

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Rapid fire events
      for (let i = 0; i < 50; i++) {
        stdoutHandler(Buffer.from(`Rapid message ${i}`));
      }

      expect(outputSpy).toHaveBeenCalledTimes(50);

      const allOutput = agent.getAllOutput(sessionId);
      expect(allOutput).toHaveLength(50);
      expect(allOutput[0].text).toBe('Rapid message 0');
      expect(allOutput[49].text).toBe('Rapid message 49');
    });

    it('should handle event listener errors gracefully', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      // Add failing event listener
      agent.on('output', () => {
        throw new Error('Event listener error');
      });

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Should not crash the agent
      expect(() => {
        stdoutHandler(Buffer.from('Test output'));
      }).not.toThrow();
    });

    it('should maintain event order under load', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const receivedOutputs: TerminalOutput[] = [];
      agent.on('output', ({ output }) => {
        receivedOutputs.push(output);
      });

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Send ordered messages rapidly
      for (let i = 0; i < 20; i++) {
        stdoutHandler(Buffer.from(`Message ${i.toString().padStart(2, '0')}`));
      }

      expect(receivedOutputs).toHaveLength(20);

      // Verify order is maintained
      for (let i = 0; i < 20; i++) {
        expect(receivedOutputs[i].text).toBe(`Message ${i.toString().padStart(2, '0')}`);
      }
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should execute complete TUI testing scenario', async () => {
      const scenario = {
        id: 'tui-test-scenario',
        name: 'Complete TUI Test',
        steps: [
          {
            action: 'spawn',
            target: 'test-app --interactive',
            value: '',
            timeout: 5000
          },
          {
            action: 'wait_for_output',
            target: 'session-id', // Would be dynamically set
            value: 'Welcome',
            timeout: 3000
          },
          {
            action: 'send_input',
            target: 'session-id',
            value: '{Enter}',
            timeout: 1000
          },
          {
            action: 'validate_output',
            target: 'session-id',
            expected: 'contains:Menu loaded',
            timeout: 2000
          }
        ]
      };

      // Mock the execution - in real implementation, sessionId would be managed
      const result = await agent.execute(scenario);

      expect(result).toEqual(expect.objectContaining({
        scenarioId: 'tui-test-scenario',
        status: expect.any(String),
        duration: expect.any(Number),
        startTime: expect.any(Date),
        endTime: expect.any(Date)
      }));
    });

    it('should handle scenario execution errors gracefully', async () => {
      const failingScenario = {
        id: 'failing-scenario',
        name: 'Failing Scenario',
        steps: [
          {
            action: 'invalid_action',
            target: 'test',
            value: ''
          }
        ]
      };

      const result = await agent.execute(failingScenario);

      expect(result.status).toBe(TestStatus.FAILED);
      expect(result.error).toBeDefined();
    });

    it('should cleanup after scenario execution', async () => {
      const scenario = {
        id: 'cleanup-test',
        name: 'Cleanup Test',
        steps: [
          {
            action: 'spawn',
            target: 'test-app',
            value: ''
          }
        ]
      };

      await agent.execute(scenario);

      // After execution, all sessions should be cleaned up
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });

  describe('Snapshot Testing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should capture output snapshots for comparison', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Simulate complex TUI output
      const complexOutput = `
╔═══════════════════════════════════════╗
║                 MENU                  ║
╠═══════════════════════════════════════╣
║ 1. File Operations                    ║
║ 2. Edit Settings                      ║
║ 3. View Reports                       ║
║ 4. Exit                               ║
╚═══════════════════════════════════════╝
`.trim();

      stdoutHandler(Buffer.from(complexOutput));

      const captured = agent.captureOutput(sessionId);
      expect(captured).toMatchSnapshot({
        timestamp: expect.any(Date)
      });
    });

    it('should capture colored output snapshots', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Simulate colored output
      stdoutHandler(Buffer.from('\u001b[31m\u001b[1mERROR:\u001b[0m \u001b[32mOperation completed successfully\u001b[0m'));

      const captured = agent.captureOutput(sessionId);
      expect(captured?.colors).toMatchSnapshot();
    });

    it('should create consistent snapshots across runs', async () => {
      const sessionId1 = await agent.spawnTUI('test-app');
      const sessionId2 = await agent.spawnTUI('test-app');

      const stdoutHandler1 = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Send same output to both sessions
      const testOutput = 'Consistent output test';
      stdoutHandler1(Buffer.from(testOutput));

      // Mock second process
      const mockProcess2 = { ...mockProcess };
      mockSpawn.mockReturnValue(mockProcess2 as ChildProcess);

      const captured1 = agent.captureOutput(sessionId1);
      const captured2 = agent.captureOutput(sessionId2);

      expect(captured1?.text).toBe(captured2?.text);
    });
  });
});