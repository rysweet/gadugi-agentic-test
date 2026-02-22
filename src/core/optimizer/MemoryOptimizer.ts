/**
 * MemoryOptimizer
 *
 * Memory monitoring, alerting, and garbage collection management.
 */

import { EventEmitter } from 'events';
import { MemoryConfig, ResourceMetrics } from './types';

export class MemoryOptimizer extends EventEmitter {
  private config: Required<MemoryConfig>;
  private monitorInterval?: NodeJS.Timeout;
  private gcCallCount = 0;
  private lastGcTime?: Date;
  private enableGarbageCollection: boolean;

  /**
   * Callback invoked when heap exceeds the hard maxHeapUsed limit.
   * In original code this triggers idle cleanup + buffer rotation.
   */
  onHeapExceeded?: () => void;
  /**
   * Callback invoked when RSS exceeds the hard maxRSS limit.
   * In original code this triggers aggressive cleanup.
   */
  onRssExceeded?: () => void;

  constructor(config: Required<MemoryConfig>, enableGarbageCollection: boolean) {
    super();
    this.config = config;
    this.enableGarbageCollection = enableGarbageCollection;
  }

  /**
   * Start periodic memory monitoring
   */
  start(): void {
    if (!this.config.monitorInterval) return;

    this.monitorInterval = setInterval(() => {
      const usage = process.memoryUsage();

      if (usage.heapUsed > this.config.maxHeapUsed * (this.config.gcThreshold / 100)) {
        this.emit('memoryWarning', usage);
        this.triggerGarbageCollection('high_memory');
      }

      if (usage.heapUsed > this.config.maxHeapUsed) {
        this.emit('memoryAlert', usage);
        this.onHeapExceeded?.();
      }

      if (usage.rss > this.config.maxRSS) {
        this.emit('memoryAlert', usage);
        this.onRssExceeded?.();
      }
    }, this.config.monitorInterval).unref();
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
  }

  /**
   * Force garbage collection if enabled
   */
  async triggerGarbageCollection(reason: string = 'manual'): Promise<void> {
    if (!this.enableGarbageCollection || !global.gc) return;

    try {
      global.gc();
      this.gcCallCount++;
      this.lastGcTime = new Date();
      this.emit('gcTriggered', reason);
    } catch (error) {
      this.emit('error', new Error(`Garbage collection failed: ${error}`));
    }
  }

  /**
   * Get current memory metrics
   */
  getMetrics(usage?: NodeJS.MemoryUsage): ResourceMetrics['memory'] {
    const memoryUsage = usage || process.memoryUsage();
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      gcRuns: this.gcCallCount,
      lastGcTime: this.lastGcTime
    };
  }
}
