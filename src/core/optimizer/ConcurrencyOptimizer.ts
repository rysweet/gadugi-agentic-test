/**
 * ConcurrencyOptimizer
 *
 * Manages the terminal connection pool: acquisition, release, waiting queues,
 * and idle/age-based cleanup.
 */

import { EventEmitter } from 'events';
import { ProcessLifecycleManager } from '../ProcessLifecycleManager';
import { PtyTerminal, PtyTerminalConfig } from '../PtyTerminal';
import { ResourcePoolConfig, PooledResource, ResourceMetrics } from './types';

interface TerminalConnection {
  agent: PtyTerminal;
  config: PtyTerminalConfig;
}

type WaitingRequest = {
  resolve: (agent: PtyTerminal) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
};

export class ConcurrencyOptimizer extends EventEmitter {
  private config: Required<ResourcePoolConfig>;
  private terminalPool = new Map<string, PooledResource<TerminalConnection>>();
  private pendingAcquisitions = new Map<string, WaitingRequest[]>();
  private resourceIdCounter = 0;
  private totalCreated = 0;
  private totalDestroyed = 0;
  private acquisitionTimes: number[] = [];
  private processManager: ProcessLifecycleManager;

  constructor(config: Required<ResourcePoolConfig>, processManager: ProcessLifecycleManager) {
    super();
    this.config = config;
    this.processManager = processManager;
  }

  /**
   * Acquire a terminal connection from the pool
   */
  async acquireTerminal(config: PtyTerminalConfig, isDestroying: boolean): Promise<PtyTerminal> {
    if (isDestroying) {
      throw new Error('ResourceOptimizer is being destroyed');
    }

    const configKey = this.getConfigKey(config);
    const startTime = Date.now();

    const available = this.findAvailableTerminal(configKey);
    if (available) {
      available.isInUse = true;
      available.lastUsed = new Date();
      available.useCount++;
      this.trackAcquisitionTime(Date.now() - startTime);
      return available.resource.agent;
    }

    if (this.terminalPool.size < this.config.maxSize) {
      const agent = await this.createTerminal(config);
      this.trackAcquisitionTime(Date.now() - startTime);
      return agent;
    }

    return this.waitForTerminal(configKey);
  }

  /**
   * Release a terminal back to the pool
   */
  async releaseTerminal(agent: PtyTerminal): Promise<void> {
    const resource = this.findResourceByAgentInternal(agent);
    if (!resource) return;

    resource.isInUse = false;
    resource.lastUsed = new Date();

    try {
      agent.clearOutput();
    } catch {
      await this.destroyTerminalResource(resource.id);
      return;
    }

    this.notifyWaitingAcquisitions();
  }

  /**
   * Cleanup idle and aged resources
   */
  async cleanupIdleResources(): Promise<number> {
    const now = new Date();
    const toDestroy: string[] = [];

    for (const [id, resource] of this.terminalPool) {
      if (resource.isInUse) continue;
      const idleTime = now.getTime() - resource.lastUsed.getTime();
      const age = now.getTime() - resource.createdAt.getTime();
      if (idleTime >= this.config.idleTimeout || age >= this.config.maxAge) {
        toDestroy.push(id);
      }
    }

    for (const id of toDestroy) {
      await this.destroyTerminalResource(id);
    }

    return toDestroy.length;
  }

  /**
   * Destroy all terminals and reject pending acquisitions
   */
  async destroyAll(): Promise<void> {
    for (const [, requests] of this.pendingAcquisitions) {
      for (const { reject, timeout } of requests) {
        clearTimeout(timeout);
        reject(new Error('ResourceOptimizer is being destroyed'));
      }
    }
    this.pendingAcquisitions.clear();

    const ids = Array.from(this.terminalPool.keys());
    await Promise.all(ids.map(id => this.destroyTerminalResource(id)));
  }

  /**
   * Get pool metrics
   */
  getMetrics(): ResourceMetrics['pool'] {
    const active = Array.from(this.terminalPool.values()).filter(r => r.isInUse).length;
    return {
      totalResources: this.terminalPool.size,
      activeResources: active,
      idleResources: this.terminalPool.size - active,
      totalCreated: this.totalCreated,
      totalDestroyed: this.totalDestroyed,
      acquisitionTime: this.calculateAcquisitionStats()
    };
  }

