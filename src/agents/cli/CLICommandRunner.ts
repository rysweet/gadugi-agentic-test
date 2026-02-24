/**
 * CLICommandRunner - Command execution and output capture
 *
 * Responsible for spawning/exec-ing child processes, capturing stdout/stderr,
 * handling timeouts, interactive prompts, and retry logic.
 */

import { spawn, exec, ChildProcess, SpawnOptions, ExecOptions } from 'child_process';
import { CommandResult } from '../../models/TestModels';
import { TestLogger } from '../../utils/logger';
import { delay } from '../../utils/async';
import { generateId } from '../../utils/ids';
import { CLIAgentConfig, CLIProcessInfo, ExecutionContext, StreamData } from './types';

export class CLICommandRunner {
  private config: Required<CLIAgentConfig>;
  private logger: TestLogger;
  private runningProcesses: Map<string, CLIProcessInfo> = new Map();
  private outputBuffer: StreamData[] = [];
  private commandHistory: CommandResult[] = [];
  private interactiveResponses: Map<string, string> = new Map();

  constructor(config: Required<CLIAgentConfig>, logger: TestLogger) {
    this.config = config;
    this.logger = logger;
  }

  setupInteractiveResponses(): void {
    this.interactiveResponses.clear();
    for (const [prompt, response] of Object.entries(this.config.ioConfig.autoResponses)) {
      this.interactiveResponses.set(prompt, response);
    }
  }

