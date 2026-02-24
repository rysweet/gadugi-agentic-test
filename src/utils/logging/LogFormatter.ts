/**
 * Log formatting and colorization utilities
 */

import winston from 'winston';
import { LogContext, LoggerConfig } from './LogTransport';

/**
 * Build the console format for Winston, including colorization, timestamps, and context fields.
 */
export function buildConsoleFormat(
  _config: LoggerConfig,
  getContext: () => LogContext
): winston.Logform.Format {
  return winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const context = getContext();
      let output = `${timestamp} [${level}]`;

      if (context.scenarioId) {
        output += ` [${context.scenarioId}]`;
      }
      if (context.component) {
        output += ` [${context.component}]`;
      }

      output += `: ${message}`;

      if (Object.keys(meta).length > 0) {
        output += ` ${JSON.stringify(meta)}`;
      }

      return output;
    })
  );
}

/**
 * Build the JSON format for file transports, including stack trace support.
 */
export function buildFileFormat(config: LoggerConfig): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: config.includeStackTrace }),
    winston.format.json()
  );
}

/**
 * Build the error-file format (always includes full stack traces).
 */
export function buildErrorFileFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );
}
