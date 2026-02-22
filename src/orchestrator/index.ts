/**
 * Orchestrator module - Test coordination and management
 */

// Re-export the main orchestrator implementation
export {
  TestOrchestrator,
  createTestOrchestrator,
} from './TestOrchestrator';
export type {
  TestSuite,
  OrchestratorEvents
} from './TestOrchestrator';

// Sub-module exports
export { ScenarioRouter } from './ScenarioRouter';
export { SessionManager } from './SessionManager';
export { ResultAggregator } from './ResultAggregator';

// Re-export test models for convenience
export type {
  TestSession,
  TestResult,
  TestFailure,
  OrchestratorScenario
} from '../models/TestModels';