/**
 * Cross-platform PTY (Pseudo Terminal) management using node-pty
 * Provides a unified interface for creating and managing terminal processes
 */

import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { platform } from 'os';

/**
 * PTY configuration options
 */
export interface PTYConfig {
  /** Shell to spawn (e.g., 'bash', 'cmd.exe', 'powershell.exe') */
  shell?: string;
  /** Arguments to pass to the shell */
  args?: string[];
  /** Working directory for the terminal */
  cwd?: string;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Terminal columns */
  cols?: number;
  /** Terminal rows */
  rows?: number;
  /** Terminal encoding */
  encoding?: string;
  /** Use Windows ConPTY (Windows 10+ only) */
  useConpty?: boolean;
  /** Experimental Windows feature */
  experimentalUseConpty?: boolean;
}

/**
 * PTY process information
 */
export interface PTYProcess {
  /** Process ID */
  pid: number;
  /** Process title */
  process: string;
  /** Exit code (if exited) */
  exitCode?: number;
  /** Signal that terminated the process */
  signal?: string;
}

/**
 * PTY events interface
 */
export interface PTYEvents {
  data: (data: string) => void;
  exit: (exitCode: number, signal?: string) => void;
  spawn: () => void;
  error: (error: Error) => void;
  resize: (size: { cols: number; rows: number }) => void;
}

/**
 * Cross-platform PTY manager for terminal process management
 */
export class PTYManager extends EventEmitter {
  private pty: pty.IPty | null = null;
  private config: Required<PTYConfig>;
  private isActive = false;
  private dataBuffer: string[] = [];
  private maxBufferSize = 10000; // Maximum lines to keep in buffer

  constructor(config: PTYConfig = {}) {
    super();

    // Set platform-specific defaults
    const defaultShell = this.getDefaultShell();

    this.config = {
      shell: config.shell || defaultShell,
      args: config.args || [],
      cwd: config.cwd || process.cwd(),
      env: { ...process.env, ...config.env },
      cols: config.cols || 80,
      rows: config.rows || 24,
      encoding: config.encoding || 'utf8',
      useConpty: config.useConpty ?? true,
      experimentalUseConpty: config.experimentalUseConpty ?? false,
    };
  }

  /**
   * Get the default shell for the current platform
   */
  private getDefaultShell(): string {
    const currentPlatform = platform();

    switch (currentPlatform) {
      case 'win32':
        return process.env.COMSPEC || 'cmd.exe';
      case 'darwin':
        return process.env.SHELL || '/bin/zsh';
      default: // Linux and others
        return process.env.SHELL || '/bin/bash';
    }
  }

  /**
   * Spawn a new PTY process
   */
  public spawn(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.pty) {
          this.kill();
        }

        // Platform-specific options
        const options: pty.IPtyForkOptions = {
          cwd: this.config.cwd,
          env: this.config.env,
          cols: this.config.cols,
          rows: this.config.rows,
          encoding: this.config.encoding as any,
        };

        // Windows-specific options
        if (platform() === 'win32') {
          (options as any).useConpty = this.config.useConpty;
          (options as any).experimentalUseConpty = this.config.experimentalUseConpty;
        }

        this.pty = pty.spawn(this.config.shell, this.config.args, options);
        this.isActive = true;

        // Set up event handlers
        this.pty.onData((data: string) => {
          this.addToBuffer(data);
          this.emit('data', data);
        });

        this.pty.onExit((event: { exitCode: number; signal?: number }) => {
          this.isActive = false;
          this.emit('exit', event.exitCode, event.signal);
        });

