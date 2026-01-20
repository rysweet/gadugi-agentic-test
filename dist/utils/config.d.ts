/**
 * Configuration loader for the Agentic Testing System
 * Handles loading from environment variables, config files, and provides validation
 */
import { TestConfig } from '../models/Config';
/**
 * Configuration loading error
 */
export declare class ConfigError extends Error {
    configPath?: string | undefined;
    constructor(message: string, configPath?: string | undefined);
}
/**
 * Configuration source types
 */
export declare enum ConfigSource {
    ENVIRONMENT = "environment",
    FILE = "file",
    DEFAULT = "default"
}
/**
 * Configuration validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Configuration metadata
 */
export interface ConfigMetadata {
    source: ConfigSource;
    loadedAt: Date;
    filePath?: string;
    environment: Record<string, string>;
}
/**
 * Configuration manager class
 */
export declare class ConfigManager {
    private config;
    private metadata;
    private watchers;
    constructor(initialConfig?: Partial<TestConfig>);
    /**
     * Load configuration from a file
     */
    loadFromFile(filePath: string): Promise<void>;
    /**
     * Load configuration from environment variables
     */
    loadFromEnvironment(): void;
    /**
     * Get the current configuration
     */
    getConfig(): TestConfig;
    /**
     * Get configuration metadata
     */
    getMetadata(): ConfigMetadata;
    /**
     * Update configuration at runtime
     */
    updateConfig(updates: Partial<TestConfig>): void;
    /**
     * Get a specific configuration value by path
     */
    get<T = any>(path: string, defaultValue?: T): T;
    /**
     * Set a specific configuration value by path
     */
    set(path: string, value: any): void;
    /**
     * Watch for configuration changes
     */
    watch(callback: (config: TestConfig) => void): () => void;
    /**
     * Validate configuration object
     */
    validateConfig(config: any): ValidationResult;
    /**
     * Create a configuration for a specific environment
     */
    createEnvironmentConfig(environment: 'development' | 'testing' | 'production'): TestConfig;
    /**
     * Export configuration to file
     */
    exportToFile(filePath: string, format?: 'json' | 'yaml'): Promise<void>;
    /**
     * Deep merge two configuration objects
     */
    private mergeConfigs;
    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue;
    /**
     * Set nested value in object using dot notation
     */
    private setNestedValue;
    /**
     * Parse environment variable value to appropriate type
     */
    private parseEnvValue;
    /**
     * Notify configuration watchers
     */
    private notifyWatchers;
}
/**
 * Global configuration manager instance
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
 * Load configuration from a YAML file
 */
export declare function loadConfigFromYaml(filePath: string): Promise<TestConfig>;
/**
 * Alias for loadConfigFromYaml
 */
export declare const loadConfigFromFile: typeof loadConfigFromYaml;
//# sourceMappingURL=config.d.ts.map