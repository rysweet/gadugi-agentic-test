/**
 * Shared types and constants for PriorityAgent sub-modules.
 *
 * All TypeScript interfaces, type aliases, and configuration constants that
 * were previously defined inline in PriorityAgent.ts live here so that each
 * focused sub-module can import them without circular dependencies.
 */

import { LogLevel } from '../../utils/logger';
import { OrchestratorScenario, TestFailure, TestResult, Priority } from '../../models/TestModels';

// ─── Re-export model types used across sub-modules ───────────────────────────

export type { TestFailure, TestResult, OrchestratorScenario };
// Re-export Priority so sub-modules can import it from this single location
export { Priority };

// ─── Priority scoring factors ────────────────────────────────────────────────

/**
 * Weighted factors used when calculating a test failure's impact score.
 * All values should be in the range [0, 1] and ideally sum to ~1.0.
 */
export interface PriorityFactors {
  /** Error severity weight (0-1) */
  errorSeverity: number;
  /** User impact weight (0-1) */
  userImpact: number;
  /** Test stability weight (0-1) */
  testStability: number;
  /** Business priority weight (0-1) */
  businessPriority: number;
  /** Security implications weight (0-1) */
  securityImplications: number;
  /** Performance impact weight (0-1) */
  performanceImpact: number;
  /** Regression detection weight (0-1) */
  regressionDetection: number;
}

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Analysis context provided to scoring functions.
 */
export interface AnalysisContext {
  /** Historical test results used for trend and stability calculations */
  history: TestResult[];
  /** Scenario metadata keyed by scenario ID */
  scenarios: Map<string, OrchestratorScenario>;
  /** Previous priority assignments keyed by scenario ID */
  previousPriorities: Map<string, PriorityAssignment>;
  /** Optional system metadata */
  systemInfo?: Record<string, unknown>;
}

/**
 * A single custom priority rule supplied by the user.
 */
export interface PriorityRule {
  /** Human-readable rule name */
  name: string;
  /** Returns true when this rule should modify the failure's priority */
  condition: (failure: TestFailure, context: AnalysisContext) => boolean;
  /** Score modifier in the range [-100, +100] */
  priorityModifier: number;
  /** What this rule does */
  description: string;
}

/**
 * Configuration options accepted by PriorityAgent and sub-modules.
 */
export interface PriorityAgentConfig {
  /** Override the default priority scoring weights */
  priorityFactors?: Partial<PriorityFactors>;
  /** Days of history to retain (default: 30) */
  historyRetentionDays?: number;
  /** Failure-rate threshold for flaky-test classification (0-1, default: 0.3) */
  flakyThreshold?: number;
  /** Pattern-recognition sensitivity (0-1, default: 0.7) */
  patternSensitivity?: number;
  /** Minimum run count before trend analysis is attempted (default: 5) */
  minSamplesForTrends?: number;
  /** User-defined priority rules applied after built-in scoring */
  customRules?: PriorityRule[];
  /** Logging level */
  logLevel?: LogLevel;
  /** File path for persisting analysis history (default: .priority-history.json in cwd) */
  historyPath?: string;
  /** File path for persisting pattern cache (default: .priority-patterns.json in cwd) */
  patternCachePath?: string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * The result of assigning a priority to a single test failure.
 */
export interface PriorityAssignment {
  /** ID of the analysed test scenario */
  scenarioId: string;
  /** Assigned priority level */
  priority: Priority;
  /** Calculated impact score in the range [0, 100] */
  impactScore: number;
  /** Confidence in the assignment in the range [0, 1] */
  confidence: number;
  /** When the assignment was computed */
  timestamp: Date;
  /** Human-readable explanations for the assignment */
  reasoning: string[];
  /** Per-factor score contributions */
  factors: Record<string, number>;
  /** Estimated hours required to fix the issue */
  estimatedFixEffort?: number;
}

/**
 * A recurring failure pattern identified across multiple test failures.
 */
export interface FailurePattern {
  /** Stable pattern identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Scenario IDs affected by this pattern */
  affectedScenarios: string[];
  /** Number of times this pattern was observed */
  frequency: number;
  /** Timestamp of the earliest matching failure */
  firstSeen: Date;
  /** Timestamp of the most recent matching failure */
  lastSeen: Date;
  /** Pattern confidence score (0-1) */
  confidence: number;
  /** Suggested root cause (may be undefined when unknown) */
  suggestedRootCause?: string;
}

/**
 * Flaky-test analysis result for a single scenario.
 */
export interface FlakyTestResult {
  /** Scenario ID */
  scenarioId: string;
  /** Composite flakiness score (0-1) */
  flakinessScore: number;
  /** Raw failure rate over the analysis window (0-1) */
  failureRate: number;
  /** Number of pass/fail state transitions */
  flipCount: number;
  /** The time window and run count used for analysis */
  analysisWindow: {
    startDate: Date;
    endDate: Date;
    totalRuns: number;
  };
  /** Recommended corrective action */
  recommendedAction: 'stabilize' | 'quarantine' | 'investigate' | 'monitor';
}

/**
 * Aggregated priority analysis report covering all analysed failures.
 */
export interface PriorityReport {
  /** When the report was generated */
  timestamp: Date;
  /** Number of failures analysed */
  totalFailures: number;
  /** Per-failure priority assignments (sorted highest → lowest) */
  assignments: PriorityAssignment[];
  /** Detected failure patterns */
  patterns: FailurePattern[];
  /** Detected flaky tests */
  flakyTests: FlakyTestResult[];
  /** Suggested fix order (scenario IDs) */
  fixOrder: string[];
  /** Aggregate statistics */
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    averageImpactScore: number;
    averageConfidence: number;
  };
  /** Actionable recommendations */
  recommendations: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default priority factor weights (sum to 1.0).
 */
export const DEFAULT_PRIORITY_FACTORS: PriorityFactors = {
  errorSeverity: 0.25,
  userImpact: 0.20,
  testStability: 0.15,
  businessPriority: 0.15,
  securityImplications: 0.10,
  performanceImpact: 0.10,
  regressionDetection: 0.05,
};

/**
 * Default configuration applied when no overrides are provided.
 */
export const DEFAULT_CONFIG: Required<PriorityAgentConfig> = {
  priorityFactors: DEFAULT_PRIORITY_FACTORS,
  historyRetentionDays: 30,
  flakyThreshold: 0.3,
  patternSensitivity: 0.7,
  minSamplesForTrends: 5,
  customRules: [],
  logLevel: LogLevel.INFO,
  historyPath: '',
  patternCachePath: '',
};
