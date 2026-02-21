/**
 * File loading and YAML include processing
 */

import * as yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { YamlParseError, YamlParserConfig } from './types';

/**
 * Handles reading YAML files from disk and processing include directives.
 */
export class YamlLoader {
  private processedFiles: Set<string> = new Set();

  constructor(private config: YamlParserConfig) {}

  /**
   * Read a YAML file and return the parsed object. Uses JSON_SCHEMA to prevent
   * execution of !!js/function and similar dangerous YAML tags.
   */
  async readFile(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA }) as any;

    if (!parsed) {
      throw new YamlParseError('Empty or invalid YAML file', filePath);
    }

    return parsed;
  }

  /**
   * Process include directives recursively, guarding against path traversal and
   * circular includes.
   */
  async processIncludes(content: any, baseDir: string, depth: number): Promise<any> {
    if (depth > this.config.maxIncludeDepth) {
      throw new YamlParseError(`Maximum include depth of ${this.config.maxIncludeDepth} exceeded`);
    }

    if (typeof content !== 'object' || content === null) {
      return content;
    }

    if (Array.isArray(content)) {
      return Promise.all(content.map(item => this.processIncludes(item, baseDir, depth)));
    }

    if (content.include && typeof content.include === 'string') {
      const includePath = path.resolve(baseDir, content.include);

      const allowedBase = path.resolve(this.config.baseDir);
      if (!includePath.startsWith(allowedBase + path.sep) && includePath !== allowedBase) {
        throw new YamlParseError(`Include path escapes base directory: ${content.include}`);
      }

      if (this.processedFiles.has(includePath)) {
        throw new YamlParseError(`Circular include detected: ${includePath}`);
      }

      this.processedFiles.add(includePath);

      try {
        const includeContent = await fs.readFile(includePath, 'utf-8');
        const parsed = yaml.load(includeContent, { schema: yaml.JSON_SCHEMA });

        let result = parsed;
        if (content.variables && typeof parsed === 'object') {
          result = this.mergeVariables(parsed, content.variables);
        }

        return this.processIncludes(result, path.dirname(includePath), depth + 1);
      } finally {
        this.processedFiles.delete(includePath);
      }
    }

    const result: any = {};
    for (const [key, value] of Object.entries(content)) {
      result[key] = await this.processIncludes(value, baseDir, depth);
    }

    return result;
  }

  private mergeVariables(content: any, variables: Record<string, any>): any {
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return content;
    }

    return { ...content, variables: { ...content.variables, ...variables } };
  }
}
