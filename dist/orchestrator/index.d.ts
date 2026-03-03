/**
 * Orchestrator module - Test coordination and management
 */
export { TestOrchestrator, createTestOrchestrator, } from './TestOrchestrator';
export type { 
/**
 * SuiteFilterConfig: pattern-based suite selector used by TestOrchestrator.
 *
 * NOTE: This is NOT the same as TestModels.TestSuite.
 *   - SuiteFilterConfig → { name, patterns: string[], tags?: string[] }
 *     Used to configure which scenarios belong to a named run.
 *   - TestModels.TestSuite → { name, scenarios: OrchestratorScenario[] }
 *     Describes a concrete set of scenario objects for execution.
 */
SuiteFilterConfig, OrchestratorEvents } from './TestOrchestrator';
export { ScenarioRouter } from './ScenarioRouter';
export { SessionManager } from './SessionManager';
export { ResultAggregator } from './ResultAggregator';
export type { TestSession, TestResult, TestFailure, OrchestratorScenario } from '../models/TestModels';
//# sourceMappingURL=index.d.ts.map