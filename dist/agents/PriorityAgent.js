"use strict";
/**
 * PriorityAgent - Test priority analysis and ranking agent
 *
 * This agent analyzes test failures to determine priority levels, calculates impact scores,
 * ranks failures by importance, and provides actionable recommendations for fixing order.
 * It includes pattern recognition, trend analysis, and machine learning-ready scoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultPriorityAgentConfig = exports.PriorityAgent = void 0;
exports.createPriorityAgent = createPriorityAgent;
const events_1 = require("events");
const index_1 = require("./index");
const TestModels_1 = require("../models/TestModels");
const logger_1 = require("../utils/logger");
/**
 * Default priority factors
 */
const DEFAULT_PRIORITY_FACTORS = {
    errorSeverity: 0.25,
    userImpact: 0.20,
    testStability: 0.15,
    businessPriority: 0.15,
    securityImplications: 0.10,
    performanceImpact: 0.10,
    regressionDetection: 0.05
};
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    priorityFactors: DEFAULT_PRIORITY_FACTORS,
    historyRetentionDays: 30,
    flakyThreshold: 0.3,
    patternSensitivity: 0.7,
    minSamplesForTrends: 5,
    customRules: [],
    logLevel: logger_1.LogLevel.INFO
};
/**
 * PriorityAgent implementation
 */
