/**
 * TDD tests for YamlValidator.validateFile() — CLI step field validation (issue #202)
 *
 * The current validateFile() only checks whether the file is valid YAML.
 * These tests specify the REQUIRED behavior: validateFile() must also check
 * that CLI steps (type: command) have the required 'command' field.
 *
 * These tests are expected to FAIL until the implementation is added.
 */

import { YamlValidator } from '../utils/yaml/YamlValidator';
import { YamlParserConfig } from '../utils/yaml/types';
import fs from 'fs/promises';

jest.mock('fs/promises');
const mockFs = jest.mocked(fs);

describe('YamlValidator.validateFile() — CLI step validation (issue #202)', () => {
  let validator: YamlValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    const config: YamlParserConfig = {
      baseDir: '/test',
      maxIncludeDepth: 5,
      strictValidation: true,
      variableResolvers: {},
      defaultEnvironment: {},
    };
    validator = new YamlValidator(config);
  });

  it('should still accept a basic valid YAML file', async () => {
    mockFs.readFile.mockResolvedValue(`
name: Basic Valid
steps:
  - action: run
    target: echo hello
`);

    const result = await validator.validateFile('/scenarios/basic.yaml');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should still reject empty YAML', async () => {
    mockFs.readFile.mockResolvedValue('');

    const result = await validator.validateFile('/scenarios/empty.yaml');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should flag a CLI step with type: command but missing command field', async () => {
    mockFs.readFile.mockResolvedValue(`
scenarios:
  - name: Missing Command
    type: cli
    steps:
      - type: command
        description: "No command field"
`);

    const result = await validator.validateFile('/scenarios/missing-cmd.yaml');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('command'))).toBe(true);
  });

  it('should accept a CLI step with both type: command and command field', async () => {
    mockFs.readFile.mockResolvedValue(`
scenarios:
  - name: Valid CLI Step
    type: cli
    steps:
      - type: command
        command: "node --version"
        expected_output: "v"
`);

    const result = await validator.validateFile('/scenarios/valid-cli.yaml');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should flag multiple CLI steps with missing command fields', async () => {
    mockFs.readFile.mockResolvedValue(`
scenarios:
  - name: Multi Missing
    type: cli
    steps:
      - type: command
        description: "missing 1"
      - type: command
        command: "echo ok"
      - type: command
        description: "missing 2"
`);

    const result = await validator.validateFile('/scenarios/multi-missing.yaml');

    expect(result.valid).toBe(false);
    // Should report at least 2 errors (for steps 0 and 2)
    const commandErrors = result.errors.filter(e => e.toLowerCase().includes('command'));
    expect(commandErrors.length).toBeGreaterThanOrEqual(2);
  });

  it('should not flag non-command steps that lack a command field', async () => {
    // Only steps with type: command need a command field.
    // Steps with action: launch, action: wait, etc. do not.
    mockFs.readFile.mockResolvedValue(`
scenarios:
  - name: Non-command Steps
    steps:
      - action: launch
        input: app.exe
        conditions: []
      - action: wait
        description: "Wait a bit"
`);

    const result = await validator.validateFile('/scenarios/non-command.yaml');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate CLI steps across multiple scenarios in the same file', async () => {
    mockFs.readFile.mockResolvedValue(`
scenarios:
  - name: Good Scenario
    type: cli
    steps:
      - type: command
        command: "echo good"
  - name: Bad Scenario
    type: cli
    steps:
      - type: command
        description: "missing command"
`);

    const result = await validator.validateFile('/scenarios/multi-scenario.yaml');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Bad Scenario') || e.includes('command'))).toBe(true);
  });
});
