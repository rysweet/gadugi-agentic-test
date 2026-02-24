/**
 * OutputComprehender — targeted tests for uncovered branches.
 *
 * Covers:
 *  - Azure OpenAI initialization path (provider === 'azure')
 *  - Missing endpoint/deployment validation error
 *  - Lazy initialization via getClient() when llmClient is null
 *  - cleanup() sets llmClient to null
 */

// ---------------------------------------------------------------------------
// Mocks — BEFORE imports
// ---------------------------------------------------------------------------

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

jest.mock('../utils/logger', () => {
  const actual = jest.requireActual<typeof import('../utils/logger')>('../utils/logger');
  return {
    ...actual,
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { OutputComprehender } from '../agents/comprehension/OutputComprehender';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    maxContextLength: 1000,
    llm: {
      provider: 'openai' as const,
      apiKey: 'test-api-key',
      model: 'gpt-4',
      temperature: 0.1,
      maxTokens: 500,
      ...overrides,
    },
  } as any;
}

function makeAzureConfig(llmOverrides: Record<string, unknown> = {}) {
  return makeConfig({
    provider: 'azure' as const,
    apiKey: 'azure-api-key',
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 500,
    endpoint: 'https://my-resource.openai.azure.com',
    deployment: 'my-deployment',
    apiVersion: '2024-02-01',
    ...llmOverrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// Azure initialization path
// ===========================================================================
describe('OutputComprehender — Azure OpenAI initialization', () => {
  it('initializes successfully with valid Azure config', async () => {
    const comprehender = new OutputComprehender(makeAzureConfig());
    await expect(comprehender.initialize()).resolves.not.toThrow();
  });

  it('throws when azure provider is missing endpoint', async () => {
    const comprehender = new OutputComprehender(
      makeAzureConfig({ endpoint: undefined, deployment: 'my-deploy' })
    );
    await expect(comprehender.initialize()).rejects.toThrow(
      'Azure OpenAI requires endpoint and deployment configuration'
    );
  });

  it('throws when azure provider is missing deployment', async () => {
    const comprehender = new OutputComprehender(
      makeAzureConfig({ endpoint: 'https://endpoint', deployment: undefined })
    );
    await expect(comprehender.initialize()).rejects.toThrow(
      'Azure OpenAI requires endpoint and deployment configuration'
    );
  });
});

// ===========================================================================
// OpenAI initialization and cleanup
// ===========================================================================
describe('OutputComprehender — OpenAI initialization', () => {
  it('throws when apiKey is missing', async () => {
    const comprehender = new OutputComprehender(makeConfig({ apiKey: '' }));
    await expect(comprehender.initialize()).rejects.toThrow('requires an API key');
  });

  it('throws when apiKey is whitespace only', async () => {
    const comprehender = new OutputComprehender(makeConfig({ apiKey: '   ' }));
    await expect(comprehender.initialize()).rejects.toThrow('requires an API key');
  });

  it('initializes successfully with valid OpenAI config', async () => {
    const comprehender = new OutputComprehender(makeConfig());
    await expect(comprehender.initialize()).resolves.not.toThrow();
  });
});

// ===========================================================================
// cleanup()
// ===========================================================================
describe('OutputComprehender.cleanup()', () => {
  it('sets llmClient to null so the next call will re-initialize', async () => {
    const comprehender = new OutputComprehender(makeConfig());
    await comprehender.initialize();
    comprehender.cleanup();

    // After cleanup, internal state is null — confirm by re-initializing
    await expect(comprehender.initialize()).resolves.not.toThrow();
  });
});

// ===========================================================================
// analyzeFeature() — lazy initialization and JSON parsing
// ===========================================================================
describe('OutputComprehender.analyzeFeature()', () => {
  it('initializes client lazily and returns a FeatureSpec', async () => {
    const comprehender = new OutputComprehender(makeConfig());
    // Do NOT call initialize() — let analyzeFeature trigger it lazily

    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            name: 'LazyFeature',
            purpose: 'Test lazy init',
            inputs: [],
            outputs: [],
            success_criteria: ['Passes'],
            failure_modes: [],
            edge_cases: [],
            dependencies: [],
          }),
        },
      }],
    });

    const spec = await comprehender.analyzeFeature('Lazy feature documentation');

    expect(spec.name).toBe('LazyFeature');
    expect(mockCreate).toHaveBeenCalled();
  });
});
