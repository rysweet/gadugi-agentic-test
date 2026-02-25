/**
 * WebSocket sub-module: WebSocketMessageHandler
 *
 * Handles message routing and processing: sending, receiving, validation,
 * event listener registration, latency recording, and message history.
 */

import { TestLogger } from '../../utils/logger';
import { deepEqual } from '../../utils/comparison';
import { WebSocketMessage, LatencyMeasurement, WebSocketAgentConfig } from './types';
import { WebSocketConnection } from './WebSocketConnection';

export class WebSocketMessageHandler {
  private messageHistory: WebSocketMessage[] = [];
  private latencyHistory: LatencyMeasurement[] = [];
  private pendingMessages: Map<string, { timestamp: Date; event: string }> = new Map();
  private eventHandlers: Map<string, (...args: unknown[]) => void> = new Map();
  private messageCounter = 0;

  constructor(
    private readonly config: Required<WebSocketAgentConfig>,
    private readonly logger: TestLogger,
    private readonly connection: WebSocketConnection
  ) {}

  async sendMessage(event: string, data?: unknown, ack?: boolean): Promise<WebSocketMessage> {
    const socket = this.connection.getSocket();
    if (!socket || !socket.connected) throw new Error('WebSocket is not connected');

    const messageId = this.generateMessageId();
    const message: WebSocketMessage = {
      id: messageId, event, data, timestamp: new Date(),
      direction: 'sent',
      ...(ack !== undefined ? { ack } : {}),
      namespace: this.config.namespace,
    };
    this.messageHistory.push(message);

    if (this.config.logConfig.logMessages) {
      this.logger.debug('Sending WebSocket message', {
        messageId, event, data: this.shouldMaskData(event) ? '[MASKED]' : data
      });
    }

    if (this.config.performance.measureLatency) {
      this.pendingMessages.set(messageId, { timestamp: new Date(), event });
    }

    if (ack) {
      return new Promise((resolve) => {
        socket.emit(event, data, (response: unknown) => {
          this.handleAcknowledgment(messageId, response);
          resolve(message);
        });
      });
    }
    socket.emit(event, data);
    return message;
  }

  async waitForMessage(event: string, timeout = 10000, filter?: (data: unknown) => boolean): Promise<WebSocketMessage> {
    const socket = this.connection.getSocket();
    if (!socket) throw new Error('WebSocket is not connected');

    return new Promise((resolve, reject) => {
      const handle = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const handler = (data: unknown) => {
        if (filter && !filter(data)) return;
        clearTimeout(handle);
        socket.off(event, handler);
        const message: WebSocketMessage = {
          id: this.generateMessageId(), event, data,
          timestamp: new Date(), direction: 'received',
          namespace: this.config.namespace
        };
        this.messageHistory.push(message);
        resolve(message);
      };

      socket.on(event, handler);
    });
  }

  async validateMessage(expected: string): Promise<boolean> {
    const msg = this.getLatestMessage();
    if (!msg) throw new Error('No message available for validation');
    try {
      return deepEqual(msg.data, JSON.parse(expected));
    } catch {
      return JSON.stringify(msg.data).includes(expected);
    }
  }

  async pingServer(): Promise<number> {
    const socket = this.connection.getSocket();
    if (!socket || !socket.connected) throw new Error('WebSocket is not connected');

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = setTimeout(() => reject(new Error('Ping timeout')), 5000);
      socket.emit('ping', startTime, (_response: unknown) => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        this.recordLatency('ping', latency);
        resolve(latency);
      });
    });
  }

  addEventListener(event: string, _handlerStr?: string): void {
    const socket = this.connection.getSocket();
    const handler = (data: unknown) => { this.logger.debug(`Event received: ${event}`, { data }); };
    if (socket) { socket.on(event, handler); this.eventHandlers.set(event, handler); }
  }

  removeEventListener(event: string): void {
    const socket = this.connection.getSocket();
    const handler = this.eventHandlers.get(event);
    if (handler && socket) {
      socket.off(event, handler as (...args: unknown[]) => void);
      this.eventHandlers.delete(event);
    }
  }

  setupCustomEventListeners(): void {
    this.config.eventListeners.forEach(listener => {
      const socket = this.connection.getSocket();
      if (!listener.enabled || !socket) return;

      const wrapped = (data: unknown) => {
        const message: WebSocketMessage = {
          id: this.generateMessageId(), event: listener.event, data,
          timestamp: new Date(), direction: 'received', namespace: this.config.namespace
        };
        this.messageHistory.push(message);

        if (this.config.logConfig.logMessages) {
          this.logger.debug('Received WebSocket message', {
            event: listener.event,
            data: this.shouldMaskData(listener.event) ? '[MASKED]' : data
          });
        }

        try {
          const result = listener.handler(data);
          if (result instanceof Promise) {
            result.catch((err: unknown) => this.logger.error('Event handler error', { event: listener.event, error: err instanceof Error ? err.message : String(err) }));
          }
        } catch (err: unknown) {
          this.logger.error('Event handler error', { event: listener.event, error: err instanceof Error ? err.message : String(err) });
        }
      };

      if (listener.once) socket.once(listener.event, wrapped);
      else socket.on(listener.event, wrapped);
      this.eventHandlers.set(listener.event, wrapped);
    });
  }

  setupDefaultEventListeners(): void {
    this.config.eventListeners.push({
      event: 'error',
      handler: (error: unknown) => { this.logger.error('WebSocket error event', { error }); },
      enabled: true
    });
    this.config.eventListeners.push({
      event: 'pong',
      handler: (data: unknown) => {
        const latency = typeof data === 'number' ? data : Date.now();
        this.recordLatency('ping', latency);
      },
      enabled: this.config.performance.measureLatency
    });
  }

  recordLatency(event: string, latency: number): void {
    const measurement: LatencyMeasurement = {
      messageId: this.generateMessageId(), event, latency, timestamp: new Date()
    };
    this.latencyHistory.push(measurement);
    if (this.latencyHistory.length > this.config.performance.maxLatencyHistory) this.latencyHistory.shift();
    this.connection.updateLatencyMetrics(latency, this.calculateAverageLatency());
    this.logger.debug('Latency recorded', { event, latency });
  }

  getLatestMessage(): WebSocketMessage | undefined { return this.messageHistory[this.messageHistory.length - 1]; }
  getMessagesByEvent(event: string): WebSocketMessage[] { return this.messageHistory.filter(m => m.event === event); }
  getMessageHistory(): WebSocketMessage[] { return this.messageHistory; }
  getLatencyHistory(): LatencyMeasurement[] { return this.latencyHistory; }

  clearHistory(): void {
    this.messageHistory = [];
    this.latencyHistory = [];
    this.pendingMessages.clear();
    this.eventHandlers.clear();
  }

  private handleAcknowledgment(messageId: string, _response: unknown): void {
    const pending = this.pendingMessages.get(messageId);
    if (pending && this.config.performance.measureLatency) {
      this.recordLatency(pending.event, Date.now() - pending.timestamp.getTime());
      this.pendingMessages.delete(messageId);
    }
  }

  private shouldMaskData(event: string): boolean {
    return this.config.logConfig.maskSensitiveData &&
      this.config.logConfig.sensitiveEvents.some(s => event.toLowerCase().includes(s.toLowerCase()));
  }

  private calculateAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    return this.latencyHistory.reduce((acc, m) => acc + m.latency, 0) / this.latencyHistory.length;
  }

  private generateMessageId(): string {
    // Uses a counter suffix (not random) to guarantee per-session ordering.
    return `msg_${Date.now()}_${(++this.messageCounter).toString(36)}`;
  }
}
