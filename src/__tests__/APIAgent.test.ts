/**
 * APIAgent unit tests.
 *
 * All sub-modules (APIRequestExecutor, APIAuthHandler, APIResponseValidator)
 * are mocked so no real HTTP calls are made. Tests cover:
 *   - constructor wiring
 *   - initialize() happy path and error path
 *   - executeStep() for each supported action
 *   - makeRequest() delegation
 *   - setAuthentication(), setDefaultHeader()
 *   - cleanup()
 *   - createAPIAgent() factory
 */

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE imports
// ---------------------------------------------------------------------------

const mockAxiosInstance = {
  defaults: { baseURL: '', timeout: 5000 },
};

const mockExecutorInstance = {
  testConnectivity:       jest.fn().mockResolvedValue(undefined),
  setupInterceptors:      jest.fn(),
  makeRequest:            jest.fn().mockResolvedValue({ status: 200, data: {} }),
  getRequestHistory:      jest.fn().mockReturnValue([]),
  getResponseHistory:     jest.fn().mockReturnValue([]),
  getPerformanceMetrics:  jest.fn().mockReturnValue([]),
  getLatestResponse:      jest.fn().mockReturnValue(undefined),
  getLatestPerformanceMetrics: jest.fn().mockReturnValue(undefined),
  setDefaultHeader:       jest.fn(),
  reset:                  jest.fn(),
  axiosInstance:          mockAxiosInstance,
};

const mockAuthHandlerInstance = {
  applyAuth:       jest.fn(),
  setAuthentication: jest.fn().mockReturnValue({ type: 'bearer', token: 'tok' }),
};

const mockValidatorInstance = {
  validateResponse:       jest.fn().mockReturnValue(true),
  validateStatus:         jest.fn().mockReturnValue(true),
  validateHeaders:        jest.fn().mockReturnValue(true),
  validateResponseSchema: jest.fn().mockReturnValue(true),
  parseRequestData:       jest.fn().mockReturnValue({ data: {}, headers: {} }),
  parseHeaders:           jest.fn().mockReturnValue({}),
};

jest.mock('../agents/api/APIRequestExecutor', () => ({
  APIRequestExecutor: jest.fn().mockImplementation(() => mockExecutorInstance),
}));

jest.mock('../agents/api/APIAuthHandler', () => ({
  APIAuthHandler: jest.fn().mockImplementation(() => mockAuthHandlerInstance),
}));

jest.mock('../agents/api/APIResponseValidator', () => ({
  APIResponseValidator: jest.fn().mockImplementation(() => mockValidatorInstance),
}));

