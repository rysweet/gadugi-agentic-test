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
agents:
  - id: tui-agent
    type: tui
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

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/login.yaml');

      expect(scenarios).toHaveLength(1);
      const scenario = scenarios[0];
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
  agents:
    - id: cli-agent
      type: cli
  steps:
    - name: step one
      agent: cli-agent
      action: execute
      params:
        command: echo hello
`;
      mockFs.readFile.mockResolvedValue(wrappedYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/wrapped.yaml');

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].name).toBe('Wrapped Scenario');
      expect(scenarios[0].steps).toHaveLength(1);
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

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/legacy.yaml');

      expect(scenarios).toHaveLength(1);
      const scenario = scenarios[0];
      expect(scenario.name).toBe('First Scenario');
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

    it('should throw for scenario missing agents', async () => {
      const noAgentsYaml = `
name: No Agents
steps:
  - name: step one
    agent: agent-1
    action: run
`;
      mockFs.readFile.mockResolvedValue(noAgentsYaml);

      await expect(ScenarioLoader.loadFromFile('/scenarios/noagents.yaml')).rejects.toThrow('Scenario must have at least one agent');
    });

    it('should throw for scenario with empty agents array', async () => {
      const emptyAgentsYaml = `
name: Empty Agents
agents: []
steps:
  - name: step one
    agent: agent-1
    action: run
`;
      mockFs.readFile.mockResolvedValue(emptyAgentsYaml);

      await expect(ScenarioLoader.loadFromFile('/scenarios/emptyagents.yaml')).rejects.toThrow('Scenario must have at least one agent');
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
agents:
  - id: a
    type: cli
steps:
  - name: s1
    agent: a
    action: run
`;
      const scenario2 = `
name: Test 2
agents:
  - id: b
    type: tui
steps:
  - name: s2
    agent: b
    action: execute
`;
      const scenario3 = `
name: Test 3
agents:
  - id: c
    type: cli
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

    it('should warn and skip individual files that fail to load', async () => {
      mockFs.readdir.mockResolvedValue([
        'bad.yaml'
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockFs.readFile.mockResolvedValue('name: Bad\n# no steps');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await ScenarioLoader.loadFromDirectory('/scenarios');
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load scenario from')
      );
      consoleSpy.mockRestore();
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

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/timeout.yaml');

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].config?.timeout).toBe(60000);
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

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/no-assertions.yaml');

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].assertions).toEqual([]);
    });

    it('should load all scenarios from legacy format (not just the first)', async () => {
      const legacyYaml = `
name: Multi Suite
application:
  timeout: 60
scenarios:
  - name: Scenario A
    steps:
      - action: launch
        input: app.exe
        conditions: []
  - name: Scenario B
    steps:
      - action: run
        input: test.sh
        conditions: []
`;
      mockFs.readFile.mockResolvedValue(legacyYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/multi.yaml');

      expect(scenarios).toHaveLength(2);
      expect(scenarios[0].name).toBe('Scenario A');
      expect(scenarios[1].name).toBe('Scenario B');
    });

    it('should use cli-agent for scenarios with type: cli', async () => {
      const cliYaml = `
scenarios:
  - name: CLI Test
    type: cli
    steps:
      - type: command
        command: "node --version"
        expected: "v"
`;
      mockFs.readFile.mockResolvedValue(cliYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/cli.yaml');

      expect(scenarios).toHaveLength(1);
      const scenario = scenarios[0];
      expect(scenario.agents[0].name).toBe('cli-agent');
      expect(scenario.agents[0].type).toBe('cli');
      expect(scenario.steps[0].agent).toBe('cli-agent');
      expect(scenario.steps[0].action).toBe('command');
      expect(scenario.steps[0].target).toBe('node --version');
      expect(scenario.steps[0].expected).toBe('v');
    });

    it('should default to tui-agent for scenarios without type', async () => {
      const tuiYaml = `
scenarios:
  - name: TUI Test
    steps:
      - action: launch
        input: app.exe
        conditions: []
`;
      mockFs.readFile.mockResolvedValue(tuiYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/tui.yaml');

      expect(scenarios[0].agents[0].name).toBe('tui-agent');
      expect(scenarios[0].agents[0].type).toBe('tui');
    });
  });

  describe('convertLegacyFormat — CLI step edge cases (issue #202)', () => {
    it('should map expected_output field to step.expected', async () => {
      const cliYaml = `
scenarios:
  - name: Expected Output Test
    type: cli
    steps:
      - type: command
        command: "echo hello"
        expected_output: "hello"
`;
      mockFs.readFile.mockResolvedValue(cliYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/expected-output.yaml');

      expect(scenarios[0].steps[0].expected).toBe('hello');
    });

    it('should prefer expected_output over expected when both present', async () => {
      const cliYaml = `
scenarios:
  - name: Dual Expected Test
    type: cli
    steps:
      - type: command
        command: "node --version"
        expected_output: "from_expected_output"
        expected: "from_expected"
`;
      mockFs.readFile.mockResolvedValue(cliYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/dual-expected.yaml');

      expect(scenarios[0].steps[0].expected).toBe('from_expected_output');
    });

    it('should handle CLI step with type: command but missing command field', async () => {
      const cliYaml = `
scenarios:
  - name: Missing Command Test
    type: cli
    steps:
      - type: command
        description: "A step without a command"
