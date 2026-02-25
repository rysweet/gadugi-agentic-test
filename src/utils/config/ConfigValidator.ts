/**
 * ConfigValidator - Validation logic for configuration objects
 */

import { ValidationResult } from './types';

/**
 * Validate a configuration object, returning errors and warnings.
 */
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Cast to a permissive record so property access doesn't require type guards
  // for every nested field. The function is intentionally validating shape at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = config as Record<string, any>;

  try {
    // Basic type checks
    if (cfg.execution) {
      if (typeof cfg.execution.maxParallel === 'number' && cfg.execution.maxParallel < 1) {
        errors.push('execution.maxParallel must be at least 1');
      }
      if (typeof cfg.execution.defaultTimeout === 'number' && cfg.execution.defaultTimeout < 1000) {
        warnings.push('execution.defaultTimeout is less than 1 second');
      }
    }

    if (cfg.ui) {
      if (cfg.ui.browser && !['chromium', 'firefox', 'webkit'].includes(cfg.ui.browser)) {
        errors.push('ui.browser must be one of: chromium, firefox, webkit');
      }
      if (cfg.ui.viewport) {
        if (cfg.ui.viewport.width < 100 || cfg.ui.viewport.height < 100) {
          errors.push('ui.viewport dimensions must be at least 100x100');
        }
      }
    }

    if (cfg.logging) {
      if (cfg.logging.level && !['debug', 'info', 'warn', 'error'].includes(cfg.logging.level)) {
        errors.push('logging.level must be one of: debug, info, warn, error');
      }
    }

    if (cfg.priority) {
      if (cfg.priority.executionOrder && !Array.isArray(cfg.priority.executionOrder)) {
        errors.push('priority.executionOrder must be an array');
      }
    }

    // Require github.token when createIssuesOnFailure is enabled
    if (cfg.github) {
      if (cfg.github.createIssuesOnFailure === true) {
        if (typeof cfg.github.token !== 'string' || cfg.github.token.trim() === '') {
          errors.push('github.token must be a non-empty string when github.createIssuesOnFailure is true');
        }
      }
    }

    // execution.maxRetries must be between 0 and 10
    if (cfg.execution) {
      if (typeof cfg.execution.maxRetries === 'number') {
        if (cfg.execution.maxRetries < 0 || cfg.execution.maxRetries > 10) {
          errors.push('execution.maxRetries must be between 0 and 10');
        }
      }
    }

    // tui.shell if provided must be a non-empty string
    if (cfg.tui) {
      if ('shell' in cfg.tui) {
        if (typeof cfg.tui.shell !== 'string' || cfg.tui.shell.trim() === '') {
          errors.push('tui.shell must be a non-empty string when provided');
        }
      }
    }

    // reporting.formats must only contain 'html' or 'json'
    if (cfg.reporting) {
      if (Array.isArray(cfg.reporting.formats)) {
        const allowedFormats = ['html', 'json'];
        const invalidFormats = cfg.reporting.formats.filter(
          (f: unknown) => !allowedFormats.includes(f as string)
        );
        if (invalidFormats.length > 0) {
          errors.push(`reporting.formats contains unsupported values: ${invalidFormats.join(', ')}. Allowed: html, json`);
        }
      }
    }
  } catch (error: unknown) {
    errors.push(`Configuration validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