jest.mock('../utils/logger', () => {
  const actual = jest.requireActual<typeof import('../utils/logger')>('../utils/logger');
  return {
    ...actual,
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { APIAgent, createAPIAgent } from '../agents/APIAgent';
import { TestStatus } from '../models/TestModels';

// ---------------------------------------------------------------------------

function makeStep(action: string, target = '/api/test', value?: string, timeout?: number) {
  return { action, target, value, timeout, description: '' };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExecutorInstance.testConnectivity.mockResolvedValue(undefined);
  mockExecutorInstance.makeRequest.mockResolvedValue({ status: 200, data: {} });
  mockValidatorInstance.validateResponse.mockReturnValue(true);
  mockValidatorInstance.parseRequestData.mockReturnValue({ data: { key: 'val' }, headers: {} });
  mockValidatorInstance.parseHeaders.mockReturnValue({ 'X-Test': '1' });
});

// ===========================================================================
// constructor & factory
// ===========================================================================
describe('APIAgent constructor', () => {
  it('constructs without throwing', () => {
    expect(() => new APIAgent()).not.toThrow();
  });

  it('accepts a config override', () => {
    expect(() => new APIAgent({ baseURL: 'http://localhost:3000' })).not.toThrow();
  });
});

describe('createAPIAgent()', () => {
  it('returns an APIAgent instance', () => {
    const agent = createAPIAgent();
    expect(agent).toBeInstanceOf(APIAgent);
  });
});

// ===========================================================================
// initialize()
// ===========================================================================
describe('APIAgent.initialize()', () => {
  it('does not call testConnectivity when baseURL is not set', async () => {
    const agent = new APIAgent();
    await agent.initialize();

    expect(mockExecutorInstance.testConnectivity).not.toHaveBeenCalled();
    expect(mockExecutorInstance.setupInterceptors).toHaveBeenCalled();
    expect(mockAuthHandlerInstance.applyAuth).toHaveBeenCalled();
  });

  it('calls testConnectivity when baseURL is set', async () => {
    const agent = new APIAgent({ baseURL: 'http://api.test' });
    await agent.initialize();

    expect(mockExecutorInstance.testConnectivity).toHaveBeenCalled();
  });

  it('throws when testConnectivity rejects', async () => {
    mockExecutorInstance.testConnectivity.mockRejectedValueOnce(new Error('Connection refused'));
    const agent = new APIAgent({ baseURL: 'http://unreachable' });
    await expect(agent.initialize()).rejects.toThrow('Failed to initialize APIAgent');
  });
});

// ===========================================================================
// executeStep() — each HTTP action
// ===========================================================================
describe('APIAgent.executeStep()', () => {
  let agent: APIAgent;

  beforeEach(async () => {
    agent = new APIAgent();
    await agent.initialize();
  });

  it('get action calls makeRequest with GET', async () => {
    const result = await agent.executeStep(makeStep('get', '/users'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockExecutorInstance.makeRequest).toHaveBeenCalledWith(
      'GET', '/users', undefined, expect.anything(), expect.anything()
    );
  });

  it('post action calls makeRequest with POST and payload', async () => {
    const result = await agent.executeStep(makeStep('post', '/users', '{"name":"Alice"}'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockExecutorInstance.makeRequest).toHaveBeenCalledWith(
      'POST', '/users', expect.anything(), expect.anything(), expect.anything()
    );
  });

  it('put action calls makeRequest with PUT', async () => {
    const result = await agent.executeStep(makeStep('put', '/users/1', '{"name":"Bob"}'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockExecutorInstance.makeRequest).toHaveBeenCalledWith(
      'PUT', '/users/1', expect.anything(), expect.anything(), expect.anything()
    );
  });

  it('delete action calls makeRequest with DELETE', async () => {
    const result = await agent.executeStep(makeStep('delete', '/users/1'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockExecutorInstance.makeRequest).toHaveBeenCalledWith(
      'DELETE', '/users/1', undefined, expect.anything(), expect.anything()
    );
  });

  it('patch action calls makeRequest with PATCH', async () => {
    const result = await agent.executeStep(makeStep('patch', '/users/1', '{"active":true}'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockExecutorInstance.makeRequest).toHaveBeenCalledWith(
      'PATCH', '/users/1', expect.anything(), expect.anything(), expect.anything()
    );
  });

  it('head action calls makeRequest with HEAD', async () => {
    const result = await agent.executeStep(makeStep('head', '/health'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockExecutorInstance.makeRequest).toHaveBeenCalledWith(
      'HEAD', '/health', undefined, expect.anything(), expect.anything()
    );
  });

  it('options action calls makeRequest with OPTIONS', async () => {
    const result = await agent.executeStep(makeStep('options', '/api'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockExecutorInstance.makeRequest).toHaveBeenCalledWith(
      'OPTIONS', '/api', undefined, expect.anything(), expect.anything()
    );
  });

  it('validate_response calls validator.validateResponse', async () => {
    const result = await agent.executeStep(makeStep('validate_response', '', '{"status":200}'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockValidatorInstance.validateResponse).toHaveBeenCalled();
  });

  it('validate_status calls validator.validateStatus', async () => {
    const result = await agent.executeStep(makeStep('validate_status', '', '200'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockValidatorInstance.validateStatus).toHaveBeenCalledWith(
      undefined,  // getLatestResponse() returns undefined in mock
      200
    );
  });

  it('validate_headers calls validator.validateHeaders', async () => {
    const result = await agent.executeStep(makeStep('validate_headers', '', 'Content-Type:json'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockValidatorInstance.validateHeaders).toHaveBeenCalled();
  });

  it('validate_schema calls validator.validateResponseSchema', async () => {
    const result = await agent.executeStep(makeStep('validate_schema', '', '{}'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockValidatorInstance.validateResponseSchema).toHaveBeenCalled();
  });

  it('set_header calls setDefaultHeader', async () => {
    const result = await agent.executeStep(makeStep('set_header', 'Authorization', 'Bearer tok'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockExecutorInstance.setDefaultHeader).toHaveBeenCalledWith('Authorization', 'Bearer tok');
  });

  it('set_auth calls setAuthentication', async () => {
    const result = await agent.executeStep(makeStep('set_auth', 'bearer', 'my-token'), 0);

    expect(result.status).toBe(TestStatus.PASSED);
    expect(mockAuthHandlerInstance.setAuthentication).toHaveBeenCalledWith('bearer', 'my-token');
  });

  it('wait action delays without throwing', async () => {
    jest.useFakeTimers();
    const promise = agent.executeStep(makeStep('wait', '', '50'), 0);
    jest.runAllTimersAsync();
    const result = await promise;
    expect(result.status).toBe(TestStatus.PASSED);
    jest.useRealTimers();
  });

  it('clear_cookies action returns PASSED', async () => {
    const result = await agent.executeStep(makeStep('clear_cookies'), 0);
    expect(result.status).toBe(TestStatus.PASSED);
  });

  it('unsupported action returns FAILED', async () => {
    const result = await agent.executeStep(makeStep('unknown_action'), 0);
    expect(result.status).toBe(TestStatus.FAILED);
    expect(result.error).toContain('Unsupported API action');
  });

  it('makeRequest failure returns FAILED status for a step', async () => {
    mockExecutorInstance.makeRequest.mockRejectedValueOnce(new Error('Network error'));
    const result = await agent.executeStep(makeStep('get', '/broken'), 0);

    expect(result.status).toBe(TestStatus.FAILED);
    expect(result.error).toContain('Network error');
  });
});

// ===========================================================================
// makeRequest() public API
// ===========================================================================
describe('APIAgent.makeRequest()', () => {
  it('delegates to executor.makeRequest', async () => {
    const agent = new APIAgent();
    mockExecutorInstance.makeRequest.mockResolvedValue({ status: 201, data: { id: 1 } });

    const resp = await agent.makeRequest('POST', '/items', { name: 'test' });

    expect(resp.status).toBe(201);
    expect(mockExecutorInstance.makeRequest).toHaveBeenCalled();
  });
});

// ===========================================================================
// setAuthentication() / setDefaultHeader()
// ===========================================================================
describe('APIAgent.setAuthentication()', () => {
  it('delegates to authHandler.setAuthentication', () => {
    const agent = new APIAgent();
    agent.setAuthentication('bearer', 'my-token');
    expect(mockAuthHandlerInstance.setAuthentication).toHaveBeenCalledWith('bearer', 'my-token');
  });
});

describe('APIAgent.setDefaultHeader()', () => {
  it('updates config and delegates to executor', () => {
    const agent = new APIAgent();
    agent.setDefaultHeader('X-Custom', 'value');
    expect(mockExecutorInstance.setDefaultHeader).toHaveBeenCalledWith('X-Custom', 'value');
  });
});

// ===========================================================================
// Accessors
// ===========================================================================
describe('APIAgent accessors', () => {
  it('getLatestResponse() delegates to executor', () => {
    const agent = new APIAgent();
    mockExecutorInstance.getLatestResponse.mockReturnValue({ status: 200, data: {} });
    const resp = agent.getLatestResponse();
    expect(resp).toEqual({ status: 200, data: {} });
  });

  it('getLatestPerformanceMetrics() delegates to executor', () => {
    const agent = new APIAgent();
    mockExecutorInstance.getLatestPerformanceMetrics.mockReturnValue({ duration: 50 });
    const metrics = agent.getLatestPerformanceMetrics();
    expect(metrics).toEqual({ duration: 50 });
  });
});

// ===========================================================================
// cleanup()
// ===========================================================================
describe('APIAgent.cleanup()', () => {
  it('calls executor.reset', async () => {
    const agent = new APIAgent();
    await agent.cleanup();
    expect(mockExecutorInstance.reset).toHaveBeenCalled();
  });

  it('does not throw when reset fails (best-effort)', async () => {
    mockExecutorInstance.reset.mockImplementationOnce(() => { throw new Error('reset fail'); });
    const agent = new APIAgent();
    await expect(agent.cleanup()).resolves.not.toThrow();
  });
});
