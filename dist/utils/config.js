"use strict";
/**
 * Configuration loader for the Agentic Testing System
 * Handles loading from environment variables, config files, and provides validation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfigFromFile = exports.globalConfigManager = exports.ConfigManager = exports.ConfigSource = exports.ConfigError = void 0;
exports.loadDefaultConfig = loadDefaultConfig;
exports.createConfigManager = createConfigManager;
exports.getConfig = getConfig;
exports.updateConfig = updateConfig;
exports.loadConfigFromYaml = loadConfigFromYaml;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const yaml = __importStar(require("js-yaml"));
/**
 * Configuration loading error
 */
class ConfigError extends Error {
    constructor(message, configPath) {
        super(message);
        this.configPath = configPath;
        this.name = 'ConfigError';
    }
}
exports.ConfigError = ConfigError;
/**
 * Configuration source types
 */
var ConfigSource;
(function (ConfigSource) {
    ConfigSource["ENVIRONMENT"] = "environment";
    ConfigSource["FILE"] = "file";
    ConfigSource["DEFAULT"] = "default";
})(ConfigSource || (exports.ConfigSource = ConfigSource = {}));
/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
    execution: {
        maxParallel: 3,
        defaultTimeout: 30000,
        continueOnFailure: true,
        maxRetries: 2,
        retryDelay: 1000,
        randomizeOrder: false,
        resourceLimits: {
            maxMemory: 1024 * 1024 * 1024, // 1GB
            maxCpuUsage: 80,
            maxDiskUsage: 10 * 1024 * 1024 * 1024, // 10GB
            maxExecutionTime: 600000, // 10 minutes
            maxOpenFiles: 1024
        },
        cleanup: {
            cleanupAfterEach: true,
            cleanupAfterAll: true,
            cleanupDirectories: ['temp', 'screenshots'],
            cleanupFiles: ['*.tmp', '*.temp'],
            terminateProcesses: [],
            stopServices: [],
            customCleanupScripts: []
        }
    },
    cli: {
        executablePath: 'app-cli',
        workingDirectory: process.cwd(),
        defaultTimeout: 30000,
        environment: {},
        captureOutput: true,
        maxRetries: 2,
        retryDelay: 1000
    },
    ui: {
        browser: 'chromium',
        headless: false,
        viewport: { width: 1280, height: 720 },
        baseUrl: 'http://localhost:3000',
        defaultTimeout: 30000,
        screenshotDir: './screenshots',
        recordVideo: false
    },
    tui: {
        terminal: 'xterm',
        defaultDimensions: {
            width: 80,
            height: 24
        },
        encoding: 'utf8',
        defaultTimeout: 30000,
        pollingInterval: 100,
        captureScreenshots: true,
        recordSessions: false,
        colorMode: '24bit',
        interpretAnsi: true,
        shell: '/bin/bash',
        shellArgs: [],
        environment: {},
        workingDirectory: process.cwd(),
        accessibility: {
            highContrast: false,
            largeText: false,
            screenReader: false
        },
        performance: {
            refreshRate: 60,
            maxBufferSize: 1024 * 1024,
            hardwareAcceleration: false
        }
    },
    priority: {
        enabled: true,
        executionOrder: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
        failFastOnCritical: true,
        maxParallelByPriority: {
            CRITICAL: 1,
            HIGH: 2,
            MEDIUM: 3,
            LOW: 4
        },
        timeoutMultipliers: {
            CRITICAL: 2.0,
            HIGH: 1.5,
            MEDIUM: 1.0,
            LOW: 0.8
        },
        retryCountsByPriority: {
            CRITICAL: 3,
            HIGH: 2,
            MEDIUM: 1,
            LOW: 0
        }
    },
    logging: {
        level: 'info',
        console: true,
        format: 'structured',
        includeTimestamp: true,
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 5,
        compress: true
    },
    reporting: {
        outputDir: './reports',
        formats: ['html', 'json'],
        includeScreenshots: true,
        includeLogs: true,
        customTemplates: {},
        generationTimeout: 30000
    },
    notifications: {
        enabled: false,
        channels: [],
        triggers: [],
        templates: {}
    },
    plugins: {}
};
/**
 * Environment variable mappings
 */
