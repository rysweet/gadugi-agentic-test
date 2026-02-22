/**
 * PriorityQueue - Ranking and ordering of test failures.
 *
 * Provides rankFailures(), suggestFixOrder(), and identifyFlaky() by
 * delegating individual analysis to PriorityAnalyzer.  It owns the
 * priority-grouped fix-order logic and flaky-test detection.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Priority, TestStatus } from '../../models/TestModels';
import type { TestFailure, TestResult } from './types';
import {
  PriorityAssignment,
  FlakyTestResult,
  PriorityAgentConfig,
  DEFAULT_CONFIG,
} from './types';
import { PriorityAnalyzer } from './PriorityAnalyzer';

export class PriorityQueue {
  private readonly analyzer: PriorityAnalyzer;
  private readonly config: Required<PriorityAgentConfig>;
  private readonly analysisHistory: Map<string, PriorityAssignment[]> = new Map();

  constructor(
    analyzer: PriorityAnalyzer,
    config: Required<PriorityAgentConfig> = DEFAULT_CONFIG
  ) {
    this.analyzer = analyzer;
    this.config = config;
  }

  // ─── Public history recording ─────────────────────────────────────────────────

  /**
   * Record an assignment into the analysis history (used when analysis is
   * performed outside of rankFailures, e.g. by PriorityAgent.analyzePriority).
   */
  recordAssignment(assignment: PriorityAssignment): void {
    this.analyzer.storeAssignment(this.analysisHistory, assignment);
  }

  // ─── Ranking ──────────────────────────────────────────────────────────────────

  /**
   * Analyses every failure independently and returns assignments sorted by
   * impact score (highest first); ties are broken by confidence (highest first).
   */
  async rankFailures(failures: TestFailure[]): Promise<PriorityAssignment[]> {
    const assignments = await Promise.all(
      failures.map(f => this.analyzeFailure(f))
    );

    return assignments.sort((a, b) => {
      if (a.impactScore !== b.impactScore) {
        return b.impactScore - a.impactScore;
      }
      return b.confidence - a.confidence;
    });
  }

  // ─── Fix order ────────────────────────────────────────────────────────────────

  /**
   * Returns scenario IDs in the recommended fix order:
   * grouped by priority (CRITICAL → HIGH → MEDIUM → LOW), then sorted within
   * each group by ascending estimated fix effort (quick wins first).
   */
  async suggestFixOrder(failures: TestFailure[]): Promise<string[]> {
    const ranked = await this.rankFailures(failures);

    const groups: Record<Priority, PriorityAssignment[]> = {
      [Priority.CRITICAL]: [],
      [Priority.HIGH]: [],
      [Priority.MEDIUM]: [],
      [Priority.LOW]: [],
    };

    ranked.forEach(a => groups[a.priority].push(a));

    Object.values(groups).forEach(group => {
      group.sort(
        (a, b) => (a.estimatedFixEffort ?? 0) - (b.estimatedFixEffort ?? 0)
      );
    });

    return [
      ...groups[Priority.CRITICAL],
      ...groups[Priority.HIGH],
      ...groups[Priority.MEDIUM],
      ...groups[Priority.LOW],
    ].map(a => a.scenarioId);
  }

  // ─── Flaky test detection ─────────────────────────────────────────────────────

  /**
   * Identifies flaky scenarios from a set of historical test results.
   * A scenario is considered flaky when its flakiness score meets or exceeds
   * the configured threshold.
   */
  identifyFlaky(results: TestResult[]): FlakyTestResult[] {
    const groups = new Map<string, TestResult[]>();

    results.forEach(r => {
      if (!groups.has(r.scenarioId)) {
        groups.set(r.scenarioId, []);
      }
      groups.get(r.scenarioId)!.push(r);
    });

    const flakyTests: FlakyTestResult[] = [];

    groups.forEach((scenarioResults, scenarioId) => {
      if (scenarioResults.length < this.config.minSamplesForTrends) {
        return;
      }

      const result = this.analyzeFlakyBehavior(scenarioId, scenarioResults);
      if (result.flakinessScore >= this.config.flakyThreshold) {
        flakyTests.push(result);
      }
    });

    return flakyTests;
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────────

  private async analyzeFailure(failure: TestFailure): Promise<PriorityAssignment> {
    const context = this.analyzer.buildAnalysisContext(failure);
    const impactScore = this.analyzer.calculateImpactScore(failure, context);
    const priority = this.analyzer.determinePriorityLevel(impactScore);
    const reasoning = this.analyzer.generateReasoning(failure, context, impactScore);
    const factors = this.analyzer.calculateFactorBreakdown(failure, context);
    const confidence = this.analyzer.calculateConfidence(failure, context);
    const estimatedFixEffort = this.analyzer.estimateFixEffort(failure, context);

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

    this.analyzer.storeAssignment(this.analysisHistory, assignment);

    return assignment;
  }

  private analyzeFlakyBehavior(
    scenarioId: string,
    results: TestResult[]
  ): FlakyTestResult {
    const sorted = results.slice().sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    let flipCount = 0;
    let failureCount = 0;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const failed =
        current.status === TestStatus.FAILED ||
        current.status === TestStatus.ERROR;

      if (failed) failureCount++;

      if (i > 0) {
        const prevFailed =
          sorted[i - 1].status === TestStatus.FAILED ||
          sorted[i - 1].status === TestStatus.ERROR;
        if (failed !== prevFailed) flipCount++;
      }
    }

    const failureRate = failureCount / sorted.length;
    const flipRate = flipCount / Math.max(1, sorted.length - 1);
    const flakinessScore = failureRate * 0.6 + flipRate * 0.4;

    let recommendedAction: FlakyTestResult['recommendedAction'] = 'monitor';
    if (flakinessScore >= 0.7) {
      recommendedAction = 'quarantine';
    } else if (flakinessScore >= 0.5) {
      recommendedAction = 'investigate';
    } else if (flakinessScore >= 0.3) {
      recommendedAction = 'stabilize';
    }

    return {
      scenarioId,
      flakinessScore,
      failureRate,
      flipCount,
      analysisWindow: {
        startDate: sorted[0].startTime,
        endDate: sorted[sorted.length - 1].endTime,
        totalRuns: sorted.length,
      },
      recommendedAction,
    };
  }

  // ─── Persistence ──────────────────────────────────────────────────────────────

  private resolveHistoryPath(): string {
    return this.config.historyPath || path.join(process.cwd(), '.priority-history.json');
  }

  async loadHistory(): Promise<void> {
    const historyPath = this.resolveHistoryPath();
    try {
      const content = await fs.readFile(historyPath, 'utf-8');
      const raw = JSON.parse(content) as Record<string, Array<PriorityAssignment & { timestamp: string }>>;
      for (const [scenarioId, assignments] of Object.entries(raw)) {
        this.analysisHistory.set(
          scenarioId,
          assignments.map(a => ({ ...a, timestamp: new Date(a.timestamp) }))
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Non-ENOENT errors are unexpected but non-fatal - start with empty history
      }
    }
  }

  async saveHistory(): Promise<void> {
    const historyPath = this.resolveHistoryPath();
    try {
      const data: Record<string, PriorityAssignment[]> = {};
      for (const [scenarioId, assignments] of this.analysisHistory.entries()) {
        data[scenarioId] = assignments;
      }
      await fs.writeFile(historyPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (_error) {
      // best-effort persistence
    }
  }
}
