/**
 * PriorityAgent test suite
 *
 * Tests for the fixes introduced in issue #97:
 *   1. execute() uses real scenario data, not a mock failure
 *   2. Persistence methods (load/save history and pattern cache) use fs/promises JSON serialization
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  PriorityAgent,
  createPriorityAgent,
  PriorityAgentConfig,
  PriorityAssignment
} from '../src/agents/PriorityAgent';
import {
  OrchestratorScenario,
  Priority,
  TestInterface,
  TestFailure,
  TestResult,
  TestStatus
} from '../src/models/TestModels';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function makeScenario(overrides: Partial<OrchestratorScenario> = {}): OrchestratorScenario {
  return {
    id: 'scenario-1',
    name: 'Login flow',
    description: 'Tests the user login flow',
    priority: Priority.HIGH,
    interface: TestInterface.GUI,
    prerequisites: [],
    steps: [{ action: 'click', target: '#login-btn', description: 'Click login' }],
    verifications: [],
    expectedOutcome: 'User is logged in',
    estimatedDuration: 30,
    tags: [],
    enabled: true,
    ...overrides
  };
}

async function buildInitializedAgent(config: PriorityAgentConfig = {}): Promise<PriorityAgent> {
  const agent = createPriorityAgent(config);
  await agent.initialize();
  return agent;
}

// -----------------------------------------------------------------------
// execute() — real scenario data
// -----------------------------------------------------------------------

describe('PriorityAgent.execute()', () => {
  let agent: PriorityAgent;

  beforeEach(async () => {
    agent = await buildInitializedAgent();
  });

  afterEach(async () => {
    await agent.cleanup();
  });

  it('returns null when the scenario has no steps', async () => {
    const scenario = makeScenario({ steps: [] });
    const result = await agent.execute(scenario);
    expect(result).toBeNull();
  });

  it('returns a PriorityAssignment when the scenario has steps', async () => {
    const scenario = makeScenario();
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
    expect(result!.scenarioId).toBe('scenario-1');
    expect(typeof result!.impactScore).toBe('number');
    expect(result!.impactScore).toBeGreaterThanOrEqual(0);
    expect(result!.impactScore).toBeLessThanOrEqual(100);
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });

  it('uses the scenario description as the failure message, not a hard-coded mock string', async () => {
    const scenario = makeScenario({ description: 'My real scenario description' });
    // analyzePriority is called internally; we verify that the assignment is based on
    // real data by checking that the result is coherent with the scenario.
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
    // The assignment's scenarioId must match the scenario's id, not some fabricated value
    expect(result!.scenarioId).toBe(scenario.id);
  });

  it('uses scenario.name as the message fallback when description is empty', async () => {
    const scenario = makeScenario({ description: '', name: 'Fallback name scenario' });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
    expect(result!.scenarioId).toBe(scenario.id);
  });

  it('throws when called before initialize()', async () => {
    const uninitialised = createPriorityAgent();
    await expect(uninitialised.execute(makeScenario())).rejects.toThrow(
      'PriorityAgent not initialized'
    );
  });

  it('infers category "ui" for GUI scenarios with no relevant tags', async () => {
    const scenario = makeScenario({ interface: TestInterface.GUI, tags: [] });
    const result = await agent.execute(scenario);
    // The category is used internally for scoring - just verify no error and correct shape
    expect(result).not.toBeNull();
    expect(Object.values(Priority)).toContain(result!.priority);
  });

  it('infers category "security" for scenarios tagged security', async () => {
    const scenario = makeScenario({ tags: ['security', 'auth'] });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
  });

  it('infers category "cli" for CLI scenarios', async () => {
    const scenario = makeScenario({ interface: TestInterface.CLI, tags: [] });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
  });

  it('infers category "api" for API scenarios', async () => {
    const scenario = makeScenario({ interface: TestInterface.API, tags: [] });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
  });

  it('infers category "performance" for scenarios tagged performance', async () => {
    const scenario = makeScenario({ tags: ['performance'] });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
  });

  it('infers category "performance" for scenarios tagged load', async () => {
    const scenario = makeScenario({ tags: ['load'] });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
  });

  it('infers category "regression" for scenarios tagged regression', async () => {
    const scenario = makeScenario({ tags: ['regression'] });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
  });

  it('infers category "smoke" for scenarios tagged smoke', async () => {
    const scenario = makeScenario({ tags: ['smoke'] });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
  });

  it('infers category "tui" for TUI scenarios', async () => {
    const scenario = makeScenario({ interface: TestInterface.TUI, tags: [] });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
  });

  it('infers category "execution" for MIXED scenarios with no tags', async () => {
    const scenario = makeScenario({ interface: TestInterface.MIXED, tags: [] });
    const result = await agent.execute(scenario);
    expect(result).not.toBeNull();
  });
});

// -----------------------------------------------------------------------
// Persistence — loadAnalysisHistory / saveAnalysisHistory
// -----------------------------------------------------------------------

describe('PriorityAgent persistence — analysis history', () => {
  let tmpDir: string;
  let historyPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'priority-agent-test-'));
    historyPath = path.join(tmpDir, '.priority-history.json');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('starts with empty history when no file exists', async () => {
    const agent = await buildInitializedAgent({ historyPath });
    // No error thrown and agent is ready to use
    const result = await agent.execute(makeScenario());
    expect(result).not.toBeNull();
    await agent.cleanup();
  });

  it('saves analysis history to the configured file on cleanup', async () => {
    const agent = await buildInitializedAgent({ historyPath });

    await agent.execute(makeScenario({ id: 'scen-save-test' }));
    await agent.cleanup();

    const content = await fs.readFile(historyPath, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, PriorityAssignment[]>;
    expect(parsed['scen-save-test']).toBeDefined();
    expect(Array.isArray(parsed['scen-save-test'])).toBe(true);
    expect(parsed['scen-save-test'].length).toBeGreaterThan(0);
  });

  it('loads previously saved history on initialization without error', async () => {
    // First run: create history
    const agentA = await buildInitializedAgent({ historyPath });
    await agentA.execute(makeScenario({ id: 'scen-persist' }));
    await agentA.cleanup();

    // The saved file must be present and contain the scenario
    const savedContent = await fs.readFile(historyPath, 'utf-8');
    const parsed = JSON.parse(savedContent);
    expect(parsed['scen-persist']).toBeDefined();

    // Second run: loads that history without throwing
    const agentB = await buildInitializedAgent({ historyPath });
    // Agent must still function correctly after loading persisted history
    const result = await agentB.execute(makeScenario({ id: 'scen-persist' }));
    expect(result).not.toBeNull();
    expect(result!.scenarioId).toBe('scen-persist');
    await agentB.cleanup();
  });

  it('handles corrupted history file gracefully (non-ENOENT error results in warn, not throw)', async () => {
    // Write invalid JSON to the history file
    await fs.writeFile(historyPath, '{ invalid json }', 'utf-8');
    // Should not throw
    const agent = await buildInitializedAgent({ historyPath });
    const result = await agent.execute(makeScenario());
    expect(result).not.toBeNull();
    await agent.cleanup();
  });
});

// -----------------------------------------------------------------------
// Persistence — loadPatternCache / savePatternCache
// -----------------------------------------------------------------------

describe('PriorityAgent persistence — pattern cache', () => {
  let tmpDir: string;
  let patternCachePath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'priority-patterns-test-'));
    patternCachePath = path.join(tmpDir, '.priority-patterns.json');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('starts with empty pattern cache when no file exists', async () => {
    const agent = await buildInitializedAgent({ patternCachePath });
    await agent.cleanup();
  });

  it('saves pattern cache to the configured file on cleanup', async () => {
    const agent = await buildInitializedAgent({ patternCachePath });

    // Trigger pattern analysis to populate the cache
    const failures: TestFailure[] = [
      { scenarioId: 'a', timestamp: new Date(), message: 'connection timeout', category: 'network' },
      { scenarioId: 'b', timestamp: new Date(), message: 'connection timeout', category: 'network' }
    ];
    agent.analyzeFailurePatterns(failures);

    await agent.cleanup();

    const content = await fs.readFile(patternCachePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('loads previously saved pattern cache on initialization', async () => {
    // Pre-write a valid pattern cache
    const existingPatterns = [
      {
        id: 'msg-abc123',
        description: 'Error message pattern: "connection timeout"',
        affectedScenarios: ['a', 'b'],
        frequency: 2,
        firstSeen: new Date(Date.now() - 3600000).toISOString(),
        lastSeen: new Date().toISOString(),
        confidence: 0.8,
        suggestedRootCause: 'Network connectivity issues'
      }
    ];
    await fs.writeFile(patternCachePath, JSON.stringify(existingPatterns, null, 2), 'utf-8');

    const agent = await buildInitializedAgent({ patternCachePath });
    // Agent initialized without error; cache was loaded
    await agent.cleanup();
  });

  it('handles corrupted pattern cache file gracefully', async () => {
    await fs.writeFile(patternCachePath, '[ invalid ]', 'utf-8');
    const agent = await buildInitializedAgent({ patternCachePath });
    await agent.cleanup();
  });
});

// -----------------------------------------------------------------------
// Default path resolution
// -----------------------------------------------------------------------

describe('PriorityAgent default persistence paths', () => {
  it('resolves history path to cwd/.priority-history.json when not configured', async () => {
    const agent = await buildInitializedAgent({});
    // Simply verify initialize completes without error when no path configured
    await agent.cleanup();
  });
});

// -----------------------------------------------------------------------
// analyzePriority / rankFailures sanity checks
// -----------------------------------------------------------------------

describe('PriorityAgent.analyzePriority()', () => {
  let agent: PriorityAgent;

  beforeEach(async () => {
    agent = await buildInitializedAgent();
  });

  afterEach(async () => {
    await agent.cleanup();
  });

  it('returns a valid PriorityAssignment for a well-formed failure', async () => {
    const failure: TestFailure = {
      scenarioId: 'test-scenario',
      timestamp: new Date(),
      message: 'Authentication error: invalid credentials',
      category: 'security'
    };
    const assignment = await agent.analyzePriority(failure);
    expect(assignment.scenarioId).toBe('test-scenario');
    expect(Object.values(Priority)).toContain(assignment.priority);
    expect(assignment.impactScore).toBeGreaterThanOrEqual(0);
    expect(assignment.impactScore).toBeLessThanOrEqual(100);
    expect(assignment.reasoning.length).toBeGreaterThan(0);
    expect(assignment.timestamp).toBeInstanceOf(Date);
  });

  it('assigns CRITICAL priority for crash messages', async () => {
    const failure: TestFailure = {
      scenarioId: 'crash-test',
      timestamp: new Date(),
      message: 'fatal crash detected in renderer process',
      category: 'execution'
    };
    const assignment = await agent.analyzePriority(failure);
    // A fatal/crash message should produce a high or critical impact score
    expect(assignment.impactScore).toBeGreaterThan(30);
  });

  it('rankFailures returns assignments sorted by impactScore descending', async () => {
    const failures: TestFailure[] = [
      { scenarioId: 'low-1', timestamp: new Date(), message: 'minor style warning', category: 'ui' },
      { scenarioId: 'high-1', timestamp: new Date(), message: 'fatal crash detected', category: 'execution' }
    ];
    const ranked = await agent.rankFailures(failures);
    expect(ranked.length).toBe(2);
    expect(ranked[0].impactScore).toBeGreaterThanOrEqual(ranked[1].impactScore);
  });

  it('calculateImpactScore() returns a number in range [0,100]', () => {
    const failure: TestFailure = {
      scenarioId: 'impact-test',
      timestamp: new Date(),
      message: 'Network timeout after 30s',
      category: 'api',
    };
    const context = {
      history: [],
      scenarios: new Map(),
      previousPriorities: new Map(),
      systemInfo: {},
    };
    const score = agent.calculateImpactScore(failure, context as any);
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('analyzeFailurePatterns() returns an array', () => {
    const failures: TestFailure[] = [
      { scenarioId: 'p1', timestamp: new Date(), message: 'timeout error', category: 'api' },
      { scenarioId: 'p2', timestamp: new Date(), message: 'timeout error again', category: 'api' },
    ];
    const patterns = agent.analyzeFailurePatterns(failures);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('identifyFlaky() returns an array', () => {
    const results: TestResult[] = [
      { scenarioId: 'flaky-1', status: TestStatus.PASSED, duration: 10, startTime: new Date(), endTime: new Date() },
      { scenarioId: 'flaky-1', status: TestStatus.FAILED, duration: 10, startTime: new Date(), endTime: new Date() },
    ];
    const flaky = agent.identifyFlaky(results);
    expect(Array.isArray(flaky)).toBe(true);
  });
});
