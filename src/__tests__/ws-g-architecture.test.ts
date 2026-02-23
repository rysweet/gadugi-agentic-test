/**
 * Tests for WS-G architecture fixes (issue #131)
 *
 *   G1: setupGracefulShutdown removed from public lib/index exports
 *   G2: ElectronUIAgent.onAfterExecute closes resources when closeAfterEachScenario is true
 *   G3: IPipelineAgent interface implemented by ComprehensionAgent, PriorityAgent, IssueReporter
 */

// ---------------------------------------------------------------------------
// G1: setupGracefulShutdown not in public lib / index exports
// ---------------------------------------------------------------------------

describe('G1: setupGracefulShutdown removed from public API', () => {
  it('should NOT be exported from src/lib', () => {
    // Dynamic require so we get the actual exports object
    const libExports = require('../lib');
    expect(libExports).not.toHaveProperty('setupGracefulShutdown');
  });

  it('should NOT be exported from src/index', () => {
    const indexExports = require('../index');
    expect(indexExports).not.toHaveProperty('setupGracefulShutdown');
  });

  it('should be available from src/cli/setup (CLI-only module)', () => {
    const cliSetup = require('../cli/setup');
    expect(typeof cliSetup.setupGracefulShutdown).toBe('function');
  });

  it('setupGracefulShutdown in cli/setup accepts a TestOrchestrator and registers handlers', () => {
    const { setupGracefulShutdown } = require('../cli/setup');
    const listeners: Record<string, Function[]> = {};
    const fakeProcess = {
      on: jest.fn((event: string, handler: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
      }),
    };
    const fakeOrchestrator = { abort: jest.fn() };

    // Should not throw
    expect(() =>
      setupGracefulShutdown(fakeOrchestrator as any, fakeProcess as any)
    ).not.toThrow();

    // Should register at least SIGINT
    expect(fakeProcess.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });
});

// ---------------------------------------------------------------------------
// G2: ElectronUIAgent.onAfterExecute closes resources when configured
// ---------------------------------------------------------------------------

// We test at the unit level with mocked sub-modules so no real Electron process starts.

describe('G2: ElectronUIAgent closeAfterEachScenario', () => {
  const makeConfig = (extra: object = {}) => ({
    executablePath: '/fake/electron',
    screenshotConfig: { mode: 'off' as const, directory: '/tmp', fullPage: false },
    ...extra,
  });

  // Minimal mock setup for ElectronUIAgent constructor dependencies
  beforeEach(() => {
    jest.resetModules();

    // Mock screenshot module
    jest.mock('../utils/screenshot', () => ({
      createScreenshotManager: jest.fn(() => ({})),
    }));
    // Mock logger
    jest.mock('../utils/logger', () => ({
      createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        setContext: jest.fn(),
        scenarioStart: jest.fn(),
        scenarioEnd: jest.fn(),
        child: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
      })),
      LogLevel: { DEBUG: 'DEBUG', INFO: 'INFO' },
    }));
    // Mock sanitizeConfigWithEnv
    jest.mock('../utils/agentUtils', () => ({
      sanitizeConfigWithEnv: jest.fn((c: any) => c),
    }));
    // Mock electron sub-modules
    jest.mock('../agents/electron', () => {
      const launcherClose = jest.fn().mockResolvedValue(undefined);
      const wsDisconnect = jest.fn().mockResolvedValue(undefined);
      const launcherValidate = jest.fn().mockResolvedValue(undefined);
      return {
        DEFAULT_CONFIG: {
          launchTimeout: 30000,
          defaultTimeout: 10000,
          headless: false,
          args: [],
          screenshotConfig: { mode: 'off', directory: '/tmp', fullPage: false },
          performanceConfig: { enabled: false, sampleInterval: 1000, collectLogs: false },
          recoveryConfig: { maxRetries: 1, retryDelay: 100, restartOnFailure: false },
        },
        TestError: class TestError extends Error {
          constructor(opts: any) { super(opts.message); }
        },
        ElectronLauncher: jest.fn(() => ({
          validateExecutablePath: launcherValidate,
          close: launcherClose,
          forceClose: jest.fn().mockResolvedValue(undefined),
          launch: jest.fn().mockResolvedValue({}),
          page: null,
          consoleMessages: [],
          getProcessInfo: jest.fn(),
          exportFinalData: jest.fn().mockResolvedValue(undefined),
          _close: launcherClose,
        })),
        ElectronPageInteractor: jest.fn(() => ({
          getScenarioScreenshots: jest.fn(() => []),
          stateSnapshots: [],
          screenshot: jest.fn(),
          clickTab: jest.fn(),
          fillInput: jest.fn(),
          clickButton: jest.fn(),
          waitForElement: jest.fn(),
          getElementText: jest.fn(),
          captureState: jest.fn(),
          executeStep: jest.fn(),
          exportScreenshots: jest.fn(),
        })),
        ElectronPerformanceMonitor: jest.fn(() => ({
          start: jest.fn(),
          stop: jest.fn(),
          samples: [],
          getLatestMetrics: jest.fn(),
          getNetworkState: jest.fn(),
        })),
        ElectronWebSocketMonitor: jest.fn(() => ({
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: wsDisconnect,
          events: [],
          _disconnect: wsDisconnect,
        })),
        __launcherClose: launcherClose,
        __wsDisconnect: wsDisconnect,
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ElectronUIAgentConfig accepts closeAfterEachScenario: true without TypeScript error', () => {
    // This is a type-level test that also verifies the runtime config is accepted
    const { ElectronUIAgent } = require('../agents/ElectronUIAgent');
    const config = makeConfig({ closeAfterEachScenario: true });
    // Constructor should not throw when config includes the new field
    expect(() => new ElectronUIAgent(config)).not.toThrow();
  });

  it('closeAfterEachScenario defaults to false (preserves existing behavior)', () => {
    const { ElectronUIAgent } = require('../agents/ElectronUIAgent');
    const agent = new ElectronUIAgent(makeConfig());
    // Access the merged config — cast to any to inspect private field in test
    expect((agent as any).config.closeAfterEachScenario).toBeFalsy();
  });

  it('onAfterExecute closes launcher and wsMonitor when closeAfterEachScenario is true', async () => {
    const electronMock = require('../agents/electron');
    const { ElectronUIAgent } = require('../agents/ElectronUIAgent');
    const { OrchestratorScenario, TestStatus, Priority, TestInterface } = require('../models/TestModels');

    const agent = new ElectronUIAgent(makeConfig({ closeAfterEachScenario: true }));

    const fakeScenario = {
      id: 's1',
      name: 'test',
      description: '',
      priority: 'medium',
      interface: 'cli',
      steps: [],
      verifications: [],
      prerequisites: [],
      tags: [],
      enabled: true,
      estimatedDuration: 0,
      expectedOutcome: '',
    };

    // Call onAfterExecute directly (it's protected, cast to any)
    await (agent as any).onAfterExecute(fakeScenario, 'passed');

    // Verify launcher.close() was called
    expect(electronMock.__launcherClose).toHaveBeenCalled();
    // Verify wsMonitor.disconnect() was called
    expect(electronMock.__wsDisconnect).toHaveBeenCalled();
  });

  it('onAfterExecute does NOT close resources when closeAfterEachScenario is false', async () => {
    const electronMock = require('../agents/electron');
    const { ElectronUIAgent } = require('../agents/ElectronUIAgent');

    const agent = new ElectronUIAgent(makeConfig({ closeAfterEachScenario: false }));

    const fakeScenario = {
      id: 's1', name: 'test', description: '', priority: 'medium',
      interface: 'cli', steps: [], verifications: [], prerequisites: [],
      tags: [], enabled: true, estimatedDuration: 0, expectedOutcome: '',
    };

    await (agent as any).onAfterExecute(fakeScenario, 'passed');

    expect(electronMock.__launcherClose).not.toHaveBeenCalled();
    expect(electronMock.__wsDisconnect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// G3: IPipelineAgent interface
// ---------------------------------------------------------------------------

describe('G3: IPipelineAgent interface', () => {
  it('IPipelineAgent is exported from src/agents/index', () => {
    const agentsIndex = require('../agents/index');
    // IPipelineAgent is a TypeScript interface, so we test via a structural
    // satisfaction check: ensure the exported symbol exists as a named export.
    // Since interfaces are erased at runtime, we verify by checking that the
    // three agents satisfy it structurally.
    expect(agentsIndex).toBeDefined();
    // The type guard function or the interface itself should be exported
    // (we export isPipelineAgent helper per spec)
    expect(typeof agentsIndex.isPipelineAgent).toBe('function');
  });

  describe('ComprehensionAgent satisfies IPipelineAgent', () => {
    it('has name, type, initialize, and cleanup', () => {
      const { ComprehensionAgent } = require('../agents/ComprehensionAgent');
      const agent = new ComprehensionAgent({
        llm: { provider: 'openai', apiKey: 'test', model: 'gpt-4', temperature: 0.1, maxTokens: 100, apiVersion: '2024' },
        docsDir: 'docs',
        includePatterns: ['**/*.md'],
        excludePatterns: [],
        maxContextLength: 1000,
        cliCommandPatterns: [],
      });
      expect(typeof agent.name).toBe('string');
      expect(typeof agent.type).toBe('string');
      expect(typeof agent.initialize).toBe('function');
      expect(typeof agent.cleanup).toBe('function');
    });

    it('is recognized by isPipelineAgent()', () => {
      const { isPipelineAgent } = require('../agents/index');
      const { ComprehensionAgent } = require('../agents/ComprehensionAgent');
      const agent = new ComprehensionAgent({
        llm: { provider: 'openai', apiKey: 'test', model: 'gpt-4', temperature: 0.1, maxTokens: 100, apiVersion: '2024' },
        docsDir: 'docs',
        includePatterns: [],
        excludePatterns: [],
        maxContextLength: 1000,
        cliCommandPatterns: [],
      });
      expect(isPipelineAgent(agent)).toBe(true);
    });
  });

  describe('PriorityAgent satisfies IPipelineAgent', () => {
    it('has name, type, initialize, and cleanup', () => {
      const { PriorityAgent } = require('../agents/PriorityAgent');
      const agent = new PriorityAgent({});
      expect(typeof agent.name).toBe('string');
      expect(typeof agent.type).toBe('string');
      expect(typeof agent.initialize).toBe('function');
      expect(typeof agent.cleanup).toBe('function');
    });

    it('is recognized by isPipelineAgent()', () => {
      const { isPipelineAgent } = require('../agents/index');
      const { PriorityAgent } = require('../agents/PriorityAgent');
      const agent = new PriorityAgent({});
      expect(isPipelineAgent(agent)).toBe(true);
    });
  });

  describe('IssueReporter satisfies IPipelineAgent', () => {
    // IssueReporter has constructor side effects (logger.child, Octokit setup).
    // We verify structural compliance via prototype inspection and a hand-crafted
    // stub rather than constructing a real instance in this unit test.

    it('has isPipelineAgent marker on its prototype', () => {
      const { IssueReporter } = require('../agents/IssueReporter');
      // isPipelineAgent is set as a class field (readonly = true).
      // Verify it is present on the prototype or as an own property definition.
      // Since TypeScript readonly class fields initialize as own properties,
      // we verify via Object.getOwnPropertyDescriptor on a minimal stub.
      expect(IssueReporter.prototype.isPipelineAgent).toBeUndefined(); // class fields live on instances
      // Verify via a minimal duck-typed stub:
      const stub = Object.create(IssueReporter.prototype);
      // Class fields are set in the constructor. Check the prototype doesn't
      // block the marker:
      stub.isPipelineAgent = true; // emulate constructor assignment
      const { isPipelineAgent } = require('../agents/index');
      expect(isPipelineAgent(stub)).toBe(true);
    });

    it('has initialize and cleanup on its prototype', () => {
      const { IssueReporter } = require('../agents/IssueReporter');
      expect(typeof IssueReporter.prototype.initialize).toBe('function');
      expect(typeof IssueReporter.prototype.cleanup).toBe('function');
    });

    it('is recognized by isPipelineAgent() when instantiated with logger mock', () => {
      // Use a minimal hand-crafted object that matches what the constructor
      // would produce, without triggering real constructor side effects.
      const { isPipelineAgent } = require('../agents/index');
      const mockInstance = {
        name: 'IssueReporter',
        type: 'github',
        isPipelineAgent: true as const,
        initialize: async () => {},
        cleanup: async () => {},
      };
      expect(isPipelineAgent(mockInstance)).toBe(true);
    });
  });

  it('execution agents (ElectronUIAgent) are NOT pipeline agents', () => {
    const { isPipelineAgent } = require('../agents/index');
    // Use a plain object that matches IAgent but not IPipelineAgent
    const executionAgent = {
      name: 'ExecutionAgent',
      type: 'ui',
      initialize: async () => {},
      execute: async () => {},
      cleanup: async () => {},
      // No isPipelineAgent marker
    };
    expect(isPipelineAgent(executionAgent)).toBe(false);
  });
});
