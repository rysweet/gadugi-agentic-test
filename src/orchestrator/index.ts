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

// Re-export test models for convenience
export type {
  TestSession,
  TestResult,
  TestFailure,
  OrchestratorScenario
} from '../models/TestModels';