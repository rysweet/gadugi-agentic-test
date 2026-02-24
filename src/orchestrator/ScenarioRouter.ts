/**
 * ScenarioRouter
 *
 * Routes OrchestratorScenarios to the correct agent by interface type.
 * Handles parallel execution of CLI/TUI/API scenarios and sequential UI scenarios.
 *
 * Uses an IAgent registry (Partial<Record<TestInterface, IAgent>>) so that
 * adding new interface types (e.g. WEBSOCKET) only requires registering a new
 * entry in TestOrchestrator — this class needs no changes.
 *
 * Previously used concrete union type `CLIAgent | ElectronUIAgent | TUIAgent`
 * which forced code changes here whenever a new agent type was introduced and
 * left TestInterface.API silently unrouted.
 */

import { IAgent } from '../agents';
import { OrchestratorScenario, TestResult, TestStatus, TestInterface } from '../models/TestModels';
import { logger } from '../utils/logger';

export class ScenarioRouter {
  private agentRegistry: Partial<Record<TestInterface, IAgent>>;
  private maxParallel: number;
  private failFast: boolean;
  private abortController: AbortController;
  private retryCount: number;

  /** Called for each result produced (passed through to ResultAggregator) */
  onResult?: (result: TestResult) => void;
  /** Called when a scenario fails without a TestResult (e.g. thrown before start) */
  onFailure?: (scenarioId: string, message: string) => void;

  constructor(options: {
    agentRegistry: Partial<Record<TestInterface, IAgent>>;
    maxParallel: number;
    failFast: boolean;
    retryCount: number;
    abortController: AbortController;
  }) {
    this.agentRegistry = options.agentRegistry;
    this.maxParallel = options.maxParallel;
    this.failFast = options.failFast;
    this.retryCount = options.retryCount;
    this.abortController = options.abortController;
  }

  /**
   * Dispatch all scenarios to their respective agents.
   *
   * CLI, TUI, and API scenarios are run in parallel batches.
   * GUI scenarios are run sequentially after agent initialization/cleanup.
   * MIXED scenarios are dispatched one at a time with per-scenario agent selection.
   * Unregistered interface types are reported as failures (never silently dropped).
   */
  async route(scenarios: OrchestratorScenario[]): Promise<void> {
    const byInterface = this.groupByInterface(scenarios);

    // Parallel execution groups
    for (const iface of [TestInterface.CLI, TestInterface.TUI, TestInterface.API] as TestInterface[]) {
      const group = byInterface.get(iface) ?? [];
      if (group.length === 0) continue;

      const agent = this.agentRegistry[iface];
      if (!agent) {
        logger.warn(`No agent registered for interface ${iface}; reporting ${group.length} scenario(s) as failed`);
        for (const s of group) {
          this.onFailure?.(s.id, `No agent registered for interface ${iface}`);
        }
        continue;
      }

      logger.info(`Executing ${group.length} ${iface} scenario(s)`);
      await this.executeParallelBatch(group, agent);
    }

    // GUI: sequential with initialize/cleanup lifecycle
    const guiScenarios = byInterface.get(TestInterface.GUI) ?? [];
    if (guiScenarios.length > 0) {
      await this.executeUIScenarios(guiScenarios);
    }

    // MIXED: per-scenario agent selection
    const mixedScenarios = byInterface.get(TestInterface.MIXED) ?? [];
    if (mixedScenarios.length > 0) {
      logger.info(`Executing ${mixedScenarios.length} mixed scenario(s)`);
      await this.executeMixed(mixedScenarios);
    }

    // Unknown interface types: report failures rather than silently dropping
    for (const [iface, group] of byInterface.entries()) {
      const isKnown = [
        TestInterface.CLI, TestInterface.TUI, TestInterface.API,
        TestInterface.GUI, TestInterface.MIXED
      ].includes(iface);

      if (!isKnown) {
        for (const s of group) {
          this.onFailure?.(s.id, `Unknown interface type '${iface}' — no routing branch`);
        }
      }
    }
  }

  private groupByInterface(scenarios: OrchestratorScenario[]): Map<TestInterface, OrchestratorScenario[]> {
    const map = new Map<TestInterface, OrchestratorScenario[]>();
    for (const s of scenarios) {
      const existing = map.get(s.interface) ?? [];
      existing.push(s);
      map.set(s.interface, existing);
    }
    return map;
  }

