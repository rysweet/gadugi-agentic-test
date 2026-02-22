/**
 * OutputComprehender - LLM-based feature analysis and documentation loading
 */

import { readFile } from 'fs/promises';
import { join, relative } from 'path';
import { glob } from 'glob';
import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import { ComprehensionAgentConfig, FeatureSpec, FeatureInput, FeatureOutput, DiscoveredFeature } from './types';

/**
 * Loads markdown documentation files and extracts feature candidates using regex patterns.
 */
export class DocumentationLoader {
  private docsDir: string;
  private includePatterns: string[];
  private excludePatterns: string[];

  constructor(
    docsDir: string = 'docs',
    includePatterns: string[] = ['**/*.md'],
    excludePatterns: string[] = ['**/node_modules/**']
  ) {
    this.docsDir = docsDir;
    this.includePatterns = includePatterns;
    this.excludePatterns = excludePatterns;
  }

  /**
   * Load all markdown documentation files matching the configured patterns.
   * Returns a map of relative file path to file content.
   */
  async loadMarkdownFiles(): Promise<Record<string, string>> {
    const docs: Record<string, string> = {};

    try {
      const files = await this.findDocumentationFiles();
      logger.info(`Found ${files.length} documentation files to process`);

      for (const file of files) {
        try {
          const content = await readFile(file, 'utf-8');
          const relativePath = relative(process.cwd(), file);
          docs[relativePath] = content;
          logger.debug(`Loaded documentation: ${relativePath}`);
        } catch (error) {
          logger.error(`Failed to load ${file}: ${error}`);
        }
      }

      return docs;
    } catch (error) {
      logger.error(`Error loading documentation files: ${error}`);
      return {};
    }
  }

  /**
   * Extract feature descriptions (CLI commands, UI sections, API endpoints) from content.
   */
  extractFeatures(content: string): DiscoveredFeature[] {
    const features: DiscoveredFeature[] = [];

    // CLI commands
    const cliPatterns = [
      /`atg\s+([a-z-]+)`/gi,
      /`azure-tenant-grapher\s+([a-z-]+)`/gi,
      /`uv run atg\s+([a-z-]+)`/gi
    ];

    for (const pattern of cliPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(content.length, match.index + match[0].length + 200);
        features.push({
          type: 'cli',
          name: match[1],
          context: content.substring(contextStart, contextEnd),
          source: ''
        });
      }
    }

    // UI features from headers
    const headerPattern = /^#{1,3}\s+(.+)$/gm;
    let match;
    while ((match = headerPattern.exec(content)) !== null) {
      if (this.isUIFeature(match[1].toLowerCase())) {
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(content.length, match.index + 500);
        features.push({
          type: 'ui',
          name: match[1],
          context: content.substring(contextStart, contextEnd),
          source: ''
        });
      }
    }

    // API endpoints
    const apiPattern = /(?:GET|POST|PUT|DELETE|PATCH)\s+([/\w-]+)/gi;
    while ((match = apiPattern.exec(content)) !== null) {
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(content.length, match.index + match[0].length + 100);
      features.push({
        type: 'api',
        name: match[1],
        context: content.substring(contextStart, contextEnd),
        source: ''
      });
    }

    return features;
  }

  private isUIFeature(headerText: string): boolean {
    const uiKeywords = [
      'tab', 'button', 'page', 'dialog', 'menu', 'panel', 'widget',
      'form', 'input', 'dropdown', 'checkbox', 'radio', 'slider',
      'spa', 'gui', 'interface', 'navigation', 'sidebar', 'toolbar'
    ];
    return uiKeywords.some(kw => headerText.includes(kw));
  }

  private async findDocumentationFiles(): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of this.includePatterns) {
      try {
        const files = await glob(join(this.docsDir, pattern), {
          ignore: this.excludePatterns.map(p => join(this.docsDir, p))
        });
        allFiles.push(...files);
      } catch (error) {
        logger.error(`Error searching for files with pattern ${pattern}: ${error}`);
      }
    }

    return Array.from(new Set(allFiles));
  }
}

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
      ? featureDoc.substring(0, this.config.maxContextLength) + '...'
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
