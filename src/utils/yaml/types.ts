/**
 * YAML-specific type definitions for the parser subsystem
 */

/**
 * YAML parsing error class
 */
export class YamlParseError extends Error {
  constructor(message: string, public fileName?: string, public lineNumber?: number) {
    super(message);
    this.name = 'YamlParseError';
  }
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = 'ValidationError';
  }
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
 * Default parser configuration
 */
export const DEFAULT_YAML_CONFIG: YamlParserConfig = {
  baseDir: process.cwd(),
  maxIncludeDepth: 5,
  strictValidation: true,
  variableResolvers: {},
  defaultEnvironment: {}
};

/**
 * Raw YAML scenario structure (before validation)
 */
export interface RawScenario {
  id?: string;
  name?: string;
  description?: string;
  priority?: string;
  interface?: string;
  prerequisites?: string[];
  steps?: any[];
  verifications?: any[];
  expectedOutcome?: string;
  estimatedDuration?: number;
  tags?: string[];
  enabled?: boolean;
  environment?: Record<string, string>;
  cleanup?: any[];
  variables?: Record<string, any>;
  includes?: string[];
}
