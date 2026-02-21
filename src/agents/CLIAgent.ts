/**
 * CLIAgent - Thin facade over focused CLI sub-modules
 *
 * Delegates command execution to CLICommandRunner and output parsing to
 * CLIOutputParser. Preserves the full public API of the original implementation.
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IAgent, AgentType } from './index';
import { TestStep, TestStatus, StepResult, CommandResult } from '../models/TestModels';
import { createLogger } from '../utils/logger';
import { delay } from '../utils/async';
import { CLIAgentConfig, CLIProcessInfo, ExecutionContext, StreamData, DEFAULT_CLI_CONFIG } from './cli/types';
import { CLICommandRunner } from './cli/CLICommandRunner';
import { CLIOutputParser } from './cli/CLIOutputParser';

export type { CLIAgentConfig, CLIProcessInfo, ExecutionContext, StreamData };

export class CLIAgent extends EventEmitter implements IAgent {
  public readonly name = 'CLIAgent';
  public readonly type = AgentType.CLI;

  private config: Required<CLIAgentConfig>;
  private runner: CLICommandRunner;
  private parser: CLIOutputParser;
  private isInitialized = false;

  constructor(config: CLIAgentConfig = {}) {
    super();
    this.config = { ...DEFAULT_CLI_CONFIG, ...config };
    const logger = createLogger({ level: this.config.logConfig.logLevel, logDir: './logs/cli-agent' });
    this.runner = new CLICommandRunner(this.config, logger);
    this.parser = new CLIOutputParser(this.config.defaultTimeout);
    this.on('error', (_e) => { /* surfaced via execute return values */ });
  }

  async initialize(): Promise<void> {
    try {
      await this.validateWorkingDirectory();
      this.runner.setupInteractiveResponses();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error: any) {
      throw new Error(`Failed to initialize CLIAgent: ${error?.message}`);
    }
  }

  async execute(scenario: any): Promise<any> {
    if (!this.isInitialized) throw new Error('Agent not initialized. Call initialize() first.');
    const startTime = Date.now();
    let status = TestStatus.PASSED;
    let error: string | undefined;
    try {
      if (scenario.environment) this.runner.setEnvironmentVariables(scenario.environment);
      const stepResults: StepResult[] = [];
      for (let i = 0; i < scenario.steps.length; i++) {
        const stepResult = await this.executeStep(scenario.steps[i], i);
        stepResults.push(stepResult);
        if (stepResult.status === TestStatus.FAILED || stepResult.status === TestStatus.ERROR) {
          status = stepResult.status; error = stepResult.error; break;
        }
      }
      return {
        scenarioId: scenario.id, status, duration: Date.now() - startTime,
        startTime: new Date(startTime), endTime: new Date(), error, stepResults,
        logs: this.parser.getScenarioLogs(this.runner.getOutputBuffer()),
        commandHistory: this.runner.getCommandHistory(), outputBuffer: this.runner.getOutputBuffer()
      };
    } catch (executeError: any) {
      status = TestStatus.ERROR; error = executeError?.message; throw executeError;
    } finally {
      await this.runner.killAllProcesses();
    }
  }

  async executeCommand(command: string, args: string[] = [], options: Partial<ExecutionContext> = {}): Promise<CommandResult> {
    return this.runner.executeCommand(command, args, options);
  }

  async executeStep(step: TestStep, stepIndex: number): Promise<StepResult> {
    const startTime = Date.now();
    try {
      let result: any;
      const action = step.action.toLowerCase();
      if (['execute', 'run', 'command', 'execute_command'].includes(action)) {
        result = await this.handleExecuteAction(step);
      } else if (action === 'execute_with_input') {
        const parts = step.target.split(' ');
        result = await this.runner.executeCommand(parts[0], parts.slice(1), { input: step.value || '', timeout: step.timeout });
      } else if (action === 'wait_for_output') {
        result = await this.parser.waitForOutput(step.target, () => this.getAllOutput(), step.timeout || this.config.defaultTimeout);
      } else if (action === 'validate_output') {
        result = await this.parser.validateOutput(
          this.parser.getLatestOutput(this.runner.getCommandHistory(), this.runner.getOutputBuffer()),
          step.expected || step.value
        );
      } else if (action === 'validate_exit_code') {
        result = this.parser.validateExitCode(this.runner.getCommandHistory(), parseInt(step.expected || step.value || '0'));
      } else if (action === 'capture_output') {
        result = this.parser.captureOutput(this.runner.getOutputBuffer());
      } else if (action === 'kill' || action === 'kill_process') {
        await this.kill(step.target);
      } else if (action === 'wait') {
        await delay(parseInt(step.value || '1000'));
      } else if (action === 'set_environment') {
        this.runner.setEnvironmentVariable(step.target, step.value || '');
      } else if (action === 'change_directory') {
        this.config.workingDirectory = path.resolve(step.target);
      } else if (action === 'file_exists') {
        result = await this.fileExists(step.target);
      } else if (action === 'directory_exists') {
        result = await this.directoryExists(step.target);
      } else {
        throw new Error(`Unsupported CLI action: ${step.action}`);
      }
      return { stepIndex, status: TestStatus.PASSED, duration: Date.now() - startTime,
        actualResult: typeof result === 'string' ? result : JSON.stringify(result) };
    } catch (error: any) {
      return { stepIndex, status: TestStatus.FAILED, duration: Date.now() - startTime, error: error?.message };
    }
  }

  async validateOutput(output: string, expected: any): Promise<boolean> {
    return this.parser.validateOutput(output, expected);
  }

  async waitForOutput(pattern: string, timeout: number = this.config.defaultTimeout): Promise<string> {
    return this.parser.waitForOutput(pattern, () => this.getAllOutput(), timeout);
  }

  captureOutput(): { stdout: string; stderr: string; combined: string } {
    return this.parser.captureOutput(this.runner.getOutputBuffer());
  }

  async kill(processId?: string): Promise<void> {
    if (processId) await this.runner.killProcess(processId);
    else await this.runner.killAllProcesses();
  }

  async cleanup(): Promise<void> {
    try { await this.runner.killAllProcesses(); this.runner.reset(); this.emit('cleanup'); }
    catch (_e) { /* best-effort */ }
  }

  private getAllOutput(): string {
    return [...this.runner.getOutputBuffer()]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(e => e.data).join('');
  }

  private async handleExecuteAction(step: TestStep): Promise<CommandResult> {
    const parts = step.target.split(' ');
    const options: Partial<ExecutionContext> = {};
    if (step.timeout) options.timeout = step.timeout;
    if (step.value) { try { options.env = JSON.parse(step.value); } catch { options.input = step.value; } }
    return this.runner.executeCommand(parts[0], parts.slice(1), options);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try { await fs.access(path.resolve(this.config.workingDirectory, filePath)); return true; }
    catch { return false; }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try { const s = await fs.stat(path.resolve(this.config.workingDirectory, dirPath)); return s.isDirectory(); }
    catch { return false; }
  }

  private async validateWorkingDirectory(): Promise<void> {
    try {
      await fs.access(this.config.workingDirectory);
      const stats = await fs.stat(this.config.workingDirectory);
      if (!stats.isDirectory()) throw new Error(`Working directory is not a directory: ${this.config.workingDirectory}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') throw new Error(`Working directory does not exist: ${this.config.workingDirectory}`);
      throw error;
    }
  }
}

export function createCLIAgent(config?: CLIAgentConfig): CLIAgent {
  return new CLIAgent(config);
}
