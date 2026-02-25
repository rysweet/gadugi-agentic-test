/**
 * TestOrchestrator
 *
 * Thin orchestration facade. Delegates to:
 *   - ScenarioRouter  : dispatch scenarios to agents (via IAgent registry)
 *   - SessionManager  : session lifecycle and persistence
 *   - ResultAggregator: collect results, analyze, report
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  OrchestratorScenario,
  TestResult,
  TestSession,
  TestFailure,
  TestInterface
} from '../models/TestModels';
import { ScenarioDefinition } from '../scenarios';
import { TestConfig } from '../models/Config';
import { ElectronUIAgent } from '../agents/ElectronUIAgent';
import { CLIAgent } from '../agents/CLIAgent';
import { TUIAgent } from '../agents/TUIAgent';
import { APIAgent } from '../agents/APIAgent';
import { IAgent } from '../agents';
import { IssueReporter } from '../agents/IssueReporter';
import { PriorityAgent } from '../agents/PriorityAgent';
import { logger } from '../utils/logger';
import { ScenarioLoader } from '../scenarios';
import { adaptScenarioToComplex } from '../adapters/scenarioAdapter';
import { filterScenariosForSuite } from '../lib/ScenarioLoader';
import { ScenarioRouter } from './ScenarioRouter';
import { SessionManager } from './SessionManager';
import { ResultAggregator } from './ResultAggregator';
import { adaptTUIConfig, adaptPriorityConfig, adaptUIConfig } from './agentAdapters';

/**
 * Suite filter configuration used internally by TestOrchestrator.
 *
 * NOTE: This is intentionally distinct from `TestModels.TestSuite`, which
 * describes a named collection of OrchestratorScenario objects for consumption
 * by test runners. SuiteFilterConfig describes patterns used to select which
 * scenarios belong to a named run (e.g. "smoke", "full").
 *
 * Distinction at a glance:
 *   - TestModels.TestSuite  → { name, scenarios: OrchestratorScenario[] }
 *   - SuiteFilterConfig     → { name, patterns: string[], tags?: string[] }
 */
export interface SuiteFilterConfig {
  name: string;
  description?: string;
  patterns: string[];
  tags?: string[];
}

/**
 * Orchestrator events
 */
export interface OrchestratorEvents {
  'session:start': (session: TestSession) => void;
  'session:end': (session: TestSession) => void;
  'scenario:start': (scenario: OrchestratorScenario) => void;
  'scenario:end': (scenario: OrchestratorScenario, result: TestResult) => void;
  'phase:start': (phase: string) => void;
  'phase:end': (phase: string) => void;
  'error': (error: Error) => void;
}

export class TestOrchestrator extends EventEmitter {
  private config: TestConfig;
  private sessionManager: SessionManager;
  private aggregator: ResultAggregator;
  private router: ScenarioRouter;
  private abortController: AbortController;
  private issueReporter: IssueReporter;
  private failures: TestFailure[] = [];

  constructor(config: TestConfig) {
    super();
    this.config = config;
    this.abortController = new AbortController();

    const cliAgent = new CLIAgent(config.cli);
    const tuiAgent = new TUIAgent(adaptTUIConfig(config.tui));
    const uiAgent = config.ui?.browser
      ? new ElectronUIAgent(adaptUIConfig(config.ui))
      : null;
    const apiAgent = new APIAgent(config.api ?? {});

    this.issueReporter = new IssueReporter(config.github || {
      token: '', owner: '', repository: '', baseBranch: 'main',
      createIssuesOnFailure: false, issueLabels: [],
      issueTitleTemplate: '', issueBodyTemplate: '',
      createPullRequestsForFixes: false, autoAssignUsers: []
    });

    const priorityAgent = new PriorityAgent(adaptPriorityConfig(config.priority));

    this.sessionManager = new SessionManager(config);

    this.aggregator = new ResultAggregator({
      priorityAgent,
      issueReporter: this.issueReporter,
      createIssues: config.github?.createIssuesOnFailure ?? false
    });

    /**
     * Agent registry: maps each TestInterface value to the IAgent that handles
     * it. Adding a new interface type (e.g. WEBSOCKET) only requires adding an
     * entry here — ScenarioRouter needs no changes.
     *
     * GUI falls back to cliAgent when no Electron agent is configured so that
     * scenarios are never silently swallowed.
     */
    const agentRegistry: Partial<Record<TestInterface, IAgent>> = {
      [TestInterface.CLI]:   cliAgent,
      [TestInterface.TUI]:   tuiAgent,
      [TestInterface.GUI]:   uiAgent ?? cliAgent,
      [TestInterface.API]:   apiAgent,
      [TestInterface.MIXED]: cliAgent,
    };

    this.router = new ScenarioRouter({
      agentRegistry,
      maxParallel: config.execution?.maxParallel || 3,
      failFast: config.execution?.continueOnFailure === false,
      retryCount: config.execution?.maxRetries || 2,
      abortController: this.abortController
    });

    this.router.onResult = (result) => {
      this.aggregator.record(result);
      this.sessionManager.addResult(result);
      this.emit('scenario:end', { id: result.scenarioId } as OrchestratorScenario, result);
    };

    this.router.onFailure = (scenarioId, message) => {
      this.aggregator.recordFailure(scenarioId, message);
    };

    this.on('error', (e) => logger.error('Orchestrator error:', e));
  }

