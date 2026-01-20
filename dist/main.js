"use strict";
/**
 * Main entry point for the Agentic Testing System
 *
 * This module provides the core functionality for initializing and running
 * the testing system, including configuration management, agent initialization,
 * and orchestrator setup. It supports both CLI and programmatic usage.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestOrchestrator = exports.TestOrchestrator = exports.TEST_SUITES = void 0;
exports.createDefaultConfig = createDefaultConfig;
exports.parseArguments = parseArguments;
exports.loadConfiguration = loadConfiguration;
exports.loadTestScenarios = loadTestScenarios;
exports.filterScenariosForSuite = filterScenariosForSuite;
exports.saveResults = saveResults;
exports.displayResults = displayResults;
exports.performDryRun = performDryRun;
exports.setupGracefulShutdown = setupGracefulShutdown;
exports.main = main;
exports.run = run;
exports.runTests = runTests;
const commander_1 = require("commander");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fs_extra_1 = require("fs-extra");
const uuid_1 = require("uuid");
// Import core modules
const orchestrator_1 = require("./orchestrator");
Object.defineProperty(exports, "TestOrchestrator", { enumerable: true, get: function () { return orchestrator_1.TestOrchestrator; } });
Object.defineProperty(exports, "createTestOrchestrator", { enumerable: true, get: function () { return orchestrator_1.createTestOrchestrator; } });
const TestModels_1 = require("./models/TestModels");
const logger_1 = require("./utils/logger");
const config_1 = require("./utils/config");
const yamlParser_1 = require("./utils/yamlParser");
/**
 * Test suite configuration mapping
 */
exports.TEST_SUITES = {
    smoke: {
        name: 'smoke',
        description: 'Quick smoke tests for critical functionality',
        patterns: ['smoke:', 'critical:', 'auth:'],
        tags: ['smoke', 'critical', 'auth']
    },
    regression: {
        name: 'regression',
        description: 'Full regression test suite',
        patterns: ['*'],
        tags: []
    },
    full: {
        name: 'full',
        description: 'Complete test suite including all scenarios',
        patterns: ['*'],
        tags: []
    }
};
/**
 * Default configuration factory
 */
function createDefaultConfig() {
    const defaultConfig = {
        execution: {
            maxParallel: 3,
            defaultTimeout: 300000,
            continueOnFailure: true,
            maxRetries: 2,
            retryDelay: 1000,
            randomizeOrder: false,
            resourceLimits: {
                maxMemory: 1024 * 1024 * 1024, // 1GB
                maxCpuUsage: 80,
                maxDiskUsage: 1024 * 1024 * 1024, // 1GB
                maxExecutionTime: 600000, // 10 minutes
                maxOpenFiles: 100
            },
            cleanup: {
                cleanupAfterEach: true,
                cleanupAfterAll: true,
                cleanupDirectories: ['./temp', './screenshots'],
                cleanupFiles: ['*.tmp', '*.log'],
                terminateProcesses: [],
                stopServices: [],
                customCleanupScripts: []
            }
        },
        cli: {
            executablePath: 'uv run atg',
            workingDirectory: process.cwd(),
            defaultTimeout: 30000,
            environment: {
                NODE_ENV: 'test',
                ...process.env
            },
            captureOutput: true,
            shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
            maxRetries: 2,
            retryDelay: 1000
        },
        ui: {
            browser: 'chromium',
            headless: true,
            viewport: {
                width: 1280,
                height: 720
            },
            baseUrl: 'http://localhost:3000',
            defaultTimeout: 30000,
            screenshotDir: './outputs/screenshots',
            recordVideo: false,
            slowMo: 100
        },
        github: {
            token: process.env.GITHUB_TOKEN || '',
            owner: process.env.GITHUB_OWNER || '',
            repository: process.env.GITHUB_REPOSITORY || '',
            baseBranch: 'main',
            createIssuesOnFailure: false,
            issueLabels: ['bug', 'automated-test'],
            issueTitleTemplate: 'Test Failure: {{scenario.name}}',
            issueBodyTemplate: `
# Test Failure Report

**Scenario:** {{scenario.name}}
**Test ID:** {{scenario.id}}
**Failure Time:** {{failure.timestamp}}

## Error Details
{{failure.message}}

## Stack Trace
\`\`\`
{{failure.stackTrace}}
\`\`\`

## Reproduction Steps
{{scenario.steps}}

---
*This issue was automatically generated by the Agentic Testing System*
      `.trim(),
            createPullRequestsForFixes: false,
            autoAssignUsers: []
        },
        priority: {
            enabled: true,
            executionOrder: ['critical', 'high', 'medium', 'low'],
            failFastOnCritical: true,
            maxParallelByPriority: {
                critical: 1,
                high: 2,
                medium: 3,
                low: 5
            },
            timeoutMultipliers: {
                critical: 2.0,
                high: 1.5,
                medium: 1.0,
                low: 0.8
            },
            retryCountsByPriority: {
                critical: 3,
                high: 2,
                medium: 1,
                low: 0
            }
        },
        logging: {
            level: 'info',
            console: true,
            format: 'structured',
            includeTimestamp: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            compress: true
        },
        reporting: {
            outputDir: './outputs/reports',
            formats: ['html', 'json'],
            includeScreenshots: true,
            includeLogs: true,
            customTemplates: {},
            generationTimeout: 30000
        },
        notifications: {
            enabled: false,
            channels: [],
            triggers: [],
            templates: {}
        },
        plugins: {}
    };
    return defaultConfig;
}
/**
 * Parse command line arguments
 */
