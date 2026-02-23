/**
 * Tests for ResultsHandler: saveResults(), displayResults(), performDryRun()
 *
 * Regression tests:
 *   - displayResults() uses logger.info NOT console.log
 *   - saveResults() writes a JSON file to the specified path
 */

import { saveResults, displayResults, performDryRun } from '../../lib/ResultsHandler';
import { TestStatus, TestInterface } from '../../models/TestModels';
import type { TestSession } from '../../models/TestModels';
import type { OrchestratorScenario } from '../../models/TestModels';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockMkdir = jest.fn().mockResolvedValue(undefined);

jest.mock('fs/promises', () => ({
  writeFile: (...args: any[]) => mockWriteFile(...args),
  mkdir: (...args: any[]) => mockMkdir(...args),
  readFile: jest.fn(),
  readdir: jest.fn(),
}));

const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerDebug = jest.fn();

jest.mock('../../utils/logger', () => ({
  logger: {
    info: (...args: any[]) => mockLoggerInfo(...args),
    warn: (...args: any[]) => mockLoggerWarn(...args),
    error: (...args: any[]) => mockLoggerError(...args),
    debug: (...args: any[]) => mockLoggerDebug(...args),
  },
}));

// ScenarioLoader used by performDryRun
jest.mock('../../lib/ScenarioLoader', () => ({
  filterScenariosForSuite: jest.fn((scenarios: any[]) => scenarios),
  TEST_SUITES: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<TestSession> = {}): TestSession {
  return {
    id: 'session-abc',
    startTime: new Date('2026-01-01T10:00:00Z'),
    endTime: new Date('2026-01-01T10:01:00Z'),
    status: TestStatus.PASSED,
    results: [],
    summary: {
      total: 5,
      passed: 4,
      failed: 1,
      skipped: 0,
    },
    ...overrides,
  };
}

function makeScenario(id: string, tags: string[] = []): OrchestratorScenario {
  return {
    id,
    name: `Scenario ${id}`,
    description: 'Test scenario',
    priority: 'HIGH' as any,
    interface: TestInterface.CLI,
    prerequisites: [],
    steps: [],
    verifications: [],
    expectedOutcome: 'pass',
    estimatedDuration: 30,
    tags,
    enabled: true,
  };
}

// ---------------------------------------------------------------------------
// displayResults() — regression: uses logger.info NOT console.log
// ---------------------------------------------------------------------------

describe('displayResults()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls logger.info at least once', () => {
    displayResults(makeSession());

    expect(mockLoggerInfo).toHaveBeenCalled();
  });

  it('does NOT call console.log for test output (regression)', () => {
    // console.log is mocked to jest.fn() in tests/setup.ts
    const consoleSpy = jest.spyOn(console, 'log');

    displayResults(makeSession());

    // console.log must not be called — library output goes through logger
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('passes sessionId to logger.info', () => {
    displayResults(makeSession({ id: 'my-session-id' }));

    const infoCall = mockLoggerInfo.mock.calls.find(
      call => JSON.stringify(call).includes('my-session-id')
    );
    expect(infoCall).toBeDefined();
  });

  it('includes pass rate in logger.info output', () => {
    displayResults(makeSession());

    const hasPassRate = mockLoggerInfo.mock.calls.some(call =>
      JSON.stringify(call).includes('passRate')
    );
    expect(hasPassRate).toBe(true);
  });

  it('calculates 100% pass rate when all tests pass', () => {
    const session = makeSession({
      summary: { total: 3, passed: 3, failed: 0, skipped: 0 },
    });

    displayResults(session);

    const callStr = JSON.stringify(mockLoggerInfo.mock.calls);
    expect(callStr).toContain('100.0%');
  });

  it('calculates 0% pass rate when total is 0', () => {
    const session = makeSession({
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
    });

    displayResults(session);

    const callStr = JSON.stringify(mockLoggerInfo.mock.calls);
    expect(callStr).toContain('0.0%');
  });

  it('includes duration in logger.info output', () => {
    displayResults(makeSession());

    const hasDuration = mockLoggerInfo.mock.calls.some(call =>
      JSON.stringify(call).includes('duration')
    );
    expect(hasDuration).toBe(true);
  });

  it('calculates duration = 0 when startTime or endTime is missing', () => {
    const session = makeSession({ endTime: undefined });

    // Should not throw
    expect(() => displayResults(session)).not.toThrow();

    const callStr = JSON.stringify(mockLoggerInfo.mock.calls);
    expect(callStr).toContain('0.00 seconds');
  });
});

// ---------------------------------------------------------------------------
// saveResults() tests
// ---------------------------------------------------------------------------

describe('saveResults()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a file to the specified outputPath', async () => {
    const session = makeSession();

    await saveResults(session, '/tmp/results/output.json');

    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/results/output.json',
      expect.any(String)
    );
  });

  it('creates intermediate directories before writing', async () => {
    await saveResults(makeSession(), '/tmp/deep/path/output.json');

    expect(mockMkdir).toHaveBeenCalledWith('/tmp/deep/path', { recursive: true });
  });

  it('writes valid JSON content', async () => {
    await saveResults(makeSession(), '/tmp/output.json');

    const writtenContent = mockWriteFile.mock.calls[0][1];
    expect(() => JSON.parse(writtenContent)).not.toThrow();
  });

  it('written JSON contains sessionId', async () => {
    await saveResults(makeSession({ id: 'session-xyz' }), '/tmp/output.json');

    const parsed = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(parsed.sessionId).toBe('session-xyz');
  });

  it('written JSON contains summary', async () => {
    await saveResults(makeSession(), '/tmp/output.json');

    const parsed = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(parsed.summary).toBeDefined();
    expect(typeof parsed.summary.total).toBe('number');
  });

  it('written JSON contains startTime as ISO string', async () => {
    await saveResults(makeSession(), '/tmp/output.json');

    const parsed = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(typeof parsed.startTime).toBe('string');
    // Should be parseable as a date
    expect(() => new Date(parsed.startTime)).not.toThrow();
  });

  it('written JSON contains results array', async () => {
    await saveResults(makeSession(), '/tmp/output.json');

    const parsed = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(Array.isArray(parsed.results)).toBe(true);
  });

  it('calls logger.info after writing', async () => {
    await saveResults(makeSession(), '/tmp/output.json');

    expect(mockLoggerInfo).toHaveBeenCalled();
  });

  it('sets endTime to null in JSON when session.endTime is undefined', async () => {
    await saveResults(makeSession({ endTime: undefined }), '/tmp/output.json');

    const parsed = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(parsed.endTime).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// performDryRun() tests
// ---------------------------------------------------------------------------

describe('performDryRun()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs DRY RUN MODE message', async () => {
    await performDryRun([], 'smoke');

    const callStr = JSON.stringify(mockLoggerInfo.mock.calls);
    expect(callStr).toContain('DRY RUN');
  });

  it('logs each scenario without executing it', async () => {
    const scenarios = [
      makeScenario('scenario-1'),
      makeScenario('scenario-2'),
    ];

    await performDryRun(scenarios, 'full');

    // Two scenario info calls + one DRY RUN MODE call
    expect(mockLoggerInfo.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not throw when scenarios array is empty', async () => {
    await expect(performDryRun([], 'smoke')).resolves.toBeUndefined();
  });

  it('logs scenario name in output', async () => {
    const scenarios = [makeScenario('my-scenario')];

    await performDryRun(scenarios, 'full');

    const callStr = JSON.stringify(mockLoggerInfo.mock.calls);
    expect(callStr).toContain('my-scenario');
  });

  it('includes suite name in dry run output', async () => {
    await performDryRun([], 'regression');

    const callStr = JSON.stringify(mockLoggerInfo.mock.calls);
    expect(callStr).toContain('regression');
  });
});
