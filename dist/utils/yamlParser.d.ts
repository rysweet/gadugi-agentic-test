/**
 * YAML parsing utilities for test scenarios
 * Handles loading, parsing, validation, and variable substitution
 */
import { TestScenario } from '../models/TestModels';
/**
 * YAML parsing error class
 */
export declare class YamlParseError extends Error {
    fileName?: string | undefined;
    lineNumber?: number | undefined;
    constructor(message: string, fileName?: string | undefined, lineNumber?: number | undefined);
}
/**
 * Validation error class
 */
export declare class ValidationError extends Error {
    field?: string | undefined;
    value?: any | undefined;
    constructor(message: string, field?: string | undefined, value?: any | undefined);
}
/**
 * Variable substitution context
 */
export interface VariableContext {
    /** Environment variables */
    env: Record<string, string>;
    /** Global variables */
    global: Record<string, any>;
    /** Scenario-specific variables */
    scenario: Record<string, any>;
}
/**
 * YAML parser configuration
 */
export interface YamlParserConfig {
    /** Base directory for resolving includes */
    baseDir: string;
    /** Maximum recursion depth for includes */
    maxIncludeDepth: number;
    /** Whether to validate schemas strictly */
    strictValidation: boolean;
    /** Custom variable resolvers */
    variableResolvers: Record<string, (value: any) => any>;
    /** Default environment variables */
    defaultEnvironment: Record<string, string>;
}
/**
 * YAML parser for test scenarios
 */
export declare class YamlParser {
    private config;
    private processedFiles;
    constructor(config?: Partial<YamlParserConfig>);
    /**
     * Load and parse a YAML file containing test scenarios
     */
    loadScenarios(filePath: string, variables?: VariableContext): Promise<TestScenario[]>;
    /**
     * Load a single scenario from YAML string
     */
    parseScenario(yamlContent: string, variables?: VariableContext): TestScenario;
    /**
     * Process include directives in YAML content
     */
    private processIncludes;
    /**
     * Substitute variables in content
     */
    private substituteVariables;
    /**
     * Substitute variables in a string
     */
    private substituteStringVariables;
    /**
     * Merge variables into content
     */
    private mergeVariables;
    /**
     * Validate and convert raw scenario to TestScenario
     */
    private validateAndConvertScenario;
    /**
     * Validate priority string
     */
    private validatePriority;
    /**
     * Validate interface string
     */
    private validateInterface;
    /**
     * Validate test steps
     */
    private validateSteps;
    /**
     * Validate verification steps
     */
    private validateVerifications;
    /**
     * Create default variable context
     */
    private createDefaultVariableContext;
    /**
     * Validate YAML file structure without full parsing
     */
    validateYamlFile(filePath: string): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    /**
     * Extract variables from YAML content
     */
    extractVariables(content: any): Record<string, any>;
    /**
     * Convert TestScenario back to YAML string
     */
    scenarioToYaml(scenario: TestScenario): string;
}
/**
 * Create a YAML parser instance
 */
export declare function createYamlParser(config?: Partial<YamlParserConfig>): YamlParser;
/**
 * Convenience function to load scenarios from a file
 */
export declare function loadScenariosFromFile(filePath: string, variables?: VariableContext): Promise<TestScenario[]>;
/**
 * Convenience function to parse a scenario from YAML string
 */
export declare function parseScenarioFromYaml(yamlContent: string, variables?: VariableContext): TestScenario;
/**
 * Alias for loadScenariosFromFile for backward compatibility
 */
export declare const parseYamlScenarios: typeof loadScenariosFromFile;
//# sourceMappingURL=yamlParser.d.ts.map