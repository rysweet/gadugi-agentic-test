import { YamlParser, YamlParseError, ValidationError, VariableContext, createYamlParser, parseScenarioFromYaml } from '../utils/yamlParser';
import { Priority, TestInterface } from '../models/TestModels';
import fs from 'fs/promises';
import path from 'path';

jest.mock('fs/promises');
const mockFs = jest.mocked(fs);

describe('YamlParser', () => {
  let parser: YamlParser;

  beforeEach(() => {
    parser = new YamlParser({ baseDir: '/test/base', strictValidation: true });
    jest.clearAllMocks();
  });

  describe('loadScenarios', () => {
    const validYaml = `
id: test-1
name: Test Scenario
description: A test description
priority: high
interface: cli
steps:
  - action: execute
    target: echo hello
verifications:
  - type: text
    target: output
    expected: hello
    operator: contains
`;

    it('should load and parse a valid single-scenario YAML file', async () => {
      mockFs.readFile.mockResolvedValue(validYaml);

      const scenarios = await parser.loadScenarios('scenario.yaml');

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].id).toBe('test-1');
      expect(scenarios[0].name).toBe('Test Scenario');
      expect(scenarios[0].priority).toBe(Priority.HIGH);
      expect(scenarios[0].interface).toBe(TestInterface.CLI);
    });

    it('should load multiple scenarios from an array YAML', async () => {
      const multiYaml = `
- id: s1
  name: First
  description: First scenario
  priority: critical
  interface: cli
  steps:
    - action: run
      target: cmd1
- id: s2
  name: Second
  description: Second scenario
  priority: low
  interface: gui
  steps:
    - action: click
      target: button
`;
      mockFs.readFile.mockResolvedValue(multiYaml);

      const scenarios = await parser.loadScenarios('multi.yaml');

      expect(scenarios).toHaveLength(2);
      expect(scenarios[0].id).toBe('s1');
      expect(scenarios[1].id).toBe('s2');
    });

    it('should load scenarios from object with scenarios key', async () => {
      const wrappedYaml = `
scenarios:
  - id: wrapped-1
    name: Wrapped
    description: A wrapped scenario
    priority: medium
    interface: tui
    steps:
      - action: type
        target: input
`;
      mockFs.readFile.mockResolvedValue(wrappedYaml);

      const scenarios = await parser.loadScenarios('wrapped.yaml');

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].id).toBe('wrapped-1');
    });

    it('should throw YamlParseError for empty YAML file', async () => {
      mockFs.readFile.mockResolvedValue('');

      await expect(parser.loadScenarios('empty.yaml')).rejects.toThrow(YamlParseError);
    });

    it('should throw YamlParseError when file cannot be read', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(parser.loadScenarios('missing.yaml')).rejects.toThrow(YamlParseError);
    });
  });

  describe('parseScenario', () => {
    it('should parse a valid YAML string into OrchestratorScenario', () => {
      const yamlStr = `
id: inline-1
name: Inline Test
description: An inline test scenario
priority: medium
interface: cli
steps:
  - action: execute
    target: ls
`;
      const scenario = parser.parseScenario(yamlStr);

      expect(scenario.id).toBe('inline-1');
      expect(scenario.name).toBe('Inline Test');
      expect(scenario.priority).toBe(Priority.MEDIUM);
      expect(scenario.enabled).toBe(true);
    });

    it('should throw YamlParseError for empty string', () => {
      expect(() => parser.parseScenario('')).toThrow(YamlParseError);
    });

    it('should throw YamlParseError for malformed YAML', () => {
      const malformed = `
  bad: yaml:
    - : broken
  `;
      expect(() => parser.parseScenario(malformed)).toThrow();
    });
  });

  describe('validateAndConvertScenario (via parseScenario)', () => {
    it('should throw ValidationError when id is missing', () => {
      const yaml = `
name: No ID
description: Missing ID field
priority: high
interface: cli
steps:
  - action: run
    target: test
`;
      expect(() => parser.parseScenario(yaml)).toThrow(ValidationError);
    });

    it('should throw ValidationError when name is missing', () => {
      const yaml = `
id: no-name
description: Missing name
priority: high
interface: cli
steps:
  - action: run
    target: test
`;
      expect(() => parser.parseScenario(yaml)).toThrow(ValidationError);
    });

    it('should throw ValidationError when description is missing', () => {
      const yaml = `
id: no-desc
name: No Description
priority: high
interface: cli
steps:
  - action: run
    target: test
`;
      expect(() => parser.parseScenario(yaml)).toThrow(ValidationError);
    });

    it('should reject invalid priority in strict mode', () => {
      const yaml = `
id: bad-priority
name: Bad Priority
description: Invalid priority value
priority: urgent
interface: cli
steps: []
`;
      expect(() => parser.parseScenario(yaml)).toThrow(ValidationError);
    });

    it('should reject invalid interface in strict mode', () => {
      const yaml = `
id: bad-iface
name: Bad Interface
description: Invalid interface value
priority: high
interface: desktop
steps: []
`;
      expect(() => parser.parseScenario(yaml)).toThrow(ValidationError);
    });

    it('should default to MEDIUM priority and CLI interface when not strict', () => {
      const lenientParser = new YamlParser({ baseDir: '/test', strictValidation: false });
      const yaml = `
id: defaults
name: Defaults Test
description: Testing default values
steps: []
`;
      const scenario = lenientParser.parseScenario(yaml);

      expect(scenario.priority).toBe(Priority.MEDIUM);
      expect(scenario.interface).toBe(TestInterface.CLI);
    });

    it('should set enabled to true by default', () => {
      const yaml = `
id: enabled-default
name: Enabled Default
description: Test enabled default
priority: low
interface: cli
steps: []
`;
      const scenario = parser.parseScenario(yaml);
      expect(scenario.enabled).toBe(true);
    });

    it('should respect explicit enabled: false', () => {
      const yaml = `
id: disabled
name: Disabled
description: Explicitly disabled
priority: low
interface: cli
enabled: false
steps: []
`;
      const scenario = parser.parseScenario(yaml);
      expect(scenario.enabled).toBe(false);
    });

    it('should throw ValidationError for step missing action or target', () => {
      const yaml = `
id: bad-step
name: Bad Step
description: Step without action
priority: high
interface: cli
steps:
  - target: only-target
`;
      expect(() => parser.parseScenario(yaml)).toThrow(ValidationError);
    });

    it('should throw ValidationError for verification missing required fields', () => {
      const yaml = `
id: bad-verify
name: Bad Verify
description: Verification missing fields
priority: high
interface: cli
steps:
  - action: run
    target: cmd
verifications:
  - type: text
    target: output
`;
      expect(() => parser.parseScenario(yaml)).toThrow(ValidationError);
    });
  });

  describe('variable substitution', () => {
    it('should substitute ${env.VAR} variables', () => {
      const yaml = `
id: var-test
name: \${env.APP_NAME}
description: Testing variable substitution
priority: high
interface: cli
steps:
  - action: execute
    target: \${env.COMMAND}
`;
      const variables: VariableContext = {
        env: { APP_NAME: 'MyApp', COMMAND: 'run-test' },
        global: {},
        scenario: {}
      };
      const scenario = parser.parseScenario(yaml, variables);

      expect(scenario.name).toBe('MyApp');
      expect(scenario.steps[0].target).toBe('run-test');
    });

    it('should keep original expression when variable is not found', () => {
      const yaml = `
id: missing-var
name: \${env.UNDEFINED_VAR}
description: Undefined variable test
priority: medium
interface: cli
steps: []
`;
      const variables: VariableContext = { env: {}, global: {}, scenario: {} };
      const scenario = parser.parseScenario(yaml, variables);

      expect(scenario.name).toBe('${env.UNDEFINED_VAR}');
    });

    it('should substitute nested path variables', () => {
      const yaml = `
id: nested-var
name: \${global.app.title}
description: Nested path test
priority: medium
interface: cli
steps: []
`;
      const variables: VariableContext = {
        env: {},
        global: { app: { title: 'Nested Title' } },
        scenario: {}
      };
      const scenario = parser.parseScenario(yaml, variables);

      expect(scenario.name).toBe('Nested Title');
    });
  });

  describe('JSON_SCHEMA enforcement', () => {
    it('should reject !!js/function YAML tags via JSON_SCHEMA in loadScenarios', async () => {
      const dangerousYaml = `
id: dangerous
name: "Dangerous"
fn: !!js/function 'function() { return 1; }'
`;
      mockFs.readFile.mockResolvedValue(dangerousYaml);

      await expect(parser.loadScenarios('dangerous.yaml')).rejects.toThrow();
    });
  });

  describe('processIncludes path traversal prevention', () => {
    it('should reject includes that escape the base directory', async () => {
      const yamlWithTraversal = `
include: "../../etc/passwd"
`;
      mockFs.readFile.mockResolvedValue(yamlWithTraversal);

      await expect(parser.loadScenarios('traversal.yaml')).rejects.toThrow(YamlParseError);
    });

    it('should process valid includes within base directory', async () => {
      const mainYaml = `
id: main
name: Main
description: Main scenario
priority: high
interface: cli
steps:
  - action: run
    target: test
`;
      mockFs.readFile.mockResolvedValue(mainYaml);

      const scenarios = await parser.loadScenarios('main.yaml');
      expect(scenarios).toHaveLength(1);
    });
  });

  describe('convenience functions', () => {
    it('createYamlParser should return a YamlParser instance', () => {
      const instance = createYamlParser({ strictValidation: false });
      expect(instance).toBeInstanceOf(YamlParser);
    });

    it('parseScenarioFromYaml should parse valid YAML', () => {
      const yaml = `
id: convenience
name: Convenience
description: Test convenience function
priority: medium
interface: cli
steps: []
`;
      const scenario = parseScenarioFromYaml(yaml);
      expect(scenario.id).toBe('convenience');
    });
  });

  describe('scenarioToYaml', () => {
    it('should convert OrchestratorScenario back to YAML string', () => {
      const yaml = `
id: roundtrip
name: Round Trip
description: Roundtrip test
priority: high
interface: cli
steps:
  - action: execute
    target: echo hello
`;
      const scenario = parser.parseScenario(yaml);
      const yamlOutput = parser.scenarioToYaml(scenario);

      expect(yamlOutput).toContain('id: roundtrip');
      expect(yamlOutput).toContain('name: Round Trip');
      expect(yamlOutput).toContain('priority: HIGH');
    });
  });

  describe('extractVariables', () => {
    it('should extract variables from nested content', () => {
      const content = {
        variables: { foo: 'bar', baz: 42 },
        nested: {
          variables: { deep: 'value' }
        }
      };
      const vars = parser.extractVariables(content);

      expect(vars.foo).toBe('bar');
      expect(vars.baz).toBe(42);
      expect(vars.deep).toBe('value');
    });
  });
});