  /**
   * Expose findResourceByAgent for tests that reach into internals.
   * Returns unknown to avoid leaking the private TerminalConnection type.
   */
  findResourceByAgent(agent: PtyTerminal): unknown {
    return this.findResourceByAgentInternal(agent);
  }

  private findResourceByAgentInternal(agent: PtyTerminal): PooledResource<TerminalConnection> | null {
    for (const resource of this.terminalPool.values()) {
      if (resource.resource.agent === agent) return resource;
    }
    return null;
  }

  private async createTerminal(config: PtyTerminalConfig): Promise<PtyTerminal> {
    const terminalId = this.generateId('terminal');
    const agent = new PtyTerminal(config, this.processManager);

    const pooled: PooledResource<TerminalConnection> = {
      id: terminalId,
      resource: { agent, config },
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 1,
      isInUse: true
    };

    this.terminalPool.set(terminalId, pooled);
    this.totalCreated++;

    try {
      await agent.start();
      this.emit('resourceCreated', 'terminal', terminalId);
      return agent;
    } catch (error) {
      this.terminalPool.delete(terminalId);
      this.totalCreated--;
      throw error;
    }
  }

  private async waitForTerminal(configKey: string): Promise<PtyTerminal> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeFromWaitingQueue(configKey, resolve);
        reject(new Error(`Terminal acquisition timeout after ${this.config.acquisitionTimeout}ms`));
      }, this.config.acquisitionTimeout);

      if (!this.pendingAcquisitions.has(configKey)) {
        this.pendingAcquisitions.set(configKey, []);
      }

      this.pendingAcquisitions.get(configKey)!.push({ resolve, reject, timeout });
    });
  }

  private findAvailableTerminal(configKey: string): PooledResource<TerminalConnection> | null {
    for (const resource of this.terminalPool.values()) {
      if (!resource.isInUse && this.getConfigKey(resource.resource.config) === configKey) {
        return resource;
      }
    }
    return null;
  }

  private async destroyTerminalResource(resourceId: string): Promise<void> {
    const resource = this.terminalPool.get(resourceId);
    if (!resource) return;

    this.terminalPool.delete(resourceId);

    try {
      await resource.resource.agent.destroy();
    } catch {
      // Ignore cleanup errors
    }

    this.totalDestroyed++;
    this.emit('resourceDestroyed', 'terminal', resourceId);
  }

  private notifyWaitingAcquisitions(): void {
    for (const [configKey, requests] of this.pendingAcquisitions) {
      if (requests.length === 0) continue;
      const available = this.findAvailableTerminal(configKey);
      if (available) {
        const { resolve, timeout } = requests.shift()!;
        clearTimeout(timeout);
        available.isInUse = true;
        available.lastUsed = new Date();
        available.useCount++;
        resolve(available.resource.agent);
      }
    }
  }

  private removeFromWaitingQueue(configKey: string, resolve: (agent: PtyTerminal) => void): void {
    const requests = this.pendingAcquisitions.get(configKey);
    if (!requests) return;
    const index = requests.findIndex(req => req.resolve === resolve);
    if (index !== -1) requests.splice(index, 1);
  }

  private getConfigKey(config: PtyTerminalConfig): string {
    return JSON.stringify({ shell: config.shell, cwd: config.cwd, env: config.env });
  }

  private generateId(prefix: string): string {
    return `${prefix}_${++this.resourceIdCounter}_${Date.now()}`;
  }

  private trackAcquisitionTime(time: number): void {
    this.acquisitionTimes.push(time);
    if (this.acquisitionTimes.length > 100) this.acquisitionTimes.shift();
  }

  private calculateAcquisitionStats(): { avg: number; p95: number; p99: number } {
    if (this.acquisitionTimes.length === 0) return { avg: 0, p95: 0, p99: 0 };
    const sorted = [...this.acquisitionTimes].sort((a, b) => a - b);
    const avg = sorted.reduce((sum, t) => sum + t, 0) / sorted.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    return { avg: Math.round(avg), p95, p99 };
  }
}
