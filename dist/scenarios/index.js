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
        const scenario = yaml.load(content);
        return this.validateScenario(scenario);
    }
    static async loadFromDirectory(dirPath) {
        const files = await fs.readdir(dirPath);
        const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        const scenarios = await Promise.all(yamlFiles.map(f => this.loadFromFile(path.join(dirPath, f))));
        return scenarios;
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