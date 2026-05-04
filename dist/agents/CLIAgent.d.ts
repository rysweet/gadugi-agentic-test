/**
 * CLIAgent - Thin facade over focused CLI sub-modules
 *
 * Delegates command execution to CLICommandRunner and output parsing to
 * CLIOutputParser. Preserves the full public API of the original implementation.
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 * Uses shared validateDirectory() (issue #118) instead of a private copy.
 */
import { AgentType } from './index';
import { OrchestratorScenario, TestStep, StepResult, CommandResult } from '../models/TestModels';
import { CLIAgentConfig, CLIProcessInfo, ExecutionContext, StreamData } from './cli/types';
import { BaseAgent, ExecutionContext as AgentExecutionContext } from './BaseAgent';
export type { CLIAgentConfig, CLIProcessInfo, ExecutionContext, StreamData };
export declare class CLIAgent extends BaseAgent {
    readonly name = "CLIAgent";
    readonly type = AgentType.CLI;
    private config;
    private runner;
    private parser;
    constructor(config?: CLIAgentConfig);
    initialize(): Promise<void>;
    protected applyEnvironment(scenario: OrchestratorScenario): void;
    protected buildResult(ctx: AgentExecutionContext): unknown;
    protected onAfterExecute(): Promise<void>;
    executeCommand(command: string, args?: string[], options?: Partial<ExecutionContext>): Promise<CommandResult>;
    executeStep(step: TestStep, stepIndex: number, scenario?: OrchestratorScenario): Promise<StepResult>;
    validateOutput(output: string, expected: unknown): Promise<boolean>;
    waitForOutput(pattern: string, timeout?: number): Promise<string>;
    captureOutput(): {
        stdout: string;
        stderr: string;
        combined: string;
    };
    kill(processId?: string): Promise<void>;
    cleanup(): Promise<void>;
    private getAllOutput;
    private handleExecuteAction;
    private withScenarioWorkingDirectory;
    private resolveScenarioWorkingDirectory;
    private isCommandCapableScenarioAgent;
    private getAgentLabel;
    private fileExists;
    private directoryExists;
}
export declare function createCLIAgent(config?: CLIAgentConfig): CLIAgent;
//# sourceMappingURL=CLIAgent.d.ts.map