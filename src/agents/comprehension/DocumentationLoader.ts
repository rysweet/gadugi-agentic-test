/**
 * DocumentationLoader - Loads markdown documentation files and extracts feature candidates.
 */

import { readFile } from 'fs/promises';
import { join, relative } from 'path';
import { glob } from 'glob';
import { logger } from '../../utils/logger';
import { DiscoveredFeature } from './types';

/**
 * Loads markdown documentation files and extracts feature candidates using regex patterns.
 */
export class DocumentationLoader {
  private docsDir: string;
  private includePatterns: string[];
  private excludePatterns: string[];
  private cliCommandPatterns: RegExp[];

  constructor(
    docsDir: string = 'docs',
    includePatterns: string[] = ['**/*.md'],
    excludePatterns: string[] = ['**/node_modules/**'],
    cliCommandPatterns: RegExp[] = []
  ) {
    this.docsDir = docsDir;
    this.includePatterns = includePatterns;
    this.excludePatterns = excludePatterns;
    this.cliCommandPatterns = cliCommandPatterns;
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
   * CLI command extraction uses the configured cliCommandPatterns (default: none).
   */
  extractFeatures(content: string): DiscoveredFeature[] {
    const features: DiscoveredFeature[] = [];

    // CLI commands — only patterns supplied by the caller; no app-specific defaults
    for (const pattern of this.cliCommandPatterns) {
      // Reset lastIndex before each exec loop to avoid stale state on reused regexes
      pattern.lastIndex = 0;
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
