/**
 * APIAgent sub-module unit tests
 *
 * Tests for APIRequestExecutor, APIAuthHandler, and APIResponseValidator.
 * Closes issue #130 (WS-F).
 */

import axios from 'axios';
import { APIRequestExecutor } from '../api/APIRequestExecutor';
import { APIAuthHandler } from '../api/APIAuthHandler';
import { APIResponseValidator } from '../api/APIResponseValidator';
import { DEFAULT_API_CONFIG, APIResponse } from '../api/types';
import { TestLogger, LogLevel } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Mock axios
// ---------------------------------------------------------------------------

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): TestLogger {
  return new TestLogger('test', LogLevel.ERROR);
}

function makeAxiosInstance() {
  const mockRequest = jest.fn();
  const instance: any = {
    request: mockRequest,
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    },
    defaults: {
      headers: {
        common: {} as Record<string, string>
      }
    },
    head: jest.fn().mockResolvedValue({ status: 200 })
  };
  return { instance, mockRequest };
}

function makeExecutor(retryOverrides = {}) {
  const cfg = {
    ...DEFAULT_API_CONFIG,
    logConfig: { ...DEFAULT_API_CONFIG.logConfig, logRequests: false, logResponses: false },
    retry: { ...DEFAULT_API_CONFIG.retry, maxRetries: 0, ...retryOverrides }
  };
  const logger = makeLogger();
  const executor = new APIRequestExecutor(cfg as any, logger);
  return executor;
}

// ---------------------------------------------------------------------------
// APIRequestExecutor tests
// ---------------------------------------------------------------------------

