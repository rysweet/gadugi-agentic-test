/**
 * Winston-based logging system for the Agentic Testing System
 * Provides configurable logging with different levels, formats, and outputs
 *
 * This file re-exports types from logging/ sub-modules and provides the
 * TestLogger class plus the singleton convenience object.
 */

import winston from 'winston';
import {
  LogLevel,
  LogContext,
  LoggerConfig,
  DEFAULT_LOGGER_CONFIG,
  buildTransports
} from './logging/LogTransport';

// Re-export so existing imports from './logger' continue to work
export { LogLevel };
export type { LogContext, LoggerConfig };

/**
 * Enhanced Winston logger with testing-specific features
 */
export class TestLogger {
  private logger: winston.Logger;
  private config: LoggerConfig;
  private context: LogContext = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const transports = buildTransports(this.config, () => this.context);

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: this.config.includeStackTrace }),
        winston.format.json()
      ),
      defaultMeta: { service: 'agentic-testing' },
      transports
    });
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  getContext(): LogContext {
    return { ...this.context };
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: unknown): void {
    this.logger.error(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta as Record<string, unknown> : { meta }) });
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: unknown): void {
    this.logger.warn(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta as Record<string, unknown> : { meta }) });
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: unknown): void {
    this.logger.info(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta as Record<string, unknown> : { meta }) });
  }

  /**
   * Log an HTTP message
   */
  http(message: string, meta?: unknown): void {
    this.logger.http(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta as Record<string, unknown> : { meta }) });
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: unknown): void {
    this.logger.debug(message, { ...this.context, ...(typeof meta === 'object' && meta !== null ? meta as Record<string, unknown> : { meta }) });
  }

  scenarioStart(scenarioId: string, scenarioName: string): void {
    this.setContext({ scenarioId });
    this.info(`Starting test scenario: ${scenarioName}`, {
      event: 'scenario_start',
      scenarioId,
      scenarioName
    });
  }

  scenarioEnd(scenarioId: string, status: string, duration: number): void {
    this.info(`Test scenario completed: ${status}`, {
      event: 'scenario_end',
      scenarioId,
      status,
      duration
    });
    this.clearContext();
  }

  stepExecution(stepIndex: number, action: string, target: string): void {
    this.debug(`Executing step ${stepIndex + 1}: ${action}`, {
      event: 'step_execution',
      stepIndex,
      action,
      target
    });
  }

  stepComplete(stepIndex: number, status: string, duration: number): void {
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
  performance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      event: 'performance',
      operation,
      duration,
      ...metadata
    });
  }

  screenshot(filename: string, stepIndex?: number): void {
    this.debug(`Screenshot captured: ${filename}`, {
      event: 'screenshot',
      filename,
      stepIndex
    });
  }

  commandExecution(command: string, workingDir?: string): void {
    this.debug(`Executing command: ${command}`, {
      event: 'command_execution',
      command,
      workingDir
    });
  }

  commandComplete(command: string, exitCode: number, duration: number): void {
    const level = exitCode === 0 ? 'info' : 'warn';
    this.logger[level](`Command completed with exit code ${exitCode}`, {
      event: 'command_complete',
      command,
      exitCode,
      duration
    });
  }

  child(context: LogContext): TestLogger {
    const childLogger = new TestLogger(this.config);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.logger.level = level;

    this.logger.transports.forEach(transport => {
      transport.level = level;
    });
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  async flush(): Promise<void> {
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

  async close(): Promise<void> {
    await this.flush();
    this.logger.close();
  }
}

/**
 * Create a logger instance with the specified configuration
 */
export function createLogger(config?: Partial<LoggerConfig>): TestLogger {
  return new TestLogger(config);
}

/**
 * Mutable active logger swapped by setupLogger() without mutating any instance.
 */
let _activeLogger: TestLogger = new TestLogger();

/** @deprecated Use the `logger` convenience object instead */
export const defaultLogger = _activeLogger;

/**
 * Convenience methods that always delegate to the current active logger.
 */
export const logger = {
  error: (message: string, meta?: unknown) => _activeLogger.error(message, meta),
  warn: (message: string, meta?: unknown) => _activeLogger.warn(message, meta),
  info: (message: string, meta?: unknown) => _activeLogger.info(message, meta),
  debug: (message: string, meta?: unknown) => _activeLogger.debug(message, meta),
  setContext: (context: LogContext) => _activeLogger.setContext(context),
  clearContext: () => _activeLogger.clearContext(),
  setLevel: (level: LogLevel) => _activeLogger.setLevel(level),
  child: (context: LogContext) => _activeLogger.child(context)
};

/**
 * Reconfigure the active logger. Replaces the logger instance rather than mutating it.
 */
export function setupLogger(config?: Partial<LoggerConfig>): TestLogger {
  _activeLogger = createLogger(config);
  return _activeLogger;
}
