/**
 * OutputComprehender - LLM-based feature analysis and documentation loading
 */

import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import { ComprehensionAgentConfig, FeatureSpec, FeatureInput, FeatureOutput } from './types';

// Re-export DocumentationLoader so existing imports of it from this module still work
export { DocumentationLoader } from './DocumentationLoader';

/**
 * Uses an LLM client (OpenAI or Azure OpenAI) to analyse feature documentation
 * and produce structured FeatureSpec objects.
 */
export class OutputComprehender {
  private config: ComprehensionAgentConfig;
  private llmClient: OpenAI | null = null;

  constructor(config: ComprehensionAgentConfig) {
    this.config = config;
  }

  /** Initialise the OpenAI / Azure OpenAI client */
  async initialize(): Promise<void> {
    const { llm } = this.config;

    if (!llm.apiKey || llm.apiKey.trim() === '') {
      throw new Error(`LLM provider '${llm.provider}' requires an API key. Set the appropriate environment variable.`);
    }

    if (llm.provider === 'azure') {
      if (!llm.endpoint || !llm.deployment) {
        throw new Error('Azure OpenAI requires endpoint and deployment configuration');
      }
      this.llmClient = new OpenAI({
        apiKey: llm.apiKey,
        baseURL: `${llm.endpoint}/openai/deployments/${llm.deployment}`,
        defaultQuery: { 'api-version': llm.apiVersion || '2024-02-01' },
        defaultHeaders: { 'api-key': llm.apiKey }
      });
      logger.info(`Initialized Azure OpenAI client with deployment: ${llm.deployment}`);
    } else {
      this.llmClient = new OpenAI({ apiKey: llm.apiKey });
      logger.info('Initialized OpenAI client');
    }
  }

  /** Release the LLM client */
  cleanup(): void {
    this.llmClient = null;
  }

  /**
   * Analyse feature documentation with the LLM and return a FeatureSpec.
   * Errors from the LLM call are propagated to the caller.
   */
  async analyzeFeature(featureDoc: string): Promise<FeatureSpec> {
    logger.debug('Analyzing feature with LLM');

    const client = await this.getClient();
    const { llm } = this.config;

    const context = featureDoc.length > this.config.maxContextLength
      ? `${featureDoc.substring(0, this.config.maxContextLength)  }...`
      : featureDoc;

    const response = await client.chat.completions.create({
      model: llm.model,
      messages: [
        {
          role: 'system',
          content: 'You are a test scenario generator and feature analyst. Extract structured information from documentation and return valid JSON only.'
        },
        { role: 'user', content: this.buildPrompt(context) }
      ],
      temperature: llm.temperature,
      max_tokens: llm.maxTokens
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content in LLM response');

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in LLM response');

    return this.parseFeatureSpec(JSON.parse(jsonMatch[0]));
  }

  private async getClient(): Promise<OpenAI> {
    if (!this.llmClient) {
      await this.initialize();
    }
    return this.llmClient!;
  }

  private buildPrompt(context: string): string {
    return `Analyze this feature documentation and extract structured information.

Documentation:
${context}

Extract and return ONLY valid JSON in this exact format:
{
  "name": "feature name",
  "purpose": "what the feature does",
  "inputs": [
    {"name": "input1", "type": "string", "required": true, "description": "..."}
  ],
  "outputs": [
    {"name": "output1", "type": "object", "description": "..."}
  ],
  "success_criteria": [
    "criterion 1",
    "criterion 2"
  ],
  "failure_modes": [
    "possible failure 1",
    "possible failure 2"
  ],
  "edge_cases": [
    "edge case 1",
    "edge case 2"
  ],
  "dependencies": ["dependency1", "dependency2"]
}`;
  }

  private parseFeatureSpec(data: any): FeatureSpec {
    return {
      name: data.name || 'Unknown Feature',
      purpose: data.purpose || 'Purpose not specified',
      inputs: (data.inputs || []).map((input: any): FeatureInput => ({
        name: input.name || 'unknown',
        type: input.type || 'any',
        required: input.required !== false,
        description: input.description || ''
      })),
      outputs: (data.outputs || []).map((output: any): FeatureOutput => ({
        name: output.name || 'result',
        type: output.type || 'any',
        description: output.description || ''
      })),
      successCriteria: data.success_criteria || data.successCriteria || ['Feature executes successfully'],
      failureModes: data.failure_modes || data.failureModes || ['Feature fails to execute'],
      edgeCases: data.edge_cases || data.edgeCases || [],
      dependencies: data.dependencies || []
    };
  }
}
