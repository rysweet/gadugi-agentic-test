/**
 * Adapter to convert between scenarios/TestScenario and models/OrchestratorScenario formats
 */

import { TestScenario as SimpleScenario, TestStep as SimpleStep } from '../scenarios';
import { OrchestratorScenario as ComplexScenario, OrchestratorStep, Priority, TestInterface } from '../models/TestModels';
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert simple scenario format (from YAML) to complex format (for TestOrchestrator)
 */
export function adaptScenarioToComplex(simple: SimpleScenario): ComplexScenario {
  // Handle missing or empty arrays with defensive checks
  const steps = simple.steps && Array.isArray(simple.steps) && simple.steps.length > 0
    ? simple.steps.map(adaptStepToOrchestrator)
    : [];

  const verifications = simple.assertions && Array.isArray(simple.assertions)
    ? simple.assertions.map(a => ({
        type: a.type,
        target: a.params?.target || 'default',
        expected: String(a.params?.expected || ''),
        operator: 'equals' as const,
        description: a.name
      }))
    : [];

  const cleanup = simple.cleanup && Array.isArray(simple.cleanup)
    ? simple.cleanup.map(adaptStepToOrchestrator)
    : undefined;

  return {
    id: uuidv4(),
    name: simple.name || 'Unnamed scenario',
    description: simple.description || `Test scenario: ${simple.name || 'unnamed'}`,
    priority: mapPriority(simple.metadata?.priority),
    interface: mapInterface(simple.metadata?.tags || []),
    prerequisites: simple.environment?.requires || [],
    steps,
    verifications,
    expectedOutcome: 'Test passes all assertions',
    estimatedDuration: simple.config?.timeout ? simple.config.timeout / 1000 : 60,
    tags: simple.metadata?.tags || [],
    enabled: true,
    environment: undefined,
    cleanup
  };
}

/**
 * Convert scenarios/TestStep to models/OrchestratorStep
 */
function adaptStepToOrchestrator(simpleStep: SimpleStep): OrchestratorStep {
  const params = simpleStep.params || {};

  // Build target string based on params
  let target = '';
  let value = '';

  if (params.command) {
    // For spawn/spawn_tui actions: combine command and args into target (space-separated)
    if (params.args && Array.isArray(params.args)) {
      target = `${params.command} ${params.args.join(' ')}`;
    } else {
      target = params.command;
    }
  } else if (params.text !== undefined) {
    // For input/validate actions: text becomes value
    value = params.text;
    target = 'current_session'; // Default session ID
  } else {
    // Fallback: use first param value as target
    const firstValue = Object.values(params)[0];
    target = String(firstValue || '');
  }

  return {
    action: simpleStep.action,
    target,
    value,
    timeout: simpleStep.timeout
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
