/**
 * TUIAgent - Thin facade composing TUI testing sub-modules
 *
 * Delegates all operations to:
 * - TUISessionManager    : session lifecycle (spawn, kill, cleanup)
 * - TUIInputSimulator    : keyboard input simulation
 * - TUIMenuNavigator     : interactive menu navigation
 * - TUIOutputParser      : ANSI parsing, color extraction, validation
 * - TUIStepDispatcher    : test step action routing
 *
 * Public API is identical to the original monolithic TUIAgent — all
 * existing imports and tests continue to work without modification.
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 * Uses shared validateDirectory() (issue #118) instead of a private copy.
 * Uses shared sanitizeConfigWithEnv() (issue #118) instead of a private copy.
 */
import { SpawnOptions } from 'child_process';
import { AgentType } from './index';
import { OrchestratorScenario, TestStep, TestStatus, StepResult } from '../models/TestModels';
import { TUIAgentConfig, TerminalOutput, ColorInfo, InputSimulation, MenuNavigation } from './tui/types';
import { BaseAgent, ExecutionContext } from './BaseAgent';
export type { TUIAgentConfig, TerminalSession, TerminalOutput, ColorInfo, PerformanceMetrics, InputSimulation, MenuNavigation, } from './tui/types';
/** Comprehensive TUI testing agent (thin facade) */
export declare class TUIAgent extends BaseAgent {
    readonly name = "TUIAgent";
    readonly type = AgentType.TUI;
    private config;
    private logger;
    private performanceMonitor;
    private performanceMetricsHistory;
    private sessionManager;
    private inputSimulator;
    private menuNavigator;
    private errorHandler;
    constructor(config?: TUIAgentConfig);
    initialize(): Promise<void>;
    protected applyEnvironment(scenario: OrchestratorScenario): void;
    protected buildResult(ctx: ExecutionContext): unknown;
    protected onAfterExecute(scenario: OrchestratorScenario, status: TestStatus): Promise<void>;
    spawnTUI(command: string, args?: string[], options?: Partial<SpawnOptions>): Promise<string>;
    sendInput(sessionId: string, input: string | InputSimulation): Promise<void>;
    navigateMenu(sessionId: string, path: string[]): Promise<MenuNavigation>;
    captureOutput(sessionId: string): TerminalOutput | null;
    getAllOutput(sessionId: string): TerminalOutput[];
    validateOutput(sessionId: string, expected: unknown): Promise<boolean>;
    validateFormatting(sessionId: string, expectedColors: ColorInfo[]): Promise<boolean>;
    killSession(sessionId: string): Promise<void>;
    cleanup(): Promise<void>;
    executeStep(step: TestStep, stepIndex: number): Promise<StepResult>;
    private setupPlatformConfig;
    private startPerformanceMonitoring;
    private collectPerformanceMetrics;
    private getPerformanceMetrics;
    private getScenarioLogs;
    private sanitizeConfig;
    private waitForOutputStabilization;
    private waitForOutputPattern;
}
/** Factory function to create a TUIAgent */
export declare function createTUIAgent(config?: TUIAgentConfig): TUIAgent;
//# sourceMappingURL=TUIAgent.d.ts.map