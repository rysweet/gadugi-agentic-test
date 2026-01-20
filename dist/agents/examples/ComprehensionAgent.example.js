"use strict";
/**
 * ComprehensionAgent Usage Examples
 *
 * This file demonstrates how to use the ComprehensionAgent to discover features from
 * documentation and generate comprehensive test scenarios.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.basicOpenAIExample = basicOpenAIExample;
exports.azureOpenAIExample = azureOpenAIExample;
exports.analyzeSpecificFeatureExample = analyzeSpecificFeatureExample;
exports.customPatternsExample = customPatternsExample;
exports.runAllExamples = runAllExamples;
const ComprehensionAgent_1 = require("../ComprehensionAgent");
const logger_1 = require("../../utils/logger");
/**
 * Example 1: Basic ComprehensionAgent usage with OpenAI
 */
async function basicOpenAIExample() {
    logger_1.logger.info('Starting basic OpenAI ComprehensionAgent example');
    // Create agent with OpenAI configuration
    const agent = (0, ComprehensionAgent_1.createComprehensionAgent)({
        llm: {
            provider: 'openai',
            apiKey: process.env.OPENAI_API_KEY,
            model: 'gpt-4',
            temperature: 0.1,
            maxTokens: 4000
        },
        docsDir: './docs',
        includePatterns: ['**/*.md'],
        excludePatterns: ['**/node_modules/**', '**/dist/**']
    });
    try {
        // Initialize the agent
        await agent.initialize();
        // Discover features from documentation
        const features = await agent.discoverFeatures();
        logger_1.logger.info(`Discovered ${features.length} features`);
        // Process a single feature
        if (features.length > 0) {
            const firstFeature = features[0];
            logger_1.logger.info(`Analyzing feature: ${firstFeature.name}`);
            const featureSpec = await agent.analyzeFeature(firstFeature.context);
            const scenarios = await agent.generateTestScenarios(featureSpec);
            logger_1.logger.info(`Generated ${scenarios.length} test scenarios for ${featureSpec.name}`);
            scenarios.forEach((scenario, index) => {
                logger_1.logger.info(`  ${index + 1}. ${scenario.name} (${scenario.priority})`);
            });
        }
        // Cleanup
        await agent.cleanup();
    }
    catch (error) {
        logger_1.logger.error(`Example failed: ${error}`);
    }
}
/**
 * Example 2: Azure OpenAI configuration
 */
async function azureOpenAIExample() {
    logger_1.logger.info('Starting Azure OpenAI ComprehensionAgent example');
    const config = {
        llm: {
            provider: 'azure',
            apiKey: process.env.AZURE_OPENAI_KEY,
            model: 'gpt-4',
            temperature: 0.1,
            maxTokens: 4000,
            endpoint: process.env.AZURE_OPENAI_ENDPOINT,
            deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
            apiVersion: '2024-02-01'
        },
        docsDir: './docs',
        includePatterns: ['**/*.md'],
        excludePatterns: ['**/node_modules/**'],
        maxContextLength: 8000
    };
    const agent = new ComprehensionAgent_1.ComprehensionAgent(config);
    try {
        await agent.initialize();
        // Process all discovered features and generate scenarios
        const allScenarios = await agent.processDiscoveredFeatures();
        logger_1.logger.info(`Generated ${allScenarios.length} total test scenarios`);
        // Group scenarios by interface type
        const scenariosByInterface = allScenarios.reduce((acc, scenario) => {
            const key = scenario.interface;
            if (!acc[key])
                acc[key] = [];
            acc[key].push(scenario);
            return acc;
        }, {});
        Object.entries(scenariosByInterface).forEach(([interfaceType, scenarios]) => {
            logger_1.logger.info(`${interfaceType}: ${scenarios.length} scenarios`);
        });
        await agent.cleanup();
    }
    catch (error) {
        logger_1.logger.error(`Azure example failed: ${error}`);
    }
}
/**
 * Example 3: Analyzing a specific feature documentation
 */
