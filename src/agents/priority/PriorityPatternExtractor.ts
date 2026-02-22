/**
 * PriorityPatternExtractor - Failure pattern recognition and recommendations.
 *
 * Groups test failures by message similarity, timing, and category to surface
 * systemic issues.  Also generates actionable recommendations from a set of
 * priority assignments, patterns, and flaky-test results.
 *
 * The simplified pattern extraction at line ~50 ("replace numbers and IDs with
 * placeholders") intentionally mirrors the original PriorityAgent behaviour.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Priority } from '../../models/TestModels';
import type { TestFailure } from './types';
import {
  FailurePattern,
  FlakyTestResult,
  PriorityAssignment,
} from './types';

export class PriorityPatternExtractor {
  private readonly patternCachePath: string;
  private readonly patternCache: Map<string, FailurePattern> = new Map();

  constructor(patternCachePath = '') {
    this.patternCachePath = patternCachePath;
  }

  private resolvePatternCachePath(): string {
    return this.patternCachePath || path.join(process.cwd(), '.priority-patterns.json');
  }

  async loadCache(): Promise<void> {
    const cachePath = this.resolvePatternCachePath();
    try {
      const content = await fs.readFile(cachePath, 'utf-8');
      const raw = JSON.parse(content) as Array<FailurePattern & { firstSeen: string; lastSeen: string }>;
      for (const pattern of raw) {
        this.patternCache.set(pattern.id, {
          ...pattern,
          firstSeen: new Date(pattern.firstSeen),
          lastSeen: new Date(pattern.lastSeen),
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Non-ENOENT errors unexpected but non-fatal - start empty
      }
    }
  }

  async saveCache(): Promise<void> {
    const cachePath = this.resolvePatternCachePath();
    try {
      const data = Array.from(this.patternCache.values());
      await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (_error) {
      // best-effort persistence
    }
  }
  // ─── Pattern analysis ─────────────────────────────────────────────────────────

  /**
   * Analyses a set of failures and returns all detected patterns grouped by
   * message similarity, timing, and failure category.
   */
  analyzeFailurePatterns(failures: TestFailure[]): FailurePattern[] {
    const patterns: FailurePattern[] = [
      ...this.groupByMessagePatterns(failures),
      ...this.groupByStackTracePatterns(failures),
      ...this.groupByTimingPatterns(failures),
      ...this.groupByCategoryPatterns(failures),
    ];

    return patterns;
  }

  // ─── Recommendations ──────────────────────────────────────────────────────────

  /**
   * Generates a prioritised list of actionable recommendations based on the
   * supplied analysis results.
   */
  generateRecommendations(
    assignments: PriorityAssignment[],
    patterns: FailurePattern[],
    flakyTests: FlakyTestResult[]
  ): string[] {
    const recommendations: string[] = [];

    const criticalCount = assignments.filter(
      a => a.priority === Priority.CRITICAL
    ).length;
    if (criticalCount > 0) {
      recommendations.push(
        `Address ${criticalCount} critical priority failure${criticalCount > 1 ? 's' : ''} immediately`
      );
    }

    const highCount = assignments.filter(a => a.priority === Priority.HIGH).length;
    if (highCount > 3) {
      recommendations.push(
        `${highCount} high priority failures detected - consider increasing team focus on testing`
      );
    }

    if (patterns.length > 0) {
      const top = patterns.slice().sort((a, b) => b.frequency - a.frequency)[0];
      recommendations.push(
        `Most frequent pattern: "${top.description}" affects ${top.affectedScenarios.length} scenario${top.affectedScenarios.length !== 1 ? 's' : ''}`
      );
    }

    const quarantine = flakyTests.filter(t => t.recommendedAction === 'quarantine');
    if (quarantine.length > 0) {
      recommendations.push(
        `Consider quarantining ${quarantine.length} highly flaky test${quarantine.length > 1 ? 's' : ''} until stabilised`
      );
    }

    const stabilise = flakyTests.filter(t => t.recommendedAction === 'stabilize');
    if (stabilise.length > 0) {
      recommendations.push(
        `${stabilise.length} test${stabilise.length > 1 ? 's' : ''} need${stabilise.length === 1 ? 's' : ''} stabilisation work`
      );
    }

    return recommendations;
  }

  // ─── Grouping strategies ──────────────────────────────────────────────────────

  private groupByMessagePatterns(failures: TestFailure[]): FailurePattern[] {
    const groups = new Map<string, TestFailure[]>();

    failures.forEach(f => {
      const key = this.extractMessagePattern(f.message);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    });

    const patterns: FailurePattern[] = [];
    groups.forEach((grouped, key) => {
      if (grouped.length < 2) return;

      const timestamps = grouped.map(f => f.timestamp.getTime());
      patterns.push({
        id: `msg-${this.generatePatternId(key)}`,
        description: `Error message pattern: "${key}"`,
        affectedScenarios: Array.from(new Set(grouped.map(f => f.scenarioId))),
        frequency: grouped.length,
        firstSeen: new Date(Math.min(...timestamps)),
        lastSeen: new Date(Math.max(...timestamps)),
        confidence: Math.min(1.0, (grouped.length / failures.length) * 2),
        suggestedRootCause: this.suggestRootCauseFromMessage(key),
      });
    });

    return patterns;
  }

  private groupByStackTracePatterns(_failures: TestFailure[]): FailurePattern[] {
    // Stack-trace similarity analysis requires a dedicated parser; returning
    // an empty list here preserves the original behaviour.
    return [];
  }

  private groupByTimingPatterns(failures: TestFailure[]): FailurePattern[] {
    const hourGroups = new Map<number, TestFailure[]>();

    failures.forEach(f => {
      const hour = f.timestamp.getHours();
      if (!hourGroups.has(hour)) hourGroups.set(hour, []);
      hourGroups.get(hour)!.push(f);
    });

    const patterns: FailurePattern[] = [];
    hourGroups.forEach((grouped, hour) => {
      if (grouped.length < 3) return;

      const timestamps = grouped.map(f => f.timestamp.getTime());
      patterns.push({
        id: `time-${hour}`,
        description: `Failures clustered around ${hour}:00 hour`,
        affectedScenarios: Array.from(new Set(grouped.map(f => f.scenarioId))),
        frequency: grouped.length,
        firstSeen: new Date(Math.min(...timestamps)),
        lastSeen: new Date(Math.max(...timestamps)),
        confidence: 0.7,
        suggestedRootCause: 'Possible scheduled task or resource contention',
      });
    });

    return patterns;
  }

  private groupByCategoryPatterns(failures: TestFailure[]): FailurePattern[] {
    const categoryGroups = new Map<string, TestFailure[]>();

    failures.forEach(f => {
      const category = f.category ?? 'unknown';
      if (!categoryGroups.has(category)) categoryGroups.set(category, []);
      categoryGroups.get(category)!.push(f);
    });

    const patterns: FailurePattern[] = [];
    categoryGroups.forEach((grouped, category) => {
      if (grouped.length < 2) return;

      const timestamps = grouped.map(f => f.timestamp.getTime());
      patterns.push({
        id: `cat-${category}`,
        description: `Category pattern: ${category}`,
        affectedScenarios: Array.from(new Set(grouped.map(f => f.scenarioId))),
        frequency: grouped.length,
        firstSeen: new Date(Math.min(...timestamps)),
        lastSeen: new Date(Math.max(...timestamps)),
        confidence: 0.8,
        suggestedRootCause: `Common issue in ${category} category`,
      });
    });

    return patterns;
  }

  // ─── Pattern utilities ─────────────────────────────────────────────────────────

  /**
   * Simplified pattern extraction - replaces numbers and IDs with placeholders
   * so that structurally similar messages group together.
   */
  private extractMessagePattern(message: string): string {
    return message
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
      .replace(/\d+/g, 'NUMBER')
      .replace(/\/[^\s]+/g, 'PATH')
      .toLowerCase()
      .trim();
  }

  /**
   * Produces a short hex hash suitable for use as a pattern ID.
   */
  private generatePatternId(pattern: string): string {
    let hash = 0;
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private suggestRootCauseFromMessage(pattern: string): string {
    if (pattern.includes('timeout')) return 'Performance or network issues';
    if (pattern.includes('not found') || pattern.includes('missing')) {
      return 'Missing resources or dependencies';
    }
    if (pattern.includes('permission') || pattern.includes('access')) {
      return 'Permission or authentication issues';
    }
    if (pattern.includes('connection')) return 'Network connectivity issues';
    if (pattern.includes('memory') || pattern.includes('out of')) {
      return 'Resource exhaustion';
    }
    return 'Unknown root cause - requires investigation';
  }
}
