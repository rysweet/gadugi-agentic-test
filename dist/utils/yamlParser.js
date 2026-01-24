"use strict";
/**
 * YAML parsing utilities for test scenarios
 * Handles loading, parsing, validation, and variable substitution
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
const yaml = __importStar(require("js-yaml"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const TestModels_1 = require("../models/TestModels");
/**
 * YAML parsing error class
 */
class YamlParseError extends Error {
    constructor(message, fileName, lineNumber) {
        super(message);
        this.fileName = fileName;
        this.lineNumber = lineNumber;
        this.name = 'YamlParseError';
    }
}
exports.YamlParseError = YamlParseError;
/**
 * Validation error class
 */
class ValidationError extends Error {
    constructor(message, field, value) {
        super(message);
        this.field = field;
        this.value = value;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * Default parser configuration
 */
const DEFAULT_CONFIG = {
    baseDir: process.cwd(),
    maxIncludeDepth: 5,
    strictValidation: true,
    variableResolvers: {},
    defaultEnvironment: {}
};
/**
 * YAML parser for test scenarios
 */
class YamlParser {
    constructor(config = {}) {
        this.processedFiles = new Set();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Load and parse a YAML file containing test scenarios
     */
    async loadScenarios(filePath, variables = this.createDefaultVariableContext()) {
        try {
            const absolutePath = path_1.default.resolve(this.config.baseDir, filePath);
            const content = await promises_1.default.readFile(absolutePath, 'utf-8');
            // Parse YAML content
            const parsed = yaml.load(content);
            if (!parsed) {
                throw new YamlParseError('Empty or invalid YAML file', filePath);
            }
            // Handle includes
            const processedContent = await this.processIncludes(parsed, path_1.default.dirname(absolutePath), 0);
            // Substitute variables
            const substitutedContent = this.substituteVariables(processedContent, variables);
            // Convert to scenarios
            if (Array.isArray(substitutedContent)) {
                return substitutedContent.map((scenario, index) => this.validateAndConvertScenario(scenario, `${filePath}[${index}]`));
            }
            else if (substitutedContent.scenarios) {
                return substitutedContent.scenarios.map((scenario, index) => this.validateAndConvertScenario(scenario, `${filePath}[scenarios][${index}]`));
            }
            else {
                return [this.validateAndConvertScenario(substitutedContent, filePath)];
            }
        }
        catch (error) {
            if (error instanceof YamlParseError || error instanceof ValidationError) {
                throw error;
            }
            throw new YamlParseError(`Failed to load YAML file: ${error instanceof Error ? error.message : String(error)}`, filePath);
        }
    }
    /**
     * Load a single scenario from YAML string
     */
    parseScenario(yamlContent, variables = this.createDefaultVariableContext()) {
        try {
            const parsed = yaml.load(yamlContent);
            if (!parsed) {
                throw new YamlParseError('Empty or invalid YAML content');
            }
            const substituted = this.substituteVariables(parsed, variables);
            return this.validateAndConvertScenario(substituted, 'inline');
        }
        catch (error) {
            if (error instanceof YamlParseError || error instanceof ValidationError) {
                throw error;
            }
            throw new YamlParseError(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Process include directives in YAML content
     */
    async processIncludes(content, baseDir, depth) {
        if (depth > this.config.maxIncludeDepth) {
            throw new YamlParseError(`Maximum include depth of ${this.config.maxIncludeDepth} exceeded`);
        }
        if (typeof content !== 'object' || content === null) {
            return content;
        }
        if (Array.isArray(content)) {
            return Promise.all(content.map(item => this.processIncludes(item, baseDir, depth)));
        }
        // Handle include directive
        if (content.include && typeof content.include === 'string') {
            const includePath = path_1.default.resolve(baseDir, content.include);
            // Prevent circular includes
            if (this.processedFiles.has(includePath)) {
                throw new YamlParseError(`Circular include detected: ${includePath}`);
            }
            this.processedFiles.add(includePath);
            try {
                const includeContent = await promises_1.default.readFile(includePath, 'utf-8');
                const parsed = yaml.load(includeContent);
                // Merge variables if provided
                let result = parsed;
                if (content.variables && typeof parsed === 'object') {
                    result = this.mergeVariables(parsed, content.variables);
                }
                return this.processIncludes(result, path_1.default.dirname(includePath), depth + 1);
            }
            finally {
                this.processedFiles.delete(includePath);
            }
        }
        // Process includes in object properties
        const result = {};
        for (const [key, value] of Object.entries(content)) {
            result[key] = await this.processIncludes(value, baseDir, depth);
        }
        return result;
    }
    /**
     * Substitute variables in content
     */
    substituteVariables(content, variables) {
        if (typeof content === 'string') {
            return this.substituteStringVariables(content, variables);
        }
        if (typeof content !== 'object' || content === null) {
            return content;
        }
        if (Array.isArray(content)) {
            return content.map(item => this.substituteVariables(item, variables));
        }
        const result = {};
        for (const [key, value] of Object.entries(content)) {
            result[key] = this.substituteVariables(value, variables);
        }
        return result;
    }
    /**
     * Substitute variables in a string
     */
    substituteStringVariables(str, variables) {
        return str.replace(/\$\{([^}]+)\}/g, (match, expression) => {
            try {
                // Handle nested property access (e.g., ${env.HOME})
                const parts = expression.split('.');
                let value = variables;
                for (const part of parts) {
                    if (value && typeof value === 'object' && part in value) {
                        value = value[part];
                    }
                    else {
                        return match; // Keep original if not found
                    }
                }
                // Apply custom resolvers if available
                if (parts.length >= 2 && this.config.variableResolvers[parts[0]]) {
                    value = this.config.variableResolvers[parts[0]](value);
                }
                return String(value);
            }
            catch {
                return match; // Keep original on error
            }
        });
    }
    /**
     * Merge variables into content
     */
    mergeVariables(content, variables) {
        if (typeof content !== 'object' || content === null) {
            return content;
        }
        if (Array.isArray(content)) {
            return content;
        }
        return { ...content, variables: { ...content.variables, ...variables } };
    }
    /**
     * Validate and convert raw scenario to TestScenario
     */
    validateAndConvertScenario(raw, context) {
        const errors = [];
        // Required fields
        if (!raw.id)
            errors.push('id is required');
        if (!raw.name)
            errors.push('name is required');
        if (!raw.description)
            errors.push('description is required');
        // Validate priority
        const priority = this.validatePriority(raw.priority);
        if (!priority && this.config.strictValidation) {
            errors.push(`invalid priority: ${raw.priority}`);
        }
        // Validate interface
        const testInterface = this.validateInterface(raw.interface);
        if (!testInterface && this.config.strictValidation) {
            errors.push(`invalid interface: ${raw.interface}`);
        }
        // Validate steps
        const steps = this.validateSteps(raw.steps || []);
        const verifications = this.validateVerifications(raw.verifications || []);
        if (errors.length > 0) {
            throw new ValidationError(`Validation errors in ${context}: ${errors.join(', ')}`);
        }
        return {
            id: raw.id,
            name: raw.name,
            description: raw.description,
            priority: priority || TestModels_1.Priority.MEDIUM,
            interface: testInterface || TestModels_1.TestInterface.CLI,
            prerequisites: raw.prerequisites || [],
            steps,
            verifications,
            expectedOutcome: raw.expectedOutcome || '',
            estimatedDuration: raw.estimatedDuration || 60,
            tags: raw.tags || [],
            enabled: raw.enabled !== false,
            environment: raw.environment,
            cleanup: raw.cleanup ? this.validateSteps(raw.cleanup) : undefined
        };
    }
    /**
     * Validate priority string
     */
    validatePriority(priority) {
        if (!priority)
            return null;
        const upperPriority = priority.toUpperCase();
        return Object.values(TestModels_1.Priority).includes(upperPriority) ? upperPriority : null;
    }
    /**
     * Validate interface string
     */
    validateInterface(iface) {
        if (!iface)
            return null;
        const upperInterface = iface.toUpperCase();
        return Object.values(TestModels_1.TestInterface).includes(upperInterface) ? upperInterface : null;
    }
    /**
     * Validate test steps
     */
    validateSteps(rawSteps) {
        return rawSteps.map((step, index) => {
            if (typeof step !== 'object' || !step.action || !step.target) {
                throw new ValidationError(`Invalid step at index ${index}: action and target are required`);
            }
            return {
                action: step.action,
                target: step.target,
                value: step.value,
                waitFor: step.waitFor,
                timeout: step.timeout,
                description: step.description,
                expected: step.expected
            };
        });
    }
    /**
     * Validate verification steps
     */
    validateVerifications(rawVerifications) {
        return rawVerifications.map((verification, index) => {
            if (typeof verification !== 'object' || !verification.type || !verification.target || !verification.expected || !verification.operator) {
                throw new ValidationError(`Invalid verification at index ${index}: type, target, expected, and operator are required`);
            }
            return {
                type: verification.type,
                target: verification.target,
                expected: verification.expected,
                operator: verification.operator,
                description: verification.description
            };
        });
    }
    /**
     * Create default variable context
     */
    createDefaultVariableContext() {
        return {
            env: { ...process.env, ...this.config.defaultEnvironment },
            global: {},
            scenario: {}
        };
    }
    /**
     * Validate YAML file structure without full parsing
     */
    async validateYamlFile(filePath) {
        const errors = [];
        try {
            const content = await promises_1.default.readFile(filePath, 'utf-8');
            const parsed = yaml.load(content);
            if (!parsed) {
                errors.push('Empty or invalid YAML file');
                return { valid: false, errors };
            }
            // Basic structure validation
            if (typeof parsed !== 'object') {
                errors.push('YAML must contain an object or array');
            }
            return { valid: errors.length === 0, errors };
        }
        catch (error) {
            errors.push(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
            return { valid: false, errors };
        }
    }
    /**
     * Extract variables from YAML content
     */
    extractVariables(content) {
        const variables = {};
        const extract = (obj, path = '') => {
            if (typeof obj !== 'object' || obj === null)
                return;
            if (Array.isArray(obj)) {
                obj.forEach((item, index) => extract(item, `${path}[${index}]`));
                return;
            }
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                if (key === 'variables' && typeof value === 'object') {
                    Object.assign(variables, value);
                }
                else {
                    extract(value, currentPath);
                }
            }
        };
        extract(content);
        return variables;
    }
    /**
     * Convert TestScenario back to YAML string
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
        // Remove undefined fields
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
 * Alias for loadScenariosFromFile for backward compatibility
 */
exports.parseYamlScenarios = loadScenariosFromFile;
//# sourceMappingURL=yamlParser.js.map