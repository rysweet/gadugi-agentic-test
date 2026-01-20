"use strict";
/**
 * Utilities module - Comprehensive utilities and helpers for the Agentic Testing System
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringUtils = exports.TimeUtils = exports.LegacyConfigManager = exports.legacyLogger = exports.createLegacyLogger = void 0;
// Re-export all utility modules
__exportStar(require("./logger"), exports);
__exportStar(require("./yamlParser"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./retry"), exports);
__exportStar(require("./screenshot"), exports);
__exportStar(require("./fileUtils"), exports);
// Legacy exports for backward compatibility
const winston_1 = __importDefault(require("winston"));
// Logger configuration (legacy)
const createLegacyLogger = (level = 'info') => {
    return winston_1.default.createLogger({
        level,
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
        defaultMeta: { service: 'agentic-testing' },
        transports: [
            new winston_1.default.transports.File({ filename: 'error.log', level: 'error' }),
            new winston_1.default.transports.File({ filename: 'combined.log' }),
            new winston_1.default.transports.Console({
                format: winston_1.default.format.simple()
            })
        ]
    });
};
exports.createLegacyLogger = createLegacyLogger;
// Default legacy logger instance
exports.legacyLogger = (0, exports.createLegacyLogger)(process.env.LOG_LEVEL || 'info');
// Legacy configuration utilities (kept for backward compatibility)
class LegacyConfigManager {
    static set(key, value) {
        this.config[key] = value;
    }
    static get(key, defaultValue) {
        return this.config[key] ?? defaultValue;
    }
    static has(key) {
        return key in this.config;
    }
    static loadFromEnv() {
        const envVars = [
            'GITHUB_TOKEN',
            'ELECTRON_APP_PATH',
            'TEST_DATA_DIR',
            'LOG_LEVEL',
            'WEBSOCKET_URL',
            'AZURE_TENANT_ID'
        ];
        envVars.forEach(envVar => {
            if (process.env[envVar]) {
                this.set(envVar, process.env[envVar]);
            }
        });
    }
}
exports.LegacyConfigManager = LegacyConfigManager;
LegacyConfigManager.config = {};
// Timing utilities
class TimeUtils {
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    static timeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms))
        ]);
    }
    static measureTime(fn) {
        const start = Date.now();
        return fn().then(result => ({
            result,
            duration: Date.now() - start
        }));
    }
}
exports.TimeUtils = TimeUtils;
// String utilities
class StringUtils {
    static interpolate(template, variables) {
        return template.replace(/\${(\w+)}/g, (match, key) => {
            return variables[key] ?? match;
        });
    }
    static slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
}
exports.StringUtils = StringUtils;
// Initialize legacy config from environment
LegacyConfigManager.loadFromEnv();
//# sourceMappingURL=index.js.map