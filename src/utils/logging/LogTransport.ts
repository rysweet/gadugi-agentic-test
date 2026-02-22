/**
 * Transport configuration (console, file) and core logger types
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { buildConsoleFormat, buildFileFormat, buildErrorFileFormat } from './LogFormatter';

/**
 * Log levels enumeration
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
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
 * Default logger configuration
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
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
 * Build Winston transports from configuration.
 *
 * @param config Logger configuration
 * @param getContext Callback returning the current log context (for console format)
 */
export function buildTransports(
  config: LoggerConfig,
  getContext: () => LogContext
): winston.transport[] {
  const transports: winston.transport[] = [];

  if (config.enableFile && !fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }

  if (config.enableConsole) {
    transports.push(
      new winston.transports.Console({
        level: config.level,
        format: buildConsoleFormat(config, getContext)
      })
    );
  }

  if (config.enableFile) {
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, 'combined.log'),
        level: config.level,
        maxsize: config.maxFileSize,
        maxFiles: config.maxFiles,
        format: buildFileFormat(config)
      })
    );

    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, 'error.log'),
        level: LogLevel.ERROR,
        maxsize: config.maxFileSize,
        maxFiles: config.maxFiles,
        format: buildErrorFileFormat()
      })
    );

    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, 'test-execution.log'),
        level: config.level,
        maxsize: config.maxFileSize,
        maxFiles: config.maxFiles,
        format: buildFileFormat(config)
      })
    );
  }

  return transports;
}
