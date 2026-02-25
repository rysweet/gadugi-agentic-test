/**
 * ElectronWebSocketMonitor - Socket.IO connection management and event collection.
 *
 * Delegates all connection logic to WebSocketAgent instead of using socket.io-client directly.
 */

import { EventEmitter } from 'events';
import { ElectronUIAgentConfig, WebSocketEvent } from './types';
import { TestLogger } from '../../utils/logger';
import { WebSocketAgent } from '../WebSocketAgent';
import { EventListener } from '../websocket/types';

/**
 * Manages a Socket.IO connection for monitoring application WebSocket events.
 * Emits 'websocket_connected', 'websocket_disconnected', and 'websocket_event' on the provided emitter.
 *
 * Delegates all connection lifecycle to WebSocketAgent.
 */
export class ElectronWebSocketMonitor {
  private config: ElectronUIAgentConfig;
  private logger: TestLogger;
  private emitter: EventEmitter;

  public events: WebSocketEvent[] = [];
  private wsAgent: WebSocketAgent | undefined;

  constructor(config: ElectronUIAgentConfig, logger: TestLogger, emitter: EventEmitter) {
    this.config = config;
    this.logger = logger;
    this.emitter = emitter;
  }

  /**
   * Connect to the configured Socket.IO endpoint via WebSocketAgent and begin collecting events.
   * No-op if websocketConfig is not set.
   */
  async connect(): Promise<void> {
    if (!this.config.websocketConfig) return;

    const wsConfig = this.config.websocketConfig;

    try {
      const eventListeners: EventListener[] = wsConfig.events.map(eventType => ({
        event: eventType,
        enabled: true,
        handler: (data: any) => {
          const wsEvent: WebSocketEvent = {
            type: eventType,
            timestamp: new Date(),
            data,
            source: 'socket.io'
          };
          this.events.push(wsEvent);
          this.emitter.emit('websocket_event', wsEvent);
        }
      }));

      this.wsAgent = new WebSocketAgent({
        serverURL: wsConfig.url,
        reconnection: {
          enabled: true,
          maxAttempts: wsConfig.reconnectAttempts,
          delay: wsConfig.reconnectDelay,
          exponentialBackoff: false,
          maxBackoffDelay: wsConfig.reconnectDelay * wsConfig.reconnectAttempts,
          randomizationFactor: 0
        },
        connectionTimeout: 10000,
        eventListeners
      });

      this.wsAgent.on('connected', () => {
        this.logger.info('Socket.IO connected', { url: wsConfig.url });
        this.emitter.emit('websocket_connected');
      });

      this.wsAgent.on('disconnected', (reason: string) => {
        this.logger.info('Socket.IO disconnected', { reason });
        this.emitter.emit('websocket_disconnected');
      });

      this.wsAgent.on('error', (error: Error) => {
        this.logger.error('Socket.IO connection error', { error: error.message });
      });

      await this.wsAgent.initialize();
      await this.wsAgent.connect(wsConfig.url);
    } catch (error: unknown) {
      this.logger.error('Failed to connect Socket.IO', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Disconnect from the Socket.IO endpoint via WebSocketAgent
   */
  async disconnect(): Promise<void> {
    if (this.wsAgent) {
      await this.wsAgent.cleanup();
      this.wsAgent = undefined;
    }
  }
}
