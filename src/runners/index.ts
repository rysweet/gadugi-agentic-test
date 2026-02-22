/**
 * Test Runners Module
 * 
 * This module exports all test runners for the Agentic Testing System.
 * These runners are TypeScript implementations that replace the original JavaScript test runners.
 */

// Smart UI Test Runner - Uses Playwright's accessibility tree and element detection
import {
  SmartUITestRunner,
  createSmartUITestRunner,
  runSmartUITests
} from './SmartUITestRunner';
export { SmartUITestRunner, createSmartUITestRunner, runSmartUITests };

// Comprehensive UI Test Runner - Systematically exercises all tabs and features
import {
  ComprehensiveUITestRunner,
  createComprehensiveUITestRunner,
  runComprehensiveUITests
} from './ComprehensiveUITestRunner';
export { ComprehensiveUITestRunner, createComprehensiveUITestRunner, runComprehensiveUITests };

// Re-export common types for convenience
export type { TestResult, TestStatus } from '../models/TestModels';

/**
 * Available test runners
 */
export const TestRunners = {
  Smart: 'SmartUITestRunner',
  Comprehensive: 'ComprehensiveUITestRunner'
} as const;

export type TestRunnerType = typeof TestRunners[keyof typeof TestRunners];

/**
 * Runner configuration interface
 */
export interface RunnerConfig {
  screenshotsDir?: string;
  timeout?: number;
  headless?: boolean;
  slowMo?: number;
}

/**
 * Factory function to create any test runner by type
 */
export function createTestRunner(
  type: TestRunnerType,
  config?: RunnerConfig
) {
  switch (type) {
    case TestRunners.Smart:
      return createSmartUITestRunner(config?.screenshotsDir);
    case TestRunners.Comprehensive:
      return createComprehensiveUITestRunner(config?.screenshotsDir);
    default:
      throw new Error(`Unknown test runner type: ${type}`);
  }
}

/**
 * Run any test runner by type
 */
export async function runTestRunner(
  type: TestRunnerType,
  config?: RunnerConfig
) {
  switch (type) {
    case TestRunners.Smart:
      return await runSmartUITests(config?.screenshotsDir);
    case TestRunners.Comprehensive:
      return await runComprehensiveUITests(config?.screenshotsDir);
    default:
      throw new Error(`Unknown test runner type: ${type}`);
  }
}