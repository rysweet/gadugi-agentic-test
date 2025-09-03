/**
 * Test Runners Module
 * 
 * This module exports all test runners for the Agentic Testing System.
 * These runners are TypeScript implementations that replace the original JavaScript test runners.
 */

// Smart UI Test Runner - Uses Playwright's accessibility tree and element detection
export {
  SmartUITestRunner,
  createSmartUITestRunner,
  runSmartUITests
} from './SmartUITestRunner';

// Comprehensive UI Test Runner - Systematically exercises all tabs and features
export {
  ComprehensiveUITestRunner,
  createComprehensiveUITestRunner,
  runComprehensiveUITests
} from './ComprehensiveUITestRunner';

// Re-export common types for convenience
export type { TestResult, TestStatus, TestStep } from '../models/TestModels';

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
  // Dynamic imports to avoid circular dependencies
  switch (type) {
    case TestRunners.Smart: {
      const { createSmartUITestRunner } = require('./SmartUITestRunner');
      return createSmartUITestRunner(config?.screenshotsDir);
    }
    case TestRunners.Comprehensive: {
      const { createComprehensiveUITestRunner } = require('./ComprehensiveUITestRunner');
      return createComprehensiveUITestRunner(config?.screenshotsDir);
    }
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
  // Dynamic imports to avoid circular dependencies
  switch (type) {
    case TestRunners.Smart: {
      const { runSmartUITests } = require('./SmartUITestRunner');
      return await runSmartUITests(config?.screenshotsDir);
    }
    case TestRunners.Comprehensive: {
      const { runComprehensiveUITests } = require('./ComprehensiveUITestRunner');
      return await runComprehensiveUITests(config?.screenshotsDir);
    }
    default:
      throw new Error(`Unknown test runner type: ${type}`);
  }
}