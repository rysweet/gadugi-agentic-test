/**
 * TUIAgent - Terminal User Interface testing agent
 *
 * This agent provides comprehensive TUI testing capabilities including:
 * - Terminal spawn and cleanup
 * - Input simulation with timing control
 * - Output parsing and color/formatting verification
 * - Cross-platform terminal behavior testing
 * - Interactive menu navigation
 * - Error handling and recovery
 * - Performance benchmarks
 */
import { ChildProcess, SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { TestStep, StepResult } from '../models/TestModels';
import { LogLevel } from '../utils/logger';
/**
 * TUI Agent configuration options
 */
export interface TUIAgentConfig {
    /** Terminal type (xterm, ansi, etc.) */
    terminalType?: string;
    /** Terminal size */
    terminalSize?: {
        cols: number;
        rows: number;
    };
    /** Working directory for TUI applications */
    workingDirectory?: string;
    /** Environment variables */
    environment?: Record<string, string>;
    /** Default timeout for operations in milliseconds */
    defaultTimeout?: number;
    /** Input timing configuration */
    inputTiming?: {
        /** Delay between keystrokes in milliseconds */
        keystrokeDelay: number;
        /** Delay after sending input before reading output */
        responseDelay: number;
        /** Maximum time to wait for output changes */
        stabilizationTimeout: number;
    };
    /** Output capture configuration */
    outputCapture?: {
        /** Whether to preserve ANSI escape codes */
        preserveColors: boolean;
        /** Buffer size for output capture */
        bufferSize: number;
        /** Whether to capture timing information */
        captureTiming: boolean;
    };
    /** Cross-platform settings */
    crossPlatform?: {
        /** Windows-specific command prefix */
        windowsPrefix?: string;
        /** Unix shell to use */
        unixShell?: string;
        /** Platform-specific key mappings */
        keyMappings?: Record<string, Record<string, string>>;
    };
    /** Performance monitoring */
    performance?: {
        /** Enable performance monitoring */
        enabled: boolean;
        /** Sample rate for metrics collection */
        sampleRate: number;
        /** Memory usage threshold in MB */
        memoryThreshold: number;
        /** CPU usage threshold in percentage */
        cpuThreshold: number;
    };
    /** Logging configuration */
    logConfig?: {
        logInputs: boolean;
        logOutputs: boolean;
        logColors: boolean;
        logLevel: LogLevel;
    };
}
/**
 * Terminal session information
 */
export interface TerminalSession {
    /** Session ID */
    id: string;
    /** Process ID */
    pid: number;
    /** Command being executed */
    command: string;
    /** Arguments */
    args: string[];
    /** Start time */
    startTime: Date;
    /** Status */
    status: 'running' | 'completed' | 'failed' | 'killed';
    /** Child process reference */
    process: ChildProcess;
    /** Terminal size */
    size: {
        cols: number;
        rows: number;
    };
    /** Output buffer */
    outputBuffer: TerminalOutput[];
    /** Performance metrics */
    metrics?: PerformanceMetrics;
}
/**
 * Terminal output with metadata
 */
export interface TerminalOutput {
    /** Output type */
    type: 'stdout' | 'stderr';
    /** Raw data with ANSI codes */
    raw: string;
    /** Cleaned text without ANSI codes */
    text: string;
    /** Extracted color information */
    colors?: ColorInfo[];
    /** Timestamp */
    timestamp: Date;
    /** Cursor position if available */
    cursor?: {
        x: number;
        y: number;
    };
}
/**
 * Color and formatting information
 */
export interface ColorInfo {
    /** Text content */
    text: string;
    /** Foreground color */
    fg?: string;
    /** Background color */
    bg?: string;
    /** Text styles (bold, italic, underline, etc.) */
    styles: string[];
    /** Position in the output */
    position: {
        start: number;
        end: number;
    };
}
/**
 * Performance metrics for TUI operations
 */
export interface PerformanceMetrics {
    /** Memory usage in MB */
    memoryUsage: number;
    /** CPU usage percentage */
    cpuUsage: number;
    /** Response time in milliseconds */
    responseTime: number;
    /** Render time in milliseconds */
    renderTime: number;
    /** Frame rate (for animated TUIs) */
    frameRate?: number;
}
/**
 * Input simulation options
 */
export interface InputSimulation {
    /** Key sequence to send */
    keys: string;
    /** Timing between keys */
    timing?: number;
    /** Whether to wait for output to stabilize */
    waitForStabilization?: boolean;
    /** Expected output pattern to wait for */
    waitForPattern?: string;
    /** Timeout for the operation */
    timeout?: number;
}
/**
 * Menu navigation context
 */
export interface MenuNavigation {
    /** Current menu level */
    level: number;
    /** Menu items detected */
    items: string[];
    /** Currently selected item */
    selectedIndex: number;
    /** Navigation history */
    history: string[];
}
/**
 * Comprehensive TUI testing agent
 */
export declare class TUIAgent extends EventEmitter implements IAgent {
    readonly name = "TUIAgent";
    readonly type = AgentType.SYSTEM;
    private config;
    private logger;
    private isInitialized;
    private currentScenarioId?;
    private sessions;
    private performanceMonitor?;
    private menuContext?;
    constructor(config?: TUIAgentConfig);
    /**
     * Initialize the TUI agent
     */
    initialize(): Promise<void>;
    /**
     * Execute a test scenario
     */
    execute(scenario: any): Promise<any>;
    /**
     * Spawn a TUI application
     */
    spawnTUI(command: string, args?: string[], options?: Partial<SpawnOptions>): Promise<string>;
    /**
     * Send input to a TUI session
     */
    sendInput(sessionId: string, input: string | InputSimulation): Promise<void>;
    /**
     * Navigate through a menu interface
     */
    navigateMenu(sessionId: string, path: string[]): Promise<MenuNavigation>;
    /**
     * Capture and parse current terminal output
     */
    captureOutput(sessionId: string): TerminalOutput | null;
    /**
     * Get all output from a session
     */
    getAllOutput(sessionId: string): TerminalOutput[];
    /**
     * Validate output against expected patterns
     */
    validateOutput(sessionId: string, expected: any): Promise<boolean>;
    /**
     * Validate colors and formatting
     */
    validateFormatting(sessionId: string, expectedColors: ColorInfo[]): Promise<boolean>;
    /**
     * Kill a specific session
     */
    killSession(sessionId: string): Promise<void>;
    /**
     * Clean up all sessions and resources
     */
    cleanup(): Promise<void>;
    /**
     * Execute a test step
     */
    executeStep(step: TestStep, stepIndex: number): Promise<StepResult>;
    private setupSessionHandlers;
    private validateWorkingDirectory;
    private setupPlatformConfig;
    private setupEventListeners;
    private generateSessionId;
    private processSpecialKeys;
    private getKeyMapping;
    private stripAnsiCodes;
    private parseColors;
    private readonly ansiColorMap;
    private parseMenuItems;
    private navigateToMenuItem;
    private waitForOutputStabilization;
    private waitForOutputPattern;
    private getLatestOutput;
    private performOutputValidation;
    private arraysEqual;
    private killAllSessions;
    private startPerformanceMonitoring;
    private collectPerformanceMetrics;
    private getPerformanceMetrics;
    private getSessionInfo;
    private getScenarioLogs;
    private setEnvironmentVariables;
    private sanitizeConfig;
    private delay;
    private handleSpawnAction;
    private handleInputAction;
    private handleMenuNavigationAction;
    private handleOutputValidationAction;
    private handleColorValidationAction;
    private handleCaptureOutputAction;
    private handleWaitForOutputAction;
    private handleResizeTerminalAction;
    private handleKillSessionAction;
    /**
     * Get the most recently created session ID when no explicit session specified
     */
    private getMostRecentSessionId;
}
export declare function createTUIAgent(config?: TUIAgentConfig): TUIAgent;
//# sourceMappingURL=TUIAgent.d.ts.map