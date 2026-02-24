/**
 * ElectronPerformanceMonitor test suite
 *
 * Verifies periodic sampling, stop, getLatestMetrics, getNetworkState.
 * Uses jest fake timers to control setInterval without real waits.
 */

import { ElectronPerformanceMonitor } from '../../electron/ElectronPerformanceMonitor';
import { ElectronUIAgentConfig } from '../../electron/types';

function makeConfig(
  enabled = true,
  sampleInterval = 100
): ElectronUIAgentConfig {
  return {
    executablePath: '/usr/bin/electron-app',
    performanceConfig: {
      enabled,
      sampleInterval,
      collectLogs: false,
    },
  };
}

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    scenarioStart: jest.fn(),
    scenarioEnd: jest.fn(),
    stepExecution: jest.fn(),
    stepComplete: jest.fn(),
  } as any;
}

/** A minimal Page mock whose evaluate returns predictable performance data */
function makePage(responseTime = 100, memoryUsage = 512000) {
  return {
    evaluate: jest.fn().mockResolvedValue({ responseTime, memoryUsage }),
  } as any;
}

describe('ElectronPerformanceMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ------------------------------------------------------------------ start
  describe('start()', () => {
    it('does nothing when performanceConfig.enabled is false', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(false), makeLogger());
      const page = makePage();

      monitor.start(page);

      jest.advanceTimersByTime(500);

      expect(page.evaluate).not.toHaveBeenCalled();
      expect(monitor.samples).toHaveLength(0);
    });

    it('begins sampling at the configured sampleInterval', async () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(true, 200), makeLogger());
      const page = makePage();

      monitor.start(page);

      // Advance enough time for 3 intervals
      jest.advanceTimersByTime(600);

      // Flush pending async operations
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // evaluate should have been called 3 times
      expect(page.evaluate).toHaveBeenCalledTimes(3);
    });

    it('accumulates samples over multiple intervals', async () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(true, 100), makeLogger());
      const page = makePage(200, 1024000);

      monitor.start(page);

      jest.advanceTimersByTime(300);

      // Flush async operations
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(monitor.samples.length).toBeGreaterThanOrEqual(1);
    });

    it('caps stored samples at 1000 by removing 100 when limit exceeded', async () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(true, 10), makeLogger());
      const page = makePage();

      monitor.start(page);

      // Seed 1000 samples manually to trigger cap
      for (let i = 0; i < 1000; i++) {
        monitor.samples.push({ timestamp: new Date(), responseTime: i });
      }

      // One more interval tick should trigger the splice
      jest.advanceTimersByTime(10);
      for (let i = 0; i < 5; i++) await Promise.resolve();

      // After cap: 1000 - 100 + 1 new = 901
      expect(monitor.samples.length).toBeLessThanOrEqual(901);
    });
  });

  // ------------------------------------------------------------------- stop
  describe('stop()', () => {
    it('clears the sampling interval so no more samples are collected', async () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(true, 100), makeLogger());
      const page = makePage();

      monitor.start(page);
      monitor.stop();

      // Advance time — no new ticks should fire
      jest.advanceTimersByTime(500);
      for (let i = 0; i < 5; i++) await Promise.resolve();

      const countAfterStop = monitor.samples.length;
      jest.advanceTimersByTime(500);
      for (let i = 0; i < 5; i++) await Promise.resolve();

      expect(monitor.samples.length).toBe(countAfterStop);
    });

    it('is safe to call when not started (no-op)', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(), makeLogger());
      expect(() => monitor.stop()).not.toThrow();
    });

    it('is safe to call twice', async () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(true, 100), makeLogger());
      const page = makePage();

      monitor.start(page);
      monitor.stop();
      expect(() => monitor.stop()).not.toThrow();
    });
  });

  // ----------------------------------------------------------- getLatestMetrics
  describe('getLatestMetrics()', () => {
    it('returns undefined when no samples have been collected', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(), makeLogger());
      expect(monitor.getLatestMetrics()).toBeUndefined();
    });

    it('returns metrics from the most recently collected sample', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(), makeLogger());

      monitor.samples.push({ timestamp: new Date(), responseTime: 50, memoryUsage: 256000 });
      monitor.samples.push({ timestamp: new Date(), responseTime: 75, memoryUsage: 512000 });

      const metrics = monitor.getLatestMetrics();

      expect(metrics).toBeDefined();
      expect(metrics!.responseTime).toBe(75);
      expect(metrics!.memoryUsage).toBe(512000);
    });

    it('returns cpuUsage as 0 when not present in sample', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(), makeLogger());
      monitor.samples.push({ timestamp: new Date() });

      const metrics = monitor.getLatestMetrics();

      expect(metrics!.cpuUsage).toBe(0);
    });

    it('returns availableMemory as 0 (placeholder)', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(), makeLogger());
      monitor.samples.push({ timestamp: new Date(), memoryUsage: 100 });

      const metrics = monitor.getLatestMetrics();

      expect(metrics!.availableMemory).toBe(0);
    });

    it('includes frameRate from sample when present', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(), makeLogger());
      monitor.samples.push({ timestamp: new Date(), frameRate: 60 });

      const metrics = monitor.getLatestMetrics();

      expect(metrics!.frameRate).toBe(60);
    });
  });

  // ----------------------------------------------------------- getNetworkState
  describe('getNetworkState()', () => {
    it('returns isOnline: true', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(), makeLogger());
      const state = monitor.getNetworkState();

      expect(state.isOnline).toBe(true);
    });

    it('returns connectionType: ethernet', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(), makeLogger());
      const state = monitor.getNetworkState();

      expect(state.connectionType).toBe('ethernet');
    });

    it('returns an empty activeConnections array', () => {
      const monitor = new ElectronPerformanceMonitor(makeConfig(), makeLogger());
      const state = monitor.getNetworkState();

      expect(Array.isArray(state.activeConnections)).toBe(true);
      expect(state.activeConnections).toHaveLength(0);
    });
  });

  // ------------------------------------------------ error handling in interval
  describe('error handling during sampling', () => {
    it('does not throw when page.evaluate rejects — pushes timestamp-only sample and logs debug', async () => {
      const logger = makeLogger();
      const monitor = new ElectronPerformanceMonitor(makeConfig(true, 100), logger);
      const page = { evaluate: jest.fn().mockRejectedValue(new Error('page crash')) } as any;

      monitor.start(page);

      jest.advanceTimersByTime(100);
      for (let i = 0; i < 5; i++) await Promise.resolve();

      // collectSample catches the evaluate error and still pushes a timestamp-only sample
      expect(monitor.samples).toHaveLength(1);
      expect(monitor.samples[0].timestamp).toBeInstanceOf(Date);
      // No responseTime or memoryUsage because evaluate failed
      expect(monitor.samples[0].responseTime).toBeUndefined();
      expect(monitor.samples[0].memoryUsage).toBeUndefined();
      // Logging occurred for the evaluate failure
      expect(logger.debug).toHaveBeenCalled();
      // Monitor is still functional after error
      expect(() => monitor.stop()).not.toThrow();
    });
  });
});
