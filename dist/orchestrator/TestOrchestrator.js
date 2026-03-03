"use strict";
/**
 * TestOrchestrator
 *
 * Thin orchestration facade. Delegates to:
 *   - ScenarioRouter  : dispatch scenarios to agents (via IAgent registry)
 *   - SessionManager  : session lifecycle and persistence
 *   - ResultAggregator: collect results, analyze, report
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
const TestModels_1 = require("../models/TestModels");
const ElectronUIAgent_1 = require("../agents/ElectronUIAgent");
const CLIAgent_1 = require("../agents/CLIAgent");
const TUIAgent_1 = require("../agents/TUIAgent");
const APIAgent_1 = require("../agents/APIAgent");
const IssueReporter_1 = require("../agents/IssueReporter");
const PriorityAgent_1 = require("../agents/PriorityAgent");
const logger_1 = require("../utils/logger");
const scenarios_1 = require("../scenarios");
const scenarioAdapter_1 = require("../adapters/scenarioAdapter");
const ScenarioLoader_1 = require("../lib/ScenarioLoader");
const ScenarioRouter_1 = require("./ScenarioRouter");
const SessionManager_1 = require("./SessionManager");
const ResultAggregator_1 = require("./ResultAggregator");
const agentAdapters_1 = require("./agentAdapters");
class TestOrchestrator extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.failures = [];
        this.config = config;
        this.abortController = new AbortController();
        const cliAgent = new CLIAgent_1.CLIAgent(config.cli);
        const tuiAgent = new TUIAgent_1.TUIAgent((0, agentAdapters_1.adaptTUIConfig)(config.tui));
        const uiAgent = config.ui?.browser
            ? new ElectronUIAgent_1.ElectronUIAgent((0, agentAdapters_1.adaptUIConfig)(config.ui))
            : null;
        const apiAgent = new APIAgent_1.APIAgent(config.api ?? {});
        this.issueReporter = new IssueReporter_1.IssueReporter(config.github || {
            token: '', owner: '', repository: '', baseBranch: 'main',
            createIssuesOnFailure: false, issueLabels: [],
            issueTitleTemplate: '', issueBodyTemplate: '',
            createPullRequestsForFixes: false, autoAssignUsers: []
        });
        const priorityAgent = new PriorityAgent_1.PriorityAgent((0, agentAdapters_1.adaptPriorityConfig)(config.priority));
        this.sessionManager = new SessionManager_1.SessionManager(config);
        this.aggregator = new ResultAggregator_1.ResultAggregator({
            priorityAgent,
            issueReporter: this.issueReporter,
            createIssues: config.github?.createIssuesOnFailure ?? false
        });
        /**
         * Agent registry: maps each TestInterface value to the IAgent that handles
         * it. Adding a new interface type (e.g. WEBSOCKET) only requires adding an
         * entry here — ScenarioRouter needs no changes.
         *
         * GUI falls back to cliAgent when no Electron agent is configured so that
         * scenarios are never silently swallowed.
         */
        const agentRegistry = {
            [TestModels_1.TestInterface.CLI]: cliAgent,
            [TestModels_1.TestInterface.TUI]: tuiAgent,
            [TestModels_1.TestInterface.GUI]: uiAgent ?? cliAgent,
            [TestModels_1.TestInterface.API]: apiAgent,
            [TestModels_1.TestInterface.MIXED]: cliAgent,
        };
        this.router = new ScenarioRouter_1.ScenarioRouter({
            agentRegistry,
            maxParallel: config.execution?.maxParallel || 3,
            failFast: config.execution?.continueOnFailure === false,
            retryCount: config.execution?.maxRetries || 2,
            abortController: this.abortController
        });
        this.router.onResult = (result) => {
            this.aggregator.record(result);
            this.sessionManager.addResult(result);
            this.emit('scenario:end', { id: result.scenarioId }, result);
        };
        this.router.onFailure = (scenarioId, message) => {
            this.aggregator.recordFailure(scenarioId, message);
        };
        this.on('error', (e) => logger_1.logger.error('Orchestrator error:', e));
    }
    /**
     * Run with pre-loaded scenarios (used by programmatic API)
     */
    async runWithScenarios(suite, loadedScenarios) {
        logger_1.logger.info(`Starting test session with suite: ${suite}`);
        const session = this.sessionManager.create();
        this.emit('session:start', session);
        try {
            const orchestratorScenarios = loadedScenarios.map(scenarioAdapter_1.adaptScenarioToComplex);
            const filtered = (0, ScenarioLoader_1.filterScenariosForSuite)(orchestratorScenarios, suite);
            logger_1.logger.info(`Selected ${filtered.length} scenarios for suite '${suite}'`);
            this.emit('phase:start', 'execution');
            await this.router.route(filtered);
            this.emit('phase:end', 'execution');
            this.emit('phase:start', 'analysis');
            await this.aggregator.analyze();
            this.emit('phase:end', 'analysis');
            this.emit('phase:start', 'reporting');
            await this.aggregator.report();
            await this.reportFailures();
            this.emit('phase:end', 'reporting');
        }
        catch (error) {
            logger_1.logger.error('Test session failed:', error);
            this.emit('error', error);
            throw error;
        }
        finally {
            const completed = await this.sessionManager.complete();
            this.emit('session:end', completed);
        }
        logger_1.logger.info(`Test session completed: ${this.sessionManager.getSession()?.id}`);
        return this.sessionManager.getSession();
    }
    /**
     * Run a complete testing session
     */
    async run(suite = 'smoke', scenarioFiles) {
        logger_1.logger.info(`Starting test session with suite: ${suite}`);
        const session = this.sessionManager.create();
        this.emit('session:start', session);
        try {
            this.emit('phase:start', 'discovery');
            const scenarios = await this.loadScenarios(scenarioFiles);
            const filtered = (0, ScenarioLoader_1.filterScenariosForSuite)(scenarios, suite);
            logger_1.logger.info(`Selected ${filtered.length} scenarios for suite '${suite}'`);
            this.emit('phase:end', 'discovery');
            this.emit('phase:start', 'execution');
            await this.router.route(filtered);
            this.emit('phase:end', 'execution');
            this.emit('phase:start', 'analysis');
            await this.aggregator.analyze();
            this.emit('phase:end', 'analysis');
            this.emit('phase:start', 'reporting');
            await this.aggregator.report();
            await this.reportFailures();
            this.emit('phase:end', 'reporting');
        }
        catch (error) {
            logger_1.logger.error('Test session failed:', error);
            this.emit('error', error);
            throw error;
        }
        finally {
            const completed = await this.sessionManager.complete();
            this.emit('session:end', completed);
        }
        logger_1.logger.info(`Test session completed: ${this.sessionManager.getSession()?.id}`);
        return this.sessionManager.getSession();
    }
    abort() {
        logger_1.logger.warn('Aborting test session');
        this.abortController.abort();
    }
    getSession() {
        return this.sessionManager.getSession();
    }
    getResults() {
        return this.aggregator.getResults();
    }
    getFailures() {
        return this.aggregator.getFailures();
    }
    // ---- Private helpers ----
    /**
     * Report failures to GitHub via IssueReporter.
     *
     * Best-effort: individual createIssue failures are logged but do not abort
     * subsequent reports. Cleanup is always called.
     */
    async reportFailures() {
        if (this.failures.length === 0) {
            return;
        }
        const createIssues = this.config.github?.createIssuesOnFailure ?? false;
        if (!createIssues) {
            return;
        }
        try {
            await this.issueReporter.initialize();
        }
        catch (error) {
            logger_1.logger.error('IssueReporter.initialize failed; aborting issue creation:', error);
            try {
                await this.issueReporter.cleanup();
            }
            catch { /* best-effort */ }
            return;
        }
        try {
            for (const failure of this.failures) {
                try {
                    await this.issueReporter.createIssue(failure);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to create issue for failure ${failure.scenarioId}:`, error);
                }
            }
        }
        finally {
            await this.issueReporter.cleanup();
        }
    }
    async loadScenarios(scenarioFiles) {
        const scenarios = [];
        const scenarioDir = path.join(process.cwd(), 'scenarios');
        if (scenarioFiles && scenarioFiles.length > 0) {
            for (const file of scenarioFiles) {
                try {
                    scenarios.push((0, scenarioAdapter_1.adaptScenarioToComplex)(await scenarios_1.ScenarioLoader.loadFromFile(file)));
                }
                catch (error) {
                    logger_1.logger.error(`Failed to load scenarios from ${file}:`, error);
                }
            }
        }
        else {
            try {
                const files = await fs.readdir(scenarioDir);
                for (const file of files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))) {
                    scenarios.push((0, scenarioAdapter_1.adaptScenarioToComplex)(await scenarios_1.ScenarioLoader.loadFromFile(path.join(scenarioDir, file))));
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to load scenarios from directory:', error);
            }
        }
        logger_1.logger.info(`Loaded ${scenarios.length} total test scenarios`);
        return scenarios;
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