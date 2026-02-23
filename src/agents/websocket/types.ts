/**
 * WebSocket sub-module: Types
 *
 * All TypeScript interfaces, types, and enums for the WebSocket agent.
 */

import { LogLevel } from '../../utils/logger';

/**
 * WebSocket connection states
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  id: string;
  event: string;
  data: unknown;
  timestamp: Date;
  direction: 'sent' | 'received';
  ack?: boolean;
  namespace?: string;
}

/**
 * Connection performance metrics
 */
export interface ConnectionMetrics {
  connectionId: string;
  connectTime: number;
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;
  reconnectCount: number;
  lastLatency?: number;
  averageLatency?: number;
  uptime: number;
  timestamp: Date;
}

/**
 * Latency measurement
 */
export interface LatencyMeasurement {
  messageId: string;
  event: string;
  latency: number;
  timestamp: Date;
}

/**
 * Event listener configuration
 */
export interface EventListener {
  event: string;
  handler: (data: unknown) => void | Promise<void>;
  once?: boolean;
  enabled: boolean;
}

/**
 * Reconnection configuration
 */
export interface ReconnectionConfig {
  enabled: boolean;
  maxAttempts: number;
  delay: number;
  exponentialBackoff: boolean;
  maxBackoffDelay: number;
  randomizationFactor: number;
}

/**
 * Authentication configuration for WebSocket
 */
export interface WebSocketAuth {
  type: 'token' | 'query' | 'header' | 'custom';
  token?: string;
  queryParam?: string;
  headerName?: string;
  customAuth?: Record<string, any>;
}

/**
 * Configuration options for the WebSocketAgent
 */
export interface WebSocketAgentConfig {
  /** Server URL (ws:// or wss://) */
  serverURL?: string;
  /** Namespace to connect to */
  namespace?: string;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Socket.IO options */
  socketOptions?: {
    transports?: ('websocket' | 'polling')[];
    upgrade?: boolean;
    rememberUpgrade?: boolean;
    timeout?: number;
    forceNew?: boolean;
    multiplex?: boolean;
  };
  /** Authentication configuration */
  auth?: WebSocketAuth;
  /** Reconnection configuration */
  reconnection?: ReconnectionConfig;
  /** Event listeners */
  eventListeners?: EventListener[];
  /** Performance measurement configuration */
  performance?: {
    enabled: boolean;
    measureLatency: boolean;
    pingInterval?: number;
    maxLatencyHistory: number;
  };
  /** Message validation */
  messageValidation?: {
    enabled: boolean;
    schemas?: Record<string, any>;
    strictMode?: boolean;
  };
  /** Logging configuration */
  logConfig?: {
    logConnections: boolean;
    logMessages: boolean;
    logEvents: boolean;
    logLevel: LogLevel;
    maskSensitiveData: boolean;
    sensitiveEvents: string[];
  };
}

/**
 * Connection information
 */
export interface ConnectionInfo {
  id: string;
  url: string;
  namespace?: string;
  state: ConnectionState;
  connectTime?: Date;
  disconnectTime?: Date;
  error?: string;
  reconnectCount: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<WebSocketAgentConfig> = {
  serverURL: '',
  namespace: '/',
  connectionTimeout: 10000,
  socketOptions: {
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    timeout: 20000,
    forceNew: false,
    multiplex: true
  },
  auth: { type: 'token' },
  reconnection: {
    enabled: true,
    maxAttempts: 5,
    delay: 1000,
    exponentialBackoff: true,
    maxBackoffDelay: 10000,
    randomizationFactor: 0.5
  },
  eventListeners: [],
  performance: {
    enabled: true,
    measureLatency: true,
    pingInterval: 5000,
    maxLatencyHistory: 100
  },
  messageValidation: {
    enabled: false,
    schemas: {},
    strictMode: false
  },
  logConfig: {
    logConnections: true,
    logMessages: true,
    logEvents: true,
    logLevel: LogLevel.DEBUG,
    maskSensitiveData: true,
    sensitiveEvents: ['auth', 'login', 'authentication']
  }
};
