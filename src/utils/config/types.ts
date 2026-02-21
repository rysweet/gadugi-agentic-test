/**
 * Shared types for configuration utilities
 */

import { TestConfig } from '../../models/Config';

/**
 * Configuration loading error
 */
export class ConfigError extends Error {
  constructor(message: string, public configPath?: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Configuration source types
 */
export enum ConfigSource {
  ENVIRONMENT = 'environment',
  FILE = 'file',
  DEFAULT = 'default'
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration metadata
 *
 * NOTE: The `environment` field is intentionally kept empty.
 * Snapshotting process.env would expose secrets (API keys, tokens,
 * passwords) through any serialisation path. Use loadFromEnvironment()
 * to read specific, named env vars into the TestConfig instead.
 */
export interface ConfigMetadata {
  source: ConfigSource;
  loadedAt: Date;
  filePath?: string;
  /** Always an empty object - never populated with process.env to prevent credential exposure. */
  environment: Record<string, never>;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: TestConfig = {
  execution: {
    maxParallel: 3,
    defaultTimeout: 30000,
    continueOnFailure: true,
    maxRetries: 2,
    retryDelay: 1000,
    randomizeOrder: false,
    resourceLimits: {
      maxMemory: 1024 * 1024 * 1024, // 1GB
      maxCpuUsage: 80,
      maxDiskUsage: 10 * 1024 * 1024 * 1024, // 10GB
      maxExecutionTime: 600000, // 10 minutes
      maxOpenFiles: 1024
    },
    cleanup: {
      cleanupAfterEach: true,
      cleanupAfterAll: true,
      cleanupDirectories: ['temp', 'screenshots'],
      cleanupFiles: ['*.tmp', '*.temp'],
      terminateProcesses: [],
      stopServices: [],
      customCleanupScripts: []
    }
  },
  cli: {
    executablePath: 'app-cli',
    workingDirectory: process.cwd(),
    defaultTimeout: 30000,
    environment: {},
    captureOutput: true,
    maxRetries: 2,
    retryDelay: 1000
  },
  ui: {
    browser: 'chromium',
    headless: false,
    viewport: { width: 1280, height: 720 },
    baseUrl: 'http://localhost:3000',
    defaultTimeout: 30000,
    screenshotDir: './screenshots',
    recordVideo: false
  },
  tui: {
    terminal: 'xterm',
    defaultDimensions: {
      width: 80,
      height: 24
    },
    encoding: 'utf8',
    defaultTimeout: 30000,
    pollingInterval: 100,
    captureScreenshots: true,
    recordSessions: false,
    colorMode: '24bit',
    interpretAnsi: true,
    shell: '/bin/bash',
    shellArgs: [],
    environment: {},
    workingDirectory: process.cwd(),
    accessibility: {
      highContrast: false,
      largeText: false,
      screenReader: false
    },
    performance: {
      refreshRate: 60,
      maxBufferSize: 1024 * 1024,
      hardwareAcceleration: false
    }
  },
  priority: {
    enabled: true,
    executionOrder: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    failFastOnCritical: true,
    maxParallelByPriority: {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4
    },
    timeoutMultipliers: {
      CRITICAL: 2.0,
      HIGH: 1.5,
      MEDIUM: 1.0,
      LOW: 0.8
    },
    retryCountsByPriority: {
      CRITICAL: 3,
      HIGH: 2,
      MEDIUM: 1,
      LOW: 0
    }
  },
  logging: {
    level: 'info',
    console: true,
    format: 'structured',
    includeTimestamp: true,
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 5,
    compress: true
  },
  reporting: {
    outputDir: './reports',
    formats: ['html', 'json'],
    includeScreenshots: true,
    includeLogs: true,
    customTemplates: {},
    generationTimeout: 30000
  },
  notifications: {
    enabled: false,
    channels: [],
    triggers: [],
    templates: {}
  },
  plugins: {}
};

/**
 * Environment variable mappings to config paths
 */
export const ENV_MAPPINGS: Record<string, string> = {
  'AGENTIC_LOG_LEVEL': 'logging.level',
  'AGENTIC_MAX_PARALLEL': 'execution.maxParallel',
  'AGENTIC_TIMEOUT': 'execution.defaultTimeout',
  'AGENTIC_HEADLESS': 'ui.headless',
  'AGENTIC_BROWSER': 'ui.browser',
  'AGENTIC_BASE_URL': 'ui.baseUrl',
  'AGENTIC_CLI_PATH': 'cli.executablePath',
  'AGENTIC_WORKING_DIR': 'cli.workingDirectory',
  'AGENTIC_SCREENSHOT_DIR': 'ui.screenshotDir',
  'AGENTIC_REPORT_DIR': 'reporting.outputDir',
  'GITHUB_TOKEN': 'github.token',
  'GITHUB_OWNER': 'github.owner',
  'GITHUB_REPO': 'github.repository'
};
