"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfigFromFile = exports.globalConfigManager = exports.ConfigManager = exports.exportConfigToFile = exports.setNestedValue = exports.getNestedValue = exports.mergeConfigs = exports.loadEnvConfig = exports.loadConfigFile = exports.validateConfig = exports.ENV_MAPPINGS = exports.DEFAULT_CONFIG = exports.ConfigSource = exports.ConfigError = void 0;
exports.getGlobalConfigManager = getGlobalConfigManager;
exports.loadDefaultConfig = loadDefaultConfig;
exports.createConfigManager = createConfigManager;
exports.getConfig = getConfig;
exports.updateConfig = updateConfig;
exports.loadConfigFromYaml = loadConfigFromYaml;
const promises_1 = __importDefault(require("fs/promises"));
var types_1 = require("./config/types");
Object.defineProperty(exports, "ConfigError", { enumerable: true, get: function () { return types_1.ConfigError; } });
Object.defineProperty(exports, "ConfigSource", { enumerable: true, get: function () { return types_1.ConfigSource; } });
Object.defineProperty(exports, "DEFAULT_CONFIG", { enumerable: true, get: function () { return types_1.DEFAULT_CONFIG; } });
Object.defineProperty(exports, "ENV_MAPPINGS", { enumerable: true, get: function () { return types_1.ENV_MAPPINGS; } });
var ConfigValidator_1 = require("./config/ConfigValidator");
Object.defineProperty(exports, "validateConfig", { enumerable: true, get: function () { return ConfigValidator_1.validateConfig; } });
var ConfigLoader_1 = require("./config/ConfigLoader");
Object.defineProperty(exports, "loadConfigFile", { enumerable: true, get: function () { return ConfigLoader_1.loadConfigFile; } });
Object.defineProperty(exports, "loadEnvConfig", { enumerable: true, get: function () { return ConfigLoader_1.loadEnvConfig; } });
Object.defineProperty(exports, "mergeConfigs", { enumerable: true, get: function () { return ConfigLoader_1.mergeConfigs; } });
Object.defineProperty(exports, "getNestedValue", { enumerable: true, get: function () { return ConfigLoader_1.getNestedValue; } });
Object.defineProperty(exports, "setNestedValue", { enumerable: true, get: function () { return ConfigLoader_1.setNestedValue; } });
Object.defineProperty(exports, "exportConfigToFile", { enumerable: true, get: function () { return ConfigLoader_1.exportConfigToFile; } });
var ConfigManager_1 = require("./config/ConfigManager");
Object.defineProperty(exports, "ConfigManager", { enumerable: true, get: function () { return ConfigManager_1.ConfigManager; } });
// Import for factory functions and global instance
const ConfigManager_2 = require("./config/ConfigManager");
/**
 * Lazily-initialized global configuration manager.
 * Created on first access to avoid side effects at import time.
 */
let _globalConfigManager = null;
function getGlobalConfigManager() {
    return (_globalConfigManager ?? (_globalConfigManager = new ConfigManager_2.ConfigManager()));
}
/**
 * Global configuration manager instance (backward-compatible proxy).
 * Delegates all property access to the lazily-created ConfigManager so that
 * no ConfigManager is instantiated at module-import time.
 */
exports.globalConfigManager = new Proxy({}, {
    get(_target, prop) {
        return Reflect.get(getGlobalConfigManager(), prop);
    },
    set(_target, prop, value) {
        return Reflect.set(getGlobalConfigManager(), prop, value);
    }
});
/**
 * Load configuration from default locations
 */
async function loadDefaultConfig() {
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
    exports.globalConfigManager.loadFromEnvironment();
    return exports.globalConfigManager.getConfig();
}
/**
 * Create a new configuration manager with the provided config
 */
function createConfigManager(config) {
    return new ConfigManager_2.ConfigManager(config);
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
 * Load configuration from a YAML or JSON file
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