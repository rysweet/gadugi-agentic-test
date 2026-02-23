/**
 * Tests for ScenarioRouter IAgent registry (Issue #128 / B1)
 *
 * Verifies that:
 * 1. API scenarios route to APIAgent (previously silently dropped)
 * 2. Unknown interfaces fall back gracefully (failure reported)
 * 3. Registry-based routing uses IAgent interface, not concrete types
 * 4. All previously-supported interfaces (CLI, TUI, GUI, MIXED) still work
 */

import { ScenarioRouter } from '../src/orchestrator/ScenarioRouter';
import { IAgent } from '../src/agents';
import {
  OrchestratorScenario,
  TestInterface,
  TestStatus,
  Priority
} from '../src/models/TestModels';

// ---------------------------------------------------------------------------
// Logger mock
// ---------------------------------------------------------------------------

jest.mock('../src/utils/logger', () => {
  const LogLevel = { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };
  const noopLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn()
  };
  noopLogger.child.mockReturnValue(noopLogger);
  return {
    LogLevel,
    logger: noopLogger,
    createLogger: jest.fn().mockReturnValue(noopLogger)
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgent(name: string): jest.Mocked<IAgent> {
  return {
    name,
    type: name,
    initialize: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue({
      scenarioId: 'test',
      status: TestStatus.PASSED,
      duration: 10,
      startTime: new Date(),
      endTime: new Date()
    }),
    cleanup: jest.fn().mockResolvedValue(undefined)
  };
}

function makeScenario(
  id: string,
  iface: TestInterface,
  steps: { action: string; target: string }[] = []
): OrchestratorScenario {
  return {
    id,
    name: `Scenario ${id}`,
    description: 'test',
    priority: Priority.MEDIUM,
    interface: iface,
    prerequisites: [],
    steps: steps.map(s => ({ ...s, description: s.action })),
    verifications: [],
    expectedOutcome: 'pass',
    estimatedDuration: 1,
    tags: [],
    enabled: true
  };
}

function makeRouter(
  registry: Partial<Record<TestInterface, IAgent>>,
  overrides: Partial<{
    maxParallel: number;
    failFast: boolean;
    retryCount: number;
    abortController: AbortController;
  }> = {}
): ScenarioRouter {
  return new ScenarioRouter({
    agentRegistry: registry,
    maxParallel: overrides.maxParallel ?? 2,
    failFast: overrides.failFast ?? false,
    retryCount: overrides.retryCount ?? 0,
    abortController: overrides.abortController ?? new AbortController()
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScenarioRouter (IAgent registry)', () => {
  describe('CLI routing', () => {
    it('routes CLI scenarios to the CLI agent', async () => {
      const cliAgent = makeAgent('CLIAgent');
      const router = makeRouter({ [TestInterface.CLI]: cliAgent });

      const results: any[] = [];
      router.onResult = r => results.push(r);

      await router.route([makeScenario('cli-1', TestInterface.CLI)]);

      expect(cliAgent.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('TUI routing', () => {
    it('routes TUI scenarios to the TUI agent', async () => {
      const tuiAgent = makeAgent('TUIAgent');
      const router = makeRouter({ [TestInterface.TUI]: tuiAgent });

      await router.route([makeScenario('tui-1', TestInterface.TUI)]);

      expect(tuiAgent.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('API routing (B1 fix)', () => {
    it('routes API scenarios to APIAgent', async () => {
      const apiAgent = makeAgent('APIAgent');
      const router = makeRouter({ [TestInterface.API]: apiAgent });

      const results: any[] = [];
      const failures: string[] = [];
      router.onResult = r => results.push(r);
      router.onFailure = (id, _msg) => failures.push(id);

      await router.route([makeScenario('api-1', TestInterface.API)]);

      expect(apiAgent.execute).toHaveBeenCalledTimes(1);
      expect(failures).toHaveLength(0);
    });

    it('reports failure when TestInterface.API has no registered agent', async () => {
      const router = makeRouter({}); // no API agent

      const failures: Array<{ id: string; msg: string }> = [];
      router.onFailure = (id, msg) => failures.push({ id, msg });

      await router.route([makeScenario('api-orphan', TestInterface.API)]);

      expect(failures).toHaveLength(1);
      expect(failures[0].id).toBe('api-orphan');
      expect(failures[0].msg).toMatch(/no agent/i);
    });

    it('handles multiple API scenarios', async () => {
      const apiAgent = makeAgent('APIAgent');
      const router = makeRouter({ [TestInterface.API]: apiAgent });

      await router.route([
        makeScenario('api-1', TestInterface.API),
        makeScenario('api-2', TestInterface.API),
        makeScenario('api-3', TestInterface.API)
      ]);

      expect(apiAgent.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('GUI routing', () => {
    it('routes GUI scenarios to the GUI agent and wraps in initialize/cleanup', async () => {
      const guiAgent = makeAgent('ElectronUIAgent');
      const router = makeRouter({ [TestInterface.GUI]: guiAgent });

      await router.route([makeScenario('gui-1', TestInterface.GUI)]);

      expect(guiAgent.initialize).toHaveBeenCalledTimes(1);
      expect(guiAgent.execute).toHaveBeenCalledTimes(1);
      expect(guiAgent.cleanup).toHaveBeenCalledTimes(1);
    });

    it('reports failure for GUI scenarios when no GUI agent is registered', async () => {
      const router = makeRouter({});
      const failures: string[] = [];
      router.onFailure = (id, _msg) => failures.push(id);

      await router.route([makeScenario('gui-orphan', TestInterface.GUI)]);

      expect(failures).toContain('gui-orphan');
    });

    it('calls cleanup even when GUI scenario throws', async () => {
      const guiAgent = makeAgent('ElectronUIAgent');
      guiAgent.execute.mockRejectedValue(new Error('GUI crash'));
      const router = makeRouter({ [TestInterface.GUI]: guiAgent }, { retryCount: 0 });

      await router.route([makeScenario('gui-crash', TestInterface.GUI)]);

      expect(guiAgent.cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('MIXED routing', () => {
    it('routes MIXED scenarios using CLI agent when CLI steps dominate', async () => {
      const cliAgent = makeAgent('CLIAgent');
      const guiAgent = makeAgent('ElectronUIAgent');
      const router = makeRouter({
        [TestInterface.CLI]: cliAgent,
        [TestInterface.GUI]: guiAgent
      });

      const scenario = makeScenario('mixed-cli', TestInterface.MIXED, [
        { action: 'execute', target: 'ls' },
        { action: 'runCommand', target: 'pwd' }
      ]);

      await router.route([scenario]);

      expect(cliAgent.execute).toHaveBeenCalledTimes(1);
      expect(guiAgent.execute).not.toHaveBeenCalled();
    });

    it('routes MIXED scenarios using GUI agent when UI steps dominate', async () => {
      const cliAgent = makeAgent('CLIAgent');
      const guiAgent = makeAgent('ElectronUIAgent');
      const router = makeRouter({
        [TestInterface.CLI]: cliAgent,
        [TestInterface.GUI]: guiAgent
      });

      const scenario = makeScenario('mixed-gui', TestInterface.MIXED, [
        { action: 'click', target: '#btn' },
        { action: 'type', target: '#input' },
        { action: 'navigate', target: '/home' }
      ]);

      await router.route([scenario]);

      expect(guiAgent.execute).toHaveBeenCalledTimes(1);
      expect(cliAgent.execute).not.toHaveBeenCalled();
    });

    it('falls back to CLI for MIXED when no GUI agent is present', async () => {
      const cliAgent = makeAgent('CLIAgent');
      const router = makeRouter({ [TestInterface.CLI]: cliAgent });

      const scenario = makeScenario('mixed-fallback', TestInterface.MIXED, [
        { action: 'click', target: '#btn' },
        { action: 'type', target: '#input' }
      ]);

      await router.route([scenario]);

      expect(cliAgent.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('registry accepts any IAgent implementation', () => {
    it('accepts a custom IAgent for CLI without concrete CLIAgent', async () => {
      const customAgent: IAgent = {
        name: 'CustomCLI',
        type: 'cli',
        initialize: jest.fn().mockResolvedValue(undefined),
        execute: jest.fn().mockResolvedValue({
          scenarioId: 'custom-1',
          status: TestStatus.PASSED,
          duration: 5,
          startTime: new Date(),
          endTime: new Date()
        }),
        cleanup: jest.fn().mockResolvedValue(undefined)
      };

      const router = makeRouter({ [TestInterface.CLI]: customAgent });
      const results: any[] = [];
      router.onResult = r => results.push(r);

      await router.route([makeScenario('custom-1', TestInterface.CLI)]);

      expect(customAgent.execute).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
    });
  });

  describe('fail-fast behaviour', () => {
    it('aborts after first failure when failFast=true', async () => {
      const cliAgent = makeAgent('CLIAgent');
      cliAgent.execute
        .mockResolvedValueOnce({
          scenarioId: 's1',
          status: TestStatus.FAILED,
          duration: 10,
          startTime: new Date(),
          endTime: new Date()
        })
        .mockResolvedValueOnce({
          scenarioId: 's2',
          status: TestStatus.PASSED,
          duration: 5,
          startTime: new Date(),
          endTime: new Date()
        });

      const router = makeRouter(
        { [TestInterface.CLI]: cliAgent },
        { failFast: true, maxParallel: 1 }
      );

      const results: any[] = [];
      router.onResult = r => results.push(r);

      await router.route([
        makeScenario('s1', TestInterface.CLI),
        makeScenario('s2', TestInterface.CLI)
      ]);

      // Only first result processed before abort
      expect(results.some(r => r.status === TestStatus.FAILED)).toBe(true);
    });
  });
});
