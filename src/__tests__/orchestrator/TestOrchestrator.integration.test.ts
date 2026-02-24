/**
 * TestOrchestrator integration tests.
 *
 * Heavy dependencies (agents, fs, ScenarioLoader) are mocked so tests are
 * fast and deterministic. The goal is to exercise the orchestrator's own
 * logic: agent registry wiring, session lifecycle, suite filtering, and
 * failFast behaviour.
 */

// ---------------------------------------------------------------------------
// Heavy module mocks — declared BEFORE any imports
// ---------------------------------------------------------------------------

// Agents
jest.mock('../../agents/CLIAgent',         () => ({ CLIAgent:         jest.fn().mockImplementation(() => makeAgent()) }));
jest.mock('../../agents/TUIAgent',         () => ({ TUIAgent:         jest.fn().mockImplementation(() => makeAgent()) }));
jest.mock('../../agents/ElectronUIAgent',  () => ({ ElectronUIAgent:  jest.fn().mockImplementation(() => makeAgent()) }));
jest.mock('../../agents/APIAgent',         () => ({ APIAgent:         jest.fn().mockImplementation(() => makeAgent()) }));
jest.mock('../../agents/IssueReporter',    () => ({ IssueReporter:    jest.fn().mockImplementation(() => makeAgent()) }));
jest.mock('../../agents/PriorityAgent',    () => ({ PriorityAgent:    jest.fn().mockImplementation(() => makeAgent()) }));

// Orchestrator sub-components
jest.mock('../../orchestrator/ScenarioRouter',    () => ({ ScenarioRouter:    jest.fn().mockImplementation(() => mockRouterInstance) }));
jest.mock('../../orchestrator/SessionManager',    () => ({ SessionManager:    jest.fn().mockImplementation(() => mockSessionInstance) }));
jest.mock('../../orchestrator/ResultAggregator',  () => ({ ResultAggregator:  jest.fn().mockImplementation(() => mockAggregatorInstance) }));
jest.mock('../../orchestrator/agentAdapters',     () => ({
  adaptTUIConfig:      jest.fn(c => c),
  adaptPriorityConfig: jest.fn(c => c),
  adaptUIConfig:       jest.fn(c => c),
}));

// Scenario loading
jest.mock('../../adapters/scenarioAdapter', () => ({
  adaptScenarioToComplex: jest.fn(s => s),
}));
jest.mock('../../lib/ScenarioLoader', () => ({
  filterScenariosForSuite: jest.fn((scenarios: unknown[]) => scenarios),
}));
jest.mock('../../scenarios', () => ({
  ScenarioLoader: {
    loadFromFile: jest.fn().mockResolvedValue({ id: 'sc1', name: 'Scenario 1', tags: [] }),
  },
}));

