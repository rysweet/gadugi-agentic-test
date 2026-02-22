"use strict";
/**
 * Run command handler - executes test scenarios.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRunCommand = registerRunCommand;
const scenarios_1 = require("../../scenarios");
const utils_1 = require("../../utils");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const chalk_1 = __importDefault(require("chalk"));
const lib_1 = require("../../lib");
const output_1 = require("../output");
function registerRunCommand(program) {
    program
        .command('run')
        .description('Run test scenarios')
        .option('-s, --scenario <name>', 'Run specific scenario by name')
        .option('-d, --directory <path>', 'Scenarios directory', './scenarios')
        .option('-c, --config <file>', 'Configuration file')
        .option('--parallel', 'Run scenarios in parallel')
        .option('--timeout <ms>', 'Global timeout in milliseconds', '300000')
        .action(async (options) => {
        try {
            utils_1.logger.info('Starting Agentic Testing System');
            let config = null;
            // Load configuration if provided
            if (options.config) {
                try {
                    const configManager = new utils_1.ConfigManager();
                    await configManager.loadFromFile(options.config);
                    config = configManager.getConfig();
                    (0, output_1.logSuccess)(`Configuration loaded from: ${options.config}`);
                }
                catch (error) {
                    throw new output_1.CLIError(`Failed to load configuration: ${error.message}`, 'CONFIG_ERROR');
                }
            }
            else {
                // Try loading default config files
                const defaultConfigs = [
                    'agentic-test.config.yaml',
                    'agentic-test.config.yml',
                    'agentic-test.config.json',
                    '.agentic-testrc.yaml',
                    '.agentic-testrc.yml',
                    '.agentic-testrc.json',
                ];
                for (const configFile of defaultConfigs) {
                    try {
                        await fs.access(configFile);
                        const configManager = new utils_1.ConfigManager();
                        await configManager.loadFromFile(configFile);
                        config = configManager.getConfig();
                        (0, output_1.logInfo)(`Default configuration loaded from: ${configFile}`);
                        break;
                    }
                    catch {
                        // Continue to next file
                    }
                }
            }
            // Validate scenario directory exists
            try {
                await fs.access(options.directory);
            }
            catch {
                throw new output_1.CLIError(`Scenarios directory not found: ${options.directory}`, 'DIRECTORY_NOT_FOUND');
            }
            let scenarios;
            const progressBar = (0, output_1.createProgressBar)(1, 'Loading scenarios');
            progressBar.start(1, 0);
            try {
                if (options.scenario) {
                    // Load specific scenario
                    const scenarioPath = path.join(options.directory, `${options.scenario}.yaml`);
                    (0, output_1.logInfo)(`Loading scenario: ${scenarioPath}`);
                    scenarios = [await scenarios_1.ScenarioLoader.loadFromFile(scenarioPath)];
                }
                else {
                    // Load all scenarios from directory
                    (0, output_1.logInfo)(`Loading scenarios from directory: ${options.directory}`);
                    scenarios = await scenarios_1.ScenarioLoader.loadFromDirectory(options.directory);
                }
                progressBar.update(1);
                progressBar.stop();
                (0, output_1.logSuccess)(`Loaded ${scenarios.length} scenario(s)`);
                if (scenarios.length === 0) {
                    (0, output_1.logWarning)('No scenarios found to execute');
                    return;
                }
                // Import orchestrator
                const { TestOrchestrator } = await Promise.resolve().then(() => __importStar(require('../../orchestrator')));
                // Use shared default config, with CLI timeout override
                const testConfig = config ||
                    (() => {
                        const defaults = (0, lib_1.createDefaultConfig)();
                        const timeoutMs = parseInt(options.timeout);
                        defaults.execution.defaultTimeout = timeoutMs;
                        defaults.execution.resourceLimits.maxExecutionTime = timeoutMs;
                        defaults.cli.defaultTimeout = timeoutMs;
                        defaults.ui.defaultTimeout = timeoutMs;
                        defaults.tui.defaultTimeout = timeoutMs;
                        return defaults;
                    })();
                const orchestrator = new TestOrchestrator(testConfig);
                (0, output_1.logInfo)('Executing test scenarios...');
                const session = await orchestrator.runWithScenarios('test-suite', scenarios);
                // Extract results from session
                const passedCount = session.summary.passed;
                const failedCount = session.summary.failed;
                // Report results with colors
                console.log('\n' + chalk_1.default.bold('Test Execution Results:'));
                console.log(chalk_1.default.green(`✓ Passed: ${passedCount}`));
                console.log(chalk_1.default.red(`✗ Failed: ${failedCount}`));
                console.log(chalk_1.default.gray(`- Total: ${scenarios.length}`));
                if (failedCount > 0) {
                    (0, output_1.logError)('Some tests failed');
                    process.exit(1);
                }
                else {
                    (0, output_1.logSuccess)('All tests passed!');
                }
            }
            catch (loadError) {
                progressBar.stop();
                throw loadError;
            }
        }
        catch (error) {
            (0, output_1.handleCommandError)(error);
        }
    });
}
//# sourceMappingURL=run.js.map