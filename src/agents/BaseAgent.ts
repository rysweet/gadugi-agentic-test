/**
 * BaseAgent - Abstract base class that eliminates the ~200 lines of
 * duplicated execute() boilerplate shared by TUIAgent, CLIAgent,
 * WebSocketAgent, APIAgent, and ElectronUIAgent.
 *
 * Template-method pattern:
 *   1. `execute()` - single concrete implementation of the shared loop
 *   2. `executeStep()` - abstract: each agent implements its own dispatch
 *   3. `buildResult()` - abstract: each agent assembles its own result shape
 *   4. `applyEnvironment()` - optional hook for per-agent env setup
 *   5. `onBeforeExecute()` / `onAfterExecute()` - optional lifecycle hooks
 *
 * Closes GitHub issue #117.
 */

import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { OrchestratorScenario, TestStatus, StepResult } from '../models/TestModels';

/**
 * Timing and status snapshot passed to `buildResult()`.
 * Contains everything the shared loop knows — agents add their own fields.
 */
export interface ExecutionContext {
  scenarioId: string;
  status: TestStatus;
  duration: number;
  startTime: Date;
  endTime: Date;
  error?: string;
  stepResults: StepResult[];
}

/** Abstract base for all test-executing agents. */
export abstract class BaseAgent extends EventEmitter implements IAgent {
  abstract readonly name: string;
  abstract readonly type: AgentType;

  /** True after a successful `initialize()` call. */
  protected isInitialized = false;

  // -- Abstract methods subclasses MUST implement --

  /** Initialize the agent. Subclasses perform their own setup. */
  abstract initialize(): Promise<void>;

  /** Clean up resources. */
  abstract cleanup(): Promise<void>;

  /**
   * Execute a single test step and return its result.
   * Subclasses contain all action-dispatch logic here.
   * Declared as protected minimum; subclasses may widen to public.
   */
  abstract executeStep(step: any, index: number): Promise<StepResult>;

  /**
   * Assemble the final result object from the shared execution context.
   *
   * Called once by `execute()` after all steps have run (whether they passed or
   * failed).  Subclasses extend `ctx` with agent-specific fields:
   *
   * ```typescript
   * protected buildResult(ctx: ExecutionContext) {
   *   return {
   *     ...ctx,
   *     logs: this.getScenarioLogs(),
   *     commandHistory: this.runner.getCommandHistory(),
   *   };
   * }
   * ```
   */
  protected abstract buildResult(ctx: ExecutionContext): unknown;

  // -- Optional lifecycle hooks --

  /**
   * Called before the step loop begins.  Default: applies `scenario.environment`
   * by iterating keys and setting them via the (optional) `applyEnvironmentEntry`
   * method.  Override for agent-specific environment handling.
   */
  protected applyEnvironment(_scenario: OrchestratorScenario): void {
    // Default no-op. Subclasses that need to apply environment vars override this.
  }

  /** Optional hook called at the very start of execute(), before the loop. */
  protected onBeforeExecute(_scenario: OrchestratorScenario): void {
    // no-op by default
  }

  /**
   * Optional hook called in the finally block of execute().
   * Typical use: session cleanup (TUIAgent) or process kill (CLIAgent).
   */
  protected async onAfterExecute(
    _scenario: OrchestratorScenario,
    _status: TestStatus
  ): Promise<void> {
    // no-op by default
  }

  // -- Concrete execute() implementation (the shared boilerplate) --

  /**
   * Execute all steps of `scenario` in order.
   * Stops at the first FAILED or ERROR step.
   * Delegates environment setup to `applyEnvironment()` and result
   * construction to `buildResult()`.
   */
  async execute(scenario: OrchestratorScenario): Promise<unknown> {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    let status = TestStatus.PASSED;
    let error: string | undefined;

    this.onBeforeExecute(scenario);
    this.applyEnvironment(scenario);

    try {
      const stepResults: StepResult[] = [];
      for (let i = 0; i < scenario.steps.length; i++) {
        const stepResult = await this.executeStep(scenario.steps[i], i);
        stepResults.push(stepResult);
        if (
          stepResult.status === TestStatus.FAILED ||
          stepResult.status === TestStatus.ERROR
        ) {
          status = stepResult.status;
          error = stepResult.error;
          break;
        }
      }

      const ctx: ExecutionContext = {
        scenarioId: scenario.id,
        status,
        duration: Date.now() - startTime,
        startTime: new Date(startTime),
        endTime: new Date(),
        error,
        stepResults,
      };
      return this.buildResult(ctx);
    } catch (executeError: any) {
      status = TestStatus.ERROR;
      error = executeError?.message;
      throw executeError;
    } finally {
      await this.onAfterExecute(scenario, status);
    }
  }
}
