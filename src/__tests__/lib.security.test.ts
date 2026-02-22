/**
 * Security regression tests for issue #84:
 * process.env snapshot with credentials stored in TestConfig (written to disk)
 *
 * These tests verify that createDefaultConfig() does NOT copy secrets from
 * process.env into the TestConfig. Credentials like GITHUB_TOKEN, AWS_* and
 * AZURE_* must never appear in cli.environment or tui.environment because
 * TestConfig objects are serialised to disk by saveResults and exportToFile.
 */

// Mock heavy dependencies that the orchestrator pulls in so the test module
// loads quickly without spawning child processes or opening file handles.
jest.mock('../orchestrator', () => ({
  createTestOrchestrator: jest.fn(),
  TestOrchestrator: jest.fn()
}));
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  setupLogger: jest.fn(),
  LogLevel: { INFO: 'INFO', DEBUG: 'DEBUG', WARN: 'WARN', ERROR: 'ERROR' }
}));
jest.mock('../utils/config', () => {
  const actual = jest.requireActual('../utils/config');
  return actual;
});
jest.mock('../utils/yamlParser', () => ({
  parseYamlScenarios: jest.fn().mockResolvedValue([])
}));
jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(false)
}));

import { createDefaultConfig } from '../lib';

describe('Security: createDefaultConfig credential exposure prevention (issue #84)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('GITHUB_TOKEN is not in cli.environment', () => {
    process.env.GITHUB_TOKEN = 'ghp_supersecrettoken';

    const config = createDefaultConfig();

    expect(config.cli.environment['GITHUB_TOKEN']).toBeUndefined();
  });

  it('GITHUB_TOKEN is not in tui.environment', () => {
    process.env.GITHUB_TOKEN = 'ghp_supersecrettoken';

    const config = createDefaultConfig();

    expect(config.tui.environment['GITHUB_TOKEN']).toBeUndefined();
  });

  it('AWS_SECRET_ACCESS_KEY is not in cli.environment', () => {
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-super-secret';

    const config = createDefaultConfig();

    expect(config.cli.environment['AWS_SECRET_ACCESS_KEY']).toBeUndefined();
  });

  it('AWS_ACCESS_KEY_ID is not in cli.environment', () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';

    const config = createDefaultConfig();

    expect(config.cli.environment['AWS_ACCESS_KEY_ID']).toBeUndefined();
  });

  it('AZURE_CLIENT_SECRET is not in cli.environment', () => {
    process.env.AZURE_CLIENT_SECRET = 'azure-secret';

    const config = createDefaultConfig();

    expect(config.cli.environment['AZURE_CLIENT_SECRET']).toBeUndefined();
  });

  it('tui.environment is an empty object by default regardless of process.env', () => {
    process.env.GITHUB_TOKEN = 'ghp_supersecrettoken';
    process.env.MY_SECRET_KEY = 'topsecret';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-super-secret';

    const config = createDefaultConfig();

    expect(Object.keys(config.tui.environment)).toHaveLength(0);
  });

  it('cli.environment only contains NODE_ENV - no mass env snapshot', () => {
    process.env.GITHUB_TOKEN = 'ghp_supersecrettoken';
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.NODE_ENV = 'test';

    const config = createDefaultConfig();
    const cliEnvKeys = Object.keys(config.cli.environment);

    expect(cliEnvKeys).toContain('NODE_ENV');
    expect(cliEnvKeys).not.toContain('GITHUB_TOKEN');
    expect(cliEnvKeys).not.toContain('AWS_ACCESS_KEY_ID');
  });

  it('cli.environment NODE_ENV defaults to "test" when not set', () => {
    delete process.env.NODE_ENV;

    const config = createDefaultConfig();

    expect(config.cli.environment['NODE_ENV']).toBe('test');
  });

  it('cli.environment NODE_ENV respects the value from process.env', () => {
    process.env.NODE_ENV = 'production';

    const config = createDefaultConfig();

    expect(config.cli.environment['NODE_ENV']).toBe('production');
  });
});