function parseArguments() {
    const program = new commander_1.Command();
    program
        .name('agentic-testing')
        .description('Agentic Testing System for Azure Tenant Grapher')
        .version('1.0.0');
    program
        .option('-c, --config <file>', 'Path to configuration file', './config/test-config.yaml')
        .option('-s, --suite <name>', 'Test suite to run', 'smoke')
        .option('--dry-run', 'Perform dry run without executing tests', false)
        .option('--no-issues', 'Skip GitHub issue creation', false)
        .option('-l, --log-level <level>', 'Logging level', 'INFO')
        .option('-o, --output <file>', 'Output file for results (JSON format)')
        .option('-p, --parallel <count>', 'Maximum parallel executions', '3')
        .option('-t, --timeout <ms>', 'Global timeout in milliseconds', '300000')
        .option('--scenario-files <files...>', 'Specific scenario files to run')
        .option('--verbose', 'Enable verbose logging', false)
        .option('--debug', 'Enable debug logging', false);
    program.parse();
    const options = program.opts();
    // Determine log level
    let logLevel = 'INFO';
    if (options.debug) {
        logLevel = 'DEBUG';
    }
    else if (options.verbose) {
        logLevel = 'INFO';
    }
    else if (options.logLevel) {
        logLevel = options.logLevel.toUpperCase();
    }
    // Validate suite option
    const validSuites = ['smoke', 'full', 'regression'];
    if (!validSuites.includes(options.suite)) {
        throw new Error(`Invalid suite: ${options.suite}. Must be one of: ${validSuites.join(', ')}`);
    }
    return {
        config: options.config,
        suite: options.suite,
        dryRun: options.dryRun,
        noIssues: options.noIssues,
        logLevel,
        output: options.output,
        parallel: options.parallel ? parseInt(options.parallel) : undefined,
        timeout: options.timeout ? parseInt(options.timeout) : undefined,
        scenarioFiles: options.scenarioFiles,
        verbose: options.verbose,
        debug: options.debug
    };
}
/**
 * Load and merge configuration from file and environment
 */
