/**
 * Adapter to convert between scenarios/TestScenario and models/OrchestratorScenario formats
 */
import { TestScenario as SimpleScenario } from '../scenarios';
import { OrchestratorScenario as ComplexScenario } from '../models/TestModels';
/**
 * Convert simple scenario format (from YAML) to complex format (for TestOrchestrator)
 */
export declare function adaptScenarioToComplex(simple: SimpleScenario): ComplexScenario;
//# sourceMappingURL=scenarioAdapter.d.ts.map