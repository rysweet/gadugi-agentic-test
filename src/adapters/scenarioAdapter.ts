/**
 * Adapter to convert between scenarios/OrchestratorScenario and models/OrchestratorScenario formats
 */

import { TestScenario as SimpleScenario } from '../scenarios';
import { OrchestratorScenario as ComplexScenario, OrchestratorStep, Priority, TestInterface } from '../models/TestModels';
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert simple scenario format (from YAML) to complex format (for TestOrchestrator)
 */
export function adaptScenarioToComplex(simple: SimpleScenario): ComplexScenario {
  return {
    id: uuidv4(),
    name: simple.name,
    description: simple.description || `Test scenario: ${simple.name}`,
    priority: mapPriority(simple.metadata?.priority),
    interface: mapInterface(simple.metadata?.tags || []),
    prerequisites: simple.environment?.requires || [],
    steps: simple.steps as any as OrchestratorStep[], // Type conversion from scenarios format
    verifications: simple.assertions.map(a => ({
      name: a.name,
      type: a.type,
      params: a.params,
      expected: undefined
    })) as any, // Type conversion to VerificationStep[]
    expectedOutcome: 'Test passes all assertions',
    estimatedDuration: simple.config?.timeout ? simple.config.timeout / 1000 : 60,
    tags: simple.metadata?.tags || [],
    enabled: true,
    environment: undefined,
    cleanup: simple.cleanup as any as OrchestratorStep[] | undefined
  };
}

/**
 * Map priority from metadata to Priority enum
 */
function mapPriority(priority?: string): Priority {
  switch (priority?.toLowerCase()) {
    case 'critical':
    case 'high':
      return Priority.CRITICAL;
    case 'medium':
      return Priority.HIGH;
    case 'low':
      return Priority.MEDIUM;
    default:
      return Priority.MEDIUM;
  }
}

/**
 * Map tags to TestInterface enum
 */
function mapInterface(tags: string[]): TestInterface {
  if (tags.includes('tui')) return TestInterface.TUI;
  if (tags.includes('cli')) return TestInterface.CLI;
  if (tags.includes('web') || tags.includes('ui')) return TestInterface.GUI;
  if (tags.includes('electron')) return TestInterface.GUI;
  return TestInterface.CLI; // Default
}
