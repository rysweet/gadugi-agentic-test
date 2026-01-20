"use strict";
/**
 * Main orchestrator for the Agentic Testing System
 * Coordinates all testing agents and manages test execution flow
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestOrchestrator = void 0;
exports.createTestOrchestrator = createTestOrchestrator;
const events_1 = require("events");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const uuid_1 = require("uuid");
const TestModels_1 = require("../models/TestModels");
const ElectronUIAgent_1 = require("../agents/ElectronUIAgent");
const CLIAgent_1 = require("../agents/CLIAgent");
const IssueReporter_1 = require("../agents/IssueReporter");
const PriorityAgent_1 = require("../agents/PriorityAgent");
const logger_1 = require("../utils/logger");
const yamlParser_1 = require("../utils/yamlParser");
/**
 * Main test orchestrator class
 */
class TestOrchestrator extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.session = null;
        this.results = [];
        this.failures = [];
        this.uiAgent = null;
        this.config = config;
        // Initialize agents
        this.cliAgent = new CLIAgent_1.CLIAgent(config.cli);
        this.issueReporter = new IssueReporter_1.IssueReporter(config.github);
        this.priorityAgent = new PriorityAgent_1.PriorityAgent(config.priority);
        // Initialize UI agent if configured
        if (config.ui && config.ui.browser) {
            this.uiAgent = new ElectronUIAgent_1.ElectronUIAgent(config.ui);
        }
        // Execution settings
        this.maxParallel = config.execution?.maxParallel || 3;
        this.retryCount = config.execution?.maxRetries || 2;
        this.failFast = config.execution?.continueOnFailure === false;
        this.abortController = new AbortController();
        // Setup event handlers
        this.setupEventHandlers();
    }
    /**
     * Setup internal event handlers
     */
    setupEventHandlers() {
        this.on('error', (error) => {
            logger_1.logger.error('Orchestrator error:', error);
        });
    }
    /**
     * Run a complete testing session
     */
    async run(suite = 'smoke', scenarioFiles) {
        logger_1.logger.info(`Starting test session with suite: ${suite}`);
        // Create session
        this.session = {
            id: (0, uuid_1.v4)(),
            startTime: new Date(),
            endTime: null,
            scenariosExecuted: [],
            results: [],
            failures: [],
            issuesCreated: [],
            metrics: {
                totalScenarios: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                duration: 0
            }
        };
        this.emit('session:start', this.session);
        try {
            // Phase 1: Discovery
            this.emit('phase:start', 'discovery');
            logger_1.logger.info('Phase 1: Loading and discovering test scenarios');
            const scenarios = await this.loadScenarios(scenarioFiles);
            // Filter scenarios based on suite
            const filteredScenarios = this.filterScenariosForSuite(scenarios, suite);
            logger_1.logger.info(`Selected ${filteredScenarios.length} scenarios for suite '${suite}'`);
            this.emit('phase:end', 'discovery');
            // Phase 2: Execution
            this.emit('phase:start', 'execution');
            logger_1.logger.info('Phase 2: Executing test scenarios');
            await this.executeScenarios(filteredScenarios);
            this.emit('phase:end', 'execution');
            // Phase 3: Analysis
            this.emit('phase:start', 'analysis');
            logger_1.logger.info('Phase 3: Analyzing results and prioritizing failures');
            await this.analyzeResults();
            this.emit('phase:end', 'analysis');
            // Phase 4: Reporting
            this.emit('phase:start', 'reporting');
            logger_1.logger.info('Phase 4: Reporting failures to GitHub');
            await this.reportFailures();
            this.emit('phase:end', 'reporting');
        }
        catch (error) {
            logger_1.logger.error('Test session failed:', error);
            this.emit('error', error);
            throw error;
        }
        finally {
            // Finalize session
            this.session.endTime = new Date();
            this.calculateSessionMetrics();
            // Save session results
            await this.saveSessionResults();
            this.emit('session:end', this.session);
        }
        logger_1.logger.info(`Test session completed: ${this.session.id}`);
        return this.session;
    }
    /**
     * Load test scenarios from files
     */
    async loadScenarios(scenarioFiles) {
        const scenarios = [];
        // Default scenario directory
        const scenarioDir = path.join(process.cwd(), 'scenarios');
        if (scenarioFiles && scenarioFiles.length > 0) {
            // Load specific files
            for (const file of scenarioFiles) {
                try {
                    const content = await fs.readFile(file, 'utf-8');
                    const fileScenarios = await (0, yamlParser_1.parseYamlScenarios)(content);
                    scenarios.push(...fileScenarios);
                    logger_1.logger.debug(`Loaded ${fileScenarios.length} scenarios from ${file}`);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to load scenarios from ${file}:`, error);
                }
            }
        }
        else {
            // Load all YAML files from scenario directory
            try {
                const files = await fs.readdir(scenarioDir);
                const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
                for (const file of yamlFiles) {
                    const filePath = path.join(scenarioDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const fileScenarios = await (0, yamlParser_1.parseYamlScenarios)(content);
                    scenarios.push(...fileScenarios);
                    logger_1.logger.debug(`Loaded ${fileScenarios.length} scenarios from ${file}`);
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to load scenarios from directory:', error);
            }
        }
        logger_1.logger.info(`Loaded ${scenarios.length} total test scenarios`);
        return scenarios;
    }
    /**
     * Filter scenarios based on test suite configuration
     */
    filterScenariosForSuite(scenarios, suite) {
        // Default test suites
        const suiteConfig = {
            smoke: ['smoke:', 'critical:', 'auth:'],
            regression: ['*'],
            full: ['*'],
            ...this.config.execution?.suites
        };
        const patterns = suiteConfig[suite] || ['*'];
        if (patterns.includes('*')) {
            return scenarios;
        }
        const filtered = [];
        for (const scenario of scenarios) {
            for (const pattern of patterns) {
                if (pattern.endsWith(':')) {
                    // Prefix match
                    const prefix = pattern.slice(0, -1);
                    if (scenario.id.startsWith(prefix) ||
                        scenario.tags?.some(tag => tag.startsWith(prefix))) {
                        filtered.push(scenario);
                        break;
                    }
                }
                else if (pattern.includes('*')) {
                    // Glob pattern
                    const regex = new RegExp(pattern.replace('*', '.*'));
                    if (regex.test(scenario.id) ||
                        scenario.tags?.some(tag => regex.test(tag))) {
                        filtered.push(scenario);
                        break;
                    }
                }
                else {
                    // Exact match
                    if (scenario.id === pattern ||
                        scenario.tags?.includes(pattern)) {
                        filtered.push(scenario);
                        break;
                    }
                }
            }
        }
        return filtered;
    }
    /**
     * Execute test scenarios with parallel execution support
     */
    async executeScenarios(scenarios) {
        // Group scenarios by interface type
        const cliScenarios = scenarios.filter(s => s.interface === TestModels_1.TestInterface.CLI);
        const uiScenarios = scenarios.filter(s => s.interface === TestModels_1.TestInterface.GUI);
        const mixedScenarios = scenarios.filter(s => s.interface === TestModels_1.TestInterface.MIXED);
        // Execute CLI scenarios
        if (cliScenarios.length > 0) {
            logger_1.logger.info(`Executing ${cliScenarios.length} CLI scenarios`);
            await this.executeCLIScenarios(cliScenarios);
        }
        // Execute UI scenarios
        if (uiScenarios.length > 0) {
            logger_1.logger.info(`Executing ${uiScenarios.length} UI scenarios`);
            await this.executeUIScenarios(uiScenarios);
        }
        // Execute mixed scenarios
        if (mixedScenarios.length > 0) {
            logger_1.logger.info(`Executing ${mixedScenarios.length} mixed scenarios`);
            await this.executeMixedScenarios(mixedScenarios);
        }
    }
    /**
     * Execute CLI test scenarios in parallel
     */
    async executeCLIScenarios(scenarios) {
        const results = await this.executeParallel(scenarios, async (scenario) => {
            return await this.executeSingleScenario(scenario, this.cliAgent);
        });
        this.processResults(scenarios, results);
    }
    /**
     * Execute UI test scenarios
     */
    async executeUIScenarios(scenarios) {
        if (!this.uiAgent) {
            logger_1.logger.warn('UI agent not available');
            for (const scenario of scenarios) {
                this.recordFailure(scenario, 'UI testing unavailable - Electron agent not configured');
            }
            return;
        }
        // Initialize UI agent
        await this.uiAgent.initialize();
        try {
            // UI scenarios typically run sequentially
            for (const scenario of scenarios) {
                if (this.abortController.signal.aborted) {
                    logger_1.logger.info('Execution aborted');
                    break;
                }
                const result = await this.executeSingleScenario(scenario, this.uiAgent);
                this.recordResult(result);
                if (this.failFast && result.status === TestModels_1.TestStatus.FAILED) {
                    logger_1.logger.warn('Fail-fast enabled, stopping execution');
                    break;
                }
            }
        }
        finally {
            await this.uiAgent.cleanup();
        }
    }
    /**
     * Execute mixed interface scenarios
     */
    async executeMixedScenarios(scenarios) {
        for (const scenario of scenarios) {
            if (this.abortController.signal.aborted) {
                logger_1.logger.info('Execution aborted');
                break;
            }
            const agent = this.selectAgentForScenario(scenario);
            const result = await this.executeSingleScenario(scenario, agent);
            this.recordResult(result);
            if (this.failFast && result.status === TestModels_1.TestStatus.FAILED) {
                logger_1.logger.warn('Fail-fast enabled, stopping execution');
                break;
            }
        }
    }
    /**
     * Execute scenarios in parallel with concurrency limit
     */
    async executeParallel(items, handler) {
        const results = [];
        const executing = [];
        for (const item of items) {
            if (this.abortController.signal.aborted) {
                break;
            }
            const promise = handler(item).then(result => { results.push(result); }, error => { results.push(error); });
            executing.push(promise);
            if (executing.length >= this.maxParallel) {
                await Promise.race(executing);
                executing.splice(0, executing.findIndex(p => p));
            }
        }
        await Promise.all(executing);
        return results;
    }
    /**
     * Execute a single test scenario
     */
    async executeSingleScenario(scenario, agent) {
        logger_1.logger.info(`Executing scenario: ${scenario.id} - ${scenario.name}`);
        this.emit('scenario:start', scenario);
        const startTime = Date.now();
        let retryCount = 0;
        while (retryCount <= this.retryCount) {
            try {
                const result = await agent.execute(scenario);
                const endResult = {
                    ...result,
                    scenarioId: scenario.id,
                    duration: Date.now() - startTime,
                    retryCount
                };
                this.emit('scenario:end', scenario, endResult);
                return endResult;
            }
            catch (error) {
                logger_1.logger.error(`Scenario ${scenario.id} failed (attempt ${retryCount + 1}):`, error);
                if (retryCount < this.retryCount && scenario.retryOnFailure !== false) {
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                    continue;
                }
                // Final failure
                const errorResult = {
                    scenarioId: scenario.id,
                    status: TestModels_1.TestStatus.FAILED,
                    duration: Date.now() - startTime,
                    error: {
                        type: 'execution_error',
                        message: error instanceof Error ? error.message : String(error),
                        stackTrace: error instanceof Error ? error.stack : undefined
                    },
                    retryCount
                };
                this.emit('scenario:end', scenario, errorResult);
                return errorResult;
            }
        }
        // Should not reach here
        return {
            scenarioId: scenario.id,
            status: TestModels_1.TestStatus.ERROR,
            duration: Date.now() - startTime,
            retryCount
        };
    }
    /**
     * Select appropriate agent for scenario
     */
    selectAgentForScenario(scenario) {
        // Count step types
        const cliSteps = scenario.steps.filter(s => s.action === 'execute' || s.action === 'runCommand').length;
        const uiSteps = scenario.steps.filter(s => ['click', 'type', 'navigate', 'screenshot'].includes(s.action)).length;
        if (uiSteps > cliSteps && this.uiAgent) {
            return this.uiAgent;
        }
        return this.cliAgent;
    }
    /**
     * Process execution results
     */
    processResults(scenarios, results) {
        for (let i = 0; i < scenarios.length; i++) {
            const result = results[i];
            if (result instanceof Error) {
                logger_1.logger.error(`Scenario ${scenarios[i].id} failed with exception:`, result);
                this.recordFailure(scenarios[i], result.message);
            }
            else {
                this.recordResult(result);
                if (this.failFast && result.status === TestModels_1.TestStatus.FAILED) {
                    logger_1.logger.warn('Fail-fast enabled, stopping execution');
                    this.abortController.abort();
                    break;
                }
            }
        }
    }
    /**
     * Record test result
     */
    recordResult(result) {
        this.results.push(result);
        this.session?.results.push(result);
        this.session?.scenariosExecuted.push(result.scenarioId);
        if (result.status === TestModels_1.TestStatus.FAILED && result.error) {
            const failure = {
                scenarioId: result.scenarioId,
                timestamp: new Date(),
                message: result.error.message,
                stackTrace: result.error.stackTrace,
                category: result.error.type || 'execution',
                logs: result.logs
            };
            this.failures.push(failure);
            this.session?.failures.push(failure);
        }
    }
    /**
     * Record a scenario failure
     */
    recordFailure(scenario, errorMsg) {
        const failure = {
            scenarioId: scenario.id,
            timestamp: new Date(),
            message: errorMsg,
            category: 'execution'
        };
        this.failures.push(failure);
        this.session?.failures.push(failure);
    }
    /**
     * Analyze test results and prioritize failures
     */
    async analyzeResults() {
        if (this.failures.length === 0) {
            logger_1.logger.info('No failures to analyze');
            return;
        }
        logger_1.logger.info(`Analyzing ${this.failures.length} failures`);
        // Analyze each failure
        for (const failure of this.failures) {
            const priority = await this.priorityAgent.analyzePriority(failure);
            logger_1.logger.debug(`Failure ${failure.scenarioId} priority: ${priority.priority} (score: ${priority.impactScore})`);
        }
        // Get priority report
        const report = await this.priorityAgent.generatePriorityReport(this.failures, this.results);
        logger_1.logger.info('Priority summary:', {
            critical: report.summary.criticalCount,
            high: report.summary.highCount,
            medium: report.summary.mediumCount,
            low: report.summary.lowCount,
            average: report.summary.averageImpactScore.toFixed(2)
        });
    }
    /**
     * Report failures to GitHub
     */
    async reportFailures() {
        if (this.failures.length === 0) {
            logger_1.logger.info('No failures to report');
            return;
        }
        if (!this.config.github?.createIssues) {
            logger_1.logger.info('Issue creation disabled');
            return;
        }
        logger_1.logger.info(`Reporting ${this.failures.length} failures to GitHub`);
        // Initialize issue reporter
        await this.issueReporter.initialize();
        try {
            // Report failures and get issue numbers
            const issueNumbers = [];
            for (const failure of this.failures) {
                try {
                    const issueNumber = await this.issueReporter.reportFailure(failure);
                    if (issueNumber) {
                        issueNumbers.push(issueNumber);
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Failed to report failure ${failure.scenarioId}:`, error);
                }
            }
            // Track created issues
            this.session?.issuesCreated.push(...issueNumbers);
            logger_1.logger.info(`Created ${issueNumbers.length} GitHub issues`);
        }
        finally {
            await this.issueReporter.cleanup();
        }
    }
    /**
     * Calculate session metrics
     */
    calculateSessionMetrics() {
        if (!this.session)
            return;
        const metrics = this.session.metrics;
        metrics.totalScenarios = this.session.scenariosExecuted.length;
        metrics.passed = this.results.filter(r => r.status === TestModels_1.TestStatus.PASSED).length;
        metrics.failed = this.results.filter(r => r.status === TestModels_1.TestStatus.FAILED).length;
        metrics.skipped = this.results.filter(r => r.status === TestModels_1.TestStatus.SKIPPED).length;
        if (this.session.startTime && this.session.endTime) {
            metrics.duration = this.session.endTime.getTime() - this.session.startTime.getTime();
        }
    }
    /**
     * Save session results to file
     */
    async saveSessionResults() {
        if (!this.session)
            return;
        const outputDir = path.join(process.cwd(), 'outputs', 'sessions');
        await fs.mkdir(outputDir, { recursive: true });
        const timestamp = this.session.startTime.toISOString().replace(/[:.]/g, '-');
        const filename = `session_${this.session.id}_${timestamp}.json`;
        const filepath = path.join(outputDir, filename);
        const sessionData = {
            ...this.session,
            results: this.results
        };
        await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2));
        logger_1.logger.info(`Session results saved to ${filepath}`);
    }
    /**
     * Abort the current test session
     */
    abort() {
        logger_1.logger.warn('Aborting test session');
        this.abortController.abort();
    }
    /**
     * Get current session
     */
    getSession() {
        return this.session;
    }
    /**
     * Get test results
     */
    getResults() {
        return this.results;
    }
    /**
     * Get test failures
     */
    getFailures() {
        return this.failures;
    }
}
exports.TestOrchestrator = TestOrchestrator;
/**
 * Create a test orchestrator instance
 */
function createTestOrchestrator(config) {
    return new TestOrchestrator(config);
}
//# sourceMappingURL=TestOrchestrator.js.map