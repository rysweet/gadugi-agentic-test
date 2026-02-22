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
 * Print a formatted summary of a TestSession to stdout.
 */
export function displayResults(session: TestSession): void {
  console.log('\n' + '='.repeat(60));
  console.log('TEST SESSION RESULTS');
  console.log('='.repeat(60));
  console.log(`Session ID: ${session.id}`);

  const duration =
    session.endTime && session.startTime
      ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
      : 0;
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log(`Total Tests: ${session.summary.total}`);
  console.log(`Passed: ${session.summary.passed}`);
  console.log(`Failed: ${session.summary.failed}`);
  console.log(`Skipped: ${session.summary.skipped}`);

  const passRate =
    session.summary.total > 0
      ? (session.summary.passed / session.summary.total) * 100
      : 0;
  console.log(`Pass Rate: ${passRate.toFixed(1)}%`);
}

/**
 * Perform a dry run: display what would be executed without running anything.
 */
export async function performDryRun(
  scenarios: TestScenario[],
  suite: string
): Promise<void> {
  const filteredScenarios = filterScenariosForSuite(scenarios, suite);

  console.log('\n' + '='.repeat(60));
  console.log('DRY RUN MODE - Not executing tests');
  console.log('='.repeat(60));
  console.log(
    `Would execute ${filteredScenarios.length} scenarios for suite '${suite}':`
  );

  for (const scenario of filteredScenarios) {
    console.log(
      `  - [${scenario.interface || TestInterface.CLI}] ${scenario.id}: ${scenario.name}`
    );
    if (scenario.description) {
      console.log(`    ${scenario.description}`);
    }
    if (scenario.tags && scenario.tags.length > 0) {
      console.log(`    Tags: ${scenario.tags.join(', ')}`);
    }
  }
}
