/**
 * ComprehensionAgent (facade)
 *
 * Thin coordinator that delegates to:
 *   - DocumentationLoader  – finds and loads markdown files, extracts feature candidates
 *   - OutputComprehender   – calls an LLM to analyse feature docs → FeatureSpec
 *   - ScenarioComprehender – converts FeatureSpec → OrchestratorScenario[]
 */

import { logger } from '../utils/logger';
import { IAgent, AgentType } from './index';
import { OrchestratorScenario } from '../models/TestModels';
import { ComprehensionAgentConfig, FeatureSpec, DiscoveredFeature } from './comprehension/types';
import { DocumentationLoader, OutputComprehender } from './comprehension/OutputComprehender';
import { ScenarioComprehender } from './comprehension/ScenarioComprehender';

// Re-export types so existing import sites continue to work
export type {
  ComprehensionAgentConfig,
  LLMConfig,
  LLMProvider,
  FeatureSpec,
  FeatureInput,
  FeatureOutput,
  DiscoveredFeature
} from './comprehension/types';

// Re-export DocumentationLoader for backward compatibility with tests
export { DocumentationLoader } from './comprehension/OutputComprehender';

/**
 * ComprehensionAgent - Main agent class for feature comprehension and test generation
 */
export class ComprehensionAgent implements IAgent {
  name = 'ComprehensionAgent';
  type = AgentType.COMPREHENSION;

  private config: ComprehensionAgentConfig;
  private docLoader: DocumentationLoader;
  private outputComprehender: OutputComprehender;
  private scenarioComprehender: ScenarioComprehender;

  constructor(config: ComprehensionAgentConfig) {
    this.config = config;
    this.docLoader = new DocumentationLoader(
      config.docsDir,
      config.includePatterns,
      config.excludePatterns
    );
    this.outputComprehender = new OutputComprehender(config);
    this.scenarioComprehender = new ScenarioComprehender();
  }

  /** Initialize the LLM client */
  async initialize(): Promise<void> {
    logger.info('Initializing ComprehensionAgent');
    try {
      await this.outputComprehender.initialize();
      logger.info('ComprehensionAgent initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize ComprehensionAgent: ${error}`);
      throw error;
    }
  }

  /** ComprehensionAgent generates scenarios; it does not execute them */
  async execute(_scenario: any): Promise<any> {
    logger.warn('ComprehensionAgent.execute() called - this agent generates scenarios, not executes them');
    return { status: 'skipped', reason: 'ComprehensionAgent does not execute scenarios' };
  }

  /** Release the LLM client */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up ComprehensionAgent');
    this.outputComprehender.cleanup();
  }

  /**
   * Analyse a feature from documentation using the LLM.
   * Returns a FeatureSpec, or a minimal stub on LLM error.
   */
  async analyzeFeature(featureDoc: string): Promise<FeatureSpec> {
    return this.outputComprehender.analyzeFeature(featureDoc);
  }

  /**
   * Generate test scenarios from feature specification.
   * Returns success, failure, and edge-case scenarios.
   */
  async generateTestScenarios(featureSpec: FeatureSpec): Promise<OrchestratorScenario[]> {
    logger.info(`Generating test scenarios for feature: ${featureSpec.name}`);
    const scenarios = await this.scenarioComprehender.generateTestScenarios(featureSpec);
    logger.info(`Generated ${scenarios.length} test scenarios for ${featureSpec.name}`);
    return scenarios;
  }

  /**
   * Discover features from documentation files.
   */
  async discoverFeatures(): Promise<DiscoveredFeature[]> {
    logger.info('Discovering features from documentation');

    try {
      const docs = await this.docLoader.loadMarkdownFiles();
      const allFeatures: DiscoveredFeature[] = [];

      for (const [docPath, content] of Object.entries(docs)) {
        const features = this.docLoader.extractFeatures(content);
        for (const feature of features) {
          feature.source = docPath;
        }
        allFeatures.push(...features);
      }

      logger.info(`Discovered ${allFeatures.length} features from documentation`);
      return allFeatures;
    } catch (error) {
      logger.error(`Error discovering features: ${error}`);
      return [];
    }
  }

  /**
   * Process all discovered features and generate comprehensive test scenarios.
   */
  async processDiscoveredFeatures(): Promise<OrchestratorScenario[]> {
    logger.info('Processing discovered features and generating test scenarios');

    try {
      const discoveredFeatures = await this.discoverFeatures();
      const allScenarios: OrchestratorScenario[] = [];

      for (const feature of discoveredFeatures) {
        try {
          logger.debug(`Analyzing feature: ${feature.name}`);
          const featureSpec = await this.analyzeFeature(feature.context);
          const scenarios = await this.generateTestScenarios(featureSpec);
          allScenarios.push(...scenarios);
        } catch (error) {
          logger.error(`Failed to process feature ${feature.name}: ${error}`);
        }
      }

      logger.info(`Generated ${allScenarios.length} total test scenarios from ${discoveredFeatures.length} features`);
      return allScenarios;
    } catch (error) {
      logger.error(`Error processing features: ${error}`);
      return [];
    }
  }
}

/**
 * Create a ComprehensionAgent instance with sensible defaults, overridable by config.
 */
export function createComprehensionAgent(config: Partial<ComprehensionAgentConfig>): ComprehensionAgent {
  const defaultConfig: ComprehensionAgentConfig = {
    llm: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      temperature: 0.1,
      maxTokens: 4000,
      apiVersion: '2024-02-01'
    },
    docsDir: 'docs',
    includePatterns: ['**/*.md'],
    excludePatterns: ['**/node_modules/**'],
    maxContextLength: 8000
  };

  // Override with Azure configuration if environment variables are present
  if (process.env.AZURE_OPENAI_ENDPOINT) {
    defaultConfig.llm = {
      ...defaultConfig.llm,
      provider: 'azure',
      apiKey: process.env.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_API_KEY || '',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01'
    };
  }

  const finalConfig = { ...defaultConfig, ...config };
  if (config.llm) {
    finalConfig.llm = { ...defaultConfig.llm, ...config.llm };
  }

  return new ComprehensionAgent(finalConfig);
}

/**
 * Default configuration for ComprehensionAgent
 */
export const defaultComprehensionAgentConfig: ComprehensionAgentConfig = {
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 4000
  },
  docsDir: 'docs',
  includePatterns: ['**/*.md'],
  excludePatterns: ['**/node_modules/**'],
  maxContextLength: 8000
};
