/**
 * CLI agent types and configuration interfaces
 */

import { LogLevel } from '../../utils/logger';

/**
 * Configuration options for the CLIAgent
 */
export interface CLIAgentConfig {
  /** Working directory for command execution */
  workingDirectory?: string;
  /** Default environment variables */
  environment?: Record<string, string>;
  /** Default timeout for commands in milliseconds */
  defaultTimeout?: number;
  /** Maximum buffer size for stdout/stderr */
  maxBufferSize?: number;
  /** Shell to use for command execution */
  shell?: string | boolean;
  /** Whether to capture output streams */
  captureOutput?: boolean;
  /** Command execution mode */
  executionMode?: 'spawn' | 'exec' | 'auto';
  /** Retry configuration */
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    retryOnExitCodes: number[];
  };
  /** Input/Output configuration */
  ioConfig?: {
    encoding: BufferEncoding;
    handleInteractivePrompts: boolean;
    autoResponses: Record<string, string>;
  };
  /** Logging configuration */
  logConfig?: {
    logCommands: boolean;
    logOutput: boolean;
    logLevel: LogLevel;
  };
}

/**
 * Running process information
 */
export interface CLIProcessInfo {
  /** Process ID */
  pid: number;
  /** Command being executed */
  command: string;
  /** Process start time */
  startTime: Date;
  /** Process status */
  status: 'running' | 'completed' | 'failed' | 'killed';
  /** Child process reference */
  process: import('child_process').ChildProcess;
}

/**
 * Command execution context
 */
export interface ExecutionContext {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Input data to send to process */
  input?: string;
  /** Expected exit codes (default: [0]) */
  expectedExitCodes?: number[];
}

/**
 * Output stream data
 */
export interface StreamData {
  /** Stream type */
  type: 'stdout' | 'stderr';
  /** Data content */
  data: string;
  /** Timestamp */
  timestamp: Date;
  /** Process ID */
  pid?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CLI_CONFIG: Required<CLIAgentConfig> = {
  workingDirectory: process.cwd(),
  environment: {},
  defaultTimeout: 30000,
  maxBufferSize: 1024 * 1024, // 1MB
  shell: true,
  captureOutput: true,
  executionMode: 'auto',
  retryConfig: {
    maxRetries: 2,
    retryDelay: 1000,
    retryOnExitCodes: [1]
  },
  ioConfig: {
    encoding: 'utf8',
    handleInteractivePrompts: true,
    autoResponses: {
      'Are you sure? (y/N)': 'y',
      'Continue? (y/N)': 'y',
      'Overwrite? (y/N)': 'y'
    }
  },
  logConfig: {
    logCommands: true,
    logOutput: true,
    logLevel: LogLevel.DEBUG
  }
};
