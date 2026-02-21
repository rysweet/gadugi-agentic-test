/**
 * ElectronPerformanceMonitor - Performance sampling, metrics aggregation, and network state
 */

import { Page } from 'playwright';
import { ElectronUIAgentConfig, PerformanceSample } from './types';
import { TestLogger } from '../../utils/logger';
import { PerformanceMetrics, NetworkState } from '../../models/AppState';

/**
 * Collects periodic performance samples from the Electron renderer process
 * and provides aggregated metrics and network state.
 */
export class ElectronPerformanceMonitor {
  private config: ElectronUIAgentConfig;
  private logger: TestLogger;

  public samples: PerformanceSample[] = [];
  private interval: NodeJS.Timeout | null = null;

  constructor(config: ElectronUIAgentConfig, logger: TestLogger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Start periodic performance sampling against the given page
   */
  start(page: Page): void {
    if (!this.config.performanceConfig?.enabled) return;

    const sampleInterval = this.config.performanceConfig.sampleInterval || 1000;

    this.interval = setInterval(async () => {
      try {
        const sample = await this.collectSample(page);
        this.samples.push(sample);

        // Cap stored samples to prevent unbounded memory growth
        if (this.samples.length > 1000) {
          this.samples.splice(0, 100);
        }
      } catch (error: any) {
        this.logger.debug('Failed to collect performance sample', { error: error?.message });
      }
    }, sampleInterval);
  }

  /**
   * Stop the performance sampling interval
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Return the most recent performance metrics, or undefined if no samples collected
   */
  getLatestMetrics(): PerformanceMetrics | undefined {
    if (this.samples.length === 0) return undefined;

    const latest = this.samples[this.samples.length - 1];

    return {
      cpuUsage: latest.cpuUsage || 0,
      memoryUsage: latest.memoryUsage || 0,
      availableMemory: 0,
      responseTime: latest.responseTime,
      frameRate: latest.frameRate
    };
  }

  /**
   * Return a simplified network state (can be extended with real detection)
   */
  getNetworkState(): NetworkState {
    return {
      isOnline: true,
      connectionType: 'ethernet',
      activeConnections: []
    };
  }

  // --- Private ---

  private async collectSample(page: Page): Promise<PerformanceSample> {
    const timestamp = new Date();
    const sample: PerformanceSample = { timestamp };

    try {
      const metrics = await page.evaluate(() => {
        const timing = performance.timing;
        const memory = (performance as any).memory;

        return {
          responseTime: timing.loadEventEnd - timing.navigationStart,
          memoryUsage: memory ? memory.usedJSHeapSize : undefined
        };
      });

      Object.assign(sample, metrics);

    } catch (error: any) {
      this.logger.debug('Failed to collect browser metrics', { error: error?.message });
    }

    return sample;
  }
}
