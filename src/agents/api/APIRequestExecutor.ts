/**
 * APIRequestExecutor - HTTP request execution with retry and performance tracking
 *
 * Handles all HTTP method dispatching via Axios, retry logic with optional
 * exponential back-off, performance metrics recording, and response history.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { TestLogger } from '../../utils/logger';
import { delay } from '../../utils/async';
import { generateId } from '../../utils/ids';
import { APIAgentConfig, APIRequest, APIResponse, RequestPerformance, HTTPMethod, RequestInterceptor, ResponseInterceptor } from './types';

export class APIRequestExecutor {
  private config: Required<APIAgentConfig>;
  private logger: TestLogger;
  axiosInstance: AxiosInstance;
  private requestHistory: APIRequest[] = [];
  private responseHistory: APIResponse[] = [];
  private performanceMetrics: RequestPerformance[] = [];

  constructor(config: Required<APIAgentConfig>, logger: TestLogger) {
    this.config = config;
    this.logger = logger;
    this.axiosInstance = this.createAxiosInstance();
  }

  /**
   * Register Axios request/response interceptors from config
   */
  setupInterceptors(
    requestInterceptors: RequestInterceptor[],
    responseInterceptors: ResponseInterceptor[]
  ): void {
    for (const interceptor of requestInterceptors) {
      if (interceptor.enabled) {
        this.axiosInstance.interceptors.request.use(interceptor.handler);
      }
    }
    for (const interceptor of responseInterceptors) {
      if (interceptor.enabled) {
        this.axiosInstance.interceptors.response.use(
          interceptor.handler,
          interceptor.errorHandler
        );
      }
    }
  }

  /**
   * Test connectivity by issuing a HEAD request to /
   * Failures are non-fatal (logged as warnings).
   */
  async testConnectivity(): Promise<void> {
    try {
      await this.axiosInstance.head('/');
    } catch (error: unknown) {
      this.logger.warn('Connectivity test failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Execute an HTTP request with retry logic
   */
  async makeRequest(
    method: HTTPMethod,
    url: string,
    data?: any,
    headers?: Record<string, string>,
    options?: Partial<AxiosRequestConfig>
  ): Promise<APIResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request: APIRequest = {
      id: requestId,
      method,
      url,
      headers,
      data,
      timestamp: new Date(),
      timeout: options?.timeout
    };
    this.requestHistory.push(request);

    if (this.config.logConfig.logRequests) {
      this.logger.info(`Making ${method} request`, {
        requestId,
        url,
        headers: this.config.logConfig.logHeaders
          ? this.maskSensitiveHeaders(headers || {})
          : undefined
      });
    }

    let attempt = 0;
    const maxAttempts = this.config.retry.maxRetries + 1;

    while (attempt < maxAttempts) {
      try {
        const axiosConfig: AxiosRequestConfig = {
          method: method.toLowerCase() as any,
          url,
          data,
          headers,
          ...options
        };

        const response = await this.axiosInstance.request(axiosConfig);
        const duration = Date.now() - startTime;

        const apiResponse: APIResponse = {
          requestId,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers as Record<string, string>,
          data: response.data,
          duration,
          timestamp: new Date(),
          size: this.calculateResponseSize(response.data)
        };

        this.responseHistory.push(apiResponse);

        if (this.config.performance.enabled) {
          this.recordPerformanceMetrics(requestId, response, duration);
        }

        if (this.config.logConfig.logResponses) {
          this.logger.info(`Request completed successfully`, {
            requestId,
            status: response.status,
            duration,
            size: apiResponse.size
          });
        }

        return apiResponse;
      } catch (error: unknown) {
        attempt++;
        const axiosError = error as import('axios').AxiosError;
        if (attempt >= maxAttempts || !this.shouldRetry(error)) {
          const duration = Date.now() - startTime;
          const errorResponse: APIResponse = {
            requestId,
            status: axiosError.response?.status || 0,
            statusText: axiosError.response?.statusText || 'Request Failed',
            headers: (axiosError.response?.headers as Record<string, string>) || {},
            data: axiosError.response?.data || (error instanceof Error ? error.message : String(error)),
            duration,
            timestamp: new Date()
          };
          this.responseHistory.push(errorResponse);
          this.logger.error(`Request failed after ${attempt} attempts`, {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            status: axiosError.response?.status
          });
          throw error;
        }

        const retryDelay = this.calculateRetryDelay(attempt);
        this.logger.warn(`Request attempt ${attempt} failed, retrying in ${retryDelay}ms`, {
          requestId,
          error: error instanceof Error ? error.message : String(error),
          attempt,
          maxAttempts
        });
        await delay(retryDelay);
      }
    }

    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Set a default header on the Axios instance
   */
  setDefaultHeader(name: string, value: string): void {
    this.axiosInstance.defaults.headers.common[name] = value;
  }

  /**
   * Get the most recent response or undefined if none
   */
  getLatestResponse(): APIResponse | undefined {
    return this.responseHistory[this.responseHistory.length - 1];
  }

  /**
   * Get the most recent performance metrics or undefined if none
   */
  getLatestPerformanceMetrics(): RequestPerformance | undefined {
    return this.performanceMetrics[this.performanceMetrics.length - 1];
  }

  /**
   * Snapshots of history arrays
   */
  getRequestHistory(): APIRequest[] {
    return [...this.requestHistory];
  }

  getResponseHistory(): APIResponse[] {
    return [...this.responseHistory];
  }

  getPerformanceMetrics(): RequestPerformance[] {
    return [...this.performanceMetrics];
  }

  /**
   * Clear all history (called during cleanup)
   */
  reset(): void {
    this.requestHistory = [];
    this.responseHistory = [];
    this.performanceMetrics = [];
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private createAxiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.config.defaultHeaders,
      httpsAgent: this.config.ssl
        ? {
            rejectUnauthorized: this.config.ssl.rejectUnauthorized,
            ca: this.config.ssl.ca,
            cert: this.config.ssl.cert,
            key: this.config.ssl.key
          }
        : undefined
    });
  }

  private shouldRetry(error: any): boolean {
    if (!error.response) return false;
    return this.config.retry.retryOnStatus.includes(error.response.status);
  }

  private calculateRetryDelay(attempt: number): number {
    if (!this.config.retry.exponentialBackoff) {
      return this.config.retry.retryDelay;
    }
    const d = this.config.retry.retryDelay * Math.pow(2, attempt - 1);
    return Math.min(d, this.config.retry.maxBackoffDelay || 10000);
  }

  private recordPerformanceMetrics(
    requestId: string,
    response: AxiosResponse,
    totalTime: number
  ): void {
    const metrics: RequestPerformance = {
      requestId,
      totalTime,
      responseSize: this.calculateResponseSize(response.data),
      timestamp: new Date()
    };
    this.performanceMetrics.push(metrics);

    const thresholds = this.config.performance.thresholds;
    if (thresholds?.maxResponseTime && totalTime > thresholds.maxResponseTime) {
      this.logger.warn(`Response time exceeded threshold`, {
        requestId,
        actualTime: totalTime,
        threshold: thresholds.maxResponseTime
      });
    }
  }

  private calculateResponseSize(data: any): number {
    if (typeof data === 'string') return Buffer.byteLength(data, 'utf8');
    if (data instanceof Buffer) return data.length;
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  private maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    if (!this.config.logConfig.maskSensitiveData) return headers;
    const masked = { ...headers };
    for (const sensitive of this.config.logConfig.sensitiveHeaders) {
      const key = Object.keys(masked).find(k => k.toLowerCase() === sensitive.toLowerCase());
      if (key) masked[key] = '[MASKED]';
    }
    return masked;
  }

  private generateRequestId(): string {
    return generateId();
  }
}
