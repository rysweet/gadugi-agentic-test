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
export interface ProcessStartOptions {
    cwd?: string;
    workingDirectory?: string;
    env?: NodeJS.ProcessEnv;
    shell?: boolean;
    detached?: boolean;
}
/**
 * ProcessLifecycleManager
 *
 * Comprehensive process lifecycle management to prevent zombie processes
 * and ensure proper cleanup of all child processes and their process groups.
 *
 * NOTE: This class does NOT register uncaughtException or unhandledRejection
 * handlers. Those are global error handlers that must only be registered by
 * application entry points (e.g. cli.ts), not by library modules. Registering
 * them here would interfere with Jest and any library consumer.
 *
 * SIGTERM and SIGINT are also not registered here; they are registered by
 * cli.ts for the application use-case. The process 'exit' handler for
 * synchronous child-process cleanup IS registered here because it is
 * side-effect-free (synchronous, no process.exit call).
 */
export declare class ProcessLifecycleManager extends EventEmitter {
    private processes;
    private childProcesses;
    private isShuttingDown;
    private cleanupTimeout;
    private static globalExitHandlerRegistered;
    constructor();
    /**
     * Start a new process with lifecycle management
     */
    startProcess(command: string, args?: string[], options?: ProcessStartOptions): ChildProcess;
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
     * Register a synchronous 'exit' handler to kill remaining child processes
     * when the Node.js process exits. This is safe for library use: it does not
     * call process.exit() and does not interfere with error handling.
     *
     * SIGTERM, SIGINT, uncaughtException, and unhandledRejection are intentionally
     * NOT registered here. Those handlers belong in the CLI entry point (cli.ts).
     */
    private registerExitHandler;
}
export declare function getProcessLifecycleManager(): ProcessLifecycleManager;
/**
 * Backward-compatible singleton export.
 * The value is a Proxy so the singleton is created lazily on first property access.
 *
 * Historical consumers that wrote `processLifecycleManager.startProcess(...)` continue
 * to work because the Proxy forwards to `getProcessLifecycleManager()`.
 */
export declare const processLifecycleManager: ProcessLifecycleManager;
//# sourceMappingURL=ProcessLifecycleManager.d.ts.map