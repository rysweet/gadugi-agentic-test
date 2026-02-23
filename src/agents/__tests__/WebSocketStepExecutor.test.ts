/**
 * WebSocketStepExecutor — unit tests
 *
 * Mocks WebSocketConnection and WebSocketMessageHandler so no network is
 * used.  Tests every branch in the dispatch() switch, plus the executeStep
 * wrapper error-catching.
 */

import { WebSocketStepExecutor } from '../websocket/WebSocketStepExecutor';
import { WebSocketConnection } from '../websocket/WebSocketConnection';
import { WebSocketMessageHandler } from '../websocket/WebSocketMessageHandler';
import { WebSocketEventRecorder } from '../websocket/WebSocketEventRecorder';
import { ConnectionState, DEFAULT_CONFIG } from '../websocket/types';
import { TestStatus } from '../../models/TestModels';

// socket.io-client is mocked globally via tests/setup.ts

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stepExecution: jest.fn(),
  stepComplete: jest.fn(),
});

interface ExecutorFixture {
  executor: WebSocketStepExecutor;
  connectFn: jest.Mock;
  disconnectFn: jest.Mock;
  connectionMock: jest.Mocked<Partial<WebSocketConnection>>;
  handlerMock: jest.Mocked<Partial<WebSocketMessageHandler>>;
  recorderMock: jest.Mocked<Partial<WebSocketEventRecorder>>;
}

const makeExecutor = (): ExecutorFixture => {
  const config = { ...DEFAULT_CONFIG };
  const logger = makeLogger();

  // Real instances so TypeScript is happy, but key methods are spied/mocked below
  const conn = new WebSocketConnection(config as any, logger as any);
  const handler = new WebSocketMessageHandler(config as any, logger as any, conn);
  const recorder = new WebSocketEventRecorder(config as any, logger as any);

  const connectFn = jest.fn().mockResolvedValue(undefined);
  const disconnectFn = jest.fn().mockResolvedValue(undefined);

  // Spy on methods used by the executor
  jest.spyOn(conn, 'isConnected').mockReturnValue(false);
  jest.spyOn(conn, 'getConnectionState').mockReturnValue(ConnectionState.DISCONNECTED);
  jest.spyOn(handler, 'sendMessage').mockResolvedValue({
    id: 'msg_1', event: 'test', data: null, timestamp: new Date(), direction: 'sent'
  });
  jest.spyOn(handler, 'waitForMessage').mockResolvedValue({
    id: 'msg_2', event: 'update', data: { ok: true }, timestamp: new Date(), direction: 'received'
  });
  jest.spyOn(handler, 'validateMessage').mockResolvedValue(true);
  jest.spyOn(handler, 'addEventListener').mockImplementation(() => { /* no-op */ });
  jest.spyOn(handler, 'removeEventListener').mockImplementation(() => { /* no-op */ });
  jest.spyOn(handler, 'pingServer').mockResolvedValue(25);
  jest.spyOn(recorder, 'setAuthentication').mockImplementation(() => { /* no-op */ });

  const executor = new WebSocketStepExecutor(conn, handler, recorder, connectFn, disconnectFn);

  return {
    executor,
    connectFn,
    disconnectFn,
    connectionMock: conn as any,
    handlerMock: handler as any,
    recorderMock: recorder as any,
  };
};

const step = (action: string, target = '', value?: string, extra?: Record<string, any>) =>
  ({ action, target, value, ...extra } as any);

