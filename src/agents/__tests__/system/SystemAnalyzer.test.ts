/**
 * SystemAnalyzer unit tests
 *
 * Pure logic — no mocking needed. Supply sample SystemMetrics to verify:
 * - analyzeMetrics() returns no issues for healthy metrics
 * - analyzeMetrics() returns cpu/memory/disk/process issues when thresholds exceeded
 * - detectResourceLeaks() needs >= 10 samples; detects memory and process trends
 * - detectPerformanceIssues() detects cpu-spike and disk-thrashing
 * - generateRecommendations() maps issue types to recommendation strings
 */

import { SystemAnalyzer } from '../../../agents/system/SystemAnalyzer';
import { TestLogger } from '../../../utils/logger';
import {
  SystemMetrics,
  SystemAgentConfig,
  SystemIssue,
  ResourceLeak,
  PerformanceIssue,
} from '../../../agents/system/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): TestLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as TestLogger;
}

function makeHealthyMetrics(overrides: Partial<SystemMetrics> = {}): SystemMetrics {
  return {
    timestamp: new Date(),
    cpu: { usage: 10, loadAverage: [0.1, 0.2, 0.3], cores: 4 },
    memory: { total: 8 * 1e9, free: 6 * 1e9, used: 2 * 1e9, percentage: 25, available: 6 * 1e9 },
    disk: {
      usage: [
        { filesystem: '/dev/sda1', size: 100 * 1e9, used: 40 * 1e9, available: 60 * 1e9, percentage: 40, mountpoint: '/' },
      ],
    },
    network: { interfaces: [], connections: 0 },
    processes: [],
    system: { uptime: 3600, platform: 'linux', arch: 'x64', hostname: 'host' },
    ...overrides,
  };
}

