"use strict";
/**
 * YAML parsing utilities for test scenarios
 * Handles loading, parsing, validation, and variable substitution
 *
 * This file re-exports types from yaml/ sub-modules and provides the main
 * YamlParser class that orchestrates loading, includes, substitution, and validation.
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
exports.parseYamlScenarios = exports.YamlParser = exports.ValidationError = exports.YamlParseError = void 0;
exports.createYamlParser = createYamlParser;
exports.loadScenariosFromFile = loadScenariosFromFile;
exports.parseScenarioFromYaml = parseScenarioFromYaml;
exports.parseScenariosFromString = parseScenariosFromString;
const yaml = __importStar(require("js-yaml"));
const path_1 = __importDefault(require("path"));
const types_1 = require("./yaml/types");
Object.defineProperty(exports, "YamlParseError", { enumerable: true, get: function () { return types_1.YamlParseError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return types_1.ValidationError; } });
const YamlLoader_1 = require("./yaml/YamlLoader");
const YamlVariableSubstitution_1 = require("./yaml/YamlVariableSubstitution");
const YamlValidator_1 = require("./yaml/YamlValidator");
/**
 * YAML parser for test scenarios. Orchestrates file loading, include processing,
 * variable substitution, and schema validation.
 */
class YamlParser {
    constructor(config = {}) {
        this.config = { ...types_1.DEFAULT_YAML_CONFIG, ...config };
        this.loader = new YamlLoader_1.YamlLoader(this.config);
        this.substitution = new YamlVariableSubstitution_1.YamlVariableSubstitution(this.config);
        this.validator = new YamlValidator_1.YamlValidator(this.config);
    }
    /**
     * Load and parse a YAML file containing test scenarios.
     */
    async loadScenarios(filePath, variables = this.substitution.createDefaultContext()) {
        try {
            const absolutePath = path_1.default.resolve(this.config.baseDir, filePath);
            const parsed = await this.loader.readFile(absolutePath);
            const processedContent = await this.loader.processIncludes(parsed, path_1.default.dirname(absolutePath), 0);
            const substitutedContent = this.substitution.substitute(processedContent, variables);
            if (Array.isArray(substitutedContent)) {
                return substitutedContent.map((scenario, index) => this.validator.validateAndConvert(scenario, `${filePath}[${index}]`));
            }
            else {
                const sc = substitutedContent;
                if (sc['scenarios'] && Array.isArray(sc['scenarios'])) {
                    return sc['scenarios'].map((scenario, index) => this.validator.validateAndConvert(scenario, `${filePath}[scenarios][${index}]`));
                }
                else {
                    return [this.validator.validateAndConvert(substitutedContent, filePath)];
                }
            }
        }
        catch (error) {
            if (error instanceof types_1.YamlParseError || error instanceof types_1.ValidationError) {
                throw error;
            }
            throw new types_1.YamlParseError(`Failed to load YAML file: ${error instanceof Error ? error.message : String(error)}`, filePath);
        }
    }
    /**
     * Parse a single scenario from a YAML string.
     */
    parseScenario(yamlContent, variables = this.substitution.createDefaultContext()) {
        try {
            const parsed = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA });
            if (!parsed) {
                throw new types_1.YamlParseError('Empty or invalid YAML content');
            }
            const substituted = this.substitution.substitute(parsed, variables);
            return this.validator.validateAndConvert(substituted, 'inline');
        }
        catch (error) {
            if (error instanceof types_1.YamlParseError || error instanceof types_1.ValidationError) {
                throw error;
            }
            throw new types_1.YamlParseError(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Parse multiple scenarios from a YAML string (content, not file path).
     *
     * This is the correct function to use when you already have YAML content
     * in memory (e.g. after calling fs.readFile). Use loadScenarios() when
     * you want to load directly from a file path.
     */
    async parseScenariosFromString(yamlContent, variables = this.substitution.createDefaultContext()) {
        try {
            const parsed = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA });
            if (!parsed) {
                throw new types_1.YamlParseError('Empty or invalid YAML content');
            }
            const substituted = this.substitution.substitute(parsed, variables);
            if (Array.isArray(substituted)) {
                return substituted.map((scenario, index) => this.validator.validateAndConvert(scenario, `inline[${index}]`));
            }
            else {
                const sc = substituted;
                if (sc['scenarios'] && Array.isArray(sc['scenarios'])) {
                    return sc['scenarios'].map((scenario, index) => this.validator.validateAndConvert(scenario, `inline[scenarios][${index}]`));
                }
                else {
                    return [this.validator.validateAndConvert(substituted, 'inline')];
                }
            }
        }
        catch (error) {
            if (error instanceof types_1.YamlParseError || error instanceof types_1.ValidationError) {
                throw error;
            }
            throw new types_1.YamlParseError(`Failed to parse YAML content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Validate YAML file structure without full parsing.
     */
    async validateYamlFile(filePath) {
        return this.validator.validateFile(filePath);
    }
    /**
     * Extract variables from YAML content.
     */
    extractVariables(content) {
        return this.substitution.extractVariables(content);
    }
    /**
     * Convert OrchestratorScenario back to YAML string.
     */
    scenarioToYaml(scenario) {
        const yamlObject = {
            id: scenario.id,
            name: scenario.name,
            description: scenario.description,
            priority: scenario.priority,
            interface: scenario.interface,
            prerequisites: scenario.prerequisites.length > 0 ? scenario.prerequisites : undefined,
            steps: scenario.steps,
            verifications: scenario.verifications.length > 0 ? scenario.verifications : undefined,
            expectedOutcome: scenario.expectedOutcome,
            estimatedDuration: scenario.estimatedDuration,
            tags: scenario.tags.length > 0 ? scenario.tags : undefined,
            enabled: scenario.enabled,
            environment: scenario.environment,
            cleanup: scenario.cleanup
        };
        Object.keys(yamlObject).forEach(key => {
            if (yamlObject[key] === undefined) {
                delete yamlObject[key];
            }
        });
        return yaml.dump(yamlObject, {
            indent: 2,
            lineWidth: 120,
            noRefs: true,
            sortKeys: false
        });
    }
}
exports.YamlParser = YamlParser;
/**
 * Create a YAML parser instance
 */
function createYamlParser(config) {
    return new YamlParser(config);
}
/**
 * Convenience function to load scenarios from a file
 */
async function loadScenariosFromFile(filePath, variables) {
    const parser = createYamlParser();
    return parser.loadScenarios(filePath, variables);
}
/**
 * Convenience function to parse a scenario from YAML string
 */
function parseScenarioFromYaml(yamlContent, variables) {
    const parser = createYamlParser();
    return parser.parseScenario(yamlContent, variables);
}
/**
 * Convenience function to parse multiple scenarios from a YAML string.
 *
 * Unlike parseYamlScenarios / loadScenariosFromFile which expect a file path,
 * this function accepts YAML content that is already in memory.
 */
async function parseScenariosFromString(yamlContent, variables) {
    const parser = createYamlParser();
    return parser.parseScenariosFromString(yamlContent, variables);
}
/**
 * Alias for loadScenariosFromFile for backward compatibility
 */
exports.parseYamlScenarios = loadScenariosFromFile;
//# sourceMappingURL=yamlParser.js.map