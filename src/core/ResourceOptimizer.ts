import { EventEmitter } from 'events';
import * as zlib from 'zlib';
import { ProcessLifecycleManager } from './ProcessLifecycleManager';
import { PtyTerminal, PtyTerminalConfig } from './PtyTerminal';
import { MemoryOptimizer } from './optimizer/MemoryOptimizer';
import { CpuOptimizer } from './optimizer/CpuOptimizer';
import { ConcurrencyOptimizer } from './optimizer/ConcurrencyOptimizer';

// Re-export all types for backward compatibility
export type {
  ResourcePoolConfig,
  MemoryConfig,
  BufferConfig,
  ResourceOptimizerConfig,
  ResourceMetrics,
  ResourceOptimizerEvents
} from './optimizer/types';

/**
 * ResourceOptimizer
 *
 * Thin facade over MemoryOptimizer, CpuOptimizer (buffer management),
 * and ConcurrencyOptimizer (terminal pool). Preserves the original public API.
 */
export class ResourceOptimizer extends EventEmitter {
  private memoryOpt: MemoryOptimizer;
  private cpuOpt: CpuOptimizer;
  private concurrencyOpt: ConcurrencyOptimizer;
  private isDestroying = false;

  /**
   * Used by tests that inspect internal pool state via (optimizer as any).findResourceByAgent(...)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findResourceByAgent(agent: PtyTerminal): any {
    return this.concurrencyOpt.findResourceByAgent(agent);
  }

  /**
   * Used by tests that call (optimizer as any).rotateBuffers(true)
   */
  rotateBuffers(force: boolean) {
    this.cpuOpt.rotateBuffers(force);
  }

  constructor(
    config: import('./optimizer/types').ResourceOptimizerConfig = {},
    processManager?: ProcessLifecycleManager
  ) {
    super();

    const pm = processManager || new ProcessLifecycleManager();

    const poolConfig = {
      maxSize: 10,
      minSize: 2,
      idleTimeout: 300000,
      maxAge: 1800000,
      acquisitionTimeout: 30000,
      ...config.pool
    };

    const memConfig = {
      maxHeapUsed: 512 * 1024 * 1024,
      maxRSS: 1024 * 1024 * 1024,
      gcThreshold: 70,
      monitorInterval: 10000,
      ...config.memory
    };

    const bufConfig = {
      maxBufferSize: 1024 * 1024,
      maxTotalBuffers: 50,
      compressionThreshold: 64 * 1024,
      rotationInterval: 60000,
      ...config.buffer
    };

    const enableMetrics = config.enableMetrics ?? true;
    const enableGC = config.enableGarbageCollection ?? true;

    this.memoryOpt = new MemoryOptimizer(memConfig, enableGC);
    this.cpuOpt = new CpuOptimizer(bufConfig);
    this.concurrencyOpt = new ConcurrencyOptimizer(poolConfig, pm);

    // Forward events from sub-modules
    this.memoryOpt.on('memoryWarning', (u) => this.emit('memoryWarning', u));
    this.memoryOpt.on('memoryAlert', (u) => this.emit('memoryAlert', u));
    this.memoryOpt.on('gcTriggered', (r) => this.emit('gcTriggered', r));
    this.memoryOpt.on('error', (e) => this.emit('error', e));
    this.cpuOpt.on('bufferRotated', (n) => this.emit('bufferRotated', n));
    this.concurrencyOpt.on('resourceCreated', (t, id) => this.emit('resourceCreated', t, id));
    this.concurrencyOpt.on('resourceDestroyed', (t, id) => this.emit('resourceDestroyed', t, id));

    // Wire memory pressure callbacks - matching original behavior exactly:
    // heapUsed > maxHeapUsed  → cleanup idle resources + rotate buffers
    // rss > maxRSS            → aggressive cleanup
    this.memoryOpt.onHeapExceeded = () => {
      this.cleanupIdleResources();
      this.cpuOpt.rotateBuffers(true);
    };
    this.memoryOpt.onRssExceeded = () => {
      this.aggressiveCleanup();
    };

    // Emit metricsUpdated on any change when metrics are enabled
    if (enableMetrics) {
      const emitMetrics = () => this.emit('metricsUpdated', this.getMetrics());
      this.concurrencyOpt.on('resourceCreated', emitMetrics);
      this.concurrencyOpt.on('resourceDestroyed', emitMetrics);
      this.cpuOpt.on('bufferRotated', emitMetrics);
    }

    this.memoryOpt.start();
    this.cpuOpt.start();
  }

