/**
 * ScenarioRouter
 *
 * Routes OrchestratorScenarios to the correct agent by interface type.
 * Handles parallel execution of CLI/TUI scenarios and sequential UI scenarios.
 */

import { CLIAgent } from '../agents/CLIAgent';
import { ElectronUIAgent } from '../agents/ElectronUIAgent';
import { TUIAgent } from '../agents/TUIAgent';
import { OrchestratorScenario, TestResult, TestStatus, TestInterface } from '../models/TestModels';
import { logger } from '../utils/logger';

type AnyAgent = CLIAgent | ElectronUIAgent | TUIAgent;

export class ScenarioRouter {
  private cliAgent: CLIAgent;
  private tuiAgent: TUIAgent;
  private uiAgent: ElectronUIAgent | null;
  private maxParallel: number;
  private failFast: boolean;
  private abortController: AbortController;
  private retryCount: number;

  /** Called for each result produced (passed through to ResultAggregator) */
  onResult?: (result: TestResult) => void;
  /** Called when a scenario fails without a TestResult (e.g. thrown before start) */
  onFailure?: (scenarioId: string, message: string) => void;

  constructor(options: {
    cliAgent: CLIAgent;
    tuiAgent: TUIAgent;
    uiAgent: ElectronUIAgent | null;
    maxParallel: number;
    failFast: boolean;
    retryCount: number;
    abortController: AbortController;
  }) {
    this.cliAgent = options.cliAgent;
    this.tuiAgent = options.tuiAgent;
    this.uiAgent = options.uiAgent;
    this.maxParallel = options.maxParallel;
    this.failFast = options.failFast;
    this.retryCount = options.retryCount;
    this.abortController = options.abortController;
  }

  /**
   * Dispatch all scenarios to their respective agents
   */
  async route(scenarios: OrchestratorScenario[]): Promise<void> {
    const cli = scenarios.filter(s => s.interface === TestInterface.CLI);
    const tui = scenarios.filter(s => s.interface === TestInterface.TUI);
    const ui = scenarios.filter(s => s.interface === TestInterface.GUI);
    const mixed = scenarios.filter(s => s.interface === TestInterface.MIXED);

    if (cli.length > 0) {
      logger.info(`Executing ${cli.length} CLI scenarios`);
      await this.executeParallelBatch(cli, this.cliAgent);
    }

    if (tui.length > 0) {
      logger.info(`Executing ${tui.length} TUI scenarios`);
      await this.executeParallelBatch(tui, this.tuiAgent);
    }

    if (ui.length > 0) {
      logger.info(`Executing ${ui.length} UI scenarios`);
      await this.executeUIScenarios(ui);
    }

    if (mixed.length > 0) {
      logger.info(`Executing ${mixed.length} mixed scenarios`);
      await this.executeMixed(mixed);
    }
  }

  private async executeParallelBatch(scenarios: OrchestratorScenario[], agent: AnyAgent): Promise<void> {
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
    if (!this.uiAgent) {
      for (const s of scenarios) {
        this.onFailure?.(s.id, 'UI testing unavailable - Electron agent not configured');
      }
      return;
    }

    await this.uiAgent.initialize();
    try {
      for (const s of scenarios) {
        if (this.abortController.signal.aborted) break;
        const result = await this.executeSingle(s, this.uiAgent);
        this.onResult?.(result);
        if (this.failFast && result.status === TestStatus.FAILED) break;
      }
    } finally {
      await this.uiAgent.cleanup();
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

  private selectForMixed(scenario: OrchestratorScenario): CLIAgent | ElectronUIAgent {
    const cliSteps = scenario.steps.filter(s =>
      s.action === 'execute' || s.action === 'runCommand'
    ).length;
    const uiSteps = scenario.steps.filter(s =>
      ['click', 'type', 'navigate', 'screenshot'].includes(s.action)
    ).length;
    if (uiSteps > cliSteps && this.uiAgent) return this.uiAgent;
    return this.cliAgent;
  }

  async executeSingle(scenario: OrchestratorScenario, agent: AnyAgent): Promise<TestResult> {
    logger.info(`Executing scenario: ${scenario.id} - ${scenario.name}`);
    const startTime = Date.now();
    let attempt = 0;

    while (attempt <= this.retryCount) {
      try {
        const result = await agent.execute(scenario);
        return { ...result, scenarioId: scenario.id, duration: Date.now() - startTime };
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
