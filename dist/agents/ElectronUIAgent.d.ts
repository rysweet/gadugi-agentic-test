/**
 * ElectronUIAgent - Comprehensive Electron UI testing agent using Playwright
 *
 * This agent provides complete automation capabilities for Electron applications
 * including Playwright's Electron support, WebSocket monitoring, performance tracking,
 * and comprehensive error handling with automatic recovery.
 */
import { Locator } from 'playwright';
import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { OrchestratorStep, StepResult } from '../models/TestModels';
import { AppState } from '../models/AppState';
import { ScreenshotMetadata } from '../utils/screenshot';
/**
 * Configuration options for the ElectronUIAgent
 */
export interface ElectronUIAgentConfig {
    /** Path to the Electron application executable */
    executablePath: string;
    /** Command line arguments for the Electron app */
    args?: string[];
    /** Working directory for the app */
    cwd?: string;
    /** Environment variables */
    env?: Record<string, string>;
    /** Launch timeout in milliseconds */
    launchTimeout?: number;
    /** Default timeout for operations */
    defaultTimeout?: number;
    /** Whether to run in headless mode */
    headless?: boolean;
    /** Recording options */
    recordVideo?: boolean;
    /** Video directory */
    videoDir?: string;
    /** Slow motion delay in milliseconds */
    slowMo?: number;
    /** Screenshot configuration */
    screenshotConfig?: {
        mode: 'off' | 'on' | 'only-on-failure';
        directory: string;
        fullPage: boolean;
    };
    /** Socket.IO monitoring configuration */
    websocketConfig?: {
        url: string;
        events: string[];
        reconnectAttempts: number;
        reconnectDelay: number;
    };
    /** Performance monitoring */
    performanceConfig?: {
        enabled: boolean;
        sampleInterval: number;
        collectLogs: boolean;
    };
    /** Recovery options */
    recoveryConfig?: {
        maxRetries: number;
        retryDelay: number;
        restartOnFailure: boolean;
    };
}
/**
 * WebSocket event data
 */
export interface WebSocketEvent {
    type: string;
    timestamp: Date;
    data: any;
    source?: string;
}
/**
 * Performance sample data
 */
export interface PerformanceSample {
    timestamp: Date;
    cpuUsage?: number;
    memoryUsage?: number;
    responseTime?: number;
    frameRate?: number;
    customMetrics?: Record<string, number>;
}
/**
 * Comprehensive Electron UI testing agent
 */
export declare class ElectronUIAgent extends EventEmitter implements IAgent {
    readonly name = "ElectronUIAgent";
    readonly type = AgentType.UI;
    private config;
    private app;
    private page;
    private context;
    private logger;
    private screenshotManager;
    private websocket;
    private websocketEvents;
    private performanceSamples;
    private performanceInterval;
    private isInitialized;
    private currentScenarioId?;
    private stateSnapshots;
    private consoleMessages;
    constructor(config: ElectronUIAgentConfig);
    /**
     * Initialize the agent
     */
    initialize(): Promise<void>;
    /**
     * Execute a test scenario
     */
    execute(scenario: any): Promise<any>;
    /**
     * Launch the Electron application
     */
    launch(): Promise<void>;
    /**
     * Close the Electron application
     */
    close(): Promise<void>;
    /**
     * Navigate to a specific tab
     */
    clickTab(tabName: string): Promise<void>;
    /**
     * Fill an input field
     */
    fillInput(selector: string, value: string): Promise<void>;
    /**
     * Click a button or element
     */
    clickButton(selector: string): Promise<void>;
    /**
     * Wait for an element to appear
     */
    waitForElement(selector: string, options?: {
        state?: 'attached' | 'detached' | 'visible' | 'hidden';
        timeout?: number;
    }): Promise<Locator>;
    /**
     * Get text content of an element
     */
    getElementText(selector: string): Promise<string>;
    /**
     * Take a screenshot
     */
    screenshot(name: string): Promise<ScreenshotMetadata>;
    /**
     * Execute a single test step
     */
    executeStep(step: OrchestratorStep, stepIndex: number): Promise<StepResult>;
    /**
     * Capture the current application state
     */
    captureState(): Promise<AppState>;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    private setupEventListeners;
    private setupPageEventListeners;
    private connectWebSocket;
    private startPerformanceMonitoring;
    private stopPerformanceMonitoring;
    private collectPerformanceSample;
    private getProcessInfo;
    private getLatestPerformanceMetrics;
    private getNetworkState;
    private captureFailureScreenshot;
    private captureCurrentState;
    private getScenarioScreenshots;
    private getScenarioLogs;
    private getLastScreenshotPath;
    private validateExecutablePath;
    private sanitizeConfig;
    private exportFinalData;
}
/**
 * Factory function to create ElectronUIAgent instance
 */
export declare function createElectronUIAgent(config: ElectronUIAgentConfig): ElectronUIAgent;
//# sourceMappingURL=ElectronUIAgent.d.ts.map