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
import { TestStep, TestStatus, StepResult, OrchestratorScenario } from '../models/TestModels';
import { createLogger } from '../utils/logger';
import { delay } from '../utils/async';
import { BaseAgent, ExecutionContext } from './BaseAgent';
import {
  APIAgentConfig, HTTPMethod, AuthConfig, RequestInterceptor, ResponseInterceptor,
  SchemaValidation, PerformanceMeasurement, RetryConfig, APIRequest, APIResponse,
  RequestPerformance, DEFAULT_API_CONFIG
} from './api/types';
import { APIRequestExecutor } from './api/APIRequestExecutor';
import { APIAuthHandler } from './api/APIAuthHandler';
import { APIResponseValidator } from './api/APIResponseValidator';

export type {
  APIAgentConfig, HTTPMethod, AuthConfig, RequestInterceptor, ResponseInterceptor,
  SchemaValidation, PerformanceMeasurement, RetryConfig, APIRequest, APIResponse, RequestPerformance
};

export class APIAgent extends BaseAgent {
  public readonly name = 'APIAgent';
  public readonly type = AgentType.API;

  private config: Required<APIAgentConfig>;
  private executor: APIRequestExecutor;
  private authHandler: APIAuthHandler;
  private validator: APIResponseValidator;

  constructor(config: APIAgentConfig = {}) {
    super();
    this.config = { ...DEFAULT_API_CONFIG, ...config };
    const logger = createLogger({ level: this.config.logConfig.logLevel, logDir: './logs/api-agent' });
    this.executor = new APIRequestExecutor(this.config, logger);
    this.authHandler = new APIAuthHandler(this.executor.axiosInstance, logger);
    this.validator = new APIResponseValidator(this.config.validation);
    this.on('error', (_e) => { /* surfaced via execute/makeRequest return values */ });
  }

  async initialize(): Promise<void> {
    try {
      if (this.config.baseURL) await this.executor.testConnectivity();
      this.executor.setupInterceptors(this.config.requestInterceptors, this.config.responseInterceptors);
      this.authHandler.applyAuth(this.config.auth);
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error: unknown) {
      throw new Error(`Failed to initialize APIAgent: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // -- BaseAgent template-method hooks --

  protected applyEnvironment(scenario: OrchestratorScenario): void {
    if (scenario.environment) {
      this.applyEnvironmentConfig(scenario.environment);
    }
  }

  protected buildResult(ctx: ExecutionContext): unknown {
    return {
      ...ctx,
      logs: ['No scenario-specific logs available'],
      requestHistory: this.executor.getRequestHistory(),
      responseHistory: this.executor.getResponseHistory(),
      performanceMetrics: this.executor.getPerformanceMetrics(),
    };
  }

  // -- Public API-specific API --

  async makeRequest(method: HTTPMethod, url: string, data?: unknown, headers?: Record<string, string>, options?: Partial<AxiosRequestConfig>): Promise<APIResponse> {
    return this.executor.makeRequest(method, url, data, headers, options);
  }

  async executeStep(step: TestStep, stepIndex: number): Promise<StepResult> {
    const startTime = Date.now();
    try {
      let result: unknown;
      const action = step.action.toLowerCase();
      const getPayload = () => this.validator.parseRequestData(step.value);
      const getHeaders = () => this.validator.parseHeaders(step.value);
      const timeout = step.timeout;
      if (action === 'get') {
        result = await this.executor.makeRequest('GET', step.target, undefined, getHeaders(), { timeout });
      } else if (action === 'post') {
        const { data, headers } = getPayload();
        result = await this.executor.makeRequest('POST', step.target, data, headers, { timeout });
      } else if (action === 'put') {
        const { data, headers } = getPayload();
        result = await this.executor.makeRequest('PUT', step.target, data, headers, { timeout });
      } else if (action === 'delete') {
        result = await this.executor.makeRequest('DELETE', step.target, undefined, getHeaders(), { timeout });
      } else if (action === 'patch') {
        const { data, headers } = getPayload();
        result = await this.executor.makeRequest('PATCH', step.target, data, headers, { timeout });
      } else if (action === 'head') {
        result = await this.executor.makeRequest('HEAD', step.target, undefined, getHeaders(), { timeout });
      } else if (action === 'options') {
        result = await this.executor.makeRequest('OPTIONS', step.target, undefined, getHeaders(), { timeout });
      } else if (action === 'validate_response') {
        result = this.validator.validateResponse(this.executor.getLatestResponse(), step.expected || step.value || '');
      } else if (action === 'validate_status') {
        result = this.validator.validateStatus(this.executor.getLatestResponse(), parseInt(step.expected || step.value || '200'));
      } else if (action === 'validate_headers') {
        result = this.validator.validateHeaders(this.executor.getLatestResponse(), step.expected || step.value || '');
      } else if (action === 'validate_schema') {
        result = this.validator.validateResponseSchema(step.expected || step.value || '');
      } else if (action === 'set_header') {
        this.setDefaultHeader(step.target, step.value || ''); result = true;
      } else if (action === 'set_auth') {
        this.setAuthentication(step.target, step.value); result = true;
      } else if (action === 'wait') {
        await delay(parseInt(step.value || '1000')); result = true;
      } else if (action === 'clear_cookies') {
        result = true;
      } else {
        throw new Error(`Unsupported API action: ${step.action}`);
      }
      return { stepIndex, status: TestStatus.PASSED, duration: Date.now() - startTime,
        actualResult: typeof result === 'string' ? result : JSON.stringify(result) };
    } catch (error: unknown) {
      return { stepIndex, status: TestStatus.FAILED, duration: Date.now() - startTime, error: error instanceof Error ? error.message : String(error) };
    }
  }

  setAuthentication(type: string, value?: string): void {
    this.config.auth = this.authHandler.setAuthentication(type, value);
  }

  setDefaultHeader(name: string, value: string): void {
    this.config.defaultHeaders[name] = value;
    this.executor.setDefaultHeader(name, value);
  }

  getLatestResponse(): APIResponse | undefined { return this.executor.getLatestResponse(); }
  getLatestPerformanceMetrics(): RequestPerformance | undefined { return this.executor.getLatestPerformanceMetrics(); }

  async cleanup(): Promise<void> {
    try { this.executor.reset(); this.emit('cleanup'); }
    catch (_e) { /* best-effort */ }
  }

  private applyEnvironmentConfig(environment: Record<string, string>): void {
    for (const [key, value] of Object.entries(environment)) {
      if (key === 'API_BASE_URL') this.executor.axiosInstance.defaults.baseURL = value;
      else if (key === 'API_TIMEOUT') this.executor.axiosInstance.defaults.timeout = parseInt(value);
      else if (key === 'API_AUTH_TOKEN') this.setAuthentication('bearer', value);
    }
  }
}

export function createAPIAgent(config?: APIAgentConfig): APIAgent {
  return new APIAgent(config);
}
