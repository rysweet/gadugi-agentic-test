/**
 * Scenarios module - Test scenario management
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';

/** Raw YAML document parsed at runtime — structure is not known at compile time */
type RawYaml = Record<string, unknown>;

// Scenario loader utility
export class ScenarioLoader {
  static async loadFromFile(filePath: string): Promise<ScenarioDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const raw = yaml.load(content, { schema: yaml.JSON_SCHEMA }) as RawYaml;

    // Handle three formats:
    // Format 1: Top-level name, steps, assertions (canonical format)
    // Format 2: Top-level application, scenarios array (legacy format)
    // Format 3: scenario: { name, steps, ... } (wrapped format)
    if (raw['scenario'] && typeof raw['scenario'] === 'object') {
      // Wrapped format - unwrap and validate
      return this.validateScenario(raw['scenario'] as RawYaml);
    } else if (raw['scenarios'] && Array.isArray(raw['scenarios'])) {
      // Legacy format with application/scenarios - convert
      return this.convertLegacyFormat(raw);
    } else {
      // Canonical format - validate directly
      return this.validateScenario(raw);
    }
  }

  static async loadFromDirectory(dirPath: string): Promise<ScenarioDefinition[]> {
    const files = await fs.readdir(dirPath);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    const scenarios = await Promise.all(
      yamlFiles.map(f => this.loadFromFile(path.join(dirPath, f)))
    );

    return scenarios;
  }

  private static convertLegacyFormat(raw: RawYaml): ScenarioDefinition {
    // Legacy format has application + scenarios array
    // Convert first scenario to new format (for now, only load first scenario)
    const scenarios = raw['scenarios'] as RawYaml[];
    const firstScenario = scenarios[0];
    const application = raw['application'] as RawYaml | undefined;

    const descStr = raw['description'] !== undefined ? String(raw['description']) : firstScenario['description'] !== undefined ? String(firstScenario['description']) : undefined;
    const verStr = raw['version'] !== undefined ? String(raw['version']) : undefined;
    return {
      name: String(raw['name'] || firstScenario['name'] || ''),
      ...(descStr !== undefined ? { description: descStr } : {}),
      ...(verStr !== undefined ? { version: verStr } : {}),
      config: { timeout: (typeof application?.['timeout'] === 'number' ? application['timeout'] * 1000 : 0) || 120000 },
      environment: { requires: [] },
      agents: [{ name: 'tui-agent', type: 'tui', config: {} }],
      steps: (firstScenario['steps'] as RawYaml[]).map((s: RawYaml) => ({
        name: String(s['description'] || s['action'] || ''),
        agent: 'tui-agent',
        action: String(s['action'] || ''),
        params: { input: s['input'], conditions: s['conditions'] },
        timeout: (Array.isArray(s['conditions']) && s['conditions'].length > 0 && typeof (s['conditions'] as RawYaml[])[0]['timeout'] === 'number'
          ? ((s['conditions'] as RawYaml[])[0]['timeout'] as number) * 1000
          : 0) || 30000
      })),
      assertions: Array.isArray(firstScenario['assertions'])
        ? (firstScenario['assertions'] as RawYaml[]).map((a: RawYaml) => ({
            name: String(a['description'] || a['type'] || ''),
            type: String(a['type'] || ''),
            agent: 'tui-agent',
            params: { value: a['value'], description: a['description'] }
          }))
        : [],
      cleanup: [],
      metadata: {
        tags: ['legacy-format'],
        priority: 'medium'
      }
    };
  }

  private static validateScenario(scenario: RawYaml): ScenarioDefinition {
    if (!scenario['name']) {
      throw new Error('Scenario must have a name');
    }
    if (!scenario['steps'] || !Array.isArray(scenario['steps'])) {
      throw new Error('Scenario must have steps array');
    }
    if (!scenario['agents'] || !Array.isArray(scenario['agents']) || scenario['agents'].length === 0) {
      throw new Error('Scenario must have at least one agent');
    }
    return scenario as unknown as ScenarioDefinition;
  }
}

// Scenario interfaces
export interface ScenarioDefinition {
  name: string;
  description?: string;
  version?: string;
  config?: ScenarioConfig;
  environment?: EnvironmentConfig;
  agents: AgentConfig[];
  steps: TestStep[];
  assertions: TestAssertion[];
  cleanup?: TestStep[];
  metadata?: ScenarioMetadata;
}

/** @deprecated Use ScenarioDefinition instead - renamed to resolve naming conflict with models/TestModels.TestScenario. Will be removed in v2.0. */
export type TestScenario = ScenarioDefinition;

export interface ScenarioConfig {
  timeout?: number;
  retries?: number;
  parallel?: boolean;
}

export interface EnvironmentConfig {
  requires?: string[];
  optional?: string[];
}

export interface AgentConfig {
  name: string;
  type: string;
  config?: Record<string, unknown>;
}

export interface TestStep {
  name: string;
  agent: string;
  action: string;
  params?: Record<string, unknown>;
  timeout?: number;
  wait_for?: WaitCondition;
  until?: UntilCondition;
}

export interface WaitCondition {
  selector?: string;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  timeout?: number;
}

export interface UntilCondition {
  condition: 'contains' | 'equals' | 'matches';
  value: unknown;
  timeout?: number;
}

export interface TestAssertion {
  name: string;
  type: string;
  agent: string;
  params: Record<string, unknown>;
}

export interface ScenarioMetadata {
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  author?: string;
  created?: string;
  updated?: string;
}
