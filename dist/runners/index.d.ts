/**
 * Test Runners Module
 *
 * This module exports all test runners for the Agentic Testing System.
 * These runners are TypeScript implementations that replace the original JavaScript test runners.
 */
export { SmartUITestRunner, createSmartUITestRunner, runSmartUITests } from './SmartUITestRunner';
export { ComprehensiveUITestRunner, createComprehensiveUITestRunner, runComprehensiveUITests } from './ComprehensiveUITestRunner';
export type { TestResult, TestStatus, OrchestratorStep } from '../models/TestModels';
/**
 * Available test runners
 */
export declare const TestRunners: {
    readonly Smart: "SmartUITestRunner";
    readonly Comprehensive: "ComprehensiveUITestRunner";
};
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
export declare function createTestRunner(type: TestRunnerType, config?: RunnerConfig): any;
/**
 * Run any test runner by type
 */
export declare function runTestRunner(type: TestRunnerType, config?: RunnerConfig): Promise<any>;
//# sourceMappingURL=index.d.ts.map