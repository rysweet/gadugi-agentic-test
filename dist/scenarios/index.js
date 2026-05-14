"use strict";
/**
 * Scenarios module - Test scenario management
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenarioLoader = void 0;
const yaml = __importStar(require("js-yaml"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// Scenario loader utility
class ScenarioLoader {
    static async loadFromFile(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        const raw = yaml.load(content, { schema: yaml.JSON_SCHEMA });
        // Handle three formats:
        // Format 1: Top-level name, steps, assertions (canonical format)
        // Format 2: Top-level application, scenarios array (legacy format)
        // Format 3: scenario: { name, steps, ... } (wrapped format)
        if (raw['scenario'] && typeof raw['scenario'] === 'object') {
            // Wrapped format - unwrap and validate
            return this.validateScenario(raw['scenario']);
        }
        else if (raw['scenarios'] && Array.isArray(raw['scenarios'])) {
            // Legacy format with application/scenarios - convert
            return this.convertLegacyFormat(raw);
        }
        else {
            // Canonical format - validate directly
            return this.validateScenario(raw);
        }
    }
    static async loadFromDirectory(dirPath) {
        const files = await fs.readdir(dirPath);
        const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        const results = await Promise.allSettled(yamlFiles.map(f => this.loadFromFile(path.join(dirPath, f))));
        const scenarios = [];
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled') {
                scenarios.push(result.value);
            }
            else {
                const filePath = path.join(dirPath, yamlFiles[i]);
                const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
                console.error(`Warning: Failed to load scenario from ${filePath}: ${reason}`);
            }
        }
        return scenarios;
    }
    static convertLegacyFormat(raw) {
        // Legacy format has application + scenarios array
        // Convert first scenario to new format (for now, only load first scenario)
        const scenarios = raw['scenarios'];
        const firstScenario = scenarios[0];
        const application = raw['application'];
        const descStr = raw['description'] !== undefined ? String(raw['description']) : firstScenario['description'] !== undefined ? String(firstScenario['description']) : undefined;
        const verStr = raw['version'] !== undefined ? String(raw['version']) : undefined;
        return {
            name: String(raw['name'] || firstScenario['name'] || ''),
            ...(descStr !== undefined ? { description: descStr } : {}),
            ...(verStr !== undefined ? { version: verStr } : {}),
            config: { timeout: (typeof application?.['timeout'] === 'number' ? application['timeout'] * 1000 : 0) || 120000 },
            environment: { requires: [] },
            agents: [{ name: 'tui-agent', type: 'tui', config: {} }],
            steps: firstScenario['steps'].map((s) => ({
                name: String(s['description'] || s['action'] || ''),
                agent: 'tui-agent',
                action: String(s['action'] || ''),
                params: { input: s['input'], conditions: s['conditions'] },
                timeout: (Array.isArray(s['conditions']) && s['conditions'].length > 0 && typeof s['conditions'][0]['timeout'] === 'number'
                    ? s['conditions'][0]['timeout'] * 1000
                    : 0) || 30000
            })),
            assertions: Array.isArray(firstScenario['assertions'])
                ? firstScenario['assertions'].map((a) => ({
                    name: String(a['description'] || a['type'] || ''),
                    type: String(a['type'] || ''),
                    agent: 'tui-agent',
                    params: { value: a['value'], description: a['description'] }
                }))
                : [],
            cleanup: [],
            metadata: {
                tags: ['legacy-format'],
                priority: 'medium'
            }
        };
    }
    static validateScenario(scenario) {
        if (!scenario['name']) {
            throw new Error('Scenario must have a name');
        }
        if (!scenario['steps'] || !Array.isArray(scenario['steps'])) {
            throw new Error('Scenario must have steps array');
        }
        if (!scenario['agents'] || !Array.isArray(scenario['agents']) || scenario['agents'].length === 0) {
            throw new Error('Scenario must have at least one agent');
        }
        return scenario;
    }
}
exports.ScenarioLoader = ScenarioLoader;
//# sourceMappingURL=index.js.map