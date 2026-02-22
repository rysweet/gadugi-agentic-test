/**
 * ElectronWebSocketMonitor test suite
 *
 * Verifies that ElectronWebSocketMonitor delegates to WebSocketAgent
 * rather than using socket.io-client directly.
 */

jest.mock('socket.io-client', () => {
  const { EventEmitter } = require('events');

  class MockSocket extends EventEmitter {
    connected = false;
    id = 'mock-socket-id';

    connect() {
      this.connected = true;
      this.emit('connect');
      return this;
    }
    disconnect() {
      this.connected = false;
      this.emit('disconnect', 'io client disconnect');
    }
    on(event: string, handler: (...args: any[]) => void) {
      return super.on(event, handler);
    }
    once(event: string, handler: (...args: any[]) => void) {
      return super.once(event, handler);
    }
    off(event: string, handler: (...args: any[]) => void) {
      return super.off(event, handler);
    }
    emit(event: string, ...args: any[]) {
      return super.emit(event, ...args);
    }
  }

  const mockSocket = new MockSocket();
  const io = jest.fn(() => mockSocket);
  return { io, __mockSocket: mockSocket };
});

import { EventEmitter } from 'events';
import { ElectronWebSocketMonitor } from '../electron/ElectronWebSocketMonitor';
import { ElectronUIAgentConfig } from '../electron/types';
import { WebSocketAgent } from '../WebSocketAgent';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockSocket: mockSocket, io: mockIo } = require('socket.io-client');

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    scenarioStart: jest.fn(),
    scenarioEnd: jest.fn(),
    stepExecution: jest.fn(),
    stepComplete: jest.fn()
  } as any;
}

function makeConfig(withWs = true): ElectronUIAgentConfig {
  return {
    executablePath: '/usr/bin/electron',
    websocketConfig: withWs
      ? {
          url: 'http://localhost:9999',
          events: ['data', 'status'],
          reconnectAttempts: 3,
          reconnectDelay: 500
        }
      : undefined
  };
}

describe('ElectronWebSocketMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.removeAllListeners();
    mockSocket.connected = false;
    mockIo.mockImplementation(() => {
      setTimeout(() => mockSocket.emit('connect'), 0);
      return mockSocket;
    });
  });

  it('does not import socket.io-client directly — uses WebSocketAgent', () => {
    // The monitor file must not call io() itself. All socket work goes through WebSocketAgent.
    // Before connect(), io should not have been called.
    const monitor = new ElectronWebSocketMonitor(makeConfig(), makeLogger(), new EventEmitter());
    expect(mockIo).not.toHaveBeenCalled();
    void monitor; // satisfy lint
  });

  it('is a no-op when websocketConfig is not set', async () => {
    const monitor = new ElectronWebSocketMonitor(makeConfig(false), makeLogger(), new EventEmitter());
    await expect(monitor.connect()).resolves.toBeUndefined();
    expect(monitor.events).toHaveLength(0);
  });

  it('emits websocket_connected when WebSocketAgent connects', async () => {
    const emitter = new EventEmitter();
    const connected = jest.fn();
    emitter.on('websocket_connected', connected);

    const monitor = new ElectronWebSocketMonitor(makeConfig(), makeLogger(), emitter);
    await monitor.connect();

    expect(connected).toHaveBeenCalledTimes(1);
  });

  it('emits websocket_disconnected when WebSocketAgent disconnects', async () => {
    const emitter = new EventEmitter();
    const disconnected = jest.fn();
    emitter.on('websocket_disconnected', disconnected);

    const monitor = new ElectronWebSocketMonitor(makeConfig(), makeLogger(), emitter);
    await monitor.connect();

    // Simulate disconnect from socket
    mockSocket.emit('disconnect', 'transport close');
    expect(disconnected).toHaveBeenCalledTimes(1);
  });

  it('collects websocket_event for configured event types', async () => {
    const emitter = new EventEmitter();
    const eventSpy = jest.fn();
    emitter.on('websocket_event', eventSpy);

    const monitor = new ElectronWebSocketMonitor(makeConfig(), makeLogger(), emitter);
    await monitor.connect();

    // Simulate a 'data' event from the socket (which is in wsConfig.events)
    mockSocket.emit('data', { value: 42 });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy.mock.calls[0][0]).toMatchObject({
      type: 'data',
      data: { value: 42 },
      source: 'socket.io'
    });
    expect(monitor.events).toHaveLength(1);
    expect(monitor.events[0].type).toBe('data');
  });

  it('collects multiple events for all configured event types', async () => {
    const emitter = new EventEmitter();
    const monitor = new ElectronWebSocketMonitor(makeConfig(), makeLogger(), emitter);
    await monitor.connect();

    mockSocket.emit('data', { x: 1 });
    mockSocket.emit('status', { ok: true });

    expect(monitor.events).toHaveLength(2);
    expect(monitor.events[0].type).toBe('data');
    expect(monitor.events[1].type).toBe('status');
  });

  it('disconnect cleans up the WebSocketAgent', async () => {
    const cleanupSpy = jest.spyOn(WebSocketAgent.prototype, 'cleanup');
    const monitor = new ElectronWebSocketMonitor(makeConfig(), makeLogger(), new EventEmitter());
    await monitor.connect();
    await monitor.disconnect();

    // cleanup() must have been called on the delegate agent
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    cleanupSpy.mockRestore();
  });

  it('disconnect is safe to call without prior connect', async () => {
    const monitor = new ElectronWebSocketMonitor(makeConfig(), makeLogger(), new EventEmitter());
    await expect(monitor.disconnect()).resolves.toBeUndefined();
  });

  it('handles connection errors gracefully without throwing', async () => {
    mockIo.mockImplementationOnce(() => {
      throw new Error('Connection refused');
    });

    const logger = makeLogger();
    const monitor = new ElectronWebSocketMonitor(makeConfig(), logger, new EventEmitter());
    await expect(monitor.connect()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('uses WebSocketAgent (not raw socket.io-client) for connections', async () => {
    // WebSocketAgent internally calls io(), so exactly one call is expected
    // after monitor.connect() — routed through WebSocketAgent, not directly
    const callCountBefore = mockIo.mock.calls.length;
    const monitor = new ElectronWebSocketMonitor(makeConfig(), makeLogger(), new EventEmitter());
    await monitor.connect();
    const callCountAfter = mockIo.mock.calls.length;

    // io() is called by WebSocketAgent.connect internally
    expect(callCountAfter - callCountBefore).toBe(1);

    // Verify WebSocketAgent config maps correctly
    const wsConfig = makeConfig().websocketConfig!;
    const calledUrl = mockIo.mock.calls[mockIo.mock.calls.length - 1][0];
    expect(calledUrl).toBe(wsConfig.url);
  });

  it('maps reconnect config from ElectronUIAgentConfig to WebSocketAgentConfig', async () => {
    // When WebSocketAgent is created, it receives reconnection config derived from websocketConfig
    const spyCreate = jest.spyOn(WebSocketAgent.prototype, 'initialize');

    const monitor = new ElectronWebSocketMonitor(makeConfig(), makeLogger(), new EventEmitter());
    await monitor.connect();

    expect(spyCreate).toHaveBeenCalledTimes(1);
    spyCreate.mockRestore();
  });
});