async function analyzeSpecificFeatureExample() {
    logger_1.logger.info('Starting specific feature analysis example');
    const agent = (0, ComprehensionAgent_1.createComprehensionAgent)({});
    const featureDocumentation = `
# Build Command

The \`app build\` command processes application resources and builds the data layer.

## Usage

\`\`\`bash
npm run app build --config <CONFIG_FILE>
\`\`\`

## Options

- \`--config\`: Configuration file path (required)
- \`--limit\`: Limit number of items for testing
- \`--debug\`: Enable debug output

## Success Criteria

- Database is populated with processed resources
- Resource relationships are correctly established
- Progress dashboard shows completion status

## Failure Modes

- Invalid configuration provided
- Authentication fails
- Database container not running
- Network connectivity issues

## Edge Cases

- Large datasets with thousands of resources
- Empty datasets
- Partial processing due to permissions
  `;
    try {
        await agent.initialize();
        // Analyze the specific feature
        const featureSpec = await agent.analyzeFeature(featureDocumentation);
        logger_1.logger.info(`Feature Analysis Results:`);
        logger_1.logger.info(`Name: ${featureSpec.name}`);
        logger_1.logger.info(`Purpose: ${featureSpec.purpose}`);
        logger_1.logger.info(`Success Criteria: ${featureSpec.successCriteria.length} items`);
        logger_1.logger.info(`Failure Modes: ${featureSpec.failureModes.length} items`);
        logger_1.logger.info(`Edge Cases: ${featureSpec.edgeCases.length} items`);
        // Generate test scenarios
        const scenarios = await agent.generateTestScenarios(featureSpec);
        logger_1.logger.info(`\nGenerated Test Scenarios:`);
        scenarios.forEach((scenario, index) => {
            logger_1.logger.info(`${index + 1}. ${scenario.name}`);
            logger_1.logger.info(`   Priority: ${scenario.priority}`);
            logger_1.logger.info(`   Interface: ${scenario.interface}`);
            logger_1.logger.info(`   Steps: ${scenario.steps.length}`);
            logger_1.logger.info(`   Expected: ${scenario.expectedOutcome}`);
            logger_1.logger.info('');
        });
        await agent.cleanup();
    }
    catch (error) {
        logger_1.logger.error(`Specific feature example failed: ${error}`);
    }
}
/**
 * Example 4: Custom documentation patterns
 */
async function customPatternsExample() {
    logger_1.logger.info('Starting custom patterns example');
    const agent = (0, ComprehensionAgent_1.createComprehensionAgent)({
        docsDir: './custom-docs',
        includePatterns: ['**/*.md', '**/*.txt', '**/README*'],
        excludePatterns: ['**/node_modules/**', '**/temp/**', '**/*.log'],
        maxContextLength: 6000
    });
    try {
        await agent.initialize();
        // Discover features with custom patterns
        const features = await agent.discoverFeatures();
        logger_1.logger.info(`Discovered features by type:`);
        const featuresByType = features.reduce((acc, feature) => {
            if (!acc[feature.type])
                acc[feature.type] = 0;
            acc[feature.type]++;
            return acc;
        }, {});
        Object.entries(featuresByType).forEach(([type, count]) => {
            logger_1.logger.info(`  ${type}: ${count} features`);
        });
        // Show some examples
        logger_1.logger.info('\nExample CLI features:');
        features.filter(f => f.type === 'cli').slice(0, 3).forEach(feature => {
            logger_1.logger.info(`  - ${feature.name} (from ${feature.source})`);
        });
        logger_1.logger.info('\nExample UI features:');
        features.filter(f => f.type === 'ui').slice(0, 3).forEach(feature => {
            logger_1.logger.info(`  - ${feature.name} (from ${feature.source})`);
        });
        await agent.cleanup();
    }
    catch (error) {
        logger_1.logger.error(`Custom patterns example failed: ${error}`);
    }
}
/**
 * Run all examples
 */
async function runAllExamples() {
    logger_1.logger.info('Running all ComprehensionAgent examples');
    try {
        // Check if required environment variables are set
        if (process.env.OPENAI_API_KEY) {
            await basicOpenAIExample();
        }
        else {
            logger_1.logger.warn('OPENAI_API_KEY not set, skipping OpenAI example');
        }
        if (process.env.AZURE_OPENAI_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
            await azureOpenAIExample();
        }
        else {
            logger_1.logger.warn('Azure OpenAI environment variables not set, skipping Azure example');
        }
        // These examples don't require API keys (will fail gracefully)
        await analyzeSpecificFeatureExample();
        await customPatternsExample();
        logger_1.logger.info('All examples completed');
    }
    catch (error) {
        logger_1.logger.error(`Examples execution failed: ${error}`);
    }
}
// Export default for easy import
exports.default = {
    basicOpenAIExample,
    azureOpenAIExample,
    analyzeSpecificFeatureExample,
    customPatternsExample,
    runAllExamples
};
//# sourceMappingURL=ComprehensionAgent.example.js.map