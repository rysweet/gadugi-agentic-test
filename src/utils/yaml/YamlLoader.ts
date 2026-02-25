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
  async readFile(filePath: string): Promise<unknown> {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA });

    if (!parsed) {
      throw new YamlParseError('Empty or invalid YAML file', filePath);
    }

    return parsed;
  }

  /**
   * Process include directives recursively, guarding against path traversal and
   * circular includes.
   */
  async processIncludes(content: unknown, baseDir: string, depth: number): Promise<unknown> {
    if (depth > this.config.maxIncludeDepth) {
      throw new YamlParseError(`Maximum include depth of ${this.config.maxIncludeDepth} exceeded`);
    }

    if (typeof content !== 'object' || content === null) {
      return content;
    }

    if (Array.isArray(content)) {
      return Promise.all(content.map(item => this.processIncludes(item, baseDir, depth)));
    }

    const contentObj = content as Record<string, unknown>;
    if (contentObj['include'] && typeof contentObj['include'] === 'string') {
      const includePath = path.resolve(baseDir, contentObj['include']);

      const allowedBase = path.resolve(this.config.baseDir);
      if (!includePath.startsWith(allowedBase + path.sep) && includePath !== allowedBase) {
        throw new YamlParseError(`Include path escapes base directory: ${contentObj['include']}`);
      }

      if (this.processedFiles.has(includePath)) {
        throw new YamlParseError(`Circular include detected: ${includePath}`);
      }

      this.processedFiles.add(includePath);

      try {
        const includeContent = await fs.readFile(includePath, 'utf-8');
        const parsed = yaml.load(includeContent, { schema: yaml.JSON_SCHEMA });

        let result: unknown = parsed;
        if (contentObj['variables'] && typeof parsed === 'object' && parsed !== null) {
          result = this.mergeVariables(parsed, contentObj['variables'] as Record<string, unknown>);
        }

        return this.processIncludes(result, path.dirname(includePath), depth + 1);
      } finally {
        this.processedFiles.delete(includePath);
      }
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(contentObj)) {
      result[key] = await this.processIncludes(value, baseDir, depth);
    }

    return result;
  }

  private mergeVariables(content: object, variables: Record<string, unknown>): unknown {
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return content;
    }

    const c = content as Record<string, unknown>;
    return { ...c, variables: { ...(c['variables'] as Record<string, unknown> | undefined), ...variables } };
  }
}
