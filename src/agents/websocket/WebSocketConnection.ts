/**
 * WebSocket sub-module: WebSocketConnection
 *
 * Manages connection lifecycle: connect, disconnect, reconnect,
 * authentication injection, and performance monitoring initialisation.
 */

import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { TestLogger } from '../../utils/logger';
import {
  ConnectionState,
  ConnectionInfo,
  ConnectionMetrics,
  LatencyMeasurement,
  WebSocketAgentConfig
} from './types';

export class WebSocketConnection extends EventEmitter {
  private socket?: Socket;
  private connectionInfo?: ConnectionInfo;
  private connectionMetrics?: ConnectionMetrics;
  private pingInterval?: NodeJS.Timeout;
  private connectionPromise?: Promise<void>;
  private latencyHistory: LatencyMeasurement[] = [];
  private pendingMessages: Map<string, { timestamp: Date; event: string }> = new Map();

  constructor(
    private readonly config: Required<WebSocketAgentConfig>,
    private readonly logger: TestLogger
  ) {
    super();
  }

  /**
   * Connect to WebSocket server
   */
  async connect(url?: string, options?: any): Promise<void> {
    const serverURL = url || this.config.serverURL;
    if (!serverURL) {
      throw new Error('Server URL is required for connection');
    }

    if (this.socket && this.socket.connected) {
      this.logger.warn('Already connected to WebSocket server');
      return;
    }

    this.logger.info('Connecting to WebSocket server', { url: serverURL });

    this.connectionInfo = {
      id: this.generateConnectionId(),
      url: serverURL,
      namespace: this.config.namespace,
      state: ConnectionState.CONNECTING,
      reconnectCount: 0
    };

    const socketOptions = {
      ...this.config.socketOptions,
      ...options,
      timeout: this.config.connectionTimeout
    };

    if (this.config.auth.type !== 'token' || this.config.auth.token) {
      this.addAuthentication(socketOptions);
    }

    this.socket = io(serverURL, socketOptions);
    this.setupSocketEventHandlers();

    if (this.config.performance.enabled) {
      this.setupPerformanceMonitoring();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.connectionInfo!.state = ConnectionState.ERROR;
        this.connectionInfo!.error = 'Connection timeout';
        reject(new Error(`Connection timeout after ${this.config.connectionTimeout}ms`));
      }, this.config.connectionTimeout);

      this.socket!.on('connect', () => {
        clearTimeout(timeout);
        this.connectionInfo!.state = ConnectionState.CONNECTED;
        this.connectionInfo!.connectTime = new Date();
        this.logger.info('WebSocket connected successfully', {
          connectionId: this.connectionInfo!.id
        });
        resolve();
      });

      this.socket!.on('connect_error', (error: Error) => {
        clearTimeout(timeout);
        this.connectionInfo!.state = ConnectionState.ERROR;
        this.connectionInfo!.error = error.message;
        this.logger.error('WebSocket connection failed', { error: error.message });
        reject(error);
      });
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }

    this.logger.info('Disconnecting from WebSocket server');

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }

    if (this.connectionInfo) {
      this.connectionInfo.state = ConnectionState.DISCONNECTED;
      this.connectionInfo.disconnectTime = new Date();
    }

    this.socket.disconnect();
    this.socket = undefined;
    this.connectionPromise = undefined;

    this.logger.info('WebSocket disconnected');
  }

  /** Returns true if the socket is currently connected */
  isConnected(): boolean {
    return this.socket?.connected === true;
  }

  /** Access the underlying socket (read-only) */
  getSocket(): Socket | undefined {
    return this.socket;
  }

  /** Current connection info snapshot */
  getConnectionInfo(): ConnectionInfo | undefined {
    return this.connectionInfo;
  }

  /** Current connection state */
  getConnectionState(): ConnectionState {
    return this.connectionInfo?.state ?? ConnectionState.DISCONNECTED;
  }

  /** Current metrics snapshot */
  getConnectionMetrics(): ConnectionMetrics | undefined {
    return this.connectionMetrics;
  }

  /** Pending message map (for latency tracking) */
  getPendingMessages(): Map<string, { timestamp: Date; event: string }> {
    return this.pendingMessages;
  }

  /** Latency history array */
  getLatencyHistory(): LatencyMeasurement[] {
    return this.latencyHistory;
  }

  /** Update latency metric on the connection metrics object */
  updateLatencyMetrics(latency: number, averageLatency: number): void {
    if (this.connectionMetrics) {
      this.connectionMetrics.lastLatency = latency;
      this.connectionMetrics.averageLatency = averageLatency;
    }
  }

  /** Validate that a URL is acceptable for WebSocket use */
  validateServerURL(url: string): void {
    try {
      const parsed = new URL(url);
      if (!['ws:', 'wss:', 'http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Invalid WebSocket protocol: ${parsed.protocol}`);
      }
    } catch {
      throw new Error(`Invalid server URL: ${url}`);
    }
  }

  // ---- Private helpers ----

  private addAuthentication(socketOptions: any): void {
    switch (this.config.auth.type) {
      case 'token':
        if (this.config.auth.token) {
          socketOptions.auth = { token: this.config.auth.token };
        }
        break;

      case 'query':
        if (this.config.auth.token && this.config.auth.queryParam) {
          socketOptions.query = {
            ...socketOptions.query,
            [this.config.auth.queryParam]: this.config.auth.token
          };
        }
        break;

      case 'header':
        if (this.config.auth.token && this.config.auth.headerName) {
          socketOptions.extraHeaders = {
            ...socketOptions.extraHeaders,
            [this.config.auth.headerName]: this.config.auth.token
          };
        }
        break;

      case 'custom':
        if (this.config.auth.customAuth) {
          Object.assign(socketOptions, this.config.auth.customAuth);
        }
        break;
    }
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.emit('connected');
      if (this.connectionInfo) {
        this.connectionInfo.state = ConnectionState.CONNECTED;
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      this.emit('disconnected', reason);
      if (this.connectionInfo) {
        this.connectionInfo.state = ConnectionState.DISCONNECTED;
        this.connectionInfo.disconnectTime = new Date();
      }
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      this.emit('reconnected', attemptNumber);
      if (this.connectionInfo) {
        this.connectionInfo.reconnectCount = attemptNumber;
        this.connectionInfo.state = ConnectionState.CONNECTED;
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      this.emit('reconnecting', attemptNumber);
      if (this.connectionInfo) {
        this.connectionInfo.state = ConnectionState.RECONNECTING;
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      this.emit('error', error);
      if (this.connectionInfo) {
        this.connectionInfo.state = ConnectionState.ERROR;
        this.connectionInfo.error = error.message;
      }
    });
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.performance.enabled || !this.socket) return;

    this.connectionMetrics = {
      connectionId: this.connectionInfo!.id,
      connectTime: Date.now(),
      totalMessages: 0,
      messagesSent: 0,
      messagesReceived: 0,
      reconnectCount: 0,
      uptime: 0,
      timestamp: new Date()
    };

    if (this.config.performance.measureLatency && this.config.performance.pingInterval) {
      this.pingInterval = setInterval(() => {
        this.emit('ping_request');
      }, this.config.performance.pingInterval);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
