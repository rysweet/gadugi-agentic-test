/**
 * ElectronUIAgent - Thin facade delegating to focused electron sub-modules.
 *
 * Coordinates ElectronLauncher, ElectronPageInteractor,
 * ElectronPerformanceMonitor, and ElectronWebSocketMonitor.
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 * Uses shared sanitizeConfigWithEnv() (issue #118) instead of a private copy.
 */
import { AgentType } from './index';
import { OrchestratorScenario, TestStep, TestStatus, StepResult } from '../models/TestModels';
import { AppState } from '../models/AppState';
import { ScreenshotMetadata } from '../utils/screenshot';
import { BaseAgent, ExecutionContext } from './BaseAgent';
import { ElectronUIAgentConfig } from './electron';
export type { ElectronUIAgentConfig, WebSocketEvent, PerformanceSample } from './electron';
/** Comprehensive Electron UI testing agent — facade over focused sub-modules. */
export declare class ElectronUIAgent extends BaseAgent {
    readonly name = "ElectronUIAgent";
    readonly type = AgentType.UI;
    private config;
    private launcher;
    private interactor;
    private perfMonitor;
    private wsMonitor;
    private logger;
    private currentScenarioId;
    constructor(config: ElectronUIAgentConfig);
    initialize(): Promise<void>;
    protected onBeforeExecute(scenario: OrchestratorScenario): void;
    protected buildResult(ctx: ExecutionContext): unknown;
    protected onAfterExecute(scenario: OrchestratorScenario, status: TestStatus): Promise<void>;
    launch(): Promise<void>;
    close(): Promise<void>;
    cleanup(): Promise<void>;
    screenshot(name: string): Promise<ScreenshotMetadata>;
    clickTab(tabName: string): Promise<void>;
    fillInput(selector: string, value: string): Promise<void>;
    clickButton(selector: string): Promise<void>;
    waitForElement(selector: string, options?: {
        state?: 'attached' | 'detached' | 'visible' | 'hidden';
        timeout?: number;
    }): Promise<import("playwright-core").Locator>;
    getElementText(selector: string): Promise<string>;
    captureState(): Promise<AppState>;
    executeStep(step: TestStep, stepIndex: number): Promise<StepResult>;
    private sanitizeConfig;
    private getScenarioLogs;
}
/** Factory function to create an ElectronUIAgent instance */
export declare function createElectronUIAgent(config: ElectronUIAgentConfig): ElectronUIAgent;
//# sourceMappingURL=ElectronUIAgent.d.ts.map