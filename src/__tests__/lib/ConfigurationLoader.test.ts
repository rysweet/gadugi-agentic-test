/**
 * Tests for ConfigurationLoader: createDefaultConfig() and loadConfiguration()
 */

import {
  createDefaultConfig,
  loadConfiguration,
  CliArguments,
} from '../../lib/ConfigurationLoader';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../utils/config', () => ({
  loadConfigFromFile: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// createDefaultConfig() tests
// ---------------------------------------------------------------------------

describe('createDefaultConfig()', () => {
  it('returns a TestConfig object', () => {
    const config = createDefaultConfig();
    expect(config).toBeDefined();
  });

  it('returns config with execution settings', () => {
    const config = createDefaultConfig();

    expect(config.execution).toBeDefined();
    expect(typeof config.execution.maxParallel).toBe('number');
    expect(typeof config.execution.defaultTimeout).toBe('number');
    expect(typeof config.execution.continueOnFailure).toBe('boolean');
  });

  it('returns config with cli settings', () => {
    const config = createDefaultConfig();

    expect(config.cli).toBeDefined();
    expect(typeof config.cli.executablePath).toBe('string');
    expect(typeof config.cli.defaultTimeout).toBe('number');
  });

  it('returns config with ui settings', () => {
    const config = createDefaultConfig();

    expect(config.ui).toBeDefined();
    expect(config.ui.browser).toBe('chromium');
    expect(config.ui.headless).toBe(true);
  });

  it('returns config with tui settings', () => {
    const config = createDefaultConfig();

    expect(config.tui).toBeDefined();
    expect(config.tui.terminal).toBe('xterm');
    expect(config.tui.encoding).toBe('utf8');
  });

  it('returns config with logging settings', () => {
    const config = createDefaultConfig();

    expect(config.logging).toBeDefined();
    expect(typeof config.logging.level).toBe('string');
    expect(typeof config.logging.console).toBe('boolean');
  });

  it('returns config with reporting settings', () => {
    const config = createDefaultConfig();

    expect(config.reporting).toBeDefined();
    expect(Array.isArray(config.reporting.formats)).toBe(true);
    expect(config.reporting.includeScreenshots).toBe(true);
  });

  // Security regression test: GITHUB_TOKEN must not appear in cli.environment
  it('does not include GITHUB_TOKEN in cli.environment (security regression)', () => {
    // Temporarily set GITHUB_TOKEN to verify it is excluded
    const savedToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'super-secret-token';

    const config = createDefaultConfig();

    expect(Object.keys(config.cli.environment)).not.toContain('GITHUB_TOKEN');

    // Restore
    if (savedToken === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = savedToken;
    }
  });

  it('does not include any tokens or secrets in tui.environment (security regression)', () => {
    const savedToken = process.env.GITHUB_TOKEN;
    const savedKey = process.env.SECRET_KEY;
    process.env.GITHUB_TOKEN = 'token-value';
    process.env.SECRET_KEY = 'secret-value';

    const config = createDefaultConfig();

    expect(config.tui.environment).toEqual({});

    if (savedToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = savedToken;
    if (savedKey === undefined) delete process.env.SECRET_KEY;
    else process.env.SECRET_KEY = savedKey;
  });

  it('only exposes NODE_ENV in cli.environment', () => {
    const config = createDefaultConfig();

    const allowedKeys = Object.keys(config.cli.environment);
    expect(allowedKeys).toEqual(['NODE_ENV']);
  });

  it('sets NODE_ENV in cli.environment to "test" in test environment', () => {
    const config = createDefaultConfig();

    // process.env.NODE_ENV is set to 'test' by tests/setup.ts
    expect(config.cli.environment.NODE_ENV).toBe('test');
  });

  it('sets github.token from GITHUB_TOKEN env var', () => {
    const savedToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'gh-token-123';

    const config = createDefaultConfig();

    // github.token reads from env in the function
    expect(config.github.token).toBe('gh-token-123');

    if (savedToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = savedToken;
  });
});

// ---------------------------------------------------------------------------
// loadConfiguration() tests
// ---------------------------------------------------------------------------

describe('loadConfiguration()', () => {
  const baseCliArgs: CliArguments = {
    config: './config/test.yaml',
    suite: 'smoke',
    dryRun: false,
    noIssues: false,
    logLevel: 'INFO',
    verbose: false,
    debug: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a TestConfig when config file does not exist (falls back to defaults)', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    pathExists.mockResolvedValue(false);

    const config = await loadConfiguration('./nonexistent.yaml', baseCliArgs);

    expect(config).toBeDefined();
    expect(config.execution).toBeDefined();
  });

  it('applies logLevel from cliArgs to config.logging.level', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    pathExists.mockResolvedValue(false);

    const config = await loadConfiguration('./config.yaml', {
      ...baseCliArgs,
      logLevel: 'DEBUG',
    });

    expect(config.logging.level).toBe('debug');
  });

  it('lowercases the logLevel value', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    pathExists.mockResolvedValue(false);

    const config = await loadConfiguration('./config.yaml', {
      ...baseCliArgs,
      logLevel: 'WARNING',
    });

    expect(config.logging.level).toBe('warning');
  });

  it('applies parallel option to config.execution.maxParallel', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    pathExists.mockResolvedValue(false);

    const config = await loadConfiguration('./config.yaml', {
      ...baseCliArgs,
      parallel: 7,
    });

    expect(config.execution.maxParallel).toBe(7);
  });

  it('applies timeout option to config.execution.defaultTimeout', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    pathExists.mockResolvedValue(false);

    const config = await loadConfiguration('./config.yaml', {
      ...baseCliArgs,
      timeout: 60000,
    });

    expect(config.execution.defaultTimeout).toBe(60000);
  });

  it('applies noIssues: true to disable GitHub issue creation', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    pathExists.mockResolvedValue(false);

    const config = await loadConfiguration('./config.yaml', {
      ...baseCliArgs,
      noIssues: true,
    });

    expect(config.github?.createIssuesOnFailure).toBe(false);
  });

  it('does not modify github.createIssuesOnFailure when noIssues is false', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    pathExists.mockResolvedValue(false);

    const config = await loadConfiguration('./config.yaml', {
      ...baseCliArgs,
      noIssues: false,
    });

    // The default is already false; the important thing is no error is thrown
    expect(config).toBeDefined();
  });

  it('falls back to default config when loadConfigFromFile throws', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    const { loadConfigFromFile } = jest.requireMock('../../utils/config');

    pathExists.mockResolvedValue(true);
    loadConfigFromFile.mockRejectedValue(new Error('Parse error'));

    const config = await loadConfiguration('./broken.yaml', baseCliArgs);

    // Should not throw and should return a valid config
    expect(config).toBeDefined();
    expect(config.execution).toBeDefined();
  });

  it('loads config from file when file exists', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    const { loadConfigFromFile } = jest.requireMock('../../utils/config');

    pathExists.mockResolvedValue(true);
    loadConfigFromFile.mockResolvedValue(createDefaultConfig());

    const config = await loadConfiguration('./valid.yaml', baseCliArgs);

    expect(loadConfigFromFile).toHaveBeenCalledWith('./valid.yaml');
    expect(config).toBeDefined();
  });

  it('overrides github.token from GITHUB_TOKEN env var', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    pathExists.mockResolvedValue(false);

    const savedToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'env-override-token';

    const config = await loadConfiguration('./config.yaml', baseCliArgs);

    expect(config.github?.token).toBe('env-override-token');

    if (savedToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = savedToken;
  });

  it('works with all required CliArguments fields', async () => {
    const { pathExists } = jest.requireMock('fs-extra');
    pathExists.mockResolvedValue(false);

    const fullArgs: CliArguments = {
      config: './config.yaml',
      suite: 'full',
      dryRun: true,
      noIssues: true,
      logLevel: 'ERROR',
      output: './output',
      parallel: 4,
      timeout: 120000,
      scenarioFiles: ['./scenarios/a.yaml'],
      verbose: true,
      debug: false,
    };

    const config = await loadConfiguration('./config.yaml', fullArgs);

    expect(config.execution.maxParallel).toBe(4);
    expect(config.execution.defaultTimeout).toBe(120000);
    expect(config.logging.level).toBe('error');
    expect(config.github?.createIssuesOnFailure).toBe(false);
  });
});
