/**
 * Legacy entry point for the Agentic Testing System
 *
 * This module exists for backwards compatibility. All library
 * functionality has moved to ./lib.ts, and the CLI lives in
 * ./cli.ts. This file is a thin wrapper that delegates to the
 * CLI when executed directly.
 *
 * IMPORTANT: Importing this module no longer triggers argv
 * parsing or installs signal handlers.
 */

// Re-export the programmatic library API so existing consumers
// that import from './main' continue to work.
export {
  TEST_SUITES,
  createDefaultConfig,
  loadConfiguration,
  loadTestScenarios,
  filterScenariosForSuite,
  saveResults,
  displayResults,
  performDryRun,
  runTests,
  TestOrchestrator,
  createTestOrchestrator
} from './lib';
export type {
  CliArguments,
  ProgrammaticTestOptions,
  TestConfig,
  TestSession,
  TestResult,
  OrchestratorScenario
} from './lib';

/**
 * @deprecated setupGracefulShutdown has moved to src/cli/setup.ts.
 * Import from './cli/setup' in CLI entry points only.
 * This re-export will be removed in the next major release.
 */
export { setupGracefulShutdown } from './cli/setup';

// Re-export TestStatus for backwards compatibility
export { TestStatus } from './models/TestModels';

import { logger } from './utils/logger';

/**
 * Run the CLI when this module is executed directly.
 *
 * Dynamically imports cli.ts to avoid pulling in Commander
 * and its dependencies at library-import time.
 */
export function run(): void {
  import('./cli').then((cli) => {
    // cli.ts exports `program` as default; parse argv
    cli.default.parse();
  }).catch((error) => {
    logger.error('Failed to start CLI:', error);
    process.exit(1);
  });
}

// Execute if called directly
if (require.main === module) {
  run();
}
