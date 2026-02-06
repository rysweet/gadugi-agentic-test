/**
 * Main orchestrator for the Agentic Testing System
 * Coordinates all testing agents and manages test execution flow
 */
import { EventEmitter } from 'events';
import { TestResult, TestSession, TestFailure } from '../models/TestModels';
import { TestScenario } from '../scenarios';
import { TestConfig } from '../models/Config';
/**
 * Test suite configuration
 */
export interface TestSuite {
    name: string;
    description?: string;
    patterns: string[];
    tags?: string[];
}
/**
 * Orchestrator events
 */
export interface OrchestratorEvents {
    'session:start': (session: TestSession) => void;
    'session:end': (session: TestSession) => void;
    'scenario:start': (scenario: TestScenario) => void;
    'scenario:end': (scenario: TestScenario, result: TestResult) => void;
    'phase:start': (phase: string) => void;
    'phase:end': (phase: string) => void;
    'error': (error: Error) => void;
}
/**
 * Main test orchestrator class
 */
export declare class TestOrchestrator extends EventEmitter {
    private config;
    private session;
    private results;
    private failures;
    private cliAgent;
    private uiAgent;
    private issueReporter;
    private priorityAgent;
    private maxParallel;
    private retryCount;
    private failFast;
    private abortController;
    constructor(config: TestConfig);
    /**
     * Setup internal event handlers
     */
    private setupEventHandlers;
    /**
     * Run a complete testing session
     */
    run(suite?: string, scenarioFiles?: string[]): Promise<TestSession>;
    /**
     * Load test scenarios from files
     */
    private loadScenarios;
    /**
     * Filter scenarios based on test suite configuration
     */
    private filterScenariosForSuite;
    /**
     * Execute test scenarios with parallel execution support
     */
    private executeScenarios;
    /**
     * Execute CLI test scenarios in parallel
     */
    private executeCLIScenarios;
    /**
     * Execute UI test scenarios
     */
    private executeUIScenarios;
    /**
     * Execute mixed interface scenarios
     */
    private executeMixedScenarios;
    /**
     * Execute scenarios in parallel with concurrency limit
     */
    private executeParallel;
    /**
     * Execute a single test scenario
     */
    private executeSingleScenario;
    /**
     * Select appropriate agent for scenario
     */
    private selectAgentForScenario;
    /**
     * Process execution results
     */
    private processResults;
    /**
     * Record test result
     */
    private recordResult;
    /**
     * Record a scenario failure
     */
    private recordFailure;
    /**
     * Analyze test results and prioritize failures
     */
    private analyzeResults;
    /**
     * Report failures to GitHub
     */
    private reportFailures;
    /**
     * Calculate session status based on results
     */
    private calculateSessionStatus;
    /**
     * Calculate session metrics
     */
    private calculateSessionMetrics;
    /**
     * Save session results to file
     */
    private saveSessionResults;
    /**
     * Abort the current test session
     */
    abort(): void;
    /**
     * Get current session
     */
    getSession(): TestSession | null;
    /**
     * Get test results
     */
    getResults(): TestResult[];
    /**
     * Get test failures
     */
    getFailures(): TestFailure[];
}
/**
 * Create a test orchestrator instance
 */
export declare function createTestOrchestrator(config: TestConfig): TestOrchestrator;
//# sourceMappingURL=TestOrchestrator.d.ts.map