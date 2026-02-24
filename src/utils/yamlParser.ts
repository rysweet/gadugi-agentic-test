/**
 * YAML parsing utilities for test scenarios
 * Handles loading, parsing, validation, and variable substitution
 *
 * This file re-exports types from yaml/ sub-modules and provides the main
 * YamlParser class that orchestrates loading, includes, substitution, and validation.
 */

import * as yaml from 'js-yaml';
import path from 'path';
import { OrchestratorScenario } from '../models/TestModels';
import {
  YamlParseError,
  ValidationError,
  VariableContext,
  YamlParserConfig,
  DEFAULT_YAML_CONFIG,
  RawScenario
} from './yaml/types';
import { YamlLoader } from './yaml/YamlLoader';
import { YamlVariableSubstitution } from './yaml/YamlVariableSubstitution';
import { YamlValidator } from './yaml/YamlValidator';

// Re-export all types so existing imports from './yamlParser' continue to work
export { YamlParseError, ValidationError };
export type { VariableContext, YamlParserConfig, RawScenario };

/**
 * YAML parser for test scenarios. Orchestrates file loading, include processing,
 * variable substitution, and schema validation.
 */
export class YamlParser {
  private config: YamlParserConfig;
  private loader: YamlLoader;
  private substitution: YamlVariableSubstitution;
  private validator: YamlValidator;

  constructor(config: Partial<YamlParserConfig> = {}) {
    this.config = { ...DEFAULT_YAML_CONFIG, ...config };
    this.loader = new YamlLoader(this.config);
    this.substitution = new YamlVariableSubstitution(this.config);
    this.validator = new YamlValidator(this.config);
  }

  /**
   * Load and parse a YAML file containing test scenarios.
   */
  async loadScenarios(
    filePath: string,
    variables: VariableContext = this.substitution.createDefaultContext()
  ): Promise<OrchestratorScenario[]> {
    try {
      const absolutePath = path.resolve(this.config.baseDir, filePath);
      const parsed = await this.loader.readFile(absolutePath);

      const processedContent = await this.loader.processIncludes(parsed, path.dirname(absolutePath), 0);
      const substitutedContent = this.substitution.substitute(processedContent, variables);

      if (Array.isArray(substitutedContent)) {
        return substitutedContent.map((scenario: unknown, index: number) =>
          this.validator.validateAndConvert(scenario as RawScenario, `${filePath}[${index}]`)
        );
      } else {
        const sc = substitutedContent as Record<string, unknown>;
        if (sc['scenarios'] && Array.isArray(sc['scenarios'])) {
          return (sc['scenarios'] as unknown[]).map((scenario: unknown, index: number) =>
            this.validator.validateAndConvert(scenario as RawScenario, `${filePath}[scenarios][${index}]`)
          );
        } else {
          return [this.validator.validateAndConvert(substitutedContent as RawScenario, filePath)];
        }
      }
    } catch (error: unknown) {
      if (error instanceof YamlParseError || error instanceof ValidationError) {
        throw error;
      }
      throw new YamlParseError(
        `Failed to load YAML file: ${error instanceof Error ? error.message : String(error)}`,
        filePath
      );
    }
  }

  /**
   * Parse a single scenario from a YAML string.
   */
  parseScenario(
    yamlContent: string,
    variables: VariableContext = this.substitution.createDefaultContext()
  ): OrchestratorScenario {
    try {
      const parsed = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA }) as RawScenario;
      if (!parsed) {
        throw new YamlParseError('Empty or invalid YAML content');
      }

      const substituted = this.substitution.substitute(parsed, variables);
      return this.validator.validateAndConvert(substituted as RawScenario, 'inline');
    } catch (error: unknown) {
      if (error instanceof YamlParseError || error instanceof ValidationError) {
        throw error;
      }
      throw new YamlParseError(
        `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse multiple scenarios from a YAML string (content, not file path).
   *
   * This is the correct function to use when you already have YAML content
   * in memory (e.g. after calling fs.readFile). Use loadScenarios() when
   * you want to load directly from a file path.
   */
  async parseScenariosFromString(
    yamlContent: string,
    variables: VariableContext = this.substitution.createDefaultContext()
  ): Promise<OrchestratorScenario[]> {
    try {
      const parsed = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA });
      if (!parsed) {
        throw new YamlParseError('Empty or invalid YAML content');
      }

      const substituted = this.substitution.substitute(parsed, variables);

      if (Array.isArray(substituted)) {
        return substituted.map((scenario: unknown, index: number) =>
          this.validator.validateAndConvert(scenario as RawScenario, `inline[${index}]`)
        );
      } else {
        const sc = substituted as Record<string, unknown>;
        if (sc['scenarios'] && Array.isArray(sc['scenarios'])) {
          return (sc['scenarios'] as unknown[]).map((scenario: unknown, index: number) =>
            this.validator.validateAndConvert(scenario as RawScenario, `inline[scenarios][${index}]`)
          );
        } else {
          return [this.validator.validateAndConvert(substituted as RawScenario, 'inline')];
        }
      }
    } catch (error: unknown) {
      if (error instanceof YamlParseError || error instanceof ValidationError) {
        throw error;
      }
      throw new YamlParseError(
        `Failed to parse YAML content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate YAML file structure without full parsing.
   */
  async validateYamlFile(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
    return this.validator.validateFile(filePath);
  }

  /**
   * Extract variables from YAML content.
   */
  extractVariables(content: unknown): Record<string, unknown> {
    return this.substitution.extractVariables(content);
  }

  /**
   * Convert OrchestratorScenario back to YAML string.
   */
  scenarioToYaml(scenario: OrchestratorScenario): string {
    const yamlObject: Record<string, any> = {
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

/**
 * Create a YAML parser instance
 */
export function createYamlParser(config?: Partial<YamlParserConfig>): YamlParser {
  return new YamlParser(config);
}

/**
 * Convenience function to load scenarios from a file
 */
export async function loadScenariosFromFile(
  filePath: string,
  variables?: VariableContext
): Promise<OrchestratorScenario[]> {
  const parser = createYamlParser();
  return parser.loadScenarios(filePath, variables);
}

/**
 * Convenience function to parse a scenario from YAML string
 */
export function parseScenarioFromYaml(
  yamlContent: string,
  variables?: VariableContext
): OrchestratorScenario {
  const parser = createYamlParser();
  return parser.parseScenario(yamlContent, variables);
}

/**
 * Convenience function to parse multiple scenarios from a YAML string.
 *
 * Unlike parseYamlScenarios / loadScenariosFromFile which expect a file path,
 * this function accepts YAML content that is already in memory.
 */
export async function parseScenariosFromString(
  yamlContent: string,
  variables?: VariableContext
): Promise<OrchestratorScenario[]> {
  const parser = createYamlParser();
  return parser.parseScenariosFromString(yamlContent, variables);
}

/**
 * Alias for loadScenariosFromFile for backward compatibility
 */
export const parseYamlScenarios = loadScenariosFromFile;
