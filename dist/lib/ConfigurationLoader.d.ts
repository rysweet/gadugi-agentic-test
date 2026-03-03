/**
 * ConfigurationLoader
 * Default config factory and file-based config loading logic extracted from lib.ts.
 */
import { TestConfig } from '../models/Config';
/**
 * Command line arguments interface used by loadConfiguration
 */
export interface CliArguments {
    config: string;
    suite: 'smoke' | 'full' | 'regression';
    dryRun: boolean;
    noIssues: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
    output?: string;
    parallel?: number;
    timeout?: number;
    scenarioFiles?: string[];
    verbose: boolean;
    debug: boolean;
}
/**
 * Build a complete default TestConfig from environment variables and safe defaults.
 *
 * Security: cli.environment and tui.environment intentionally contain ONLY
 * the explicitly allow-listed values below (NODE_ENV for cli; nothing for tui).
 * A full process.env snapshot must never be stored in TestConfig because
 * TestConfig objects are serialised to disk by saveResults / exportToFile and
 * could expose credentials, tokens, and secret keys (issue #84).
 */
export declare function createDefaultConfig(): TestConfig;
/**
 * Load TestConfig from a YAML file, merging CLI overrides and environment
 * variables on top. Falls back to createDefaultConfig() on any error.
 */
export declare function loadConfiguration(configPath: string, cliArgs: Partial<CliArguments>): Promise<TestConfig>;
//# sourceMappingURL=ConfigurationLoader.d.ts.map