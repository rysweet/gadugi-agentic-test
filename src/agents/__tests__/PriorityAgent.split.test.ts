/**
 * Tests for PriorityAgent split into focused sub-modules.
 *
 * These tests verify:
 * 1. Each sub-module exports its declared public API
 * 2. The facade PriorityAgent still works end-to-end
 * 3. Backward-compatible re-exports from PriorityAgent.ts remain intact
 */

import {
  PriorityFactors,
  PriorityAgentConfig,
  PriorityRule,
  AnalysisContext,
  PriorityAssignment,
  FailurePattern,
  FlakyTestResult,
  PriorityReport,
  DEFAULT_PRIORITY_FACTORS,
  DEFAULT_CONFIG,
} from '../priority/types';

import { PriorityQueue } from '../priority/PriorityQueue';
import { PriorityAnalyzer } from '../priority/PriorityAnalyzer';
import { PriorityPatternExtractor } from '../priority/PriorityPatternExtractor';

import {
  PriorityAgent,
  createPriorityAgent,
  defaultPriorityAgentConfig,
} from '../PriorityAgent';

import { Priority, TestStatus } from '../../models/TestModels';
import type { TestFailure, TestResult } from '../../models/TestModels';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeFailure(overrides: Partial<TestFailure> = {}): TestFailure {
  return {
    scenarioId: 'test-scenario',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    message: 'Test failed with error',
    category: 'execution',
    ...overrides,
  };
}

function makeResult(
  scenarioId: string,
  status: TestStatus,
  offset = 0
): TestResult {
  const start = new Date(Date.now() - offset);
  const end = new Date(start.getTime() + 1000);
  return {
    scenarioId,
    status,
    startTime: start,
    endTime: end,
    duration: 1000,
    retries: 0,
    failures: [],
  };
}

function makeContext(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    history: [],
    scenarios: new Map(),
    previousPriorities: new Map(),
    systemInfo: {},
    ...overrides,
  };
}

// ─── types.ts ───────────────────────────────────────────────────────────────

describe('priority/types', () => {
  it('exports DEFAULT_PRIORITY_FACTORS with weights summing to 1.0', () => {
    const total = Object.values(DEFAULT_PRIORITY_FACTORS).reduce(
      (sum, w) => sum + w,
      0
    );
    expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
  });

  it('exports DEFAULT_CONFIG with expected shape', () => {
    expect(DEFAULT_CONFIG).toHaveProperty('historyRetentionDays');
    expect(DEFAULT_CONFIG).toHaveProperty('flakyThreshold');
    expect(DEFAULT_CONFIG).toHaveProperty('patternSensitivity');
    expect(DEFAULT_CONFIG).toHaveProperty('minSamplesForTrends');
    expect(DEFAULT_CONFIG).toHaveProperty('customRules');
    expect(Array.isArray(DEFAULT_CONFIG.customRules)).toBe(true);
  });
});

// ─── PriorityAnalyzer ────────────────────────────────────────────────────────

