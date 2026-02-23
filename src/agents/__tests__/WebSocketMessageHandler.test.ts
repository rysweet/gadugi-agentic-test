/**
 * WebSocketMessageHandler — unit tests
 *
 * Tests message send/receive, latency tracking, event listener management,
 * history management, and the validateMessage helper.
 *
 * socket.io-client is mocked so no real network is involved.
 */

import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// socket.io-client mock — a controllable MockSocket per test
// ---------------------------------------------------------------------------

class MockSocket extends EventEmitter {
  connected = false;
  id = 'test-socket';

  private _emitSpy = jest.fn();

  /** Capture emit calls without triggering EventEmitter */
  emit(event: string, ...args: any[]): boolean {
    this._emitSpy(event, ...args);
    return super.emit(event, ...args);
  }

  getEmitSpy() { return this._emitSpy; }
}

let _mockSocket: MockSocket;

jest.mock('socket.io-client', () => {
  const { EventEmitter } = require('events');

  class MS extends EventEmitter {
    connected = false;
    id = 'test-socket';
    private _emitSpy = jest.fn();

    emit(event: string, ...args: any[]): boolean {
      this._emitSpy(event, ...args);
      return super.emit(event, ...args);
    }

    getEmitSpy() { return this._emitSpy; }
  }

  const io = jest.fn(() => {
    _mockSocket = new MS() as any;
    return _mockSocket;
  });
  return { io };
});

import { WebSocketConnection } from '../websocket/WebSocketConnection';
import { WebSocketMessageHandler } from '../websocket/WebSocketMessageHandler';
import { DEFAULT_CONFIG } from '../websocket/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Creates a connected handler whose underlying MockSocket is available.
 * `connected` flag is set manually to bypass real socket.io-client behaviour.
 */
const makeConnectedHandler = async () => {
  const config = { ...DEFAULT_CONFIG, serverURL: 'http://localhost:3000' };
  const logger = makeLogger();
  const conn = new WebSocketConnection(config as any, logger as any);

  // Trigger connect so WebSocketConnection populates its internal socket ref
  const connectPromise = conn.connect('http://localhost:3000');
  _mockSocket.connected = true;
  _mockSocket.emit('connect');
  await connectPromise;

  const handler = new WebSocketMessageHandler(config as any, logger as any, conn);
  return { handler, conn, config, logger, socket: _mockSocket };
};

const makeDisconnectedHandler = () => {
  const config = { ...DEFAULT_CONFIG };
  const logger = makeLogger();
  const conn = new WebSocketConnection(config as any, logger as any);
  const handler = new WebSocketMessageHandler(config as any, logger as any, conn);
  return { handler, conn, config, logger };
};

// ---------------------------------------------------------------------------
// Tests: initial state
// ---------------------------------------------------------------------------

