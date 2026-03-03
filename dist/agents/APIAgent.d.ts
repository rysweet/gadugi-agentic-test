/**
 * APIAgent - Thin facade over focused API sub-modules
 *
 * Delegates HTTP execution to APIRequestExecutor, authentication to
 * APIAuthHandler, and validation to APIResponseValidator. Preserves the full
 * public API of the original 937-LOC implementation.
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 */
import { AxiosRequestConfig } from 'axios';
import { AgentType } from './index';
import { TestStep, StepResult, OrchestratorScenario } from '../models/TestModels';
import { BaseAgent, ExecutionContext } from './BaseAgent';
import { APIAgentConfig, HTTPMethod, AuthConfig, RequestInterceptor, ResponseInterceptor, SchemaValidation, PerformanceMeasurement, RetryConfig, APIRequest, APIResponse, RequestPerformance } from './api/types';
export type { APIAgentConfig, HTTPMethod, AuthConfig, RequestInterceptor, ResponseInterceptor, SchemaValidation, PerformanceMeasurement, RetryConfig, APIRequest, APIResponse, RequestPerformance };
export declare class APIAgent extends BaseAgent {
    readonly name = "APIAgent";
    readonly type = AgentType.API;
    private config;
    private executor;
    private authHandler;
    private validator;
    constructor(config?: APIAgentConfig);
    initialize(): Promise<void>;
    protected applyEnvironment(scenario: OrchestratorScenario): void;
    protected buildResult(ctx: ExecutionContext): unknown;
    makeRequest(method: HTTPMethod, url: string, data?: unknown, headers?: Record<string, string>, options?: Partial<AxiosRequestConfig>): Promise<APIResponse>;
    executeStep(step: TestStep, stepIndex: number): Promise<StepResult>;
    setAuthentication(type: string, value?: string): void;
    setDefaultHeader(name: string, value: string): void;
    getLatestResponse(): APIResponse | undefined;
    getLatestPerformanceMetrics(): RequestPerformance | undefined;
    cleanup(): Promise<void>;
    private applyEnvironmentConfig;
}
export declare function createAPIAgent(config?: APIAgentConfig): APIAgent;
//# sourceMappingURL=APIAgent.d.ts.map