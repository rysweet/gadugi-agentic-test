/**
 * ResultsHandler
 * Result persistence and display logic extracted from lib.ts.
 */
import { TestSession, OrchestratorScenario } from '../models/TestModels';
type TestScenario = OrchestratorScenario;
/**
 * Persist a TestSession to a JSON file at `outputPath`.
 * Creates intermediate directories as needed.
 */
export declare function saveResults(session: TestSession, outputPath: string): Promise<void>;
/**
 * Log a formatted summary of a TestSession via the structured logger.
 * Uses logger.info instead of console.log so that library consumers can
 * control log output (suppression, redirection, structured sinks).
 */
export declare function displayResults(session: TestSession): void;
/**
 * Perform a dry run: log what would be executed without running anything.
 */
export declare function performDryRun(scenarios: TestScenario[], suite: string): Promise<void>;
export {};
//# sourceMappingURL=ResultsHandler.d.ts.map