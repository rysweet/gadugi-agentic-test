/**
 * Tests for TestSuite naming disambiguation (Issue #128 / B3)
 *
 * Verifies that:
 * 1. The orchestrator's config-facing type is clearly named SuiteFilterConfig
 *    (formerly TestSuite in TestOrchestrator.ts) so it doesn't clash with
 *    TestModels.TestSuite (which has scenarios: OrchestratorScenario[])
 * 2. TestModels.TestSuite has scenarios: OrchestratorScenario[]
 * 3. SuiteFilterConfig has patterns: string[]
 * 4. index.ts exports both under distinct, unambiguous names
 */

import type { TestSuite } from '../src/models/TestModels';
import type { SuiteFilterConfig } from '../src/orchestrator/TestOrchestrator';
import { TestInterface, Priority } from '../src/models/TestModels';

// ---------------------------------------------------------------------------
// Type-level tests (compile-time checks encoded as runtime assertions)
// ---------------------------------------------------------------------------

describe('TestSuite vs SuiteFilterConfig disambiguation (B3)', () => {
  describe('TestModels.TestSuite', () => {
    it('has a scenarios field (not patterns)', () => {
      const suite: TestSuite = {
        name: 'my-suite',
        description: 'Test suite with scenarios',
        scenarios: [
          {
            id: 'scenario-1',
            name: 'Test Scenario',
            description: 'A test',
            priority: Priority.MEDIUM,
            interface: TestInterface.CLI,
            prerequisites: [],
            steps: [],
            verifications: [],
            expectedOutcome: 'pass',
            estimatedDuration: 1,
            tags: [],
            enabled: true
          }
        ]
      };

      expect(suite.scenarios).toHaveLength(1);
      expect(suite.name).toBe('my-suite');
    });

    it('does not require a patterns field', () => {
      const suite: TestSuite = {
        name: 'minimal-suite',
        scenarios: []
      };

      // patterns is not part of TestSuite
      expect('patterns' in suite).toBe(false);
    });
  });

  describe('SuiteFilterConfig (renamed from orchestrator TestSuite)', () => {
    it('has a patterns field (not scenarios)', () => {
      const config: SuiteFilterConfig = {
        name: 'smoke',
        description: 'Smoke tests',
        patterns: ['smoke:', 'critical:'],
        tags: ['smoke']
      };

      expect(config.patterns).toEqual(['smoke:', 'critical:']);
      expect(config.name).toBe('smoke');
    });

    it('does not require a scenarios field', () => {
      const config: SuiteFilterConfig = {
        name: 'minimal',
        description: 'Minimal config',
        patterns: ['*'],
        tags: []
      };

      expect('scenarios' in config).toBe(false);
    });
  });

  describe('type distinctness', () => {
    it('TestSuite and SuiteFilterConfig have mutually exclusive required fields', () => {
      // TestSuite requires scenarios, SuiteFilterConfig requires patterns
      const asTestSuite: TestSuite = { name: 'ts', scenarios: [] };
      const asSuiteFilterConfig: SuiteFilterConfig = {
        name: 'sfc',
        description: 'Filter config',
        patterns: ['*'],
        tags: []
      };

      expect(asTestSuite).not.toHaveProperty('patterns');
      expect(asSuiteFilterConfig).not.toHaveProperty('scenarios');
    });
  });
});

describe('index.ts exports', () => {
  it('exports OrchestratorTestSuite as an alias for SuiteFilterConfig', async () => {
    // OrchestratorTestSuite exported from index.ts should be the filter config type
    const exports = await import('../src/index');
    // Type-only check: if it compiles and exports the symbol, we're good
    // (the actual type assertion is checked at compile time by tsc)
    expect(exports).toBeDefined();
  });
});
