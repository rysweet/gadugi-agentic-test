"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketAgent = exports.ConnectionState = void 0;
exports.createWebSocketAgent = createWebSocketAgent;
const index_1 = require("./index");
const logger_1 = require("../utils/logger");
const BaseAgent_1 = require("./BaseAgent");
const types_1 = require("./websocket/types");
const WebSocketConnection_1 = require("./websocket/WebSocketConnection");
const WebSocketMessageHandler_1 = require("./websocket/WebSocketMessageHandler");
const WebSocketEventRecorder_1 = require("./websocket/WebSocketEventRecorder");
const WebSocketStepExecutor_1 = require("./websocket/WebSocketStepExecutor");
// Re-export all public types so existing imports continue to work.
var types_2 = require("./websocket/types");
Object.defineProperty(exports, "ConnectionState", { enumerable: true, get: function () { return types_2.ConnectionState; } });
/** Comprehensive WebSocket testing agent (thin facade) */
class WebSocketAgent extends BaseAgent_1.BaseAgent {
    constructor(config = {}) {
        super();
        this.name = 'WebSocketAgent';
        this.type = index_1.AgentType.WEBSOCKET;
        this.config = { ...types_1.DEFAULT_CONFIG, ...config };
        const logger = (0, logger_1.createLogger)({ level: this.config.logConfig.logLevel, logDir: './logs/websocket-agent' });
        this.connection = new WebSocketConnection_1.WebSocketConnection(this.config, logger);
        this.messageHandler = new WebSocketMessageHandler_1.WebSocketMessageHandler(this.config, logger, this.connection);
        this.eventRecorder = new WebSocketEventRecorder_1.WebSocketEventRecorder(this.config, logger);
        this.stepExecutor = new WebSocketStepExecutor_1.WebSocketStepExecutor(this.connection, this.messageHandler, this.eventRecorder, (url, opts) => this.connect(url, opts), () => this.disconnect());
        this.connection.on('connected', () => this.emit('connected'));
        this.connection.on('disconnected', (r) => this.emit('disconnected', r));
        this.connection.on('reconnected', (n) => this.emit('reconnected', n));
        this.connection.on('reconnecting', (n) => this.emit('reconnecting', n));
        this.connection.on('error', (e) => this.emit('error', e));
        this.connection.on('ping_request', () => { this.messageHandler.pingServer().catch(() => { }); });
        this.on('error', () => { }); // prevent unhandled crash
    }
    async initialize() {
        if (this.config.serverURL)
            this.connection.validateServerURL(this.config.serverURL);
        this.messageHandler.setupDefaultEventListeners();
        this.isInitialized = true;
        this.emit('initialized');
    }
    // -- BaseAgent template-method hooks --
    applyEnvironment(scenario) {
        if (scenario.environment) {
            this.eventRecorder.applyEnvironmentConfig(scenario.environment, (t, v) => this.eventRecorder.setAuthentication(t, v));
        }
    }
    buildResult(ctx) {
        return {
            ...ctx,
            logs: ['No scenario-specific logs available'],
            messageHistory: this.messageHandler.getMessageHistory(),
            connectionInfo: this.connection.getConnectionInfo(),
            latencyMetrics: this.messageHandler.getLatencyHistory(),
            connectionMetrics: this.connection.getConnectionMetrics(),
        };
    }
    async executeStep(step, stepIndex) {
        return this.stepExecutor.executeStep(step, stepIndex);
    }
    async connect(url, options) {
        await this.connection.connect(url, options);
        this.messageHandler.setupCustomEventListeners();
    }
    async disconnect() { await this.connection.disconnect(); }
    async sendMessage(event, data, ack) {
        return this.messageHandler.sendMessage(event, data, ack);
    }
    async waitForMessage(event, timeout = 10000, filter) {
        return this.messageHandler.waitForMessage(event, timeout, filter);
    }
    getConnectionState() { return this.connection.getConnectionState(); }
    getLatestMessage() { return this.messageHandler.getLatestMessage(); }
    getMessagesByEvent(event) { return this.messageHandler.getMessagesByEvent(event); }
    getConnectionMetrics() { return this.connection.getConnectionMetrics(); }
    getConnectionInfo() { return this.connection.getConnectionInfo(); }
    async cleanup() {
        await this.disconnect();
        this.messageHandler.clearHistory();
        this.eventRecorder.clear();
        this.emit('cleanup');
    }
}
exports.WebSocketAgent = WebSocketAgent;
/** Factory function to create WebSocketAgent instance */
function createWebSocketAgent(config) {
    return new WebSocketAgent(config);
}
//# sourceMappingURL=WebSocketAgent.js.map