  private async executeParallelBatch(scenarios: OrchestratorScenario[], agent: IAgent): Promise<void> {
    const results = await this.executeParallel(scenarios, s => this.executeSingle(s, agent));
    for (let i = 0; i < scenarios.length; i++) {
      const r = results[i];
      if (r instanceof Error) {
        logger.error(`Scenario ${scenarios[i].id} threw:`, r);
        this.onFailure?.(scenarios[i].id, r.message);
      } else {
        this.onResult?.(r);
        if (this.failFast && r.status === TestStatus.FAILED) {
          this.abortController.abort();
          break;
        }
      }
    }
  }

  private async executeUIScenarios(scenarios: OrchestratorScenario[]): Promise<void> {
    const agent = this.agentRegistry[TestInterface.GUI];
    if (!agent) {
      for (const s of scenarios) {
        this.onFailure?.(s.id, 'No agent registered for GUI interface');
      }
      return;
    }

    await agent.initialize();
    try {
      for (const s of scenarios) {
        if (this.abortController.signal.aborted) break;
        const result = await this.executeSingle(s, agent);
        this.onResult?.(result);
        if (this.failFast && result.status === TestStatus.FAILED) break;
      }
    } finally {
      await agent.cleanup();
    }
  }

  private async executeMixed(scenarios: OrchestratorScenario[]): Promise<void> {
    for (const s of scenarios) {
      if (this.abortController.signal.aborted) break;
      const agent = this.selectForMixed(s);
      const result = await this.executeSingle(s, agent);
      this.onResult?.(result);
      if (this.failFast && result.status === TestStatus.FAILED) break;
    }
  }

  private selectForMixed(scenario: OrchestratorScenario): IAgent {
    const cliSteps = scenario.steps.filter(s =>
      s.action === 'execute' || s.action === 'runCommand'
    ).length;
    const uiSteps = scenario.steps.filter(s =>
      ['click', 'type', 'navigate', 'screenshot'].includes(s.action)
    ).length;

    const guiAgent = this.agentRegistry[TestInterface.GUI];
    const cliAgent = this.agentRegistry[TestInterface.CLI];

    if (uiSteps > cliSteps && guiAgent) return guiAgent;

    // Fall back to CLI agent; if also missing, report error
    if (cliAgent) return cliAgent;

    // Last resort: use any registered agent
    const fallback = Object.values(this.agentRegistry)[0];
    if (fallback) return fallback;

    // Nothing registered — this scenario cannot be executed
    throw new Error(`No agent available for MIXED scenario '${scenario.id}'`);
  }

  async executeSingle(scenario: OrchestratorScenario, agent: IAgent): Promise<TestResult> {
    logger.info(`Executing scenario: ${scenario.id} - ${scenario.name}`);
    const startTime = Date.now();
    let attempt = 0;

    while (attempt <= this.retryCount) {
      try {
        const result = await agent.execute(scenario) as Record<string, unknown>;
        return { ...result, scenarioId: scenario.id, duration: Date.now() - startTime } as TestResult;
      } catch (error) {
        logger.error(`Scenario ${scenario.id} failed (attempt ${attempt + 1}):`, error);
        if (attempt < this.retryCount) {
          attempt++;
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        return {
          scenarioId: scenario.id,
          status: TestStatus.FAILED,
          duration: Date.now() - startTime,
          startTime: new Date(startTime),
          endTime: new Date(),
          error: error instanceof Error ? error.message : String(error),
          stackTrace: error instanceof Error ? error.stack : undefined
        };
      }
    }

    return {
      scenarioId: scenario.id,
      status: TestStatus.ERROR,
      duration: Date.now() - startTime,
      startTime: new Date(startTime),
      endTime: new Date()
    };
  }

  private async executeParallel<T>(
    items: T[],
    handler: (item: T) => Promise<TestResult>
  ): Promise<(TestResult | Error)[]> {
    const results: (TestResult | Error)[] = [];
    let running = 0;
    let index = 0;

    await new Promise<void>((resolveAll) => {
      const tryNext = () => {
        while (running < this.maxParallel && index < items.length) {
          if (this.abortController.signal.aborted) { index = items.length; break; }
          const item = items[index++];
          running++;
          handler(item).then(
            r => { results.push(r); },
            e => { results.push(e); }
          ).finally(() => {
            running--;
            if (index < items.length) tryNext();
            else if (running === 0) resolveAll();
          });
        }
        if (index >= items.length && running === 0) resolveAll();
      };
      tryNext();
    });

    return results;
  }
}
