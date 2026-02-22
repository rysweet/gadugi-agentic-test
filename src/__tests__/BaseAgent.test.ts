/**
 * Tests for src/agents/BaseAgent.ts (issue #117)
 *
 * Verifies the template-method execute() contract:
 * - Not-initialized guard
 * - Step loop runs all steps
 * - Stops at first FAILED/ERROR step
 * - Calls onBeforeExecute, applyEnvironment, buildResult, onAfterExecute hooks
 * - Propagates exceptions with ERROR status
 */

import { BaseAgent, ExecutionContext } from '../agents/BaseAgent';
import { AgentType } from '../agents/index';
import { OrchestratorScenario, TestStatus, StepResult, Priority, TestInterface } from '../models/TestModels';

// -- Minimal concrete implementation for testing --

type CapturedHooks = {
  beforeExecute: boolean;
  applyEnv: boolean;
  afterExecute: boolean;
  afterStatus?: TestStatus;
};

class TestAgent extends BaseAgent {
  readonly name = 'TestAgent';
  readonly type = AgentType.CLI;

  readonly hooks: CapturedHooks = {
    beforeExecute: false,
    applyEnv: false,
    afterExecute: false,
  };

  /** Controls whether steps pass or fail. */
  stepBehavior: 'pass' | 'fail' | 'error' | 'throw' = 'pass';

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async cleanup(): Promise<void> {}

  async executeStep(_step: any, index: number): Promise<StepResult> {
    if (this.stepBehavior === 'throw') {
      throw new Error(`step ${index} threw`);
    }
    const status =
      this.stepBehavior === 'pass'
        ? TestStatus.PASSED
        : this.stepBehavior === 'fail'
        ? TestStatus.FAILED
        : TestStatus.ERROR;
    return { stepIndex: index, status, duration: 1 };
  }

  protected buildResult(ctx: ExecutionContext): unknown {
    return { ...ctx, extra: 'test-extra' };
  }

  protected onBeforeExecute(_scenario: OrchestratorScenario): void {
    this.hooks.beforeExecute = true;
  }

  protected applyEnvironment(_scenario: OrchestratorScenario): void {
    this.hooks.applyEnv = true;
  }

  protected async onAfterExecute(_scenario: OrchestratorScenario, status: TestStatus): Promise<void> {
    this.hooks.afterExecute = true;
    this.hooks.afterStatus = status;
  }
}

// -- Helpers --

function makeScenario(stepCount: number): OrchestratorScenario {
  return {
    id: 'test-scenario',
    name: 'Test Scenario',
    description: 'A test scenario',
    priority: Priority.MEDIUM,
    interface: TestInterface.CLI,
    prerequisites: [],
    steps: Array.from({ length: stepCount }, (_, i) => ({
      action: 'run',
      target: `step-${i}`,
    })),
    verifications: [],
    expectedOutcome: 'pass',
    estimatedDuration: 1,
    tags: [],
    enabled: true,
  };
}

// -- Tests --

describe('BaseAgent.execute()', () => {
  let agent: TestAgent;

  beforeEach(async () => {
    agent = new TestAgent();
    await agent.initialize();
  });

  it('throws if not initialized', async () => {
    const uninit = new TestAgent(); // NOT initialized
    await expect(uninit.execute(makeScenario(1))).rejects.toThrow('not initialized');
  });

  it('calls onBeforeExecute, applyEnvironment, and onAfterExecute hooks', async () => {
    await agent.execute(makeScenario(1));
    expect(agent.hooks.beforeExecute).toBe(true);
    expect(agent.hooks.applyEnv).toBe(true);
    expect(agent.hooks.afterExecute).toBe(true);
  });

  it('runs all steps when they pass', async () => {
    agent.stepBehavior = 'pass';
    const result = await agent.execute(makeScenario(3)) as any;
    expect(result.stepResults).toHaveLength(3);
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('stops at the first FAILED step', async () => {
    agent.stepBehavior = 'fail';
    const result = await agent.execute(makeScenario(5)) as any;
    expect(result.stepResults).toHaveLength(1);
    expect(result.status).toBe(TestStatus.FAILED);
  });

  it('stops at the first ERROR step', async () => {
    agent.stepBehavior = 'error';
    const result = await agent.execute(makeScenario(5)) as any;
    expect(result.stepResults).toHaveLength(1);
    expect(result.status).toBe(TestStatus.ERROR);
  });

  it('propagates thrown exceptions from executeStep', async () => {
    agent.stepBehavior = 'throw';
    await expect(agent.execute(makeScenario(1))).rejects.toThrow('step 0 threw');
  });

  it('still calls onAfterExecute even when an exception is thrown', async () => {
    agent.stepBehavior = 'throw';
    await agent.execute(makeScenario(1)).catch(() => {});
    expect(agent.hooks.afterExecute).toBe(true);
  });

  it('passes the correct status to onAfterExecute on PASSED run', async () => {
    agent.stepBehavior = 'pass';
    await agent.execute(makeScenario(2));
    expect(agent.hooks.afterStatus).toBe(TestStatus.PASSED);
  });

  it('passes the correct status to onAfterExecute on FAILED run', async () => {
    agent.stepBehavior = 'fail';
    await agent.execute(makeScenario(2));
    expect(agent.hooks.afterStatus).toBe(TestStatus.FAILED);
  });

  it('includes scenarioId, startTime, endTime, duration in the result', async () => {
    const result = await agent.execute(makeScenario(1)) as any;
    expect(result.scenarioId).toBe('test-scenario');
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('includes extra fields from buildResult', async () => {
    const result = await agent.execute(makeScenario(1)) as any;
    expect(result.extra).toBe('test-extra');
  });

  it('handles empty scenario (zero steps) and returns PASSED', async () => {
    const result = await agent.execute(makeScenario(0)) as any;
    expect(result.status).toBe(TestStatus.PASSED);
    expect(result.stepResults).toHaveLength(0);
  });
});
