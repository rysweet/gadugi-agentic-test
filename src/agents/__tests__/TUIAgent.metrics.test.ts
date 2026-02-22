/**
 * TUIAgent Performance Metrics Tests
 *
 * Verifies that collectPerformanceMetrics() uses real CPU monitoring (not a hardcoded 0)
 * and that getPerformanceMetrics() returns the stored history.
 *
 * Closes: #41
 */

import { TUIAgent, PerformanceMetrics } from '../TUIAgent';

// Mock pidusage so tests don't depend on OS process stats
jest.mock('pidusage', () =>
  jest.fn().mockResolvedValue({ cpu: 42.5, memory: 1024 * 1024 * 50 })
);

// Mock fs/promises to avoid filesystem side-effects during init
jest.mock('fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  readdir: jest.fn().mockResolvedValue([]),
}));

// Mock logger to suppress noise
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    scenarioStart: jest.fn(),
    scenarioEnd: jest.fn(),
  }),
  LogLevel: { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' },
}));

describe('TUIAgent performance metrics (#41)', () => {
  let agent: TUIAgent;

  beforeEach(() => {
    // Disable automatic performance monitoring in tests so we can trigger manually
    agent = new TUIAgent({
      performance: { enabled: false, sampleRate: 1000, memoryThreshold: 100, cpuThreshold: 80 },
    });
  });

  afterEach(() => {
    agent.removeAllListeners();
  });

  describe('collectPerformanceMetrics()', () => {
    it('emits a performanceMetrics event after collection', async () => {
      const events: any[] = [];
      agent.on('performanceMetrics', (m) => events.push(m));

      // Access private method via cast
      await (agent as any).collectPerformanceMetrics();

      expect(events).toHaveLength(1);
    });

    it('cpuUsage is a real number (not always 0)', async () => {
      const events: any[] = [];
      agent.on('performanceMetrics', (m) => events.push(m));

      await (agent as any).collectPerformanceMetrics();

      const metric = events[0];
      expect(typeof metric.cpuUsage).toBe('number');
      // The mock returns 42.5 — confirm we are NOT hardcoding 0
      expect(metric.cpuUsage).not.toBe(0);
      expect(metric.cpuUsage).toBe(42.5);
    });

    it('memoryUsage is a positive number in MB', async () => {
      const events: any[] = [];
      agent.on('performanceMetrics', (m) => events.push(m));

      await (agent as any).collectPerformanceMetrics();

      const metric = events[0];
      expect(typeof metric.memoryUsage).toBe('number');
      expect(metric.memoryUsage).toBeGreaterThan(0);
    });

    it('stores collected metrics in history', async () => {
      await (agent as any).collectPerformanceMetrics();
      await (agent as any).collectPerformanceMetrics();

      const history: PerformanceMetrics[] = (agent as any).getPerformanceMetrics();
      expect(history).toHaveLength(2);
    });

    it('caps history at 100 entries', async () => {
      // Collect 105 metrics
      for (let i = 0; i < 105; i++) {
        await (agent as any).collectPerformanceMetrics();
      }

      const history: PerformanceMetrics[] = (agent as any).getPerformanceMetrics();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('getPerformanceMetrics()', () => {
    it('returns empty array before any collection', () => {
      const history = (agent as any).getPerformanceMetrics();
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(0);
    });

    it('returns a copy so mutations do not affect internal state', async () => {
      await (agent as any).collectPerformanceMetrics();

      const history = (agent as any).getPerformanceMetrics() as PerformanceMetrics[];
      const originalLength = history.length;

      // Mutate the returned array
      history.push({ memoryUsage: 999, cpuUsage: 999, responseTime: 0, renderTime: 0 });

      const historyAfter = (agent as any).getPerformanceMetrics() as PerformanceMetrics[];
      expect(historyAfter).toHaveLength(originalLength);
    });

    it('returned metrics have the expected PerformanceMetrics shape', async () => {
      await (agent as any).collectPerformanceMetrics();

      const history: PerformanceMetrics[] = (agent as any).getPerformanceMetrics();
      const metric = history[0];

      expect(metric).toHaveProperty('memoryUsage');
      expect(metric).toHaveProperty('cpuUsage');
      expect(metric).toHaveProperty('responseTime');
      expect(metric).toHaveProperty('renderTime');
    });
  });
});
