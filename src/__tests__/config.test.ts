import { ConfigManager, ConfigError, ConfigSource, createConfigManager } from '../utils/config';
import fs from 'fs/promises';

jest.mock('fs/promises');
const mockFs = jest.mocked(fs);

describe('ConfigManager', () => {
  let manager: ConfigManager;
  const originalEnv = process.env;

  beforeEach(() => {
    manager = new ConfigManager();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const config = manager.getConfig();

      expect(config.execution.maxParallel).toBe(3);
      expect(config.execution.defaultTimeout).toBe(30000);
      expect(config.logging.level).toBe('info');
      expect(config.ui.browser).toBe('chromium');
    });

    it('should merge initial config with defaults', () => {
      const custom = new ConfigManager({
        execution: {
          maxParallel: 10,
          defaultTimeout: 60000,
          continueOnFailure: false,
          maxRetries: 5,
          retryDelay: 2000,
          randomizeOrder: true,
          resourceLimits: {
            maxMemory: 512,
            maxCpuUsage: 50,
            maxDiskUsage: 100,
            maxExecutionTime: 300000,
            maxOpenFiles: 256
          },
          cleanup: {
            cleanupAfterEach: false,
            cleanupAfterAll: false,
            cleanupDirectories: [],
            cleanupFiles: [],
            terminateProcesses: [],
            stopServices: [],
            customCleanupScripts: []
          }
        }
      });

      const config = custom.getConfig();
      expect(config.execution.maxParallel).toBe(10);
      expect(config.execution.defaultTimeout).toBe(60000);
      // Non-overridden values remain at defaults
      expect(config.logging.level).toBe('info');
    });
  });

  describe('loadFromFile', () => {
    it('should load YAML config file', async () => {
      const yamlContent = `
logging:
  level: debug
execution:
  maxParallel: 8
`;
      mockFs.readFile.mockResolvedValue(yamlContent);

      await manager.loadFromFile('/path/to/config.yaml');
      const config = manager.getConfig();

      expect(config.logging.level).toBe('debug');
      expect(config.execution.maxParallel).toBe(8);
    });

    it('should load JSON config file', async () => {
      const jsonContent = JSON.stringify({
        logging: { level: 'warn' },
        execution: { maxParallel: 5 }
      });
      mockFs.readFile.mockResolvedValue(jsonContent);

      await manager.loadFromFile('/path/to/config.json');
      const config = manager.getConfig();

      expect(config.logging.level).toBe('warn');
      expect(config.execution.maxParallel).toBe(5);
    });

    it('should load .yml extension files', async () => {
      const yamlContent = `
logging:
  level: error
`;
      mockFs.readFile.mockResolvedValue(yamlContent);

      await manager.loadFromFile('/path/to/config.yml');
      const config = manager.getConfig();

      expect(config.logging.level).toBe('error');
    });

    it('should throw ConfigError for unsupported file format', async () => {
      mockFs.readFile.mockResolvedValue('some content');

      await expect(manager.loadFromFile('/path/to/config.txt')).rejects.toThrow(ConfigError);
    });

    it('should throw ConfigError when file read fails', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      await expect(manager.loadFromFile('/nonexistent/config.yaml')).rejects.toThrow(ConfigError);
    });

    it('should throw ConfigError for invalid config values', async () => {
      const invalidConfig = JSON.stringify({
        execution: { maxParallel: -1 }
      });
      mockFs.readFile.mockResolvedValue(invalidConfig);

      await expect(manager.loadFromFile('/path/to/invalid.json')).rejects.toThrow(ConfigError);
    });

    it('should set metadata source to FILE after loading', async () => {
      const yamlContent = `
logging:
  level: debug
`;
      mockFs.readFile.mockResolvedValue(yamlContent);

      await manager.loadFromFile('/path/to/config.yaml');
      const meta = manager.getMetadata();

      expect(meta.source).toBe(ConfigSource.FILE);
      expect(meta.filePath).toContain('config.yaml');
    });
  });

  describe('loadFromEnvironment', () => {
    it('should map AGENTIC_LOG_LEVEL to logging.level', () => {
      process.env.AGENTIC_LOG_LEVEL = 'debug';

      manager.loadFromEnvironment();
      const config = manager.getConfig();

      expect(config.logging.level).toBe('debug');
    });

    it('should map AGENTIC_MAX_PARALLEL as a number', () => {
      process.env.AGENTIC_MAX_PARALLEL = '16';

      manager.loadFromEnvironment();
      const config = manager.getConfig();

      expect(config.execution.maxParallel).toBe(16);
    });

    it('should map AGENTIC_HEADLESS as boolean', () => {
      process.env.AGENTIC_HEADLESS = 'true';

      manager.loadFromEnvironment();
      const config = manager.getConfig();

      expect(config.ui.headless).toBe(true);
    });

    it('should map AGENTIC_BASE_URL as string', () => {
      process.env.AGENTIC_BASE_URL = 'http://example.com:8080';

      manager.loadFromEnvironment();
      const config = manager.getConfig();

      expect(config.ui.baseUrl).toBe('http://example.com:8080');
    });

    it('should collect AGENTIC_CLI_ENV_ prefixed vars into cli.environment', () => {
      process.env.AGENTIC_CLI_ENV_MY_VAR = 'hello';
      process.env.AGENTIC_CLI_ENV_OTHER = 'world';

      manager.loadFromEnvironment();
      const config = manager.getConfig();

      expect(config.cli.environment['MY_VAR']).toBe('hello');
      expect(config.cli.environment['OTHER']).toBe('world');
    });

    it('should set metadata source to ENVIRONMENT', () => {
      process.env.AGENTIC_LOG_LEVEL = 'warn';

      manager.loadFromEnvironment();
      const meta = manager.getMetadata();

      expect(meta.source).toBe(ConfigSource.ENVIRONMENT);
    });

    it('should not change config when no matching env vars are set', () => {
      // Clear all AGENTIC_ env vars
      Object.keys(process.env).forEach(key => {
        if (key.startsWith('AGENTIC_') || key === 'GITHUB_TOKEN' || key === 'GITHUB_OWNER' || key === 'GITHUB_REPO') {
          delete process.env[key];
        }
      });

      const configBefore = manager.getConfig();
      manager.loadFromEnvironment();
      const configAfter = manager.getConfig();

      expect(configBefore.execution.maxParallel).toBe(configAfter.execution.maxParallel);
    });
  });

  describe('get with dotted paths', () => {
    it('should retrieve nested values via dotted path', () => {
      const level = manager.get<string>('logging.level');
      expect(level).toBe('info');
    });

    it('should retrieve deeply nested values', () => {
      const width = manager.get<number>('ui.viewport.width');
      expect(width).toBe(1280);
    });

    it('should return default value when path does not exist', () => {
      const val = manager.get<string>('nonexistent.path', 'fallback');
      expect(val).toBe('fallback');
    });

    it('should return undefined when path does not exist and no default', () => {
      const val = manager.get('nonexistent.path');
      expect(val).toBeUndefined();
    });
  });

  describe('validateConfig', () => {
    it('should return valid for correct config', () => {
      const result = manager.validateConfig({
        execution: { maxParallel: 4 },
        logging: { level: 'info' }
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject maxParallel < 1', () => {
      const result = manager.validateConfig({
        execution: { maxParallel: 0 }
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('execution.maxParallel must be at least 1');
    });

    it('should reject invalid browser value', () => {
      const result = manager.validateConfig({
        ui: { browser: 'opera' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('ui.browser'))).toBe(true);
    });

    it('should reject invalid logging level', () => {
      const result = manager.validateConfig({
        logging: { level: 'verbose' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('logging.level'))).toBe(true);
    });

    it('should reject viewport dimensions below 100', () => {
      const result = manager.validateConfig({
        ui: { viewport: { width: 50, height: 50 } }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('viewport'))).toBe(true);
    });

    it('should warn when defaultTimeout is less than 1 second', () => {
      const result = manager.validateConfig({
        execution: { defaultTimeout: 500 }
      });

      expect(result.warnings.some(w => w.includes('defaultTimeout'))).toBe(true);
    });

    it('should reject non-array executionOrder', () => {
      const result = manager.validateConfig({
        priority: { executionOrder: 'not-an-array' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('executionOrder'))).toBe(true);
    });

    it('should reject createIssuesOnFailure:true when github.token is missing', () => {
      const result = manager.validateConfig({
        github: { createIssuesOnFailure: true, token: '' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('github.token'))).toBe(true);
    });

    it('should accept createIssuesOnFailure:true when github.token is non-empty', () => {
      const result = manager.validateConfig({
        github: { createIssuesOnFailure: true, token: 'ghp_abc123' }
      });

      expect(result.errors.some(e => e.includes('github.token'))).toBe(false);
    });

    it('should accept createIssuesOnFailure:false with empty token', () => {
      const result = manager.validateConfig({
        github: { createIssuesOnFailure: false, token: '' }
      });

      expect(result.errors.some(e => e.includes('github.token'))).toBe(false);
    });

    it('should reject maxRetries greater than 10', () => {
      const result = manager.validateConfig({
        execution: { maxRetries: 11 }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maxRetries'))).toBe(true);
    });

    it('should reject maxRetries less than 0', () => {
      const result = manager.validateConfig({
        execution: { maxRetries: -1 }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maxRetries'))).toBe(true);
    });

    it('should accept maxRetries of 0', () => {
      const result = manager.validateConfig({
        execution: { maxRetries: 0 }
      });

      expect(result.errors.some(e => e.includes('maxRetries'))).toBe(false);
    });

    it('should accept maxRetries of 10', () => {
      const result = manager.validateConfig({
        execution: { maxRetries: 10 }
      });

      expect(result.errors.some(e => e.includes('maxRetries'))).toBe(false);
    });

    it('should reject tui.shell that is an empty string', () => {
      const result = manager.validateConfig({
        tui: { shell: '' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tui.shell'))).toBe(true);
    });

    it('should accept tui.shell that is a non-empty string', () => {
      const result = manager.validateConfig({
        tui: { shell: '/bin/bash' }
      });

      expect(result.errors.some(e => e.includes('tui.shell'))).toBe(false);
    });

    it('should accept tui.shell absent (undefined)', () => {
      const result = manager.validateConfig({
        tui: {}
      });

      expect(result.errors.some(e => e.includes('tui.shell'))).toBe(false);
    });

    it('should reject reporting.formats containing unknown format', () => {
      const result = manager.validateConfig({
        reporting: { formats: ['html', 'xml'] }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('reporting.formats'))).toBe(true);
    });

    it('should accept reporting.formats with only html and json', () => {
      const result = manager.validateConfig({
        reporting: { formats: ['html', 'json'] }
      });

      expect(result.errors.some(e => e.includes('reporting.formats'))).toBe(false);
    });

    it('should accept reporting.formats with only html', () => {
      const result = manager.validateConfig({
        reporting: { formats: ['html'] }
      });

      expect(result.errors.some(e => e.includes('reporting.formats'))).toBe(false);
    });
  });

  describe('exportToFile', () => {
    it('should write YAML format by default', async () => {
      mockFs.writeFile.mockResolvedValue(undefined);

      await manager.exportToFile('/path/to/output.yaml');

      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
      const [filePath, content] = mockFs.writeFile.mock.calls[0] as [string, string, string];
      expect(filePath).toBe('/path/to/output.yaml');
      expect(content).toContain('execution:');
      expect(content).toContain('logging:');
    });

    it('should write JSON format when specified', async () => {
      mockFs.writeFile.mockResolvedValue(undefined);

      await manager.exportToFile('/path/to/output.json', 'json');

      const [, content] = mockFs.writeFile.mock.calls[0] as [string, string, string];
      const parsed = JSON.parse(content);
      expect(parsed.execution).toBeDefined();
      expect(parsed.logging).toBeDefined();
    });

    it('should not include raw process.env secrets in exported config', async () => {
      mockFs.writeFile.mockResolvedValue(undefined);

      process.env.SECRET_API_KEY = 'super-secret-value';

      await manager.exportToFile('/path/to/output.yaml');

      const [, content] = mockFs.writeFile.mock.calls[0] as [string, string, string];
      expect(content).not.toContain('super-secret-value');
    });
  });

  describe('getMetadata', () => {
    it('should return a shallow copy of metadata at the top level', () => {
      const meta1 = manager.getMetadata();
      const meta2 = manager.getMetadata();

      // Top-level object identity should differ (it is a copy)
      expect(meta1).not.toBe(meta2);
      // But values should be equal
      expect(meta1.source).toBe(meta2.source);
      expect(meta1.loadedAt.getTime()).toBe(meta2.loadedAt.getTime());
    });

    it('should include loadedAt timestamp', () => {
      const meta = manager.getMetadata();
      expect(meta.loadedAt).toBeInstanceOf(Date);
    });

    it('should default source to DEFAULT', () => {
      const meta = manager.getMetadata();
      expect(meta.source).toBe(ConfigSource.DEFAULT);
    });
  });

  describe('watch', () => {
    it('should notify watchers on config update', () => {
      const callback = jest.fn();
      manager.watch(callback);

      manager.updateConfig({ logging: { level: 'debug', console: true, format: 'structured', includeTimestamp: true, maxFileSize: 10485760, maxFiles: 5, compress: true } });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should unwatch when unsubscribe function is called', () => {
      const callback = jest.fn();
      const unwatch = manager.watch(callback);

      unwatch();
      manager.updateConfig({ logging: { level: 'warn', console: true, format: 'structured', includeTimestamp: true, maxFileSize: 10485760, maxFiles: 5, compress: true } });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('createConfigManager', () => {
    it('should return a new ConfigManager instance', () => {
      const mgr = createConfigManager({ logging: { level: 'error', console: false, format: 'json', includeTimestamp: true, maxFileSize: 1024, maxFiles: 1, compress: false } });
      expect(mgr).toBeInstanceOf(ConfigManager);
      expect(mgr.get<string>('logging.level')).toBe('error');
    });
  });
});

// -----------------------------------------------------------------------
// Security tests: ConfigManager credential exposure prevention (issue #84)
// -----------------------------------------------------------------------
describe('Security: ConfigManager credential exposure prevention', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('metadata.environment is always an empty object on construction', () => {
    process.env.GITHUB_TOKEN = 'ghp_supersecrettoken';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-super-secret';

    const mgr = new ConfigManager();
    const meta = mgr.getMetadata();

    expect(Object.keys(meta.environment)).toHaveLength(0);
  });

  it('metadata.environment is always an empty object after loadFromFile', async () => {
    process.env.GITHUB_TOKEN = 'ghp_supersecrettoken';

    const mockFs = jest.mocked(fs);
    mockFs.readFile.mockResolvedValueOnce('logging:\n  level: debug\n');

    const mgr = new ConfigManager();
    await mgr.loadFromFile('/path/to/config.yaml');
    const meta = mgr.getMetadata();

    expect(Object.keys(meta.environment)).toHaveLength(0);
  });

  it('GITHUB_TOKEN is not present in metadata after construction', () => {
    process.env.GITHUB_TOKEN = 'ghp_supersecrettoken';

    const mgr = new ConfigManager();
    const meta = mgr.getMetadata();

    expect('GITHUB_TOKEN' in meta.environment).toBe(false);
  });

  it('AWS_SECRET_ACCESS_KEY is not present in metadata after construction', () => {
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-super-secret';

    const mgr = new ConfigManager();
    const meta = mgr.getMetadata();

    expect('AWS_SECRET_ACCESS_KEY' in meta.environment).toBe(false);
  });

  it('exported config file does not contain process.env secrets', async () => {
    process.env.MY_DB_PASSWORD = 'hunter2';

    const mockFs = jest.mocked(fs);
    mockFs.writeFile.mockResolvedValue(undefined);

    const mgr = new ConfigManager();
    await mgr.exportToFile('/path/to/output.yaml');

    const [, content] = mockFs.writeFile.mock.calls[0] as [string, string, string];
    expect(content).not.toContain('hunter2');
    expect(content).not.toContain('MY_DB_PASSWORD');
  });
});
