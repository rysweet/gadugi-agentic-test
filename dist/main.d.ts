/**
 * Main entry point for the Agentic Testing System
 *
 * This module provides the core functionality for initializing and running
 * the testing system, including configuration management, agent initialization,
 * and orchestrator setup. It supports both CLI and programmatic usage.
 */
import { TestOrchestrator, createTestOrchestrator } from './orchestrator';
import { TestConfig } from './models/Config';
import { TestSession, TestResult, OrchestratorScenario } from './models/TestModels';
/**
 * Command line arguments interface
 */
export interface CliArguments {
    config: string;
    suite: 'smoke' | 'full' | 'regression';
    dryRun: boolean;
    noIssues: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
    output?: string;
    parallel?: number;
    timeout?: number;
    scenarioFiles?: string[];
    verbose: boolean;
    debug: boolean;
}
/**
 * Suite configuration for selecting test scenarios
 */
interface SuiteConfig {
    name: string;
    description: string;
    patterns: string[];
    tags: string[];
}
/**
 * Test suite configuration mapping
 */
export declare const TEST_SUITES: Record<string, SuiteConfig>;
/**
 * Default configuration factory
 */
export declare function createDefaultConfig(): TestConfig;
/**
 * Parse command line arguments
 */
export declare function parseArguments(): CliArguments;
/**
 * Load and merge configuration from file and environment
 */
export declare function loadConfiguration(configPath: string, cliArgs: CliArguments): Promise<TestConfig>;
/**
 * Discover and load test scenarios
 */
export declare function loadTestScenarios(scenarioFiles?: string[]): Promise<OrchestratorScenario[]>;
/**
 * Filter scenarios based on test suite configuration
 */
export declare function filterScenariosForSuite(scenarios: OrchestratorScenario[], suite: string): OrchestratorScenario[];
/**
 * Save test results to output file
 */
export declare function saveResults(session: TestSession, outputPath: string): Promise<void>;
/**
 * Display test session summary
 */
export declare function displayResults(session: TestSession): void;
/**
 * Perform dry run - discover and display scenarios without execution
 */
export declare function performDryRun(scenarios: OrchestratorScenario[], suite: string): Promise<void>;
/**
 * Setup graceful shutdown handlers
 */
export declare function setupGracefulShutdown(orchestrator: TestOrchestrator): void;
/**
 * Main entry point for the testing system
 */
export declare function main(): Promise<number>;
/**
 * Run the main async function with proper error handling
 */
export declare function run(): void;
/**
 * Programmatic API for running tests
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
 * Run tests programmatically
 */
export declare function runTests(options?: ProgrammaticTestOptions): Promise<TestSession>;
/**
 * Export all public interfaces and functions
 */
export { TestOrchestrator, TestConfig, TestSession, TestResult, OrchestratorScenario, createTestOrchestrator };
//# sourceMappingURL=main.d.ts.map