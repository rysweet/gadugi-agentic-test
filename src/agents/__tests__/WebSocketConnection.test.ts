/**
 * WebSocketConnection — unit tests
 *
 * All tests in this file work without a real network.  socket.io-client is
 * re-mocked here so we have fine-grained control over the MockSocket lifecycle
 * (connect, connect_error, disconnect, reconnect events).
 *
 * The global jest.mock('socket.io-client') in tests/setup.ts installs a
 * minimal auto-mock; this module-level override replaces it for this file.
 */

import { EventEmitter } from 'events';

// ---- local MockSocket factory ------------------------------------------------

class MockSocket extends EventEmitter {
  connected = false;
  id = 'mock-socket-id';

  disconnect() {
    this.connected = false;
    this.emit('disconnect', 'io client disconnect');
  }
  // allow tests to trigger connect programmatically
  simulateConnect() {
    this.connected = true;
    this.emit('connect');
  }
  simulateConnectError(err: Error) {
    this.connected = false;
    this.emit('connect_error', err);
  }
  simulateReconnect(attempt: number) {
    this.connected = true;
    this.emit('reconnect', attempt);
  }
  simulateReconnectAttempt(attempt: number) {
    this.emit('reconnect_attempt', attempt);
  }
}

let currentMockSocket: MockSocket;

jest.mock('socket.io-client', () => {
  const { EventEmitter } = require('events');

  class MS extends EventEmitter {
    connected = false;
    id = 'mock-socket-id';
    disconnect() {
      this.connected = false;
      this.emit('disconnect', 'io client disconnect');
    }
  }

  const io = jest.fn((_url: string, _opts?: any) => {
    currentMockSocket = new MS() as any;
    return currentMockSocket;
  });
  return { io };
});

import { WebSocketConnection } from '../websocket/WebSocketConnection';
import { ConnectionState, DEFAULT_CONFIG } from '../websocket/types';

// ---- helpers -----------------------------------------------------------------

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeConn = (overrides: Record<string, unknown> = {}) => {
  const config = { ...DEFAULT_CONFIG, serverURL: 'http://localhost:3000', ...overrides };
  const logger = makeLogger();
  return { conn: new WebSocketConnection(config as any, logger as any), logger };
};

// ---- tests -------------------------------------------------------------------

