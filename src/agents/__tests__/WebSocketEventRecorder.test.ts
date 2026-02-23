/**
 * WebSocketEventRecorder — unit tests
 *
 * Covers: record(), getRecordedEvents(), clear(), setAuthentication(),
 * and applyEnvironmentConfig().
 *
 * No network or socket.io-client interaction required.
 */

import { WebSocketEventRecorder, RecordedEvent } from '../websocket/WebSocketEventRecorder';
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

const makeRecorder = (configOverrides: Record<string, unknown> = {}) => {
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  const logger = makeLogger();
  return { recorder: new WebSocketEventRecorder(config as any, logger as any), config, logger };
};

// ---------------------------------------------------------------------------
// Tests: record() and getRecordedEvents()
// ---------------------------------------------------------------------------

describe('WebSocketEventRecorder — record() and getRecordedEvents()', () => {
  it('stores a connection event with timestamp', () => {
    const { recorder } = makeRecorder();
    recorder.record('connection', 'connect');

    const events = recorder.getRecordedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('connection');
    expect(events[0].event).toBe('connect');
    expect(events[0].timestamp).toBeInstanceOf(Date);
  });

  it('stores a message event with data', () => {
    const { recorder } = makeRecorder();
    recorder.record('message', 'chat', { text: 'hello' });

    const events = recorder.getRecordedEvents();
    expect(events[0].data).toEqual({ text: 'hello' });
  });

  it('stores an error event', () => {
    const { recorder } = makeRecorder();
    recorder.record('error', 'connect_error', new Error('refused'));

    const events = recorder.getRecordedEvents();
    expect(events[0].type).toBe('error');
    expect(events[0].event).toBe('connect_error');
  });

  it('accumulates multiple events in order', () => {
    const { recorder } = makeRecorder();
    recorder.record('connection', 'connect');
    recorder.record('message', 'chat', 'hi');
    recorder.record('error', 'disconnect', 'reason');

    const events = recorder.getRecordedEvents();
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('connection');
    expect(events[1].type).toBe('message');
    expect(events[2].type).toBe('error');
  });

  it('getRecordedEvents returns a copy — mutations do not affect internal state', () => {
    const { recorder } = makeRecorder();
    recorder.record('connection', 'connect');

    const events = recorder.getRecordedEvents();
    events.pop(); // mutate the copy

    expect(recorder.getRecordedEvents()).toHaveLength(1); // original unchanged
  });

  it('data field is undefined when not provided', () => {
    const { recorder } = makeRecorder();
    recorder.record('connection', 'connect');

    expect(recorder.getRecordedEvents()[0].data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: clear()
// ---------------------------------------------------------------------------

describe('WebSocketEventRecorder — clear()', () => {
  it('empties the recorded events array', () => {
    const { recorder } = makeRecorder();
    recorder.record('message', 'ping');
    recorder.record('message', 'pong');
    recorder.clear();

    expect(recorder.getRecordedEvents()).toHaveLength(0);
  });

  it('can be called on an empty recorder without error', () => {
    const { recorder } = makeRecorder();
    expect(() => recorder.clear()).not.toThrow();
  });

  it('allows recording again after clearing', () => {
    const { recorder } = makeRecorder();
    recorder.record('connection', 'connect');
    recorder.clear();
    recorder.record('message', 'chat', 'hello');

    expect(recorder.getRecordedEvents()).toHaveLength(1);
    expect(recorder.getRecordedEvents()[0].event).toBe('chat');
  });
});

// ---------------------------------------------------------------------------
// Tests: setAuthentication()
// ---------------------------------------------------------------------------

describe('WebSocketEventRecorder — setAuthentication()', () => {
  it('sets token auth type and value', () => {
    const { recorder, config } = makeRecorder();
    recorder.setAuthentication('token', 'mytoken123');
    expect(config.auth).toEqual({ type: 'token', token: 'mytoken123' });
  });

  it('sets token auth with undefined value', () => {
    const { recorder, config } = makeRecorder();
    recorder.setAuthentication('token');
    expect(config.auth).toEqual({ type: 'token', token: undefined });
  });

  it('sets query auth and splits param:token', () => {
    const { recorder, config } = makeRecorder();
    recorder.setAuthentication('query', 'api_key:secret123');
    expect(config.auth).toMatchObject({
      type: 'query',
      queryParam: 'api_key',
      token: 'secret123'
    });
  });

  it('sets query auth with no colon separator — entire value becomes queryParam', () => {
    // Implementation: split(':', 1) gives the entire string as param when no colon present
    const { recorder, config } = makeRecorder();
    recorder.setAuthentication('query', 'justtoken');
    expect(config.auth).toMatchObject({
      type: 'query',
      queryParam: 'justtoken',
    });
  });

  it('sets header auth and splits header:token', () => {
    const { recorder, config } = makeRecorder();
    recorder.setAuthentication('header', 'Authorization:Bearer abc');
    expect(config.auth).toMatchObject({
      type: 'header',
      headerName: 'Authorization',
      token: 'Bearer abc'
    });
  });

  it('sets header auth — entire value becomes headerName when no colon present', () => {
    // Implementation: split(':') with no colon uses the whole string as the header name
    const { recorder, config } = makeRecorder();
    recorder.setAuthentication('header', 'mytoken');
    expect(config.auth).toMatchObject({
      type: 'header',
      headerName: 'mytoken',
    });
  });

  it('is case-insensitive for auth type', () => {
    const { recorder, config } = makeRecorder();
    recorder.setAuthentication('TOKEN', 'abc');
    expect(config.auth.type).toBe('token');
  });

  it('throws on unsupported auth type', () => {
    const { recorder } = makeRecorder();
    expect(() => recorder.setAuthentication('oauth2')).toThrow('Unsupported WebSocket authentication type: oauth2');
  });

  it('logs debug message on successful setAuthentication', () => {
    const { recorder, logger } = makeRecorder();
    recorder.setAuthentication('token', 'val');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('token')
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: applyEnvironmentConfig()
// ---------------------------------------------------------------------------

describe('WebSocketEventRecorder — applyEnvironmentConfig()', () => {
  it('sets serverURL from WS_SERVER_URL', () => {
    const { recorder, config } = makeRecorder();
    recorder.applyEnvironmentConfig({ WS_SERVER_URL: 'http://env-server:5000' }, jest.fn());
    expect(config.serverURL).toBe('http://env-server:5000');
  });

  it('sets namespace from WS_NAMESPACE', () => {
    const { recorder, config } = makeRecorder();
    recorder.applyEnvironmentConfig({ WS_NAMESPACE: '/ws' }, jest.fn());
    expect(config.namespace).toBe('/ws');
  });

  it('calls setAuthentication callback with token from WS_AUTH_TOKEN', () => {
    const { recorder } = makeRecorder();
    const setAuthFn = jest.fn();
    recorder.applyEnvironmentConfig({ WS_AUTH_TOKEN: 'env-token-xyz' }, setAuthFn);
    expect(setAuthFn).toHaveBeenCalledWith('token', 'env-token-xyz');
  });

  it('ignores non-WS_ prefixed keys', () => {
    const { recorder, config } = makeRecorder();
    const originalServerURL = config.serverURL;
    recorder.applyEnvironmentConfig({ SOME_OTHER_VAR: 'value', APP_ENV: 'production' }, jest.fn());
    expect(config.serverURL).toBe(originalServerURL);
  });

  it('handles empty environment object', () => {
    const { recorder } = makeRecorder();
    expect(() => recorder.applyEnvironmentConfig({}, jest.fn())).not.toThrow();
  });

  it('applies multiple WS_ vars in a single call', () => {
    const { recorder, config } = makeRecorder();
    recorder.applyEnvironmentConfig(
      { WS_SERVER_URL: 'http://multi:8080', WS_NAMESPACE: '/multi' },
      jest.fn()
    );
    expect(config.serverURL).toBe('http://multi:8080');
    expect(config.namespace).toBe('/multi');
  });

  it('does not call setAuthentication when WS_AUTH_TOKEN is absent', () => {
    const { recorder } = makeRecorder();
    const setAuthFn = jest.fn();
    recorder.applyEnvironmentConfig({ WS_SERVER_URL: 'http://server:3000' }, setAuthFn);
    expect(setAuthFn).not.toHaveBeenCalled();
  });
});