const defaultConfig: SystemAgentConfig = {
  cpuThreshold: 80,
  memoryThreshold: 85,
  diskThreshold: 90,
  processCountThreshold: 500,
  monitoringInterval: 5000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SystemAnalyzer', () => {
  let analyzer: SystemAnalyzer;

  beforeEach(() => {
    analyzer = new SystemAnalyzer(makeLogger());
  });

  // -------------------------------------------------------------------------
  // analyzeMetrics
  // -------------------------------------------------------------------------

  describe('analyzeMetrics', () => {
    it('returns empty issues array for healthy metrics', async () => {
      const issues = await analyzer.analyzeMetrics(makeHealthyMetrics(), defaultConfig);
      expect(issues).toEqual([]);
    });

    it('returns a cpu issue with severity "high" when usage exceeds threshold', async () => {
      const metrics = makeHealthyMetrics({ cpu: { usage: 85, loadAverage: [1, 1, 1], cores: 4 } });
      const issues = await analyzer.analyzeMetrics(metrics, defaultConfig);

      const cpuIssues = issues.filter((i) => i.type === 'cpu');
      expect(cpuIssues).toHaveLength(1);
      expect(cpuIssues[0].severity).toBe('high');
      expect(cpuIssues[0].message).toContain('85.0');
    });

    it('returns a cpu issue with severity "critical" when usage > 95', async () => {
      const metrics = makeHealthyMetrics({ cpu: { usage: 97, loadAverage: [5, 5, 5], cores: 4 } });
      const issues = await analyzer.analyzeMetrics(metrics, defaultConfig);

      const cpuIssues = issues.filter((i) => i.type === 'cpu');
      expect(cpuIssues).toHaveLength(1);
      expect(cpuIssues[0].severity).toBe('critical');
    });

    it('returns a memory issue when percentage exceeds threshold', async () => {
      const metrics = makeHealthyMetrics({
        memory: {
          total: 8 * 1e9,
          free: 1 * 1e9,
          used: 7 * 1e9,
          percentage: 90,
          available: 1 * 1e9,
        },
      });
      const issues = await analyzer.analyzeMetrics(metrics, defaultConfig);

      const memIssues = issues.filter((i) => i.type === 'memory');
      expect(memIssues).toHaveLength(1);
      expect(memIssues[0].severity).toBe('high');
    });

    it('returns memory issue with severity "critical" when percentage > 95', async () => {
      const metrics = makeHealthyMetrics({
        memory: {
          total: 8 * 1e9,
          free: 0.3 * 1e9,
          used: 7.7 * 1e9,
          percentage: 96,
          available: 0.3 * 1e9,
        },
      });
      const issues = await analyzer.analyzeMetrics(metrics, defaultConfig);

      const memIssues = issues.filter((i) => i.type === 'memory');
      expect(memIssues[0].severity).toBe('critical');
    });

    it('returns a disk issue when disk percentage exceeds threshold', async () => {
      const metrics = makeHealthyMetrics({
        disk: {
          usage: [
            {
              filesystem: '/dev/sdb1',
              size: 1000,
              used: 950,
              available: 50,
              percentage: 95,
              mountpoint: '/data',
            },
          ],
        },
      });
      const issues = await analyzer.analyzeMetrics(metrics, defaultConfig);

      const diskIssues = issues.filter((i) => i.type === 'disk');
      expect(diskIssues).toHaveLength(1);
      expect(diskIssues[0].message).toContain('/dev/sdb1');
    });

    it('returns a process count issue when processes exceed threshold', async () => {
      const manyProcesses = Array.from({ length: 501 }, (_, i) => ({
        pid: i,
        name: `proc_${i}`,
        command: `proc_${i}`,
        cpu: 0,
        memory: 0,
        state: 'running',
        zombie: false,
      }));

      const metrics = makeHealthyMetrics({ processes: manyProcesses });
      const issues = await analyzer.analyzeMetrics(metrics, defaultConfig);

      const procIssues = issues.filter((i) => i.type === 'process');
      expect(procIssues.some((p) => p.message.includes('process count'))).toBe(true);
    });

    it('returns a zombie process issue when zombie processes exist', async () => {
      const metrics = makeHealthyMetrics({
        processes: [
          { pid: 99, name: 'zombie', command: '<defunct>', cpu: 0, memory: 0, state: 'zombie', zombie: true },
        ],
      });

      const issues = await analyzer.analyzeMetrics(metrics, defaultConfig);

      const zombieIssues = issues.filter(
        (i) => i.type === 'process' && i.message.includes('zombie')
      );
      expect(zombieIssues).toHaveLength(1);
      expect(zombieIssues[0].severity).toBe('medium');
    });

    it('uses default thresholds when config thresholds are not set', async () => {
      // CPU default threshold is 80 — usage of 85 should trigger
      const metrics = makeHealthyMetrics({ cpu: { usage: 85, loadAverage: [1, 1, 1], cores: 4 } });
      const issues = await analyzer.analyzeMetrics(metrics, {});

      expect(issues.some((i) => i.type === 'cpu')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // detectResourceLeaks
  // -------------------------------------------------------------------------

  describe('detectResourceLeaks', () => {
    it('returns empty array when fewer than 10 samples provided', async () => {
      const samples = Array.from({ length: 9 }, () => makeHealthyMetrics());
      const leaks = await analyzer.detectResourceLeaks(samples);
      expect(leaks).toEqual([]);
    });

    it('detects memory leak when memory percentage shows sustained increase', async () => {
      // 10 samples with steadily increasing memory
      const samples = Array.from({ length: 10 }, (_, i) =>
        makeHealthyMetrics({
          memory: {
            total: 8 * 1e9,
            free: (8 - i) * 1e8,
            used: i * 1e8,
            percentage: 20 + i * 5,
            available: (8 - i) * 1e8,
          },
        })
      );

      const leaks = await analyzer.detectResourceLeaks(samples);

      expect(leaks.some((l) => l.type === 'memory')).toBe(true);
    });

    it('detects process leak when process count shows sustained increase', async () => {
      const samples = Array.from({ length: 10 }, (_, i) =>
        makeHealthyMetrics({
          processes: Array.from({ length: 10 + i * 5 }, (_, j) => ({
            pid: j,
            name: `proc_${j}`,
            command: `proc_${j}`,
            cpu: 0,
            memory: 0,
            state: 'running',
            zombie: false,
          })),
        })
      );

      const leaks = await analyzer.detectResourceLeaks(samples);

      expect(leaks.some((l) => l.type === 'process')).toBe(true);
    });

    it('returns no leaks for flat/stable metrics', async () => {
      const samples = Array.from({ length: 10 }, () => makeHealthyMetrics());
      const leaks = await analyzer.detectResourceLeaks(samples);
      expect(leaks).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // detectPerformanceIssues
  // -------------------------------------------------------------------------

  describe('detectPerformanceIssues', () => {
    it('returns empty array when fewer than 5 samples provided', async () => {
      const samples = Array.from({ length: 4 }, () => makeHealthyMetrics());
      const issues = await analyzer.detectPerformanceIssues(samples, defaultConfig);
      expect(issues).toEqual([]);
    });

    it('detects cpu-spike when average CPU > 90 over last 5 samples', async () => {
      const samples = Array.from({ length: 5 }, () =>
        makeHealthyMetrics({ cpu: { usage: 95, loadAverage: [5, 5, 5], cores: 4 } })
      );

      const issues = await analyzer.detectPerformanceIssues(samples, defaultConfig);

      expect(issues.some((i) => i.type === 'cpu-spike')).toBe(true);
    });

    it('detects disk-thrashing when average disk reads > 1000', async () => {
      const samples = Array.from({ length: 5 }, () =>
        makeHealthyMetrics({
          disk: {
            usage: [],
            io: { reads: 2000, writes: 500, readBytes: 2000 * 512, writeBytes: 500 * 512 },
          },
        })
      );

      const issues = await analyzer.detectPerformanceIssues(samples, defaultConfig);

      expect(issues.some((i) => i.type === 'disk-thrashing')).toBe(true);
    });

    it('returns no performance issues for healthy samples', async () => {
      const samples = Array.from({ length: 5 }, () => makeHealthyMetrics());
      const issues = await analyzer.detectPerformanceIssues(samples, defaultConfig);
      expect(issues).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // generateRecommendations
  // -------------------------------------------------------------------------

  describe('generateRecommendations', () => {
    it('returns empty array when no issues exist', () => {
      const recs = analyzer.generateRecommendations([], [], []);
      expect(recs).toEqual([]);
    });

    it('recommends CPU optimization for cpu issues', () => {
      const cpuIssue: SystemIssue = {
        type: 'cpu',
        severity: 'high',
        message: 'High CPU',
        details: {},
        timestamp: new Date(),
      };

      const recs = analyzer.generateRecommendations([cpuIssue], [], []);

      expect(recs.some((r) => r.toLowerCase().includes('cpu'))).toBe(true);
    });

    it('recommends memory optimization for memory issues', () => {
      const memIssue: SystemIssue = {
        type: 'memory',
        severity: 'high',
        message: 'High memory',
        details: {},
        timestamp: new Date(),
      };

      const recs = analyzer.generateRecommendations([memIssue], [], []);

      expect(recs.some((r) => r.toLowerCase().includes('memory'))).toBe(true);
    });

    it('recommends disk cleanup for disk issues', () => {
      const diskIssue: SystemIssue = {
        type: 'disk',
        severity: 'high',
        message: 'High disk',
        details: {},
        timestamp: new Date(),
      };

      const recs = analyzer.generateRecommendations([diskIssue], [], []);

      expect(recs.some((r) => r.toLowerCase().includes('disk') || r.toLowerCase().includes('temp'))).toBe(true);
    });

    it('recommends process cleanup for zombie process issues', () => {
      const zombieIssue: SystemIssue = {
        type: 'process',
        severity: 'medium',
        message: 'Found 3 zombie processes',
        details: {},
        timestamp: new Date(),
      };

      const recs = analyzer.generateRecommendations([zombieIssue], [], []);

      expect(recs.some((r) => r.toLowerCase().includes('zombie') || r.toLowerCase().includes('process'))).toBe(true);
    });

    it('recommends memory monitoring when memory leak detected', () => {
      const memLeak: ResourceLeak = {
        type: 'memory',
        source: 'system',
        severity: 'medium',
        trend: [50, 55, 60, 65, 70],
        recommendation: 'Investigate memory',
      };

      const recs = analyzer.generateRecommendations([], [memLeak], []);

      expect(recs.some((r) => r.toLowerCase().includes('memory'))).toBe(true);
    });

    it('recommends CPU investigation for cpu-spike performance issues', () => {
      const cpuSpike: PerformanceIssue = {
        type: 'cpu-spike',
        component: 'system',
        impact: 'high',
        duration: 25000,
        details: {},
      };

      const recs = analyzer.generateRecommendations([], [], [cpuSpike]);

      expect(recs.some((r) => r.toLowerCase().includes('cpu'))).toBe(true);
    });

    it('recommends caching for disk-thrashing performance issues', () => {
      const diskThrash: PerformanceIssue = {
        type: 'disk-thrashing',
        component: 'storage',
        impact: 'medium',
        duration: 25000,
        details: {},
      };

      const recs = analyzer.generateRecommendations([], [], [diskThrash]);

      expect(recs.some((r) => r.toLowerCase().includes('disk') || r.toLowerCase().includes('cach'))).toBe(true);
    });
  });
});