async function loadConfiguration(configPath, cliArgs) {
    let config;
    // Try to load configuration from file
    if (await (0, fs_extra_1.pathExists)(configPath)) {
        logger_1.logger.info(`Loading configuration from: ${configPath}`);
        try {
            config = await (0, config_1.loadConfigFromFile)(configPath);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to load config from ${configPath}, using defaults:`, error);
            config = createDefaultConfig();
        }
    }
    else {
        logger_1.logger.warn(`Config file not found: ${configPath}, using defaults`);
        config = createDefaultConfig();
    }
    // Override with command line arguments and environment variables
    if (cliArgs.noIssues && config.github) {
        config.github.createIssuesOnFailure = false;
    }
    if (cliArgs.parallel) {
        config.execution.maxParallel = cliArgs.parallel;
    }
    if (cliArgs.timeout) {
        config.execution.defaultTimeout = cliArgs.timeout;
    }
    // Set logging level
    config.logging.level = cliArgs.logLevel.toLowerCase();
    // Load GitHub configuration from environment
    if (config.github) {
        config.github.token = process.env.GITHUB_TOKEN || config.github.token;
        config.github.owner = process.env.GITHUB_OWNER || config.github.owner;
        config.github.repository = process.env.GITHUB_REPOSITORY || config.github.repository;
    }
    return config;
}
/**
 * Discover and load test scenarios
 */
async function loadTestScenarios(scenarioFiles) {
    const scenarios = [];
    // Default scenario directory
    const scenarioDir = path.join(process.cwd(), 'scenarios');
    if (scenarioFiles && scenarioFiles.length > 0) {
        // Load specific files
        for (const file of scenarioFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const fileScenarios = await (0, yamlParser_1.parseYamlScenarios)(content);
                scenarios.push(...fileScenarios);
                logger_1.logger.debug(`Loaded ${fileScenarios.length} scenarios from ${file}`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to load scenarios from ${file}:`, error);
            }
        }
    }
    else {
        // Load all YAML files from scenario directory
        try {
            if (await (0, fs_extra_1.pathExists)(scenarioDir)) {
                const files = await fs.readdir(scenarioDir);
                const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
                for (const file of yamlFiles) {
                    const filePath = path.join(scenarioDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const fileScenarios = await (0, yamlParser_1.parseYamlScenarios)(content);
                    scenarios.push(...fileScenarios);
                    logger_1.logger.debug(`Loaded ${fileScenarios.length} scenarios from ${file}`);
                }
            }
            else {
                logger_1.logger.warn(`Scenario directory not found: ${scenarioDir}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to load scenarios from directory:', error);
        }
    }
    logger_1.logger.info(`Loaded ${scenarios.length} total test scenarios`);
    return scenarios;
}
/**
 * Filter scenarios based on test suite configuration
 */
function filterScenariosForSuite(scenarios, suite) {
    const suiteConfig = exports.TEST_SUITES[suite];
    if (!suiteConfig) {
        logger_1.logger.warn(`Unknown test suite: ${suite}, using all scenarios`);
        return scenarios;
    }
    const patterns = suiteConfig.patterns;
    if (patterns.includes('*')) {
        return scenarios;
    }
    const filtered = [];
    for (const scenario of scenarios) {
        for (const pattern of patterns) {
            if (pattern.endsWith(':')) {
                // Prefix match
                const prefix = pattern.slice(0, -1);
                if (scenario.id.startsWith(prefix) ||
                    scenario.tags?.some(tag => tag.startsWith(prefix))) {
                    filtered.push(scenario);
                    break;
                }
            }
            else if (pattern.includes('*')) {
                // Glob pattern
                const regex = new RegExp(pattern.replace('*', '.*'));
                if (regex.test(scenario.id) ||
                    scenario.tags?.some(tag => regex.test(tag))) {
                    filtered.push(scenario);
                    break;
                }
            }
            else {
                // Exact match
                if (scenario.id === pattern ||
                    scenario.tags?.includes(pattern)) {
                    filtered.push(scenario);
                    break;
                }
            }
        }
    }
    return filtered;
}
/**
 * Save test results to output file
 */
async function saveResults(session, outputPath) {
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    const resultsData = {
        sessionId: session.id,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime?.toISOString() || null,
        metrics: session.metrics,
        scenariosExecuted: session.scenariosExecuted,
        issuesCreated: session.issuesCreated,
        results: session.results,
        failures: session.failures
    };
    await fs.writeFile(outputPath, JSON.stringify(resultsData, null, 2));
    logger_1.logger.info(`Results saved to: ${outputPath}`);
}
/**
 * Display test session summary
 */
function displayResults(session) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SESSION RESULTS');
    console.log('='.repeat(60));
    console.log(`Session ID: ${session.id}`);
    console.log(`Duration: ${((session.metrics.duration || 0) / 1000).toFixed(2)} seconds`);
    console.log(`Total Tests: ${session.metrics.totalScenarios || 0}`);
    console.log(`Passed: ${session.metrics.passed || 0}`);
    console.log(`Failed: ${session.metrics.failed || 0}`);
    console.log(`Skipped: ${session.metrics.skipped || 0}`);
    const total = session.metrics.totalScenarios || 0;
    const passed = session.metrics.passed || 0;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    console.log(`Pass Rate: ${passRate.toFixed(1)}%`);
    console.log(`Issues Created: ${session.issuesCreated.length}`);
    if (session.issuesCreated.length > 0) {
        console.log('\nCreated Issues:');
        for (const issueNum of session.issuesCreated) {
            console.log(`  - #${issueNum}`);
        }
    }
}
/**
 * Perform dry run - discover and display scenarios without execution
 */
async function performDryRun(scenarios, suite) {
    const filteredScenarios = filterScenariosForSuite(scenarios, suite);
    console.log('\n' + '='.repeat(60));
    console.log('DRY RUN MODE - Not executing tests');
    console.log('='.repeat(60));
    console.log(`Would execute ${filteredScenarios.length} scenarios for suite '${suite}':`);
    for (const scenario of filteredScenarios) {
        console.log(`  - [${scenario.interface || TestModels_1.TestInterface.CLI}] ${scenario.id}: ${scenario.name}`);
        if (scenario.description) {
            console.log(`    ${scenario.description}`);
        }
        if (scenario.tags && scenario.tags.length > 0) {
            console.log(`    Tags: ${scenario.tags.join(', ')}`);
        }
    }
}
/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(orchestrator) {
    const shutdown = (signal) => {
        logger_1.logger.info(`Received ${signal}, shutting down gracefully...`);
        orchestrator.abort();
        // Give some time for cleanup
        setTimeout(() => {
            logger_1.logger.warn('Forcing shutdown');
            process.exit(1);
        }, 5000);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
        logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
    process.on('uncaughtException', (error) => {
        logger_1.logger.error('Uncaught Exception:', error);
        process.exit(1);
    });
}
/**
 * Main entry point for the testing system
 */
async function main() {
    let orchestrator = null;
    try {
        // Parse command line arguments
        const args = parseArguments();
        // Setup logging
        (0, logger_1.setupLogger)(args.logLevel.toLowerCase());
        logger_1.logger.info('Starting Agentic Testing System');
        logger_1.logger.info(`Configuration: ${args.config}`);
        logger_1.logger.info(`Test suite: ${args.suite}`);
        // Load configuration
        const config = await loadConfiguration(args.config, args);
        // Load test scenarios
        const scenarios = await loadTestScenarios(args.scenarioFiles);
        if (scenarios.length === 0) {
            logger_1.logger.warn('No scenarios found to execute');
            return 0;
        }
        // Create orchestrator
        orchestrator = (0, orchestrator_1.createTestOrchestrator)(config);
        // Setup graceful shutdown
        setupGracefulShutdown(orchestrator);
        // Handle dry run
        if (args.dryRun) {
            await performDryRun(scenarios, args.suite);
            return 0;
        }
        // Run test session
        const session = await orchestrator.run(args.suite, args.scenarioFiles);
        // Display results
        displayResults(session);
        // Save results if requested
        if (args.output) {
            await saveResults(session, args.output);
        }
        // Return exit code based on failures
        return (session.metrics.failed || 0) > 0 ? 1 : 0;
    }
    catch (error) {
        logger_1.logger.error('Testing system failed:', error);
        return 1;
    }
}
/**
 * Run the main async function with proper error handling
 */
function run() {
    main()
        .then((exitCode) => {
        process.exit(exitCode);
    })
        .catch((error) => {
        if (error.code === 'SIGINT') {
            logger_1.logger.info('Testing interrupted by user');
            process.exit(130); // Standard exit code for SIGINT
        }
        else {
            logger_1.logger.error('Unexpected error:', error);
            process.exit(1);
        }
    });
}
/**
 * Run tests programmatically
 */
async function runTests(options = {}) {
    // Setup default options
    const opts = {
        configPath: './config/test-config.yaml',
        suite: 'smoke',
        dryRun: false,
        ...options
    };
    // Setup logging
    (0, logger_1.setupLogger)('info');
    // Load configuration
    const baseConfig = opts.configPath
        ? await loadConfiguration(opts.configPath, { noIssues: false })
        : createDefaultConfig();
    const config = opts.config
        ? { ...baseConfig, ...opts.config }
        : baseConfig;
    // Load scenarios
    const scenarios = await loadTestScenarios(opts.scenarioFiles);
    // Create orchestrator
    const orchestrator = (0, orchestrator_1.createTestOrchestrator)(config);
    // Setup graceful shutdown
    setupGracefulShutdown(orchestrator);
    // Handle dry run
    if (opts.dryRun) {
        await performDryRun(scenarios, opts.suite || 'smoke');
        // Return a mock session for dry run
        return {
            id: (0, uuid_1.v4)(),
            startTime: new Date(),
            endTime: new Date(),
            scenariosExecuted: [],
            results: [],
            failures: [],
            issuesCreated: [],
            metrics: {
                totalScenarios: scenarios.length,
                passed: 0,
                failed: 0,
                skipped: 0,
                duration: 0
            }
        };
    }
    // Run test session
    const session = await orchestrator.run(opts.suite, opts.scenarioFiles);
    // Save results if requested
    if (opts.outputFile) {
        await saveResults(session, opts.outputFile);
    }
    return session;
}
// Execute if called directly
if (require.main === module) {
    run();
}
//# sourceMappingURL=main.js.map