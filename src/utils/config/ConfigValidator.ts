/**
 * ConfigValidator - Validation logic for configuration objects
 */

import { ValidationResult } from './types';

/** Helper to safely access a nested property from a config object. */
function get(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const key of keys) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * Validate a configuration object, returning errors and warnings.
 */
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Basic type checks
    const execution = get(config, 'execution');
    if (execution) {
      const maxParallel = get(config, 'execution', 'maxParallel');
      if (typeof maxParallel === 'number' && maxParallel < 1) {
        errors.push('execution.maxParallel must be at least 1');
      }
      const defaultTimeout = get(config, 'execution', 'defaultTimeout');
      if (typeof defaultTimeout === 'number' && defaultTimeout < 1000) {
        warnings.push('execution.defaultTimeout is less than 1 second');
      }
    }

    if (get(config, 'ui')) {
      const browser = get(config, 'ui', 'browser');
      if (browser && !['chromium', 'firefox', 'webkit'].includes(browser as string)) {
        errors.push('ui.browser must be one of: chromium, firefox, webkit');
      }
      const viewport = get(config, 'ui', 'viewport');
      if (viewport) {
        const width = get(config, 'ui', 'viewport', 'width');
        const height = get(config, 'ui', 'viewport', 'height');
        if ((typeof width === 'number' && width < 100) || (typeof height === 'number' && height < 100)) {
          errors.push('ui.viewport dimensions must be at least 100x100');
        }
      }
    }

    if (get(config, 'logging')) {
      const level = get(config, 'logging', 'level');
      if (level && !['debug', 'info', 'warn', 'error'].includes(level as string)) {
        errors.push('logging.level must be one of: debug, info, warn, error');
      }
    }

    if (get(config, 'priority')) {
      const executionOrder = get(config, 'priority', 'executionOrder');
      if (executionOrder && !Array.isArray(executionOrder)) {
        errors.push('priority.executionOrder must be an array');
      }
    }

    // Require github.token when createIssuesOnFailure is enabled
    if (get(config, 'github')) {
      const createIssues = get(config, 'github', 'createIssuesOnFailure');
      if (createIssues === true) {
        const token = get(config, 'github', 'token');
        if (typeof token !== 'string' || token.trim() === '') {
          errors.push('github.token must be a non-empty string when github.createIssuesOnFailure is true');
        }
      }
    }

    // execution.maxRetries must be between 0 and 10
    if (execution) {
      const maxRetries = get(config, 'execution', 'maxRetries');
      if (typeof maxRetries === 'number') {
        if (maxRetries < 0 || maxRetries > 10) {
          errors.push('execution.maxRetries must be between 0 and 10');
        }
      }
    }

    // tui.shell if provided must be a non-empty string
    const tui = get(config, 'tui');
    if (tui && typeof tui === 'object' && 'shell' in tui) {
      const shell = (tui as Record<string, unknown>)['shell'];
      if (typeof shell !== 'string' || shell.trim() === '') {
        errors.push('tui.shell must be a non-empty string when provided');
      }
    }

    // reporting.formats must only contain 'html' or 'json'
    if (get(config, 'reporting')) {
      const formats = get(config, 'reporting', 'formats');
      if (Array.isArray(formats)) {
        const allowedFormats = ['html', 'json'];
        const invalidFormats = formats.filter(
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
