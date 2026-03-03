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
import { OrchestratorScenario, TestFailure, TestResult } from '../models/TestModels';
import { PriorityAgentConfig, PriorityAssignment, FailurePattern, FlakyTestResult, PriorityReport, AnalysisContext } from './priority/types';
export type { PriorityFactors, PriorityAgentConfig, PriorityRule, AnalysisContext, PriorityAssignment, FailurePattern, FlakyTestResult, PriorityReport, } from './priority/types';
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
export declare class PriorityAgent extends EventEmitter implements IAgent, IPipelineAgent {
    readonly name = "PriorityAgent";
    readonly type = AgentType.PRIORITY;
    /** @inheritdoc IPipelineAgent */
    readonly isPipelineAgent: true;
    private readonly config;
    private readonly analyzer;
    private readonly queue;
    private readonly patternExtractor;
    private isInitialized;
    constructor(config?: PriorityAgentConfig);
    initialize(): Promise<void>;
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
    execute(scenario: OrchestratorScenario): Promise<PriorityAssignment | null>;
    cleanup(): Promise<void>;
    analyzePriority(failure: TestFailure, context?: Partial<AnalysisContext>): Promise<PriorityAssignment>;
    calculateImpactScore(failure: TestFailure, context: AnalysisContext): number;
    rankFailures(failures: TestFailure[]): Promise<PriorityAssignment[]>;
    suggestFixOrder(failures: TestFailure[]): Promise<string[]>;
    identifyFlaky(results: TestResult[]): FlakyTestResult[];
    analyzeFailurePatterns(failures: TestFailure[]): FailurePattern[];
    generatePriorityReport(failures: TestFailure[], results?: TestResult[]): Promise<PriorityReport>;
    /**
     * Infer a failure category from a scenario's interface type and tags.
     */
    private inferCategory;
}
export declare function createPriorityAgent(config?: PriorityAgentConfig): PriorityAgent;
export declare const defaultPriorityAgentConfig: PriorityAgentConfig;
//# sourceMappingURL=PriorityAgent.d.ts.map