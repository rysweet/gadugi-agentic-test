/**
 * Integration test: Legacy CLI YAML → ScenarioLoader → scenarioAdapter → CLIAgent (issue #202)
 *
 * Verifies the complete pipeline that was broken by the original bug:
 *   1. A CLI scenario YAML with 'type: command' + 'command:' fields
 *   2. Is loaded by ScenarioLoader.loadFromFile (convertLegacyFormat)
 *   3. Is adapted by adaptScenarioToComplex to OrchestratorScenario
 *   4. Produces steps that CLIAgent.executeStep() can handle (action: 'command')
 *
 * This test catches the exact regression where the pipeline produced
 * steps with empty action ('') that CLIAgent rejected as "Unsupported CLI action: ".
 */

import { ScenarioLoader } from '../scenarios';
import { adaptScenarioToComplex } from '../adapters/scenarioAdapter';
import { TestStatus } from '../models/TestModels';
import * as fs from 'fs/promises';

jest.mock('fs/promises');
const mockFs = jest.mocked(fs);

// Mock only the CLIAgent sub-modules (same setup as CLIAgent.test.ts)
const mockRunnerInstance = {
  setupInteractiveResponses: jest.fn(),
  setEnvironmentVariables:   jest.fn(),
  setEnvironmentVariable:    jest.fn(),
  executeCommand:            jest.fn().mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' }),
  killProcess:               jest.fn().mockResolvedValue(undefined),
  killAllProcesses:          jest.fn().mockResolvedValue(undefined),
  getOutputBuffer:           jest.fn().mockReturnValue([]),
  getCommandHistory:         jest.fn().mockReturnValue([]),
  reset:                     jest.fn(),
};

jest.mock('../agents/cli/CLICommandRunner', () => ({
  CLICommandRunner: jest.fn().mockImplementation(() => mockRunnerInstance),
}));

jest.mock('../agents/cli/CLIOutputParser', () => ({
  CLIOutputParser: jest.fn().mockImplementation(() => ({
    getScenarioLogs:  jest.fn().mockReturnValue([]),
    waitForOutput:    jest.fn().mockResolvedValue('found'),
    validateOutput:   jest.fn().mockResolvedValue(true),
    validateExitCode: jest.fn().mockReturnValue(true),
    captureOutput:    jest.fn().mockReturnValue({ stdout: '', stderr: '', combined: '' }),
    getLatestOutput:  jest.fn().mockReturnValue(''),
  })),
}));

