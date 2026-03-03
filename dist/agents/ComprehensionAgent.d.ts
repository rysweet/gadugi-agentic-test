/**
 * ComprehensionAgent (facade)
 *
 * Thin coordinator that delegates to:
 *   - DocumentationLoader  – finds and loads markdown files, extracts feature candidates
 *   - OutputComprehender   – calls an LLM to analyse feature docs → FeatureSpec
 *   - ScenarioComprehender – converts FeatureSpec → OrchestratorScenario[]
 */
import { IAgent, IPipelineAgent, AgentType } from './index';
import { OrchestratorScenario } from '../models/TestModels';
import { ComprehensionAgentConfig, FeatureSpec, DiscoveredFeature } from './comprehension/types';
export type { ComprehensionAgentConfig, LLMConfig, LLMProvider, FeatureSpec, FeatureInput, FeatureOutput, DiscoveredFeature } from './comprehension/types';
export { DocumentationLoader } from './comprehension/DocumentationLoader';
/**
 * ComprehensionAgent - Main agent class for feature comprehension and test generation
 *
 * Implements IPipelineAgent because it generates test scenarios from documentation
 * rather than executing them. The primary API is analyzeFeature(),
 * generateTestScenarios(), and processDiscoveredFeatures().
 *
 * Also implements IAgent for backward compatibility. The execute() method
 * returns a skip notice and should not be used in production.
 */
export declare class ComprehensionAgent implements IAgent, IPipelineAgent {
    name: string;
    type: AgentType;
    /** @inheritdoc IPipelineAgent */
    readonly isPipelineAgent: true;
    private docLoader;
    private outputComprehender;
    private scenarioComprehender;
    constructor(config: ComprehensionAgentConfig);
    /** Initialize the LLM client */
    initialize(): Promise<void>;
    /**
     * ComprehensionAgent generates scenarios; it does not execute them.
     *
     * @deprecated Do not call execute() on a pipeline agent.
     * Use analyzeFeature(), generateTestScenarios(), or processDiscoveredFeatures() instead.
     * This method exists only for IAgent backward compatibility.
     */
    execute(_scenario: unknown): Promise<unknown>;
    /** Release the LLM client */
    cleanup(): Promise<void>;
    /**
     * Analyse a feature from documentation using the LLM.
     * Returns a FeatureSpec, or a minimal stub on LLM error.
     */
    analyzeFeature(featureDoc: string): Promise<FeatureSpec>;
    /**
     * Generate test scenarios from feature specification.
     * Returns success, failure, and edge-case scenarios.
     */
    generateTestScenarios(featureSpec: FeatureSpec): Promise<OrchestratorScenario[]>;
    /**
     * Discover features from documentation files.
     */
    discoverFeatures(): Promise<DiscoveredFeature[]>;
    /**
     * Process all discovered features and generate comprehensive test scenarios.
     */
    processDiscoveredFeatures(): Promise<OrchestratorScenario[]>;
}
/**
 * Create a ComprehensionAgent instance with sensible defaults, overridable by config.
 */
export declare function createComprehensionAgent(config: Partial<ComprehensionAgentConfig>): ComprehensionAgent;
/**
 * Default configuration for ComprehensionAgent
 */
export declare const defaultComprehensionAgentConfig: ComprehensionAgentConfig;
//# sourceMappingURL=ComprehensionAgent.d.ts.map