describe('WebSocketConnection — initial state', () => {
  it('getConnectionState returns DISCONNECTED before any connect call', () => {
    const { conn } = makeConn();
    expect(conn.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
  });

  it('isConnected returns false before connect', () => {
    const { conn } = makeConn();
    expect(conn.isConnected()).toBe(false);
  });

  it('getSocket returns undefined before connect', () => {
    const { conn } = makeConn();
    expect(conn.getSocket()).toBeUndefined();
  });

  it('getConnectionInfo returns undefined before connect', () => {
    const { conn } = makeConn();
    expect(conn.getConnectionInfo()).toBeUndefined();
  });

  it('getConnectionMetrics returns undefined before connect', () => {
    const { conn } = makeConn();
    expect(conn.getConnectionMetrics()).toBeUndefined();
  });

  it('getPendingMessages returns empty map', () => {
    const { conn } = makeConn();
    expect(conn.getPendingMessages().size).toBe(0);
  });

  it('getLatencyHistory returns empty array', () => {
    const { conn } = makeConn();
    expect(conn.getLatencyHistory()).toEqual([]);
  });
});

describe('WebSocketConnection — connect()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls io() with the provided URL', async () => {
    const { conn } = makeConn();
    const ioMock = require('socket.io-client').io as jest.Mock;

    const connectPromise = conn.connect('http://localhost:4000');
    // Simulate socket connecting
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');

    await connectPromise;
    expect(ioMock).toHaveBeenCalledWith('http://localhost:4000', expect.any(Object));
  });

  it('calls io() with the config serverURL when no URL argument given', async () => {
    const { conn } = makeConn({ serverURL: 'http://config-host:9000' });
    const ioMock = require('socket.io-client').io as jest.Mock;

    const connectPromise = conn.connect();
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');

    await connectPromise;
    expect(ioMock).toHaveBeenCalledWith('http://config-host:9000', expect.any(Object));
  });

  it('transitions state to CONNECTED on successful connect', async () => {
    const { conn } = makeConn();

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');

    await connectPromise;
    expect(conn.getConnectionState()).toBe(ConnectionState.CONNECTED);
  });

  it('emits "connected" event on successful connect', async () => {
    const { conn } = makeConn();
    const listener = jest.fn();
    conn.on('connected', listener);

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');

    await connectPromise;
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rejects with connection error and emits "error" event on connect_error', async () => {
    const { conn } = makeConn();
    const errorListener = jest.fn();
    conn.on('error', errorListener);

    const connectPromise = conn.connect('http://localhost:3000');
    const err = new Error('ECONNREFUSED');
    currentMockSocket.emit('connect_error', err);

    await expect(connectPromise).rejects.toThrow('ECONNREFUSED');
    expect(errorListener).toHaveBeenCalledWith(err);
  });

  it('sets connection state to ERROR on connect_error', async () => {
    const { conn } = makeConn();
    // Suppress unhandled 'error' event from EventEmitter
    conn.on('error', () => { /* suppress */ });

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.emit('connect_error', new Error('Network error'));

    await connectPromise.catch(() => {/* expected */});
    expect(conn.getConnectionState()).toBe(ConnectionState.ERROR);
  });

  it('rejects with timeout error when connection does not establish', async () => {
    jest.useFakeTimers();
    const { conn } = makeConn({ connectionTimeout: 500 });

    const connectPromise = conn.connect('http://localhost:3000');
    jest.advanceTimersByTime(600);

    await expect(connectPromise).rejects.toThrow('Connection timeout after 500ms');
    jest.useRealTimers();
  });

  it('skips io() call and returns early when already connected', async () => {
    const { conn, logger } = makeConn();
    const ioMock = require('socket.io-client').io as jest.Mock;

    // First connect
    const first = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await first;

    ioMock.mockClear();

    // Second connect should short-circuit
    await conn.connect('http://localhost:3000');
    expect(ioMock).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Already connected')
    );
  });

  it('throws when serverURL is missing', async () => {
    const { conn } = makeConn({ serverURL: '' });
    await expect(conn.connect()).rejects.toThrow('Server URL is required');
  });

  it('populates connectionInfo after connect', async () => {
    const { conn } = makeConn();

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    const info = conn.getConnectionInfo();
    expect(info).toBeDefined();
    expect(info!.url).toBe('http://localhost:3000');
    expect(info!.state).toBe(ConnectionState.CONNECTED);
    expect(info!.connectTime).toBeInstanceOf(Date);
  });
});

describe('WebSocketConnection — disconnect()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves without error when not connected', async () => {
    const { conn } = makeConn();
    await expect(conn.disconnect()).resolves.toBeUndefined();
  });

  it('calls socket.disconnect() and clears socket reference', async () => {
    const { conn } = makeConn();

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    expect(conn.getSocket()).toBeDefined();
    await conn.disconnect();
    expect(conn.getSocket()).toBeUndefined();
  });

  it('sets state to DISCONNECTED after disconnect', async () => {
    const { conn } = makeConn();

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    await conn.disconnect();
    expect(conn.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
  });

  it('emits "disconnected" event when socket fires disconnect', async () => {
    const { conn } = makeConn();
    const listener = jest.fn();
    conn.on('disconnected', listener);

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    currentMockSocket.emit('disconnect', 'transport close');
    expect(listener).toHaveBeenCalledWith('transport close');
  });

  it('sets disconnectTime on connectionInfo after disconnect', async () => {
    const { conn } = makeConn();

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    await conn.disconnect();
    expect(conn.getConnectionInfo()!.disconnectTime).toBeInstanceOf(Date);
  });
});

describe('WebSocketConnection — reconnect events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits "reconnecting" on reconnect_attempt and sets state RECONNECTING', async () => {
    const { conn } = makeConn();
    const listener = jest.fn();
    conn.on('reconnecting', listener);

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    currentMockSocket.emit('reconnect_attempt', 1);
    expect(listener).toHaveBeenCalledWith(1);
    expect(conn.getConnectionState()).toBe(ConnectionState.RECONNECTING);
  });

  it('emits "reconnected" on reconnect and restores CONNECTED state', async () => {
    const { conn } = makeConn();
    const listener = jest.fn();
    conn.on('reconnected', listener);

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    currentMockSocket.emit('reconnect', 2);
    expect(listener).toHaveBeenCalledWith(2);
    expect(conn.getConnectionState()).toBe(ConnectionState.CONNECTED);
    expect(conn.getConnectionInfo()!.reconnectCount).toBe(2);
  });
});

