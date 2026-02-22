/**
 * WebSocketAgent - Thin facade over focused WebSocket sub-modules.
 *
 * Delegates all logic to:
 *   - WebSocketConnection      (connect / disconnect / reconnect lifecycle)
 *   - WebSocketMessageHandler  (send / receive / validate / ping)
 *   - WebSocketEventRecorder   (auth config, env vars, event recording)
 *   - WebSocketStepExecutor    (TestStep action dispatch)
 *
 * Public API is fully backward-compatible with the original monolith.
 */

import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { TestStep, TestStatus, StepResult, OrchestratorScenario } from '../models/TestModels';
import { createLogger } from '../utils/logger';

import {
  ConnectionState,
  WebSocketAgentConfig,
  WebSocketMessage,
  ConnectionMetrics,
  ConnectionInfo,
  LatencyMeasurement,
  DEFAULT_CONFIG
} from './websocket/types';
import { WebSocketConnection } from './websocket/WebSocketConnection';
import { WebSocketMessageHandler } from './websocket/WebSocketMessageHandler';
import { WebSocketEventRecorder } from './websocket/WebSocketEventRecorder';
import { WebSocketStepExecutor } from './websocket/WebSocketStepExecutor';

// Re-export all public types so existing imports continue to work.
export { ConnectionState } from './websocket/types';
export type {
  WebSocketAgentConfig,
  WebSocketMessage,
  ConnectionMetrics,
  LatencyMeasurement,
  ConnectionInfo,
  EventListener,
  ReconnectionConfig,
  WebSocketAuth
} from './websocket/types';

/** Comprehensive WebSocket testing agent (thin facade) */
export class WebSocketAgent extends EventEmitter implements IAgent {
  public readonly name = 'WebSocketAgent';
  public readonly type = AgentType.WEBSOCKET;

  private readonly config: Required<WebSocketAgentConfig>;
  private readonly connection: WebSocketConnection;
  private readonly messageHandler: WebSocketMessageHandler;
  private readonly eventRecorder: WebSocketEventRecorder;
  private readonly stepExecutor: WebSocketStepExecutor;
  private isInitialized = false;

  constructor(config: WebSocketAgentConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    const logger = createLogger({ level: this.config.logConfig.logLevel, logDir: './logs/websocket-agent' });

    this.connection = new WebSocketConnection(this.config, logger);
    this.messageHandler = new WebSocketMessageHandler(this.config, logger, this.connection);
    this.eventRecorder = new WebSocketEventRecorder(this.config, logger);
    this.stepExecutor = new WebSocketStepExecutor(
      this.connection, this.messageHandler, this.eventRecorder,
      (url, opts) => this.connect(url, opts),
      () => this.disconnect()
    );

    this.connection.on('connected', () => this.emit('connected'));
    this.connection.on('disconnected', (r: string) => this.emit('disconnected', r));
    this.connection.on('reconnected', (n: number) => this.emit('reconnected', n));
    this.connection.on('reconnecting', (n: number) => this.emit('reconnecting', n));
    this.connection.on('error', (e: Error) => this.emit('error', e));
    this.connection.on('ping_request', () => { this.messageHandler.pingServer().catch(() => {}); });
    this.on('error', () => {}); // prevent unhandled crash
  }

  async initialize(): Promise<void> {
    if (this.config.serverURL) this.connection.validateServerURL(this.config.serverURL);
    this.messageHandler.setupDefaultEventListeners();
    this.isInitialized = true;
    this.emit('initialized');
  }

  async execute(scenario: OrchestratorScenario): Promise<any> {
    if (!this.isInitialized) throw new Error('Agent not initialized. Call initialize() first.');
    const startTime = Date.now();
    let status = TestStatus.PASSED;
    let error: string | undefined;

    try {
      if (scenario.environment) {
        this.eventRecorder.applyEnvironmentConfig(scenario.environment,
          (t, v) => this.eventRecorder.setAuthentication(t, v));
      }
      const stepResults: StepResult[] = [];
      for (let i = 0; i < scenario.steps.length; i++) {
        const sr = await this.executeStep(scenario.steps[i], i);
        stepResults.push(sr);
        if (sr.status === TestStatus.FAILED || sr.status === TestStatus.ERROR) {
          status = sr.status; error = sr.error; break;
        }
      }
      return {
        scenarioId: scenario.id, status, duration: Date.now() - startTime,
        startTime: new Date(startTime), endTime: new Date(), error, stepResults,
        logs: ['No scenario-specific logs available'],
        messageHistory: this.messageHandler.getMessageHistory(),
        connectionInfo: this.connection.getConnectionInfo(),
        latencyMetrics: this.messageHandler.getLatencyHistory(),
        connectionMetrics: this.connection.getConnectionMetrics()
      };
    } catch (err: any) { status = TestStatus.ERROR; error = err?.message; throw err; }
  }

  async executeStep(step: TestStep, stepIndex: number): Promise<StepResult> {
    return this.stepExecutor.executeStep(step, stepIndex);
  }

  async connect(url?: string, options?: any): Promise<void> {
    await this.connection.connect(url, options);
    this.messageHandler.setupCustomEventListeners();
  }

  async disconnect(): Promise<void> { await this.connection.disconnect(); }

  async sendMessage(event: string, data?: any, ack?: boolean): Promise<WebSocketMessage> {
    return this.messageHandler.sendMessage(event, data, ack);
  }

  async waitForMessage(event: string, timeout = 10000, filter?: (d: any) => boolean): Promise<WebSocketMessage> {
    return this.messageHandler.waitForMessage(event, timeout, filter);
  }

  getConnectionState(): ConnectionState { return this.connection.getConnectionState(); }
  getLatestMessage(): WebSocketMessage | undefined { return this.messageHandler.getLatestMessage(); }
  getMessagesByEvent(event: string): WebSocketMessage[] { return this.messageHandler.getMessagesByEvent(event); }
  getConnectionMetrics(): ConnectionMetrics | undefined { return this.connection.getConnectionMetrics(); }
  getConnectionInfo(): ConnectionInfo | undefined { return this.connection.getConnectionInfo(); }

  async cleanup(): Promise<void> {
    await this.disconnect();
    this.messageHandler.clearHistory();
    this.eventRecorder.clear();
    this.emit('cleanup');
  }
}

/** Factory function to create WebSocketAgent instance */
export function createWebSocketAgent(config?: WebSocketAgentConfig): WebSocketAgent {
  return new WebSocketAgent(config);
}
