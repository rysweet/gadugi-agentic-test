/**
 * Types for the ComprehensionAgent sub-modules
 */

/**
 * LLM provider types
 */
export type LLMProvider = 'openai' | 'azure';

/**
 * LLM configuration interface
 */
export interface LLMConfig {
  /** LLM provider (openai or azure) */
  provider: LLMProvider;
  /** API key for authentication */
  apiKey: string;
  /** Model name/deployment to use */
  model: string;
  /** Temperature for response randomness (0.0 - 1.0) */
  temperature: number;
  /** Maximum tokens in response */
  maxTokens: number;
  /** API version for Azure OpenAI */
  apiVersion?: string;
  /** Azure OpenAI endpoint URL */
  endpoint?: string;
  /** Azure OpenAI deployment name */
  deployment?: string;
}

/**
 * Feature specification extracted from documentation
 */
export interface FeatureSpec {
  /** Feature name */
  name: string;
  /** Purpose and description of the feature */
  purpose: string;
  /** Input parameters and types */
  inputs: FeatureInput[];
  /** Output parameters and types */
  outputs: FeatureOutput[];
  /** Success criteria for the feature */
  successCriteria: string[];
  /** Known failure modes */
  failureModes: string[];
  /** Edge cases to consider */
  edgeCases: string[];
  /** Dependencies on other features */
  dependencies: string[];
}

/**
 * Feature input specification
 */
export interface FeatureInput {
  /** Input parameter name */
  name: string;
  /** Input data type */
  type: string;
  /** Whether input is required */
  required: boolean;
  /** Input description */
  description: string;
}

/**
 * Feature output specification
 */
export interface FeatureOutput {
  /** Output parameter name */
  name: string;
  /** Output data type */
  type: string;
  /** Output description */
  description: string;
}

/**
 * Discovered feature from documentation
 */
export interface DiscoveredFeature {
  /** Feature type (cli, ui, api) */
  type: string;
  /** Feature name */
  name: string;
  /** Context from documentation */
  context: string;
  /** Source file path */
  source: string;
}

/**
 * ComprehensionAgent configuration
 */
export interface ComprehensionAgentConfig {
  /** LLM configuration */
  llm: LLMConfig;
  /** Documentation directory to scan */
  docsDir: string;
  /** File patterns to include */
  includePatterns: string[];
  /** File patterns to exclude */
  excludePatterns: string[];
  /** Maximum context length for LLM */
  maxContextLength: number;
}
