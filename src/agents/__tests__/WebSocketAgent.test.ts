/**
 * WebSocketAgent test suite
 *
 * Tests the facade and its sub-modules using a mocked socket.io-client.
 * No real network connections are made.
 */

jest.mock('socket.io-client', () => {
  const { EventEmitter } = require('events');

  class MockSocket extends EventEmitter {
    connected = false;
    id = 'mock-socket-id';

    connect() { this.connected = true; this.emit('connect'); return this; }
    disconnect() { this.connected = false; this.emit('disconnect', 'io client disconnect'); }
    on(event: string, handler: (...args: any[]) => void) { return super.on(event, handler); }
    once(event: string, handler: (...args: any[]) => void) { return super.once(event, handler); }
    off(event: string, handler: (...args: any[]) => void) { return super.off(event, handler); }
    emit(event: string, ...args: any[]) { return super.emit(event, ...args); }
  }

  const mockSocket = new MockSocket();
  const io = jest.fn(() => mockSocket);
  return { io, __mockSocket: mockSocket };
});

import { WebSocketAgent, createWebSocketAgent, ConnectionState } from '../WebSocketAgent';
import { AgentType } from '../index';
import { TestStatus } from '../../models/TestModels';
import { WebSocketConnection } from '../websocket/WebSocketConnection';
import { WebSocketMessageHandler } from '../websocket/WebSocketMessageHandler';
import { WebSocketEventRecorder } from '../websocket/WebSocketEventRecorder';
import { WebSocketStepExecutor } from '../websocket/WebSocketStepExecutor';
import { ConnectionState as TypesConnectionState, DEFAULT_CONFIG } from '../websocket/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockSocket: mockSocket } = require('socket.io-client');

// ============================================================
// WebSocketAgent facade
// ============================================================

describe('WebSocketAgent (facade)', () => {
  let agent: WebSocketAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.removeAllListeners();
    mockSocket.connected = false;
    agent = createWebSocketAgent({ serverURL: 'http://localhost:3000' });
  });

  afterEach(async () => {
    try { await agent.cleanup(); } catch { /* ignore */ }
  });

  it('has correct name and type', () => {
    expect(agent.name).toBe('WebSocketAgent');
    expect(agent.type).toBe(AgentType.WEBSOCKET);
  });

  it('createWebSocketAgent returns WebSocketAgent instance', () => {
    expect(agent).toBeInstanceOf(WebSocketAgent);
  });

  it('initialize sets up default event listeners and emits initialized', async () => {
    const spy = jest.fn();
    agent.on('initialized', spy);
    await agent.initialize();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('initialize throws on invalid URL', async () => {
    const bad = new WebSocketAgent({ serverURL: 'ftp://bad-scheme' });
    await expect(bad.initialize()).rejects.toThrow('Invalid server URL');
  });

  it('getConnectionState returns DISCONNECTED before connecting', async () => {
    await agent.initialize();
    expect(agent.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
  });

  it('connect transitions state to CONNECTED', async () => {
    await agent.initialize();
    // simulate socket emitting connect when io() is called
    const io = require('socket.io-client').io as jest.Mock;
    io.mockImplementationOnce(() => {
      mockSocket.connected = true;
      setTimeout(() => mockSocket.emit('connect'), 0);
      return mockSocket;
    });
    await agent.connect('http://localhost:3000');
    expect(agent.getConnectionState()).toBe(ConnectionState.CONNECTED);
  });

  it('getLatestMessage returns undefined with no messages', async () => {
    await agent.initialize();
    expect(agent.getLatestMessage()).toBeUndefined();
  });

  it('getMessagesByEvent returns empty array with no messages', async () => {
    await agent.initialize();
    expect(agent.getMessagesByEvent('test')).toEqual([]);
  });

  it('getConnectionMetrics returns undefined before connecting', async () => {
    await agent.initialize();
    expect(agent.getConnectionMetrics()).toBeUndefined();
  });

  it('getConnectionInfo returns undefined before connecting', async () => {
    await agent.initialize();
    expect(agent.getConnectionInfo()).toBeUndefined();
  });

  it('cleanup emits cleanup event', async () => {
    await agent.initialize();
    const spy = jest.fn();
    agent.on('cleanup', spy);
    await agent.cleanup();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('execute throws if not initialized', async () => {
    const scenario = { id: 'test', name: 'Test', steps: [], timeout: 5000 } as any;
    await expect(agent.execute(scenario)).rejects.toThrow('not initialized');
  });

  it('execute runs empty scenario successfully', async () => {
    await agent.initialize();
    const scenario = { id: 's1', name: 'Empty', steps: [], timeout: 5000 } as any;
    const result = await agent.execute(scenario);
    expect(result.scenarioId).toBe('s1');
    expect(result.stepResults).toEqual([]);
  });
});

// ============================================================
// ConnectionState enum re-export
// ============================================================

describe('ConnectionState (re-export)', () => {
  it('matches values from websocket/types', () => {
    expect(ConnectionState.DISCONNECTED).toBe(TypesConnectionState.DISCONNECTED);
    expect(ConnectionState.CONNECTED).toBe(TypesConnectionState.CONNECTED);
    expect(ConnectionState.CONNECTING).toBe(TypesConnectionState.CONNECTING);
    expect(ConnectionState.RECONNECTING).toBe(TypesConnectionState.RECONNECTING);
    expect(ConnectionState.ERROR).toBe(TypesConnectionState.ERROR);
  });
});

// ============================================================
// DEFAULT_CONFIG
// ============================================================

describe('DEFAULT_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.namespace).toBe('/');
    expect(DEFAULT_CONFIG.connectionTimeout).toBe(10000);
    expect(DEFAULT_CONFIG.reconnection.maxAttempts).toBe(5);
    expect(DEFAULT_CONFIG.performance.enabled).toBe(true);
    expect(DEFAULT_CONFIG.messageValidation.enabled).toBe(false);
    expect(DEFAULT_CONFIG.logConfig.maskSensitiveData).toBe(true);
  });
});