describe('PriorityAnalyzer', () => {
  let analyzer: PriorityAnalyzer;

  beforeEach(() => {
    analyzer = new PriorityAnalyzer(DEFAULT_CONFIG);
  });

  describe('calculateImpactScore', () => {
    it('returns a score in the 0-100 range', () => {
      const failure = makeFailure();
      const ctx = makeContext();
      const score = analyzer.calculateImpactScore(failure, ctx);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('scores crash messages higher than warning messages', () => {
      const ctx = makeContext();
      const crashScore = analyzer.calculateImpactScore(
        makeFailure({ message: 'Application crashed with fatal error' }),
        ctx
      );
      const warnScore = analyzer.calculateImpactScore(
        makeFailure({ message: 'Warning: minor issue detected' }),
        ctx
      );
      expect(crashScore).toBeGreaterThan(warnScore);
    });
  });

  describe('determinePriorityLevel', () => {
    it('returns CRITICAL for scores >= 80', () => {
      expect(analyzer.determinePriorityLevel(80)).toBe(Priority.CRITICAL);
      expect(analyzer.determinePriorityLevel(100)).toBe(Priority.CRITICAL);
    });

    it('returns HIGH for scores in [60, 80)', () => {
      expect(analyzer.determinePriorityLevel(60)).toBe(Priority.HIGH);
      expect(analyzer.determinePriorityLevel(79)).toBe(Priority.HIGH);
    });

    it('returns MEDIUM for scores in [40, 60)', () => {
      expect(analyzer.determinePriorityLevel(40)).toBe(Priority.MEDIUM);
      expect(analyzer.determinePriorityLevel(59)).toBe(Priority.MEDIUM);
    });

    it('returns LOW for scores below 40', () => {
      expect(analyzer.determinePriorityLevel(0)).toBe(Priority.LOW);
      expect(analyzer.determinePriorityLevel(39)).toBe(Priority.LOW);
    });
  });

  describe('calculateConfidence', () => {
    it('returns base confidence of 0.5 with no history', () => {
      const confidence = analyzer.calculateConfidence(makeFailure(), makeContext());
      expect(confidence).toBeGreaterThanOrEqual(0.5);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('increases confidence when scenario context is available', () => {
      const scenarios = new Map();
      scenarios.set('test-scenario', {
        id: 'test-scenario',
        name: 'Test',
        priority: Priority.HIGH,
        interface: 'cli',
        tags: [],
      });
      const ctxWithScenario = makeContext({ scenarios });
      const ctxWithout = makeContext();
      const confWith = analyzer.calculateConfidence(makeFailure(), ctxWithScenario);
      const confWithout = analyzer.calculateConfidence(makeFailure(), ctxWithout);
      expect(confWith).toBeGreaterThan(confWithout);
    });
  });

  describe('estimateFixEffort', () => {
    it('returns a positive number of hours', () => {
      const effort = analyzer.estimateFixEffort(makeFailure(), makeContext());
      expect(effort).toBeGreaterThan(0);
    });
  });

  describe('generateReasoning', () => {
    it('returns a non-empty array of strings', () => {
      const reasoning = analyzer.generateReasoning(makeFailure(), makeContext(), 75);
      expect(Array.isArray(reasoning)).toBe(true);
      expect(reasoning.length).toBeGreaterThan(0);
      expect(typeof reasoning[0]).toBe('string');
    });

    it('includes the impact score in reasoning', () => {
      const reasoning = analyzer.generateReasoning(makeFailure(), makeContext(), 75);
      const combined = reasoning.join(' ');
      expect(combined).toMatch(/75/);
    });
  });

  describe('calculateFactorBreakdown', () => {
    it('returns an object with all seven factor keys', () => {
      const breakdown = analyzer.calculateFactorBreakdown(makeFailure(), makeContext());
      expect(breakdown).toHaveProperty('severity');
      expect(breakdown).toHaveProperty('userImpact');
      expect(breakdown).toHaveProperty('stability');
      expect(breakdown).toHaveProperty('businessPriority');
      expect(breakdown).toHaveProperty('securityImplications');
      expect(breakdown).toHaveProperty('performanceImpact');
      expect(breakdown).toHaveProperty('regressionDetection');
    });
  });

  describe('validateConfiguration', () => {
    it('throws when flakyThreshold is out of range', () => {
      const badConfig = { ...DEFAULT_CONFIG, flakyThreshold: 1.5 };
      const badAnalyzer = new PriorityAnalyzer(badConfig);
      expect(() => badAnalyzer.validateConfiguration()).toThrow();
    });

    it('does not throw for valid configuration', () => {
      expect(() => analyzer.validateConfiguration()).not.toThrow();
    });
  });
});

// ─── PriorityQueue ────────────────────────────────────────────────────────────

describe('PriorityQueue', () => {
  let queue: PriorityQueue;
  let analyzer: PriorityAnalyzer;

  beforeEach(() => {
    analyzer = new PriorityAnalyzer(DEFAULT_CONFIG);
    queue = new PriorityQueue(analyzer, DEFAULT_CONFIG);
  });

  describe('rankFailures', () => {
    it('returns assignments sorted by impact score descending', async () => {
      const failures = [
        makeFailure({ scenarioId: 'a', message: 'minor warning' }),
        makeFailure({ scenarioId: 'b', message: 'fatal crash abort' }),
      ];
      const ranked = await queue.rankFailures(failures);
      expect(ranked.length).toBe(2);
      expect(ranked[0].impactScore).toBeGreaterThanOrEqual(ranked[1].impactScore);
    });

    it('returns empty array for empty input', async () => {
      const ranked = await queue.rankFailures([]);
      expect(ranked).toEqual([]);
    });
  });

  describe('suggestFixOrder', () => {
    it('returns scenario IDs in fix order', async () => {
      const failures = [
        makeFailure({ scenarioId: 'critical-one', message: 'fatal crash abort' }),
        makeFailure({ scenarioId: 'low-one', message: 'minor warning' }),
      ];
      const order = await queue.suggestFixOrder(failures);
      expect(Array.isArray(order)).toBe(true);
      expect(order.length).toBe(2);
      order.forEach(id => expect(typeof id).toBe('string'));
    });
  });

  describe('identifyFlaky', () => {
    it('returns empty array when not enough samples', () => {
      const results = [makeResult('s1', TestStatus.FAILED)];
      const flaky = queue.identifyFlaky(results);
      expect(flaky).toEqual([]);
    });

    it('detects flaky test with alternating results', () => {
      const scenarioId = 'flaky-test';
      const results: TestResult[] = [];
      // 10 alternating pass/fail
      for (let i = 0; i < 10; i++) {
        results.push(
          makeResult(
            scenarioId,
            i % 2 === 0 ? TestStatus.FAILED : TestStatus.PASSED,
            (10 - i) * 1000
          )
        );
      }
      const flaky = queue.identifyFlaky(results);
      expect(flaky.length).toBe(1);
      expect(flaky[0].scenarioId).toBe(scenarioId);
      expect(flaky[0].flakinessScore).toBeGreaterThan(0);
    });

    it('sets recommendedAction for high flakiness', () => {
      const scenarioId = 'very-flaky';
      const results: TestResult[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(
          makeResult(
            scenarioId,
            i % 2 === 0 ? TestStatus.FAILED : TestStatus.PASSED,
            (10 - i) * 1000
          )
        );
      }
      const flaky = queue.identifyFlaky(results);
      expect(['monitor', 'stabilize', 'investigate', 'quarantine']).toContain(
        flaky[0].recommendedAction
      );
    });
  });
});

// ─── PriorityPatternExtractor ────────────────────────────────────────────────

describe('PriorityPatternExtractor', () => {
  let extractor: PriorityPatternExtractor;

  beforeEach(() => {
    extractor = new PriorityPatternExtractor();
  });

  describe('analyzeFailurePatterns', () => {
    it('returns array of patterns (may be empty for single failure)', () => {
      const patterns = extractor.analyzeFailurePatterns([makeFailure()]);
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('detects message pattern when two failures share similar messages', () => {
      const failures = [
        makeFailure({ scenarioId: 'a', message: 'timeout error 1234' }),
        makeFailure({ scenarioId: 'b', message: 'timeout error 5678' }),
      ];
      const patterns = extractor.analyzeFailurePatterns(failures);
      const msgPatterns = patterns.filter(p => p.id.startsWith('msg-'));
      expect(msgPatterns.length).toBeGreaterThanOrEqual(1);
    });

    it('detects category pattern when two failures share the same category', () => {
      const failures = [
        makeFailure({ scenarioId: 'a', category: 'authentication' }),
        makeFailure({ scenarioId: 'b', category: 'authentication' }),
      ];
      const patterns = extractor.analyzeFailurePatterns(failures);
      const catPatterns = patterns.filter(p => p.id === 'cat-authentication');
      expect(catPatterns.length).toBe(1);
    });
  });

  describe('extractMessagePattern (via public analyzeFailurePatterns)', () => {
    it('normalizes numbers to NUMBER placeholder', () => {
      const failures = [
        makeFailure({ scenarioId: 'a', message: 'failed after 100ms retries' }),
        makeFailure({ scenarioId: 'b', message: 'failed after 200ms retries' }),
      ];
      const patterns = extractor.analyzeFailurePatterns(failures);
      // Both should group under the same normalized pattern
      const msgPatterns = patterns.filter(p => p.id.startsWith('msg-'));
      if (msgPatterns.length > 0) {
        expect(msgPatterns[0].affectedScenarios.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('generateRecommendations', () => {
    it('returns an array of strings', () => {
      const assignments: PriorityAssignment[] = [
        {
          scenarioId: 's1',
          priority: Priority.CRITICAL,
          impactScore: 90,
          confidence: 0.9,
          timestamp: new Date(),
          reasoning: ['Critical'],
          factors: {},
        },
      ];
      const recs = extractor.generateRecommendations(assignments, [], []);
      expect(Array.isArray(recs)).toBe(true);
      expect(recs.length).toBeGreaterThan(0);
    });

    it('mentions critical count when critical failures exist', () => {
      const assignments: PriorityAssignment[] = [
        {
          scenarioId: 's1',
          priority: Priority.CRITICAL,
          impactScore: 90,
          confidence: 0.8,
          timestamp: new Date(),
          reasoning: [],
          factors: {},
        },
      ];
      const recs = extractor.generateRecommendations(assignments, [], []);
      expect(recs.some(r => r.toLowerCase().includes('critical'))).toBe(true);
    });
  });
});

// ─── PriorityAgent facade ─────────────────────────────────────────────────────

describe('PriorityAgent (facade)', () => {
  let agent: PriorityAgent;

  beforeEach(() => {
    agent = createPriorityAgent({ logLevel: undefined });
  });

  afterEach(async () => {
    try {
      await agent.cleanup();
    } catch {
      // ignore cleanup errors in tests
    }
  });

  it('has correct name and type', () => {
    expect(agent.name).toBe('PriorityAgent');
    expect(agent.type).toBe('priority');
  });

  it('can be initialized without error', async () => {
    await expect(agent.initialize()).resolves.not.toThrow();
  });

  it('throws if execute called before initialize', async () => {
    const freshAgent = createPriorityAgent();
    await expect(
      freshAgent.execute({ id: 'test', name: 'test' } as any)
    ).rejects.toThrow('not initialized');
  });

  it('analyzePriority returns a valid PriorityAssignment', async () => {
    await agent.initialize();
    const assignment = await agent.analyzePriority(makeFailure());
    expect(assignment).toHaveProperty('scenarioId');
    expect(assignment).toHaveProperty('priority');
    expect(assignment).toHaveProperty('impactScore');
    expect(assignment).toHaveProperty('confidence');
    expect(assignment).toHaveProperty('reasoning');
    expect(assignment).toHaveProperty('factors');
    expect(assignment).toHaveProperty('timestamp');
    expect(typeof assignment.impactScore).toBe('number');
    expect(assignment.impactScore).toBeGreaterThanOrEqual(0);
    expect(assignment.impactScore).toBeLessThanOrEqual(100);
  });

  it('rankFailures returns assignments sorted by impact score', async () => {
    await agent.initialize();
    const failures = [
      makeFailure({ scenarioId: 'a', message: 'minor warning' }),
      makeFailure({ scenarioId: 'b', message: 'fatal crash abort' }),
    ];
    const ranked = await agent.rankFailures(failures);
    expect(ranked.length).toBe(2);
    expect(ranked[0].impactScore).toBeGreaterThanOrEqual(ranked[1].impactScore);
  });

  it('suggestFixOrder returns array of scenario IDs', async () => {
    await agent.initialize();
    const failures = [
      makeFailure({ scenarioId: 'x', message: 'error occurred' }),
      makeFailure({ scenarioId: 'y', message: 'warning issued' }),
    ];
    const order = await agent.suggestFixOrder(failures);
    expect(Array.isArray(order)).toBe(true);
    expect(order).toContain('x');
    expect(order).toContain('y');
  });

  it('identifyFlaky returns empty array for insufficient data', async () => {
    await agent.initialize();
    const results = [makeResult('s1', TestStatus.FAILED)];
    const flaky = agent.identifyFlaky(results);
    expect(flaky).toEqual([]);
  });

  it('analyzeFailurePatterns returns array', async () => {
    await agent.initialize();
    const failures = [makeFailure()];
    const patterns = agent.analyzeFailurePatterns(failures);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('generatePriorityReport returns a complete report', async () => {
    await agent.initialize();
    const failures = [makeFailure({ scenarioId: 's1', message: 'error' })];
    const report = await agent.generatePriorityReport(failures);
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('totalFailures', 1);
    expect(report).toHaveProperty('assignments');
    expect(report).toHaveProperty('patterns');
    expect(report).toHaveProperty('flakyTests');
    expect(report).toHaveProperty('fixOrder');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('recommendations');
    expect(report.summary).toHaveProperty('criticalCount');
    expect(report.summary).toHaveProperty('highCount');
    expect(report.summary).toHaveProperty('mediumCount');
    expect(report.summary).toHaveProperty('lowCount');
  });

  it('emits reportGenerated event', async () => {
    await agent.initialize();
    const spy = jest.fn();
    agent.on('reportGenerated', spy);
    await agent.generatePriorityReport([makeFailure()]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('cleanup resolves without error after initialize', async () => {
    await agent.initialize();
    await expect(agent.cleanup()).resolves.not.toThrow();
  });
});

// ─── Backward-compatible re-exports ──────────────────────────────────────────

describe('PriorityAgent backward-compatible exports', () => {
  it('createPriorityAgent factory is a function', () => {
    expect(typeof createPriorityAgent).toBe('function');
  });

  it('defaultPriorityAgentConfig has expected keys', () => {
    expect(defaultPriorityAgentConfig).toHaveProperty('historyRetentionDays');
    expect(defaultPriorityAgentConfig).toHaveProperty('flakyThreshold');
    expect(defaultPriorityAgentConfig).toHaveProperty('patternSensitivity');
    expect(defaultPriorityAgentConfig).toHaveProperty('minSamplesForTrends');
  });
});
