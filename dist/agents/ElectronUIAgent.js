"use strict";
/**
 * ElectronUIAgent - Thin facade delegating to focused electron sub-modules.
 *
 * Coordinates ElectronLauncher, ElectronPageInteractor,
 * ElectronPerformanceMonitor, and ElectronWebSocketMonitor.
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 * Uses shared sanitizeConfigWithEnv() (issue #118) instead of a private copy.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElectronUIAgent = void 0;
exports.createElectronUIAgent = createElectronUIAgent;
const index_1 = require("./index");
const screenshot_1 = require("../utils/screenshot");
const logger_1 = require("../utils/logger");
const agentUtils_1 = require("../utils/agentUtils");
const BaseAgent_1 = require("./BaseAgent");
const electron_1 = require("./electron");
/** Comprehensive Electron UI testing agent — facade over focused sub-modules. */
class ElectronUIAgent extends BaseAgent_1.BaseAgent {
    constructor(config) {
        super();
        this.name = 'ElectronUIAgent';
        this.type = index_1.AgentType.UI;
        this.config = { ...electron_1.DEFAULT_CONFIG, ...config };
        this.logger = (0, logger_1.createLogger)({ level: logger_1.LogLevel.DEBUG, logDir: './logs/electron-agent' });
        const screenshotManager = (0, screenshot_1.createScreenshotManager)({
            baseDir: this.config.screenshotConfig.directory,
            strategy: 'by-scenario'
        });
        this.launcher = new electron_1.ElectronLauncher(this.config, this.logger);
        this.interactor = new electron_1.ElectronPageInteractor(this.config, this.logger, screenshotManager);
        this.perfMonitor = new electron_1.ElectronPerformanceMonitor(this.config, this.logger);
        this.wsMonitor = new electron_1.ElectronWebSocketMonitor(this.config, this.logger, this);
        this.on('error', (err) => this.logger.error('ElectronUIAgent error', { error: err.message }));
    }
    async initialize() {
        this.logger.info('Initializing ElectronUIAgent', { config: this.sanitizeConfig() });
        try {
            await this.launcher.validateExecutablePath();
            this.isInitialized = true;
            this.logger.info('ElectronUIAgent initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            throw new electron_1.TestError({
                type: 'InitializationError',
                message: `Failed to initialize ElectronUIAgent: ${error instanceof Error ? error.message : String(error)}`,
                ...(error instanceof Error && error.stack !== undefined ? { stackTrace: error.stack } : {}),
                timestamp: new Date(),
                context: { config: this.sanitizeConfig() }
            });
        }
    }
    // -- BaseAgent template-method hooks --
    onBeforeExecute(scenario) {
        this.currentScenarioId = scenario.id;
        this.logger.setContext({ scenarioId: scenario.id, component: 'ElectronUIAgent' });
        this.logger.scenarioStart(scenario.id, scenario.name);
    }
    buildResult(ctx) {
        return {
            ...ctx,
            screenshots: this.interactor.getScenarioScreenshots(this.currentScenarioId),
            logs: this.getScenarioLogs(),
            performanceSamples: [...this.perfMonitor.samples],
            websocketEvents: [...this.wsMonitor.events],
            stateSnapshots: [...this.interactor.stateSnapshots],
        };
    }
    async onAfterExecute(scenario, status) {
        this.logger.scenarioEnd(scenario.id, status, 0 /* duration tracked inside BaseAgent */);
        this.currentScenarioId = undefined;
        // When configured for single-scenario mode, close browser and WebSocket
        // after each execution so resources are not leaked by callers that do not
        // use ScenarioRouter's finally block.
        if (this.config.closeAfterEachScenario) {
            try {
                this.perfMonitor.stop();
                await this.wsMonitor.disconnect();
                await this.launcher.close();
                this.logger.info('ElectronUIAgent: closed resources after scenario', { scenarioId: scenario.id });
            }
            catch (error) {
                this.logger.error('ElectronUIAgent: error closing resources after scenario', {
                    scenarioId: scenario.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    async launch() {
        const page = await this.launcher.launch();
        if (this.config.websocketConfig)
            await this.wsMonitor.connect();
        if (this.config.performanceConfig?.enabled)
            this.perfMonitor.start(page);
        this.emit('launched');
    }
    async close() {
        this.perfMonitor.stop();
        this.wsMonitor.disconnect();
        await this.launcher.close();
        this.emit('closed');
    }
    async cleanup() {
        this.logger.info('Cleaning up ElectronUIAgent resources');
        try {
            this.perfMonitor.stop();
            this.wsMonitor.disconnect();
            await this.launcher.forceClose();
            await this.launcher.exportFinalData({
                performanceSamples: this.perfMonitor.samples,
                websocketEvents: this.wsMonitor.events,
                stateSnapshots: this.interactor.stateSnapshots,
                exportScreenshots: () => this.interactor.exportScreenshots(`./logs/electron-agent-exports/screenshots_${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
            });
            this.logger.info('ElectronUIAgent cleanup completed');
            this.emit('cleanup');
        }
        catch (error) {
            this.logger.error('Error during cleanup', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async screenshot(name) {
        if (!this.launcher.page)
            throw new Error('Application not launched');
        return this.interactor.screenshot(this.launcher.page, name, this.currentScenarioId);
    }
    async clickTab(tabName) {
        if (!this.launcher.page)
            throw new Error('Application not launched');
        return this.interactor.clickTab(this.launcher.page, tabName);
    }
    async fillInput(selector, value) {
        if (!this.launcher.page)
            throw new Error('Application not launched');
        return this.interactor.fillInput(this.launcher.page, selector, value);
    }
    async clickButton(selector) {
        if (!this.launcher.page)
            throw new Error('Application not launched');
        return this.interactor.clickButton(this.launcher.page, selector);
    }
    async waitForElement(selector, options) {
        if (!this.launcher.page)
            throw new Error('Application not launched');
        return this.interactor.waitForElement(this.launcher.page, selector, options);
    }
    async getElementText(selector) {
        if (!this.launcher.page)
            throw new Error('Application not launched');
        return this.interactor.getElementText(this.launcher.page, selector);
    }
    async captureState() {
        if (!this.launcher.page)
            throw new Error('Application not launched');
        return this.interactor.captureState(this.launcher.page, this.currentScenarioId, {
            getProcessInfo: () => this.launcher.getProcessInfo(),
            getLatestPerformanceMetrics: () => this.perfMonitor.getLatestMetrics(),
            getNetworkState: () => this.perfMonitor.getNetworkState(),
            counters: {
                consoleMessages: this.launcher.consoleMessages.length,
                websocketEvents: this.wsMonitor.events.length,
                performanceSamples: this.perfMonitor.samples.length
            }
        });
    }
    async executeStep(step, stepIndex) {
        if (!this.launcher.page)
            throw new Error('Application not launched');
        return this.interactor.executeStep(this.launcher.page, step, stepIndex, this.currentScenarioId, this.config.defaultTimeout, { onLaunch: () => this.launch(), onClose: () => this.close() });
    }
    sanitizeConfig() {
        return (0, agentUtils_1.sanitizeConfigWithEnv)(this.config, 'env');
    }
    getScenarioLogs() {
        return this.launcher.consoleMessages
            .filter(msg => msg.type() === 'error' || msg.type() === 'warning')
            .map(msg => `[${msg.type()}] ${msg.text()}`);
    }
}
exports.ElectronUIAgent = ElectronUIAgent;
/** Factory function to create an ElectronUIAgent instance */
function createElectronUIAgent(config) {
    return new ElectronUIAgent(config);
}
//# sourceMappingURL=ElectronUIAgent.js.map