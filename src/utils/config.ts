/**
 * Configuration utilities - backward-compatible re-export facade
 *
 * Implementation has been split into focused sub-modules in src/utils/config/:
 *   - types.ts          - ConfigError, ConfigSource, ValidationResult, ConfigMetadata, DEFAULT_CONFIG
 *   - ConfigValidator.ts - validateConfig() validation logic
 *   - ConfigLoader.ts   - File/env loading, mergeConfigs, getNestedValue, setNestedValue
 *   - ConfigManager.ts  - ConfigManager class (get/set/watch/load/export)
 *
 * All types and exports are re-exported here for full backward compatibility.
 */

import fs from 'fs/promises';
import { TestConfig } from '../models/Config';

// Re-export everything from sub-modules
export type { ValidationResult, ConfigMetadata } from './config/types';
export { ConfigError, ConfigSource, DEFAULT_CONFIG, ENV_MAPPINGS } from './config/types';
export { validateConfig } from './config/ConfigValidator';
export {
  loadConfigFile,
  loadEnvConfig,
  mergeConfigs,
  getNestedValue,
  setNestedValue,
  exportConfigToFile
} from './config/ConfigLoader';
export { ConfigManager } from './config/ConfigManager';

// Import for factory functions and global instance
import { ConfigManager } from './config/ConfigManager';

/**
 * Lazily-initialized global configuration manager.
 * Created on first access to avoid side effects at import time.
 */
let _globalConfigManager: ConfigManager | null = null;

export function getGlobalConfigManager(): ConfigManager {
  return (_globalConfigManager ??= new ConfigManager());
}

/**
 * Global configuration manager instance (backward-compatible proxy).
 * Delegates all property access to the lazily-created ConfigManager so that
 * no ConfigManager is instantiated at module-import time.
 */
export const globalConfigManager = new Proxy({} as ConfigManager, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getGlobalConfigManager(), prop);
  },
  set(_target, prop: string | symbol, value: unknown) {
    return Reflect.set(getGlobalConfigManager(), prop, value);
  }
});

/**
 * Load configuration from default locations
 */
export async function loadDefaultConfig(): Promise<TestConfig> {
  const configFiles = [
    'agentic-test.config.yaml',
    'agentic-test.config.yml',
    'agentic-test.config.json',
    '.agentic-testrc.yaml',
    '.agentic-testrc.yml',
    '.agentic-testrc.json'
  ];

  for (const configFile of configFiles) {
    try {
      await fs.access(configFile);
      await globalConfigManager.loadFromFile(configFile);
      break;
    } catch {
      // File doesn't exist, try next one
    }
  }

  globalConfigManager.loadFromEnvironment();
  return globalConfigManager.getConfig();
}

/**
 * Create a new configuration manager with the provided config
 */
export function createConfigManager(config?: Partial<TestConfig>): ConfigManager {
  return new ConfigManager(config);
}

/**
 * Convenience function to get current configuration
 */
export function getConfig(): TestConfig {
  return globalConfigManager.getConfig();
}

/**
 * Convenience function to update configuration
 */
export function updateConfig(updates: Partial<TestConfig>): void {
  globalConfigManager.updateConfig(updates);
}

/**
 * Load configuration from a YAML or JSON file
 */
export async function loadConfigFromYaml(filePath: string): Promise<TestConfig> {
  await globalConfigManager.loadFromFile(filePath);
  return globalConfigManager.getConfig();
}

/**
 * Alias for loadConfigFromYaml
 */
export const loadConfigFromFile = loadConfigFromYaml;
