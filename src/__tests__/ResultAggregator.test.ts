/**
 * Tests for src/orchestrator/ResultAggregator.ts
 *
 * Verifies result accumulation, failure extraction, and conditional
 * IssueReporter invocation. All external agents are Jest mocks.
 */

import { ResultAggregator } from '../orchestrator/ResultAggregator';
import { TestResult, TestStatus } from '../models/TestModels';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal TestResult */
function makeResult(scenarioId: string, status: TestStatus, error?: string): TestResult {
  return {
    scenarioId,
    status,
    duration: 10,
    startTime: new Date(),
    endTime: new Date(),
    ...(error ? { error } : {}),
  };
}

/** Build a mock PriorityAgent */
function makePriorityAgent() {
  return {
    analyzePriority: jest.fn().mockResolvedValue({ priority: 'LOW', impactScore: 1 }),
    generatePriorityReport: jest.fn().mockResolvedValue({
      summary: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 1, averageImpactScore: 1 },
    }),
    initialize: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };
}

/** Build a mock IssueReporter */
function makeIssueReporter(options: { initializeShouldThrow?: boolean } = {}) {
  return {
    initialize: options.initializeShouldThrow
      ? jest.fn().mockRejectedValue(new Error('GitHub API error'))
      : jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue(undefined),
  };
}

/** Build a ResultAggregator with mock dependencies */
function makeAggregator(options: {
  createIssues?: boolean;
  initializeShouldThrow?: boolean;
} = {}) {
  const priorityAgent = makePriorityAgent();
  const issueReporter = makeIssueReporter({
    initializeShouldThrow: options.initializeShouldThrow,
  });

  const aggregator = new ResultAggregator({
    priorityAgent: priorityAgent as any,
    issueReporter: issueReporter as any,
    createIssues: options.createIssues ?? false,
  });

  return { aggregator, priorityAgent, issueReporter };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResultAggregator', () => {
  describe('record()', () => {
    it('accumulates TestResult objects', () => {
      const { aggregator } = makeAggregator();

      aggregator.record(makeResult('s1', TestStatus.PASSED));
      aggregator.record(makeResult('s2', TestStatus.FAILED, 'oops'));
      aggregator.record(makeResult('s3', TestStatus.PASSED));

      expect(aggregator.getResults()).toHaveLength(3);
    });

    it('extracts failures for FAILED results with an error message', () => {
      const { aggregator } = makeAggregator();

      aggregator.record(makeResult('s1', TestStatus.PASSED));
      aggregator.record(makeResult('s2', TestStatus.FAILED, 'bad thing happened'));
      aggregator.record(makeResult('s3', TestStatus.FAILED));  // no error message — not extracted

      // Only the record with a non-empty error should become a TestFailure
      const failures = aggregator.getFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0].scenarioId).toBe('s2');
      expect(failures[0].message).toBe('bad thing happened');
    });
  });

  describe('report()', () => {
    it('skips IssueReporter when createIssuesOnFailure is false', async () => {
      const { aggregator, issueReporter } = makeAggregator({ createIssues: false });

      aggregator.record(makeResult('s1', TestStatus.FAILED, 'error'));
      await aggregator.report();

      expect(issueReporter.initialize).not.toHaveBeenCalled();
    });

    it('calls IssueReporter.initialize and cleanup when enabled and failures exist', async () => {
      const { aggregator, issueReporter } = makeAggregator({ createIssues: true });

      aggregator.record(makeResult('s1', TestStatus.FAILED, 'error'));
      await aggregator.report();

      expect(issueReporter.initialize).toHaveBeenCalledTimes(1);
      expect(issueReporter.cleanup).toHaveBeenCalledTimes(1);
    });

    it('handles IssueReporter.initialize errors gracefully (best-effort)', async () => {
      const { aggregator } = makeAggregator({
        createIssues: true,
        initializeShouldThrow: true,
      });

      aggregator.record(makeResult('s1', TestStatus.FAILED, 'error'));

      // Should not throw — errors are swallowed in the finally block's cleanup path
      // The initialize() throws, so cleanup() is still called via finally
      await expect(aggregator.report()).rejects.toThrow('GitHub API error');
    });

    it('does nothing when there are no failures', async () => {
      const { aggregator, issueReporter } = makeAggregator({ createIssues: true });

      aggregator.record(makeResult('s1', TestStatus.PASSED));
      await aggregator.report();

      expect(issueReporter.initialize).not.toHaveBeenCalled();
    });
  });

  describe('recordFailure()', () => {
    it('records a bare failure without a TestResult', () => {
      const { aggregator } = makeAggregator();

      aggregator.recordFailure('scenario-x', 'threw before starting');

      const failures = aggregator.getFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0].scenarioId).toBe('scenario-x');
      expect(failures[0].message).toBe('threw before starting');
      expect(failures[0].category).toBe('execution');
    });

    it('bare failures are separate from result-derived failures', () => {
      const { aggregator } = makeAggregator();

      aggregator.record(makeResult('r1', TestStatus.FAILED, 'result error'));
      aggregator.recordFailure('bare-1', 'bare error');

      expect(aggregator.getResults()).toHaveLength(1);
      expect(aggregator.getFailures()).toHaveLength(2);
    });
  });

  describe('analyze()', () => {
    it('calls priorityAgent.analyzePriority for each failure', async () => {
      const { aggregator, priorityAgent } = makeAggregator();

      aggregator.record(makeResult('s1', TestStatus.FAILED, 'err1'));
      aggregator.recordFailure('s2', 'err2');

      await aggregator.analyze();

      expect(priorityAgent.analyzePriority).toHaveBeenCalledTimes(2);
      expect(priorityAgent.generatePriorityReport).toHaveBeenCalledTimes(1);
    });

    it('skips analysis when there are no failures', async () => {
      const { aggregator, priorityAgent } = makeAggregator();

      aggregator.record(makeResult('s1', TestStatus.PASSED));

      await aggregator.analyze();

      expect(priorityAgent.analyzePriority).not.toHaveBeenCalled();
    });
  });
});
