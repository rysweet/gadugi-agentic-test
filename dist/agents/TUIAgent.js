"use strict";
/**
 * TUIAgent - Thin facade composing TUI testing sub-modules
 *
 * Delegates all operations to:
 * - TUISessionManager    : session lifecycle (spawn, kill, cleanup)
 * - TUIInputSimulator    : keyboard input simulation
 * - TUIMenuNavigator     : interactive menu navigation
 * - TUIOutputParser      : ANSI parsing, color extraction, validation
 * - TUIStepDispatcher    : test step action routing
 *
 * Public API is identical to the original monolithic TUIAgent — all
 * existing imports and tests continue to work without modification.
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 * Uses shared validateDirectory() (issue #118) instead of a private copy.
 * Uses shared sanitizeConfigWithEnv() (issue #118) instead of a private copy.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TUIAgent = void 0;
exports.createTUIAgent = createTUIAgent;
const pidusage_1 = __importDefault(require("pidusage"));
const index_1 = require("./index");
const logger_1 = require("../utils/logger");
const fileUtils_1 = require("../utils/fileUtils");
const agentUtils_1 = require("../utils/agentUtils");
const tui_1 = require("./tui");
const types_1 = require("./tui/types");
const BaseAgent_1 = require("./BaseAgent");
/** Comprehensive TUI testing agent (thin facade) */
class TUIAgent extends BaseAgent_1.BaseAgent {
    constructor(config = {}) {
        super();
        this.name = 'TUIAgent';
        this.type = index_1.AgentType.TUI;
        this.performanceMetricsHistory = [];
        this.config = { ...types_1.DEFAULT_CONFIG, ...config };
        this.logger = (0, logger_1.createLogger)({ level: this.config.logConfig.logLevel, logDir: './logs/tui-agent' });
        this.sessionManager = new tui_1.TUISessionManager(this.config, this.logger, this);
        this.inputSimulator = new tui_1.TUIInputSimulator(this.config, this.logger);
        this.menuNavigator = new tui_1.TUIMenuNavigator(this.logger);
        // Store the handler reference so it can be removed in cleanup()
        this.errorHandler = (error) => this.logger.error('TUIAgent error', { error: error.message });
        this.on('error', this.errorHandler);
    }
    async initialize() {
        this.logger.info('Initializing TUIAgent', { config: this.sanitizeConfig() });
        try {
            await (0, fileUtils_1.validateDirectory)(this.config.workingDirectory);
            this.setupPlatformConfig();
            if (this.config.performance.enabled)
                this.startPerformanceMonitoring();
            this.isInitialized = true;
            this.logger.info('TUIAgent initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to initialize TUIAgent', { error: message });
            // Re-throw the original error so callers can match its message directly
            // (e.g. tests checking for "Working directory does not exist").
            throw error instanceof Error ? error : new Error(message);
        }
    }
    // -- BaseAgent template-method hooks --
    applyEnvironment(scenario) {
        this.logger.setContext({ scenarioId: scenario.id, component: 'TUIAgent' });
        this.logger.scenarioStart(scenario.id, scenario.name);
        if (scenario.environment) {
            for (const [name, value] of Object.entries(scenario.environment)) {
                // Update local config only — do NOT mutate process.env as it contaminates
                // all subsequent tests and other agents running in the same process.
                this.config.environment[name] = value;
            }
        }
    }
    buildResult(ctx) {
        return {
            ...ctx,
            logs: this.getScenarioLogs(),
            sessions: this.sessionManager.getSessionInfo(),
            performanceMetrics: this.getPerformanceMetrics(),
        };
    }
    async onAfterExecute(scenario, status) {
        await this.sessionManager.cleanupSessions();
        this.logger.scenarioEnd(scenario.id, status, 0 /* duration tracked inside BaseAgent */);
    }
    // -- Public TUI-specific API --
    async spawnTUI(command, args = [], options = {}) {
        return this.sessionManager.createSession(command, args, options);
    }
    async sendInput(sessionId, input) {
        const session = this.sessionManager.getSession(sessionId);
        if (!session || session.status !== 'running') {
            throw new Error(`Session not found or not running: ${sessionId}`);
        }
        await this.inputSimulator.sendInput(session.process.stdin, sessionId, input, () => (0, tui_1.getLatestOutput)(session.outputBuffer), () => session.outputBuffer.length, (sid, inputData) => this.emit('inputSent', { sessionId: sid, input: inputData }));
    }
    async navigateMenu(sessionId, path) {
        const session = this.sessionManager.getSession(sessionId);
        if (!session || session.status !== 'running') {
            throw new Error(`Session not found or not running: ${sessionId}`);
        }
        return this.menuNavigator.navigateMenu(sessionId, path, {
            sendInput: (sid, input) => this.sendInput(sid, input),
            waitForStabilization: (sid) => this.waitForOutputStabilization(sid),
            getLatestOutput: (sid) => {
                const s = this.sessionManager.getSession(sid);
                return s ? (0, tui_1.getLatestOutput)(s.outputBuffer) : null;
            },
            getKeyMapping: (key) => this.inputSimulator.getKeyMapping(key),
            emit: (event, ...args) => this.emit(event, ...args)
        });
    }
    captureOutput(sessionId) {
        const session = this.sessionManager.getSession(sessionId);
        return session ? (0, tui_1.getLatestOutput)(session.outputBuffer) : null;
    }
    getAllOutput(sessionId) {
        const session = this.sessionManager.getSession(sessionId);
        return session ? [...session.outputBuffer] : [];
    }
    async validateOutput(sessionId, expected) {
        const session = this.sessionManager.getSession(sessionId);
        if (!session)
            return false;
        const output = (0, tui_1.getLatestOutput)(session.outputBuffer);
        return output ? (0, tui_1.performOutputValidation)(output, expected, session.outputBuffer) : false;
    }
    async validateFormatting(sessionId, expectedColors) {
        const session = this.sessionManager.getSession(sessionId);
        if (!session)
            return false;
        const output = (0, tui_1.getLatestOutput)(session.outputBuffer);
        if (!output || !output.colors)
            return false;
        try {
            for (const expectedColor of expectedColors) {
                const found = output.colors.find(color => color.text === expectedColor.text && color.fg === expectedColor.fg &&
                    color.bg === expectedColor.bg && (0, tui_1.arraysEqual)(color.styles, expectedColor.styles));
                if (!found) {
                    this.logger.debug('Expected color not found', { expectedColor, availableColors: output.colors });
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            this.logger.error('Color validation failed', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    async killSession(sessionId) {
        return this.sessionManager.destroySession(sessionId);
    }
    async cleanup() {
        this.logger.info('Cleaning up TUIAgent resources');
        try {
            if (this.performanceMonitor) {
                clearInterval(this.performanceMonitor);
                this.performanceMonitor = undefined;
            }
            await this.sessionManager.cleanupSessions();
            this.menuNavigator.resetContext();
            // Remove the error handler registered in the constructor to prevent
            // dangling listener references after cleanup.
            this.removeListener('error', this.errorHandler);
            this.logger.info('TUIAgent cleanup completed');
            this.emit('cleanup');
        }
        catch (error) {
            this.logger.error('Error during cleanup', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async executeStep(step, stepIndex) {
        return (0, tui_1.dispatchStep)(step, stepIndex, {
            spawnTUI: (cmd, args) => this.spawnTUI(cmd, args),
            sendInput: (sid, input) => this.sendInput(sid, input),
            navigateMenu: (sid, path) => this.navigateMenu(sid, path),
            validateOutput: (sid, expected) => this.validateOutput(sid, expected),
            validateFormatting: (sid, colors) => this.validateFormatting(sid, colors),
            captureOutput: (sid) => this.captureOutput(sid),
            waitForOutputPattern: (sid, pat, timeout) => this.waitForOutputPattern(sid, pat, timeout),
            resizeTerminal: (sid, cols, rows) => {
                const session = this.sessionManager.getSession(sid);
                if (session) {
                    session.size = { cols, rows };
                    this.logger.debug('Terminal resized', { sessionId: sid, cols, rows });
                }
            },
            killSession: (sid) => this.killSession(sid),
            getMostRecentSessionId: () => this.sessionManager.getMostRecentSessionId(),
            defaultTimeout: this.config.defaultTimeout,
        }, this.logger);
    }
    // -- Private helpers --
    setupPlatformConfig() {
        const platform = process.platform;
        this.config.environment.TERM = platform === 'win32' ? 'cmd' : this.config.terminalType;
        this.logger.debug(`Platform configuration set for ${platform}`);
    }
    startPerformanceMonitoring() {
        this.performanceMonitor = setInterval(() => {
            this.collectPerformanceMetrics().catch((err) => {
                this.logger.warn('Failed to collect performance metrics', { error: err?.message });
            });
        }, this.config.performance.sampleRate);
    }
    async collectPerformanceMetrics() {
        const stats = await (0, pidusage_1.default)(process.pid);
        const metric = {
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
            cpuUsage: stats.cpu,
            responseTime: 0,
            renderTime: 0,
        };
        this.performanceMetricsHistory.push(metric);
        if (this.performanceMetricsHistory.length > 100) {
            this.performanceMetricsHistory.shift();
        }
        this.emit('performanceMetrics', {
            ...metric,
            timestamp: new Date(),
            activeSessions: this.sessionManager.getAllSessions().size,
        });
    }
    getPerformanceMetrics() {
        return [...this.performanceMetricsHistory];
    }
    getScenarioLogs() {
        const logs = [];
        for (const session of this.sessionManager.getAllSessions().values()) {
            for (const output of session.outputBuffer) {
                logs.push(`[${session.id}:${output.type.toUpperCase()}] ${output.text.trim()}`);
            }
        }
        return logs.filter(log => log.length > 0);
    }
    sanitizeConfig() {
        return (0, agentUtils_1.sanitizeConfigWithEnv)(this.config, 'environment');
    }
    async waitForOutputStabilization(sessionId) {
        const session = this.sessionManager.getSession(sessionId);
        if (!session)
            throw new Error(`Session not found: ${sessionId}`);
        await this.inputSimulator.waitForStabilization(() => session.outputBuffer.length);
    }
    async waitForOutputPattern(sessionId, pattern, timeout) {
        const session = this.sessionManager.getSession(sessionId);
        if (!session)
            throw new Error(`Session not found: ${sessionId}`);
        await this.inputSimulator.waitForPattern(() => (0, tui_1.getLatestOutput)(session.outputBuffer), pattern, timeout);
    }
}
exports.TUIAgent = TUIAgent;
/** Factory function to create a TUIAgent */
function createTUIAgent(config) {
    return new TUIAgent(config);
}
//# sourceMappingURL=TUIAgent.js.map