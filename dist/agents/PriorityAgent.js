"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultPriorityAgentConfig = exports.PriorityAgent = exports.DEFAULT_PRIORITY_FACTORS = void 0;
exports.createPriorityAgent = createPriorityAgent;
const events_1 = require("events");
const index_1 = require("./index");
const TestModels_1 = require("../models/TestModels");
const logger_1 = require("../utils/logger");
const priority_1 = require("./priority");
const types_1 = require("./priority/types");
var types_2 = require("./priority/types");
Object.defineProperty(exports, "DEFAULT_PRIORITY_FACTORS", { enumerable: true, get: function () { return types_2.DEFAULT_PRIORITY_FACTORS; } });
/**
 * PriorityAgent - Pipeline agent for test failure priority analysis.
 *
 * Implements IPipelineAgent because it analyses test failures and assigns
 * priorities rather than executing test scenarios itself. The primary API is
 * analyzePriority(), rankFailures(), and generatePriorityReport().
 *
 * Also implements IAgent for backward compatibility.
 */
class PriorityAgent extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.name = 'PriorityAgent';
        this.type = index_1.AgentType.PRIORITY;
        /** @inheritdoc IPipelineAgent */
        this.isPipelineAgent = true;
        this.isInitialized = false;
        this.config = { ...types_1.DEFAULT_CONFIG, ...config };
        const logger = (0, logger_1.createLogger)({ level: this.config.logLevel ?? logger_1.LogLevel.INFO });
        logger.setContext({ component: 'PriorityAgent' });
        this.analyzer = new priority_1.PriorityAnalyzer(this.config);
        this.queue = new priority_1.PriorityQueue(this.analyzer, this.config);
        this.patternExtractor = new priority_1.PriorityPatternExtractor(this.config.patternCachePath);
    }
    // ─── IAgent lifecycle ────────────────────────────────────────────────────────
    async initialize() {
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
    async execute(scenario) {
        if (!this.isInitialized) {
            throw new Error('PriorityAgent not initialized. Call initialize() first.');
        }
        // Nothing to analyze when the scenario has no steps
        if (!scenario.steps || scenario.steps.length === 0) {
            return null;
        }
        // Build a real failure from the scenario's own metadata
        const failure = {
            scenarioId: scenario.id,
            timestamp: new Date(),
            message: scenario.description || scenario.name,
            category: this.inferCategory(scenario),
            isKnownIssue: false,
        };
        return this.analyzePriority(failure);
    }
    async cleanup() {
        await this.queue.saveHistory();
        await this.patternExtractor.saveCache();
        this.emit('cleanup');
    }
    // ─── Public API ───────────────────────────────────────────────────────────────
    async analyzePriority(failure, context) {
        const fullContext = this.analyzer.buildAnalysisContext(failure, context);
        const impactScore = this.analyzer.calculateImpactScore(failure, fullContext);
        const priority = this.analyzer.determinePriorityLevel(impactScore);
        const reasoning = this.analyzer.generateReasoning(failure, fullContext, impactScore);
        const factors = this.analyzer.calculateFactorBreakdown(failure, fullContext);
        const confidence = this.analyzer.calculateConfidence(failure, fullContext);
        const estimatedFixEffort = this.analyzer.estimateFixEffort(failure, fullContext);
        const assignment = {
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
    calculateImpactScore(failure, context) {
        return this.analyzer.calculateImpactScore(failure, context);
    }
    rankFailures(failures) {
        return this.queue.rankFailures(failures);
    }
    suggestFixOrder(failures) {
        return this.queue.suggestFixOrder(failures);
    }
    identifyFlaky(results) {
        return this.queue.identifyFlaky(results);
    }
    analyzeFailurePatterns(failures) {
        return this.patternExtractor.analyzeFailurePatterns(failures);
    }
    async generatePriorityReport(failures, results = []) {
        const assignments = await this.queue.rankFailures(failures);
        const patterns = this.patternExtractor.analyzeFailurePatterns(failures);
        const flakyTests = this.queue.identifyFlaky(results);
        const fixOrder = await this.queue.suggestFixOrder(failures);
        const total = assignments.length || 1;
        const summary = {
            criticalCount: assignments.filter(a => a.priority === TestModels_1.Priority.CRITICAL).length,
            highCount: assignments.filter(a => a.priority === TestModels_1.Priority.HIGH).length,
            mediumCount: assignments.filter(a => a.priority === TestModels_1.Priority.MEDIUM).length,
            lowCount: assignments.filter(a => a.priority === TestModels_1.Priority.LOW).length,
            averageImpactScore: assignments.reduce((s, a) => s + a.impactScore, 0) / total,
            averageConfidence: assignments.reduce((s, a) => s + a.confidence, 0) / total,
        };
        const recommendations = this.patternExtractor.generateRecommendations(assignments, patterns, flakyTests);
        const report = {
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
    inferCategory(scenario) {
        const tags = scenario.tags || [];
        for (const tag of tags) {
            const lower = tag.toLowerCase();
            if (lower.includes('security') || lower.includes('auth'))
                return 'security';
            if (lower.includes('performance') || lower.includes('load'))
                return 'performance';
            if (lower.includes('regression'))
                return 'regression';
            if (lower.includes('smoke'))
                return 'smoke';
        }
        switch (scenario.interface) {
            case TestModels_1.TestInterface.GUI:
                return 'ui';
            case TestModels_1.TestInterface.CLI:
                return 'cli';
            case TestModels_1.TestInterface.TUI:
                return 'tui';
            case TestModels_1.TestInterface.API:
                return 'api';
            default:
                return 'execution';
        }
    }
}
exports.PriorityAgent = PriorityAgent;
// ─── Factory and default config ───────────────────────────────────────────────
function createPriorityAgent(config) {
    return new PriorityAgent(config);
}
exports.defaultPriorityAgentConfig = {
    priorityFactors: types_1.DEFAULT_CONFIG.priorityFactors,
    historyRetentionDays: types_1.DEFAULT_CONFIG.historyRetentionDays,
    flakyThreshold: types_1.DEFAULT_CONFIG.flakyThreshold,
    patternSensitivity: types_1.DEFAULT_CONFIG.patternSensitivity,
    minSamplesForTrends: types_1.DEFAULT_CONFIG.minSamplesForTrends,
    customRules: types_1.DEFAULT_CONFIG.customRules,
    logLevel: types_1.DEFAULT_CONFIG.logLevel,
    historyPath: types_1.DEFAULT_CONFIG.historyPath,
    patternCachePath: types_1.DEFAULT_CONFIG.patternCachePath,
};
//# sourceMappingURL=PriorityAgent.js.map