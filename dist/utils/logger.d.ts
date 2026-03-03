/**
 * Winston-based logging system for the Agentic Testing System
 * Provides configurable logging with different levels, formats, and outputs
 *
 * This file re-exports types from logging/ sub-modules and provides the
 * TestLogger class plus the singleton convenience object.
 */
import { LogLevel, LogContext, LoggerConfig } from './logging/LogTransport';
export { LogLevel };
export type { LogContext, LoggerConfig };
/**
 * Enhanced Winston logger with testing-specific features
 */
export declare class TestLogger {
    private logger;
    private config;
    private context;
    constructor(config?: Partial<LoggerConfig>);
    private createLogger;
    setContext(context: LogContext): void;
    clearContext(): void;
    getContext(): LogContext;
    /**
     * Log an error message
     */
    error(message: string, meta?: unknown): void;
    /**
     * Log a warning message
     */
    warn(message: string, meta?: unknown): void;
    /**
     * Log an info message
     */
    info(message: string, meta?: unknown): void;
    /**
     * Log an HTTP message
     */
    http(message: string, meta?: unknown): void;
    /**
     * Log a debug message
     */
    debug(message: string, meta?: unknown): void;
    scenarioStart(scenarioId: string, scenarioName: string): void;
    scenarioEnd(scenarioId: string, status: string, duration: number): void;
    stepExecution(stepIndex: number, action: string, target: string): void;
    stepComplete(stepIndex: number, status: string, duration: number): void;
    /**
     * Log performance metrics
     */
    performance(operation: string, duration: number, metadata?: Record<string, unknown>): void;
    screenshot(filename: string, stepIndex?: number): void;
    commandExecution(command: string, workingDir?: string): void;
    commandComplete(command: string, exitCode: number, duration: number): void;
    child(context: LogContext): TestLogger;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
    flush(): Promise<void>;
    close(): Promise<void>;
}
/**
 * Create a logger instance with the specified configuration
 */
export declare function createLogger(config?: Partial<LoggerConfig>): TestLogger;
/**
 * Convenience methods that always delegate to the current active logger.
 */
export declare const logger: {
    error: (message: string, meta?: unknown) => void;
    warn: (message: string, meta?: unknown) => void;
    info: (message: string, meta?: unknown) => void;
    debug: (message: string, meta?: unknown) => void;
    setContext: (context: LogContext) => void;
    clearContext: () => void;
    setLevel: (level: LogLevel) => void;
    child: (context: LogContext) => TestLogger;
};
/**
 * Reconfigure the active logger. Replaces the logger instance rather than mutating it.
 */
export declare function setupLogger(config?: Partial<LoggerConfig>): TestLogger;
//# sourceMappingURL=logger.d.ts.map