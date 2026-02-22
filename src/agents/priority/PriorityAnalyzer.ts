/**
 * PriorityAnalyzer - Priority scoring and analysis algorithms.
 *
 * Encapsulates all scoring functions, priority-level thresholds, confidence
 * calculation, fix-effort estimation, and configuration validation.
 */

import { Priority, TestInterface, TestStatus } from '../../models/TestModels';
import { AnalysisContext, PriorityAssignment, PriorityAgentConfig, DEFAULT_CONFIG } from './types';
import type { TestFailure } from './types';

export class PriorityAnalyzer {
  private readonly config: Required<PriorityAgentConfig>;

  constructor(config: Required<PriorityAgentConfig> = DEFAULT_CONFIG) {
    this.config = config;
  }

  /** Throws if flakyThreshold is outside [0, 1]. */
  validateConfiguration(): void {
    if (this.config.flakyThreshold < 0 || this.config.flakyThreshold > 1) {
      throw new Error('Flaky threshold must be between 0 and 1');
    }
  }

  /** Merges partial context with safe defaults. */
  buildAnalysisContext(_failure: TestFailure, partialContext?: Partial<AnalysisContext>): AnalysisContext {
    return {
      history: partialContext?.history ?? [],
      scenarios: partialContext?.scenarios ?? new Map(),
      previousPriorities: partialContext?.previousPriorities ?? new Map(),
      systemInfo: partialContext?.systemInfo ?? {},
    };
  }

  /** Computes weighted impact score in [0, 100]. */
  calculateImpactScore(failure: TestFailure, context: AnalysisContext): number {
    const f = this.config.priorityFactors;
    let score = 0;
    score += this.scoreSeverity(failure)                    * (f.errorSeverity ?? 0);
    score += this.scoreUserImpact(failure, context)         * (f.userImpact ?? 0);
    score += this.scoreStability(failure, context)          * (f.testStability ?? 0);
    score += this.scoreBusinessPriority(failure, context)   * (f.businessPriority ?? 0);
    score += this.scoreSecurityImplications(failure, context) * (f.securityImplications ?? 0);
    score += this.scorePerformanceImpact(failure, context)  * (f.performanceImpact ?? 0);
    score += this.scoreRegressionDetection(failure, context) * (f.regressionDetection ?? 0);
    score += this.applyCustomRules(failure, context);
    return Math.max(0, Math.min(100, score * 100));
  }

  /** CRITICAL >= 80 | HIGH >= 60 | MEDIUM >= 40 | LOW < 40 */
  determinePriorityLevel(impactScore: number): Priority {
    if (impactScore >= 80) return Priority.CRITICAL;
    if (impactScore >= 60) return Priority.HIGH;
    if (impactScore >= 40) return Priority.MEDIUM;
    return Priority.LOW;
  }

  generateReasoning(failure: TestFailure, context: AnalysisContext, impactScore: number): string[] {
    const reasoning: string[] = [`Impact score: ${impactScore.toFixed(1)}/100`];
    if (impactScore >= 80)      reasoning.push('Critical priority due to high impact score');
    else if (impactScore >= 60) reasoning.push('High priority due to significant impact');
    else if (impactScore >= 40) reasoning.push('Medium priority with moderate impact');
    else                        reasoning.push('Low priority with minimal impact');
    const scenario = context.scenarios.get(failure.scenarioId);
    if (scenario) {
      reasoning.push(`Test interface: ${scenario.interface}`);
      reasoning.push(`Scenario priority: ${scenario.priority}`);
    }
    return reasoning;
  }

  calculateFactorBreakdown(failure: TestFailure, context: AnalysisContext): Record<string, number> {
    return {
      severity:             this.scoreSeverity(failure),
      userImpact:           this.scoreUserImpact(failure, context),
      stability:            this.scoreStability(failure, context),
      businessPriority:     this.scoreBusinessPriority(failure, context),
      securityImplications: this.scoreSecurityImplications(failure, context),
      performanceImpact:    this.scorePerformanceImpact(failure, context),
      regressionDetection:  this.scoreRegressionDetection(failure, context),
    };
  }

  calculateConfidence(failure: TestFailure, context: AnalysisContext): number {
    let confidence = 0.5;
    const history = context.history.filter(r => r.scenarioId === failure.scenarioId);
    confidence += Math.min(1.0, history.length / 10) * 0.3;
    if (context.scenarios.has(failure.scenarioId)) confidence += 0.2;
    return Math.min(1.0, confidence);
  }

  estimateFixEffort(failure: TestFailure, context: AnalysisContext): number {
    const scenario = context.scenarios.get(failure.scenarioId);
    let effort = 2;
    if (scenario?.interface === TestInterface.GUI)   effort *= 1.5;
    else if (scenario?.interface === TestInterface.MIXED) effort *= 1.3;
    effort *= (1 + this.scoreSeverity(failure));
    effort *= (1 + this.scoreStability(failure, context));
    return Math.round(effort * 10) / 10;
  }

