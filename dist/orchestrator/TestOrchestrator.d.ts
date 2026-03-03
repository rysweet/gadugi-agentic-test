/**
 * TestOrchestrator
 *
 * Thin orchestration facade. Delegates to:
 *   - ScenarioRouter  : dispatch scenarios to agents (via IAgent registry)
 *   - SessionManager  : session lifecycle and persistence
 *   - ResultAggregator: collect results, analyze, report
 */
import { EventEmitter } from 'events';
import { OrchestratorScenario, TestResult, TestSession, TestFailure } from '../models/TestModels';
import { ScenarioDefinition } from '../scenarios';
import { TestConfig } from '../models/Config';
/**
 * Suite filter configuration used internally by TestOrchestrator.
 *
 * NOTE: This is intentionally distinct from `TestModels.TestSuite`, which
 * describes a named collection of OrchestratorScenario objects for consumption
 * by test runners. SuiteFilterConfig describes patterns used to select which
 * scenarios belong to a named run (e.g. "smoke", "full").
 *
 * Distinction at a glance:
 *   - TestModels.TestSuite  → { name, scenarios: OrchestratorScenario[] }
 *   - SuiteFilterConfig     → { name, patterns: string[], tags?: string[] }
 */
export interface SuiteFilterConfig {
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
    'scenario:start': (scenario: OrchestratorScenario) => void;
    'scenario:end': (scenario: OrchestratorScenario, result: TestResult) => void;
    'phase:start': (phase: string) => void;
    'phase:end': (phase: string) => void;
    'error': (error: Error) => void;
}
export declare class TestOrchestrator extends EventEmitter {
    private config;
    private sessionManager;
    private aggregator;
    private router;
    private abortController;
    private issueReporter;
    private failures;
    constructor(config: TestConfig);
    /**
     * Run with pre-loaded scenarios (used by programmatic API)
     */
    runWithScenarios(suite: string, loadedScenarios: ScenarioDefinition[]): Promise<TestSession>;
    /**
     * Run a complete testing session
     */
    run(suite?: string, scenarioFiles?: string[]): Promise<TestSession>;
    abort(): void;
    getSession(): TestSession | null;
    getResults(): TestResult[];
    getFailures(): TestFailure[];
    /**
     * Report failures to GitHub via IssueReporter.
     *
     * Best-effort: individual createIssue failures are logged but do not abort
     * subsequent reports. Cleanup is always called.
     */
    private reportFailures;
    private loadScenarios;
}
/**
 * Create a test orchestrator instance
 */
export declare function createTestOrchestrator(config: TestConfig): TestOrchestrator;
//# sourceMappingURL=TestOrchestrator.d.ts.map