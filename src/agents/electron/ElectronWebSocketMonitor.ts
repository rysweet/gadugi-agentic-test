/**
 * ElectronWebSocketMonitor - Socket.IO connection management and event collection
 */

import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { ElectronUIAgentConfig, WebSocketEvent } from './types';
import { TestLogger } from '../../utils/logger';

/**
 * Manages a Socket.IO connection for monitoring application WebSocket events.
 * Emits 'websocket_connected', 'websocket_disconnected', and 'websocket_event' on the provided emitter.
 */
export class ElectronWebSocketMonitor {
  private config: ElectronUIAgentConfig;
  private logger: TestLogger;
  private emitter: EventEmitter;

  public events: WebSocketEvent[] = [];
  private socket: Socket | null = null;

  constructor(config: ElectronUIAgentConfig, logger: TestLogger, emitter: EventEmitter) {
    this.config = config;
    this.logger = logger;
    this.emitter = emitter;
  }

  /**
   * Connect to the configured Socket.IO endpoint and begin collecting events.
   * No-op if websocketConfig is not set.
   */
  async connect(): Promise<void> {
    if (!this.config.websocketConfig) return;

    const wsConfig = this.config.websocketConfig;

    try {
      this.socket = io(wsConfig.url, {
        reconnection: true,
        reconnectionAttempts: wsConfig.reconnectAttempts,
        reconnectionDelay: wsConfig.reconnectDelay,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        this.logger.info('Socket.IO connected', { url: wsConfig.url });
        this.emitter.emit('websocket_connected');
      });

      wsConfig.events.forEach(eventType => {
        this.socket!.on(eventType, (data: any) => {
          const event: WebSocketEvent = {
            type: eventType,
            timestamp: new Date(),
            data,
            source: 'socket.io'
          };
          this.events.push(event);
          this.emitter.emit('websocket_event', event);
        });
      });

      this.socket.onAny((eventType: string, ...args: any[]) => {
        if (!wsConfig.events.includes(eventType)) {
          const event: WebSocketEvent = {
            type: eventType,
            timestamp: new Date(),
            data: args.length === 1 ? args[0] : args,
            source: 'socket.io'
          };
          this.events.push(event);
          this.emitter.emit('websocket_event', event);
        }
      });

      this.socket.on('connect_error', (error) => {
        this.logger.error('Socket.IO connection error', { error: error.message });
      });

      this.socket.on('disconnect', (reason) => {
        this.logger.info('Socket.IO disconnected', { reason });
        this.emitter.emit('websocket_disconnected');
      });

    } catch (error: any) {
      this.logger.error('Failed to connect Socket.IO', { error: error?.message });
    }
  }

  /**
   * Disconnect from the Socket.IO endpoint
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
