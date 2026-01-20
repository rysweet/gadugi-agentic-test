/**
 * APIAgent - Comprehensive REST API testing agent using Axios
 *
 * This agent provides complete automation capabilities for REST API testing
 * including support for all HTTP methods, authentication, request/response
 * validation, performance measurement, retries, and comprehensive error handling.
 */
import { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { TestStep, StepResult, TestScenario } from '../models/TestModels';
import { LogLevel } from '../utils/logger';
/**
 * HTTP methods supported by the API agent
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
/**
 * Authentication configuration types
 */
export interface AuthConfig {
    type: 'bearer' | 'apikey' | 'basic' | 'custom';
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    username?: string;
    password?: string;
    customHeaders?: Record<string, string>;
}
/**
 * Request interceptor configuration
 */
export interface RequestInterceptor {
    name: string;
    handler: (config: any) => any | Promise<any>;
    enabled: boolean;
}
/**
 * Response interceptor configuration
 */
export interface ResponseInterceptor {
    name: string;
    handler: (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>;
    errorHandler?: (error: AxiosError) => Promise<AxiosError>;
    enabled: boolean;
}
/**
 * Schema validation configuration
 */
export interface SchemaValidation {
    enabled: boolean;
    requestSchema?: any;
    responseSchema?: any;
    strictMode?: boolean;
}
/**
 * Performance measurement configuration
 */
export interface PerformanceMeasurement {
    enabled: boolean;
    measureDNS?: boolean;
    measureTCP?: boolean;
    measureTLS?: boolean;
    measureTransfer?: boolean;
    thresholds?: {
        maxResponseTime?: number;
        maxDNSTime?: number;
        maxConnectTime?: number;
    };
}
/**
 * Retry configuration
 */
export interface RetryConfig {
    maxRetries: number;
    retryDelay: number;
    retryOnStatus: number[];
    exponentialBackoff: boolean;
    maxBackoffDelay?: number;
}
/**
 * Configuration options for the APIAgent
 */
export interface APIAgentConfig {
    /** Base URL for API requests */
    baseURL?: string;
    /** Default timeout for requests in milliseconds */
    timeout?: number;
    /** Default headers to include with all requests */
    defaultHeaders?: Record<string, string>;
    /** Authentication configuration */
    auth?: AuthConfig;
    /** Request interceptors */
    requestInterceptors?: RequestInterceptor[];
    /** Response interceptors */
    responseInterceptors?: ResponseInterceptor[];
    /** Schema validation configuration */
    validation?: SchemaValidation;
    /** Performance measurement configuration */
    performance?: PerformanceMeasurement;
    /** Retry configuration */
    retry?: RetryConfig;
    /** SSL/TLS options */
    ssl?: {
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        key?: string;
    };
    /** Logging configuration */
    logConfig?: {
        logRequests: boolean;
        logResponses: boolean;
        logHeaders: boolean;
        logLevel: LogLevel;
        maskSensitiveData: boolean;
        sensitiveHeaders: string[];
    };
}
/**
 * API request information
 */
export interface APIRequest {
    id: string;
    method: HTTPMethod;
    url: string;
    headers?: Record<string, string>;
    data?: any;
    timestamp: Date;
    timeout?: number;
}
/**
 * API response information
 */
export interface APIResponse {
    requestId: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
    duration: number;
    timestamp: Date;
    size?: number;
}
/**
 * Performance metrics for a request
 */
export interface RequestPerformance {
    requestId: string;
    totalTime: number;
    dnsTime?: number;
    tcpTime?: number;
    tlsTime?: number;
    transferTime?: number;
    responseSize: number;
    requestSize?: number;
    timestamp: Date;
}
/**
 * Comprehensive API testing agent
 */
export declare class APIAgent extends EventEmitter implements IAgent {
    readonly name = "APIAgent";
    readonly type = AgentType.API;
    private config;
    private logger;
    private isInitialized;
    private currentScenarioId?;
    private axiosInstance;
    private requestHistory;
    private responseHistory;
    private performanceMetrics;
    constructor(config?: APIAgentConfig);
    /**
     * Initialize the agent
     */
    initialize(): Promise<void>;
    /**
     * Execute a test scenario
     */
    execute(scenario: TestScenario): Promise<any>;
    /**
     * Make an HTTP request with full configuration
     */
    makeRequest(method: HTTPMethod, url: string, data?: any, headers?: Record<string, string>, options?: Partial<AxiosRequestConfig>): Promise<APIResponse>;
    /**
     * Execute a test step
     */
    executeStep(step: TestStep, stepIndex: number): Promise<StepResult>;
    /**
     * Set authentication configuration
     */
    setAuthentication(type: string, value?: string): void;
    /**
     * Set default header
     */
    setDefaultHeader(name: string, value: string): void;
    /**
     * Get the latest response
     */
    getLatestResponse(): APIResponse | undefined;
    /**
     * Get performance metrics for the latest request
     */
    getLatestPerformanceMetrics(): RequestPerformance | undefined;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    private createAxiosInstance;
    private setupInterceptors;
    private testConnectivity;
    private handleGetRequest;
    private handlePostRequest;
    private handlePutRequest;
    private handleDeleteRequest;
    private handlePatchRequest;
    private handleHeadRequest;
    private handleOptionsRequest;
    private validateResponse;
    private validateStatus;
    private validateHeaders;
    private validateResponseSchema;
    private parseHeaders;
    private parseRequestData;
    private shouldRetry;
    private calculateRetryDelay;
    private recordPerformanceMetrics;
    private calculateResponseSize;
    private maskSensitiveHeaders;
    private generateRequestId;
    private applyEnvironmentConfig;
    private getScenarioLogs;
    private setupEventListeners;
    private deepEqual;
    private delay;
}
/**
 * Factory function to create APIAgent instance
 */
export declare function createAPIAgent(config?: APIAgentConfig): APIAgent;
//# sourceMappingURL=APIAgent.d.ts.map