`;
      mockFs.readFile.mockResolvedValue(cliYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/missing-cmd.yaml');

      // action should still be 'command' (mapped from type)
      expect(scenarios[0].steps[0].action).toBe('command');
      // target should NOT be set when command field is missing
      expect(scenarios[0].steps[0].target).toBeUndefined();
    });

    it('should support mixed CLI and TUI scenarios in the same file', async () => {
      const mixedYaml = `
scenarios:
  - name: CLI Part
    type: cli
    steps:
      - type: command
        command: "node --version"
  - name: TUI Part
    steps:
      - action: launch
        input: app.exe
        conditions: []
`;
      mockFs.readFile.mockResolvedValue(mixedYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/mixed.yaml');

      expect(scenarios).toHaveLength(2);
      expect(scenarios[0].agents[0].type).toBe('cli');
      expect(scenarios[0].steps[0].action).toBe('command');
      expect(scenarios[1].agents[0].type).toBe('tui');
      expect(scenarios[1].steps[0].action).toBe('launch');
    });

    it('should inherit suite-level type: cli when scenario has no own type', async () => {
      const suiteCliYaml = `
type: cli
scenarios:
  - name: Inherited CLI Test
    steps:
      - type: command
        command: "echo hi"
`;
      mockFs.readFile.mockResolvedValue(suiteCliYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/suite-cli.yaml');

      expect(scenarios[0].agents[0].name).toBe('cli-agent');
      expect(scenarios[0].agents[0].type).toBe('cli');
    });

    it('should propagate suite-level version to all scenarios', async () => {
      const suiteYaml = `
version: "2.1"
scenarios:
  - name: S1
    type: cli
    steps:
      - type: command
        command: "echo 1"
  - name: S2
    type: cli
    steps:
      - type: command
        command: "echo 2"
`;
      mockFs.readFile.mockResolvedValue(suiteYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/versioned.yaml');

      expect(scenarios).toHaveLength(2);
      expect(scenarios[0].version).toBe('2.1');
      expect(scenarios[1].version).toBe('2.1');
    });

    it('should use step description as name fallback', async () => {
      const cliYaml = `
scenarios:
  - name: Name Fallback Test
    type: cli
    steps:
      - type: command
        command: "node --version"
        description: "Check node version"
`;
      mockFs.readFile.mockResolvedValue(cliYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/name-fallback.yaml');

      expect(scenarios[0].steps[0].name).toBe('Check node version');
    });

    it('should use command string as step name when no description', async () => {
      const cliYaml = `
scenarios:
  - name: Command Name Test
    type: cli
    steps:
      - type: command
        command: "npm test"
`;
      mockFs.readFile.mockResolvedValue(cliYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/cmd-name.yaml');

      expect(scenarios[0].steps[0].name).toBe('npm test');
    });

    it('should store command in params.command for downstream consumers', async () => {
      const cliYaml = `
scenarios:
  - name: Params Command Test
    type: cli
    steps:
      - type: command
        command: "node --version"
`;
      mockFs.readFile.mockResolvedValue(cliYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/params-cmd.yaml');

      expect(scenarios[0].steps[0].params?.['command']).toBe('node --version');
    });

    it('should extract per-step timeout from conditions array', async () => {
      const cliYaml = `
scenarios:
  - name: Step Timeout Test
    type: cli
    steps:
      - type: command
        command: "slow-command"
        conditions:
          - timeout: 90
`;
      mockFs.readFile.mockResolvedValue(cliYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/step-timeout.yaml');

      expect(scenarios[0].steps[0].timeout).toBe(90000);
    });
  });

  describe('loadFromDirectory with legacy multi-scenario files (issue #202)', () => {
    it('should flatten multiple scenarios from a single legacy file into the directory result', async () => {
      mockFs.readdir.mockResolvedValue([
        'multi.yaml',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const multiYaml = `
scenarios:
  - name: Scenario A
    type: cli
    steps:
      - type: command
        command: "echo A"
  - name: Scenario B
    type: cli
    steps:
      - type: command
        command: "echo B"
`;
      mockFs.readFile.mockResolvedValue(multiYaml);

      const scenarios = await ScenarioLoader.loadFromDirectory('/scenarios');

      expect(scenarios).toHaveLength(2);
      expect(scenarios[0].name).toBe('Scenario A');
      expect(scenarios[1].name).toBe('Scenario B');
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
agents:
  - id: cli-agent
    type: cli
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

      expect(scenario).toHaveLength(1);
      expect(scenario[0].name).toBe('Safe Scenario');
      expect(scenario[0].steps).toHaveLength(1);
    });
  });

  describe('validateScenario (via loadFromFile)', () => {
    it('should accept scenario with only name, steps, and agents', async () => {
      const minimalYaml = `
name: Minimal
agents:
  - id: agent-1
    type: cli
steps:
  - name: do something
    agent: agent-1
    action: act
`;
      mockFs.readFile.mockResolvedValue(minimalYaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/minimal.yaml');

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].name).toBe('Minimal');
      expect(scenarios[0].steps).toHaveLength(1);
    });

    it('should accept scenario with steps as non-empty array', async () => {
      const yaml = `
name: Array Steps
agents:
  - id: a1
    type: cli
steps:
  - name: first
    agent: a1
    action: run
  - name: second
    agent: a2
    action: execute
`;
      mockFs.readFile.mockResolvedValue(yaml);

      const scenarios = await ScenarioLoader.loadFromFile('/scenarios/array-steps.yaml');

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].steps).toHaveLength(2);
    });
  });
});
