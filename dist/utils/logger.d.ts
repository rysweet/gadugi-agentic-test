/**
 * Winston-based logging system for the Agentic Testing System
 * Provides configurable logging with different levels, formats, and outputs
 */
/**
 * Log levels enumeration
 */
export declare enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    HTTP = "http",
    DEBUG = "debug"
}
/**
 * Log context interface for structured logging
 */
export interface LogContext {
    /** Test scenario ID */
    scenarioId?: string;
    /** Test step index */
    stepIndex?: number;
    /** Component or module name */
    component?: string;
    /** Session or run ID */
    sessionId?: string;
    /** Additional metadata */
    metadata?: Record<string, any>;
}
/**
 * Logger configuration options
 */
export interface LoggerConfig {
    /** Log level threshold */
    level: LogLevel;
    /** Output directory for log files */
    logDir: string;
    /** Whether to log to console */
    enableConsole: boolean;
    /** Whether to log to file */
    enableFile: boolean;
    /** Maximum size of each log file in bytes */
    maxFileSize: number;
    /** Maximum number of log files to keep */
    maxFiles: number;
    /** Whether to compress rotated log files */
    compress: boolean;
    /** Custom log format */
    format?: string;
    /** Whether to include timestamps */
    includeTimestamp: boolean;
    /** Whether to include stack traces for errors */
    includeStackTrace: boolean;
}
/**
 * Enhanced Winston logger with testing-specific features
 */
export declare class TestLogger {
    private logger;
    private config;
    private context;
    constructor(config?: Partial<LoggerConfig>);
    /**
     * Create the Winston logger instance with configured transports
     */
    private createLogger;
    /**
     * Set the logging context for structured logging
     */
    setContext(context: LogContext): void;
    /**
     * Clear the current logging context
     */
    clearContext(): void;
    /**
     * Get the current logging context
     */
    getContext(): LogContext;
    /**
     * Log an error message
     */
    error(message: string, meta?: any): void;
    /**
     * Log a warning message
     */
    warn(message: string, meta?: any): void;
    /**
     * Log an info message
     */
    info(message: string, meta?: any): void;
    /**
     * Log an HTTP message
     */
    http(message: string, meta?: any): void;
    /**
     * Log a debug message
     */
    debug(message: string, meta?: any): void;
    /**
     * Log test scenario start
     */
    scenarioStart(scenarioId: string, scenarioName: string): void;
    /**
     * Log test scenario completion
     */
    scenarioEnd(scenarioId: string, status: string, duration: number): void;
    /**
     * Log test step execution
     */
    stepExecution(stepIndex: number, action: string, target: string): void;
    /**
     * Log test step completion
     */
    stepComplete(stepIndex: number, status: string, duration: number): void;
    /**
     * Log performance metrics
     */
    performance(operation: string, duration: number, metadata?: Record<string, any>): void;
    /**
     * Log screenshot capture
     */
    screenshot(filename: string, stepIndex?: number): void;
    /**
     * Log command execution
     */
    commandExecution(command: string, workingDir?: string): void;
    /**
     * Log command completion
     */
    commandComplete(command: string, exitCode: number, duration: number): void;
    /**
     * Create a child logger with additional context
     */
    child(context: LogContext): TestLogger;
    /**
     * Change the log level at runtime
     */
    setLevel(level: LogLevel): void;
    /**
     * Get current log level
     */
    getLevel(): LogLevel;
    /**
     * Flush all log transports
     */
    flush(): Promise<void>;
    /**
     * Close the logger and clean up resources
     */
    close(): Promise<void>;
}
/**
 * Create a logger instance with the specified configuration
 */
export declare function createLogger(config?: Partial<LoggerConfig>): TestLogger;
/**
 * Default logger instance for the application
 */
export declare const defaultLogger: TestLogger;
/**
 * Convenience methods using the default logger
 */
export declare const logger: {
    error: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    info: (message: string, meta?: any) => void;
    debug: (message: string, meta?: any) => void;
    setContext: (context: LogContext) => void;
    clearContext: () => void;
    setLevel: (level: LogLevel) => void;
    child: (context: LogContext) => TestLogger;
};
/**
 * Setup logger with configuration
 */
export declare function setupLogger(config?: Partial<LoggerConfig>): TestLogger;
//# sourceMappingURL=logger.d.ts.map