  /**
   * Run with pre-loaded scenarios (used by programmatic API)
   */
  async runWithScenarios(suite: string, loadedScenarios: ScenarioDefinition[]): Promise<TestSession> {
    logger.info(`Starting test session with suite: ${suite}`);
    const session = this.sessionManager.create();
    this.emit('session:start', session);

    try {
      const orchestratorScenarios = loadedScenarios.map(adaptScenarioToComplex);
      const filtered = filterScenariosForSuite(orchestratorScenarios, suite);
      logger.info(`Selected ${filtered.length} scenarios for suite '${suite}'`);

      this.emit('phase:start', 'execution');
      await this.router.route(filtered);
      this.emit('phase:end', 'execution');

      this.emit('phase:start', 'analysis');
      await this.aggregator.analyze();
      this.emit('phase:end', 'analysis');

      this.emit('phase:start', 'reporting');
      await this.aggregator.report();
      await this.reportFailures();
      this.emit('phase:end', 'reporting');

    } catch (error) {
      logger.error('Test session failed:', error);
      this.emit('error', error as Error);
      throw error;
    } finally {
      const completed = await this.sessionManager.complete();
      this.emit('session:end', completed);
    }

    logger.info(`Test session completed: ${this.sessionManager.getSession()?.id}`);
    return this.sessionManager.getSession()!;
  }

  /**
   * Run a complete testing session
   */
  async run(suite: string = 'smoke', scenarioFiles?: string[]): Promise<TestSession> {
    logger.info(`Starting test session with suite: ${suite}`);
    const session = this.sessionManager.create();
    this.emit('session:start', session);

    try {
      this.emit('phase:start', 'discovery');
      const scenarios = await this.loadScenarios(scenarioFiles);
      const filtered = filterScenariosForSuite(scenarios, suite);
      logger.info(`Selected ${filtered.length} scenarios for suite '${suite}'`);
      this.emit('phase:end', 'discovery');

      this.emit('phase:start', 'execution');
      await this.router.route(filtered);
      this.emit('phase:end', 'execution');

      this.emit('phase:start', 'analysis');
      await this.aggregator.analyze();
      this.emit('phase:end', 'analysis');

      this.emit('phase:start', 'reporting');
      await this.aggregator.report();
      await this.reportFailures();
      this.emit('phase:end', 'reporting');

    } catch (error) {
      logger.error('Test session failed:', error);
      this.emit('error', error as Error);
      throw error;
    } finally {
      const completed = await this.sessionManager.complete();
      this.emit('session:end', completed);
    }

    logger.info(`Test session completed: ${this.sessionManager.getSession()?.id}`);
    return this.sessionManager.getSession()!;
  }

  abort(): void {
    logger.warn('Aborting test session');
    this.abortController.abort();
  }

  getSession(): TestSession | null {
    return this.sessionManager.getSession();
  }

  getResults(): TestResult[] {
    return this.aggregator.getResults();
  }

  getFailures(): TestFailure[] {
    return this.aggregator.getFailures();
  }

  // ---- Private helpers ----

  /**
   * Report failures to GitHub via IssueReporter.
   *
   * Best-effort: individual createIssue failures are logged but do not abort
   * subsequent reports. Cleanup is always called.
   */
  private async reportFailures(): Promise<void> {
    if (this.failures.length === 0) {
      return;
    }

    const createIssues = this.config.github?.createIssuesOnFailure ?? false;
    if (!createIssues) {
      return;
    }

    try {
      await this.issueReporter.initialize();
    } catch (error) {
      logger.error('IssueReporter.initialize failed; aborting issue creation:', error);
      try { await this.issueReporter.cleanup(); } catch { /* best-effort */ }
      return;
    }

    try {
      for (const failure of this.failures) {
        try {
          await this.issueReporter.createIssue(failure);
        } catch (error) {
          logger.error(`Failed to create issue for failure ${failure.scenarioId}:`, error);
        }
      }
    } finally {
      await this.issueReporter.cleanup();
    }
  }

  private async loadScenarios(scenarioFiles?: string[]): Promise<OrchestratorScenario[]> {
    const scenarios: OrchestratorScenario[] = [];
    const scenarioDir = path.join(process.cwd(), 'scenarios');

    if (scenarioFiles && scenarioFiles.length > 0) {
      for (const file of scenarioFiles) {
        try {
          scenarios.push(adaptScenarioToComplex(await ScenarioLoader.loadFromFile(file)));
        } catch (error) {
          logger.error(`Failed to load scenarios from ${file}:`, error);
        }
      }
    } else {
      try {
        const files = await fs.readdir(scenarioDir);
        for (const file of files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))) {
          scenarios.push(adaptScenarioToComplex(
            await ScenarioLoader.loadFromFile(path.join(scenarioDir, file))
          ));
        }
      } catch (error) {
        logger.error('Failed to load scenarios from directory:', error);
      }
    }

    logger.info(`Loaded ${scenarios.length} total test scenarios`);
    return scenarios;
  }

}

/**
 * Create a test orchestrator instance
 */
export function createTestOrchestrator(config: TestConfig): TestOrchestrator {
  return new TestOrchestrator(config);
}
