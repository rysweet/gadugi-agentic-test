import { EventEmitter } from 'events';
import { ProcessLifecycleManager, ProcessInfo } from './ProcessLifecycleManager';
/**
 * Terminal dimensions
 */
export interface TerminalDimensions {
    cols: number;
    rows: number;
}
/**
 * TUI Agent configuration
 */
export interface TUIAgentConfig {
    shell?: string;
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    dimensions?: TerminalDimensions;
    timeout?: number;
}
/**
 * TUI Agent events
 */
export interface TUIAgentEvents {
    data: (data: string) => void;
    exit: (exitCode: number | null, signal: string | null) => void;
    error: (error: Error) => void;
    ready: () => void;
    destroyed: () => void;
}
/**
 * TUIAgent
 *
 * Terminal User Interface Agent that manages terminal processes
 * with integrated ProcessLifecycleManager to prevent zombie processes.
 */
export declare class TUIAgent extends EventEmitter {
    private ptyProcess;
    private processInfo;
    private processManager;
    private config;
    private isDestroyed;
    private outputBuffer;
    private inputHistory;
    constructor(config?: TUIAgentConfig, processManager?: ProcessLifecycleManager);
    /**
     * Detect the default shell for the current platform
     */
    private detectShell;
    /**
     * Set up event handlers for the process manager
     */
    private setupProcessManagerEvents;
    /**
     * Start the terminal process
     */
    start(): Promise<void>;
    /**
     * Set up PTY event handlers
     */
    private setupPtyHandlers;
    /**
     * Write input to the terminal
     */
    write(data: string): void;
    /**
     * Write a line to the terminal (adds newline)
     */
    writeLine(data: string): void;
    /**
     * Execute a command and wait for completion using AdaptiveWaiter
     */
    executeCommand(command: string, options?: {
        timeout?: number;
        expectedOutput?: string | RegExp;
    }): Promise<string>;
    /**
     * Clear the output buffer
     */
    clearOutput(): void;
    /**
     * Get the current output buffer
     */
    getOutput(): string;
    /**
     * Get the input history
     */
    getInputHistory(): string[];
    /**
     * Get the process information
     */
    getProcessInfo(): ProcessInfo | null;
    /**
     * Check if the agent is running
     */
    isRunning(): boolean;
    /**
     * Resize the terminal
     */
    resize(dimensions: TerminalDimensions): void;
    /**
     * Kill the terminal process
     */
    kill(signal?: string): Promise<void>;
    /**
     * Destroy the TUI agent and clean up all resources
     */
    destroy(): Promise<void>;
}
//# sourceMappingURL=TUIAgent.d.ts.map