const ENV_MAPPINGS = {
    'AGENTIC_LOG_LEVEL': 'logging.level',
    'AGENTIC_MAX_PARALLEL': 'execution.maxParallel',
    'AGENTIC_TIMEOUT': 'execution.defaultTimeout',
    'AGENTIC_HEADLESS': 'ui.headless',
    'AGENTIC_BROWSER': 'ui.browser',
    'AGENTIC_BASE_URL': 'ui.baseUrl',
    'AGENTIC_CLI_PATH': 'cli.executablePath',
    'AGENTIC_WORKING_DIR': 'cli.workingDirectory',
    'AGENTIC_SCREENSHOT_DIR': 'ui.screenshotDir',
    'AGENTIC_REPORT_DIR': 'reporting.outputDir',
    'GITHUB_TOKEN': 'github.token',
    'GITHUB_OWNER': 'github.owner',
    'GITHUB_REPO': 'github.repository'
};
/**
 * Configuration manager class
 */
class ConfigManager {
    constructor(initialConfig) {
        this.watchers = [];
        this.config = this.mergeConfigs(DEFAULT_CONFIG, initialConfig || {});
        this.metadata = {
            source: ConfigSource.DEFAULT,
            loadedAt: new Date(),
            environment: { ...process.env }
        };
    }
    /**
     * Load configuration from a file
     */
    async loadFromFile(filePath) {
        try {
            const absolutePath = path_1.default.resolve(filePath);
            const fileContent = await promises_1.default.readFile(absolutePath, 'utf-8');
            const extension = path_1.default.extname(absolutePath).toLowerCase();
            let fileConfig;
            if (extension === '.json') {
                fileConfig = JSON.parse(fileContent);
            }
            else if (extension === '.yaml' || extension === '.yml') {
                fileConfig = yaml.load(fileContent);
            }
            else {
                throw new ConfigError(`Unsupported config file format: ${extension}`, filePath);
            }
            // Validate the loaded configuration
            const validation = this.validateConfig(fileConfig);
            if (!validation.valid) {
                throw new ConfigError(`Configuration validation failed: ${validation.errors.join(', ')}`, filePath);
            }
            // Merge with existing config
            this.config = this.mergeConfigs(this.config, fileConfig);
            this.metadata = {
                source: ConfigSource.FILE,
                loadedAt: new Date(),
                filePath: absolutePath,
                environment: { ...process.env }
            };
            // Notify watchers
            this.notifyWatchers();
        }
        catch (error) {
            if (error instanceof ConfigError) {
                throw error;
            }
            throw new ConfigError(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`, filePath);
        }
    }
    /**
     * Load configuration from environment variables
     */
    loadFromEnvironment() {
        const envConfig = {};
        Object.entries(ENV_MAPPINGS).forEach(([envVar, configPath]) => {
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
                this.setNestedValue(envConfig, configPath, this.parseEnvValue(envValue));
            }
        });
        // Load additional environment variables for CLI config
        const cliEnvVars = Object.keys(process.env).reduce((acc, key) => {
            if (key.startsWith('AGENTIC_CLI_ENV_')) {
                const envKey = key.replace('AGENTIC_CLI_ENV_', '');
                acc[envKey] = process.env[key];
            }
            return acc;
        }, {});
        if (Object.keys(cliEnvVars).length > 0) {
            this.setNestedValue(envConfig, 'cli.environment', cliEnvVars);
        }
        // Merge environment config
        if (Object.keys(envConfig).length > 0) {
            this.config = this.mergeConfigs(this.config, envConfig);
            this.metadata.source = ConfigSource.ENVIRONMENT;
            this.metadata.loadedAt = new Date();
            this.notifyWatchers();
        }
    }
    /**
     * Get the current configuration
     */
    getConfig() {
        return { ...this.config }; // Return a copy to prevent mutations
    }
    /**
     * Get configuration metadata
     */
    getMetadata() {
        return { ...this.metadata };
    }
    /**
     * Update configuration at runtime
     */
    updateConfig(updates) {
        const validation = this.validateConfig(updates);
        if (!validation.valid) {
            throw new ConfigError(`Configuration update validation failed: ${validation.errors.join(', ')}`);
        }
        this.config = this.mergeConfigs(this.config, updates);
        this.notifyWatchers();
    }
    /**
     * Get a specific configuration value by path
     */
    get(path, defaultValue) {
        return this.getNestedValue(this.config, path) ?? defaultValue;
    }
    /**
     * Set a specific configuration value by path
     */
    set(path, value) {
        const updates = {};
        this.setNestedValue(updates, path, value);
        this.updateConfig(updates);
    }
    /**
     * Watch for configuration changes
     */
    watch(callback) {
        this.watchers.push(callback);
        // Return unwatch function
        return () => {
            const index = this.watchers.indexOf(callback);
            if (index > -1) {
                this.watchers.splice(index, 1);
            }
        };
    }
    /**
     * Validate configuration object
     */
    validateConfig(config) {
        const errors = [];
        const warnings = [];
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
            // Check for required CLI executable
            if (config.cli?.executablePath) {
                // Note: We can't check file existence here as it might not be available during config loading
                // This should be done during runtime validation
            }
        }
        catch (error) {
            errors.push(`Configuration validation error: ${error instanceof Error ? error.message : String(error)}`);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Create a configuration for a specific environment
     */
    createEnvironmentConfig(environment) {
        const baseConfig = { ...this.config };
        switch (environment) {
            case 'development':
                return this.mergeConfigs(baseConfig, {
                    logging: {
                        ...baseConfig.logging,
                        level: 'debug'
                    },
                    ui: {
                        ...baseConfig.ui,
                        headless: false
                    },
                    execution: {
                        ...baseConfig.execution,
                        continueOnFailure: true
                    }
                });
            case 'testing':
                return this.mergeConfigs(baseConfig, {
                    logging: {
                        ...baseConfig.logging,
                        level: 'info'
                    },
                    ui: {
                        ...baseConfig.ui,
                        headless: true
                    },
                    execution: {
                        ...baseConfig.execution,
                        continueOnFailure: false,
                        maxRetries: 0
                    }
                });
            case 'production':
                return this.mergeConfigs(baseConfig, {
                    logging: {
                        ...baseConfig.logging,
                        level: 'warn'
                    },
                    ui: {
                        ...baseConfig.ui,
                        headless: true
                    },
                    execution: {
                        ...baseConfig.execution,
                        continueOnFailure: false
                    },
                    notifications: {
                        ...baseConfig.notifications,
                        enabled: true
                    }
                });
            default:
                return baseConfig;
        }
    }
    /**
     * Export configuration to file
     */
    async exportToFile(filePath, format = 'yaml') {
        const config = this.getConfig();
        let content;
        if (format === 'json') {
            content = JSON.stringify(config, null, 2);
        }
        else {
            content = yaml.dump(config, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
                sortKeys: false
            });
        }
        await promises_1.default.writeFile(filePath, content, 'utf-8');
    }
    /**
     * Deep merge two configuration objects
     */
    mergeConfigs(target, source) {
        const result = { ...target };
        Object.keys(source).forEach(key => {
            const sourceValue = source[key];
            const targetValue = result[key];
            if (sourceValue !== undefined) {
                if (typeof sourceValue === 'object' && !Array.isArray(sourceValue) && sourceValue !== null &&
                    typeof targetValue === 'object' && !Array.isArray(targetValue) && targetValue !== null) {
                    result[key] = this.mergeConfigs(targetValue, sourceValue);
                }
                else {
                    result[key] = sourceValue;
                }
            }
        });
        return result;
    }
    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    /**
     * Set nested value in object using dot notation
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
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
    parseEnvValue(value) {
        // Boolean values
        if (value.toLowerCase() === 'true')
            return true;
        if (value.toLowerCase() === 'false')
            return false;
        // Number values
        if (/^\d+$/.test(value))
            return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value))
            return parseFloat(value);
        // JSON values
        if ((value.startsWith('{') && value.endsWith('}')) ||
            (value.startsWith('[') && value.endsWith(']'))) {
            try {
                return JSON.parse(value);
            }
            catch {
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
     * Notify configuration watchers
     */
    notifyWatchers() {
        this.watchers.forEach(callback => {
            try {
                callback(this.getConfig());
            }
            catch (error) {
                console.error('Error in configuration watcher:', error);
            }
        });
    }
}
exports.ConfigManager = ConfigManager;
/**
 * Global configuration manager instance
 */
exports.globalConfigManager = new ConfigManager();
/**
 * Load configuration from default locations
 */
async function loadDefaultConfig() {
    // Try to load from various default locations
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
            await promises_1.default.access(configFile);
            await exports.globalConfigManager.loadFromFile(configFile);
            break;
        }
        catch {
            // File doesn't exist, try next one
        }
    }
    // Load environment variables
    exports.globalConfigManager.loadFromEnvironment();
    return exports.globalConfigManager.getConfig();
}
/**
 * Create a new configuration manager with the provided config
 */
function createConfigManager(config) {
    return new ConfigManager(config);
}
/**
 * Convenience function to get current configuration
 */
function getConfig() {
    return exports.globalConfigManager.getConfig();
}
/**
 * Convenience function to update configuration
 */
function updateConfig(updates) {
    exports.globalConfigManager.updateConfig(updates);
}
/**
 * Load configuration from a YAML file
 */
async function loadConfigFromYaml(filePath) {
    await exports.globalConfigManager.loadFromFile(filePath);
    return exports.globalConfigManager.getConfig();
}
/**
 * Alias for loadConfigFromYaml
 */
exports.loadConfigFromFile = loadConfigFromYaml;
//# sourceMappingURL=config.js.map