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
import { TestConfig } from '../models/Config';
export type { ValidationResult, ConfigMetadata } from './config/types';
export { ConfigError, ConfigSource, DEFAULT_CONFIG, ENV_MAPPINGS } from './config/types';
export { validateConfig } from './config/ConfigValidator';
export { loadConfigFile, loadEnvConfig, mergeConfigs, getNestedValue, setNestedValue, exportConfigToFile } from './config/ConfigLoader';
export { ConfigManager } from './config/ConfigManager';
import { ConfigManager } from './config/ConfigManager';
export declare function getGlobalConfigManager(): ConfigManager;
/**
 * Global configuration manager instance (backward-compatible proxy).
 * Delegates all property access to the lazily-created ConfigManager so that
 * no ConfigManager is instantiated at module-import time.
 */
export declare const globalConfigManager: ConfigManager;
/**
 * Load configuration from default locations
 */
export declare function loadDefaultConfig(): Promise<TestConfig>;
/**
 * Create a new configuration manager with the provided config
 */
export declare function createConfigManager(config?: Partial<TestConfig>): ConfigManager;
/**
 * Convenience function to get current configuration
 */
export declare function getConfig(): TestConfig;
/**
 * Convenience function to update configuration
 */
export declare function updateConfig(updates: Partial<TestConfig>): void;
/**
 * Load configuration from a YAML or JSON file
 */
export declare function loadConfigFromYaml(filePath: string): Promise<TestConfig>;
/**
 * Alias for loadConfigFromYaml
 */
export declare const loadConfigFromFile: typeof loadConfigFromYaml;
//# sourceMappingURL=config.d.ts.map