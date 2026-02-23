/**
 * PriorityAgent - Thin facade composing priority analysis sub-modules.
 *
 * Delegates all behaviour to:
 *   - PriorityAnalyzer  (scoring algorithms)
 *   - PriorityQueue     (ranking and ordering, with analysis history persistence)
 *   - PriorityPatternExtractor (pattern detection, recommendations, with cache persistence)
 *
 * Public API is identical to the original monolithic implementation so all
 * existing imports continue to work without modification.
 */

import { EventEmitter } from 'events';
import { IAgent, IPipelineAgent, AgentType } from './index';
import {
  OrchestratorScenario,
  TestFailure,
  TestResult,
  Priority,
  TestInterface,
} from '../models/TestModels';
import { createLogger, LogLevel } from '../utils/logger';

import {
  PriorityAnalyzer,
  PriorityQueue,
  PriorityPatternExtractor,
} from './priority';

import {
  PriorityAgentConfig,
  PriorityAssignment,
  FailurePattern,
  FlakyTestResult,
  PriorityReport,
  AnalysisContext,
  DEFAULT_CONFIG,
} from './priority/types';

// ─── Re-export every public type so existing "import … from './PriorityAgent'"
//     statements continue to compile without changes.
export type {
  PriorityFactors,
  PriorityAgentConfig,
  PriorityRule,
  AnalysisContext,
  PriorityAssignment,
  FailurePattern,
  FlakyTestResult,
  PriorityReport,
} from './priority/types';
export { DEFAULT_PRIORITY_FACTORS } from './priority/types';

/**
 * PriorityAgent - Pipeline agent for test failure priority analysis.
 *
 * Implements IPipelineAgent because it analyses test failures and assigns
 * priorities rather than executing test scenarios itself. The primary API is
 * analyzePriority(), rankFailures(), and generatePriorityReport().
 *
 * Also implements IAgent for backward compatibility.
 */
export class PriorityAgent extends EventEmitter implements IAgent, IPipelineAgent {
  public readonly name = 'PriorityAgent';
  public readonly type = AgentType.PRIORITY;
  /** @inheritdoc IPipelineAgent */
  public readonly isPipelineAgent = true as const;

  private readonly config: Required<PriorityAgentConfig>;
  private readonly analyzer: PriorityAnalyzer;
  private readonly queue: PriorityQueue;
  private readonly patternExtractor: PriorityPatternExtractor;
  private isInitialized = false;

  constructor(config: PriorityAgentConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    const logger = createLogger({ level: this.config.logLevel ?? LogLevel.INFO });
    logger.setContext({ component: 'PriorityAgent' });

    this.analyzer = new PriorityAnalyzer(this.config);
    this.queue = new PriorityQueue(this.analyzer, this.config);
    this.patternExtractor = new PriorityPatternExtractor(this.config.patternCachePath);
  }

  // ─── IAgent lifecycle ────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    this.analyzer.validateConfiguration();
    await this.queue.loadHistory();
    await this.patternExtractor.loadCache();
    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Execute priority analysis on a scenario (implements IAgent interface).
   *
   * Returns null when the scenario has no steps (nothing to analyze).
   * Otherwise constructs a real TestFailure from the scenario context and
   * delegates to analyzePriority().
   *
   * @deprecated Prefer calling analyzePriority() or generatePriorityReport()
   * directly. This method exists only for IAgent backward compatibility.
   * PriorityAgent is a pipeline agent — use isPipelineAgent() to detect it.
   */
  async execute(scenario: OrchestratorScenario): Promise<PriorityAssignment | null> {
    if (!this.isInitialized) {
      throw new Error('PriorityAgent not initialized. Call initialize() first.');
    }

    // Nothing to analyze when the scenario has no steps
    if (!scenario.steps || scenario.steps.length === 0) {
      return null;
    }

    // Build a real failure from the scenario's own metadata
    const failure: TestFailure = {
      scenarioId: scenario.id,
      timestamp: new Date(),
      message: scenario.description || scenario.name,
      category: this.inferCategory(scenario),
      isKnownIssue: false,
    };

    return this.analyzePriority(failure);
  }

