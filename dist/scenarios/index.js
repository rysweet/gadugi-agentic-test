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
        const raw = yaml.load(content);
        // Handle both formats:
        // Format 1: Top-level name, steps, assertions (new format)
        // Format 2: Top-level application, scenarios array (legacy format)
        if (raw.scenarios && Array.isArray(raw.scenarios)) {
            // Legacy format with application/scenarios - convert to new format
            return this.convertLegacyFormat(raw);
        }
        else {
            // New format - validate directly
            return this.validateScenario(raw);
        }
    }
    static async loadFromDirectory(dirPath) {
        const files = await fs.readdir(dirPath);
        const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        const scenarios = await Promise.all(yamlFiles.map(f => this.loadFromFile(path.join(dirPath, f))));
        return scenarios;
    }
    static convertLegacyFormat(raw) {
        // Legacy format has application + scenarios array
        // Convert first scenario to new format (for now, only load first scenario)
        const firstScenario = raw.scenarios[0];
        return {
            name: raw.name || firstScenario.name,
            description: raw.description || firstScenario.description,
            version: raw.version,
            config: { timeout: raw.application?.timeout * 1000 || 120000 },
            environment: { requires: [] },
            agents: [{ name: 'tui-agent', type: 'tui', config: {} }],
            steps: firstScenario.steps.map((s) => ({
                name: s.description || s.action,
                agent: 'tui-agent',
                action: s.action,
                params: { input: s.input, conditions: s.conditions },
                timeout: s.conditions?.[0]?.timeout * 1000 || 30000
            })),
            assertions: firstScenario.assertions?.map((a) => ({
                name: a.description || a.type,
                type: a.type,
                agent: 'tui-agent',
                params: { value: a.value, description: a.description }
            })) || [],
            cleanup: [],
            metadata: {
                tags: ['legacy-format'],
                priority: 'medium'
            }
        };
    }
    static validateScenario(scenario) {
        if (!scenario.name) {
            throw new Error('Scenario must have a name');
        }
        if (!scenario.steps || !Array.isArray(scenario.steps)) {
            throw new Error('Scenario must have steps array');
        }
        return scenario;
    }
}
exports.ScenarioLoader = ScenarioLoader;
//# sourceMappingURL=index.js.map