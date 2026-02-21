/**
 * ConfigValidator - Validation logic for configuration objects
 */

import { ValidationResult } from './types';

/**
 * Validate a configuration object, returning errors and warnings.
 */
export function validateConfig(config: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Basic type checks
    if (config.execution) {
      if (typeof config.execution.maxParallel === 'number' && config.execution.maxParallel < 1) {
        errors.push('execution.maxParallel must be at least 1');
      }
      if (typeof config.execution.defaultTimeout === 'number' && config.execution.defaultTimeout < 1000) {
        warnings.push('execution.defaultTimeout is less than 1 second');
      }
    }

    if (config.ui) {
      if (config.ui.browser && !['chromium', 'firefox', 'webkit'].includes(config.ui.browser)) {
        errors.push('ui.browser must be one of: chromium, firefox, webkit');
      }
      if (config.ui.viewport) {
        if (config.ui.viewport.width < 100 || config.ui.viewport.height < 100) {
          errors.push('ui.viewport dimensions must be at least 100x100');
        }
      }
    }

    if (config.logging) {
      if (config.logging.level && !['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
        errors.push('logging.level must be one of: debug, info, warn, error');
      }
    }

    if (config.priority) {
      if (config.priority.executionOrder && !Array.isArray(config.priority.executionOrder)) {
        errors.push('priority.executionOrder must be an array');
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
