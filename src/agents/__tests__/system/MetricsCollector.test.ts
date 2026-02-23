/**
 * MetricsCollector unit tests
 *
 * Mocks systeminformation and pidusage. Verifies each collection method
 * returns correctly shaped data under normal and error conditions.
 */

import { MetricsCollector } from '../../../agents/system/MetricsCollector';
import { TestLogger } from '../../../utils/logger';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('systeminformation', () => ({
  currentLoad: jest.fn(),
  cpuTemperature: jest.fn(),
  mem: jest.fn(),
  fsSize: jest.fn(),
  disksIO: jest.fn(),
  networkStats: jest.fn(),
  networkConnections: jest.fn(),
  processes: jest.fn(),
  system: jest.fn(),
}));

jest.mock('pidusage', () => jest.fn());

jest.mock('os', () => ({
  loadavg: jest.fn(() => [0.5, 0.6, 0.7]),
  cpus: jest.fn(() => [1, 2, 3, 4]),
  totalmem: jest.fn(() => 8 * 1024 * 1024 * 1024),
  freemem: jest.fn(() => 4 * 1024 * 1024 * 1024),
  uptime: jest.fn(() => 3600),
  platform: jest.fn(() => 'linux'),
  arch: jest.fn(() => 'x64'),
  hostname: jest.fn(() => 'test-host'),
}));

