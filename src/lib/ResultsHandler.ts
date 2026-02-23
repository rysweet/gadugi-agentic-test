/**
 * ResultsHandler
 * Result persistence and display logic extracted from lib.ts.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  TestSession,
  TestInterface,
  OrchestratorScenario
} from '../models/TestModels';
import { logger } from '../utils/logger';
import { filterScenariosForSuite } from './ScenarioLoader';

// Backward-compatible alias
type TestScenario = OrchestratorScenario;

/**
 * Persist a TestSession to a JSON file at `outputPath`.
 * Creates intermediate directories as needed.
 */
export async function saveResults(
  session: TestSession,
  outputPath: string
): Promise<void> {
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  const resultsData = {
    sessionId: session.id,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime?.toISOString() || null,
    summary: session.summary,
    results: session.results
  };

  await fs.writeFile(outputPath, JSON.stringify(resultsData, null, 2));
  logger.info(`Results saved to: ${outputPath}`);
}

/**
 * Log a formatted summary of a TestSession via the structured logger.
 * Uses logger.info instead of console.log so that library consumers can
 * control log output (suppression, redirection, structured sinks).
 */
export function displayResults(session: TestSession): void {
  const duration =
    session.endTime && session.startTime
      ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
      : 0;

  const passRate =
    session.summary.total > 0
      ? (session.summary.passed / session.summary.total) * 100
      : 0;

  logger.info('TEST SESSION RESULTS', {
    sessionId: session.id,
    duration: `${duration.toFixed(2)} seconds`,
    total: session.summary.total,
    passed: session.summary.passed,
    failed: session.summary.failed,
    skipped: session.summary.skipped,
    passRate: `${passRate.toFixed(1)}%`,
  });
}

/**
 * Perform a dry run: log what would be executed without running anything.
 */
export async function performDryRun(
  scenarios: TestScenario[],
  suite: string
): Promise<void> {
  const filteredScenarios = filterScenariosForSuite(scenarios, suite);

  logger.info('DRY RUN MODE - Not executing tests', {
    suite,
    scenarioCount: filteredScenarios.length,
  });

  for (const scenario of filteredScenarios) {
    const meta: Record<string, unknown> = {
      interface: scenario.interface || TestInterface.CLI,
      id: scenario.id,
      name: scenario.name,
    };
    if (scenario.description) {
      meta.description = scenario.description;
    }
    if (scenario.tags && scenario.tags.length > 0) {
      meta.tags = scenario.tags;
    }
    logger.info('  scenario', meta);
  }
}
