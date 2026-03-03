"use strict";
/**
 * ComprehensionAgent (facade)
 *
 * Thin coordinator that delegates to:
 *   - DocumentationLoader  – finds and loads markdown files, extracts feature candidates
 *   - OutputComprehender   – calls an LLM to analyse feature docs → FeatureSpec
 *   - ScenarioComprehender – converts FeatureSpec → OrchestratorScenario[]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultComprehensionAgentConfig = exports.ComprehensionAgent = exports.DocumentationLoader = void 0;
exports.createComprehensionAgent = createComprehensionAgent;
const logger_1 = require("../utils/logger");
const index_1 = require("./index");
const DocumentationLoader_1 = require("./comprehension/DocumentationLoader");
const OutputComprehender_1 = require("./comprehension/OutputComprehender");
const ScenarioComprehender_1 = require("./comprehension/ScenarioComprehender");
// Re-export DocumentationLoader for backward compatibility with tests
var DocumentationLoader_2 = require("./comprehension/DocumentationLoader");
Object.defineProperty(exports, "DocumentationLoader", { enumerable: true, get: function () { return DocumentationLoader_2.DocumentationLoader; } });
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
class ComprehensionAgent {
    constructor(config) {
        this.name = 'ComprehensionAgent';
        this.type = index_1.AgentType.COMPREHENSION;
        /** @inheritdoc IPipelineAgent */
        this.isPipelineAgent = true;
        this.docLoader = new DocumentationLoader_1.DocumentationLoader(config.docsDir, config.includePatterns, config.excludePatterns, config.cliCommandPatterns);
        this.outputComprehender = new OutputComprehender_1.OutputComprehender(config);
        this.scenarioComprehender = new ScenarioComprehender_1.ScenarioComprehender();
    }
    /** Initialize the LLM client */
    async initialize() {
        logger_1.logger.info('Initializing ComprehensionAgent');
        try {
            await this.outputComprehender.initialize();
            logger_1.logger.info('ComprehensionAgent initialized successfully');
        }
        catch (error) {
            logger_1.logger.error(`Failed to initialize ComprehensionAgent: ${error}`);
            throw error;
        }
    }
    /**
     * ComprehensionAgent generates scenarios; it does not execute them.
     *
     * @deprecated Do not call execute() on a pipeline agent.
     * Use analyzeFeature(), generateTestScenarios(), or processDiscoveredFeatures() instead.
     * This method exists only for IAgent backward compatibility.
     */
    async execute(_scenario) {
        logger_1.logger.warn('ComprehensionAgent.execute() called - this agent generates scenarios, not executes them');
        return { status: 'skipped', reason: 'ComprehensionAgent does not execute scenarios' };
    }
    /** Release the LLM client */
    async cleanup() {
        logger_1.logger.info('Cleaning up ComprehensionAgent');
        this.outputComprehender.cleanup();
    }
    /**
     * Analyse a feature from documentation using the LLM.
     * Returns a FeatureSpec, or a minimal stub on LLM error.
     */
    async analyzeFeature(featureDoc) {
        return this.outputComprehender.analyzeFeature(featureDoc);
    }
    /**
     * Generate test scenarios from feature specification.
     * Returns success, failure, and edge-case scenarios.
     */
    async generateTestScenarios(featureSpec) {
        logger_1.logger.info(`Generating test scenarios for feature: ${featureSpec.name}`);
        const scenarios = await this.scenarioComprehender.generateTestScenarios(featureSpec);
        logger_1.logger.info(`Generated ${scenarios.length} test scenarios for ${featureSpec.name}`);
        return scenarios;
    }
    /**
     * Discover features from documentation files.
     */
    async discoverFeatures() {
        logger_1.logger.info('Discovering features from documentation');
        try {
            const docs = await this.docLoader.loadMarkdownFiles();
            const allFeatures = [];
            for (const [docPath, content] of Object.entries(docs)) {
                const features = this.docLoader.extractFeatures(content);
                for (const feature of features) {
                    feature.source = docPath;
                }
                allFeatures.push(...features);
            }
            logger_1.logger.info(`Discovered ${allFeatures.length} features from documentation`);
            return allFeatures;
        }
        catch (error) {
            logger_1.logger.error(`Error discovering features: ${error}`);
            return [];
        }
    }
    /**
     * Process all discovered features and generate comprehensive test scenarios.
     */
    async processDiscoveredFeatures() {
        logger_1.logger.info('Processing discovered features and generating test scenarios');
        try {
            const discoveredFeatures = await this.discoverFeatures();
            const allScenarios = [];
            for (const feature of discoveredFeatures) {
                try {
                    logger_1.logger.debug(`Analyzing feature: ${feature.name}`);
                    const featureSpec = await this.analyzeFeature(feature.context);
                    const scenarios = await this.generateTestScenarios(featureSpec);
                    allScenarios.push(...scenarios);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to process feature ${feature.name}: ${error}`);
                }
            }
            logger_1.logger.info(`Generated ${allScenarios.length} total test scenarios from ${discoveredFeatures.length} features`);
            return allScenarios;
        }
        catch (error) {
            logger_1.logger.error(`Error processing features: ${error}`);
            return [];
        }
    }
}
exports.ComprehensionAgent = ComprehensionAgent;
/**
 * Create a ComprehensionAgent instance with sensible defaults, overridable by config.
 */
function createComprehensionAgent(config) {
    const defaultConfig = {
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
        maxContextLength: 8000,
        cliCommandPatterns: []
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
exports.defaultComprehensionAgentConfig = {
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
    maxContextLength: 8000,
    cliCommandPatterns: []
};
//# sourceMappingURL=ComprehensionAgent.js.map