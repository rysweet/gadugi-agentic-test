"use strict";
/**
 * Winston-based logging system for the Agentic Testing System
 * Provides configurable logging with different levels, formats, and outputs
 *
 * This file re-exports types from logging/ sub-modules and provides the
 * TestLogger class plus the singleton convenience object.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.TestLogger = exports.LogLevel = void 0;
exports.createLogger = createLogger;
exports.setupLogger = setupLogger;
const winston_1 = __importDefault(require("winston"));
const LogTransport_1 = require("./logging/LogTransport");
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return LogTransport_1.LogLevel; } });
/**
 * Enhanced Winston logger with testing-specific features
 */
class TestLogger {
    constructor(config = {}) {
        this.context = {};
        this.config = { ...LogTransport_1.DEFAULT_LOGGER_CONFIG, ...config };
        this.logger = this.createLogger();
    }
    createLogger() {
        const transports = (0, LogTransport_1.buildTransports)(this.config, () => this.context);
        return winston_1.default.createLogger({
            level: this.config.level,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: this.config.includeStackTrace }), winston_1.default.format.json()),
            defaultMeta: { service: 'agentic-testing' },
            transports
        });
    }
    setContext(context) {
        this.context = { ...this.context, ...context };
    }
    clearContext() {
        this.context = {};
    }
    getContext() {
        return { ...this.context };
    }
    /**
     * Log an error message
     */
    error(message, meta) {
        this.logger.error(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta : { meta }) });
    }
    /**
     * Log a warning message
     */
    warn(message, meta) {
        this.logger.warn(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta : { meta }) });
    }
    /**
     * Log an info message
     */
    info(message, meta) {
        this.logger.info(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta : { meta }) });
    }
    /**
     * Log an HTTP message
     */
    http(message, meta) {
        this.logger.http(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta : { meta }) });
    }
    /**
     * Log a debug message
     */
    debug(message, meta) {
        this.logger.debug(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta : { meta }) });
    }
    scenarioStart(scenarioId, scenarioName) {
        this.setContext({ scenarioId });
        this.info(`Starting test scenario: ${scenarioName}`, {
            event: 'scenario_start',
            scenarioId,
            scenarioName
        });
    }
    scenarioEnd(scenarioId, status, duration) {
        this.info(`Test scenario completed: ${status}`, {
            event: 'scenario_end',
            scenarioId,
            status,
            duration
        });
        this.clearContext();
    }
    stepExecution(stepIndex, action, target) {
        this.debug(`Executing step ${stepIndex + 1}: ${action}`, {
            event: 'step_execution',
            stepIndex,
            action,
            target
        });
    }
    stepComplete(stepIndex, status, duration) {
        this.debug(`Step ${stepIndex + 1} completed: ${status}`, {
            event: 'step_complete',
            stepIndex,
            status,
            duration
        });
    }
    /**
     * Log performance metrics
     */
    performance(operation, duration, metadata) {
        this.info(`Performance: ${operation} took ${duration}ms`, {
            event: 'performance',
            operation,
            duration,
            ...metadata
        });
    }
    screenshot(filename, stepIndex) {
        this.debug(`Screenshot captured: ${filename}`, {
            event: 'screenshot',
            filename,
            stepIndex
        });
    }
    commandExecution(command, workingDir) {
        this.debug(`Executing command: ${command}`, {
            event: 'command_execution',
            command,
            workingDir
        });
    }
    commandComplete(command, exitCode, duration) {
        const level = exitCode === 0 ? 'info' : 'warn';
        this.logger[level](`Command completed with exit code ${exitCode}`, {
            event: 'command_complete',
            command,
            exitCode,
            duration
        });
    }
    child(context) {
        const childLogger = new TestLogger(this.config);
        childLogger.setContext({ ...this.context, ...context });
        return childLogger;
    }
    setLevel(level) {
        this.config.level = level;
        this.logger.level = level;
        this.logger.transports.forEach(transport => {
            transport.level = level;
        });
    }
    getLevel() {
        return this.config.level;
    }
    async flush() {
        return new Promise((resolve) => {
            let pendingTransports = this.logger.transports.length;
            if (pendingTransports === 0) {
                resolve();
                return;
            }
            this.logger.transports.forEach((transport) => {
                if ('close' in transport && typeof transport.close === 'function') {
                    transport.close();
                }
                pendingTransports--;
                if (pendingTransports === 0) {
                    resolve();
                }
            });
        });
    }
    async close() {
        await this.flush();
        this.logger.close();
    }
}
exports.TestLogger = TestLogger;
/**
 * Create a logger instance with the specified configuration
 */
function createLogger(config) {
    return new TestLogger(config);
}
/**
 * Mutable active logger swapped by setupLogger() without mutating any instance.
 */
let _activeLogger = new TestLogger();
/**
 * Convenience methods that always delegate to the current active logger.
 */
exports.logger = {
    error: (message, meta) => _activeLogger.error(message, meta),
    warn: (message, meta) => _activeLogger.warn(message, meta),
    info: (message, meta) => _activeLogger.info(message, meta),
    debug: (message, meta) => _activeLogger.debug(message, meta),
    setContext: (context) => _activeLogger.setContext(context),
    clearContext: () => _activeLogger.clearContext(),
    setLevel: (level) => _activeLogger.setLevel(level),
    child: (context) => _activeLogger.child(context)
};
/**
 * Reconfigure the active logger. Replaces the logger instance rather than mutating it.
 */
function setupLogger(config) {
    _activeLogger = createLogger(config);
    return _activeLogger;
}
//# sourceMappingURL=logger.js.map