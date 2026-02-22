/**
 * ScenarioLoader
 * Scenario discovery, loading, and suite-filtering logic extracted from lib.ts.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { pathExists } from 'fs-extra';
import { OrchestratorScenario } from '../models/TestModels';
import { logger } from '../utils/logger';
import { parseScenariosFromString } from '../utils/yamlParser';

// Backward-compatible alias
type TestScenario = OrchestratorScenario;

/**
 * Configuration for a single named test suite
 */
export interface SuiteConfig {
  name: string;
  description: string;
  patterns: string[];
  tags: string[];
}

/**
 * Built-in suite definitions.
 * 'smoke' and 'regression'/'full' differ only in pattern coverage.
 */
export const TEST_SUITES: Record<string, SuiteConfig> = {
  smoke: {
    name: 'smoke',
    description: 'Quick smoke tests for critical functionality',
    patterns: ['smoke:', 'critical:', 'auth:'],
    tags: ['smoke', 'critical', 'auth']
  },
  regression: {
    name: 'regression',
    description: 'Full regression test suite',
    patterns: ['*'],
    tags: []
  },
  full: {
    name: 'full',
    description: 'Complete test suite including all scenarios',
    patterns: ['*'],
    tags: []
  }
};

/**
 * Discover and load OrchestratorScenario objects.
 *
 * If `scenarioFiles` is provided those files are loaded; otherwise every
 * `.yaml` / `.yml` in `<cwd>/scenarios/` is loaded.
 */
export async function loadTestScenarios(
  scenarioFiles?: string[]
): Promise<TestScenario[]> {
  const scenarios: TestScenario[] = [];
  const scenarioDir = path.join(process.cwd(), 'scenarios');

  if (scenarioFiles && scenarioFiles.length > 0) {
    for (const file of scenarioFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileScenarios = await parseScenariosFromString(content);
        scenarios.push(...fileScenarios);
        logger.debug(`Loaded ${fileScenarios.length} scenarios from ${file}`);
      } catch (error) {
        logger.error(`Failed to load scenarios from ${file}:`, error);
      }
    }
  } else {
    try {
      if (await pathExists(scenarioDir)) {
        const files = await fs.readdir(scenarioDir);
        const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

        for (const file of yamlFiles) {
          const filePath = path.join(scenarioDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const fileScenarios = await parseScenariosFromString(content);
          scenarios.push(...fileScenarios);
          logger.debug(`Loaded ${fileScenarios.length} scenarios from ${file}`);
        }
      } else {
        logger.warn(`Scenario directory not found: ${scenarioDir}`);
      }
    } catch (error) {
      logger.error('Failed to load scenarios from directory:', error);
    }
  }

  logger.info(`Loaded ${scenarios.length} total test scenarios`);
  return scenarios;
}

/**
 * Filter scenarios according to the named suite's pattern rules.
 *
 * Patterns ending in `:` are prefix matches; patterns containing `*` are
 * treated as simple globs; all others require an exact id or tag match.
 */
export function filterScenariosForSuite(
  scenarios: TestScenario[],
  suite: string
): TestScenario[] {
  const suiteConfig = TEST_SUITES[suite];
  if (!suiteConfig) {
    logger.warn(`Unknown test suite: ${suite}, using all scenarios`);
    return scenarios;
  }

  const patterns = suiteConfig.patterns;
  if (patterns.includes('*')) return scenarios;

  const filtered: TestScenario[] = [];

  for (const scenario of scenarios) {
    for (const pattern of patterns) {
      if (pattern.endsWith(':')) {
        const prefix = pattern.slice(0, -1);
        if (
          scenario.id.startsWith(prefix) ||
          scenario.tags?.some(tag => tag.startsWith(prefix))
        ) {
          filtered.push(scenario);
          break;
        }
      } else if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (
          regex.test(scenario.id) ||
          scenario.tags?.some(tag => regex.test(tag))
        ) {
          filtered.push(scenario);
          break;
        }
      } else {
        if (
          scenario.id === pattern ||
          scenario.tags?.includes(pattern)
        ) {
          filtered.push(scenario);
          break;
        }
      }
    }
  }

  return filtered;
}
