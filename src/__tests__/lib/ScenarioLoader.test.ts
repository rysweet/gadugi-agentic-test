/**
 * Tests for src/lib/ScenarioLoader.ts
 *
 * Covers:
 *   - loadTestScenarios()  with explicit file path array
 *   - loadTestScenarios()  falling back to <cwd>/scenarios/ directory
 *   - filterScenariosForSuite() with 'smoke'  suite
 *   - filterScenariosForSuite() with 'full'   suite (returns all)
 *   - filterScenariosForSuite() with unknown  suite name (logs warning, returns all)
 */

// ---------------------------------------------------------------------------
// Mocks — declared before any imports so Jest hoists them correctly
// ---------------------------------------------------------------------------

jest.mock('fs/promises', () => ({
  readFile:  jest.fn(),
  readdir:   jest.fn(),
}));

jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
}));

jest.mock('../../utils/yamlParser', () => ({
  parseScenariosFromString: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import * as fs from 'fs/promises';
import { pathExists } from 'fs-extra';
import { parseScenariosFromString } from '../../utils/yamlParser';
import {
  loadTestScenarios,
  filterScenariosForSuite,
} from '../../lib/ScenarioLoader';
import type { OrchestratorScenario } from '../../models/TestModels';
import { TestInterface, Priority } from '../../models/TestModels';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScenario(id: string, tags: string[] = []): OrchestratorScenario {
  return {
    id,
    name: `Scenario ${id}`,
    description: '',
    priority: Priority.MEDIUM,
    interface: TestInterface.CLI,
    prerequisites: [],
    steps: [],
    verifications: [],
    expectedOutcome: 'pass',
    estimatedDuration: 1,
    tags,
    enabled: true,
  };
}

const mockReadFile   = jest.mocked(fs.readFile);
const mockReaddir    = jest.mocked(fs.readdir);
const mockPathExists = jest.mocked(pathExists);
const mockParse      = jest.mocked(parseScenariosFromString);

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// loadTestScenarios — explicit file list
// ===========================================================================
describe('loadTestScenarios() with file path array', () => {
  it('reads and parses each file in the array', async () => {
    const sc1 = makeScenario('auth:login');
    const sc2 = makeScenario('auth:logout');

    mockReadFile.mockResolvedValueOnce('yaml-content-1' as any);
    mockReadFile.mockResolvedValueOnce('yaml-content-2' as any);

    mockParse
      .mockResolvedValueOnce([sc1])
      .mockResolvedValueOnce([sc2]);

    const results = await loadTestScenarios(['/a/file1.yaml', '/a/file2.yaml']);

    expect(mockReadFile).toHaveBeenCalledTimes(2);
    expect(mockReadFile).toHaveBeenCalledWith('/a/file1.yaml', 'utf-8');
    expect(mockReadFile).toHaveBeenCalledWith('/a/file2.yaml', 'utf-8');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('auth:login');
    expect(results[1].id).toBe('auth:logout');
  });

  it('logs an error and skips a file when readFile throws', async () => {
    const sc = makeScenario('smoke:health');

    mockReadFile
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce('good-yaml' as any);

    mockParse.mockResolvedValueOnce([sc]);

    const results = await loadTestScenarios(['/missing.yaml', '/good.yaml']);

    // Error logged, not thrown
    expect((logger.error as jest.Mock)).toHaveBeenCalled();
    // Only the successful file's scenarios are returned
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('smoke:health');
  });

  it('returns an empty array for an empty file list', async () => {
    const results = await loadTestScenarios([]);

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(results).toHaveLength(0);
  });

  it('accumulates scenarios from multiple files in order', async () => {
    const scenarios = [
      makeScenario('sc-a'),
      makeScenario('sc-b'),
      makeScenario('sc-c'),
    ];

    mockReadFile
      .mockResolvedValueOnce('yaml1' as any)
      .mockResolvedValueOnce('yaml2' as any)
      .mockResolvedValueOnce('yaml3' as any);

    mockParse
      .mockResolvedValueOnce([scenarios[0]])
      .mockResolvedValueOnce([scenarios[1]])
      .mockResolvedValueOnce([scenarios[2]]);

    const results = await loadTestScenarios(['/f1.yaml', '/f2.yaml', '/f3.yaml']);

    expect(results.map(s => s.id)).toEqual(['sc-a', 'sc-b', 'sc-c']);
  });
});

// ===========================================================================
// loadTestScenarios — fall-back to scenarios/ directory
// ===========================================================================
describe('loadTestScenarios() without file list (directory scan)', () => {
  it('loads all .yaml and .yml files from the scenarios directory', async () => {
    mockPathExists.mockResolvedValue(true as any);
    mockReaddir.mockResolvedValue(['test1.yaml', 'test2.yml', 'notes.md'] as any);

    const sc1 = makeScenario('dir:test1');
    const sc2 = makeScenario('dir:test2');

    mockReadFile
      .mockResolvedValueOnce('yaml1' as any)
      .mockResolvedValueOnce('yaml2' as any);

    mockParse
      .mockResolvedValueOnce([sc1])
      .mockResolvedValueOnce([sc2]);

    const results = await loadTestScenarios();

    expect(mockReadFile).toHaveBeenCalledTimes(2); // .md ignored
    expect(results).toHaveLength(2);
  });

  it('logs a warning and returns empty array when scenarios directory does not exist', async () => {
    mockPathExists.mockResolvedValue(false as any);

    const results = await loadTestScenarios();

    expect(results).toHaveLength(0);
    expect((logger.warn as jest.Mock)).toHaveBeenCalled();
  });

  it('logs an error and returns empty array when readdir throws', async () => {
    mockPathExists.mockResolvedValue(true as any);
    mockReaddir.mockRejectedValue(new Error('EACCES'));

    const results = await loadTestScenarios();

    expect(results).toHaveLength(0);
    expect((logger.error as jest.Mock)).toHaveBeenCalled();
  });
});

// ===========================================================================
// filterScenariosForSuite — 'smoke' suite
// ===========================================================================
describe("filterScenariosForSuite() with 'smoke' suite", () => {
  it('returns scenarios whose id starts with "smoke:"', () => {
    const scenarios = [
      makeScenario('smoke:login', []),
      makeScenario('regression:full', []),
      makeScenario('smoke:health', []),
    ];

    const filtered = filterScenariosForSuite(scenarios, 'smoke');

    expect(filtered.map(s => s.id)).toEqual(['smoke:login', 'smoke:health']);
  });

  it('returns scenarios whose id starts with "auth:"', () => {
    const scenarios = [
      makeScenario('auth:login', []),
      makeScenario('data:import', []),
    ];

    const filtered = filterScenariosForSuite(scenarios, 'smoke');

    expect(filtered.map(s => s.id)).toEqual(['auth:login']);
  });

  it('returns scenarios whose id starts with "critical:"', () => {
    const scenarios = [
      makeScenario('critical:boot', []),
      makeScenario('optional:feature', []),
    ];

    const filtered = filterScenariosForSuite(scenarios, 'smoke');

    expect(filtered.map(s => s.id)).toEqual(['critical:boot']);
  });

  it('returns scenarios that carry a matching tag', () => {
    const scenarios = [
      makeScenario('generic-1', ['smoke']),
      makeScenario('generic-2', ['regression']),
      makeScenario('generic-3', ['critical']),
    ];

    const filtered = filterScenariosForSuite(scenarios, 'smoke');

    expect(filtered.map(s => s.id)).toEqual(['generic-1', 'generic-3']);
  });

  it('returns empty array when no scenarios match smoke patterns', () => {
    const scenarios = [
      makeScenario('data:export', []),
      makeScenario('perf:load', []),
    ];

    const filtered = filterScenariosForSuite(scenarios, 'smoke');

    expect(filtered).toHaveLength(0);
  });

  it('does not duplicate a scenario that matches multiple patterns', () => {
    // id starts with "smoke:" AND has tag "critical" — should appear once
    const scenarios = [makeScenario('smoke:critical-login', ['critical'])];

    const filtered = filterScenariosForSuite(scenarios, 'smoke');

    expect(filtered).toHaveLength(1);
  });
});

// ===========================================================================
// filterScenariosForSuite — 'full' suite (returns everything)
// ===========================================================================
describe("filterScenariosForSuite() with 'full' suite", () => {
  it('returns all scenarios regardless of id or tags', () => {
    const scenarios = [
      makeScenario('anything:a', []),
      makeScenario('something:b', ['tag-x']),
      makeScenario('nothing', []),
    ];

    const filtered = filterScenariosForSuite(scenarios, 'full');

    expect(filtered).toHaveLength(3);
    expect(filtered).toStrictEqual(scenarios);
  });

  it('returns empty array when input is empty', () => {
    const filtered = filterScenariosForSuite([], 'full');
    expect(filtered).toHaveLength(0);
  });
});

// ===========================================================================
// filterScenariosForSuite — 'regression' suite (also returns everything)
// ===========================================================================
describe("filterScenariosForSuite() with 'regression' suite", () => {
  it('returns all scenarios (patterns: ["*"])', () => {
    const scenarios = [makeScenario('x'), makeScenario('y')];
    const filtered = filterScenariosForSuite(scenarios, 'regression');
    expect(filtered).toHaveLength(2);
  });
});

// ===========================================================================
// filterScenariosForSuite — unknown suite name
// ===========================================================================
describe("filterScenariosForSuite() with unknown suite name", () => {
  it('logs a warning for the unknown suite', () => {
    const scenarios = [makeScenario('sc1'), makeScenario('sc2')];

    filterScenariosForSuite(scenarios, 'nonexistent-suite');

    expect((logger.warn as jest.Mock)).toHaveBeenCalledWith(
      expect.stringContaining('nonexistent-suite')
    );
  });

  it('returns all scenarios when the suite name is unknown', () => {
    const scenarios = [makeScenario('a'), makeScenario('b'), makeScenario('c')];

    const filtered = filterScenariosForSuite(scenarios, 'nonexistent-suite');

    // Falls back to returning all scenarios
    expect(filtered).toHaveLength(3);
    expect(filtered).toStrictEqual(scenarios);
  });

  it('handles empty scenario list with unknown suite', () => {
    const filtered = filterScenariosForSuite([], 'unknown');
    expect(filtered).toHaveLength(0);
  });
});