// ============================================================
// WebSocketEventRecorder
// ============================================================

describe('WebSocketEventRecorder', () => {
  const makeRecorder = () => {
    const config = { ...DEFAULT_CONFIG };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    return new WebSocketEventRecorder(config, logger);
  };

  it('records events', () => {
    const rec = makeRecorder();
    rec.record('connection', 'connect');
    expect(rec.getRecordedEvents()).toHaveLength(1);
    expect(rec.getRecordedEvents()[0].event).toBe('connect');
  });

  it('clear empties recorded events', () => {
    const rec = makeRecorder();
    rec.record('message', 'data', { x: 1 });
    rec.clear();
    expect(rec.getRecordedEvents()).toHaveLength(0);
  });

  it('setAuthentication token', () => {
    const config = { ...DEFAULT_CONFIG, auth: { type: 'token' as const } };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    const rec = new WebSocketEventRecorder(config, logger);
    rec.setAuthentication('token', 'abc123');
    expect(config.auth).toEqual({ type: 'token', token: 'abc123' });
  });

  it('setAuthentication throws on unsupported type', () => {
    const rec = makeRecorder();
    expect(() => rec.setAuthentication('oauth')).toThrow('Unsupported');
  });

  it('applyEnvironmentConfig sets WS_SERVER_URL', () => {
    const config = { ...DEFAULT_CONFIG };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    const rec = new WebSocketEventRecorder(config, logger);
    rec.applyEnvironmentConfig({ WS_SERVER_URL: 'http://server:4000' }, jest.fn());
    expect(config.serverURL).toBe('http://server:4000');
  });

  it('applyEnvironmentConfig sets WS_NAMESPACE', () => {
    const config = { ...DEFAULT_CONFIG };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    const rec = new WebSocketEventRecorder(config, logger);
    rec.applyEnvironmentConfig({ WS_NAMESPACE: '/chat' }, jest.fn());
    expect(config.namespace).toBe('/chat');
  });
});

// ============================================================
// WebSocketConnection helpers (no network)
// ============================================================

