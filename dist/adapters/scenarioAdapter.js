"use strict";
/**
 * Adapter to convert between scenarios/ScenarioDefinition and models/OrchestratorScenario formats
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adaptScenarioToComplex = adaptScenarioToComplex;
const TestModels_1 = require("../models/TestModels");
const uuid_1 = require("uuid");
/**
 * Convert simple scenario format (from YAML) to complex format (for TestOrchestrator)
 */
function adaptScenarioToComplex(simple) {
    // Handle missing or empty arrays with defensive checks
    const steps = simple.steps && Array.isArray(simple.steps) && simple.steps.length > 0
        ? simple.steps.map(adaptStepToOrchestrator)
        : [];
    const verifications = simple.assertions && Array.isArray(simple.assertions)
        ? simple.assertions.map(a => ({
            type: a.type,
            target: typeof a.params?.['target'] === 'string' ? a.params['target'] : 'default',
            expected: String(a.params?.['expected'] ?? ''),
            operator: 'equals',
            description: a.name
        }))
        : [];
    const cleanup = simple.cleanup && Array.isArray(simple.cleanup)
        ? simple.cleanup.map(adaptStepToOrchestrator)
        : undefined;
    const agents = simple.agents && Array.isArray(simple.agents)
        ? simple.agents.map(adaptAgentToOrchestrator)
        : undefined;
    // Build a deterministic ID from the scenario name so that repeated calls
    // with the same scenario produce the same ID (stable across test runs and
    // diffing). Fall back to a random UUID only when no name is provided.
    const id = simple.name
        ? `scenario-${simple.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`
        : (0, uuid_1.v4)();
    return {
        id,
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
        ...(agents !== undefined ? { agents } : {}),
        ...(cleanup !== undefined ? { cleanup } : {}),
    };
}
function adaptAgentToOrchestrator(agent) {
    const source = agent;
    const adapted = {
        type: agent.type,
        ...(typeof source.id === 'string' ? { id: source.id } : {}),
        ...(typeof agent.name === 'string' ? { name: agent.name } : {}),
    };
    if (agent.config !== undefined) {
        adapted.config = { ...agent.config };
    }
    return adapted;
}
/**
 * Convert scenarios/TestStep to models/OrchestratorStep
 */
function adaptStepToOrchestrator(simpleStep, _stepIndex) {
    const params = simpleStep.params || {};
    // Build target string based on params and step type
    let target = '';
    let value = '';
    if (params['command']) {
        // For spawn/spawn_tui actions: combine command and args into target
        if (Array.isArray(params['args'])) {
            target = `${params['command']} ${params['args'].join(' ')}`;
        }
        else {
            target = String(params['command']);
        }
    }
    else if (params['text'] !== undefined || params['duration'] !== undefined) {
        // For actions that operate on the spawned session
        // Use a special marker that TUIAgent can interpret as "use the active session"
        value = params['text'] !== undefined ? String(params['text']) : String(params['duration'] ?? '');
        target = ''; // TUIAgent will use the active session
    }
    else {
        // Fallback: use first param value as target
        const firstValue = Object.values(params)[0];
        target = String(firstValue ?? '');
    }
    return {
        action: simpleStep.action,
        target,
        value,
        ...(simpleStep.timeout !== undefined ? { timeout: simpleStep.timeout } : {}),
    };
}
/**
 * Map priority from metadata to Priority enum
 */
function mapPriority(priority) {
    switch (priority?.toLowerCase()) {
        case 'critical': return TestModels_1.Priority.CRITICAL;
        case 'high': return TestModels_1.Priority.HIGH;
        case 'medium': return TestModels_1.Priority.MEDIUM;
        case 'low': return TestModels_1.Priority.LOW;
        default: return TestModels_1.Priority.MEDIUM;
    }
}
/**
 * Map tags to TestInterface enum
 */
function mapInterface(tags) {
    if (tags.includes('tui'))
        return TestModels_1.TestInterface.TUI;
    if (tags.includes('cli'))
        return TestModels_1.TestInterface.CLI;
    if (tags.includes('web') || tags.includes('ui'))
        return TestModels_1.TestInterface.GUI;
    if (tags.includes('electron'))
        return TestModels_1.TestInterface.GUI;
    return TestModels_1.TestInterface.CLI; // Default
}
//# sourceMappingURL=scenarioAdapter.js.map