        // Emit spawn event
        this.emit('spawn');
        resolve();

      } catch (error) {
        this.emit('error', error as Error);
        reject(error);
      }
    });
  }

  /**
   * Write data to the PTY
   */
  public write(data: string): boolean {
    if (!this.pty || !this.isActive) {
      throw new Error('PTY is not active');
    }

    try {
      this.pty.write(data);
      return true;
    } catch (error) {
      this.emit('error', error as Error);
      return false;
    }
  }

  /**
   * Write a line to the PTY (appends newline)
   */
  public writeLine(data: string): boolean {
    return this.write(data + '\r');
  }

  /**
   * Send a control sequence (e.g., Ctrl+C)
   */
  public sendControl(char: string): boolean {
    if (!this.pty || !this.isActive) {
      throw new Error('PTY is not active');
    }

    const controlCode = char.toUpperCase().charCodeAt(0) - 64; // Convert to control code
    return this.write(String.fromCharCode(controlCode));
  }

  /**
   * Resize the PTY
   */
  public resize(cols: number, rows: number): void {
    if (!this.pty || !this.isActive) {
      throw new Error('PTY is not active');
    }

    try {
      this.pty.resize(cols, rows);
      this.config.cols = cols;
      this.config.rows = rows;
      this.emit('resize', { cols, rows });
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Get current PTY process information
   */
  public getProcess(): PTYProcess | null {
    if (!this.pty) {
      return null;
    }

    return {
      pid: this.pty.pid,
      process: this.pty.process,
      exitCode: this.isActive ? undefined : 0,
    };
  }

  /**
   * Get PTY dimensions
   */
  public getDimensions(): { cols: number; rows: number } {
    return {
      cols: this.config.cols,
      rows: this.config.rows,
    };
  }

  /**
   * Check if PTY is active
   */
  public isRunning(): boolean {
    return this.isActive && this.pty !== null;
  }

  /**
   * Get buffered output
   */
  public getBuffer(lines?: number): string[] {
    if (lines && lines > 0) {
      return this.dataBuffer.slice(-lines);
    }
    return [...this.dataBuffer];
  }

  /**
   * Clear the data buffer
   */
  public clearBuffer(): void {
    this.dataBuffer = [];
  }

  /**
   * Kill the PTY process
   */
  public kill(signal?: string): void {
    if (this.pty) {
      try {
        this.pty.kill(signal);
      } catch (error) {
        // Process might already be dead
      }
      this.pty = null;
      this.isActive = false;
    }
  }

  /**
   * Add data to the buffer with size management
   */
  private addToBuffer(data: string): void {
    // Split data into lines for better buffer management
    const lines = data.split('\n');

    for (const line of lines) {
      this.dataBuffer.push(line);

      // Manage buffer size
      if (this.dataBuffer.length > this.maxBufferSize) {
        this.dataBuffer.shift();
      }
    }
  }

  /**
   * Set maximum buffer size
   */
  public setMaxBufferSize(size: number): void {
    this.maxBufferSize = size;

    // Trim current buffer if needed
    while (this.dataBuffer.length > this.maxBufferSize) {
      this.dataBuffer.shift();
    }
  }

  /**
   * Get the shell path being used
   */
  public getShell(): string {
    return this.config.shell;
  }

  /**
   * Get the working directory
   */
  public getCwd(): string {
    return this.config.cwd;
  }

  /**
   * Cleanup and dispose of resources
   */
  public dispose(): void {
    this.kill();
    this.removeAllListeners();
    this.clearBuffer();
  }
}

/**
 * Utility function to create a PTY manager with common configurations
 */
export function createPTY(config?: PTYConfig): PTYManager {
  return new PTYManager(config);
}

/**
 * Utility function to create a PTY with a specific shell
 */
export function createShellPTY(shell: string, config?: Omit<PTYConfig, 'shell'>): PTYManager {
  return new PTYManager({ ...config, shell });
}

/**
 * Platform-specific PTY creators
 */
export const PTYCreators = {
  /**
   * Create a bash PTY (Unix/Linux/macOS)
   */
  bash: (config?: Omit<PTYConfig, 'shell'>) => createShellPTY('/bin/bash', config),

  /**
   * Create a zsh PTY (macOS default)
   */
  zsh: (config?: Omit<PTYConfig, 'shell'>) => createShellPTY('/bin/zsh', config),

  /**
   * Create a PowerShell PTY (Windows/Cross-platform)
   */
  powershell: (config?: Omit<PTYConfig, 'shell'>) => {
    const shell = platform() === 'win32' ? 'powershell.exe' : 'pwsh';
    return createShellPTY(shell, config);
  },

  /**
   * Create a Command Prompt PTY (Windows)
   */
  cmd: (config?: Omit<PTYConfig, 'shell'>) => createShellPTY('cmd.exe', config),

  /**
   * Create a fish PTY
   */
  fish: (config?: Omit<PTYConfig, 'shell'>) => createShellPTY('/usr/bin/fish', config),
};