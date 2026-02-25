/**
 * SystemAgent - Thin orchestrator composing system monitoring sub-modules
 */

import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { glob } from 'glob';
import { IAgent, AgentType } from './index';
import { TestLogger, createLogger, LogLevel } from '../utils/logger';
import { MetricsCollector, DockerMonitor, FileSystemWatcher, SystemAnalyzer } from './system';
import {
  SystemAgentConfig, SystemMetrics, SystemHealthReport,
  PerformanceBaseline, FileSystemChange, defaultSystemAgentConfig,
} from './system/types';

// Re-export every public type so existing imports from './SystemAgent' still work
export type {
  SystemAgentConfig, SystemMetrics, DiskUsage, DiskIO, NetworkInterface,
  ProcessInfo, DockerInfo, SystemHealthReport, SystemIssue,
  ResourceLeak, PerformanceIssue, FileSystemChange, PerformanceBaseline,
} from './system/types';
export { defaultSystemAgentConfig } from './system/types';

export class SystemAgent extends EventEmitter implements IAgent {
  public readonly name = 'SystemAgent';
  public readonly type = AgentType.SYSTEM;

  private config: SystemAgentConfig;
  private logger: TestLogger;
  private monitoringInterval: NodeJS.Timeout | undefined;
  private baselineCaptureInterval: NodeJS.Timeout | undefined;
  private isMonitoring = false;
  private metricsHistory: SystemMetrics[] = [];
  private performanceBaseline: PerformanceBaseline | undefined;
  private readonly maxHistorySize = 1000;

  private metricsCollector: MetricsCollector;
  private dockerMonitor: DockerMonitor;
  private fsWatcher: FileSystemWatcher;
  private analyzer: SystemAnalyzer;

  constructor(config: Partial<SystemAgentConfig> = {}) {
    super();
    this.config = { ...defaultSystemAgentConfig, ...config };
    this.logger = createLogger({ level: LogLevel.INFO });
    this.metricsCollector = new MetricsCollector(this.logger);
    this.dockerMonitor = new DockerMonitor(this.logger);
    this.fsWatcher = new FileSystemWatcher(this.logger, this);
    this.analyzer = new SystemAnalyzer(this.logger);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing SystemAgent...');
    try {
      await this.dockerMonitor.checkDockerAvailability();
      await this.captureMetrics(); // capture initial metrics to warm up collectors
      this.logger.info('Initial system metrics captured');
      if (this.config.fileSystemMonitoring?.enabled) {
        await this.fsWatcher.setupFileSystemMonitoring(this.config);
      }
      if (this.config.performanceBaseline?.captureBaseline) {
        this.startBaselineCapture();
      }
      this.logger.info('SystemAgent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SystemAgent', { error });
      throw error;
    }
  }

