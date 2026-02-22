"use strict";
/**
 * Watch command handler - watches for scenario file changes and re-runs tests.
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
exports.registerWatchCommand = registerWatchCommand;
const scenarios_1 = require("../../scenarios");
const utils_1 = require("../../utils");
const fs = __importStar(require("fs/promises"));
const chokidar = __importStar(require("chokidar"));
const chalk_1 = __importDefault(require("chalk"));
const lib_1 = require("../../lib");
const output_1 = require("../output");
function registerWatchCommand(program) {
    program
        .command('watch')
        .description('Watch for scenario file changes and run tests')
        .option('-d, --directory <path>', 'Scenarios directory to watch', './scenarios')
        .option('-c, --config <file>', 'Configuration file')
        .action(async (options) => {
        try {
            (0, output_1.logInfo)('Starting watch mode...');
            (0, output_1.logInfo)(`Watching directory: ${chalk_1.default.cyan(options.directory)}`);
            // Validate directory exists
            try {
                await fs.access(options.directory);
            }
            catch {
                throw new output_1.CLIError(`Watch directory not found: ${options.directory}`, 'DIRECTORY_NOT_FOUND');
            }
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
            // Setup file watcher
            const watcher = chokidar.watch(options.directory, {
                ignored: /(^|[\/\\])\./, // ignore dotfiles
                persistent: true,
                ignoreInitial: true,
            });
            // Debounce mechanism to prevent multiple rapid executions
            let timeout = null;
            const debounceTime = 1000; // 1 second
            const runTests = async (changedFile) => {
                if (changedFile) {
                    (0, output_1.logInfo)(`File changed: ${chalk_1.default.yellow(changedFile)}`);
                }
                try {
                    (0, output_1.logInfo)('Running tests...');
                    // Load and execute scenarios
                    const scenarios = await scenarios_1.ScenarioLoader.loadFromDirectory(options.directory);
                    if (scenarios.length === 0) {
                        (0, output_1.logWarning)('No scenarios found to execute');
                        return;
                    }
                    // Run scenarios through the real orchestrator
                    const { TestOrchestrator } = await Promise.resolve().then(() => __importStar(require('../../orchestrator')));
                    const testConfig = config || (0, lib_1.createDefaultConfig)();
                    const orchestrator = new TestOrchestrator(testConfig);
                    const session = await orchestrator.runWithScenarios('watch', scenarios);
                    const passedCount = session.summary.passed;
                    const failedCount = session.summary.failed;
                    // Report results
                    console.log('\n' + chalk_1.default.bold('Watch Mode - Test Results:'));
                    console.log(chalk_1.default.green(`✓ Passed: ${passedCount}`));
                    console.log(chalk_1.default.red(`✗ Failed: ${failedCount}`));
                    console.log(chalk_1.default.gray(`- Total: ${scenarios.length}`));
                    console.log(chalk_1.default.gray(`- Time: ${new Date().toLocaleTimeString()}`));
                    console.log('');
                    if (failedCount > 0) {
                        (0, output_1.logWarning)('Some tests failed - watching for changes...');
                    }
                    else {
                        (0, output_1.logSuccess)('All tests passed - watching for changes...');
                    }
                }
                catch (error) {
                    (0, output_1.logError)(`Test execution failed: ${error.message}`);
                    (0, output_1.logInfo)('Watching for changes...');
                }
            };
            // File change handlers
            watcher.on('change', (filePath) => {
                if (timeout)
                    clearTimeout(timeout);
                timeout = setTimeout(() => runTests(filePath), debounceTime);
            });
            watcher.on('add', (filePath) => {
                (0, output_1.logInfo)(`New file added: ${chalk_1.default.green(filePath)}`);
                if (timeout)
                    clearTimeout(timeout);
                timeout = setTimeout(() => runTests(filePath), debounceTime);
            });
            watcher.on('unlink', (filePath) => {
                (0, output_1.logInfo)(`File deleted: ${chalk_1.default.red(filePath)}`);
                if (timeout)
                    clearTimeout(timeout);
                timeout = setTimeout(() => runTests(), debounceTime);
            });
            watcher.on('error', (error) => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                (0, output_1.logError)(`Watcher error: ${errorMessage}`);
            });
            // Run initial test execution
            await runTests();
            (0, output_1.logSuccess)('Watch mode started. Press Ctrl+C to stop.');
            // Handle graceful shutdown
            process.on('SIGINT', () => {
                (0, output_1.logInfo)('Shutting down watch mode...');
                watcher.close().then(() => {
                    (0, output_1.logSuccess)('Watch mode stopped.');
                    process.exit(0);
                });
            });
        }
        catch (error) {
            (0, output_1.handleCommandError)(error);
        }
    });
}
//# sourceMappingURL=watch.js.map