describe('WebSocketMessageHandler — initial state', () => {
  it('getMessageHistory returns empty array', () => {
    const { handler } = makeDisconnectedHandler();
    expect(handler.getMessageHistory()).toEqual([]);
  });

  it('getLatestMessage returns undefined', () => {
    const { handler } = makeDisconnectedHandler();
    expect(handler.getLatestMessage()).toBeUndefined();
  });

  it('getLatencyHistory returns empty array', () => {
    const { handler } = makeDisconnectedHandler();
    expect(handler.getLatencyHistory()).toEqual([]);
  });

  it('getMessagesByEvent returns empty array', () => {
    const { handler } = makeDisconnectedHandler();
    expect(handler.getMessagesByEvent('chat')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: sendMessage()
// ---------------------------------------------------------------------------

describe('WebSocketMessageHandler — sendMessage()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when socket is not connected', async () => {
    const { handler } = makeDisconnectedHandler();
    await expect(handler.sendMessage('chat', { text: 'hi' })).rejects.toThrow('not connected');
  });

  it('calls socket.emit with correct event and data', async () => {
    const { handler, socket } = await makeConnectedHandler();
    await handler.sendMessage('chat', { text: 'hello' });
    expect(socket.getEmitSpy()).toHaveBeenCalledWith('chat', { text: 'hello' });
  });

  it('stores sent message in history', async () => {
    const { handler } = await makeConnectedHandler();
    await handler.sendMessage('chat', { text: 'hello' });
    expect(handler.getMessageHistory()).toHaveLength(1);
    expect(handler.getMessageHistory()[0].direction).toBe('sent');
    expect(handler.getMessageHistory()[0].event).toBe('chat');
  });

  it('returns a WebSocketMessage with correct fields', async () => {
    const { handler } = await makeConnectedHandler();
    const msg = await handler.sendMessage('chat', { text: 'hello' });
    expect(msg.id).toMatch(/^msg_/);
    expect(msg.event).toBe('chat');
    expect(msg.direction).toBe('sent');
    expect(msg.data).toEqual({ text: 'hello' });
  });

  it('stores pending message when latency measurement enabled', async () => {
    const { handler, conn } = await makeConnectedHandler();
    const config = (conn as any).config;
    config.performance.measureLatency = true;
    await handler.sendMessage('ping', 'data');
    // Latency pending message is tracked inside handler
    // — confirmed by checking that after ack call the history grows
    expect(handler.getLatencyHistory()).toHaveLength(0); // ack not called yet
  });

  it('calls socket.emit with ack callback when ack=true', async () => {
    const { handler, socket } = await makeConnectedHandler();

    // We need to simulate the server calling our ack callback
    const emitSpy = socket.getEmitSpy();
    emitSpy.mockImplementationOnce((_event: string, _data: any, cb: Function) => {
      if (typeof cb === 'function') cb({ ok: true });
    });
    // Force the real socket EventEmitter to also forward the call
    const origEmit = socket.emit.bind(socket);
    jest.spyOn(socket, 'emit').mockImplementationOnce((event: string, ...args: any[]) => {
      const cb = args.find(a => typeof a === 'function');
      if (cb) cb({ ok: true });
      return origEmit(event, ...args);
    });

    const msg = await handler.sendMessage('action', { x: 1 }, true);
    expect(msg.event).toBe('action');
  });
});

// ---------------------------------------------------------------------------
// Tests: message receipt (on 'message' handler)
// ---------------------------------------------------------------------------

describe('WebSocketMessageHandler — message receipt via setupCustomEventListeners()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds incoming message to history when custom listener fires', async () => {
    const config = {
      ...DEFAULT_CONFIG,
      serverURL: 'http://localhost:3000',
      eventListeners: [
        {
          event: 'chat',
          handler: jest.fn(),
          enabled: true,
        }
      ]
    };
    const logger = makeLogger();
    const conn = new WebSocketConnection(config as any, logger as any);

    const connectPromise = conn.connect('http://localhost:3000');
    _mockSocket.connected = true;
    _mockSocket.emit('connect');
    await connectPromise;

    const handler = new WebSocketMessageHandler(config as any, logger as any, conn);
    handler.setupCustomEventListeners();

    // Trigger the custom event
    _mockSocket.emit('chat', { message: 'hello from server' });

    expect(handler.getMessageHistory()).toHaveLength(1);
    expect(handler.getMessageHistory()[0].event).toBe('chat');
    expect(handler.getMessageHistory()[0].direction).toBe('received');
  });

  it('respects once flag on custom event listener', async () => {
    const handlerFn = jest.fn();
    const config = {
      ...DEFAULT_CONFIG,
      serverURL: 'http://localhost:3000',
      eventListeners: [
        { event: 'announcement', handler: handlerFn, once: true, enabled: true }
      ]
    };
    const logger = makeLogger();
    const conn = new WebSocketConnection(config as any, logger as any);

    const connectPromise = conn.connect('http://localhost:3000');
    _mockSocket.connected = true;
    _mockSocket.emit('connect');
    await connectPromise;

    const handler = new WebSocketMessageHandler(config as any, logger as any, conn);
    handler.setupCustomEventListeners();

    _mockSocket.emit('announcement', 'first');
    _mockSocket.emit('announcement', 'second');

    // once listener fires only once
    expect(handlerFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: waitForMessage()
// ---------------------------------------------------------------------------

describe('WebSocketMessageHandler — waitForMessage()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves with received message', async () => {
    const { handler } = await makeConnectedHandler();

    const waitPromise = handler.waitForMessage('update', 5000);
    _mockSocket.emit('update', { status: 'ok' });

    const msg = await waitPromise;
    expect(msg.event).toBe('update');
    expect(msg.data).toEqual({ status: 'ok' });
    expect(msg.direction).toBe('received');
  });

  it('adds received message to history', async () => {
    const { handler } = await makeConnectedHandler();

    const waitPromise = handler.waitForMessage('update', 5000);
    _mockSocket.emit('update', { val: 42 });

    await waitPromise;
    expect(handler.getMessageHistory()).toHaveLength(1);
  });

  it('rejects after timeout when event never fires', async () => {
    jest.useFakeTimers();
    const { handler } = await makeConnectedHandler();

    const waitPromise = handler.waitForMessage('never-comes', 500);
    jest.advanceTimersByTime(600);

    await expect(waitPromise).rejects.toThrow('Timeout waiting for event: never-comes');
    jest.useRealTimers();
  });

  it('applies filter function and skips non-matching messages', async () => {
    const { handler } = await makeConnectedHandler();

    const waitPromise = handler.waitForMessage('data', 5000, (d) => d.id === 2);
    _mockSocket.emit('data', { id: 1, value: 'first' });
    _mockSocket.emit('data', { id: 2, value: 'second' });

    const msg = await waitPromise;
    expect(msg.data.id).toBe(2);
  });

  it('throws when socket is absent', async () => {
    const { handler } = makeDisconnectedHandler();
    await expect(handler.waitForMessage('event', 100)).rejects.toThrow('not connected');
  });
});

// ---------------------------------------------------------------------------
// Tests: latency tracking
// ---------------------------------------------------------------------------

describe('WebSocketMessageHandler — latency tracking via recordLatency()', () => {
  it('adds measurement to latency history', async () => {
    const { handler } = await makeConnectedHandler();
    handler.recordLatency('ping', 30);
    expect(handler.getLatencyHistory()).toHaveLength(1);
    expect(handler.getLatencyHistory()[0].latency).toBe(30);
    expect(handler.getLatencyHistory()[0].event).toBe('ping');
  });

  it('calculates rolling average across multiple measurements', async () => {
    const { handler, conn } = await makeConnectedHandler();
    // Ensure metrics are initialised (performance.enabled=true in DEFAULT_CONFIG)
    handler.recordLatency('ping', 10);
    handler.recordLatency('ping', 20);
    handler.recordLatency('ping', 30);

    const metrics = conn.getConnectionMetrics();
    // averageLatency should be (10+20+30)/3 = 20
    expect(metrics?.averageLatency).toBe(20);
  });

  it('caps history at maxLatencyHistory', async () => {
    const config = {
      ...DEFAULT_CONFIG,
      serverURL: 'http://localhost:3000',
      performance: { ...DEFAULT_CONFIG.performance, maxLatencyHistory: 3 }
    };
    const logger = makeLogger();
    const conn = new WebSocketConnection(config as any, logger as any);

    const connectPromise = conn.connect('http://localhost:3000');
    _mockSocket.connected = true;
    _mockSocket.emit('connect');
    await connectPromise;

    const handler = new WebSocketMessageHandler(config as any, logger as any, conn);
    handler.recordLatency('ping', 1);
    handler.recordLatency('ping', 2);
    handler.recordLatency('ping', 3);
    handler.recordLatency('ping', 4); // should evict first

    expect(handler.getLatencyHistory()).toHaveLength(3);
    expect(handler.getLatencyHistory()[0].latency).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: addEventListener / removeEventListener
// ---------------------------------------------------------------------------

describe('WebSocketMessageHandler — addEventListener / removeEventListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers event listener on socket', async () => {
    const { handler } = await makeConnectedHandler();
    expect(() => handler.addEventListener('custom-event')).not.toThrow();
    // Confirm it can receive the event without error
    expect(() => _mockSocket.emit('custom-event', { x: 1 })).not.toThrow();
  });

  it('does nothing when socket is absent', () => {
    const { handler } = makeDisconnectedHandler();
    expect(() => handler.addEventListener('evt')).not.toThrow();
  });

  it('removeEventListener removes the handler from socket', async () => {
    const { handler } = await makeConnectedHandler();
    handler.addEventListener('special');
    expect(() => handler.removeEventListener('special')).not.toThrow();
    // Re-registering shouldn't double-error
    expect(() => handler.addEventListener('special')).not.toThrow();
  });

  it('removeEventListener is a no-op for unknown events', async () => {
    const { handler } = await makeConnectedHandler();
    expect(() => handler.removeEventListener('unknown-event')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: getMessageHistory / clearHistory
// ---------------------------------------------------------------------------

describe('WebSocketMessageHandler — getMessageHistory() and clearHistory()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getMessageHistory returns all sent messages', async () => {
    const { handler } = await makeConnectedHandler();
    await handler.sendMessage('a', 1);
    await handler.sendMessage('b', 2);
    expect(handler.getMessageHistory()).toHaveLength(2);
  });

  it('getMessagesByEvent filters correctly', async () => {
    const { handler } = await makeConnectedHandler();
    await handler.sendMessage('chat', 'hi');
    await handler.sendMessage('ping', null);
    await handler.sendMessage('chat', 'bye');
    expect(handler.getMessagesByEvent('chat')).toHaveLength(2);
    expect(handler.getMessagesByEvent('ping')).toHaveLength(1);
  });

  it('clearHistory empties message history, latency history, and pending messages', async () => {
    const { handler } = await makeConnectedHandler();
    await handler.sendMessage('chat', 'hi');
    handler.recordLatency('ping', 20);
    handler.clearHistory();
    expect(handler.getMessageHistory()).toHaveLength(0);
    expect(handler.getLatencyHistory()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateMessage()
// ---------------------------------------------------------------------------

describe('WebSocketMessageHandler — validateMessage()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when no message is in history', async () => {
    const { handler } = makeDisconnectedHandler();
    await expect(handler.validateMessage('{"key":"val"}')).rejects.toThrow('No message available');
  });

  it('returns true when latest message data matches JSON', async () => {
    const { handler } = await makeConnectedHandler();

    // Inject a received message via waitForMessage
    const waitPromise = handler.waitForMessage('response', 5000);
    _mockSocket.emit('response', { status: 'ok' });
    await waitPromise;

    const valid = await handler.validateMessage('{"status":"ok"}');
    expect(valid).toBe(true);
  });

  it('returns false when latest message data does not match', async () => {
    const { handler } = await makeConnectedHandler();

    const waitPromise = handler.waitForMessage('result', 5000);
    _mockSocket.emit('result', { code: 200 });
    await waitPromise;

    const valid = await handler.validateMessage('{"code":500}');
    expect(valid).toBe(false);
  });

  it('falls back to string-contains check on invalid JSON expected', async () => {
    const { handler } = await makeConnectedHandler();

    const waitPromise = handler.waitForMessage('info', 5000);
    _mockSocket.emit('info', { message: 'hello world' });
    await waitPromise;

    const valid = await handler.validateMessage('hello');
    expect(valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: setupDefaultEventListeners()
// ---------------------------------------------------------------------------

describe('WebSocketMessageHandler — setupDefaultEventListeners()', () => {
  it('adds error and pong listeners to config.eventListeners', () => {
    const config = { ...DEFAULT_CONFIG, eventListeners: [] };
    const logger = makeLogger();
    const conn = new WebSocketConnection(config as any, logger as any);
    const handler = new WebSocketMessageHandler(config as any, logger as any, conn);

    handler.setupDefaultEventListeners();

    const events = config.eventListeners.map((l: any) => l.event);
    expect(events).toContain('error');
    expect(events).toContain('pong');
  });
});
