/**
 * Cross-platform PTY (Pseudo Terminal) management using node-pty
 * Provides a unified interface for creating and managing terminal processes
 */
import { EventEmitter } from 'events';
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
    resize: (size: {
        cols: number;
        rows: number;
    }) => void;
}
/**
 * Cross-platform PTY manager for terminal process management
 */
export declare class PTYManager extends EventEmitter {
    private pty;
    private config;
    private isActive;
    private dataBuffer;
    private maxBufferSize;
    constructor(config?: PTYConfig);
    /**
     * Get the default shell for the current platform
     */
    private getDefaultShell;
    /**
     * Spawn a new PTY process
     */
    spawn(): Promise<void>;
    /**
     * Write data to the PTY
     */
    write(data: string): boolean;
    /**
     * Write a line to the PTY (appends newline)
     */
    writeLine(data: string): boolean;
    /**
     * Send a control sequence (e.g., Ctrl+C)
     */
    sendControl(char: string): boolean;
    /**
     * Resize the PTY
     */
    resize(cols: number, rows: number): void;
    /**
     * Get current PTY process information
     */
    getProcess(): PTYProcess | null;
    /**
     * Get PTY dimensions
     */
    getDimensions(): {
        cols: number;
        rows: number;
    };
    /**
     * Check if PTY is active
     */
    isRunning(): boolean;
    /**
     * Get buffered output
     */
    getBuffer(lines?: number): string[];
    /**
     * Clear the data buffer
     */
    clearBuffer(): void;
    /**
     * Kill the PTY process
     */
    kill(signal?: string): void;
    /**
     * Add data to the buffer with size management
     */
    private addToBuffer;
    /**
     * Set maximum buffer size
     */
    setMaxBufferSize(size: number): void;
    /**
     * Get the shell path being used
     */
    getShell(): string;
    /**
     * Get the working directory
     */
    getCwd(): string;
    /**
     * Cleanup and dispose of resources
     */
    dispose(): void;
}
/**
 * Utility function to create a PTY manager with common configurations
 */
export declare function createPTY(config?: PTYConfig): PTYManager;
/**
 * Utility function to create a PTY with a specific shell
 */
export declare function createShellPTY(shell: string, config?: Omit<PTYConfig, 'shell'>): PTYManager;
/**
 * Platform-specific PTY creators
 */
export declare const PTYCreators: {
    /**
     * Create a bash PTY (Unix/Linux/macOS)
     */
    bash: (config?: Omit<PTYConfig, "shell">) => PTYManager;
    /**
     * Create a zsh PTY (macOS default)
     */
    zsh: (config?: Omit<PTYConfig, "shell">) => PTYManager;
    /**
     * Create a PowerShell PTY (Windows/Cross-platform)
     */
    powershell: (config?: Omit<PTYConfig, "shell">) => PTYManager;
    /**
     * Create a Command Prompt PTY (Windows)
     */
    cmd: (config?: Omit<PTYConfig, "shell">) => PTYManager;
    /**
     * Create a fish PTY
     */
    fish: (config?: Omit<PTYConfig, "shell">) => PTYManager;
};
//# sourceMappingURL=PTYManager.d.ts.map