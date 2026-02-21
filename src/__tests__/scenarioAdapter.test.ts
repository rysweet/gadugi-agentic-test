import { adaptScenarioToComplex } from '../adapters/scenarioAdapter';
import { ScenarioDefinition } from '../scenarios';
import { Priority, TestInterface } from '../models/TestModels';

describe('scenarioAdapter', () => {
  const makeScenario = (overrides: Partial<ScenarioDefinition> = {}): ScenarioDefinition => ({
    name: 'Test Scenario',
    description: 'A test scenario',
    agents: [{ name: 'tui-agent', type: 'tui', config: {} }],
    steps: [
      { name: 'step 1', agent: 'tui-agent', action: 'spawn_tui', params: { command: 'node', args: ['app.js'] }, timeout: 10000 }
    ],
    assertions: [
      { name: 'check output', type: 'contains', agent: 'tui-agent', params: { target: 'screen', expected: 'Welcome' } }
    ],
    cleanup: [],
    metadata: { tags: ['tui'], priority: 'high' },
    ...overrides
  });

  describe('adaptScenarioToComplex', () => {
    it('should produce a ComplexScenario with a UUID id', () => {
      const result = adaptScenarioToComplex(makeScenario());

      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should carry over name and description', () => {
      const result = adaptScenarioToComplex(makeScenario({
        name: 'My Test',
        description: 'My description'
      }));

      expect(result.name).toBe('My Test');
      expect(result.description).toBe('My description');
    });

    it('should generate default description when missing', () => {
      const result = adaptScenarioToComplex(makeScenario({ description: undefined }));

      expect(result.description).toContain('Test scenario');
    });

    it('should set enabled to true', () => {
      const result = adaptScenarioToComplex(makeScenario());
      expect(result.enabled).toBe(true);
    });

    it('should convert steps to OrchestratorStep format', () => {
      const result = adaptScenarioToComplex(makeScenario());

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].action).toBe('spawn_tui');
      expect(result.steps[0].target).toBe('node app.js');
    });

    it('should convert assertions to verifications', () => {
      const result = adaptScenarioToComplex(makeScenario());

      expect(result.verifications).toHaveLength(1);
      expect(result.verifications[0].type).toBe('contains');
      expect(result.verifications[0].target).toBe('screen');
      expect(result.verifications[0].operator).toBe('equals');
    });

    it('should handle empty steps gracefully', () => {
      const result = adaptScenarioToComplex(makeScenario({ steps: [] }));
      expect(result.steps).toEqual([]);
    });

    it('should handle undefined steps gracefully', () => {
      const result = adaptScenarioToComplex(makeScenario({ steps: undefined as unknown as ScenarioDefinition['steps'] }));
      expect(result.steps).toEqual([]);
    });

    it('should handle empty assertions gracefully', () => {
      const result = adaptScenarioToComplex(makeScenario({ assertions: [] }));
      expect(result.verifications).toEqual([]);
    });

    it('should handle undefined assertions gracefully', () => {
      const result = adaptScenarioToComplex(makeScenario({ assertions: undefined as unknown as ScenarioDefinition['assertions'] }));
      expect(result.verifications).toEqual([]);
    });

    it('should convert cleanup steps', () => {
      const result = adaptScenarioToComplex(makeScenario({
        cleanup: [{ name: 'cleanup step', agent: 'cli', action: 'execute', params: { command: 'rm -rf temp' } }]
      }));

      expect(result.cleanup).toHaveLength(1);
      expect(result.cleanup![0].action).toBe('execute');
      expect(result.cleanup![0].target).toBe('rm -rf temp');
    });

    it('should set cleanup to undefined when source has no cleanup', () => {
      const result = adaptScenarioToComplex(makeScenario({ cleanup: undefined }));
      expect(result.cleanup).toBeUndefined();
    });

    it('should map prerequisites from environment.requires', () => {
      const result = adaptScenarioToComplex(makeScenario({
        environment: { requires: ['node', 'npm'] }
      }));

      expect(result.prerequisites).toEqual(['node', 'npm']);
    });

    it('should default prerequisites to empty array', () => {
      const result = adaptScenarioToComplex(makeScenario({ environment: undefined }));
      expect(result.prerequisites).toEqual([]);
    });

    it('should calculate estimatedDuration from config.timeout', () => {
      const result = adaptScenarioToComplex(makeScenario({
        config: { timeout: 120000 }
      }));

      expect(result.estimatedDuration).toBe(120);
    });

    it('should default estimatedDuration to 60 when no config timeout', () => {
      const result = adaptScenarioToComplex(makeScenario({ config: undefined }));
      expect(result.estimatedDuration).toBe(60);
    });

    it('should carry over tags from metadata', () => {
      const result = adaptScenarioToComplex(makeScenario({
        metadata: { tags: ['smoke', 'regression'] }
      }));

      expect(result.tags).toEqual(['smoke', 'regression']);
    });
  });

  describe('mapPriority', () => {
    it('should map critical to Priority.CRITICAL', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { priority: 'critical' } }));
      expect(result.priority).toBe(Priority.CRITICAL);
    });

    it('should map high to Priority.HIGH', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { priority: 'high' } }));
      expect(result.priority).toBe(Priority.HIGH);
    });

    it('should map medium to Priority.MEDIUM', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { priority: 'medium' } }));
      expect(result.priority).toBe(Priority.MEDIUM);
    });

    it('should map low to Priority.LOW', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { priority: 'low' } }));
      expect(result.priority).toBe(Priority.LOW);
    });

    it('should default to Priority.MEDIUM for undefined priority', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { tags: [] } }));
      expect(result.priority).toBe(Priority.MEDIUM);
    });

    it('should default to Priority.MEDIUM for unrecognized priority', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { priority: 'urgent' as 'critical' } }));
      expect(result.priority).toBe(Priority.MEDIUM);
    });
  });

  describe('mapInterface', () => {
    it('should map tui tag to TestInterface.TUI', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { tags: ['tui'] } }));
      expect(result.interface).toBe(TestInterface.TUI);
    });

    it('should map cli tag to TestInterface.CLI', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { tags: ['cli'] } }));
      expect(result.interface).toBe(TestInterface.CLI);
    });

    it('should map web tag to TestInterface.GUI', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { tags: ['web'] } }));
      expect(result.interface).toBe(TestInterface.GUI);
    });

    it('should map ui tag to TestInterface.GUI', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { tags: ['ui'] } }));
      expect(result.interface).toBe(TestInterface.GUI);
    });

    it('should map electron tag to TestInterface.GUI', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { tags: ['electron'] } }));
      expect(result.interface).toBe(TestInterface.GUI);
    });

    it('should default to TestInterface.CLI when no matching tags', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: { tags: ['smoke', 'regression'] } }));
      expect(result.interface).toBe(TestInterface.CLI);
    });

    it('should default to TestInterface.CLI when no metadata', () => {
      const result = adaptScenarioToComplex(makeScenario({ metadata: undefined }));
      expect(result.interface).toBe(TestInterface.CLI);
    });
  });

  describe('adaptStepToOrchestrator', () => {
    it('should combine command and args into target', () => {
      const result = adaptScenarioToComplex(makeScenario({
        steps: [{ name: 'spawn', agent: 'tui', action: 'spawn_tui', params: { command: 'node', args: ['--flag', 'file.js'] } }]
      }));

      expect(result.steps[0].target).toBe('node --flag file.js');
    });

    it('should use command alone when no args', () => {
      const result = adaptScenarioToComplex(makeScenario({
        steps: [{ name: 'run', agent: 'cli', action: 'execute', params: { command: 'ls' } }]
      }));

      expect(result.steps[0].target).toBe('ls');
    });

    it('should handle text params as value', () => {
      const result = adaptScenarioToComplex(makeScenario({
        steps: [{ name: 'type', agent: 'tui', action: 'send_text', params: { text: 'hello world' } }]
      }));

      expect(result.steps[0].value).toBe('hello world');
      expect(result.steps[0].target).toBe('');
    });

    it('should handle duration params as value', () => {
      const result = adaptScenarioToComplex(makeScenario({
        steps: [{ name: 'wait', agent: 'tui', action: 'wait', params: { duration: 5000 } }]
      }));

      expect(result.steps[0].value).toBe('5000');
    });

    it('should fallback to first param value as target', () => {
      const result = adaptScenarioToComplex(makeScenario({
        steps: [{ name: 'custom', agent: 'agent', action: 'custom', params: { selector: '#button' } }]
      }));

      expect(result.steps[0].target).toBe('#button');
    });

    it('should handle empty params', () => {
      const result = adaptScenarioToComplex(makeScenario({
        steps: [{ name: 'noop', agent: 'agent', action: 'noop', params: {} }]
      }));

      expect(result.steps[0].target).toBe('');
    });

    it('should preserve timeout from step', () => {
      const result = adaptScenarioToComplex(makeScenario({
        steps: [{ name: 'timed', agent: 'agent', action: 'run', params: { command: 'slow' }, timeout: 60000 }]
      }));

      expect(result.steps[0].timeout).toBe(60000);
    });
  });
});