  // ---- Terminal pool ----

  public async acquireTerminal(config: PtyTerminalConfig = {}): Promise<PtyTerminal> {
    const agent = await this.concurrencyOpt.acquireTerminal(config, this.isDestroying);
    this.emit('metricsUpdated', this.getMetrics());
    return agent;
  }

  public async releaseTerminal(agent: PtyTerminal): Promise<void> {
    await this.concurrencyOpt.releaseTerminal(agent);
    this.emit('metricsUpdated', this.getMetrics());
  }

  public async cleanupIdleResources(): Promise<number> {
    return this.concurrencyOpt.cleanupIdleResources();
  }

  // ---- Buffer pool ----

  public createBuffer(data: string | Buffer, compress: boolean = false): string {
    const id = this.cpuOpt.createBuffer(data, compress);
    this.emit('metricsUpdated', this.getMetrics());
    return id;
  }

  public getBuffer(bufferId: string): Buffer | null {
    return this.cpuOpt.getBuffer(bufferId);
  }

  public destroyBuffer(bufferId: string): boolean {
    const ok = this.cpuOpt.destroyBuffer(bufferId);
    if (ok) this.emit('metricsUpdated', this.getMetrics());
    return ok;
  }

  // ---- Metrics & GC ----

  public getMetrics(): import('./optimizer/types').ResourceMetrics {
    return {
      pool: this.concurrencyOpt.getMetrics(),
      memory: this.memoryOpt.getMetrics(),
      buffers: this.cpuOpt.getMetrics()
    };
  }

  public async triggerGarbageCollection(reason: string = 'manual'): Promise<void> {
    await this.memoryOpt.triggerGarbageCollection(reason);
  }

  // ---- Lifecycle ----

  private async aggressiveCleanup(): Promise<void> {
    await this.cleanupIdleResources();
    this.cpuOpt.aggressiveClear();
    await this.triggerGarbageCollection('memory_pressure');
  }

  public async destroy(): Promise<void> {
    if (this.isDestroying) return;
    this.isDestroying = true;

    // Remove all forwarding listeners before stopping sub-optimizers to
    // prevent dangling references and MaxListenersExceededWarning on reuse.
    this.memoryOpt.removeAllListeners();
    this.cpuOpt.removeAllListeners();
    this.concurrencyOpt.removeAllListeners();

    this.memoryOpt.stop();
    this.cpuOpt.stop();

    await this.concurrencyOpt.destroyAll();
    this.cpuOpt.destroyAll();

    await this.triggerGarbageCollection('shutdown');
    this.emit('metricsUpdated', this.getMetrics());
    this.emit('destroyed');
  }
}

/**
 * Singleton instance for global resource management.
 * Lazily initialised via a Proxy so that importing this module does not
 * immediately start background monitoring timers.
 */
let _globalResourceOptimizer: ResourceOptimizer | null = null;

export function getResourceOptimizer(): ResourceOptimizer {
  if (!_globalResourceOptimizer) {
    _globalResourceOptimizer = new ResourceOptimizer();
  }
  return _globalResourceOptimizer;
}

export const resourceOptimizer: ResourceOptimizer = new Proxy(
  {} as ResourceOptimizer,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getResourceOptimizer(), prop, receiver);
    },
    set(_target, prop, value, receiver) {
      return Reflect.set(getResourceOptimizer(), prop, value, receiver);
    }
  }
);
