/**
 * ConfigLoader - File and environment-based config loading with deep merge
 */

import fs from 'fs/promises';
import path from 'path';
import * as yaml from 'js-yaml';
import { TestConfig } from '../../models/Config';
import { ConfigError, ConfigSource, ENV_MAPPINGS } from './types';
import { validateConfig } from './ConfigValidator';

/**
 * Load a configuration file (JSON or YAML) and return the parsed object.
 * Throws ConfigError for unsupported formats or invalid content.
 */
export async function loadConfigFile(filePath: string): Promise<any> {
  const absolutePath = path.resolve(filePath);
  let fileContent: string;
  try {
    fileContent = await fs.readFile(absolutePath, 'utf-8');
  } catch (error: unknown) {
    throw new ConfigError(
      `Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      filePath
    );
  }

  const extension = path.extname(absolutePath).toLowerCase();
  let parsed: any;

  if (extension === '.json') {
    try {
      parsed = JSON.parse(fileContent);
    } catch (error: unknown) {
      throw new ConfigError(
        `Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        filePath
      );
    }
  } else if (extension === '.yaml' || extension === '.yml') {
    try {
      parsed = yaml.load(fileContent);
    } catch (error: unknown) {
      throw new ConfigError(
        `Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        filePath
      );
    }
  } else {
    throw new ConfigError(`Unsupported config file format: ${extension}`, filePath);
  }

  const validation = validateConfig(parsed);
  if (!validation.valid) {
    throw new ConfigError(`Configuration validation failed: ${validation.errors.join(', ')}`, filePath);
  }

  return parsed;
}

/**
 * Build a partial config object from environment variables using ENV_MAPPINGS.
 * Returns an empty object if no matching env vars are set.
 */
export function loadEnvConfig(): { config: any; source: ConfigSource | null } {
  const envConfig: any = {};

  Object.entries(ENV_MAPPINGS).forEach(([envVar, configPath]) => {
    const envValue = process.env[envVar];
    if (envValue !== undefined) {
      setNestedValue(envConfig, configPath, parseEnvValue(envValue));
    }
  });

  // Load additional environment variables for CLI config
  const cliEnvVars = Object.keys(process.env).reduce((acc, key) => {
    if (key.startsWith('AGENTIC_CLI_ENV_')) {
      const envKey = key.replace('AGENTIC_CLI_ENV_', '');
      acc[envKey] = process.env[key]!;
    }
    return acc;
  }, {} as Record<string, string>);

  if (Object.keys(cliEnvVars).length > 0) {
    setNestedValue(envConfig, 'cli.environment', cliEnvVars);
  }

  const hasEnvConfig = Object.keys(envConfig).length > 0;
  return {
    config: envConfig,
    source: hasEnvConfig ? ConfigSource.ENVIRONMENT : null
  };
}

/**
 * Deep merge two configuration objects.
 */
export function mergeConfigs<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  Object.keys(source).forEach(key => {
    const sourceValue = source[key as keyof T];
    const targetValue = result[key as keyof T];

    if (sourceValue !== undefined) {
      if (
        typeof sourceValue === 'object' && !Array.isArray(sourceValue) && sourceValue !== null &&
        typeof targetValue === 'object' && !Array.isArray(targetValue) && targetValue !== null
      ) {
        (result as any)[key] = mergeConfigs(targetValue, sourceValue);
      } else {
        (result as any)[key] = sourceValue;
      }
    }
  });

  return result;
}

/**
 * Get nested value from object using dot notation
 */
export function getNestedValue(obj: any, dotPath: string): any {
  return dotPath.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested value in object using dot notation
 */
export function setNestedValue(obj: any, dotPath: string, value: any): void {
  const keys = dotPath.split('.');
  const lastKey = keys.pop()!;

  const target = keys.reduce((current, key) => {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key];
  }, obj);

  target[lastKey] = value;
}

/**
 * Parse environment variable value to appropriate type
 */
function parseEnvValue(value: string): any {
  // Boolean values
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Number values
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

  // JSON values
  if ((value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']'))) {
    try {
      return JSON.parse(value);
    } catch {
      // If JSON parsing fails, return as string
    }
  }

  // Array values (comma-separated)
  if (value.includes(',')) {
    return value.split(',').map(v => v.trim());
  }

  return value;
}

/**
 * Export a config object to a file in JSON or YAML format.
 */
export async function exportConfigToFile(
  config: TestConfig,
  filePath: string,
  format: 'json' | 'yaml' = 'yaml'
): Promise<void> {
  let content: string;

  if (format === 'json') {
    content = JSON.stringify(config, null, 2);
  } else {
    content = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false
    });
  }

  await fs.writeFile(filePath, content, 'utf-8');
}