// ---------------------------------------------------------------------------
// Tests: connect action
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — connect action', () => {
  it('calls connectFn with step.target as URL', async () => {
    const { executor, connectFn } = makeExecutor();
    const result = await executor.executeStep(step('connect', 'http://localhost:4000'), 0);
    expect(connectFn).toHaveBeenCalledWith('http://localhost:4000');
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('calls connectFn with undefined when target is empty', async () => {
    const { executor, connectFn } = makeExecutor();
    await executor.executeStep(step('connect', ''), 0);
    expect(connectFn).toHaveBeenCalledWith(undefined);
  });

  it('returns FAILED when connectFn rejects', async () => {
    const { executor, connectFn } = makeExecutor();
    connectFn.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await executor.executeStep(step('connect', 'http://bad'), 0);
    expect(result.status).toBe(TestStatus.FAILED);
    expect(result.error).toContain('Connection refused');
  });

  it('is case-insensitive for "CONNECT"', async () => {
    const { executor, connectFn } = makeExecutor();
    await executor.executeStep(step('CONNECT', 'http://host'), 0);
    expect(connectFn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: disconnect action
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — disconnect action', () => {
  it('calls disconnectFn', async () => {
    const { executor, disconnectFn } = makeExecutor();
    const result = await executor.executeStep(step('disconnect'), 0);
    expect(disconnectFn).toHaveBeenCalled();
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('returns FAILED when disconnectFn rejects', async () => {
    const { executor, disconnectFn } = makeExecutor();
    disconnectFn.mockRejectedValueOnce(new Error('Not connected'));
    const result = await executor.executeStep(step('disconnect'), 0);
    expect(result.status).toBe(TestStatus.FAILED);
  });
});

// ---------------------------------------------------------------------------
// Tests: send / emit actions
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — send / emit actions', () => {
  it('"send" calls handler.sendMessage with parsed JSON data', async () => {
    const { executor, handlerMock } = makeExecutor();
    const result = await executor.executeStep(
      step('send', 'chat', JSON.stringify({ data: { text: 'hello' } })),
      0
    );
    expect(handlerMock.sendMessage).toHaveBeenCalledWith(
      'chat',
      { text: 'hello' },
      false
    );
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('"emit" is an alias for "send"', async () => {
    const { executor, handlerMock } = makeExecutor();
    await executor.executeStep(step('emit', 'event', '{"data":"x"}'), 0);
    expect(handlerMock.sendMessage).toHaveBeenCalledWith('event', 'x', false);
  });

  it('sends raw string value when JSON parse fails', async () => {
    const { executor, handlerMock } = makeExecutor();
    await executor.executeStep(step('send', 'raw', 'not-json'), 0);
    expect(handlerMock.sendMessage).toHaveBeenCalledWith('raw', 'not-json', false);
  });

  it('sends with ack=true when value contains ack:true', async () => {
    const { executor, handlerMock } = makeExecutor();
    await executor.executeStep(step('send', 'action', JSON.stringify({ data: 1, ack: true })), 0);
    expect(handlerMock.sendMessage).toHaveBeenCalledWith('action', 1, true);
  });

  it('sends undefined data when no value provided', async () => {
    const { executor, handlerMock } = makeExecutor();
    await executor.executeStep(step('send', 'ping', undefined), 0);
    expect(handlerMock.sendMessage).toHaveBeenCalledWith('ping', undefined, false);
  });
});

// ---------------------------------------------------------------------------
// Tests: wait_for_message / wait_for_event actions
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — wait_for_message / wait_for_event', () => {
  it('"wait_for_message" calls handler.waitForMessage', async () => {
    const { executor, handlerMock } = makeExecutor();
    const result = await executor.executeStep(
      step('wait_for_message', 'update', undefined, { timeout: 3000 }),
      1
    );
    expect(handlerMock.waitForMessage).toHaveBeenCalledWith('update', 3000, undefined);
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('"wait_for_event" is an alias for "wait_for_message"', async () => {
    const { executor, handlerMock } = makeExecutor();
    await executor.executeStep(step('wait_for_event', 'evt'), 0);
    expect(handlerMock.waitForMessage).toHaveBeenCalled();
  });

  it('passes filter function when value has filter key', async () => {
    const { executor, handlerMock } = makeExecutor();
    await executor.executeStep(
      step('wait_for_message', 'data', JSON.stringify({ filter: 'success' })),
      0
    );
    const callArgs = (handlerMock.waitForMessage as jest.Mock).mock.calls[0];
    expect(typeof callArgs[2]).toBe('function');
    // Verify filter works
    expect(callArgs[2]({ result: 'success' })).toBe(true);
    expect(callArgs[2]({ result: 'failure' })).toBe(false);
  });

  it('passes string-contains filter when value is not valid JSON', async () => {
    const { executor, handlerMock } = makeExecutor();
    await executor.executeStep(
      step('wait_for_message', 'info', 'hello'),
      0
    );
    const callArgs = (handlerMock.waitForMessage as jest.Mock).mock.calls[0];
    expect(typeof callArgs[2]).toBe('function');
    expect(callArgs[2]({ message: 'hello world' })).toBe(true);
    expect(callArgs[2]({ message: 'nope' })).toBe(false);
  });

  it('uses default timeout of 10000 when step.timeout not provided', async () => {
    const { executor, handlerMock } = makeExecutor();
    await executor.executeStep(step('wait_for_message', 'evt'), 0);
    const callArgs = (handlerMock.waitForMessage as jest.Mock).mock.calls[0];
    expect(callArgs[1]).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// Tests: validate_message action
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — validate_message action', () => {
  it('calls handler.validateMessage with step.expected', async () => {
    const { executor, handlerMock } = makeExecutor();
    const result = await executor.executeStep(
      step('validate_message', '', undefined, { expected: '{"status":"ok"}' }),
      0
    );
    expect(handlerMock.validateMessage).toHaveBeenCalledWith('{"status":"ok"}');
    expect(result.status).toBe(TestStatus.PASSED);
    expect(result.actualResult).toBe('true');
  });

  it('falls back to step.value when expected is absent', async () => {
    const { executor, handlerMock } = makeExecutor();
    await executor.executeStep(step('validate_message', '', '{"code":200}'), 0);
    expect(handlerMock.validateMessage).toHaveBeenCalledWith('{"code":200}');
  });
});

// ---------------------------------------------------------------------------
// Tests: validate_connection action
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — validate_connection action', () => {
  it('returns false when not connected', async () => {
    const { executor } = makeExecutor();
    const result = await executor.executeStep(step('validate_connection'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(result.actualResult).toBe('false');
  });

  it('returns true when connected', async () => {
    const { executor, connectionMock } = makeExecutor();
    (connectionMock.isConnected as jest.Mock).mockReturnValue(true);
    (connectionMock.getConnectionState as jest.Mock).mockReturnValue(ConnectionState.CONNECTED);

    const result = await executor.executeStep(step('validate_connection'), 0);
    expect(result.actualResult).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Tests: add_listener / remove_listener actions
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — add_listener / remove_listener', () => {
  it('"add_listener" calls handler.addEventListener', async () => {
    const { executor, handlerMock } = makeExecutor();
    const result = await executor.executeStep(
      step('add_listener', 'my-event', 'function() {}'),
      0
    );
    expect(handlerMock.addEventListener).toHaveBeenCalledWith('my-event', 'function() {}');
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('"remove_listener" calls handler.removeEventListener', async () => {
    const { executor, handlerMock } = makeExecutor();
    const result = await executor.executeStep(step('remove_listener', 'my-event'), 0);
    expect(handlerMock.removeEventListener).toHaveBeenCalledWith('my-event');
    expect(result.status).toBe(TestStatus.PASSED);
  });
});

// ---------------------------------------------------------------------------
// Tests: ping action
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — ping action', () => {
  it('calls handler.pingServer and returns latency', async () => {
    const { executor, handlerMock } = makeExecutor();
    const result = await executor.executeStep(step('ping'), 0);
    expect(handlerMock.pingServer).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(TestStatus.PASSED);
    expect(result.actualResult).toBe('25');
  });
});

// ---------------------------------------------------------------------------
// Tests: wait action
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — wait action', () => {
  it('resolves after specified delay', async () => {
    jest.useFakeTimers();
    const { executor } = makeExecutor();
    const resultPromise = executor.executeStep(step('wait', '', '50'), 0);
    jest.advanceTimersByTime(100);
    const result = await resultPromise;
    expect(result.status).toBe(TestStatus.PASSED);
    jest.useRealTimers();
  });

  it('uses 1000ms default when value is not provided', async () => {
    jest.useFakeTimers();
    const { executor } = makeExecutor();
    const resultPromise = executor.executeStep(step('wait', '', undefined), 0);
    jest.advanceTimersByTime(1500);
    const result = await resultPromise;
    expect(result.status).toBe(TestStatus.PASSED);
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Tests: set_auth action
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — set_auth action', () => {
  it('calls recorder.setAuthentication with step.target and step.value', async () => {
    const { executor, recorderMock } = makeExecutor();
    const result = await executor.executeStep(step('set_auth', 'token', 'mytoken'), 0);
    expect(recorderMock.setAuthentication).toHaveBeenCalledWith('token', 'mytoken');
    expect(result.status).toBe(TestStatus.PASSED);
  });
});

// ---------------------------------------------------------------------------
// Tests: unknown action
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — unknown action', () => {
  it('returns FAILED status with error containing action name', async () => {
    const { executor } = makeExecutor();
    const result = await executor.executeStep(step('fly_to_moon'), 0);
    expect(result.status).toBe(TestStatus.FAILED);
    expect(result.error).toContain('fly_to_moon');
    expect(result.error).toContain('Unsupported WebSocket action');
  });

  it('records non-zero duration even for failed steps', async () => {
    const { executor } = makeExecutor();
    const result = await executor.executeStep(step('bad_action'), 0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: executeStep wrapper (stepIndex propagation)
// ---------------------------------------------------------------------------

describe('WebSocketStepExecutor — executeStep wrapper', () => {
  it('propagates stepIndex to result', async () => {
    const { executor } = makeExecutor();
    const result = await executor.executeStep(step('disconnect'), 7);
    expect(result.stepIndex).toBe(7);
  });

  it('records duration on successful steps', async () => {
    const { executor } = makeExecutor();
    const result = await executor.executeStep(step('disconnect'), 0);
    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('result.actualResult serialises non-string return values as JSON', async () => {
    const { executor } = makeExecutor();
    // connect returns boolean true
    const result = await executor.executeStep(step('connect', 'http://localhost'), 0);
    expect(result.actualResult).toBe('true');
  });
});