describe('WebSocketConnection — authentication injection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('injects token auth into socketOptions.auth', async () => {
    const ioMock = require('socket.io-client').io as jest.Mock;
    const { conn } = makeConn({
      auth: { type: 'token', token: 'Bearer secret' }
    });

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    const opts = ioMock.mock.calls[0][1];
    expect(opts.auth).toEqual({ token: 'Bearer secret' });
  });

  it('injects query-param auth into socketOptions.query', async () => {
    const ioMock = require('socket.io-client').io as jest.Mock;
    const { conn } = makeConn({
      auth: { type: 'query', queryParam: 'api_key', token: 'mykey' }
    });

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    const opts = ioMock.mock.calls[0][1];
    expect(opts.query).toMatchObject({ api_key: 'mykey' });
  });

  it('injects header auth into socketOptions.extraHeaders', async () => {
    const ioMock = require('socket.io-client').io as jest.Mock;
    const { conn } = makeConn({
      auth: { type: 'header', headerName: 'X-API-Token', token: 'tok123' }
    });

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    const opts = ioMock.mock.calls[0][1];
    expect(opts.extraHeaders).toMatchObject({ 'X-API-Token': 'tok123' });
  });

  it('merges custom auth fields into socketOptions', async () => {
    const ioMock = require('socket.io-client').io as jest.Mock;
    const { conn } = makeConn({
      auth: { type: 'custom', customAuth: { apiKey: 'custom-key', orgId: 'org-1' } }
    });

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    const opts = ioMock.mock.calls[0][1];
    expect(opts).toMatchObject({ apiKey: 'custom-key', orgId: 'org-1' });
  });
});

describe('WebSocketConnection — validateServerURL()', () => {
  it('accepts http:// URLs', () => {
    const { conn } = makeConn();
    expect(() => conn.validateServerURL('http://localhost:3000')).not.toThrow();
  });

  it('accepts https:// URLs', () => {
    const { conn } = makeConn();
    expect(() => conn.validateServerURL('https://example.com')).not.toThrow();
  });

  it('accepts ws:// URLs', () => {
    const { conn } = makeConn();
    expect(() => conn.validateServerURL('ws://localhost:3000')).not.toThrow();
  });

  it('accepts wss:// URLs', () => {
    const { conn } = makeConn();
    expect(() => conn.validateServerURL('wss://example.com')).not.toThrow();
  });

  it('rejects ftp:// protocol', () => {
    const { conn } = makeConn();
    expect(() => conn.validateServerURL('ftp://example.com')).toThrow('Invalid server URL');
  });

  it('rejects plain strings that are not URLs', () => {
    const { conn } = makeConn();
    expect(() => conn.validateServerURL('not-a-url')).toThrow('Invalid server URL');
  });
});

describe('WebSocketConnection — performance monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initialises connectionMetrics when performance.enabled is true', async () => {
    const { conn } = makeConn({
      performance: { enabled: true, measureLatency: false, maxLatencyHistory: 100 }
    });

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    expect(conn.getConnectionMetrics()).toBeDefined();
  });

  it('does not initialise connectionMetrics when performance.enabled is false', async () => {
    const { conn } = makeConn({
      performance: { enabled: false, measureLatency: false, maxLatencyHistory: 100 }
    });

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    expect(conn.getConnectionMetrics()).toBeUndefined();
  });

  it('updateLatencyMetrics updates lastLatency and averageLatency', async () => {
    const { conn } = makeConn({
      performance: { enabled: true, measureLatency: false, maxLatencyHistory: 100 }
    });

    const connectPromise = conn.connect('http://localhost:3000');
    currentMockSocket.connected = true;
    currentMockSocket.emit('connect');
    await connectPromise;

    conn.updateLatencyMetrics(42, 38);
    const metrics = conn.getConnectionMetrics()!;
    expect(metrics.lastLatency).toBe(42);
    expect(metrics.averageLatency).toBe(38);
  });

  it('updateLatencyMetrics is a no-op when metrics not initialised', () => {
    const { conn } = makeConn({
      performance: { enabled: false, measureLatency: false, maxLatencyHistory: 100 }
    });
    expect(() => conn.updateLatencyMetrics(10, 10)).not.toThrow();
  });
});
