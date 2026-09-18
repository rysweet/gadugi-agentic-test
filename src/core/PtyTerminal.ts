import { EventEmitter } from 'events';
import { createRequire } from 'module';
import { ProcessLifecycleManager, ProcessInfo } from './ProcessLifecycleManager';
import { adaptiveWaiter, waitForTerminalReady, waitForOutput } from './AdaptiveWaiter';
import { logger } from '../utils/logger';

interface PtyProcess {
  pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): void;
}

interface PtyModule {
  spawn(
    file: string,
    args: string[],
    options: {
      name: string;
      cols: number;
      rows: number;
      cwd: string;
      env: { [key: string]: string };
    }
  ): PtyProcess;
}

const requireModule = createRequire(__filename);

function loadPtyModule(): PtyModule {
  try {
    return requireModule('node-pty-prebuilt-multiarch') as PtyModule;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(
      'PTY support requires the optional node-pty-prebuilt-multiarch dependency. '
      + `Install native build tools and reinstall @gadugi/agentic-test${detail}`
    );
  }
}

/**
 * Terminal dimensions
 */
export interface TerminalDimensions {
  cols: number;
  rows: number;
}

/**
 * PTY terminal configuration
 */
export interface PtyTerminalConfig {
  shell?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  dimensions?: TerminalDimensions;
  timeout?: number;
}

/**
 * PTY terminal events
 */
export interface PtyTerminalEvents {
  data: (data: string) => void;
  exit: (exitCode: number | null, signal: string | null) => void;
  error: (error: Error) => void;
  ready: () => void;
  destroyed: () => void;
}

/**
 * PtyTerminal
 *
 * PTY-based terminal manager that manages terminal processes
 * with integrated ProcessLifecycleManager to prevent zombie processes.
 */
export class PtyTerminal extends EventEmitter {
  private ptyProcess: PtyProcess | null = null;
  private processInfo: ProcessInfo | null = null;
  private processManager: ProcessLifecycleManager;
  private config: Required<PtyTerminalConfig>;
  private isDestroyed = false;
  private outputBuffer = '';
  private inputHistory: string[] = [];
  private readonly processExitedHandler = (
    processInfo: ProcessInfo,
    code: number | null,
    signal: string | null
  ): void => {
    if (processInfo.pid === this.processInfo?.pid) {
      this.emit('exit', code, signal);
    }
  };
  private readonly processErrorHandler = (
    error: Error,
    processInfo?: ProcessInfo
  ): void => {
    if (processInfo?.pid === this.processInfo?.pid) {
      this.emit('error', error);
    }
  };

  constructor(
    config: PtyTerminalConfig = {},
    processManager?: ProcessLifecycleManager
  ) {
    super();

    this.processManager = processManager || new ProcessLifecycleManager();

    // Set default configuration
    this.config = {
      shell: config.shell || this.detectShell(),
      env: config.env || process.env,
      cwd: config.cwd || process.cwd(),
      dimensions: config.dimensions || { cols: 80, rows: 24 },
      timeout: config.timeout || 30000,
    };

    this.setupProcessManagerEvents();
  }

