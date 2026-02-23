/**
 * TUIAgent integration test suite
 *
 * This file retains the integration/cross-cutting tests that exercise TUIAgent
 * end-to-end across multiple concerns (spawn → input → output → execute).
 *
 * The original 1368-line monolithic test file has been split into focused
 * concern-based files for maintainability (issue #132):
 *
 *   tests/TUIAgent.lifecycle.test.ts  — Initialization, spawning, sessions,
 *                                        cross-platform, error handling
 *   tests/TUIAgent.io.test.ts         — Input simulation and key handling
 *   tests/TUIAgent.output.test.ts     — Output parsing, validation, colors
 *   tests/TUIAgent.execute.test.ts    — Menu navigation, benchmarks, snapshots
 *
 * This file keeps the `Integration Scenarios` suite which exercises the full
 * execute() pipeline across all sub-systems simultaneously.
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

  // -------------------------------------------------------------------------
  // Integration Scenarios
  //
  // These tests exercise the full execute() pipeline and span multiple
  // sub-systems (initialization + spawning + step dispatch + cleanup).
  // They are kept here rather than in the focused split files because they
  // test the interactions between concerns rather than individual concerns.
  // -------------------------------------------------------------------------

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
});
