/**
 * Tests for src/orchestrator/SessionManager.ts
 *
 * Verifies session creation, result accumulation, status derivation,
 * and file-system persistence (mocked to avoid real disk I/O).
 */

import { SessionManager } from '../orchestrator/SessionManager';
import { TestResult, TestStatus } from '../models/TestModels';
import { TestConfig } from '../models/Config';

// ── Mock fs/promises ──────────────────────────────────────────────────────────

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import * as fs from 'fs/promises';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal TestConfig satisfying the type */
const minimalConfig: TestConfig = {
  execution: {
    maxParallel: 1,
    defaultTimeout: 5000,
    continueOnFailure: false,
    maxRetries: 0,
    retryDelay: 0,
    randomizeOrder: false,
    resourceLimits: {
      maxMemory: 0,
      maxCpuUsage: 0,
      maxDiskUsage: 0,
      maxExecutionTime: 0,
      maxOpenFiles: 0,
    },
    cleanup: {
      cleanupAfterEach: false,
      cleanupAfterAll: false,
      cleanupDirectories: [],
      cleanupFiles: [],
      terminateProcesses: [],
      stopServices: [],
      customCleanupScripts: [],
    },
  },
  cli: {
    executablePath: '',
    workingDirectory: '.',
    defaultTimeout: 5000,
    environment: {},
    captureOutput: true,
    maxRetries: 0,
    retryDelay: 0,
  },
  ui: {
    browser: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    baseUrl: 'http://localhost',
    defaultTimeout: 5000,
    screenshotDir: '/tmp',
    recordVideo: false,
  },
  tui: {
    terminalType: 'xterm-256color',
    cols: 80,
    rows: 24,
    encoding: 'utf8',
    defaultTimeout: 5000,
    interactionDelay: 50,
    scrollback: 1000,
    environment: {},
    workingDirectory: '.',
  } as any,
  priority: {
    enabled: false,
    executionOrder: [],
    failFastOnCritical: false,
    maxParallelByPriority: {},
    timeoutMultipliers: {},
    retryCountsByPriority: {},
  },
  logging: {
    level: 'info',
    console: true,
    format: 'text',
    includeTimestamp: true,
    maxFileSize: 0,
    maxFiles: 1,
    compress: false,
  },
  reporting: {
    outputDir: '/tmp',
    formats: [],
    includeScreenshots: false,
    includeLogs: false,
    customTemplates: {},
    generationTimeout: 5000,
  },
  notifications: {
    enabled: false,
    channels: [],
    triggers: [],
    templates: {},
  },
  plugins: {},
} as unknown as TestConfig;

/** Build a minimal TestResult */
function makeResult(scenarioId: string, status: TestStatus): TestResult {
  return {
    scenarioId,
    status,
    duration: 10,
    startTime: new Date(),
    endTime: new Date(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager(minimalConfig);
    jest.clearAllMocks();
  });

  it('create() returns a session with RUNNING status', () => {
    const session = manager.create();

    expect(session.id).toBeTruthy();
    expect(session.status).toBe(TestStatus.RUNNING);
    expect(session.results).toEqual([]);
    expect(session.startTime).toBeInstanceOf(Date);
    expect(session.endTime).toBeUndefined();
  });

  it('addResult() accumulates results in the active session', () => {
    manager.create();
    const r1 = makeResult('s1', TestStatus.PASSED);
    const r2 = makeResult('s2', TestStatus.FAILED);

    manager.addResult(r1);
    manager.addResult(r2);

    expect(manager.getResults()).toHaveLength(2);
    expect(manager.getSession()!.results).toHaveLength(2);
  });

  it('complete() sets endTime and returns the session', async () => {
    manager.create();
    manager.addResult(makeResult('s1', TestStatus.PASSED));

    const completed = await manager.complete();

    expect(completed.endTime).toBeInstanceOf(Date);
    expect(completed.status).toBe(TestStatus.PASSED);
  });

  it('getStatus() derives PASSED when all results pass', async () => {
    manager.create();
    manager.addResult(makeResult('s1', TestStatus.PASSED));
    manager.addResult(makeResult('s2', TestStatus.PASSED));

    const session = await manager.complete();

    expect(session.status).toBe(TestStatus.PASSED);
  });

  it('getStatus() derives FAILED when any result fails', async () => {
    manager.create();
    manager.addResult(makeResult('s1', TestStatus.PASSED));
    manager.addResult(makeResult('s2', TestStatus.FAILED));

    const session = await manager.complete();

    expect(session.status).toBe(TestStatus.FAILED);
  });

  it('persist() writes JSON to disk via fs.writeFile', async () => {
    manager.create();
    manager.addResult(makeResult('s1', TestStatus.PASSED));

    await manager.complete();

    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);

    const [filepath, content] = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(filepath).toContain('session_');
    expect(filepath).toMatch(/\.json$/);

    const parsed = JSON.parse(content as string);
    expect(parsed.id).toBeTruthy();
    expect(parsed.results).toHaveLength(1);
  });

  it('complete() throws when called before create()', async () => {
    await expect(manager.complete()).rejects.toThrow('No active session');
  });

  it('getStatus() derives ERROR when results include an ERROR status', async () => {
    manager.create();
    manager.addResult(makeResult('s1', TestStatus.PASSED));
    manager.addResult(makeResult('s2', TestStatus.ERROR));

    const session = await manager.complete();

    expect(session.status).toBe(TestStatus.ERROR);
  });

  it('getStatus() accepts an explicit overallStatus override', async () => {
    manager.create();
    manager.addResult(makeResult('s1', TestStatus.PASSED));

    const session = await manager.complete(TestStatus.SKIPPED);

    expect(session.status).toBe(TestStatus.SKIPPED);
  });

  it('create() resets accumulated results from a previous session', async () => {
    manager.create();
    manager.addResult(makeResult('s1', TestStatus.PASSED));
    await manager.complete();

    // Start a new session — results should be cleared
    manager.create();
    expect(manager.getResults()).toHaveLength(0);
  });
});
