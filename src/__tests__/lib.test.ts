/**
 * Tests for lib.ts programmatic API
 *
 * Covers the two bugs fixed in issue #105:
 *   1. runTests() throws when configPath is provided because loadConfiguration
 *      received an incomplete CliArguments cast, causing logLevel.toLowerCase() to crash.
 *   2. loadTestScenarios() passes YAML content string to parseYamlScenarios (which
 *      expects a file path), causing it to crash on file-not-found.
 */

import {
  runTests,
  loadTestScenarios,
  loadConfiguration,
  createDefaultConfig,
  filterScenariosForSuite,
  CliArguments,
  ProgrammaticTestOptions,
} from '../lib';
import { TestStatus } from '../models/TestModels';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock fs/promises so no real file I/O occurs
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

// Mock fs-extra pathExists
jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(false),
}));

// Mock the YAML parser so we control scenario loading
jest.mock('../utils/yamlParser', () => ({
  parseYamlScenarios: jest.fn().mockResolvedValue([]),
  parseScenariosFromString: jest.fn().mockResolvedValue([]),
  loadScenariosFromFile: jest.fn().mockResolvedValue([]),
  parseScenarioFromYaml: jest.fn(),
  createYamlParser: jest.fn(() => ({
    loadScenarios: jest.fn().mockResolvedValue([]),
    parseScenario: jest.fn(),
  })),
  YamlParser: jest.fn().mockImplementation(() => ({
    loadScenarios: jest.fn().mockResolvedValue([]),
    parseScenario: jest.fn(),
  })),
}));

// Mock the orchestrator so runTests() doesn't attempt real test execution
jest.mock('../orchestrator', () => ({
  createTestOrchestrator: jest.fn(() => ({
    run: jest.fn().mockResolvedValue({
      id: 'mock-session-id',
      startTime: new Date(),
      endTime: new Date(),
      status: 'passed',
      results: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
    }),
    abort: jest.fn(),
  })),
  TestOrchestrator: jest.fn(),
}));