class PriorityAgent extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.name = 'PriorityAgent';
        this.type = index_1.AgentType.SYSTEM;
        this.analysisHistory = new Map();
        this.patternCache = new Map();
        this.isInitialized = false;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = (0, logger_1.createLogger)({ level: this.config.logLevel });
        this.logger.setContext({ component: 'PriorityAgent' });
    }
    /**
     * Initialize the priority agent
     */
    async initialize() {
        this.logger.info('Initializing PriorityAgent');
        try {
            // Validate configuration
            this.validateConfiguration();
            // Initialize analysis history
            await this.loadAnalysisHistory();
            // Initialize pattern cache
            await this.loadPatternCache();
            this.isInitialized = true;
            this.logger.info('PriorityAgent initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize PriorityAgent', { error });
            throw error;
        }
    }
    /**
     * Execute priority analysis on a scenario (implements IAgent interface)
     */
    async execute(scenario) {
        if (!this.isInitialized) {
            throw new Error('PriorityAgent not initialized. Call initialize() first.');
        }
        this.logger.info(`Executing priority analysis for scenario: ${scenario.id}`);
        // For the IAgent interface, we need a test failure to analyze
        // This is a simplified implementation that would need actual failure data
        const mockFailure = {
            scenarioId: scenario.id,
            timestamp: new Date(),
            message: 'Mock failure for priority analysis',
            category: 'execution'
        };
        return this.analyzePriority(mockFailure);
    }
    /**
     * Analyze and assign priority to a test failure
     */
    async analyzePriority(failure, context) {
        this.logger.debug(`Analyzing priority for failure: ${failure.scenarioId}`, {
            failureMessage: failure.message,
            category: failure.category
        });
        const fullContext = await this.buildAnalysisContext(failure, context);
        const impactScore = this.calculateImpactScore(failure, fullContext);
        const priority = this.determinePriorityLevel(impactScore);
        const reasoning = this.generateReasoning(failure, fullContext, impactScore);
        const factors = this.calculateFactorBreakdown(failure, fullContext);
        const confidence = this.calculateConfidence(failure, fullContext);
        const estimatedFixEffort = this.estimateFixEffort(failure, fullContext);
        const assignment = {
            scenarioId: failure.scenarioId,
            priority,
            impactScore,
            confidence,
            timestamp: new Date(),
            reasoning,
            factors,
            estimatedFixEffort
        };
        // Store in history
        this.storeAssignment(assignment);
        this.logger.info(`Priority assigned: ${priority} (score: ${impactScore})`, {
            scenarioId: failure.scenarioId,
            assignment
        });
        return assignment;
    }
    /**
     * Calculate impact score for a test failure
     */
    calculateImpactScore(failure, context) {
        const factors = this.config.priorityFactors;
        let score = 0;
        // Error severity scoring
        const severityScore = this.scoreSeverity(failure);
        score += severityScore * (factors.errorSeverity || 0);
        // User impact scoring
        const userImpactScore = this.scoreUserImpact(failure, context);
        score += userImpactScore * (factors.userImpact || 0);
        // Test stability scoring
        const stabilityScore = this.scoreStability(failure, context);
        score += stabilityScore * (factors.testStability || 0);
        // Business priority scoring
        const businessScore = this.scoreBusinessPriority(failure, context);
        score += businessScore * (factors.businessPriority || 0);
        // Security implications scoring
        const securityScore = this.scoreSecurityImplications(failure, context);
        score += securityScore * (factors.securityImplications || 0);
        // Performance impact scoring
        const performanceScore = this.scorePerformanceImpact(failure, context);
        score += performanceScore * (factors.performanceImpact || 0);
        // Regression detection scoring
        const regressionScore = this.scoreRegressionDetection(failure, context);
        score += regressionScore * (factors.regressionDetection || 0);
        // Apply custom rules
        score += this.applyCustomRules(failure, context);
        // Normalize to 0-100 scale
        return Math.max(0, Math.min(100, score * 100));
    }
    /**
     * Rank multiple failures by priority
     */
    rankFailures(failures) {
        this.logger.info(`Ranking ${failures.length} failures by priority`);
        return Promise.all(failures.map(failure => this.analyzePriority(failure))).then(assignments => {
            // Sort by impact score (descending) and confidence (descending)
            const ranked = assignments.sort((a, b) => {
                if (a.impactScore !== b.impactScore) {
                    return b.impactScore - a.impactScore;
                }
                return b.confidence - a.confidence;
            });
            this.logger.info('Failures ranked by priority', {
                totalFailures: failures.length,
                ranking: ranked.map((a, index) => ({
                    rank: index + 1,
                    scenarioId: a.scenarioId,
                    priority: a.priority,
                    score: a.impactScore
                }))
            });
            return ranked;
        });
    }
    /**
     * Suggest order for fixing failures
     */
    async suggestFixOrder(failures) {
        this.logger.info(`Suggesting fix order for ${failures.length} failures`);
        const rankedAssignments = await this.rankFailures(failures);
        // Group by priority and consider fix effort
        const groups = {
            [TestModels_1.Priority.CRITICAL]: [],
            [TestModels_1.Priority.HIGH]: [],
            [TestModels_1.Priority.MEDIUM]: [],
            [TestModels_1.Priority.LOW]: []
        };
        rankedAssignments.forEach(assignment => {
            groups[assignment.priority].push(assignment);
        });
        // Within each priority group, sort by fix effort (ascending)
        Object.values(groups).forEach(group => {
            group.sort((a, b) => {
                const effortA = a.estimatedFixEffort || 0;
                const effortB = b.estimatedFixEffort || 0;
                return effortA - effortB;
            });
        });
        // Build final fix order
        const fixOrder = [
            ...groups[TestModels_1.Priority.CRITICAL],
            ...groups[TestModels_1.Priority.HIGH],
            ...groups[TestModels_1.Priority.MEDIUM],
            ...groups[TestModels_1.Priority.LOW]
        ].map(assignment => assignment.scenarioId);
        this.logger.info('Fix order generated', {
            fixOrder: fixOrder.map((scenarioId, index) => ({
                order: index + 1,
                scenarioId,
                priority: rankedAssignments.find(a => a.scenarioId === scenarioId)?.priority
            }))
        });
        return fixOrder;
    }
    /**
     * Identify flaky tests from historical results
     */
    identifyFlaky(results) {
        this.logger.info(`Analyzing ${results.length} results for flaky tests`);
        const scenarioGroups = new Map();
        // Group results by scenario
        results.forEach(result => {
            if (!scenarioGroups.has(result.scenarioId)) {
                scenarioGroups.set(result.scenarioId, []);
            }
            scenarioGroups.get(result.scenarioId).push(result);
        });
        const flakyTests = [];
        scenarioGroups.forEach((scenarioResults, scenarioId) => {
            if (scenarioResults.length < this.config.minSamplesForTrends) {
                return; // Not enough data
            }
            const flakyResult = this.analyzeFlakyBehavior(scenarioId, scenarioResults);
            if (flakyResult.flakinessScore >= this.config.flakyThreshold) {
                flakyTests.push(flakyResult);
            }
        });
        this.logger.info(`Found ${flakyTests.length} flaky tests`, {
            flakyTests: flakyTests.map(test => ({
                scenarioId: test.scenarioId,
                flakinessScore: test.flakinessScore,
                failureRate: test.failureRate,
                recommendedAction: test.recommendedAction
            }))
        });
        return flakyTests;
    }
    /**
     * Analyze failure patterns across multiple failures
     */
    analyzeFailurePatterns(failures) {
        this.logger.info(`Analyzing patterns in ${failures.length} failures`);
        const patterns = [];
        // Group failures by error message similarity
        const messagePatterns = this.groupByMessagePatterns(failures);
        patterns.push(...messagePatterns);
        // Group failures by stack trace similarity
        const stackPatterns = this.groupByStackTracePatterns(failures);
        patterns.push(...stackPatterns);
        // Group failures by timing patterns
        const timingPatterns = this.groupByTimingPatterns(failures);
        patterns.push(...timingPatterns);
        // Group failures by category
        const categoryPatterns = this.groupByCategoryPatterns(failures);
        patterns.push(...categoryPatterns);
        // Update pattern cache
        patterns.forEach(pattern => {
            this.patternCache.set(pattern.id, pattern);
        });
        this.logger.info(`Found ${patterns.length} failure patterns`, {
            patterns: patterns.map(pattern => ({
                id: pattern.id,
                description: pattern.description,
                affectedScenarios: pattern.affectedScenarios.length,
                frequency: pattern.frequency,
                confidence: pattern.confidence
            }))
        });
        return patterns;
    }
    /**
     * Generate comprehensive priority report
     */
    async generatePriorityReport(failures, results = []) {
        this.logger.info('Generating comprehensive priority report');
        const assignments = await this.rankFailures(failures);
        const patterns = this.analyzeFailurePatterns(failures);
        const flakyTests = this.identifyFlaky(results);
        const fixOrder = await this.suggestFixOrder(failures);
        const summary = {
            criticalCount: assignments.filter(a => a.priority === TestModels_1.Priority.CRITICAL).length,
            highCount: assignments.filter(a => a.priority === TestModels_1.Priority.HIGH).length,
            mediumCount: assignments.filter(a => a.priority === TestModels_1.Priority.MEDIUM).length,
            lowCount: assignments.filter(a => a.priority === TestModels_1.Priority.LOW).length,
            averageImpactScore: assignments.reduce((sum, a) => sum + a.impactScore, 0) / assignments.length,
            averageConfidence: assignments.reduce((sum, a) => sum + a.confidence, 0) / assignments.length
        };
        const recommendations = this.generateRecommendations(assignments, patterns, flakyTests);
        const report = {
            timestamp: new Date(),
            totalFailures: failures.length,
            assignments,
            patterns,
            flakyTests,
            fixOrder,
            summary,
            recommendations
        };
        this.logger.info('Priority report generated', { summary });
        this.emit('reportGenerated', report);
        return report;
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.logger.info('Cleaning up PriorityAgent');
        try {
            // Save analysis history
            await this.saveAnalysisHistory();
            // Save pattern cache
            await this.savePatternCache();
            // Close logger
            await this.logger.close();
            this.emit('cleanup');
            this.logger.info('PriorityAgent cleanup completed');
        }
        catch (error) {
            this.logger.error('Error during PriorityAgent cleanup', { error });
            throw error;
        }
    }
    // Private helper methods
    validateConfiguration() {
        const factors = this.config.priorityFactors;
        const totalWeight = Object.values(factors).reduce((sum, weight) => sum + weight, 0);
        if (Math.abs(totalWeight - 1.0) > 0.01) {
            this.logger.warn('Priority factor weights do not sum to 1.0', {
                totalWeight,
                factors
            });
        }
        if (this.config.flakyThreshold < 0 || this.config.flakyThreshold > 1) {
            throw new Error('Flaky threshold must be between 0 and 1');
        }
    }
    async buildAnalysisContext(failure, partialContext) {
        return {
            history: partialContext?.history || [],
            scenarios: partialContext?.scenarios || new Map(),
            previousPriorities: partialContext?.previousPriorities || new Map(),
            systemInfo: partialContext?.systemInfo || {}
        };
    }
    scoreSeverity(failure) {
        const message = failure.message.toLowerCase();
        const stackTrace = failure.stackTrace?.toLowerCase() || '';
        // Critical severity indicators
        if (message.includes('crash') || message.includes('segfault') ||
            message.includes('fatal') || message.includes('abort')) {
            return 1.0;
        }
        // High severity indicators
        if (message.includes('error') || message.includes('exception') ||
            message.includes('failed') || stackTrace.includes('error')) {
            return 0.8;
        }
        // Medium severity indicators
        if (message.includes('warning') || message.includes('timeout') ||
            message.includes('assertion')) {
            return 0.6;
        }
        // Low severity (default)
        return 0.4;
    }
    scoreUserImpact(failure, context) {
        const scenario = context.scenarios.get(failure.scenarioId);
        if (!scenario)
            return 0.5;
        // High impact for GUI tests (user-facing)
        if (scenario.interface === TestModels_1.TestInterface.GUI) {
            return 0.9;
        }
        // Medium-high impact for mixed interfaces
        if (scenario.interface === TestModels_1.TestInterface.MIXED) {
            return 0.7;
        }
        // Medium impact for CLI tests
        if (scenario.interface === TestModels_1.TestInterface.CLI) {
            return 0.6;
        }
        // Lower impact for API tests (internal)
        return 0.4;
    }
    scoreStability(failure, context) {
        const history = context.history.filter(r => r.scenarioId === failure.scenarioId);
        if (history.length === 0)
            return 0.5;
        const recentFailures = history
            .filter(r => r.status === TestModels_1.TestStatus.FAILED)
            .filter(r => {
            const daysSinceFailure = (Date.now() - r.startTime.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceFailure <= 7; // Last 7 days
        });
        const failureRate = recentFailures.length / Math.min(history.length, 10);
        return Math.min(1.0, failureRate * 2); // Double weight for instability
    }
    scoreBusinessPriority(failure, context) {
        const scenario = context.scenarios.get(failure.scenarioId);
        if (!scenario)
            return 0.5;
        // Use scenario priority as business priority indicator
        switch (scenario.priority) {
            case TestModels_1.Priority.CRITICAL:
                return 1.0;
            case TestModels_1.Priority.HIGH:
                return 0.8;
            case TestModels_1.Priority.MEDIUM:
                return 0.6;
            case TestModels_1.Priority.LOW:
                return 0.4;
            default:
                return 0.5;
        }
    }
    scoreSecurityImplications(failure, context) {
        const message = failure.message.toLowerCase();
        const scenario = context.scenarios.get(failure.scenarioId);
        const tags = scenario?.tags || [];
        // Security-related keywords
        const securityKeywords = [
            'security', 'auth', 'login', 'credential', 'token', 'permission',
            'access', 'admin', 'privilege', 'encrypt', 'decrypt', 'certificate'
        ];
        const hasSecurityKeywords = securityKeywords.some(keyword => message.includes(keyword) || tags.some(tag => tag.toLowerCase().includes(keyword)));
        return hasSecurityKeywords ? 1.0 : 0.2;
    }
    scorePerformanceImpact(failure, context) {
        const message = failure.message.toLowerCase();
        // Performance-related keywords
        if (message.includes('timeout') || message.includes('slow') ||
            message.includes('performance') || message.includes('memory') ||
            message.includes('cpu')) {
            return 0.9;
        }
        // Check if scenario has performance tags
        const scenario = context.scenarios.get(failure.scenarioId);
        const tags = scenario?.tags || [];
        const hasPerformanceTags = tags.some(tag => tag.toLowerCase().includes('performance') ||
            tag.toLowerCase().includes('load') ||
            tag.toLowerCase().includes('stress'));
        return hasPerformanceTags ? 0.8 : 0.3;
    }
    scoreRegressionDetection(failure, context) {
        const history = context.history.filter(r => r.scenarioId === failure.scenarioId);
        if (history.length === 0)
            return 0.5;
        // Check if this was previously passing
        const recentPassing = history
            .filter(r => r.status === TestModels_1.TestStatus.PASSED)
            .filter(r => {
            const daysSinceTest = (Date.now() - r.startTime.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceTest <= 30; // Last 30 days
        });
        // High regression score if recently passing tests are now failing
        return recentPassing.length > 0 ? 0.9 : 0.4;
    }
    applyCustomRules(failure, context) {
        let modifierSum = 0;
        this.config.customRules.forEach(rule => {
            if (rule.condition(failure, context)) {
                modifierSum += rule.priorityModifier;
                this.logger.debug(`Applied custom rule: ${rule.name}`, {
                    scenarioId: failure.scenarioId,
                    modifier: rule.priorityModifier
                });
            }
        });
        // Convert modifier (-100 to +100) to factor (-1 to +1)
        return modifierSum / 100;
    }
    determinePriorityLevel(impactScore) {
        if (impactScore >= 80)
            return TestModels_1.Priority.CRITICAL;
        if (impactScore >= 60)
            return TestModels_1.Priority.HIGH;
        if (impactScore >= 40)
            return TestModels_1.Priority.MEDIUM;
        return TestModels_1.Priority.LOW;
    }
    generateReasoning(failure, context, impactScore) {
        const reasoning = [];
        reasoning.push(`Impact score: ${impactScore.toFixed(1)}/100`);
        if (impactScore >= 80) {
            reasoning.push('Critical priority due to high impact score');
        }
        else if (impactScore >= 60) {
            reasoning.push('High priority due to significant impact');
        }
        else if (impactScore >= 40) {
            reasoning.push('Medium priority with moderate impact');
        }
        else {
            reasoning.push('Low priority with minimal impact');
        }
        const scenario = context.scenarios.get(failure.scenarioId);
        if (scenario) {
            reasoning.push(`Test interface: ${scenario.interface}`);
            reasoning.push(`Scenario priority: ${scenario.priority}`);
        }
        return reasoning;
    }
    calculateFactorBreakdown(failure, context) {
        return {
            severity: this.scoreSeverity(failure),
            userImpact: this.scoreUserImpact(failure, context),
            stability: this.scoreStability(failure, context),
            businessPriority: this.scoreBusinessPriority(failure, context),
            securityImplications: this.scoreSecurityImplications(failure, context),
            performanceImpact: this.scorePerformanceImpact(failure, context),
            regressionDetection: this.scoreRegressionDetection(failure, context)
        };
    }
    calculateConfidence(failure, context) {
        let confidence = 0.5; // Base confidence
        // Increase confidence with more historical data
        const history = context.history.filter(r => r.scenarioId === failure.scenarioId);
        const historyFactor = Math.min(1.0, history.length / 10);
        confidence += historyFactor * 0.3;
        // Increase confidence if scenario information is available
        if (context.scenarios.has(failure.scenarioId)) {
            confidence += 0.2;
        }
        return Math.min(1.0, confidence);
    }
    estimateFixEffort(failure, context) {
        const scenario = context.scenarios.get(failure.scenarioId);
        let baseEffort = 2; // 2 hours default
        // Adjust based on interface complexity
        if (scenario?.interface === TestModels_1.TestInterface.GUI) {
            baseEffort *= 1.5; // GUI tests often more complex to fix
        }
        else if (scenario?.interface === TestModels_1.TestInterface.MIXED) {
            baseEffort *= 1.3;
        }
        // Adjust based on severity
        const severityScore = this.scoreSeverity(failure);
        baseEffort *= (1 + severityScore);
        // Adjust based on stability (unstable tests harder to fix)
        const stabilityScore = this.scoreStability(failure, context);
        baseEffort *= (1 + stabilityScore);
        return Math.round(baseEffort * 10) / 10; // Round to 1 decimal place
    }
    analyzeFlakyBehavior(scenarioId, results) {
        const sortedResults = results.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        let flipCount = 0;
        let failureCount = 0;
        for (let i = 0; i < sortedResults.length; i++) {
            const current = sortedResults[i];
            if (current.status === TestModels_1.TestStatus.FAILED || current.status === TestModels_1.TestStatus.ERROR) {
                failureCount++;
            }
            if (i > 0) {
                const previous = sortedResults[i - 1];
                const currentFailed = current.status === TestModels_1.TestStatus.FAILED || current.status === TestModels_1.TestStatus.ERROR;
                const previousFailed = previous.status === TestModels_1.TestStatus.FAILED || previous.status === TestModels_1.TestStatus.ERROR;
                if (currentFailed !== previousFailed) {
                    flipCount++;
                }
            }
        }
        const failureRate = failureCount / results.length;
        const flipRate = flipCount / Math.max(1, results.length - 1);
        // Flakiness score combines failure rate and flip rate
        const flakinessScore = (failureRate * 0.6) + (flipRate * 0.4);
        let recommendedAction = 'monitor';
        if (flakinessScore >= 0.7) {
            recommendedAction = 'quarantine';
        }
        else if (flakinessScore >= 0.5) {
            recommendedAction = 'investigate';
        }
        else if (flakinessScore >= 0.3) {
            recommendedAction = 'stabilize';
        }
        return {
            scenarioId,
            flakinessScore,
            failureRate,
            flipCount,
            analysisWindow: {
                startDate: sortedResults[0].startTime,
                endDate: sortedResults[sortedResults.length - 1].endTime,
                totalRuns: results.length
            },
            recommendedAction
        };
    }
    groupByMessagePatterns(failures) {
        const patterns = [];
        const messageGroups = new Map();
        failures.forEach(failure => {
            // Extract pattern from error message (simplified)
            const pattern = this.extractMessagePattern(failure.message);
            if (!messageGroups.has(pattern)) {
                messageGroups.set(pattern, []);
            }
            messageGroups.get(pattern).push(failure);
        });
        messageGroups.forEach((groupFailures, pattern) => {
            if (groupFailures.length >= 2) { // Pattern needs at least 2 occurrences
                const timestamps = groupFailures.map(f => f.timestamp);
                patterns.push({
                    id: `msg-${this.generatePatternId(pattern)}`,
                    description: `Error message pattern: "${pattern}"`,
                    affectedScenarios: Array.from(new Set(groupFailures.map(f => f.scenarioId))),
                    frequency: groupFailures.length,
                    firstSeen: new Date(Math.min(...timestamps.map(t => t.getTime()))),
                    lastSeen: new Date(Math.max(...timestamps.map(t => t.getTime()))),
                    confidence: Math.min(1.0, groupFailures.length / failures.length * 2),
                    suggestedRootCause: this.suggestRootCauseFromMessage(pattern)
                });
            }
        });
        return patterns;
    }
    groupByStackTracePatterns(failures) {
        // Simplified implementation - would need more sophisticated stack trace analysis
        return [];
    }
    groupByTimingPatterns(failures) {
        // Group failures that happen at similar times
        const hourGroups = new Map();
        failures.forEach(failure => {
            const hour = failure.timestamp.getHours();
            if (!hourGroups.has(hour)) {
                hourGroups.set(hour, []);
            }
            hourGroups.get(hour).push(failure);
        });
        const patterns = [];
        hourGroups.forEach((groupFailures, hour) => {
            if (groupFailures.length >= 3) { // Need significant clustering
                const timestamps = groupFailures.map(f => f.timestamp);
                patterns.push({
                    id: `time-${hour}`,
                    description: `Failures clustered around ${hour}:00 hour`,
                    affectedScenarios: Array.from(new Set(groupFailures.map(f => f.scenarioId))),
                    frequency: groupFailures.length,
                    firstSeen: new Date(Math.min(...timestamps.map(t => t.getTime()))),
                    lastSeen: new Date(Math.max(...timestamps.map(t => t.getTime()))),
                    confidence: 0.7,
                    suggestedRootCause: 'Possible scheduled task or resource contention'
                });
            }
        });
        return patterns;
    }
    groupByCategoryPatterns(failures) {
        const categoryGroups = new Map();
        failures.forEach(failure => {
            const category = failure.category || 'unknown';
            if (!categoryGroups.has(category)) {
                categoryGroups.set(category, []);
            }
            categoryGroups.get(category).push(failure);
        });
        const patterns = [];
        categoryGroups.forEach((groupFailures, category) => {
            if (groupFailures.length >= 2) {
                const timestamps = groupFailures.map(f => f.timestamp);
                patterns.push({
                    id: `cat-${category}`,
                    description: `Category pattern: ${category}`,
                    affectedScenarios: Array.from(new Set(groupFailures.map(f => f.scenarioId))),
                    frequency: groupFailures.length,
                    firstSeen: new Date(Math.min(...timestamps.map(t => t.getTime()))),
                    lastSeen: new Date(Math.max(...timestamps.map(t => t.getTime()))),
                    confidence: 0.8,
                    suggestedRootCause: `Common issue in ${category} category`
                });
            }
        });
        return patterns;
    }
    extractMessagePattern(message) {
        // Simplified pattern extraction - replace numbers and IDs with placeholders
        return message
            .replace(/\d+/g, 'NUMBER')
            .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
            .replace(/\/[^\s]+/g, 'PATH')
            .toLowerCase()
            .trim();
    }
    generatePatternId(pattern) {
        // Simple hash function for pattern ID
        let hash = 0;
        for (let i = 0; i < pattern.length; i++) {
            const char = pattern.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
    suggestRootCauseFromMessage(pattern) {
        if (pattern.includes('timeout'))
            return 'Performance or network issues';
        if (pattern.includes('not found') || pattern.includes('missing'))
            return 'Missing resources or dependencies';
        if (pattern.includes('permission') || pattern.includes('access'))
            return 'Permission or authentication issues';
        if (pattern.includes('connection'))
            return 'Network connectivity issues';
        if (pattern.includes('memory') || pattern.includes('out of'))
            return 'Resource exhaustion';
        return 'Unknown root cause - requires investigation';
    }
    generateRecommendations(assignments, patterns, flakyTests) {
        const recommendations = [];
        const criticalCount = assignments.filter(a => a.priority === TestModels_1.Priority.CRITICAL).length;
        if (criticalCount > 0) {
            recommendations.push(`Address ${criticalCount} critical priority failures immediately`);
        }
        const highCount = assignments.filter(a => a.priority === TestModels_1.Priority.HIGH).length;
        if (highCount > 3) {
            recommendations.push(`${highCount} high priority failures detected - consider increasing team focus on testing`);
        }
        if (patterns.length > 0) {
            const topPattern = patterns.sort((a, b) => b.frequency - a.frequency)[0];
            recommendations.push(`Most frequent pattern: "${topPattern.description}" affects ${topPattern.affectedScenarios.length} scenarios`);
        }
        const quarantineCandidates = flakyTests.filter(t => t.recommendedAction === 'quarantine');
        if (quarantineCandidates.length > 0) {
            recommendations.push(`Consider quarantining ${quarantineCandidates.length} highly flaky tests until stabilized`);
        }
        const stabilizeCandidates = flakyTests.filter(t => t.recommendedAction === 'stabilize');
        if (stabilizeCandidates.length > 0) {
            recommendations.push(`${stabilizeCandidates.length} tests need stabilization work`);
        }
        return recommendations;
    }
    storeAssignment(assignment) {
        if (!this.analysisHistory.has(assignment.scenarioId)) {
            this.analysisHistory.set(assignment.scenarioId, []);
        }
        this.analysisHistory.get(assignment.scenarioId).push(assignment);
    }
    async loadAnalysisHistory() {
        // In a real implementation, this would load from persistent storage
        this.logger.debug('Loading analysis history from storage');
    }
    async saveAnalysisHistory() {
        // In a real implementation, this would save to persistent storage
        this.logger.debug('Saving analysis history to storage');
    }
    async loadPatternCache() {
        // In a real implementation, this would load from persistent storage
        this.logger.debug('Loading pattern cache from storage');
    }
    async savePatternCache() {
        // In a real implementation, this would save to persistent storage
        this.logger.debug('Saving pattern cache to storage');
    }
}
exports.PriorityAgent = PriorityAgent;
/**
 * Create a new PriorityAgent instance with the specified configuration
 */
function createPriorityAgent(config) {
    return new PriorityAgent(config);
}
/**
 * Default configuration for PriorityAgent
 */
exports.defaultPriorityAgentConfig = {
    priorityFactors: DEFAULT_PRIORITY_FACTORS,
    historyRetentionDays: 30,
    flakyThreshold: 0.3,
    patternSensitivity: 0.7,
    minSamplesForTrends: 5,
    customRules: [],
    logLevel: logger_1.LogLevel.INFO
};
//# sourceMappingURL=PriorityAgent.js.map