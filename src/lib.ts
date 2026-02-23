/**
 * Programmatic library API for the Agentic Testing System
 *
 * This module provides all non-CLI functionality: configuration,
 * scenario loading, filtering, result persistence, and the
 * programmatic `runTests()` entry point. It intentionally has
 * NO Commander imports and NO process-level side effects (signal
 * handlers, unhandledRejection listeners, etc.).
 *
 * Business logic lives in the sub-modules under src/lib/:
 *   - ConfigurationLoader  – default config factory + file loading
 *   - ScenarioLoader       – YAML scenario discovery + suite filtering
 *   - ResultsHandler       – result persistence + display + dry-run
 *
 * NOTE: setupGracefulShutdown has been moved to src/cli/setup.ts.
 * It is a CLI-only concern and must NOT be part of the library API.
 */

import { v4 as uuidv4 } from 'uuid';

// Core modules
import { TestOrchestrator, createTestOrchestrator } from './orchestrator';
import { TestConfig } from './models/Config';
import { TestSession, TestStatus } from './models/TestModels';
import { setupLogger, LogLevel } from './utils/logger';

// Sub-module re-exports
export { createDefaultConfig, loadConfiguration } from './lib/ConfigurationLoader';
export type { CliArguments } from './lib/ConfigurationLoader';
export { loadTestScenarios, filterScenariosForSuite, TEST_SUITES } from './lib/ScenarioLoader';
export type { SuiteConfig } from './lib/ScenarioLoader';
export { saveResults, displayResults, performDryRun } from './lib/ResultsHandler';

// Import for internal use inside runTests
import { createDefaultConfig, loadConfiguration } from './lib/ConfigurationLoader';
import { loadTestScenarios } from './lib/ScenarioLoader';
import { saveResults, performDryRun } from './lib/ResultsHandler';

/**
 * Programmatic API options for running tests
 */
export interface ProgrammaticTestOptions {
  configPath?: string;
  suite?: 'smoke' | 'full' | 'regression';
  scenarioFiles?: string[];
  config?: Partial<TestConfig>;
  dryRun?: boolean;
  outputFile?: string;
}

/**
 * Run tests programmatically.
 *
 * This function does NOT install signal handlers.
 * CLI entry points that need graceful shutdown should import
 * \`setupGracefulShutdown\` from \`./cli/setup\` (CLI-only).
 */
export async function runTests(options: ProgrammaticTestOptions = {}): Promise<TestSession> {
  const opts: ProgrammaticTestOptions = {
    configPath: './config/test-config.yaml',
    suite: 'smoke',
    dryRun: false,
    ...options
  };

  setupLogger({ level: LogLevel.INFO });

  const baseConfig = opts.configPath
    ? await loadConfiguration(opts.configPath, { noIssues: false })
    : createDefaultConfig();

  const config = opts.config ? { ...baseConfig, ...opts.config } : baseConfig;

  const scenarios = await loadTestScenarios(opts.scenarioFiles);
  const orchestrator = createTestOrchestrator(config);

  // NOTE: No setupGracefulShutdown() call here.
  // Signal handlers belong in the CLI path, not the library path.

  if (opts.dryRun) {
    await performDryRun(scenarios, opts.suite || 'smoke');
    return {
      id: uuidv4(),
      startTime: new Date(),
      endTime: new Date(),
      status: TestStatus.PASSED,
      results: [],
      summary: { total: scenarios.length, passed: 0, failed: 0, skipped: 0 }
    };
  }

  const session = await orchestrator.run(opts.suite, opts.scenarioFiles);

  if (opts.outputFile) {
    await saveResults(session, opts.outputFile);
  }

  return session;
}

// Re-export types that library consumers need
export {
  TestOrchestrator,
  createTestOrchestrator,
  TestStatus,
  LogLevel,
  setupLogger
};
export type { TestConfig } from './models/Config';
export type { TestSession } from './models/TestModels';

export { TestInterface } from './models/TestModels';
export type { TestResult, TestSuite, OrchestratorScenario } from './models/TestModels';
/** @deprecated Use OrchestratorScenario */
export type { OrchestratorScenario as TestScenario } from './models/TestModels';