jest.mock('fs/promises', () => ({
  readdir: jest.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------

import { TestOrchestrator } from '../../orchestrator/TestOrchestrator';
import { TestStatus, TestInterface, Priority } from '../../models/TestModels';
import type { OrchestratorScenario, TestSession } from '../../models/TestModels';
import { filterScenariosForSuite } from '../../lib/ScenarioLoader';

// ---------------------------------------------------------------------------
// Shared mock instance factories
// ---------------------------------------------------------------------------

function makeAgent() {
  return {
    initialize:  jest.fn().mockResolvedValue(undefined),
    execute:     jest.fn().mockResolvedValue({ status: TestStatus.PASSED }),
    cleanup:     jest.fn().mockResolvedValue(undefined),
    getCapabilities: jest.fn().mockReturnValue({ interfaces: [] }),
  };
}

let mockSessionId = 'session-001';

const mockSessionInstance = {
  create:      jest.fn(() => ({ id: mockSessionId, status: TestStatus.RUNNING, results: [], summary: {} } as unknown as TestSession)),
  addResult:   jest.fn(),
  complete:    jest.fn(() => Promise.resolve({ id: mockSessionId, status: TestStatus.PASSED, results: [], summary: {} } as unknown as TestSession)),
  getSession:  jest.fn(() => ({ id: mockSessionId, status: TestStatus.PASSED, results: [], summary: {} } as unknown as TestSession)),
};

const mockAggregatorInstance = {
  record:          jest.fn(),
  recordFailure:   jest.fn(),
  analyze:         jest.fn().mockResolvedValue(undefined),
  report:          jest.fn().mockResolvedValue(undefined),
  getResults:      jest.fn().mockReturnValue([]),
  getFailures:     jest.fn().mockReturnValue([]),
};

const mockRouterInstance = {
  route:     jest.fn().mockResolvedValue(undefined),
  onResult:  undefined as unknown,
  onFailure: undefined as unknown,
};

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function makeMinimalConfig(overrides: Record<string, unknown> = {}) {
  return {
    cli: {
      executablePath: 'node',
      workingDirectory: '/tmp',
      defaultTimeout: 5000,
      environment: {},
      captureOutput: false,
      maxRetries: 0,
      retryDelay: 0,
    },
    tui: {
      terminal: 'xterm',
      encoding: 'utf8',
      environment: {},
    },
    api: {},
    execution: {
      maxParallel: 2,
      defaultTimeout: 5000,
      continueOnFailure: true,
      maxRetries: 1,
    },
    logging:   { level: 'info', console: false },
    reporting: { formats: [], includeScreenshots: false },
    ...overrides,
  };
}

function makeScenario(id: string, tags: string[] = []): OrchestratorScenario {
  return {
    id,
    name: `Scenario ${id}`,
    description: '',
    priority: Priority.MEDIUM,
    interface: TestInterface.CLI,
    prerequisites: [],
    steps: [{ action: 'execute', target: 'cmd' }],
    verifications: [],
    expectedOutcome: 'pass',
    estimatedDuration: 1,
    tags,
    enabled: true,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Reset router callbacks each test
  mockRouterInstance.onResult  = undefined;
  mockRouterInstance.onFailure = undefined;
  // Default: router.route resolves immediately
  mockRouterInstance.route.mockResolvedValue(undefined);
  // Default: session complete returns PASSED
  mockSessionInstance.complete.mockResolvedValue({
    id: mockSessionId,
    status: TestStatus.PASSED,
    results: [],
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
  } as unknown as TestSession);
  mockSessionInstance.getSession.mockReturnValue({
    id: mockSessionId,
    status: TestStatus.PASSED,
    results: [],
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
  } as unknown as TestSession);
});

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------

describe('TestOrchestrator constructor', () => {
  it('instantiates without throwing given a minimal config', () => {
    const config = makeMinimalConfig();
    expect(() => new TestOrchestrator(config as any)).not.toThrow();
  });

  it('creates a CLIAgent and TUIAgent from the config', () => {
    const { CLIAgent } = jest.requireMock('../../agents/CLIAgent');
    const { TUIAgent } = jest.requireMock('../../agents/TUIAgent');

    new TestOrchestrator(makeMinimalConfig() as any);

    expect(CLIAgent).toHaveBeenCalled();
    expect(TUIAgent).toHaveBeenCalled();
  });

  it('does not create an ElectronUIAgent when ui.browser is absent', () => {
    const { ElectronUIAgent } = jest.requireMock('../../agents/ElectronUIAgent');

    new TestOrchestrator(makeMinimalConfig() as any);

    expect(ElectronUIAgent).not.toHaveBeenCalled();
  });

  it('creates an ElectronUIAgent when ui.browser is provided', () => {
    const { ElectronUIAgent } = jest.requireMock('../../agents/ElectronUIAgent');

    new TestOrchestrator(makeMinimalConfig({
      ui: { browser: 'chromium', headless: true, viewport: { width: 1280, height: 720 } },
    }) as any);

    expect(ElectronUIAgent).toHaveBeenCalled();
  });

  it('creates an APIAgent from the config', () => {
    const { APIAgent } = jest.requireMock('../../agents/APIAgent');

    new TestOrchestrator(makeMinimalConfig() as any);

    expect(APIAgent).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// run() with empty scenario list
// ---------------------------------------------------------------------------

describe('run() with empty scenario list', () => {
  it('returns a session object without throwing', async () => {
    // filterScenariosForSuite returns empty array
    (filterScenariosForSuite as jest.Mock).mockReturnValue([]);

    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    const session = await orchestrator.run('smoke', []);

    expect(session).toBeDefined();
    expect(session.id).toBe(mockSessionId);
  });

  it('emits session:start and session:end events', async () => {
    (filterScenariosForSuite as jest.Mock).mockReturnValue([]);

    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    const starts: unknown[] = [];
    const ends: unknown[] = [];

    orchestrator.on('session:start', s => starts.push(s));
    orchestrator.on('session:end',   s => ends.push(s));

    await orchestrator.run('smoke', []);

    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
  });

  it('calls router.route with an empty array', async () => {
    (filterScenariosForSuite as jest.Mock).mockReturnValue([]);

    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    await orchestrator.run('smoke', []);

    expect(mockRouterInstance.route).toHaveBeenCalledWith([]);
  });

  it('calls aggregator.analyze and aggregator.report', async () => {
    (filterScenariosForSuite as jest.Mock).mockReturnValue([]);

    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    await orchestrator.run('smoke', []);

    expect(mockAggregatorInstance.analyze).toHaveBeenCalled();
    expect(mockAggregatorInstance.report).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// runWithScenarios() — suite filtering
// ---------------------------------------------------------------------------

describe('runWithScenarios()', () => {
  it('passes loaded scenarios through filterScenariosForSuite', async () => {
    const sc = makeScenario('auth:login', ['smoke']);
    (filterScenariosForSuite as jest.Mock).mockReturnValue([sc]);

    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    await orchestrator.runWithScenarios('smoke', [sc as any]);

    expect(filterScenariosForSuite).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'auth:login' })]),
      'smoke'
    );
  });

  it('routes the filtered scenarios to the router', async () => {
    const sc = makeScenario('auth:login', ['smoke']);
    (filterScenariosForSuite as jest.Mock).mockReturnValue([sc]);

    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    await orchestrator.runWithScenarios('smoke', [sc as any]);

    expect(mockRouterInstance.route).toHaveBeenCalledWith([sc]);
  });

  it('returns a completed session', async () => {
    (filterScenariosForSuite as jest.Mock).mockReturnValue([]);

    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    const session = await orchestrator.runWithScenarios('full', []);

    expect(session).toBeDefined();
    expect(session.id).toBe(mockSessionId);
  });
});

// ---------------------------------------------------------------------------
// run() error handling
// ---------------------------------------------------------------------------

describe('run() error propagation', () => {
  it('re-throws errors from router.route and still completes the session', async () => {
    (filterScenariosForSuite as jest.Mock).mockReturnValue([makeScenario('sc1')]);
    mockRouterInstance.route.mockRejectedValue(new Error('router exploded'));

    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);

    await expect(orchestrator.run('smoke', [])).rejects.toThrow('router exploded');

    // Session must still be finalized even on error (finally block)
    expect(mockSessionInstance.complete).toHaveBeenCalled();
  });

  it('emits an error event when router throws', async () => {
    (filterScenariosForSuite as jest.Mock).mockReturnValue([makeScenario('sc1')]);
    mockRouterInstance.route.mockRejectedValue(new Error('routing failure'));

    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    const errors: Error[] = [];
    orchestrator.on('error', e => errors.push(e));

    await orchestrator.run('smoke', []).catch(() => {/* swallow re-throw */});

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('routing failure');
  });
});

// ---------------------------------------------------------------------------
// abort()
// ---------------------------------------------------------------------------

describe('abort()', () => {
  it('does not throw', () => {
    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    expect(() => orchestrator.abort()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getResults() / getFailures() / getSession()
// ---------------------------------------------------------------------------

describe('accessors', () => {
  it('getResults() delegates to aggregator', () => {
    mockAggregatorInstance.getResults.mockReturnValue([{ scenarioId: 'x' }]);
    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    expect(orchestrator.getResults()).toEqual([{ scenarioId: 'x' }]);
  });

  it('getFailures() delegates to aggregator', () => {
    mockAggregatorInstance.getFailures.mockReturnValue([{ scenarioId: 'y', message: 'oops' }]);
    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    expect(orchestrator.getFailures()).toEqual([{ scenarioId: 'y', message: 'oops' }]);
  });

  it('getSession() returns null before a run starts', () => {
    mockSessionInstance.getSession.mockReturnValue(null);
    const orchestrator = new TestOrchestrator(makeMinimalConfig() as any);
    expect(orchestrator.getSession()).toBeNull();
  });
});
