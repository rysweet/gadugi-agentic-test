/**
 * Scenarios module - Test scenario management
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';

// Scenario loader utility
export class ScenarioLoader {
  static async loadFromFile(filePath: string): Promise<ScenarioDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const raw = yaml.load(content, { schema: yaml.JSON_SCHEMA }) as any;

    // Handle three formats:
    // Format 1: Top-level name, steps, assertions (canonical format)
    // Format 2: Top-level application, scenarios array (legacy format)
    // Format 3: scenario: { name, steps, ... } (wrapped format)
    if (raw.scenario && typeof raw.scenario === 'object') {
      // Wrapped format - unwrap and validate
      return this.validateScenario(raw.scenario);
    } else if (raw.scenarios && Array.isArray(raw.scenarios)) {
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

  private static convertLegacyFormat(raw: any): ScenarioDefinition {
    // Legacy format has application + scenarios array
    // Convert first scenario to new format (for now, only load first scenario)
    const firstScenario = raw.scenarios[0];

    return {
      name: raw.name || firstScenario.name,
      description: raw.description || firstScenario.description,
      version: raw.version,
      config: { timeout: raw.application?.timeout * 1000 || 120000 },
      environment: { requires: [] },
      agents: [{ name: 'tui-agent', type: 'tui', config: {} }],
      steps: firstScenario.steps.map((s: any) => ({
        name: s.description || s.action,
        agent: 'tui-agent',
        action: s.action,
        params: { input: s.input, conditions: s.conditions },
        timeout: s.conditions?.[0]?.timeout * 1000 || 30000
      })),
      assertions: firstScenario.assertions?.map((a: any) => ({
        name: a.description || a.type,
        type: a.type,
        agent: 'tui-agent',
        params: { value: a.value, description: a.description }
      })) || [],
      cleanup: [],
      metadata: {
        tags: ['legacy-format'],
        priority: 'medium'
      }
    };
  }

  private static validateScenario(scenario: any): ScenarioDefinition {
    if (!scenario.name) {
      throw new Error('Scenario must have a name');
    }
    if (!scenario.steps || !Array.isArray(scenario.steps)) {
      throw new Error('Scenario must have steps array');
    }
    if (!scenario.agents || !Array.isArray(scenario.agents) || scenario.agents.length === 0) {
      throw new Error('Scenario must have at least one agent');
    }
    return scenario as ScenarioDefinition;
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
  config?: Record<string, any>;
}

export interface TestStep {
  name: string;
  agent: string;
  action: string;
  params?: Record<string, any>;
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
  value: any;
  timeout?: number;
}

export interface TestAssertion {
  name: string;
  type: string;
  agent: string;
  params: Record<string, any>;
}

export interface ScenarioMetadata {
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  author?: string;
  created?: string;
  updated?: string;
}