describe('WebSocketConnection', () => {
  const makeConnection = () => {
    const config = { ...DEFAULT_CONFIG, serverURL: 'http://localhost:3000' };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    return new WebSocketConnection(config, logger);
  };

  it('getConnectionState returns DISCONNECTED initially', () => {
    const conn = makeConnection();
    expect(conn.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
  });

  it('isConnected returns false initially', () => {
    const conn = makeConnection();
    expect(conn.isConnected()).toBe(false);
  });

  it('getSocket returns undefined initially', () => {
    const conn = makeConnection();
    expect(conn.getSocket()).toBeUndefined();
  });

  it('getConnectionInfo returns undefined initially', () => {
    const conn = makeConnection();
    expect(conn.getConnectionInfo()).toBeUndefined();
  });

  it('getConnectionMetrics returns undefined initially', () => {
    const conn = makeConnection();
    expect(conn.getConnectionMetrics()).toBeUndefined();
  });

  it('validateServerURL accepts valid http URL', () => {
    const conn = makeConnection();
    expect(() => conn.validateServerURL('http://localhost:3000')).not.toThrow();
  });

  it('validateServerURL accepts valid ws URL', () => {
    const conn = makeConnection();
    expect(() => conn.validateServerURL('ws://localhost:3000')).not.toThrow();
  });

  it('validateServerURL rejects invalid URL', () => {
    const conn = makeConnection();
    expect(() => conn.validateServerURL('not-a-url')).toThrow('Invalid server URL');
  });

  it('validateServerURL rejects unsupported protocol', () => {
    const conn = makeConnection();
    expect(() => conn.validateServerURL('ftp://server')).toThrow('Invalid server URL');
  });

  it('disconnect does nothing when not connected', async () => {
    const conn = makeConnection();
    await expect(conn.disconnect()).resolves.toBeUndefined();
  });

  it('connect throws without serverURL and no argument', async () => {
    const config = { ...DEFAULT_CONFIG, serverURL: '' };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    const conn = new WebSocketConnection(config, logger);
    await expect(conn.connect()).rejects.toThrow('Server URL is required');
  });
});

// ============================================================
// WebSocketStepExecutor
// ============================================================

describe('WebSocketStepExecutor', () => {
  const makeExecutor = () => {
    const config = { ...DEFAULT_CONFIG };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), stepExecution: jest.fn(), stepComplete: jest.fn() } as any;
    const conn = new WebSocketConnection(config, logger);
    const handler = new WebSocketMessageHandler(config, logger, conn);
    const recorder = new WebSocketEventRecorder(config, logger);
    const connectFn = jest.fn().mockResolvedValue(undefined);
    const disconnectFn = jest.fn().mockResolvedValue(undefined);
    const executor = new WebSocketStepExecutor(conn, handler, recorder, connectFn, disconnectFn);
    return { executor, connectFn, disconnectFn };
  };

  it('executes connect step', async () => {
    const { executor, connectFn } = makeExecutor();
    const step = { action: 'connect', target: 'http://localhost:3000', value: undefined } as any;
    const result = await executor.executeStep(step, 0);
    expect(connectFn).toHaveBeenCalledWith('http://localhost:3000');
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('executes disconnect step', async () => {
    const { executor, disconnectFn } = makeExecutor();
    const step = { action: 'disconnect', target: '', value: undefined } as any;
    const result = await executor.executeStep(step, 0);
    expect(disconnectFn).toHaveBeenCalled();
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('executes wait step', async () => {
    const { executor } = makeExecutor();
    const step = { action: 'wait', target: '', value: '10' } as any;
    const result = await executor.executeStep(step, 0);
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('returns failed status on unknown action', async () => {
    const { executor } = makeExecutor();
    const step = { action: 'nonexistent', target: '', value: undefined } as any;
    const result = await executor.executeStep(step, 0);
    expect(result.status).toBe(TestStatus.FAILED);
    expect(result.error).toContain('Unsupported WebSocket action');
  });

  it('executes validate_connection step (not connected = false)', async () => {
    const { executor } = makeExecutor();
    const step = { action: 'validate_connection', target: '', value: undefined } as any;
    const result = await executor.executeStep(step, 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(result.actualResult).toBe('false');
  });

  it('executes set_auth step', async () => {
    const { executor } = makeExecutor();
    const step = { action: 'set_auth', target: 'token', value: 'mytoken' } as any;
    const result = await executor.executeStep(step, 0);
    expect(result.status).toBe(TestStatus.PASSED);
  });
});

// ============================================================
// WebSocketMessageHandler (no-socket path)
// ============================================================

describe('WebSocketMessageHandler', () => {
  const makeHandler = () => {
    const config = { ...DEFAULT_CONFIG };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    const conn = new WebSocketConnection(config, logger);
    const handler = new WebSocketMessageHandler(config, logger, conn);
    return { handler };
  };

  it('getLatestMessage returns undefined initially', () => {
    const { handler } = makeHandler();
    expect(handler.getLatestMessage()).toBeUndefined();
  });

  it('getMessageHistory returns empty array initially', () => {
    const { handler } = makeHandler();
    expect(handler.getMessageHistory()).toEqual([]);
  });

  it('getLatencyHistory returns empty array initially', () => {
    const { handler } = makeHandler();
    expect(handler.getLatencyHistory()).toEqual([]);
  });

  it('clearHistory resets all state', () => {
    const { handler } = makeHandler();
    handler.clearHistory();
    expect(handler.getMessageHistory()).toHaveLength(0);
  });

  it('sendMessage throws when not connected', async () => {
    const { handler } = makeHandler();
    await expect(handler.sendMessage('test', {})).rejects.toThrow('not connected');
  });

  it('validateMessage throws when no message available', async () => {
    const { handler } = makeHandler();
    await expect(handler.validateMessage('{"key":"val"}')).rejects.toThrow('No message available');
  });

  it('pingServer throws when not connected', async () => {
    const { handler } = makeHandler();
    await expect(handler.pingServer()).rejects.toThrow('not connected');
  });

  it('addEventListener does nothing when socket absent', () => {
    const { handler } = makeHandler();
    expect(() => handler.addEventListener('custom-event')).not.toThrow();
  });

  it('removeEventListener does nothing when socket absent', () => {
    const { handler } = makeHandler();
    expect(() => handler.removeEventListener('custom-event')).not.toThrow();
  });

  it('setupDefaultEventListeners adds error and pong listeners to config', () => {
    const config = { ...DEFAULT_CONFIG, eventListeners: [] };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    const conn = new WebSocketConnection(config, logger);
    const handler = new WebSocketMessageHandler(config, logger, conn);
    handler.setupDefaultEventListeners();
    const events = config.eventListeners.map(l => l.event);
    expect(events).toContain('error');
    expect(events).toContain('pong');
  });
});