jest.mock('../utils/fileUtils', () => ({
  validateDirectory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => {
  const actual = jest.requireActual<typeof import('../utils/logger')>('../utils/logger');
  return {
    ...actual,
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  };
});

import { CLIAgent } from '../agents/CLIAgent';

describe('Issue #202: CLI scenario pipeline integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunnerInstance.executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'v22.15.0', stderr: '' });
    // Mock fs operations used by CLIAgent.initialize()
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true });
  });

  it('should convert a CLI scenario YAML through the full pipeline to executable steps', async () => {
    // Step 1: Real amplihack-rs style CLI scenario YAML
    const cliScenarioYaml = `
name: Node Version Check
type: cli
application:
  timeout: 120
scenarios:
  - name: Verify node version
    description: Checks that the correct Node.js version is installed
    steps:
      - type: command
        command: "node --version"
        expected_output: "v22"
        conditions:
          - timeout: 30
      - type: command
        command: "npm --version"
        expected_output: "10"
`;
    mockFs.readFile.mockResolvedValue(cliScenarioYaml);

    // Step 2: Load via ScenarioLoader
    const scenarios = await ScenarioLoader.loadFromFile('/scenarios/node-check.yaml');

    // Verify ScenarioLoader output
    expect(scenarios).toHaveLength(1);
    const scenario = scenarios[0];
    expect(scenario.name).toBe('Verify node version');
    expect(scenario.agents[0].type).toBe('cli');
    expect(scenario.agents[0].name).toBe('cli-agent');
    expect(scenario.steps).toHaveLength(2);
    expect(scenario.steps[0].action).toBe('command');
    expect(scenario.steps[0].target).toBe('node --version');
    expect(scenario.steps[0].expected).toBe('v22');
    expect(scenario.steps[1].action).toBe('command');
    expect(scenario.steps[1].target).toBe('npm --version');
    expect(scenario.steps[1].expected).toBe('10');

    // Step 3: Adapt to OrchestratorScenario
    const orchestratorScenario = adaptScenarioToComplex(scenario);

    expect(orchestratorScenario.steps).toHaveLength(2);
    expect(orchestratorScenario.steps[0].action).toBe('command');
    expect(orchestratorScenario.steps[0].target).toBe('node --version');
    expect(orchestratorScenario.steps[0].expected).toBe('v22');
    expect(orchestratorScenario.steps[1].action).toBe('command');
    expect(orchestratorScenario.steps[1].target).toBe('npm --version');
    expect(orchestratorScenario.steps[1].expected).toBe('10');

    // Step 4: Execute with CLIAgent — the previously broken path
    const agent = new CLIAgent();
    await agent.initialize();

    const result1 = await agent.executeStep(orchestratorScenario.steps[0], 0);
    expect(result1.status).toBe(TestStatus.PASSED);
    expect(mockRunnerInstance.executeCommand).toHaveBeenCalledWith(
      'node',
      ['--version'],
      expect.any(Object)
    );

    const result2 = await agent.executeStep(orchestratorScenario.steps[1], 1);
    expect(result2.status).toBe(TestStatus.PASSED);
  });

  it('should handle multiple scenarios from a single file through the full pipeline', async () => {
    const multiScenarioYaml = `
type: cli
version: "1.0"
application:
  timeout: 60
scenarios:
  - name: First check
    steps:
      - type: command
        command: "echo hello"
        expected_output: "hello"
  - name: Second check
    steps:
      - type: command
        command: "echo world"
        expected_output: "world"
`;
    mockFs.readFile.mockResolvedValue(multiScenarioYaml);

    const scenarios = await ScenarioLoader.loadFromFile('/scenarios/multi.yaml');

    expect(scenarios).toHaveLength(2);

    // Both scenarios should be independently adaptable and executable
    for (const scenario of scenarios) {
      expect(scenario.agents[0].type).toBe('cli');
      const orchestratorScenario = adaptScenarioToComplex(scenario);
      expect(orchestratorScenario.steps[0].action).toBe('command');
      expect(orchestratorScenario.steps[0].target).not.toBe('');
    }

    // First scenario
    const adapted1 = adaptScenarioToComplex(scenarios[0]);
    expect(adapted1.name).toBe('First check');
    expect(adapted1.steps[0].target).toBe('echo hello');
    expect(adapted1.steps[0].expected).toBe('hello');

    // Second scenario
    const adapted2 = adaptScenarioToComplex(scenarios[1]);
    expect(adapted2.name).toBe('Second check');
    expect(adapted2.steps[0].target).toBe('echo world');
    expect(adapted2.steps[0].expected).toBe('world');
  });

  it('should NOT produce empty action strings that trigger "Unsupported CLI action" error', async () => {
    // This is the exact regression test for the original bug.
    // Before the fix, action was mapped from s['action'] which is undefined
    // for CLI steps that use type: command + command: fields.
    const bugTriggerYaml = `
scenarios:
  - name: Bug Trigger
    type: cli
    steps:
      - type: command
        command: "amplihack install"
        expected_output: "installed"
`;
    mockFs.readFile.mockResolvedValue(bugTriggerYaml);

    const scenarios = await ScenarioLoader.loadFromFile('/scenarios/bug-trigger.yaml');
    const adapted = adaptScenarioToComplex(scenarios[0]);

    // The critical assertion: action must NOT be empty string
    expect(adapted.steps[0].action).not.toBe('');
    expect(adapted.steps[0].action).toBe('command');

    // And the target must be the command, not empty
    expect(adapted.steps[0].target).not.toBe('');
    expect(adapted.steps[0].target).toBe('amplihack install');

    // And CLIAgent must be able to handle it
    const agent = new CLIAgent();
    await agent.initialize();

    const result = await agent.executeStep(adapted.steps[0], 0);
    expect(result.status).toBe(TestStatus.PASSED);
    // Should NOT contain "Unsupported CLI action"
    expect(result.error).toBeUndefined();
  });
});
