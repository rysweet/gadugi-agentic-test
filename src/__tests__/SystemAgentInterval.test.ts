/**
 * Tests for SystemAgent baseline capture interval leak fix (D5).
 *
 * Verifies that calling cleanup() before the baseline duration elapses
 * correctly clears the interval so it does not keep firing.
 */

import { SystemAgent } from '../agents/SystemAgent';

// Mock heavy sub-modules so tests are fast and isolated
jest.mock('../agents/system', () => ({
  MetricsCollector: jest.fn().mockImplementation(() => ({
    getCPUMetrics: jest.fn().mockResolvedValue({ usage: 10, cores: [] }),
    getMemoryMetrics: jest.fn().mockResolvedValue({ total: 1000, used: 200, free: 800, percentage: 20 }),
    getDiskMetrics: jest.fn().mockResolvedValue({ io: { reads: 0, writes: 0 }, partitions: [] }),
    getNetworkMetrics: jest.fn().mockResolvedValue({ interfaces: [] }),
    getProcessMetrics: jest.fn().mockResolvedValue([]),
    getSystemInfo: jest.fn().mockResolvedValue({ platform: 'linux', release: '5.0', hostname: 'test' }),
  })),
  DockerMonitor: jest.fn().mockImplementation(() => ({
    checkDockerAvailability: jest.fn().mockResolvedValue(undefined),
    isAvailable: false,
    getDockerMetrics: jest.fn().mockResolvedValue(undefined),
  })),
  FileSystemWatcher: jest.fn().mockImplementation(() => ({
    setupFileSystemMonitoring: jest.fn().mockResolvedValue(undefined),
    closeAll: jest.fn(),
    getFileSystemChanges: jest.fn().mockReturnValue([]),
  })),
  SystemAnalyzer: jest.fn().mockImplementation(() => ({
    analyzeMetrics: jest.fn().mockResolvedValue([]),
    detectResourceLeaks: jest.fn().mockResolvedValue([]),
    detectPerformanceIssues: jest.fn().mockResolvedValue([]),
    generateRecommendations: jest.fn().mockReturnValue([]),
  })),
}));

describe('SystemAgent baseline capture interval (D5)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('stores baselineCaptureInterval on the instance', async () => {
    const agent = new SystemAgent({
      performanceBaseline: { captureBaseline: true, baselineDuration: 30000 },
    });

    await agent.initialize();

    // The instance should have the interval stored
    expect((agent as any).baselineCaptureInterval).toBeDefined();
  });

  it('clears baselineCaptureInterval when cleanup() is called before baseline completes', async () => {
    const agent = new SystemAgent({
      performanceBaseline: { captureBaseline: true, baselineDuration: 30000 },
    });

    await agent.initialize();

    // Confirm interval was set
    expect((agent as any).baselineCaptureInterval).toBeDefined();

    // Call cleanup before the 30-second baseline window elapses
    await agent.cleanup();

    // After cleanup the field should be cleared
    expect((agent as any).baselineCaptureInterval).toBeUndefined();
  });

  it('does not set baselineCaptureInterval when captureBaseline is false', async () => {
    const agent = new SystemAgent({
      performanceBaseline: { captureBaseline: false, baselineDuration: 30000 },
    });

    await agent.initialize();

    expect((agent as any).baselineCaptureInterval).toBeUndefined();
  });

  it('clears the interval so the callback does not fire after cleanup', async () => {
    const captureMetricsSpy = jest.spyOn(SystemAgent.prototype as any, 'captureMetrics');

    const agent = new SystemAgent({
      performanceBaseline: { captureBaseline: true, baselineDuration: 30000 },
    });

    await agent.initialize();
    await agent.cleanup();

    // Record call count after cleanup
    const callsAfterCleanup = captureMetricsSpy.mock.calls.length;

    // Advance 5 seconds — the interval should be cleared so no additional calls should occur
    jest.advanceTimersByTime(5000);

    expect(captureMetricsSpy.mock.calls.length).toBe(callsAfterCleanup);

    captureMetricsSpy.mockRestore();
  });
});