import * as si from 'systeminformation';
import pidusage from 'pidusage';
import * as os from 'os';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  let logger: TestLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();
    collector = new MetricsCollector(logger);
  });

  // -------------------------------------------------------------------------
  // getCPUMetrics
  // -------------------------------------------------------------------------

  describe('getCPUMetrics', () => {
    it('returns cpu usage, loadAverage, cores, and temperature on success', async () => {
      (si.currentLoad as jest.Mock).mockResolvedValue({ currentLoad: 42.5 });
      (si.cpuTemperature as jest.Mock).mockResolvedValue({ main: 55 });

      const result = await collector.getCPUMetrics();

      expect(result.usage).toBe(42.5);
      expect(result.loadAverage).toEqual([0.5, 0.6, 0.7]);
      expect(result.cores).toBe(4);
      expect(result.temperature).toBe(55);
    });

    it('returns temperature=undefined when cpuTemperature throws', async () => {
      (si.currentLoad as jest.Mock).mockResolvedValue({ currentLoad: 20 });
      (si.cpuTemperature as jest.Mock).mockRejectedValue(new Error('no sensor'));

      const result = await collector.getCPUMetrics();

      expect(result.temperature).toBeUndefined();
      expect(result.usage).toBe(20);
      expect(logger.warn).toHaveBeenCalledWith(
        'CPU temperature not available',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('returns zero-value fallback when currentLoad throws', async () => {
      (si.currentLoad as jest.Mock).mockRejectedValue(new Error('si error'));

      const result = await collector.getCPUMetrics();

      expect(result.usage).toBe(0);
      expect(result.loadAverage).toEqual([0, 0, 0]);
      expect(result.cores).toBe(4); // os.cpus().length still called
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get CPU metrics',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getMemoryMetrics
  // -------------------------------------------------------------------------

  describe('getMemoryMetrics', () => {
    it('returns total/free/used/percentage/available from si.mem', async () => {
      const totalBytes = 16 * 1024 * 1024 * 1024;
      const usedBytes  =  8 * 1024 * 1024 * 1024;
      const freeBytes  =  8 * 1024 * 1024 * 1024;

      (si.mem as jest.Mock).mockResolvedValue({
        total: totalBytes,
        free: freeBytes,
        used: usedBytes,
        available: freeBytes,
      });

      const result = await collector.getMemoryMetrics();

      expect(result.total).toBe(totalBytes);
      expect(result.free).toBe(freeBytes);
      expect(result.used).toBe(usedBytes);
      expect(result.percentage).toBeCloseTo(50, 1);
      expect(result.available).toBe(freeBytes);
    });

    it('falls back to os module values when si.mem throws', async () => {
      (si.mem as jest.Mock).mockRejectedValue(new Error('mem error'));

      const result = await collector.getMemoryMetrics();

      // os mock: total=8GB, free=4GB
      expect(result.total).toBe(8 * 1024 * 1024 * 1024);
      expect(result.free).toBe(4 * 1024 * 1024 * 1024);
      expect(result.used).toBe(4 * 1024 * 1024 * 1024);
      expect(result.percentage).toBeCloseTo(50, 1);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get memory metrics',
        expect.any(Object)
      );
    });
  });

  // -------------------------------------------------------------------------
  // getDiskMetrics
  // -------------------------------------------------------------------------

  describe('getDiskMetrics', () => {
    it('returns an array of disk usage entries with io', async () => {
      (si.fsSize as jest.Mock).mockResolvedValue([
        {
          fs: '/dev/sda1',
          size: 100 * 1024 * 1024 * 1024,
          used: 40 * 1024 * 1024 * 1024,
          available: 60 * 1024 * 1024 * 1024,
          use: 40,
          mount: '/',
        },
      ]);
      (si.disksIO as jest.Mock).mockResolvedValue({
        rIO: 1000,
        wIO: 500,
        rIO_sec: 10,
        wIO_sec: 5,
      });

      const result = await collector.getDiskMetrics();

      expect(result.usage).toHaveLength(1);
      expect(result.usage[0].filesystem).toBe('/dev/sda1');
      expect(result.usage[0].percentage).toBe(40);
      expect(result.io).toBeDefined();
      expect(result.io?.reads).toBe(1000);
      expect(result.io?.writes).toBe(500);
    });

    it('returns disk info without io when disksIO throws', async () => {
      (si.fsSize as jest.Mock).mockResolvedValue([
        {
          fs: '/dev/sda1',
          size: 100,
          used: 50,
          available: 50,
          use: 50,
          mount: '/',
        },
      ]);
      (si.disksIO as jest.Mock).mockRejectedValue(new Error('no io'));

      const result = await collector.getDiskMetrics();

      expect(result.usage).toHaveLength(1);
      expect(result.io).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        'Disk I/O metrics not available',
        expect.any(Object)
      );
    });

    it('returns empty usage array on total failure', async () => {
      (si.fsSize as jest.Mock).mockRejectedValue(new Error('fsSize error'));

      const result = await collector.getDiskMetrics();

      expect(result.usage).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get disk metrics',
        expect.any(Object)
      );
    });
  });

  // -------------------------------------------------------------------------
  // getNetworkMetrics
  // -------------------------------------------------------------------------

  describe('getNetworkMetrics', () => {
    it('returns interfaces mapped from networkStats', async () => {
      (si.networkStats as jest.Mock).mockResolvedValue([
        {
          iface: 'eth0',
          rx_sec: 1024,
          tx_sec: 512,
          rx_bytes: 100000,
          tx_bytes: 50000,
        },
      ]);
      (si.networkConnections as jest.Mock).mockResolvedValue([{}, {}, {}]);

      const result = await collector.getNetworkMetrics();

      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0].name).toBe('eth0');
      expect(result.interfaces[0].rx).toBe(1024);
      expect(result.interfaces[0].tx).toBe(512);
      expect(result.interfaces[0].rxBytes).toBe(100000);
      expect(result.interfaces[0].txBytes).toBe(50000);
      expect(result.connections).toBe(3);
    });

    it('returns connections=0 when networkConnections throws', async () => {
      (si.networkStats as jest.Mock).mockResolvedValue([
        { iface: 'lo', rx_sec: 0, tx_sec: 0, rx_bytes: 0, tx_bytes: 0 },
      ]);
      (si.networkConnections as jest.Mock).mockRejectedValue(new Error('no conns'));

      const result = await collector.getNetworkMetrics();

      expect(result.connections).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        'Network connections not available',
        expect.any(Object)
      );
    });

    it('returns empty interfaces on total failure', async () => {
      (si.networkStats as jest.Mock).mockRejectedValue(new Error('net error'));

      const result = await collector.getNetworkMetrics();

      expect(result.interfaces).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get network metrics',
        expect.any(Object)
      );
    });
  });

  // -------------------------------------------------------------------------
  // getProcessMetrics
  // -------------------------------------------------------------------------

  describe('getProcessMetrics', () => {
    it('returns process list with pid/name/cpu/memory from pidusage', async () => {
      (si.processes as jest.Mock).mockResolvedValue({
        list: [
          {
            pid: 123,
            name: 'node',
            command: 'node app.js',
            cpu: 1.5,
            memRss: 50000,
            state: 'running',
            parentPid: 1,
            priority: 0,
            nice: 0,
            started: '2026-01-01T00:00:00Z',
          },
        ],
      });
      (pidusage as jest.Mock).mockResolvedValue({ cpu: 2.5, memory: 60000 });

      const result = await collector.getProcessMetrics();

      expect(result).toHaveLength(1);
      expect(result[0].pid).toBe(123);
      expect(result[0].name).toBe('node');
      expect(result[0].cpu).toBe(2.5);   // from pidusage
      expect(result[0].memory).toBe(60000);
      expect(result[0].zombie).toBe(false);
    });

    it('falls back to si.processes values when pidusage fails', async () => {
      (si.processes as jest.Mock).mockResolvedValue({
        list: [
          {
            pid: 99,
            name: 'zombie_proc',
            command: 'zombie_proc',
            cpu: 0,
            memRss: 1024,
            state: 'zombie',
            parentPid: 1,
            priority: 0,
            nice: 0,
            started: null,
          },
        ],
      });
      (pidusage as jest.Mock).mockRejectedValue(new Error('access denied'));

      const result = await collector.getProcessMetrics();

      expect(result).toHaveLength(1);
      expect(result[0].pid).toBe(99);
      expect(result[0].cpu).toBe(0);       // falls back to si cpu
      expect(result[0].memory).toBe(1024); // falls back to memRss
      expect(result[0].zombie).toBe(true);
    });

    it('marks process as zombie when state is Z', async () => {
      (si.processes as jest.Mock).mockResolvedValue({
        list: [
          {
            pid: 200,
            name: 'defunct',
            command: '<defunct>',
            cpu: 0,
            memRss: 0,
            state: 'Z',
            parentPid: 1,
            priority: 0,
            nice: 0,
            started: null,
          },
        ],
      });
      (pidusage as jest.Mock).mockResolvedValue({ cpu: 0, memory: 0 });

      const result = await collector.getProcessMetrics();

      expect(result[0].zombie).toBe(true);
    });

    it('returns empty array when si.processes throws', async () => {
      (si.processes as jest.Mock).mockRejectedValue(new Error('proc error'));

      const result = await collector.getProcessMetrics();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get process metrics',
        expect.any(Object)
      );
    });
  });

  // -------------------------------------------------------------------------
  // getSystemInfo
  // -------------------------------------------------------------------------

  describe('getSystemInfo', () => {
    it('returns platform/arch/hostname/uptime from os module', async () => {
      (si.system as jest.Mock).mockResolvedValue({});

      const result = await collector.getSystemInfo();

      expect(result.uptime).toBe(3600);
      expect(result.platform).toBe('linux');
      expect(result.arch).toBe('x64');
      expect(result.hostname).toBe('test-host');
    });

    it('still returns os values even when si.system throws', async () => {
      (si.system as jest.Mock).mockRejectedValue(new Error('si error'));

      const result = await collector.getSystemInfo();

      expect(result.platform).toBe('linux');
      expect(result.hostname).toBe('test-host');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get system info',
        expect.any(Object)
      );
    });
  });
});
