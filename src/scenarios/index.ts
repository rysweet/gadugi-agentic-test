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
  static async loadFromFile(filePath: string): Promise<ScenarioDefinition[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const raw = yaml.load(content, { schema: yaml.JSON_SCHEMA }) as RawYaml;

    // Handle three formats:
    // Format 1: Top-level name, steps, assertions (canonical format)
    // Format 2: Top-level application, scenarios array (legacy format)
    // Format 3: scenario: { name, steps, ... } (wrapped format)
    if (raw['scenario'] && typeof raw['scenario'] === 'object') {
      return [this.validateScenario(raw['scenario'] as RawYaml)];
    } else if (raw['scenarios'] && Array.isArray(raw['scenarios'])) {
      return this.convertLegacyFormat(raw);
    } else {
      return [this.validateScenario(raw)];
    }
  }

  static async loadFromDirectory(dirPath: string): Promise<ScenarioDefinition[]> {
    const files = await fs.readdir(dirPath);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    const results = await Promise.allSettled(
      yamlFiles.map(f => this.loadFromFile(path.join(dirPath, f)))
    );

    const scenarios: ScenarioDefinition[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        scenarios.push(...result.value);
      } else {
        const filePath = path.join(dirPath, yamlFiles[i]);
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`Warning: Failed to load scenario from ${filePath}: ${reason}`);
      }
    }

    return scenarios;
  }

  private static convertLegacyFormat(raw: RawYaml): ScenarioDefinition[] {
    const rawScenarios = raw['scenarios'] as RawYaml[];
    const application = raw['application'] as RawYaml | undefined;
    const suiteVersion = raw['version'] !== undefined ? String(raw['version']) : undefined;
    const suiteTimeout = (typeof application?.['timeout'] === 'number'
      ? application['timeout'] * 1000 : 0) || 120000;

    return rawScenarios.map((scenario: RawYaml) => {
      // Per-scenario type takes precedence; fall back to suite-level type
      const scenarioType = String(scenario['type'] || raw['type'] || '').toLowerCase();
      const isCli = scenarioType === 'cli';
      const agentName = isCli ? 'cli-agent' : 'tui-agent';
      const agentType = isCli ? 'cli' : 'tui';

      const descStr = scenario['description'] !== undefined
        ? String(scenario['description'])
        : raw['description'] !== undefined
          ? String(raw['description'])
          : undefined;

      return {
        name: String(scenario['name'] || raw['name'] || ''),
        ...(descStr !== undefined ? { description: descStr } : {}),
        ...(suiteVersion !== undefined ? { version: suiteVersion } : {}),
        config: { timeout: suiteTimeout },
        environment: { requires: [] },
        agents: [{ name: agentName, type: agentType, config: {} }],
        steps: Array.isArray(scenario['steps'])
          ? (scenario['steps'] as RawYaml[]).map((s: RawYaml) => {
              const stepType = String(s['type'] || s['action'] || '').toLowerCase();
              const isCommand = stepType === 'command';

              return {
                name: String(s['description'] || s['command'] || s['action'] || ''),
                agent: agentName,
                action: isCommand ? 'command' : String(s['action'] || stepType),
                ...(isCommand && s['command'] ? { target: String(s['command']) } : {}),
                ...((s['expected_output'] ?? s['expected']) !== undefined
                  ? { expected: String(s['expected_output'] ?? s['expected']) } : {}),
                params: {
                  input: s['input'],
                  conditions: s['conditions'],
                  ...(s['command'] ? { command: String(s['command']) } : {})
                },
                timeout: (Array.isArray(s['conditions']) && s['conditions'].length > 0
                  && typeof (s['conditions'] as RawYaml[])[0]['timeout'] === 'number'
                  ? ((s['conditions'] as RawYaml[])[0]['timeout'] as number) * 1000
                  : 0) || 30000
              };
            })
          : [],
        assertions: Array.isArray(scenario['assertions'])
          ? (scenario['assertions'] as RawYaml[]).map((a: RawYaml) => ({
              name: String(a['description'] || a['type'] || ''),
              type: String(a['type'] || ''),
              agent: agentName,
              params: { value: a['value'], description: a['description'] }
            }))
          : [],
        cleanup: [],
        metadata: {
          tags: ['legacy-format'],
          priority: 'medium'
        }
      };
    });
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
  /** Direct target (e.g. CLI command string) — preferred over params extraction */
  target?: string;
  /** Expected output or result for validation */
  expected?: string;
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
