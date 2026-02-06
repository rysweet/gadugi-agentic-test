/**
 * CLIAgent - Comprehensive CLI testing agent using Node.js child_process
 *
 * This agent provides complete automation capabilities for CLI applications
 * including command execution, output validation, timeout handling, and
 * comprehensive error handling with automatic recovery.
 */
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { OrchestratorStep, StepResult, CommandResult } from '../models/TestModels';
import { LogLevel } from '../utils/logger';
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
    process: ChildProcess;
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
 * Comprehensive CLI testing agent
 */
export declare class CLIAgent extends EventEmitter implements IAgent {
    readonly name = "CLIAgent";
    readonly type = AgentType.SYSTEM;
    private config;
    private logger;
    private isInitialized;
    private currentScenarioId?;
    private runningProcesses;
    private commandHistory;
    private outputBuffer;
    private interactiveResponses;
    constructor(config?: CLIAgentConfig);
    /**
     * Initialize the agent
     */
    initialize(): Promise<void>;
    /**
     * Execute a test scenario
     */
    execute(scenario: any): Promise<any>;
    /**
     * Execute a CLI command with full configuration
     */
    executeCommand(command: string, args?: string[], options?: Partial<ExecutionContext>): Promise<CommandResult>;
    /**
     * Execute a test step
     */
    executeStep(step: OrchestratorStep, stepIndex: number): Promise<StepResult>;
    /**
     * Validate command output against expected result
     */
    validateOutput(output: string, expected: any): Promise<boolean>;
    /**
     * Wait for specific output pattern
     */
    waitForOutput(pattern: string, timeout?: number): Promise<string>;
    /**
     * Capture current output buffer
     */
    captureOutput(): {
        stdout: string;
        stderr: string;
        combined: string;
    };
    /**
     * Kill a specific process
     */
    kill(processId?: string): Promise<void>;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    private executeWithRetry;
    private handleInteractivePrompt;
    private handleExecuteAction;
    private handleExecuteWithInputAction;
    private validateExitCode;
    private killProcess;
    private killAllProcesses;
    private setEnvironmentVariable;
    private setEnvironmentVariables;
    private changeWorkingDirectory;
    private fileExists;
    private directoryExists;
    private getLatestOutput;
    private getAllOutput;
    private getScenarioLogs;
    private getScenarioCommandHistory;
    private setupEventListeners;
    private setupInteractiveResponses;
    private validateWorkingDirectory;
    private sanitizeConfig;
    private deepEqual;
    private delay;
}
/**
 * Factory function to create CLIAgent instance
 */
export declare function createCLIAgent(config?: CLIAgentConfig): CLIAgent;
//# sourceMappingURL=CLIAgent.d.ts.map