  /** Appends an assignment to the supplied history map. */
  storeAssignment(map: Map<string, PriorityAssignment[]>, assignment: PriorityAssignment): void {
    if (!map.has(assignment.scenarioId)) map.set(assignment.scenarioId, []);
    map.get(assignment.scenarioId)!.push(assignment);
  }

  private scoreSeverity(failure: TestFailure): number {
    const message = failure.message.toLowerCase();
    const stackTrace = failure.stackTrace?.toLowerCase() ?? '';

    if (
      message.includes('crash') ||
      message.includes('segfault') ||
      message.includes('fatal') ||
      message.includes('abort')
    ) {
      return 1.0;
    }

    if (
      message.includes('error') ||
      message.includes('exception') ||
      message.includes('failed') ||
      stackTrace.includes('error')
    ) {
      return 0.8;
    }

    if (
      message.includes('warning') ||
      message.includes('timeout') ||
      message.includes('assertion')
    ) {
      return 0.6;
    }

    return 0.4;
  }

  private scoreUserImpact(failure: TestFailure, context: AnalysisContext): number {
    const scenario = context.scenarios.get(failure.scenarioId);
    if (!scenario) return 0.5;

    if (scenario.interface === TestInterface.GUI) return 0.9;
    if (scenario.interface === TestInterface.MIXED) return 0.7;
    if (scenario.interface === TestInterface.CLI) return 0.6;
    return 0.4;
  }

  private scoreStability(failure: TestFailure, context: AnalysisContext): number {
    const history = context.history.filter(r => r.scenarioId === failure.scenarioId);
    if (history.length === 0) return 0.5;

    const recentFailures = history
      .filter(r => r.status === TestStatus.FAILED)
      .filter(r => {
        const daysSince = (Date.now() - r.startTime.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 7;
      });

    const failureRate = recentFailures.length / Math.min(history.length, 10);
    return Math.min(1.0, failureRate * 2);
  }

  private scoreBusinessPriority(failure: TestFailure, context: AnalysisContext): number {
    const scenario = context.scenarios.get(failure.scenarioId);
    if (!scenario) return 0.5;

    switch (scenario.priority) {
      case Priority.CRITICAL: return 1.0;
      case Priority.HIGH:     return 0.8;
      case Priority.MEDIUM:   return 0.6;
      case Priority.LOW:      return 0.4;
      default:                return 0.5;
    }
  }

  private scoreSecurityImplications(failure: TestFailure, context: AnalysisContext): number {
    const message = failure.message.toLowerCase();
    const scenario = context.scenarios.get(failure.scenarioId);
    const tags = scenario?.tags ?? [];

    const securityKeywords = [
      'security', 'auth', 'login', 'credential', 'token', 'permission',
      'access', 'admin', 'privilege', 'encrypt', 'decrypt', 'certificate',
    ];

    const matches = securityKeywords.some(
      kw => message.includes(kw) || tags.some(tag => tag.toLowerCase().includes(kw))
    );

    return matches ? 1.0 : 0.2;
  }

  private scorePerformanceImpact(failure: TestFailure, context: AnalysisContext): number {
    const message = failure.message.toLowerCase();

    if (
      message.includes('timeout') ||
      message.includes('slow') ||
      message.includes('performance') ||
      message.includes('memory') ||
      message.includes('cpu')
    ) {
      return 0.9;
    }

    const scenario = context.scenarios.get(failure.scenarioId);
    const tags = scenario?.tags ?? [];
    const hasPerformanceTags = tags.some(
      tag =>
        tag.toLowerCase().includes('performance') ||
        tag.toLowerCase().includes('load') ||
        tag.toLowerCase().includes('stress')
    );

    return hasPerformanceTags ? 0.8 : 0.3;
  }

  private scoreRegressionDetection(failure: TestFailure, context: AnalysisContext): number {
    const history = context.history.filter(r => r.scenarioId === failure.scenarioId);
    if (history.length === 0) return 0.5;

    const recentPassing = history
      .filter(r => r.status === TestStatus.PASSED)
      .filter(r => {
        const daysSince = (Date.now() - r.startTime.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 30;
      });

    return recentPassing.length > 0 ? 0.9 : 0.4;
  }

  private applyCustomRules(failure: TestFailure, context: AnalysisContext): number {
    let modifierSum = 0;

    this.config.customRules.forEach(rule => {
      if (rule.condition(failure, context)) {
        modifierSum += rule.priorityModifier;
      }
    });

    return modifierSum / 100;
  }
}