  async execute(scenario: any): Promise<SystemHealthReport> {
    this.logger.info('Starting system monitoring for scenario', { scenario: scenario?.name });
    try {
      await this.startMonitoring();
      const duration = scenario?.timeout || 60000;
      await new Promise(resolve => setTimeout(resolve, duration));
      const report = await this.generateHealthReport();
      this.logger.info('System monitoring completed', {
        overall: report.overall, issues: report.issues.length, leaks: report.resourceLeaks.length,
      });
      return report;
    } catch (error) {
      this.logger.error('System monitoring execution failed', { error });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up SystemAgent...');
    try {
      await this.stopMonitoring();
      if (this.baselineCaptureInterval) {
        clearInterval(this.baselineCaptureInterval);
        this.baselineCaptureInterval = undefined;
      }
      this.fsWatcher.closeAll();
      if (this.config.cleanup?.killZombieProcesses) await this.killZombieProcesses();
      if (this.config.cleanup?.cleanTempFiles) await this.cleanTempFiles();
      this.logger.info('SystemAgent cleanup completed');
    } catch (error) {
      this.logger.error('SystemAgent cleanup failed', { error });
      throw error;
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) { this.logger.warn('Monitoring is already active'); return; }
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.captureMetrics();
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.maxHistorySize) {
          this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
        }
        this.emit('metrics', metrics);
        const issues = await this.analyzer.analyzeMetrics(metrics, this.config);
        if (issues.length > 0) this.emit('issues', issues);
      } catch (error) {
        this.logger.error('Error during monitoring cycle', { error });
      }
    }, this.config.monitoringInterval);
    this.logger.info('System monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;
    if (this.monitoringInterval) { clearInterval(this.monitoringInterval); this.monitoringInterval = undefined; }
    this.isMonitoring = false;
    this.logger.info('System monitoring stopped');
  }

  async captureMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date();
    try {
      const [cpuData, memData, diskData, networkData, processData, systemData] = await Promise.all([
        this.metricsCollector.getCPUMetrics(), this.metricsCollector.getMemoryMetrics(),
        this.metricsCollector.getDiskMetrics(), this.metricsCollector.getNetworkMetrics(),
        this.metricsCollector.getProcessMetrics(), this.metricsCollector.getSystemInfo(),
      ]);
      const dockerData = this.dockerMonitor.isAvailable ? await this.dockerMonitor.getDockerMetrics() : undefined;
      return { timestamp, cpu: cpuData, memory: memData, disk: diskData, network: networkData, processes: processData, ...(dockerData !== undefined ? { docker: dockerData } : {}), system: systemData };
    } catch (error) {
      this.logger.error('Failed to capture system metrics', { error });
      throw error;
    }
  }

  async generateHealthReport(): Promise<SystemHealthReport> {
    const currentMetrics = await this.captureMetrics();
    const issues = await this.analyzer.analyzeMetrics(currentMetrics, this.config);
    const resourceLeaks = await this.analyzer.detectResourceLeaks(this.metricsHistory);
    const performanceIssues = await this.analyzer.detectPerformanceIssues(this.metricsHistory, this.config);
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.some(i => i.severity === 'critical') || resourceLeaks.some(l => l.severity === 'high')) {
      overall = 'critical';
    } else if (issues.length > 0 || resourceLeaks.length > 0 || performanceIssues.length > 0) {
      overall = 'warning';
    }
    const recommendations = this.analyzer.generateRecommendations(issues, resourceLeaks, performanceIssues);
    return { timestamp: new Date(), overall, issues, metrics: currentMetrics, recommendations, resourceLeaks, performanceIssues };
  }

  async getSystemHealth(): Promise<'healthy' | 'warning' | 'critical'> {
    const metrics = await this.captureMetrics();
    const issues = await this.analyzer.analyzeMetrics(metrics, this.config);
    if (issues.some(i => i.severity === 'critical')) return 'critical';
    if (issues.length > 0) return 'warning';
    return 'healthy';
  }

  getMetricsHistory(): SystemMetrics[] { return [...this.metricsHistory]; }
  getFileSystemChanges(): FileSystemChange[] { return this.fsWatcher.getFileSystemChanges(); }
  getPerformanceBaseline(): PerformanceBaseline | undefined { return this.performanceBaseline; }

  // -- Private helpers --

  private startBaselineCapture(): void {
    const duration = this.config.performanceBaseline?.baselineDuration || 30000;
    const samples: SystemMetrics[] = [];
    this.logger.info(`Capturing performance baseline for ${duration}ms...`);
    this.baselineCaptureInterval = setInterval(async () => {
      try { samples.push(await this.captureMetrics()); } catch (e) { this.logger.error('Error capturing baseline sample', { error: e }); }
    }, 1000);
    setTimeout(() => {
      if (this.baselineCaptureInterval) {
        clearInterval(this.baselineCaptureInterval);
        this.baselineCaptureInterval = undefined;
      }
      if (samples.length === 0) return;
      const len = samples.length;
      this.performanceBaseline = {
        timestamp: new Date(), duration,
        metrics: {
          avgCPU: samples.reduce((s, m) => s + m.cpu.usage, 0) / len,
          avgMemory: samples.reduce((s, m) => s + m.memory.percentage, 0) / len,
          avgDiskIO: samples.reduce((s, m) => s + (m.disk.io?.reads || 0), 0) / len,
          avgNetworkIO: samples.reduce((s, m) => s + m.network.interfaces.reduce((n, i) => n + i.rx + i.tx, 0), 0) / len,
          processCount: samples.reduce((s, m) => s + m.processes.length, 0) / len,
        },
      };
      this.logger.info('Performance baseline captured', { baseline: this.performanceBaseline.metrics });
    }, duration);
  }

  private async killZombieProcesses(): Promise<void> {
    try {
      const currentMetrics = await this.captureMetrics();
      for (const zombie of currentMetrics.processes.filter(p => p.zombie)) {
        try { process.kill(zombie.pid, 'SIGKILL'); this.logger.info(`Killed zombie process: ${zombie.name} (PID: ${zombie.pid})`); }
        catch (e) { this.logger.warn(`Failed to kill zombie process ${zombie.pid}`, { error: e }); }
      }
      const { processNamePatterns } = this.config.cleanup || {};
      if (processNamePatterns) {
        for (const proc of currentMetrics.processes.filter(p => processNamePatterns.some(pat => p.name.match(pat)))) {
          try { process.kill(proc.pid, 'SIGTERM'); this.logger.info(`Terminated process: ${proc.name} (PID: ${proc.pid})`); }
          catch (e) { this.logger.warn(`Failed to terminate process ${proc.pid}`, { error: e }); }
        }
      }
    } catch (error) { this.logger.error('Failed to kill zombie processes', { error }); }
  }

  private async cleanTempFiles(): Promise<void> {
    try {
      const { tempDirPatterns } = this.config.cleanup || {};
      if (!tempDirPatterns) return;
      for (const pattern of tempDirPatterns) {
        try {
          for (const match of await glob(pattern)) {
            try {
              const stat = await fs.stat(match);
              if (stat.isDirectory()) { await fs.rmdir(match, { recursive: true }); this.logger.info(`Removed temporary directory: ${match}`); }
              else { await fs.unlink(match); this.logger.info(`Removed temporary file: ${match}`); }
            } catch (e) { this.logger.warn(`Failed to remove ${match}`, { error: e }); }
          }
        } catch (e) { this.logger.warn(`Failed to process pattern ${pattern}`, { error: e }); }
      }
    } catch (error) { this.logger.error('Failed to clean temporary files', { error }); }
  }
}

/** Factory function to create a SystemAgent */
export function createSystemAgent(config?: Partial<SystemAgentConfig>): SystemAgent {
  return new SystemAgent(config);
}
