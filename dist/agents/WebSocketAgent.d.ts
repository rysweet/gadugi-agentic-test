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
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 */
import { AgentType } from './index';
import { TestStep, StepResult, OrchestratorScenario } from '../models/TestModels';
import { BaseAgent, ExecutionContext } from './BaseAgent';
import { ConnectionState, WebSocketAgentConfig, WebSocketMessage, ConnectionMetrics, ConnectionInfo } from './websocket/types';
import type { ManagerOptions, SocketOptions } from 'socket.io-client';
export { ConnectionState } from './websocket/types';
export type { WebSocketAgentConfig, WebSocketMessage, ConnectionMetrics, LatencyMeasurement, ConnectionInfo, EventListener, ReconnectionConfig, WebSocketAuth } from './websocket/types';
/** Comprehensive WebSocket testing agent (thin facade) */
export declare class WebSocketAgent extends BaseAgent {
    readonly name = "WebSocketAgent";
    readonly type = AgentType.WEBSOCKET;
    private readonly config;
    private readonly connection;
    private readonly messageHandler;
    private readonly eventRecorder;
    private readonly stepExecutor;
    constructor(config?: WebSocketAgentConfig);
    initialize(): Promise<void>;
    protected applyEnvironment(scenario: OrchestratorScenario): void;
    protected buildResult(ctx: ExecutionContext): unknown;
    executeStep(step: TestStep, stepIndex: number): Promise<StepResult>;
    connect(url?: string, options?: Partial<ManagerOptions & SocketOptions>): Promise<void>;
    disconnect(): Promise<void>;
    sendMessage(event: string, data?: unknown, ack?: boolean): Promise<WebSocketMessage>;
    waitForMessage(event: string, timeout?: number, filter?: (d: unknown) => boolean): Promise<WebSocketMessage>;
    getConnectionState(): ConnectionState;
    getLatestMessage(): WebSocketMessage | undefined;
    getMessagesByEvent(event: string): WebSocketMessage[];
    getConnectionMetrics(): ConnectionMetrics | undefined;
    getConnectionInfo(): ConnectionInfo | undefined;
    cleanup(): Promise<void>;
}
/** Factory function to create WebSocketAgent instance */
export declare function createWebSocketAgent(config?: WebSocketAgentConfig): WebSocketAgent;
//# sourceMappingURL=WebSocketAgent.d.ts.map