  /**
   * Detect the default shell for the current platform
   */
  private detectShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }

    return process.env.SHELL || '/bin/bash';
  }

  /**
   * Set up event handlers for the process manager
   */
  private setupProcessManagerEvents(): void {
    this.processManager.on('processExited', this.processExitedHandler);
    this.processManager.on('error', this.processErrorHandler);
  }

  /**
   * Start the terminal process
   */
  public async start(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Cannot start a destroyed PtyTerminal');
    }

    if (this.ptyProcess) {
      throw new Error('PtyTerminal is already started');
    }

    try {
      // Create PTY process
      const pty = loadPtyModule();
      this.ptyProcess = pty.spawn(this.config.shell, [], {
        name: 'xterm-color',
        cols: this.config.dimensions.cols,
        rows: this.config.dimensions.rows,
        cwd: this.config.cwd,
        env: this.config.env as { [key: string]: string },
      });

      // Track the process with our lifecycle manager
      // Note: node-pty doesn't expose the underlying child process directly,
      // so we create a custom process info for tracking
      this.processInfo = {
        pid: this.ptyProcess.pid,
        command: this.config.shell,
        args: [],
        startTime: new Date(),
        status: 'running',
      };

      // Set up PTY event handlers
      this.setupPtyHandlers();

      this.emit('ready');
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Set up PTY event handlers
   */
  private setupPtyHandlers(): void {
    if (!this.ptyProcess) {
      return;
    }

    // Handle data output
    this.ptyProcess.onData((data: string) => {
      this.outputBuffer += data;
      this.emit('data', data);
    });

    // Handle process exit
    this.ptyProcess.onExit(({ exitCode, signal }) => {
      if (this.processInfo) {
        this.processInfo.status = 'exited';
        if (exitCode !== null && exitCode !== undefined) { this.processInfo.exitCode = exitCode; }
      }

      this.emit('exit', exitCode, signal?.toString() || null);
    });
  }

  /**
   * Write input to the terminal
   */
  public write(data: string): void {
    if (!this.ptyProcess || this.isDestroyed) {
      throw new Error('PtyTerminal is not started or is destroyed');
    }

    this.ptyProcess.write(data);
    this.inputHistory.push(data);
  }

  /**
   * Write a line to the terminal (adds newline)
   */
  public writeLine(data: string): void {
    this.write(`${data  }\r\n`);
  }

  /**
   * Send a control sequence (e.g., Ctrl+C = sendControl('C')).
   * @param char - A single ASCII letter A-Z (case-insensitive). Any other
   *               value is rejected to prevent injection of arbitrary control
   *               codes through crafted input.
   */
  public sendControl(char: string): void {
    if (!/^[A-Za-z]$/.test(char)) {
      throw new Error(`sendControl requires a single letter A-Z, got: ${JSON.stringify(char)}`);
    }

    if (!this.ptyProcess || this.isDestroyed) {
      throw new Error('PtyTerminal is not started or is destroyed');
    }

    // Ctrl+A = \x01, Ctrl+B = \x02, … Ctrl+Z = \x1a
    const code = char.toUpperCase().charCodeAt(0) - 64;
    this.ptyProcess.write(String.fromCharCode(code));
  }

  /**
   * Execute a command and wait for completion using AdaptiveWaiter
   */
  public async executeCommand(
    command: string,
    options: {
      timeout?: number;
      expectedOutput?: string | RegExp;
    } = {}
  ): Promise<string> {
    if (!this.ptyProcess || this.isDestroyed) {
      throw new Error('PtyTerminal is not started or is destroyed');
    }

    const timeout = options.timeout || this.config.timeout;
    const initialBufferLength = this.outputBuffer.length;

    // Execute the command
    this.writeLine(command);

    // Use AdaptiveWaiter for intelligent output detection
    const result = options.expectedOutput
      ? await waitForOutput(
          () => this.outputBuffer.substring(initialBufferLength),
          options.expectedOutput,
          { timeout, initialDelay: 50, maxDelay: 500 }
        )
      : await waitForTerminalReady(
          () => this.outputBuffer.substring(initialBufferLength),
          /\$\s*$/,
          { timeout, initialDelay: 100, maxDelay: 1000 }
        );

    if (!result.success) {
      if (result.lastError) {
        throw result.lastError;
      }
      throw new Error(`Command execution timeout after ${timeout}ms: ${command}`);
    }

    return result.result || this.outputBuffer.substring(initialBufferLength);
  }

  /**
   * Clear the output buffer
   */
  public clearOutput(): void {
    this.outputBuffer = '';
  }

  /**
   * Get the current output buffer
   */
  public getOutput(): string {
    return this.outputBuffer;
  }

  /**
   * Get the input history
   */
  public getInputHistory(): string[] {
    return [...this.inputHistory];
  }

  /**
   * Get the process information
   */
  public getProcessInfo(): ProcessInfo | null {
    return this.processInfo ? { ...this.processInfo } : null;
  }

  /**
   * Check if the agent is running
   */
  public isRunning(): boolean {
    return this.ptyProcess !== null && this.processInfo?.status === 'running';
  }

  /**
   * Resize the terminal
   */
  public resize(dimensions: TerminalDimensions): void {
    if (!this.ptyProcess || this.isDestroyed) {
      throw new Error('PtyTerminal is not started or is destroyed');
    }

    this.ptyProcess.resize(dimensions.cols, dimensions.rows);
    this.config.dimensions = dimensions;
  }

  /**
   * Kill the terminal process
   */
  public async kill(signal: string = 'SIGTERM'): Promise<void> {
    if (!this.ptyProcess) {
      return;
    }

    try {
      this.ptyProcess.kill(signal);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Destroy the TUI agent and clean up all resources
   */
  public async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    this.processManager.off('processExited', this.processExitedHandler);
    this.processManager.off('error', this.processErrorHandler);

    let cleanupError: Error | undefined;
    try {
      // Kill the process if it's running
      if (this.isRunning()) {
        await this.kill('SIGTERM');

        // Use AdaptiveWaiter to wait for graceful termination
        const result = await adaptiveWaiter.waitForCondition(
          () => !this.isRunning(),
          {
            initialDelay: 100,
            maxDelay: 500,
            timeout: 2000,
            jitter: 0.1
          }
        );

        // Force kill if still running after timeout
        if (!result.success && this.isRunning()) {
          await this.kill('SIGKILL');
          const forcedResult = await adaptiveWaiter.waitForCondition(
            () => !this.isRunning(),
            {
              initialDelay: 25,
              maxDelay: 100,
              timeout: 2000,
              jitter: 0.1
            }
          );
          if (!forcedResult.success) {
            throw new Error(`PTY process ${this.processInfo?.pid ?? 'unknown'} did not exit`);
          }
        }
      }
    } catch (error) {
      cleanupError = error instanceof Error ? error : new Error(String(error));
    } finally {
      if (this.ptyProcess) {
        try {
          if (this.isRunning()) {
            this.ptyProcess.kill('SIGKILL');
          }
        } catch (error) {
          cleanupError ??= error instanceof Error ? error : new Error(String(error));
          logger.warn('Error killing PTY process during cleanup:', error);
        }
        this.ptyProcess = null;
      }

      // Clear tracking info
      this.processInfo = null;
      this.outputBuffer = '';
      this.inputHistory = [];

      this.emit('destroyed');
    }

    if (cleanupError) {
      this.emit('error', cleanupError);
      throw cleanupError;
    }
  }
}