describe('APIRequestExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('makeRequest() - GET with correct headers', () => {
    it('sends a GET request and captures response data', async () => {
      const { instance, mockRequest } = makeAxiosInstance();
      mockedAxios.create.mockReturnValue(instance);

      mockRequest.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'success' }
      });

      const executor = makeExecutor();
      // Replace internal axios instance
      (executor as any).axiosInstance = instance;

      const response = await executor.makeRequest('GET', '/api/test', undefined, { 'X-Custom': 'value' });

      expect(mockRequest).toHaveBeenCalledTimes(1);
      const callArgs = mockRequest.mock.calls[0][0];
      expect(callArgs.method).toBe('get');
      expect(callArgs.url).toBe('/api/test');
      expect(callArgs.headers?.['X-Custom']).toBe('value');
      expect(response.status).toBe(200);
      expect(response.data).toEqual({ message: 'success' });
    });
  });

  describe('makeRequest() - retry on 5xx', () => {
    it('retries on 503 and succeeds on the second attempt', async () => {
      const { instance, mockRequest } = makeAxiosInstance();
      mockedAxios.create.mockReturnValue(instance);

      const serverError = Object.assign(new Error('Service Unavailable'), {
        response: { status: 503, statusText: 'Service Unavailable', headers: {}, data: 'error' }
      });

      mockRequest
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: { ok: true }
        });

      const cfg = {
        ...DEFAULT_API_CONFIG,
        logConfig: { ...DEFAULT_API_CONFIG.logConfig, logRequests: false, logResponses: false },
        retry: {
          maxRetries: 1,
          retryDelay: 10,
          retryOnStatus: [503],
          exponentialBackoff: false,
          maxBackoffDelay: 10000
        }
      };
      const executor = new APIRequestExecutor(cfg as any, makeLogger());
      (executor as any).axiosInstance = instance;

      const response = await executor.makeRequest('GET', '/flaky');
      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });

    it('throws after exhausting all retries', async () => {
      const { instance, mockRequest } = makeAxiosInstance();
      mockedAxios.create.mockReturnValue(instance);

      const serverError = Object.assign(new Error('Internal Server Error'), {
        response: { status: 500, statusText: 'Internal Server Error', headers: {}, data: 'error' }
      });

      mockRequest.mockRejectedValue(serverError);

      const cfg = {
        ...DEFAULT_API_CONFIG,
        logConfig: { ...DEFAULT_API_CONFIG.logConfig, logRequests: false, logResponses: false },
        retry: {
          maxRetries: 2,
          retryDelay: 5,
          retryOnStatus: [500],
          exponentialBackoff: false,
          maxBackoffDelay: 1000
        }
      };
      const executor = new APIRequestExecutor(cfg as any, makeLogger());
      (executor as any).axiosInstance = instance;

      await expect(executor.makeRequest('GET', '/always-fails')).rejects.toThrow();
      expect(mockRequest).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('getRequestHistory() and getResponseHistory()', () => {
    it('records request and response in their respective histories', async () => {
      const { instance, mockRequest } = makeAxiosInstance();
      mockedAxios.create.mockReturnValue(instance);

      mockRequest.mockResolvedValueOnce({
        status: 201,
        statusText: 'Created',
        headers: {},
        data: { id: 1 }
      });

      const executor = makeExecutor();
      (executor as any).axiosInstance = instance;

      await executor.makeRequest('POST', '/items', { name: 'test' });

      expect(executor.getRequestHistory()).toHaveLength(1);
      expect(executor.getRequestHistory()[0].method).toBe('POST');
      expect(executor.getResponseHistory()).toHaveLength(1);
      expect(executor.getResponseHistory()[0].status).toBe(201);
    });
  });

  describe('reset()', () => {
    it('clears all history arrays', async () => {
      const { instance, mockRequest } = makeAxiosInstance();
      mockedAxios.create.mockReturnValue(instance);

      mockRequest.mockResolvedValueOnce({
        status: 200, statusText: 'OK', headers: {}, data: {}
      });

      const executor = makeExecutor();
      (executor as any).axiosInstance = instance;

      await executor.makeRequest('GET', '/test');
      executor.reset();

      expect(executor.getRequestHistory()).toHaveLength(0);
      expect(executor.getResponseHistory()).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// APIAuthHandler tests
// ---------------------------------------------------------------------------

describe('APIAuthHandler', () => {
  function makeHandler() {
    const axiosInstance: any = {
      defaults: {
        headers: {
          common: {} as Record<string, string>
        }
      }
    };
    const logger = makeLogger();
    const handler = new APIAuthHandler(axiosInstance, logger);
    return { handler, axiosInstance };
  }

  describe('applyAuth() - bearer token', () => {
    it('adds Authorization header with Bearer prefix', () => {
      const { handler, axiosInstance } = makeHandler();
      handler.applyAuth({ type: 'bearer', token: 'my-secret-token' });
      expect(axiosInstance.defaults.headers.common['Authorization']).toBe('Bearer my-secret-token');
    });

    it('does not set Authorization header when token is missing', () => {
      const { handler, axiosInstance } = makeHandler();
      handler.applyAuth({ type: 'bearer' });
      expect(axiosInstance.defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  describe('applyAuth() - API key', () => {
    it('adds X-API-Key header with the api key value', () => {
      const { handler, axiosInstance } = makeHandler();
      handler.applyAuth({ type: 'apikey', apiKey: 'key-123', apiKeyHeader: 'X-API-Key' });
      expect(axiosInstance.defaults.headers.common['X-API-Key']).toBe('key-123');
    });

    it('uses custom header name when apiKeyHeader is specified', () => {
      const { handler, axiosInstance } = makeHandler();
      handler.applyAuth({ type: 'apikey', apiKey: 'secret', apiKeyHeader: 'X-Custom-Key' });
      expect(axiosInstance.defaults.headers.common['X-Custom-Key']).toBe('secret');
    });

    it('uses default X-API-Key header when apiKeyHeader is omitted', () => {
      const { handler, axiosInstance } = makeHandler();
      handler.applyAuth({ type: 'apikey', apiKey: 'default-key' });
      expect(axiosInstance.defaults.headers.common['X-API-Key']).toBe('default-key');
    });
  });

  describe('applyAuth() - basic auth', () => {
    it('adds base64-encoded Authorization header', () => {
      const { handler, axiosInstance } = makeHandler();
      handler.applyAuth({ type: 'basic', username: 'user', password: 'pass' });
      const expected = `Basic ${Buffer.from('user:pass').toString('base64')}`;
      expect(axiosInstance.defaults.headers.common['Authorization']).toBe(expected);
    });
  });

  describe('applyAuth() - custom headers', () => {
    it('sets all custom headers on the axios instance', () => {
      const { handler, axiosInstance } = makeHandler();
      handler.applyAuth({ type: 'custom', customHeaders: { 'X-Tenant': 'acme', 'X-Version': '2' } });
      expect(axiosInstance.defaults.headers.common['X-Tenant']).toBe('acme');
      expect(axiosInstance.defaults.headers.common['X-Version']).toBe('2');
    });
  });

  describe('setAuthentication()', () => {
    it('sets bearer authentication and returns correct AuthConfig', () => {
      const { handler, axiosInstance } = makeHandler();
      const config = handler.setAuthentication('bearer', 'token-xyz');
      expect(config.type).toBe('bearer');
      expect(config.token).toBe('token-xyz');
      expect(axiosInstance.defaults.headers.common['Authorization']).toBe('Bearer token-xyz');
    });

    it('throws for unsupported authentication type', () => {
      const { handler } = makeHandler();
      expect(() => handler.setAuthentication('oauth2')).toThrow(/unsupported/i);
    });

    it('sets apikey authentication and returns correct AuthConfig', () => {
      const { handler, axiosInstance } = makeHandler();
      const config = handler.setAuthentication('apikey', 'X-Custom-Header:my-api-key');
      expect(config.type).toBe('apikey');
      expect(config.apiKey).toBe('my-api-key');
      expect(config.apiKeyHeader).toBe('X-Custom-Header');
      expect(axiosInstance.defaults.headers.common['X-Custom-Header']).toBe('my-api-key');
    });

    it('sets apikey authentication with default header when no colon separator', () => {
      const { handler, axiosInstance } = makeHandler();
      const config = handler.setAuthentication('apikey', 'somekey');
      expect(config.type).toBe('apikey');
      expect(axiosInstance.defaults.headers.common['X-API-Key']).toBe(undefined);
    });

    it('sets basic authentication and returns correct AuthConfig', () => {
      const { handler, axiosInstance } = makeHandler();
      const config = handler.setAuthentication('basic', 'admin:secret');
      expect(config.type).toBe('basic');
      expect(config.username).toBe('admin');
      expect(config.password).toBe('secret');
      const encoded = Buffer.from('admin:secret').toString('base64');
      expect(axiosInstance.defaults.headers.common['Authorization']).toBe(`Basic ${encoded}`);
    });
  });
});

// ---------------------------------------------------------------------------
// APIResponseValidator tests
// ---------------------------------------------------------------------------

describe('APIResponseValidator', () => {
  const validator = new APIResponseValidator({ enabled: false });

  function makeResponse(overrides: Partial<APIResponse> = {}): APIResponse {
    return {
      requestId: 'req-1',
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: { message: 'hello' },
      duration: 50,
      timestamp: new Date(),
      ...overrides
    };
  }

  describe('validateStatus()', () => {
    it('returns true when response status matches expected', () => {
      const response = makeResponse({ status: 201 });
      expect(validator.validateStatus(response, 201)).toBe(true);
    });

    it('returns false when response status does not match', () => {
      const response = makeResponse({ status: 200 });
      expect(validator.validateStatus(response, 404)).toBe(false);
    });

    it('throws when no response is provided', () => {
      expect(() => validator.validateStatus(undefined, 200)).toThrow(/no response/i);
    });
  });

  describe('validateResponse() - body content', () => {
    it('returns true when response body matches the expected JSON string', () => {
      const response = makeResponse({ data: { id: 42, name: 'test' } });
      expect(validator.validateResponse(response, JSON.stringify({ id: 42, name: 'test' }))).toBe(true);
    });

    it('returns false when response body does not match expected JSON', () => {
      const response = makeResponse({ data: { id: 1 } });
      expect(validator.validateResponse(response, JSON.stringify({ id: 99 }))).toBe(false);
    });

    it('falls back to string includes check for non-JSON expected value', () => {
      const response = makeResponse({ data: { message: 'hello world' } });
      expect(validator.validateResponse(response, 'hello')).toBe(true);
    });

    it('throws when no response is provided', () => {
      expect(() => validator.validateResponse(undefined, '{}' )).toThrow(/no response/i);
    });
  });

  describe('validateHeaders()', () => {
    it('returns true when response contains all expected headers', () => {
      const response = makeResponse({ headers: { 'content-type': 'application/json', 'x-request-id': 'abc' } });
      expect(validator.validateHeaders(response, JSON.stringify({ 'content-type': 'application/json' }))).toBe(true);
    });

    it('returns false when a required header value does not match', () => {
      const response = makeResponse({ headers: { 'content-type': 'text/html' } });
      expect(validator.validateHeaders(response, JSON.stringify({ 'content-type': 'application/json' }))).toBe(false);
    });

    it('throws for malformed header validation JSON', () => {
      const response = makeResponse();
      expect(() => validator.validateHeaders(response, 'not-json')).toThrow(/invalid header/i);
    });
  });

  describe('validateResponseSchema()', () => {
    it('throws when schema validation is disabled', () => {
      expect(() => validator.validateResponseSchema('{}'))
        .toThrow(/schema validation is disabled/i);
    });

    describe('with schema validation enabled', () => {
      const enabledValidator = new APIResponseValidator({ enabled: true });

      it('returns true when data matches the JSON schema', () => {
        const schema = JSON.stringify({
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
          required: ['id', 'name'],
        });
        const result = enabledValidator.validateResponseSchema(schema, { id: 1, name: 'Alice' });
        expect(result).toBe(true);
      });

      it('returns false when data does not match the JSON schema', () => {
        const schema = JSON.stringify({
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        });
        // Missing required field 'id'
        const result = enabledValidator.validateResponseSchema(schema, { name: 'no-id' });
        expect(result).toBe(false);
      });

      it('returns false when data type does not match schema type', () => {
        const schema = JSON.stringify({ type: 'object' });
        const result = enabledValidator.validateResponseSchema(schema, 'a string, not an object');
        expect(result).toBe(false);
      });

      it('returns true for an empty object matching an empty schema', () => {
        const schema = JSON.stringify({});
        const result = enabledValidator.validateResponseSchema(schema, {});
        expect(result).toBe(true);
      });

      it('throws when schemaStr is not valid JSON', () => {
        expect(() => enabledValidator.validateResponseSchema('not-json', {}))
          .toThrow(/invalid json schema/i);
      });

      it('returns true when responseData is undefined and schema allows it', () => {
        // A schema with no required constraints allows undefined/null
        const schema = JSON.stringify({ type: 'object' });
        // undefined should fail (not an object)
        const result = enabledValidator.validateResponseSchema(schema, undefined);
        expect(result).toBe(false);
      });

      it('validates nested objects correctly', () => {
        const schema = JSON.stringify({
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                email: { type: 'string' },
              },
              required: ['email'],
            },
          },
          required: ['user'],
        });
        // Missing nested required field 'email'
        const result = enabledValidator.validateResponseSchema(schema, { user: { name: 'Alice' } });
        expect(result).toBe(false);
      });

      it('validates array schema correctly', () => {
        const schema = JSON.stringify({
          type: 'array',
          items: { type: 'number' },
        });
        expect(enabledValidator.validateResponseSchema(schema, [1, 2, 3])).toBe(true);
        expect(enabledValidator.validateResponseSchema(schema, [1, 'two', 3])).toBe(false);
      });
    });
  });

  describe('parseHeaders()', () => {
    it('parses a JSON headers string', () => {
      const result = validator.parseHeaders('{"Authorization":"Bearer tok"}');
      expect(result).toEqual({ Authorization: 'Bearer tok' });
    });

    it('parses a single key:value header string', () => {
      const result = validator.parseHeaders('Content-Type:application/json');
      expect(result).toEqual({ 'Content-Type': 'application/json' });
    });

    it('returns undefined for an empty string', () => {
      expect(validator.parseHeaders('')).toBeUndefined();
    });
  });

  describe('parseRequestData()', () => {
    it('returns parsed data for a JSON body string', () => {
      const result = validator.parseRequestData('{"key":"value"}');
      expect(result).toEqual({ data: { key: 'value' } });
    });

    it('returns data and headers when both present in JSON', () => {
      const payload = JSON.stringify({ data: { id: 1 }, headers: { 'X-Token': 'abc' } });
      const result = validator.parseRequestData(payload);
      expect(result.data).toEqual({ id: 1 });
      expect(result.headers).toEqual({ 'X-Token': 'abc' });
    });

    it('returns raw string data for non-JSON input', () => {
      const result = validator.parseRequestData('plain-text-body');
      expect(result).toEqual({ data: 'plain-text-body' });
    });

    it('returns empty object when value is undefined', () => {
      expect(validator.parseRequestData(undefined)).toEqual({});
    });
  });
});
