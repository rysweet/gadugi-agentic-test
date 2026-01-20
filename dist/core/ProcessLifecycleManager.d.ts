import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
/**
 * Process tracking information
 */
export interface ProcessInfo {
    pid: number;
    command: string;
    args: string[];
    startTime: Date;
    pgid?: number;
    status: 'running' | 'terminated' | 'killed' | 'exited';
    exitCode?: number;
}
/**
 * Process lifecycle events
 */
export interface ProcessEvents {
    processStarted: (processInfo: ProcessInfo) => void;
    processExited: (processInfo: ProcessInfo, code: number | null, signal: string | null) => void;
    processKilled: (processInfo: ProcessInfo) => void;
    cleanupComplete: (processCount: number) => void;
    error: (error: Error, processInfo?: ProcessInfo) => void;
}
/**
 * ProcessLifecycleManager
 *
 * Comprehensive process lifecycle management to prevent zombie processes
 * and ensure proper cleanup of all child processes and their process groups.
 */
export declare class ProcessLifecycleManager extends EventEmitter {
    private processes;
    private childProcesses;
    private isShuttingDown;
    private cleanupTimeout;
    private signalHandlersRegistered;
    private static globalHandlersRegistered;
    private static globalSignalHandler;
    private static globalExitHandlersRegistered;
    constructor();
    /**
     * Start a new process with lifecycle management
     */
    startProcess(command: string, args?: string[], options?: {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        shell?: boolean;
        detached?: boolean;
    }): ChildProcess;
    /**
     * Set up event handlers for a child process
     */
    private setupProcessHandlers;
    /**
     * Kill a specific process and its process group
     */
    killProcess(pid: number, signal?: NodeJS.Signals): Promise<boolean>;
    /**
     * Kill all managed processes
     */
    killAllProcesses(signal?: NodeJS.Signals): Promise<number>;
    /**
     * Get information about all managed processes
     */
    getProcesses(): ProcessInfo[];
    /**
     * Get information about running processes
     */
    getRunningProcesses(): ProcessInfo[];
    /**
     * Check if a process is still running
     */
    isProcessRunning(pid: number): boolean;
    /**
     * Wait for a process to exit
     */
    waitForProcess(pid: number, timeout?: number): Promise<ProcessInfo | null>;
    /**
     * Graceful shutdown of all processes
     */
    shutdown(timeout?: number): Promise<void>;
    /**
     * Clean up resources and remove listeners
     */
    destroy(): void;
    /**
     * Wait for all processes to exit
     */
    private waitForAllProcessesToExit;
    /**
     * Register signal handlers for cleanup
     */
    private registerSignalHandlers;
    /**
     * Register exit handlers for cleanup
     */
    private registerExitHandlers;
}
export declare const processLifecycleManager: ProcessLifecycleManager;
//# sourceMappingURL=ProcessLifecycleManager.d.ts.map