  async executeCommand(command: string, args: string[] = [], options: Partial<ExecutionContext> = {}): Promise<CommandResult> {
    const context: ExecutionContext = {
      command, args,
      cwd: options.cwd || this.config.workingDirectory,
      env: { ...this.config.environment, ...options.env },
      timeout: options.timeout || this.config.defaultTimeout,
      expectedExitCodes: options.expectedExitCodes || [0],
      ...options
    };
    this.logger.commandExecution(command, context.cwd);
    const startTime = Date.now();
    let attempt = 0;
    const maxAttempts = this.config.retryConfig.maxRetries + 1;
    while (attempt < maxAttempts) {
      try {
        const result = await this.spawnProcess(context);
        this.logger.commandComplete(command, result.exitCode, Date.now() - startTime);
        this.commandHistory.push(result);
        return result;
      } catch (error: unknown) {
        attempt++;
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= maxAttempts) {
          const failedResult: CommandResult = {
            command: `${command} ${args.join(' ')}`.trim(), exitCode: -1, stdout: '',
            stderr: message || 'Unknown error', duration: Date.now() - startTime,
            ...(context.cwd !== undefined ? { workingDirectory: context.cwd } : {}),
            ...(context.env !== undefined ? { environment: context.env } : {}),
          };
          this.commandHistory.push(failedResult);
          throw error;
        }
        this.logger.warn(`Command attempt ${attempt} failed, retrying in ${this.config.retryConfig.retryDelay}ms`,
          { error: message, attempt, maxAttempts });
        await delay(this.config.retryConfig.retryDelay);
      }
    }
    throw new Error('Unexpected end of retry loop');
  }

  async killProcess(processId: string): Promise<void> {
    const info = this.runningProcesses.get(processId);
    if (!info) { this.logger.warn(`Process not found: ${processId}`); return; }
    try {
      this.logger.info(`Killing process: ${info.command} (PID: ${info.pid})`);
      if (info.process) {
        info.process.kill('SIGTERM');
        await delay(1000);
        if (!info.process.killed) info.process.kill('SIGKILL');
      }
      info.status = 'killed';
      this.runningProcesses.delete(processId);
    } catch (error: unknown) {
      this.logger.error(`Failed to kill process ${processId}`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async killAllProcesses(): Promise<void> {
    const ids = Array.from(this.runningProcesses.keys());
    if (ids.length === 0) return;
    this.logger.info(`Killing ${ids.length} running processes`);
    await Promise.all(ids.map(id =>
      this.killProcess(id).catch(err =>
        this.logger.warn(`Failed to kill process ${id}`, { error: err?.message })
      )
    ));
  }

  setEnvironmentVariable(name: string, value: string): void {
    this.config.environment[name] = value;
    this.logger.debug(`Set environment variable: ${name}=${value}`);
  }

  setEnvironmentVariables(variables: Record<string, string>): void {
    for (const [name, value] of Object.entries(variables)) {
      this.setEnvironmentVariable(name, value);
    }
  }

  getOutputBuffer(): StreamData[] { return [...this.outputBuffer]; }
  getCommandHistory(): CommandResult[] { return [...this.commandHistory]; }
  reset(): void { this.outputBuffer = []; this.commandHistory = []; this.runningProcesses.clear(); }

  // -------------------------------------------------------------------------
  // Private implementation
  // -------------------------------------------------------------------------

  private async spawnProcess(context: ExecutionContext): Promise<CommandResult> {
    const fullCommand = `${context.command} ${context.args.join(' ')}`.trim();
    const processId = generateId();

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timeoutHandle: NodeJS.Timeout;
      let childProcess: ChildProcess;

      if (this.config.executionMode === 'exec' ||
          (this.config.executionMode === 'auto' && context.args.length === 0)) {
        const execOptions: ExecOptions = {
          cwd: context.cwd, env: context.env,
          maxBuffer: this.config.maxBufferSize,
          timeout: context.timeout, encoding: this.config.ioConfig.encoding
        };
        childProcess = exec(fullCommand, execOptions, (error, stdoutBuf, stderrBuf) => {
          clearTimeout(timeoutHandle);
          const exitCode = error ? (error as any).code || 1 : 0;
          const stdoutStr = typeof stdoutBuf === 'string' ? stdoutBuf : stdoutBuf?.toString(this.config.ioConfig.encoding) || '';
          const stderrStr = typeof stderrBuf === 'string' ? stderrBuf : stderrBuf?.toString(this.config.ioConfig.encoding) || '';
          const result: CommandResult = {
            command: fullCommand, exitCode, stdout: stdoutStr, stderr: stderrStr,
            duration: Date.now() - startTime,
            ...(context.cwd !== undefined ? { workingDirectory: context.cwd } : {}),
            ...(context.env !== undefined ? { environment: context.env } : {}),
          };
          if (context.expectedExitCodes!.includes(exitCode)) resolve(result);
          else reject(new Error(`Command failed with exit code ${exitCode}: ${stderrStr || error?.message}`));
        });
      } else {
        const spawnOptions: SpawnOptions = {
          cwd: context.cwd, env: context.env, shell: this.config.shell, stdio: ['pipe', 'pipe', 'pipe']
        };
        childProcess = spawn(context.command, context.args, spawnOptions);
        childProcess.stdout?.on('data', (data: Buffer) => {
          const output = data.toString(this.config.ioConfig.encoding);
          stdout += output;
          if (this.config.captureOutput) {
            this.outputBuffer.push({ type: 'stdout', data: output, timestamp: new Date(), ...(childProcess.pid !== undefined ? { pid: childProcess.pid } : {}) });
          }
          this.handleInteractivePrompt(output, childProcess);
          if (this.config.logConfig.logOutput) this.logger.debug(`[STDOUT] ${output.trim()}`);
        });
        childProcess.stderr?.on('data', (data: Buffer) => {
          const output = data.toString(this.config.ioConfig.encoding);
          stderr += output;
          if (this.config.captureOutput) {
            this.outputBuffer.push({ type: 'stderr', data: output, timestamp: new Date(), ...(childProcess.pid !== undefined ? { pid: childProcess.pid } : {}) });
          }
          if (this.config.logConfig.logOutput) this.logger.debug(`[STDERR] ${output.trim()}`);
        });
        childProcess.on('close', (code: number | null) => {
          clearTimeout(timeoutHandle);
          this.runningProcesses.delete(processId);
          const exitCode = code ?? -1;
          const result: CommandResult = {
            command: fullCommand, exitCode, stdout, stderr,
            duration: Date.now() - startTime,
            ...(context.cwd !== undefined ? { workingDirectory: context.cwd } : {}),
            ...(context.env !== undefined ? { environment: context.env } : {}),
          };
          if (context.expectedExitCodes!.includes(exitCode)) resolve(result);
          else reject(new Error(`Command failed with exit code ${exitCode}: ${stderr}`));
        });
        childProcess.on('error', (error: Error) => {
          clearTimeout(timeoutHandle);
          this.runningProcesses.delete(processId);
          reject(new Error(`Process error: ${error.message}`));
        });
        if (context.input && childProcess.stdin) {
          childProcess.stdin.write(context.input);
          childProcess.stdin.end();
        }
      }

      this.runningProcesses.set(processId, {
        pid: childProcess.pid || 0, command: fullCommand,
        startTime: new Date(startTime), status: 'running', process: childProcess
      });
      if (context.timeout && context.timeout > 0) {
        timeoutHandle = setTimeout(() => {
          this.killProcess(processId);
          reject(new Error(`Command timeout after ${context.timeout}ms: ${fullCommand}`));
        }, context.timeout);
      }
    });
  }

  private handleInteractivePrompt(output: string, process: ChildProcess): void {
    if (!this.config.ioConfig.handleInteractivePrompts || !process.stdin) return;
    for (const [prompt, response] of Array.from(this.interactiveResponses.entries())) {
      if (output.includes(prompt)) {
        this.logger.debug(`Responding to interactive prompt: "${prompt}" with "${response}"`);
        process.stdin.write(`${response}\n`);
        break;
      }
    }
  }
}
