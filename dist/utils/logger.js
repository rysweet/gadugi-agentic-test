"use strict";
/**
 * Winston-based logging system for the Agentic Testing System
 * Provides configurable logging with different levels, formats, and outputs
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.defaultLogger = exports.TestLogger = exports.LogLevel = void 0;
exports.createLogger = createLogger;
exports.setupLogger = setupLogger;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * Log levels enumeration
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["HTTP"] = "http";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Default logger configuration
 */
const DEFAULT_CONFIG = {
    level: LogLevel.INFO,
    logDir: './logs',
    enableConsole: true,
    enableFile: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    compress: true,
    includeTimestamp: true,
    includeStackTrace: true
};
/**
 * Enhanced Winston logger with testing-specific features
 */
class TestLogger {
    constructor(config = {}) {
        this.context = {};
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = this.createLogger();
    }
    /**
     * Create the Winston logger instance with configured transports
     */
    createLogger() {
        // Ensure log directory exists
        if (this.config.enableFile && !fs_1.default.existsSync(this.config.logDir)) {
            fs_1.default.mkdirSync(this.config.logDir, { recursive: true });
        }
        const transports = [];
        // Console transport
        if (this.config.enableConsole) {
            transports.push(new winston_1.default.transports.Console({
                level: this.config.level,
                format: winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
                    let output = `${timestamp} [${level}]`;
                    // Add context information
                    if (this.context.scenarioId) {
                        output += ` [${this.context.scenarioId}]`;
                    }
                    if (this.context.component) {
                        output += ` [${this.context.component}]`;
                    }
                    output += `: ${message}`;
                    // Add metadata if present
                    if (Object.keys(meta).length > 0) {
                        output += ` ${JSON.stringify(meta)}`;
                    }
                    return output;
                }))
            }));
        }
        // File transports
        if (this.config.enableFile) {
            // Combined log file
            transports.push(new winston_1.default.transports.File({
                filename: path_1.default.join(this.config.logDir, 'combined.log'),
                level: this.config.level,
                maxsize: this.config.maxFileSize,
                maxFiles: this.config.maxFiles,
                format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: this.config.includeStackTrace }), winston_1.default.format.json())
            }));
            // Error-only log file
            transports.push(new winston_1.default.transports.File({
                filename: path_1.default.join(this.config.logDir, 'error.log'),
                level: LogLevel.ERROR,
                maxsize: this.config.maxFileSize,
                maxFiles: this.config.maxFiles,
                format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json())
            }));
            // Test-specific log file
            transports.push(new winston_1.default.transports.File({
                filename: path_1.default.join(this.config.logDir, 'test-execution.log'),
                level: this.config.level,
                maxsize: this.config.maxFileSize,
                maxFiles: this.config.maxFiles,
                format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: this.config.includeStackTrace }), winston_1.default.format.json())
            }));
        }
        return winston_1.default.createLogger({
            level: this.config.level,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: this.config.includeStackTrace }), winston_1.default.format.json()),
            defaultMeta: { service: 'agentic-testing' },
            transports
        });
    }
    /**
     * Set the logging context for structured logging
     */
    setContext(context) {
        this.context = { ...this.context, ...context };
    }
    /**
     * Clear the current logging context
     */
    clearContext() {
        this.context = {};
    }
    /**
     * Get the current logging context
     */
    getContext() {
        return { ...this.context };
    }
    /**
     * Log an error message
     */
    error(message, meta) {
        this.logger.error(message, { ...this.context, ...meta });
    }
    /**
     * Log a warning message
     */
    warn(message, meta) {
        this.logger.warn(message, { ...this.context, ...meta });
    }
    /**
     * Log an info message
     */
    info(message, meta) {
        this.logger.info(message, { ...this.context, ...meta });
    }
    /**
     * Log an HTTP message
     */
    http(message, meta) {
        this.logger.http(message, { ...this.context, ...meta });
    }
    /**
     * Log a debug message
     */
    debug(message, meta) {
        this.logger.debug(message, { ...this.context, ...meta });
    }
    /**
     * Log test scenario start
     */
    scenarioStart(scenarioId, scenarioName) {
        this.setContext({ scenarioId });
        this.info(`Starting test scenario: ${scenarioName}`, {
            event: 'scenario_start',
            scenarioId,
            scenarioName
        });
    }
    /**
     * Log test scenario completion
     */
    scenarioEnd(scenarioId, status, duration) {
        this.info(`Test scenario completed: ${status}`, {
            event: 'scenario_end',
            scenarioId,
            status,
            duration
        });
        this.clearContext();
    }
    /**
     * Log test step execution
     */
    stepExecution(stepIndex, action, target) {
        this.debug(`Executing step ${stepIndex + 1}: ${action}`, {
            event: 'step_execution',
            stepIndex,
            action,
            target
        });
    }
    /**
     * Log test step completion
     */
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
    /**
     * Log screenshot capture
     */
    screenshot(filename, stepIndex) {
        this.debug(`Screenshot captured: ${filename}`, {
            event: 'screenshot',
            filename,
            stepIndex
        });
    }
    /**
     * Log command execution
     */
    commandExecution(command, workingDir) {
        this.debug(`Executing command: ${command}`, {
            event: 'command_execution',
            command,
            workingDir
        });
    }
    /**
     * Log command completion
     */
    commandComplete(command, exitCode, duration) {
        const level = exitCode === 0 ? 'info' : 'warn';
        this.logger[level](`Command completed with exit code ${exitCode}`, {
            event: 'command_complete',
            command,
            exitCode,
            duration
        });
    }
    /**
     * Create a child logger with additional context
     */
    child(context) {
        const childLogger = new TestLogger(this.config);
        childLogger.setContext({ ...this.context, ...context });
        return childLogger;
    }
    /**
     * Change the log level at runtime
     */
    setLevel(level) {
        this.config.level = level;
        this.logger.level = level;
        // Update all transports
        this.logger.transports.forEach(transport => {
            transport.level = level;
        });
    }
    /**
     * Get current log level
     */
    getLevel() {
        return this.config.level;
    }
    /**
     * Flush all log transports
     */
    async flush() {
        return new Promise((resolve) => {
            // Winston doesn't have a built-in flush method, so we use a workaround
            let pendingTransports = this.logger.transports.length;
            if (pendingTransports === 0) {
                resolve();
                return;
            }
            this.logger.transports.forEach((transport) => {
                if ('close' in transport && typeof transport.close === 'function') {
                    // Winston v3 close() is synchronous (no callback)
                    transport.close();
                }
                pendingTransports--;
                if (pendingTransports === 0) {
                    resolve();
                }
            });
        });
    }
    /**
     * Close the logger and clean up resources
     */
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
 * Default logger instance for the application
 */
exports.defaultLogger = new TestLogger();
/**
 * Convenience methods using the default logger
 */
exports.logger = {
    error: (message, meta) => exports.defaultLogger.error(message, meta),
    warn: (message, meta) => exports.defaultLogger.warn(message, meta),
    info: (message, meta) => exports.defaultLogger.info(message, meta),
    debug: (message, meta) => exports.defaultLogger.debug(message, meta),
    setContext: (context) => exports.defaultLogger.setContext(context),
    clearContext: () => exports.defaultLogger.clearContext(),
    setLevel: (level) => exports.defaultLogger.setLevel(level),
    child: (context) => exports.defaultLogger.child(context)
};
/**
 * Setup logger with configuration
 */
function setupLogger(config) {
    const newLogger = createLogger(config);
    Object.assign(exports.defaultLogger, newLogger);
    return exports.defaultLogger;
}
//# sourceMappingURL=logger.js.map