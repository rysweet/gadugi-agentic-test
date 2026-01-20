/**
 * ComprehensionAgent - Uses LLM to understand features from documentation and generate test scenarios
 *
 * This agent analyzes documentation files to extract feature information and generate comprehensive
 * test scenarios using large language models (OpenAI GPT or Azure OpenAI).
 */
import { IAgent } from './index';
import { TestScenario } from '../models/TestModels';
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
/**
 * Documentation loader for parsing markdown files and extracting features
 */
export declare class DocumentationLoader {
    private docsDir;
    private includePatterns;
    private excludePatterns;
    constructor(docsDir?: string, includePatterns?: string[], excludePatterns?: string[]);
    /**
     * Load all markdown documentation files
     * @returns Dictionary of file paths to content
     */
    loadMarkdownFiles(): Promise<Record<string, string>>;
    /**
     * Find documentation files matching include/exclude patterns
     * @returns Array of file paths
     */
    private findDocumentationFiles;
    /**
     * Extract feature descriptions from documentation content
     * @param content - Documentation content
     * @returns List of discovered features
     */
    extractFeatures(content: string): DiscoveredFeature[];
    /**
     * Check if a header text indicates a UI feature
     * @param headerText - Header text in lowercase
     * @returns True if UI feature
     */
    private isUIFeature;
}
/**
 * ComprehensionAgent - Main agent class for feature comprehension and test generation
 */
export declare class ComprehensionAgent implements IAgent {
    name: string;
    type: string;
    private config;
    private docLoader;
    private llmClient;
    constructor(config: ComprehensionAgentConfig);
    /**
     * Initialize the agent and LLM client
     */
    initialize(): Promise<void>;
    /**
     * Execute test scenario (not used for ComprehensionAgent)
     * @param scenario - Test scenario to execute
     * @returns Execution result
     */
    execute(scenario: any): Promise<any>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Initialize the LLM client based on configuration
     */
    private initializeLLMClient;
    /**
     * Get or create LLM client
     * @returns OpenAI client instance
     */
    private getLLMClient;
    /**
     * Analyze a feature from documentation using LLM
     * @param featureDoc - Feature documentation text
     * @returns FeatureSpec with extracted information
     */
    analyzeFeature(featureDoc: string): Promise<FeatureSpec>;
    /**
     * Build the feature analysis prompt for LLM
     * @param context - Feature documentation context
     * @returns Formatted prompt
     */
    private buildFeatureAnalysisPrompt;
    /**
     * Parse feature specification from LLM response data
     * @param data - Raw LLM response data
     * @returns Parsed FeatureSpec
     */
    private parseFeatureSpec;
    /**
     * Generate test scenarios from feature specification
     * @param featureSpec - Feature specification
     * @returns List of test scenarios
     */
    generateTestScenarios(featureSpec: FeatureSpec): Promise<TestScenario[]>;
    /**
     * Generate a success path test scenario
     * @param spec - Feature specification
     * @param scenarioId - Scenario ID number
     * @returns Success test scenario
     */
    private generateSuccessScenario;
    /**
     * Generate a failure mode test scenario
     * @param spec - Feature specification
     * @param failureMode - Specific failure mode to test
     * @param scenarioId - Scenario ID number
     * @returns Failure test scenario
     */
    private generateFailureScenario;
    /**
     * Generate an edge case test scenario
     * @param spec - Feature specification
     * @param edgeCase - Specific edge case to test
     * @param scenarioId - Scenario ID number
     * @returns Edge case test scenario
     */
    private generateEdgeCaseScenario;
    /**
     * Determine test interface based on feature name
     * @param featureName - Name of the feature
     * @returns Test interface type
     */
    private determineInterface;
    /**
     * Check if feature is CLI-related
     * @param featureName - Feature name in lowercase
     * @returns True if CLI feature
     */
    private isCLIFeature;
    /**
     * Check if feature is GUI-related
     * @param featureName - Feature name in lowercase
     * @returns True if GUI feature
     */
    private isGUIFeature;
    /**
     * Check if feature is API-related
     * @param featureName - Feature name in lowercase
     * @returns True if API feature
     */
    private isAPIFeature;
    /**
     * Generate success path test steps
     * @param spec - Feature specification
     * @returns Array of test steps
     */
    private generateSuccessSteps;
    /**
     * Generate failure mode test steps
     * @param spec - Feature specification
     * @param failureMode - Failure mode to test
     * @returns Array of test steps
     */
    private generateFailureSteps;
    /**
     * Generate edge case test steps
     * @param spec - Feature specification
     * @param edgeCase - Edge case to test
     * @returns Array of test steps
     */
    private generateEdgeCaseSteps;
    /**
     * Generate verification steps
     * @param spec - Feature specification
     * @returns Array of verification steps
     */
    private generateVerificationSteps;
    /**
     * Discover features from documentation
     * @returns List of discovered features
     */
    discoverFeatures(): Promise<DiscoveredFeature[]>;
    /**
     * Process all discovered features and generate comprehensive test scenarios
     * @returns Comprehensive list of test scenarios
     */
    processDiscoveredFeatures(): Promise<TestScenario[]>;
}
/**
 * Create a ComprehensionAgent instance with default configuration
 * @param config - Partial configuration to override defaults
 * @returns Configured ComprehensionAgent instance
 */
export declare function createComprehensionAgent(config: Partial<ComprehensionAgentConfig>): ComprehensionAgent;
/**
 * Default configuration for ComprehensionAgent
 */
export declare const defaultComprehensionAgentConfig: ComprehensionAgentConfig;
//# sourceMappingURL=ComprehensionAgent.d.ts.map