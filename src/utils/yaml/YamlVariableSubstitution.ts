/**
 * Variable substitution and interpolation for YAML content
 */

import { VariableContext, YamlParserConfig } from './types';

/**
 * Handles ${var.path} substitution throughout parsed YAML structures.
 */
export class YamlVariableSubstitution {
  constructor(private config: YamlParserConfig) {}

  /**
   * Recursively substitute variables in any value (string, object, or array).
   */
  substitute(content: any, variables: VariableContext): any {
    if (typeof content === 'string') {
      return this.substituteString(content, variables);
    }

    if (typeof content !== 'object' || content === null) {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(item => this.substitute(item, variables));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(content)) {
      result[key] = this.substitute(value, variables);
    }

    return result;
  }

  /**
   * Replace ${path.to.var} placeholders in a string.
   * Returns the original placeholder when the variable is not found.
   */
  private substituteString(str: string, variables: VariableContext): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, expression) => {
      try {
        const parts = expression.split('.');
        let value: any = variables;

        for (const part of parts) {
          if (value && typeof value === 'object' && part in value) {
            value = value[part];
          } else {
            return match;
          }
        }

        if (parts.length >= 2 && this.config.variableResolvers[parts[0]]) {
          value = this.config.variableResolvers[parts[0]](value);
        }

        return String(value);
      } catch {
        return match;
      }
    });
  }

  /**
   * Extract all variable declarations from YAML content.
   */
  extractVariables(content: any): Record<string, any> {
    const variables: Record<string, any> = {};

    const extract = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;

      if (Array.isArray(obj)) {
        obj.forEach(item => extract(item));
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        if (key === 'variables' && typeof value === 'object') {
          Object.assign(variables, value);
        } else {
          extract(value);
        }
      }
    };

    extract(content);
    return variables;
  }

  /**
   * Create a default variable context populated with process environment variables.
   */
  createDefaultContext(): VariableContext {
    return {
      env: { ...process.env, ...this.config.defaultEnvironment } as Record<string, string>,
      global: {},
      scenario: {}
    };
  }
}
