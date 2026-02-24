/**
 * API agent types and configuration interfaces
 */

import { LogLevel } from '../../utils/logger';

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
  handler: (config: import('axios').InternalAxiosRequestConfig) => import('axios').InternalAxiosRequestConfig | Promise<import('axios').InternalAxiosRequestConfig>;
  enabled: boolean;
}

/**
 * Response interceptor configuration
 */
export interface ResponseInterceptor {
  name: string;
  handler: (response: import('axios').AxiosResponse) => import('axios').AxiosResponse | Promise<import('axios').AxiosResponse>;
  errorHandler?: (error: import('axios').AxiosError) => Promise<import('axios').AxiosError>;
  enabled: boolean;
}

/**
 * Schema validation configuration
 */
export interface SchemaValidation {
  enabled: boolean;
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
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
  data?: unknown;
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
  data: unknown;
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
 * Default configuration
 */
export const DEFAULT_API_CONFIG: Required<APIAgentConfig> = {
  baseURL: '',
  timeout: 30000,
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  auth: { type: 'bearer' },
  requestInterceptors: [],
  responseInterceptors: [],
  validation: {
    enabled: false,
    strictMode: false
  },
  performance: {
    enabled: true,
    measureDNS: true,
    measureTCP: true,
    measureTLS: true,
    measureTransfer: true,
    thresholds: {
      maxResponseTime: 5000,
      maxDNSTime: 1000,
      maxConnectTime: 2000
    }
  },
  retry: {
    maxRetries: 2,
    retryDelay: 1000,
    retryOnStatus: [408, 429, 500, 502, 503, 504],
    exponentialBackoff: true,
    maxBackoffDelay: 10000
  },
  ssl: {
    rejectUnauthorized: true
  },
  logConfig: {
    logRequests: true,
    logResponses: true,
    logHeaders: false,
    logLevel: LogLevel.DEBUG,
    maskSensitiveData: true,
    sensitiveHeaders: ['authorization', 'x-api-key', 'cookie']
  }
};
