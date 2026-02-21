/**
 * MetricsCollector - Pure data collection methods for system metrics
 *
 * Collects CPU, memory, disk, network, process, and system information
 * using `systeminformation`, `pidusage`, and Node.js `os` module.
 */

import * as os from 'os';
import * as si from 'systeminformation';
import pidusage from 'pidusage';
import { TestLogger } from '../../utils/logger';
import {
  SystemMetrics,
  DiskUsage,
  DiskIO,
  NetworkInterface,
  ProcessInfo,
} from './types';

export class MetricsCollector {
  constructor(private readonly logger: TestLogger) {}

  /**
   * Get CPU metrics
   */
  async getCPUMetrics(): Promise<SystemMetrics['cpu']> {
    try {
      const currentLoad = await si.currentLoad();
      const cpuTemperature = await si.cpuTemperature().catch((err) => {
        this.logger.warn('CPU temperature not available', { error: err });
        return { main: undefined };
      });

      return {
        usage: currentLoad.currentLoad,
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
        temperature: cpuTemperature.main,
      };
    } catch (error) {
      this.logger.error('Failed to get CPU metrics', { error });
      return {
        usage: 0,
        loadAverage: [0, 0, 0],
        cores: os.cpus().length,
      };
    }
  }

  /**
   * Get memory metrics
   */
  async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    try {
      const mem = await si.mem();

      return {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        percentage: (mem.used / mem.total) * 100,
        available: mem.available,
      };
    } catch (error) {
      this.logger.error('Failed to get memory metrics', { error });
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      return {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        percentage: (usedMem / totalMem) * 100,
        available: freeMem,
      };
    }
  }

  /**
   * Get disk metrics
   */
  async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    try {
      const [fsSize, diskIO] = await Promise.all([
        si.fsSize(),
        si.disksIO().catch((err) => {
          this.logger.warn('Disk I/O metrics not available', { error: err });
          return undefined;
        }),
      ]);

      const usage: DiskUsage[] = fsSize.map((fs) => ({
        filesystem: fs.fs,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        percentage: fs.use,
        mountpoint: fs.mount,
      }));

      const io: DiskIO | undefined = diskIO
        ? {
            reads: diskIO.rIO,
            writes: diskIO.wIO,
            readBytes: (diskIO.rIO_sec || 0) * 512, // Approximate
            writeBytes: (diskIO.wIO_sec || 0) * 512, // Approximate
          }
        : undefined;

      return { usage, io };
    } catch (error) {
      this.logger.error('Failed to get disk metrics', { error });
      return { usage: [] };
    }
  }

  /**
   * Get network metrics
   */
  async getNetworkMetrics(): Promise<SystemMetrics['network']> {
    try {
      const [networkStats, networkConnections] = await Promise.all([
        si.networkStats(),
        si.networkConnections().catch((err) => {
          this.logger.warn('Network connections not available', { error: err });
          return [];
        }),
      ]);

      const interfaces: NetworkInterface[] = networkStats.map((stat) => ({
        name: stat.iface,
        rx: stat.rx_sec,
        tx: stat.tx_sec,
        rxBytes: stat.rx_bytes,
        txBytes: stat.tx_bytes,
        speed: undefined,
      }));

      return {
        interfaces,
        connections: networkConnections.length,
      };
    } catch (error) {
      this.logger.error('Failed to get network metrics', { error });
      return { interfaces: [] };
    }
  }

  /**
   * Get process metrics
   */
  async getProcessMetrics(): Promise<ProcessInfo[]> {
    try {
      const processes = await si.processes();
      const processInfos: ProcessInfo[] = [];

      for (const proc of processes.list) {
        try {
          const stats = await pidusage(proc.pid).catch((err) => {
            this.logger.debug(
              `Failed to get pidusage stats for PID ${proc.pid}`,
              { error: err }
            );
            return null;
          });

          processInfos.push({
            pid: proc.pid,
            name: proc.name,
            command: proc.command,
            cpu: stats ? stats.cpu : proc.cpu,
            memory: stats ? stats.memory : proc.memRss || 0,
            state: proc.state,
            ppid: proc.parentPid,
            uid: undefined,
            gid: undefined,
            priority: proc.priority,
            nice: proc.nice,
            threads: undefined,
            startTime: proc.started ? new Date(proc.started) : undefined,
            zombie: proc.state === 'zombie' || proc.state === 'Z',
          });
        } catch (procError) {
          // Skip processes we can't access
          this.logger.debug(`Cannot access process ${proc.pid}`, {
            error: procError,
          });
          continue;
        }
      }

      return processInfos;
    } catch (error) {
      this.logger.error('Failed to get process metrics', { error });
      return [];
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<SystemMetrics['system']> {
    try {
      // Call si.system() to keep the same behaviour as the original
      await si.system();

      return {
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
      };
    } catch (error) {
      this.logger.error('Failed to get system info', { error });
      return {
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
      };
    }
  }
}
