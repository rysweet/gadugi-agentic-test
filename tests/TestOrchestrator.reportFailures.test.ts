/**
 * Tests for TestOrchestrator.reportFailures() — issue #76
 *
 * Verifies that:
 * 1. When createIssuesOnFailure=false, IssueReporter is never called.
 * 2. When there are no failures, IssueReporter is never called.
 * 3. When createIssuesOnFailure=true and failures exist, IssueReporter.createIssue()
 *    is called for every failure — not just a warn log placeholder.
 * 4. Errors from IssueReporter.createIssue() are logged but do NOT abort
 *    reporting for subsequent failures (best-effort semantics).
 */

import { TestOrchestrator } from '../src/orchestrator/TestOrchestrator';
import { IssueReporter } from '../src/agents/IssueReporter';
import { TestFailure, TestStatus } from '../src/models/TestModels';

// ---------------------------------------------------------------------------
// Module-level mocks (must be hoisted before any imports use them)
// ---------------------------------------------------------------------------

jest.mock('../src/agents/IssueReporter');
jest.mock('../src/agents/CLIAgent');
jest.mock('../src/agents/TUIAgent');
jest.mock('../src/agents/ElectronUIAgent');
jest.mock('../src/agents/PriorityAgent');
// APIAgent uses LogLevel at module init — mock the whole module to avoid the error
jest.mock('../src/agents/APIAgent');
jest.mock('../src/utils/logger', () => {
  // Provide a LogLevel enum matching the real one so modules that import it at
  // init time (like APIAgent) don't see undefined values.
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

function makeConfig(createIssuesOnFailure: boolean) {
  return {
    cli: { shell: 'bash', defaultTimeout: 5000, workingDirectory: '/tmp' } as any,
    tui: {
      terminal: 'xterm',
      defaultDimensions: { width: 80, height: 24 },
      defaultTimeout: 5000
    } as any,
    execution: { maxParallel: 1, maxRetries: 0, continueOnFailure: true } as any,
    priority: {} as any,
    github: {
      token: 'test-token',
      owner: 'test-owner',
      repository: 'test-repo',
      baseBranch: 'main',
      createIssuesOnFailure,
      issueLabels: ['bug'],
      issueTitleTemplate: '[FAIL] {{scenarioName}}',
      issueBodyTemplate: '{{failureMessage}}',
      createPullRequestsForFixes: false,
      autoAssignUsers: []
    }
  } as any;
}

function makeFailure(scenarioId: string): TestFailure {
  return {
    scenarioId,
    timestamp: new Date(),
    message: `Failure in ${scenarioId}`,
    category: 'execution'
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TestOrchestrator.reportFailures()', () => {
  let mockInitialize: jest.Mock;
  let mockCleanup: jest.Mock;
  let mockCreateIssue: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInitialize = jest.fn().mockResolvedValue(undefined);
    mockCleanup = jest.fn().mockResolvedValue(undefined);
    mockCreateIssue = jest.fn().mockResolvedValue({ issueNumber: 1, url: 'https://github.com/test/issues/1' });

    // Apply mock implementations to the mocked IssueReporter class
    (IssueReporter as jest.MockedClass<typeof IssueReporter>).mockImplementation(() => ({
      name: 'IssueReporter',
      type: 'github',
      initialize: mockInitialize,
      cleanup: mockCleanup,
      createIssue: mockCreateIssue
    } as any));
  });

  // -------------------------------------------------------------------------
  // Helper: inject failures directly via the private field (cast to any)
  // -------------------------------------------------------------------------
  function injectFailures(orchestrator: TestOrchestrator, failures: TestFailure[]): void {
    (orchestrator as any).failures = failures;
  }

  // Expose private method for direct unit testing
  async function callReportFailures(orchestrator: TestOrchestrator): Promise<void> {
    return (orchestrator as any).reportFailures();
  }

  // -------------------------------------------------------------------------

  it('does not call IssueReporter when createIssuesOnFailure is false', async () => {
    const orchestrator = new TestOrchestrator(makeConfig(false));
    injectFailures(orchestrator, [makeFailure('scenario-1')]);

    await callReportFailures(orchestrator);

    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockCreateIssue).not.toHaveBeenCalled();
    expect(mockCleanup).not.toHaveBeenCalled();
  });

  it('does not call IssueReporter when there are no failures', async () => {
    const orchestrator = new TestOrchestrator(makeConfig(true));
    injectFailures(orchestrator, []);

    await callReportFailures(orchestrator);

    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockCreateIssue).not.toHaveBeenCalled();
    expect(mockCleanup).not.toHaveBeenCalled();
  });

  it('calls IssueReporter.createIssue for each failure when enabled', async () => {
    const orchestrator = new TestOrchestrator(makeConfig(true));
    const failures = [makeFailure('scenario-1'), makeFailure('scenario-2'), makeFailure('scenario-3')];
    injectFailures(orchestrator, failures);

    await callReportFailures(orchestrator);

    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockCreateIssue).toHaveBeenCalledTimes(3);
    expect(mockCreateIssue).toHaveBeenCalledWith(failures[0]);
    expect(mockCreateIssue).toHaveBeenCalledWith(failures[1]);
    expect(mockCreateIssue).toHaveBeenCalledWith(failures[2]);
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('continues reporting subsequent failures when one createIssue call throws', async () => {
    const orchestrator = new TestOrchestrator(makeConfig(true));
    const failures = [makeFailure('fail-a'), makeFailure('fail-b'), makeFailure('fail-c')];
    injectFailures(orchestrator, failures);

    // Second call throws
    mockCreateIssue
      .mockResolvedValueOnce({ issueNumber: 1, url: 'https://github.com/1' })
      .mockRejectedValueOnce(new Error('GitHub API error'))
      .mockResolvedValueOnce({ issueNumber: 3, url: 'https://github.com/3' });

    await callReportFailures(orchestrator);

    // All three were attempted
    expect(mockCreateIssue).toHaveBeenCalledTimes(3);
    // cleanup always called
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('always calls cleanup even when IssueReporter.initialize throws', async () => {
    mockInitialize.mockRejectedValue(new Error('Init failed'));

    const orchestrator = new TestOrchestrator(makeConfig(true));
    injectFailures(orchestrator, [makeFailure('scenario-x')]);

    // Should not propagate — cleanup still runs
    await expect(callReportFailures(orchestrator)).resolves.toBeUndefined();

    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(mockCreateIssue).not.toHaveBeenCalled();
  });
});
