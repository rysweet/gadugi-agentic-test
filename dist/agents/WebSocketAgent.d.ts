/**
 * WebSocketAgent - Comprehensive WebSocket testing agent using Socket.IO Client
 *
 * This agent provides complete automation capabilities for WebSocket testing
 * including connection lifecycle management, message sending/receiving,
 * event handling, performance measurement, reconnection logic, and
 * comprehensive error handling.
 */
import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { TestStep, StepResult, TestScenario } from '../models/TestModels';
import { LogLevel } from '../utils/logger';
/**
 * WebSocket connection states
 */
export declare enum ConnectionState {
    DISCONNECTED = "disconnected",
    CONNECTING = "connecting",
    CONNECTED = "connected",
    RECONNECTING = "reconnecting",
    ERROR = "error"
}
/**
 * WebSocket message types
 */
export interface WebSocketMessage {
    id: string;
    event: string;
    data: any;
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
    handler: (data: any) => void | Promise<void>;
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
 * Comprehensive WebSocket testing agent
 */
export declare class WebSocketAgent extends EventEmitter implements IAgent {
    readonly name = "WebSocketAgent";
    readonly type = AgentType.WEBSOCKET;
    private config;
    private logger;
    private isInitialized;
    private currentScenarioId?;
    private socket?;
    private connectionInfo?;
    private messageHistory;
    private latencyHistory;
    private connectionMetrics?;
    private pendingMessages;
    private eventHandlers;
    private pingInterval?;
    private connectionPromise?;
    constructor(config?: WebSocketAgentConfig);
    /**
     * Initialize the agent
     */
    initialize(): Promise<void>;
    /**
     * Execute a test scenario
     */
    execute(scenario: TestScenario): Promise<any>;
    /**
     * Connect to WebSocket server
     */
    connect(url?: string, options?: any): Promise<void>;
    /**
     * Disconnect from WebSocket server
     */
    disconnect(): Promise<void>;
    /**
     * Send a message through WebSocket
     */
    sendMessage(event: string, data?: any, ack?: boolean): Promise<WebSocketMessage>;
    /**
     * Wait for a specific message/event
     */
    waitForMessage(event: string, timeout?: number, filter?: (data: any) => boolean): Promise<WebSocketMessage>;
    /**
     * Execute a test step
     */
    executeStep(step: TestStep, stepIndex: number): Promise<StepResult>;
    /**
     * Get connection state
     */
    getConnectionState(): ConnectionState;
    /**
     * Get latest message
     */
    getLatestMessage(): WebSocketMessage | undefined;
    /**
     * Get messages by event type
     */
    getMessagesByEvent(event: string): WebSocketMessage[];
    /**
     * Get connection metrics
     */
    getConnectionMetrics(): ConnectionMetrics | undefined;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    private validateServerURL;
    private addAuthentication;
    private setupSocketEventHandlers;
    private setupCustomEventListeners;
    private setupDefaultEventListeners;
    private setupPerformanceMonitoring;
    private handleSendMessage;
    private handleWaitForMessage;
    private validateMessage;
    private validateConnection;
    private addEventListener;
    private removeEventListener;
    private pingServer;
    private setAuthentication;
    private recordLatency;
    private calculateAverageLatency;
    private handleAcknowledgment;
    private shouldMaskData;
    private generateConnectionId;
    private generateMessageId;
    private applyEnvironmentConfig;
    private getScenarioLogs;
    private setupEventListeners;
    private deepEqual;
    private delay;
}
/**
 * Factory function to create WebSocketAgent instance
 */
export declare function createWebSocketAgent(config?: WebSocketAgentConfig): WebSocketAgent;
//# sourceMappingURL=WebSocketAgent.d.ts.map