/**
 * PriorityAgent - Test priority analysis and ranking agent
 *
 * This agent analyzes test failures to determine priority levels, calculates impact scores,
 * ranks failures by importance, and provides actionable recommendations for fixing order.
 * It includes pattern recognition, trend analysis, and machine learning-ready scoring.
 */
import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { TestFailure, TestResult, Priority, OrchestratorScenario } from '../models/TestModels';
import { LogLevel } from '../utils/logger';
/**
 * Priority scoring factors
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
/**
 * Priority analysis configuration
 */
export interface PriorityAgentConfig {
    /** Custom priority scoring factors */
    priorityFactors?: Partial<PriorityFactors>;
    /** Historical data retention period in days */
    historyRetentionDays?: number;
    /** Flaky test detection threshold (failure rate 0-1) */
    flakyThreshold?: number;
    /** Pattern recognition sensitivity */
    patternSensitivity?: number;
    /** Minimum samples required for trend analysis */
    minSamplesForTrends?: number;
    /** Custom priority rules */
    customRules?: PriorityRule[];
    /** Logging configuration */
    logLevel?: LogLevel;
}
/**
 * Custom priority rule interface
 */
export interface PriorityRule {
    /** Rule name */
    name: string;
    /** Rule condition function */
    condition: (failure: TestFailure, context: AnalysisContext) => boolean;
    /** Priority modifier (-100 to +100) */
    priorityModifier: number;
    /** Rule description */
    description: string;
}
/**
 * Analysis context for priority calculations
 */
export interface AnalysisContext {
    /** Historical test results */
    history: TestResult[];
    /** Test scenario information */
    scenarios: Map<string, OrchestratorScenario>;
    /** Previous priority assignments */
    previousPriorities: Map<string, PriorityAssignment>;
    /** System metadata */
    systemInfo?: Record<string, any>;
}
/**
 * Priority assignment result
 */
export interface PriorityAssignment {
    /** Test scenario ID */
    scenarioId: string;
    /** Assigned priority level */
    priority: Priority;
    /** Calculated impact score (0-100) */
    impactScore: number;
    /** Confidence level (0-1) */
    confidence: number;
    /** Assignment timestamp */
    timestamp: Date;
    /** Reasoning for the assignment */
    reasoning: string[];
    /** Contributing factors breakdown */
    factors: Record<string, number>;
    /** Recommended fix effort (hours) */
    estimatedFixEffort?: number;
}
/**
 * Failure pattern information
 */
export interface FailurePattern {
    /** Pattern ID */
    id: string;
    /** Pattern description */
    description: string;
    /** Affected scenarios */
    affectedScenarios: string[];
    /** Pattern frequency */
    frequency: number;
    /** First occurrence */
    firstSeen: Date;
    /** Last occurrence */
    lastSeen: Date;
    /** Pattern confidence (0-1) */
    confidence: number;
    /** Suggested root cause */
    suggestedRootCause?: string;
}
/**
 * Flaky test detection result
 */
export interface FlakyTestResult {
    /** Test scenario ID */
    scenarioId: string;
    /** Flakiness score (0-1) */
    flakinessScore: number;
    /** Failure rate over time */
    failureRate: number;
    /** Number of flips (pass->fail or fail->pass) */
    flipCount: number;
    /** Analysis window */
    analysisWindow: {
        startDate: Date;
        endDate: Date;
        totalRuns: number;
    };
    /** Recommended action */
    recommendedAction: 'stabilize' | 'quarantine' | 'investigate' | 'monitor';
}
/**
 * Priority analysis report
 */
export interface PriorityReport {
    /** Report generation timestamp */
    timestamp: Date;
    /** Total failures analyzed */
    totalFailures: number;
    /** Priority assignments */
    assignments: PriorityAssignment[];
    /** Identified patterns */
    patterns: FailurePattern[];
    /** Flaky tests */
    flakyTests: FlakyTestResult[];
    /** Recommended fix order */
    fixOrder: string[];
    /** Summary statistics */
    summary: {
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
        averageImpactScore: number;
        averageConfidence: number;
    };
    /** Recommendations */
    recommendations: string[];
}
/**
 * PriorityAgent implementation
 */
export declare class PriorityAgent extends EventEmitter implements IAgent {
    readonly name = "PriorityAgent";
    readonly type = AgentType.SYSTEM;
    private config;
    private logger;
    private analysisHistory;
    private patternCache;
    private isInitialized;
    constructor(config?: PriorityAgentConfig);
    /**
     * Initialize the priority agent
     */
    initialize(): Promise<void>;
    /**
     * Execute priority analysis on a scenario (implements IAgent interface)
     */
    execute(scenario: OrchestratorScenario): Promise<PriorityAssignment | null>;
    /**
     * Analyze and assign priority to a test failure
     */
    analyzePriority(failure: TestFailure, context?: Partial<AnalysisContext>): Promise<PriorityAssignment>;
    /**
     * Calculate impact score for a test failure
     */
    calculateImpactScore(failure: TestFailure, context: AnalysisContext): number;
    /**
     * Rank multiple failures by priority
     */
    rankFailures(failures: TestFailure[]): Promise<PriorityAssignment[]>;
    /**
     * Suggest order for fixing failures
     */
    suggestFixOrder(failures: TestFailure[]): Promise<string[]>;
    /**
     * Identify flaky tests from historical results
     */
    identifyFlaky(results: TestResult[]): FlakyTestResult[];
    /**
     * Analyze failure patterns across multiple failures
     */
    analyzeFailurePatterns(failures: TestFailure[]): FailurePattern[];
    /**
     * Generate comprehensive priority report
     */
    generatePriorityReport(failures: TestFailure[], results?: TestResult[]): Promise<PriorityReport>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    private validateConfiguration;
    private buildAnalysisContext;
    private scoreSeverity;
    private scoreUserImpact;
    private scoreStability;
    private scoreBusinessPriority;
    private scoreSecurityImplications;
    private scorePerformanceImpact;
    private scoreRegressionDetection;
    private applyCustomRules;
    private determinePriorityLevel;
    private generateReasoning;
    private calculateFactorBreakdown;
    private calculateConfidence;
    private estimateFixEffort;
    private analyzeFlakyBehavior;
    private groupByMessagePatterns;
    private groupByStackTracePatterns;
    private groupByTimingPatterns;
    private groupByCategoryPatterns;
    private extractMessagePattern;
    private generatePatternId;
    private suggestRootCauseFromMessage;
    private generateRecommendations;
    private storeAssignment;
    private loadAnalysisHistory;
    private saveAnalysisHistory;
    private loadPatternCache;
    private savePatternCache;
}
/**
 * Create a new PriorityAgent instance with the specified configuration
 */
export declare function createPriorityAgent(config?: PriorityAgentConfig): PriorityAgent;
/**
 * Default configuration for PriorityAgent
 */
export declare const defaultPriorityAgentConfig: PriorityAgentConfig;
//# sourceMappingURL=PriorityAgent.d.ts.map