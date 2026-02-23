/**
 * Tests for src/orchestrator/ScenarioRouter.ts
 *
 * Verifies routing logic, parallel execution limits, failFast behavior,
 * and session outcome derivation.
 *
 * All agents are replaced with minimal Jest mocks so no real processes
 * are spawned during test runs.
 */

import { ScenarioRouter } from '../orchestrator/ScenarioRouter';
import {
  OrchestratorScenario,
  TestResult,
  TestStatus,
  TestInterface,
  Priority,
} from '../models/TestModels';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal OrchestratorScenario */
function makeScenario(
  id: string,
  iface: TestInterface,
  steps: { action: string; target: string }[] = [{ action: 'execute', target: 'cmd' }]
): OrchestratorScenario {
  return {
    id,
    name: `Scenario ${id}`,
    description: '',
    priority: Priority.MEDIUM,
    interface: iface,
    prerequisites: [],
    steps,
    verifications: [],
    expectedOutcome: 'pass',
    estimatedDuration: 1,
    tags: [],
    enabled: true,
  };
}

/** Build a PASSED TestResult */
function passedResult(scenarioId: string): TestResult {
  return {
    scenarioId,
    status: TestStatus.PASSED,
    duration: 1,
    startTime: new Date(),
    endTime: new Date(),
  };
}

/** Build a FAILED TestResult */
function failedResult(scenarioId: string): TestResult {
  return {
    scenarioId,
    status: TestStatus.FAILED,
    duration: 1,
    startTime: new Date(),
    endTime: new Date(),
    error: 'test failure',
  };
}

/** Create a mock agent with a controllable execute() function */
function makeAgent(executeFn?: jest.Mock) {
  return {
    name: 'MockAgent',
    type: 'mock',
    initialize: jest.fn().mockResolvedValue(undefined),
    execute: executeFn ?? jest.fn().mockResolvedValue(passedResult('default')),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };
}

