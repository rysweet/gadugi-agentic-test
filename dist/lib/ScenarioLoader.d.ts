/**
 * ScenarioLoader
 * Scenario discovery, loading, and suite-filtering logic extracted from lib.ts.
 */
import { OrchestratorScenario } from '../models/TestModels';
type TestScenario = OrchestratorScenario;
/**
 * Configuration for a single named test suite
 */
export interface SuiteConfig {
    name: string;
    description: string;
    patterns: string[];
    tags: string[];
}
/**
 * Built-in suite definitions.
 * 'smoke' and 'regression'/'full' differ only in pattern coverage.
 */
export declare const TEST_SUITES: Record<string, SuiteConfig>;
/**
 * Discover and load OrchestratorScenario objects.
 *
 * If `scenarioFiles` is provided those files are loaded; otherwise every
 * `.yaml` / `.yml` in `<cwd>/scenarios/` is loaded.
 */
export declare function loadTestScenarios(scenarioFiles?: string[]): Promise<TestScenario[]>;
/**
 * Filter scenarios according to the named suite's pattern rules.
 *
 * Patterns ending in `:` are prefix matches; patterns containing `*` are
 * treated as simple globs; all others require an exact id or tag match.
 */
export declare function filterScenariosForSuite(scenarios: TestScenario[], suite: string): TestScenario[];
export {};
//# sourceMappingURL=ScenarioLoader.d.ts.map