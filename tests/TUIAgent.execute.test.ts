/**
 * TUIAgent execute/scenario tests
 *
 * Covers: Menu Navigation, Performance Benchmarks, Async Event Handling,
 * and Snapshot Testing.
 *
 * Split from tests/TUIAgent.test.ts (1368 LOC) which was too large for
 * effective maintenance. This file preserves all original test cases for
 * the scenario execution and menu navigation concern area.
 */

import { TUIAgent, createTUIAgent, TUIAgentConfig, TerminalOutput } from '../src/agents/TUIAgent';
import { TestStatus } from '../src/models/TestModels';
import { spawn, ChildProcess } from 'child_process';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn((_cmd: string, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    cb(null, '', '');
    return {} as any;
  }),
}));

describe('TUIAgent execute and menu navigation', () => {
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
  // Menu Navigation
  // -------------------------------------------------------------------------

  describe('Menu Navigation', () => {
    let sessionId: string;

    beforeEach(async () => {
      await agent.initialize();
      sessionId = await agent.spawnTUI('test-app');

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

  // -------------------------------------------------------------------------
  // Performance Benchmarks
  // -------------------------------------------------------------------------

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should handle high-frequency input efficiently', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const startTime = Date.now();

      const rapidInput = 'a'.repeat(100);
      await agent.sendInput(sessionId, {
        keys: rapidInput,
        timing: 1 // Very fast
      });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(elapsed).toBeLessThan(1000);
      expect(mockProcess.stdin?.write).toHaveBeenCalledTimes(100);
    });

    it('should handle large output buffers efficiently', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        stdoutHandler(Buffer.from(`Line ${i}: ${'x'.repeat(100)}\n`));
      }

      const endTime = Date.now();
      const elapsed = endTime - startTime;

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

      const spawnPromises = Array.from({ length: sessionCount }, (_, i) =>
        agent.spawnTUI(`test-app-${i}`)
      );

      const spawnedSessions = await Promise.all(spawnPromises);
      sessionIds.push(...spawnedSessions);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(elapsed).toBeLessThan(1000);
      expect(sessionIds).toHaveLength(sessionCount);
      expect(mockSpawn).toHaveBeenCalledTimes(sessionCount);

      await Promise.all(sessionIds.map(id => agent.killSession(id)));
    });

    it('should maintain performance under stress', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const startTime = Date.now();

      const promises: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(agent.sendInput(sessionId, `stress-test-${i}`, ));

        const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
          call => call[0] === 'data'
        )[1];
        stdoutHandler(Buffer.from(`Response to stress-test-${i}`));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(elapsed).toBeLessThan(2000);

      const allOutput = agent.getAllOutput(sessionId);
      expect(allOutput.length).toBeGreaterThanOrEqual(10);
    });
  });

  // -------------------------------------------------------------------------
  // Async Event Handling
  // -------------------------------------------------------------------------

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

      for (let i = 0; i < 20; i++) {
        stdoutHandler(Buffer.from(`Message ${i.toString().padStart(2, '0')}`));
      }

      expect(receivedOutputs).toHaveLength(20);

      for (let i = 0; i < 20; i++) {
        expect(receivedOutputs[i].text).toBe(`Message ${i.toString().padStart(2, '0')}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Snapshot Testing
  // -------------------------------------------------------------------------

  describe('Snapshot Testing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should capture output snapshots for comparison', async () => {
      const sessionId = await agent.spawnTUI('test-app');

      const stdoutHandler = (mockProcess.stdout?.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )[1];

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

      const testOutput = 'Consistent output test';
      stdoutHandler1(Buffer.from(testOutput));

      const mockProcess2 = { ...mockProcess };
      mockSpawn.mockReturnValue(mockProcess2 as ChildProcess);

      const captured1 = agent.captureOutput(sessionId1);
      const captured2 = agent.captureOutput(sessionId2);

      expect(captured1?.text).toBe(captured2?.text);
    });
  });
});
