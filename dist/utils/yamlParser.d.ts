/**
 * YAML parsing utilities for test scenarios
 * Handles loading, parsing, validation, and variable substitution
 *
 * This file re-exports types from yaml/ sub-modules and provides the main
 * YamlParser class that orchestrates loading, includes, substitution, and validation.
 */
import { OrchestratorScenario } from '../models/TestModels';
import { YamlParseError, ValidationError, VariableContext, YamlParserConfig, RawScenario } from './yaml/types';
export { YamlParseError, ValidationError };
export type { VariableContext, YamlParserConfig, RawScenario };
/**
 * YAML parser for test scenarios. Orchestrates file loading, include processing,
 * variable substitution, and schema validation.
 */
export declare class YamlParser {
    private config;
    private loader;
    private substitution;
    private validator;
    constructor(config?: Partial<YamlParserConfig>);
    /**
     * Load and parse a YAML file containing test scenarios.
     */
    loadScenarios(filePath: string, variables?: VariableContext): Promise<OrchestratorScenario[]>;
    /**
     * Parse a single scenario from a YAML string.
     */
    parseScenario(yamlContent: string, variables?: VariableContext): OrchestratorScenario;
    /**
     * Parse multiple scenarios from a YAML string (content, not file path).
     *
     * This is the correct function to use when you already have YAML content
     * in memory (e.g. after calling fs.readFile). Use loadScenarios() when
     * you want to load directly from a file path.
     */
    parseScenariosFromString(yamlContent: string, variables?: VariableContext): Promise<OrchestratorScenario[]>;
    /**
     * Validate YAML file structure without full parsing.
     */
    validateYamlFile(filePath: string): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    /**
     * Extract variables from YAML content.
     */
    extractVariables(content: unknown): Record<string, unknown>;
    /**
     * Convert OrchestratorScenario back to YAML string.
     */
    scenarioToYaml(scenario: OrchestratorScenario): string;
}
/**
 * Create a YAML parser instance
 */
export declare function createYamlParser(config?: Partial<YamlParserConfig>): YamlParser;
/**
 * Convenience function to load scenarios from a file
 */
export declare function loadScenariosFromFile(filePath: string, variables?: VariableContext): Promise<OrchestratorScenario[]>;
/**
 * Convenience function to parse a scenario from YAML string
 */
export declare function parseScenarioFromYaml(yamlContent: string, variables?: VariableContext): OrchestratorScenario;
/**
 * Convenience function to parse multiple scenarios from a YAML string.
 *
 * Unlike parseYamlScenarios / loadScenariosFromFile which expect a file path,
 * this function accepts YAML content that is already in memory.
 */
export declare function parseScenariosFromString(yamlContent: string, variables?: VariableContext): Promise<OrchestratorScenario[]>;
/**
 * Alias for loadScenariosFromFile for backward compatibility
 */
export declare const parseYamlScenarios: typeof loadScenariosFromFile;
//# sourceMappingURL=yamlParser.d.ts.map