// Mock logger to suppress output during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  setupLogger: jest.fn(),
  LogLevel: { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lib.ts programmatic API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Bug #1: runTests() always throws when configPath is provided
  // -------------------------------------------------------------------------
  describe('runTests() - Bug #105 Fix 1: complete CliArguments', () => {
    it('should not throw when configPath is provided and config file does not exist', async () => {
      // pathExists is mocked to return false → falls back to createDefaultConfig()
      // Previously this threw: "TypeError: Cannot read properties of undefined (reading 'toLowerCase')"
      // because loadConfiguration received { noIssues: false } as CliArguments (missing logLevel).
      await expect(
        runTests({ configPath: './config/test-config.yaml', suite: 'smoke' })
      ).resolves.toBeDefined();
    });

    it('should return a TestSession with the expected shape', async () => {
      const session = await runTests({
        configPath: './config/test-config.yaml',
        suite: 'smoke',
      });

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('startTime');
      expect(session).toHaveProperty('summary');
      expect(typeof session.summary.total).toBe('number');
    });

    it('should work when no configPath is provided (uses createDefaultConfig)', async () => {
      const session = await runTests({ suite: 'smoke' });
      expect(session).toHaveProperty('id');
    });

    it('should return a dry-run session without executing tests', async () => {
      const session = await runTests({ dryRun: true, suite: 'smoke' });

      expect(session.status).toBe(TestStatus.PASSED);
      expect(session.results).toEqual([]);
    });

    it('should not throw for any valid suite value', async () => {
      for (const suite of ['smoke', 'full', 'regression'] as const) {
        await expect(
          runTests({ suite })
        ).resolves.toBeDefined();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Bug #2: loadTestScenarios calls parseYamlScenarios with content not path
  // -------------------------------------------------------------------------
  describe('loadTestScenarios() - Bug #105 Fix 2: YAML content vs path', () => {
    it('should parse scenario files by reading content then using string-based parsing', async () => {
      const { parseScenariosFromString } = jest.requireMock('../utils/yamlParser');
      const mockFs = jest.requireMock('fs/promises');

      const validYamlContent = `
id: s1
name: Scenario One
description: First test scenario
priority: high
interface: cli
steps:
  - action: execute
    target: echo hello
verifications: []
`;
      mockFs.readFile.mockResolvedValue(validYamlContent);
      parseScenariosFromString.mockResolvedValue([
        {
          id: 's1',
          name: 'Scenario One',
          description: 'First test scenario',
          priority: 'HIGH',
          interface: 'CLI',
          steps: [{ action: 'execute', target: 'echo hello' }],
          verifications: [],
          prerequisites: [],
          tags: [],
          enabled: true,
          estimatedDuration: 60,
          expectedOutcome: '',
        },
      ]);

      const scenarios = await loadTestScenarios(['./scenarios/s1.yaml']);

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].id).toBe('s1');
      // Verify fs.readFile was called with the file path (not YAML content)
      expect(mockFs.readFile).toHaveBeenCalledWith('./scenarios/s1.yaml', 'utf-8');
      // Verify the string-based parser was called with the CONTENT, not the path
      expect(parseScenariosFromString).toHaveBeenCalledWith(validYamlContent);
    });

    it('should return empty array when no scenario files provided and directory missing', async () => {
      const { pathExists } = jest.requireMock('fs-extra');
      pathExists.mockResolvedValue(false);

      const scenarios = await loadTestScenarios();
      expect(scenarios).toEqual([]);
    });

    it('should handle errors in scenario files gracefully', async () => {
      const mockFs = jest.requireMock('fs/promises');
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      // Should not throw — errors are caught and logged
      const scenarios = await loadTestScenarios(['./scenarios/missing.yaml']);
      expect(scenarios).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // loadConfiguration — verifies it works with a complete CliArguments object
  // -------------------------------------------------------------------------
  describe('loadConfiguration()', () => {
    it('should not throw when called with a complete CliArguments object', async () => {
      const cliArgs: CliArguments = {
        config: './config/test-config.yaml',
        suite: 'smoke',
        dryRun: false,
        logLevel: 'INFO',
        noIssues: false,
        verbose: false,
        debug: false,
      };

      const config = await loadConfiguration('./config/test-config.yaml', cliArgs);
      expect(config).toBeDefined();
      expect(config.logging.level).toBe('info');
    });

    it('should apply noIssues: true to disable GitHub issue creation', async () => {
      const cliArgs: CliArguments = {
        config: './config/test-config.yaml',
        suite: 'smoke',
        dryRun: false,
        logLevel: 'INFO',
        noIssues: true,
        verbose: false,
        debug: false,
      };

      const config = await loadConfiguration('./config/test-config.yaml', cliArgs);
      expect(config.github?.createIssuesOnFailure).toBe(false);
    });

    it('should apply parallel option to config', async () => {
      const cliArgs: CliArguments = {
        config: './config/test-config.yaml',
        suite: 'full',
        dryRun: false,
        logLevel: 'DEBUG',
        noIssues: false,
        verbose: true,
        debug: false,
        parallel: 5,
      };

      const config = await loadConfiguration('./config/test-config.yaml', cliArgs);
      expect(config.execution.maxParallel).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // filterScenariosForSuite — unchanged, just a smoke test
  // -------------------------------------------------------------------------
  describe('filterScenariosForSuite()', () => {
    it('should return all scenarios for the "full" suite', () => {
      const scenarios = [
        { id: 'a', tags: ['smoke'] },
        { id: 'b', tags: ['regression'] },
      ] as any[];

      const result = filterScenariosForSuite(scenarios, 'full');
      expect(result).toHaveLength(2);
    });

    it('should return all scenarios for the "regression" suite', () => {
      const scenarios = [{ id: 'x', tags: [] }, { id: 'y', tags: [] }] as any[];
      const result = filterScenariosForSuite(scenarios, 'regression');
      expect(result).toHaveLength(2);
    });

    it('should filter by smoke prefix for smoke suite', () => {
      const scenarios = [
        { id: 'smoke:login', tags: ['smoke'] },
        { id: 'regression:checkout', tags: ['regression'] },
      ] as any[];

      const result = filterScenariosForSuite(scenarios, 'smoke');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('smoke:login');
    });
  });
});
