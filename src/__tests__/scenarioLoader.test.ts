import { ScenarioLoader, ScenarioDefinition } from '../scenarios';
import * as fs from 'fs/promises';

jest.mock('fs/promises');
const mockFs = jest.mocked(fs);

describe('ScenarioLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadFromFile', () => {
    it('should parse a canonical format YAML scenario', async () => {
      const yamlContent = `
name: Login Test
description: Test the login flow
steps:
  - name: launch app
    agent: tui-agent
    action: spawn_tui
    params:
      command: node
      args: [app.js]
    timeout: 10000
assertions:
  - name: check output
    type: contains
    agent: tui-agent
    params:
      value: Welcome
`;
      mockFs.readFile.mockResolvedValue(yamlContent);

      const scenario = await ScenarioLoader.loadFromFile('/scenarios/login.yaml');

      expect(scenario.name).toBe('Login Test');
      expect(scenario.description).toBe('Test the login flow');
      expect(scenario.steps).toHaveLength(1);
      expect(scenario.steps[0].action).toBe('spawn_tui');
      expect(scenario.assertions).toHaveLength(1);
    });

    it('should parse a wrapped format (scenario: {...}) YAML', async () => {
      const wrappedYaml = `
scenario:
  name: Wrapped Scenario
  steps:
    - name: step one
      agent: cli-agent
      action: execute
      params:
        command: echo hello
`;
      mockFs.readFile.mockResolvedValue(wrappedYaml);

      const scenario = await ScenarioLoader.loadFromFile('/scenarios/wrapped.yaml');

      expect(scenario.name).toBe('Wrapped Scenario');
      expect(scenario.steps).toHaveLength(1);
    });

    it('should convert legacy format with application/scenarios', async () => {
      const legacyYaml = `
name: Legacy Suite
description: Legacy test suite
version: "1.0"
application:
  timeout: 120
scenarios:
  - name: First Scenario
    description: The first test
    steps:
      - action: launch
        description: Launch the app
        input: app.exe
        conditions:
          - timeout: 30
    assertions:
      - type: output_contains
        description: Check welcome
        value: Welcome
`;
      mockFs.readFile.mockResolvedValue(legacyYaml);

      const scenario = await ScenarioLoader.loadFromFile('/scenarios/legacy.yaml');

      expect(scenario.name).toBe('Legacy Suite');
      expect(scenario.steps).toHaveLength(1);
      expect(scenario.steps[0].agent).toBe('tui-agent');
      expect(scenario.metadata?.tags).toContain('legacy-format');
    });

    it('should throw for scenario missing name', async () => {
      const noNameYaml = `
steps:
  - name: step one
    agent: cli-agent
    action: run
`;
      mockFs.readFile.mockResolvedValue(noNameYaml);

      await expect(ScenarioLoader.loadFromFile('/scenarios/noname.yaml')).rejects.toThrow('Scenario must have a name');
    });

    it('should throw for scenario missing steps', async () => {
      const noStepsYaml = `
name: No Steps
description: Missing steps array
`;
      mockFs.readFile.mockResolvedValue(noStepsYaml);

      await expect(ScenarioLoader.loadFromFile('/scenarios/nosteps.yaml')).rejects.toThrow('Scenario must have steps array');
    });

    it('should throw when file cannot be read', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(ScenarioLoader.loadFromFile('/nonexistent.yaml')).rejects.toThrow();
    });
  });

  describe('loadFromDirectory', () => {
    it('should load all YAML files from directory', async () => {
      mockFs.readdir.mockResolvedValue([
        'test1.yaml',
        'test2.yml',
        'readme.md',
        'test3.yaml'
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const scenario1 = `
name: Test 1
steps:
  - name: s1
    agent: a
    action: run
`;
      const scenario2 = `
name: Test 2
steps:
  - name: s2
    agent: b
    action: execute
`;
      const scenario3 = `
name: Test 3
steps:
  - name: s3
    agent: c
    action: click
`;
      mockFs.readFile
        .mockResolvedValueOnce(scenario1)
        .mockResolvedValueOnce(scenario2)
        .mockResolvedValueOnce(scenario3);

      const scenarios = await ScenarioLoader.loadFromDirectory('/scenarios');

      expect(scenarios).toHaveLength(3);
      expect(scenarios[0].name).toBe('Test 1');
      expect(scenarios[1].name).toBe('Test 2');
      expect(scenarios[2].name).toBe('Test 3');
    });

    it('should filter non-YAML files', async () => {
      mockFs.readdir.mockResolvedValue([
        'readme.md',
        'config.json',
        'notes.txt'
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const scenarios = await ScenarioLoader.loadFromDirectory('/scenarios');

      expect(scenarios).toHaveLength(0);
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should throw when directory cannot be read', async () => {
      mockFs.readdir.mockRejectedValue(new Error('ENOENT: no such directory'));

      await expect(ScenarioLoader.loadFromDirectory('/nonexistent')).rejects.toThrow();
    });

    it('should propagate errors from individual file loads', async () => {
      mockFs.readdir.mockResolvedValue([
        'bad.yaml'
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockFs.readFile.mockResolvedValue('name: Bad\n# no steps');

      await expect(ScenarioLoader.loadFromDirectory('/scenarios')).rejects.toThrow('Scenario must have steps array');
    });
  });

  describe('convertLegacyFormat', () => {
    it('should use application timeout converted to milliseconds', async () => {
      const legacyYaml = `
application:
  timeout: 60
scenarios:
  - name: Timeout Test
    steps:
      - action: wait
        description: Wait for it
        input: something
        conditions: []
    assertions: []
`;
      mockFs.readFile.mockResolvedValue(legacyYaml);

      const scenario = await ScenarioLoader.loadFromFile('/scenarios/timeout.yaml');

      expect(scenario.config?.timeout).toBe(60000);
    });

    it('should handle legacy scenario without assertions', async () => {
      const legacyYaml = `
scenarios:
  - name: No Assertions
    steps:
      - action: run
        input: cmd
        conditions: []
`;
      mockFs.readFile.mockResolvedValue(legacyYaml);

      const scenario = await ScenarioLoader.loadFromFile('/scenarios/no-assertions.yaml');

      expect(scenario.assertions).toEqual([]);
    });
  });

  describe('JSON_SCHEMA enforcement (security: issue #83)', () => {
    it('should reject !!js/function tags in loadFromFile to prevent code execution', async () => {
      // !!js/function allows arbitrary JavaScript execution during YAML deserialization.
      // ScenarioLoader.loadFromFile must use yaml.JSON_SCHEMA to block these tags.
      const dangerousYaml = `
name: Exploit
steps:
  - name: evil
    agent: tui-agent
    action: run
fn: !!js/function 'function() { require("child_process").execSync("id"); }'
`;
      mockFs.readFile.mockResolvedValue(dangerousYaml);

      await expect(ScenarioLoader.loadFromFile('/scenarios/exploit.yaml')).rejects.toThrow();
    });

    it('should reject !!js/regexp tags in loadFromFile', async () => {
      const dangerousYaml = `
name: Regexp Exploit
steps:
  - name: step
    agent: agent
    action: run
pattern: !!js/regexp /.*secret.*/i
`;
      mockFs.readFile.mockResolvedValue(dangerousYaml);

      await expect(ScenarioLoader.loadFromFile('/scenarios/regexp.yaml')).rejects.toThrow();
    });

    it('should still accept safe YAML after JSON_SCHEMA restriction', async () => {
      const safeYaml = `
name: Safe Scenario
description: Uses only JSON-compatible types
steps:
  - name: step one
    agent: cli-agent
    action: execute
    timeout: 5000
assertions:
  - name: check
    type: contains
    agent: cli-agent
    params:
      value: ok
`;
      mockFs.readFile.mockResolvedValue(safeYaml);

      const scenario = await ScenarioLoader.loadFromFile('/scenarios/safe.yaml');

      expect(scenario.name).toBe('Safe Scenario');
      expect(scenario.steps).toHaveLength(1);
    });
  });

  describe('validateScenario (via loadFromFile)', () => {
    it('should accept scenario with only name and steps', async () => {
      const minimalYaml = `
name: Minimal
steps:
  - name: do something
    agent: agent-1
    action: act
`;
      mockFs.readFile.mockResolvedValue(minimalYaml);

      const scenario = await ScenarioLoader.loadFromFile('/scenarios/minimal.yaml');

      expect(scenario.name).toBe('Minimal');
      expect(scenario.steps).toHaveLength(1);
    });

    it('should accept scenario with steps as non-empty array', async () => {
      const yaml = `
name: Array Steps
steps:
  - name: first
    agent: a1
    action: run
  - name: second
    agent: a2
    action: execute
`;
      mockFs.readFile.mockResolvedValue(yaml);

      const scenario = await ScenarioLoader.loadFromFile('/scenarios/array-steps.yaml');

      expect(scenario.steps).toHaveLength(2);
    });
  });
});
