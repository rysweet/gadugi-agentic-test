/**
 * ConfigManager - Runtime configuration management with get/set/watch
 */

import path from 'path';
import { TestConfig } from '../../models/Config';
import {
  ConfigError,
  ConfigSource,
  ConfigMetadata,
  DEFAULT_CONFIG
} from './types';
import { validateConfig } from './ConfigValidator';
import {
  loadConfigFile,
  loadEnvConfig,
  mergeConfigs,
  getNestedValue,
  setNestedValue,
  exportConfigToFile
} from './ConfigLoader';

/**
 * Configuration manager class - handles loading, merging, validation,
 * runtime updates and change notifications.
 */
export class ConfigManager {
  private config: TestConfig;
  private metadata: ConfigMetadata;
  private watchers: Array<(config: TestConfig) => void> = [];

  constructor(initialConfig?: Partial<TestConfig>) {
    this.config = mergeConfigs(DEFAULT_CONFIG, initialConfig || {});
    this.metadata = {
      source: ConfigSource.DEFAULT,
      loadedAt: new Date(),
      environment: {} // Don't snapshot env vars - they may contain secrets
    };
  }

  /**
   * Load configuration from a file
   */
  async loadFromFile(filePath: string): Promise<void> {
    const fileConfig = await loadConfigFile(filePath);

    this.config = mergeConfigs(this.config, fileConfig);
    this.metadata = {
      source: ConfigSource.FILE,
      loadedAt: new Date(),
      filePath: path.resolve(filePath),
      environment: {} // Don't snapshot env vars - they may contain secrets
    };

    this.notifyWatchers();
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment(): void {
    const { config: envConfig, source } = loadEnvConfig();

    if (source !== null) {
      this.config = mergeConfigs(this.config, envConfig);
      this.metadata.source = ConfigSource.ENVIRONMENT;
      this.metadata.loadedAt = new Date();
      this.notifyWatchers();
    }
  }

  /**
   * Get the current configuration (returns a shallow copy)
   */
  getConfig(): TestConfig {
    return { ...this.config };
  }

  /**
   * Get configuration metadata (returns a shallow copy)
   */
  getMetadata(): ConfigMetadata {
    return { ...this.metadata };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<TestConfig>): void {
    const validation = validateConfig(updates);
    if (!validation.valid) {
      throw new ConfigError(`Configuration update validation failed: ${validation.errors.join(', ')}`);
    }

    this.config = mergeConfigs(this.config, updates);
    this.notifyWatchers();
  }

  /**
   * Get a specific configuration value by dot-notation path
   */
  get<T = unknown>(dotPath: string, defaultValue?: T): T {
    return (getNestedValue(this.config, dotPath) ?? defaultValue) as T;
  }

  /**
   * Set a specific configuration value by dot-notation path
   */
  set(dotPath: string, value: unknown): void {
    const updates = {};
    setNestedValue(updates, dotPath, value);
    this.updateConfig(updates);
  }

  /**
   * Watch for configuration changes. Returns an unsubscribe function.
   */
  watch(callback: (config: TestConfig) => void): () => void {
    this.watchers.push(callback);

    return () => {
      const index = this.watchers.indexOf(callback);
      if (index > -1) {
        this.watchers.splice(index, 1);
      }
    };
  }

  /**
   * Validate a configuration object
   */
  validateConfig(config: unknown) {
    return validateConfig(config);
  }

  /**
   * Create a configuration for a specific environment
   */
  createEnvironmentConfig(environment: 'development' | 'testing' | 'production'): TestConfig {
    const baseConfig = { ...this.config };

    switch (environment) {
      case 'development':
        return mergeConfigs(baseConfig, {
          logging: { ...baseConfig.logging, level: 'debug' as const },
          ui: { ...baseConfig.ui, headless: false },
          execution: { ...baseConfig.execution, continueOnFailure: true }
        });

      case 'testing':
        return mergeConfigs(baseConfig, {
          logging: { ...baseConfig.logging, level: 'info' as const },
          ui: { ...baseConfig.ui, headless: true },
          execution: { ...baseConfig.execution, continueOnFailure: false, maxRetries: 0 }
        });

      case 'production':
        return mergeConfigs(baseConfig, {
          logging: { ...baseConfig.logging, level: 'warn' as const },
          ui: { ...baseConfig.ui, headless: true },
          execution: { ...baseConfig.execution, continueOnFailure: false },
          notifications: { ...baseConfig.notifications, enabled: true }
        });

      default:
        return baseConfig;
    }
  }

  /**
   * Export configuration to file
   */
  async exportToFile(filePath: string, format: 'json' | 'yaml' = 'yaml'): Promise<void> {
    return exportConfigToFile(this.getConfig(), filePath, format);
  }

  private notifyWatchers(): void {
    this.watchers.forEach(callback => {
      try {
        callback(this.getConfig());
      } catch (error: unknown) {
        console.error('Error in configuration watcher:', error);
      }
    });
  }
}
