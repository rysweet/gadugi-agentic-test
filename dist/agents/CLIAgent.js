"use strict";
/**
 * CLIAgent - Thin facade over focused CLI sub-modules
 *
 * Delegates command execution to CLICommandRunner and output parsing to
 * CLIOutputParser. Preserves the full public API of the original implementation.
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 * Uses shared validateDirectory() (issue #118) instead of a private copy.
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
exports.CLIAgent = void 0;
exports.createCLIAgent = createCLIAgent;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const index_1 = require("./index");
const TestModels_1 = require("../models/TestModels");
const logger_1 = require("../utils/logger");
const async_1 = require("../utils/async");
const fileUtils_1 = require("../utils/fileUtils");
const types_1 = require("./cli/types");
const CLICommandRunner_1 = require("./cli/CLICommandRunner");
const CLIOutputParser_1 = require("./cli/CLIOutputParser");
const BaseAgent_1 = require("./BaseAgent");
class CLIAgent extends BaseAgent_1.BaseAgent {
    constructor(config = {}) {
        super();
        this.name = 'CLIAgent';
        this.type = index_1.AgentType.CLI;
        this.config = { ...types_1.DEFAULT_CLI_CONFIG, ...config };
        const logger = (0, logger_1.createLogger)({ level: this.config.logConfig.logLevel, logDir: './logs/cli-agent' });
        this.runner = new CLICommandRunner_1.CLICommandRunner(this.config, logger);
        this.parser = new CLIOutputParser_1.CLIOutputParser(this.config.defaultTimeout);
        this.on('error', (_e) => { });
    }
    async initialize() {
        try {
            await (0, fileUtils_1.validateDirectory)(this.config.workingDirectory);
            this.runner.setupInteractiveResponses();
            this.isInitialized = true;
            this.emit('initialized');
        }
        catch (error) {
            throw new Error(`Failed to initialize CLIAgent: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // -- BaseAgent template-method hooks --
    applyEnvironment(scenario) {
        if (scenario.environment) {
            this.runner.setEnvironmentVariables(scenario.environment);
        }
    }
    onBeforeExecute(scenario) {
        this.scenarioWorkingDirectory = undefined;
        this.scenarioWorkingDirectory = this.resolveScenarioWorkingDirectory(scenario);
    }
    buildResult(ctx) {
        return {
            ...ctx,
            logs: this.parser.getScenarioLogs(this.runner.getOutputBuffer()),
            commandHistory: this.runner.getCommandHistory(),
            outputBuffer: this.runner.getOutputBuffer(),
        };
    }
    async onAfterExecute() {
        this.scenarioWorkingDirectory = undefined;
        await this.runner.killAllProcesses();
    }
    // -- Public CLI-specific API --
    async executeCommand(command, args = [], options = {}) {
        return this.runner.executeCommand(command, args, options);
    }
    async executeStep(step, stepIndex) {
        const startTime = Date.now();
        try {
            let result;
            const action = step.action.toLowerCase();
            if (['execute', 'run', 'command', 'execute_command'].includes(action)) {
                result = await this.handleExecuteAction(step);
            }
            else if (action === 'execute_with_input') {
                const parts = step.target.split(' ');
                result = await this.runner.executeCommand(parts[0], parts.slice(1), this.withScenarioWorkingDirectory({ input: step.value || '', ...(step.timeout !== undefined ? { timeout: step.timeout } : {}) }));
            }
            else if (action === 'wait_for_output') {
                result = await this.parser.waitForOutput(step.target, () => this.getAllOutput(), step.timeout || this.config.defaultTimeout);
            }
            else if (action === 'validate_output') {
                result = await this.parser.validateOutput(this.parser.getLatestOutput(this.runner.getCommandHistory(), this.runner.getOutputBuffer()), step.expected || step.value);
            }
            else if (action === 'validate_exit_code') {
                result = this.parser.validateExitCode(this.runner.getCommandHistory(), parseInt(step.expected || step.value || '0'));
            }
            else if (action === 'capture_output') {
                result = this.parser.captureOutput(this.runner.getOutputBuffer());
            }
            else if (action === 'kill' || action === 'kill_process') {
                await this.kill(step.target);
            }
            else if (action === 'wait') {
                await (0, async_1.delay)(parseInt(step.value || '1000'));
            }
            else if (action === 'set_environment') {
                this.runner.setEnvironmentVariable(step.target, step.value || '');
            }
            else if (action === 'change_directory') {
                this.config.workingDirectory = path.resolve(step.target);
            }
            else if (action === 'file_exists') {
                result = await this.fileExists(step.target);
            }
            else if (action === 'directory_exists') {
                result = await this.directoryExists(step.target);
            }
            else {
                throw new Error(`Unsupported CLI action: ${step.action}`);
            }
            return { stepIndex, status: TestModels_1.TestStatus.PASSED, duration: Date.now() - startTime,
                actualResult: typeof result === 'string' ? result : JSON.stringify(result) };
        }
        catch (error) {
            return { stepIndex, status: TestModels_1.TestStatus.FAILED, duration: Date.now() - startTime, error: error instanceof Error ? error.message : String(error) };
        }
    }
    async validateOutput(output, expected) {
        return this.parser.validateOutput(output, expected);
    }
    async waitForOutput(pattern, timeout = this.config.defaultTimeout) {
        return this.parser.waitForOutput(pattern, () => this.getAllOutput(), timeout);
    }
    captureOutput() {
        return this.parser.captureOutput(this.runner.getOutputBuffer());
    }
    async kill(processId) {
        if (processId)
            await this.runner.killProcess(processId);
        else
            await this.runner.killAllProcesses();
    }
    async cleanup() {
        try {
            await this.runner.killAllProcesses();
            this.runner.reset();
            this.emit('cleanup');
        }
        catch (_e) { /* best-effort */ }
    }
    getAllOutput() {
        return [...this.runner.getOutputBuffer()]
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            .map(e => e.data).join('');
    }
    async handleExecuteAction(step) {
        const parts = step.target.split(' ');
        const options = {};
        if (step.timeout)
            options.timeout = step.timeout;
        if (step.value) {
            try {
                options.env = JSON.parse(step.value);
            }
            catch {
                options.input = step.value;
            }
        }
        return this.runner.executeCommand(parts[0], parts.slice(1), this.withScenarioWorkingDirectory(options));
    }
    withScenarioWorkingDirectory(options) {
        if (options.cwd !== undefined || this.scenarioWorkingDirectory === undefined) {
            return options;
        }
        return { ...options, cwd: this.scenarioWorkingDirectory };
    }
    resolveScenarioWorkingDirectory(scenario) {
        if (!scenario.agents || scenario.agents.length === 0) {
            return undefined;
        }
        const commandAgent = scenario.agents.find(agent => this.isCommandCapableScenarioAgent(agent) && this.hasWorkingDirectoryConfig(agent.config));
        if (commandAgent) {
            return this.resolveWorkingDirectoryFromConfig(commandAgent.config, commandAgent);
        }
        const fallbackAgent = scenario.agents.find(agent => this.hasWorkingDirectoryConfig(agent.config));
        if (fallbackAgent) {
            return this.resolveWorkingDirectoryFromConfig(fallbackAgent.config, fallbackAgent);
        }
        return undefined;
    }
    isCommandCapableScenarioAgent(agent) {
        return ['cli', 'system'].includes(agent.type.toLowerCase());
    }
    hasWorkingDirectoryConfig(config) {
        return config !== undefined && ('workingDirectory' in config || 'cwd' in config);
    }
    resolveWorkingDirectoryFromConfig(config, agent) {
        if (!config) {
            return undefined;
        }
        if ('workingDirectory' in config) {
            return this.requireNonEmptyWorkingDirectory(config.workingDirectory, 'workingDirectory', agent);
        }
        if ('cwd' in config) {
            return this.requireNonEmptyWorkingDirectory(config.cwd, 'cwd', agent);
        }
        return undefined;
    }
    requireNonEmptyWorkingDirectory(value, fieldName, agent) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
        const agentLabel = agent.id || agent.name || agent.type;
        throw new Error(`Invalid scenario agent ${fieldName} for "${agentLabel}": expected a non-empty string`);
    }
    async fileExists(filePath) {
        try {
            await fs.access(path.resolve(this.config.workingDirectory, filePath));
            return true;
        }
        catch {
            return false;
        }
    }
    async directoryExists(dirPath) {
        try {
            const s = await fs.stat(path.resolve(this.config.workingDirectory, dirPath));
            return s.isDirectory();
        }
        catch {
            return false;
        }
    }
}
exports.CLIAgent = CLIAgent;
function createCLIAgent(config) {
    return new CLIAgent(config);
}
//# sourceMappingURL=CLIAgent.js.map