  async cleanup(): Promise<void> {
    await this.queue.saveHistory();
    await this.patternExtractor.saveCache();
    this.emit('cleanup');
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  async analyzePriority(
    failure: TestFailure,
    context?: Partial<AnalysisContext>
  ): Promise<PriorityAssignment> {
    const fullContext = this.analyzer.buildAnalysisContext(failure, context);
    const impactScore = this.analyzer.calculateImpactScore(failure, fullContext);
    const priority = this.analyzer.determinePriorityLevel(impactScore);
    const reasoning = this.analyzer.generateReasoning(failure, fullContext, impactScore);
    const factors = this.analyzer.calculateFactorBreakdown(failure, fullContext);
    const confidence = this.analyzer.calculateConfidence(failure, fullContext);
    const estimatedFixEffort = this.analyzer.estimateFixEffort(failure, fullContext);

    const assignment: PriorityAssignment = {
      scenarioId: failure.scenarioId,
      priority,
      impactScore,
      confidence,
      timestamp: new Date(),
      reasoning,
      factors,
      estimatedFixEffort,
    };

    this.queue.recordAssignment(assignment);

    return assignment;
  }

  calculateImpactScore(failure: TestFailure, context: AnalysisContext): number {
    return this.analyzer.calculateImpactScore(failure, context);
  }

  rankFailures(failures: TestFailure[]): Promise<PriorityAssignment[]> {
    return this.queue.rankFailures(failures);
  }

  suggestFixOrder(failures: TestFailure[]): Promise<string[]> {
    return this.queue.suggestFixOrder(failures);
  }

  identifyFlaky(results: TestResult[]): FlakyTestResult[] {
    return this.queue.identifyFlaky(results);
  }

  analyzeFailurePatterns(failures: TestFailure[]): FailurePattern[] {
    return this.patternExtractor.analyzeFailurePatterns(failures);
  }

  async generatePriorityReport(
    failures: TestFailure[],
    results: TestResult[] = []
  ): Promise<PriorityReport> {
    const assignments = await this.queue.rankFailures(failures);
    const patterns = this.patternExtractor.analyzeFailurePatterns(failures);
    const flakyTests = this.queue.identifyFlaky(results);
    const fixOrder = await this.queue.suggestFixOrder(failures);

    const total = assignments.length || 1;
    const summary = {
      criticalCount: assignments.filter(a => a.priority === Priority.CRITICAL).length,
      highCount: assignments.filter(a => a.priority === Priority.HIGH).length,
      mediumCount: assignments.filter(a => a.priority === Priority.MEDIUM).length,
      lowCount: assignments.filter(a => a.priority === Priority.LOW).length,
      averageImpactScore:
        assignments.reduce((s, a) => s + a.impactScore, 0) / total,
      averageConfidence:
        assignments.reduce((s, a) => s + a.confidence, 0) / total,
    };

    const recommendations = this.patternExtractor.generateRecommendations(
      assignments,
      patterns,
      flakyTests
    );

    const report: PriorityReport = {
      timestamp: new Date(),
      totalFailures: failures.length,
      assignments,
      patterns,
      flakyTests,
      fixOrder,
      summary,
      recommendations,
    };

    this.emit('reportGenerated', report);
    return report;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Infer a failure category from a scenario's interface type and tags.
   */
  private inferCategory(scenario: OrchestratorScenario): string {
    const tags = scenario.tags || [];
    for (const tag of tags) {
      const lower = tag.toLowerCase();
      if (lower.includes('security') || lower.includes('auth')) return 'security';
      if (lower.includes('performance') || lower.includes('load')) return 'performance';
      if (lower.includes('regression')) return 'regression';
      if (lower.includes('smoke')) return 'smoke';
    }

    switch (scenario.interface) {
      case TestInterface.GUI:
        return 'ui';
      case TestInterface.CLI:
        return 'cli';
      case TestInterface.TUI:
        return 'tui';
      case TestInterface.API:
        return 'api';
      default:
        return 'execution';
    }
  }
}

// ─── Factory and default config ───────────────────────────────────────────────

export function createPriorityAgent(config?: PriorityAgentConfig): PriorityAgent {
  return new PriorityAgent(config);
}

export const defaultPriorityAgentConfig: PriorityAgentConfig = {
  priorityFactors: DEFAULT_CONFIG.priorityFactors,
  historyRetentionDays: DEFAULT_CONFIG.historyRetentionDays,
  flakyThreshold: DEFAULT_CONFIG.flakyThreshold,
  patternSensitivity: DEFAULT_CONFIG.patternSensitivity,
  minSamplesForTrends: DEFAULT_CONFIG.minSamplesForTrends,
  customRules: DEFAULT_CONFIG.customRules,
  logLevel: DEFAULT_CONFIG.logLevel,
  historyPath: DEFAULT_CONFIG.historyPath,
  patternCachePath: DEFAULT_CONFIG.patternCachePath,
};