/** Build a ScenarioRouter with mock agents */
function makeRouter(options: {
  cliExecute?: jest.Mock;
  tuiExecute?: jest.Mock;
  uiExecute?: jest.Mock;
  maxParallel?: number;
  failFast?: boolean;
  retryCount?: number;
  uiAgent?: ReturnType<typeof makeAgent> | null;
  abortController?: AbortController;
}) {
  const abortController = options.abortController ?? new AbortController();
  const cli = makeAgent(options.cliExecute);
  const tui = makeAgent(options.tuiExecute);
  const ui =
    options.uiAgent !== undefined ? options.uiAgent : makeAgent(options.uiExecute);

  const router = new ScenarioRouter({
    cliAgent: cli as any,
    tuiAgent: tui as any,
    uiAgent: ui as any,
    maxParallel: options.maxParallel ?? 4,
    failFast: options.failFast ?? false,
    retryCount: options.retryCount ?? 0,
    abortController,
  });

  return { router, cli, tui, ui: ui as ReturnType<typeof makeAgent> | null };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ScenarioRouter.route()', () => {
  it('routes CLI scenarios to CLIAgent', async () => {
    const cliExecute = jest.fn().mockResolvedValue(passedResult('cli-1'));
    const { router, cli } = makeRouter({ cliExecute });

    await router.route([makeScenario('cli-1', TestInterface.CLI)]);

    expect(cli.execute).toHaveBeenCalledTimes(1);
    expect((cli.execute as jest.Mock).mock.calls[0][0].id).toBe('cli-1');
  });

  it('routes TUI scenarios to TUIAgent', async () => {
    const tuiExecute = jest.fn().mockResolvedValue(passedResult('tui-1'));
    const { router, tui } = makeRouter({ tuiExecute });

    await router.route([makeScenario('tui-1', TestInterface.TUI)]);

    expect(tui.execute).toHaveBeenCalledTimes(1);
    expect((tui.execute as jest.Mock).mock.calls[0][0].id).toBe('tui-1');
  });

  it('routes GUI scenarios to ElectronUIAgent', async () => {
    const uiExecute = jest.fn().mockResolvedValue(passedResult('ui-1'));
    const { router, ui } = makeRouter({ uiExecute });

    await router.route([makeScenario('ui-1', TestInterface.GUI)]);

    expect(ui!.initialize).toHaveBeenCalledTimes(1);
    expect(ui!.execute).toHaveBeenCalledTimes(1);
    expect(ui!.cleanup).toHaveBeenCalledTimes(1);
  });

  it('routes MIXED scenarios using CLIAgent when CLI steps dominate', async () => {
    const cliExecute = jest.fn().mockResolvedValue(passedResult('mix-1'));
    const { router, cli } = makeRouter({ cliExecute });

    const scenario = makeScenario('mix-1', TestInterface.MIXED, [
      { action: 'execute', target: 'cmd1' },
      { action: 'runCommand', target: 'cmd2' },
    ]);

    await router.route([scenario]);

    // CLIAgent handles mixed when CLI steps outnumber UI steps
    expect(cli.execute).toHaveBeenCalledTimes(1);
  });

  it('collects onResult callbacks for all executed scenarios', async () => {
    const { router } = makeRouter({
      cliExecute: jest.fn().mockResolvedValue(passedResult('cli-a')),
    });

    const collected: TestResult[] = [];
    router.onResult = r => collected.push(r);

    await router.route([makeScenario('cli-a', TestInterface.CLI)]);

    expect(collected).toHaveLength(1);
    expect(collected[0].status).toBe(TestStatus.PASSED);
  });

  it('parallel execution respects maxParallel limit', async () => {
    let concurrency = 0;
    let maxConcurrency = 0;

    const slowExecute = jest.fn().mockImplementation(async () => {
      concurrency++;
      maxConcurrency = Math.max(maxConcurrency, concurrency);
      await new Promise(r => setTimeout(r, 10));
      concurrency--;
      return passedResult('par');
    });

    const { router } = makeRouter({ cliExecute: slowExecute, maxParallel: 2 });

    const scenarios = Array.from({ length: 6 }, (_, i) =>
      makeScenario(`par-${i}`, TestInterface.CLI)
    );

    await router.route(scenarios);

    expect(maxConcurrency).toBeLessThanOrEqual(2);
    expect(slowExecute).toHaveBeenCalledTimes(6);
  });

  it('failFast: true stops calling onResult after the first FAILED result', async () => {
    // Note: executeParallelBatch runs the entire parallel batch before checking results,
    // so all scenarios execute. failFast controls whether onResult continues to be called
    // and whether subsequent route() batches (TUI, GUI) are aborted.
    const reported: string[] = [];

    const { router } = makeRouter({
      cliExecute: jest.fn().mockImplementation(async (s: OrchestratorScenario) => {
        if (s.id === 'ff-0') return failedResult('ff-0');
        return passedResult(s.id);
      }),
      maxParallel: 1,
      failFast: true,
    });

    router.onResult = r => reported.push(r.scenarioId);

    const scenarios = Array.from({ length: 5 }, (_, i) =>
      makeScenario(`ff-${i}`, TestInterface.CLI)
    );

    await router.route(scenarios);

    // failFast stops reporting after the first failure — only 'ff-0' reaches onResult
    expect(reported).toContain('ff-0');
    // After ff-0 fails, subsequent results are not reported
    expect(reported).not.toContain('ff-1');
  });

  it('all scenarios pass — every onResult status is PASSED', async () => {
    const { router } = makeRouter({
      cliExecute: jest.fn().mockImplementation(async (s: OrchestratorScenario) =>
        passedResult(s.id)
      ),
    });

    const statuses: TestStatus[] = [];
    router.onResult = r => statuses.push(r.status);

    const scenarios = Array.from({ length: 3 }, (_, i) =>
      makeScenario(`ok-${i}`, TestInterface.CLI)
    );
    await router.route(scenarios);

    expect(statuses).toHaveLength(3);
    expect(statuses.every(s => s === TestStatus.PASSED)).toBe(true);
  });

  it('one scenario fails — onResult includes a FAILED status', async () => {
    let called = 0;
    const { router } = makeRouter({
      cliExecute: jest.fn().mockImplementation(async (s: OrchestratorScenario) => {
        called++;
        return called === 2 ? failedResult(s.id) : passedResult(s.id);
      }),
      maxParallel: 1,
      failFast: false,
    });

    const results: TestResult[] = [];
    router.onResult = r => results.push(r);

    const scenarios = Array.from({ length: 3 }, (_, i) =>
      makeScenario(`sc-${i}`, TestInterface.CLI)
    );
    await router.route(scenarios);

    const failed = results.filter(r => r.status === TestStatus.FAILED);
    expect(failed).toHaveLength(1);
  });

  it('GUI scenarios fail gracefully when uiAgent is null', async () => {
    const failures: Array<{ id: string; msg: string }> = [];
    const router = new ScenarioRouter({
      cliAgent: makeAgent() as any,
      tuiAgent: makeAgent() as any,
      uiAgent: null,
      maxParallel: 4,
      failFast: false,
      retryCount: 0,
      abortController: new AbortController(),
    });
    router.onFailure = (id, msg) => failures.push({ id, msg });

    await router.route([makeScenario('gui-null', TestInterface.GUI)]);

    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe('gui-null');
    expect(failures[0].msg).toContain('unavailable');
  });

  it('executeSingle returns FAILED result when agent.execute throws', async () => {
    const throwingAgent = makeAgent(
      jest.fn().mockRejectedValue(new Error('process crashed'))
    );

    const router = new ScenarioRouter({
      cliAgent: throwingAgent as any,
      tuiAgent: makeAgent() as any,
      uiAgent: null,
      maxParallel: 1,
      failFast: false,
      retryCount: 0,
      abortController: new AbortController(),
    });

    const result = await router.executeSingle(
      makeScenario('throw-1', TestInterface.CLI),
      throwingAgent as any
    );

    expect(result.status).toBe(TestStatus.FAILED);
    expect(result.error).toContain('process crashed');
  });
});
