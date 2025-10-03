import { EventEmitter } from 'events';
import { ProcessLifecycleManager } from './ProcessLifecycleManager';
import { TUIAgent, TUIAgentConfig } from './TUIAgent';

/**
 * Resource pool configuration
 */
export interface ResourcePoolConfig {
  maxSize: number;
  minSize: number;
  idleTimeout: number; // milliseconds
  maxAge: number; // milliseconds
  acquisitionTimeout: number; // milliseconds
}

/**
 * Memory monitoring configuration
 */
export interface MemoryConfig {
  maxHeapUsed: number; // bytes
  maxRSS: number; // bytes
  gcThreshold: number; // percentage of maxHeapUsed
  monitorInterval: number; // milliseconds
}

/**
 * Buffer management configuration
 */
export interface BufferConfig {
  maxBufferSize: number; // bytes per buffer
  maxTotalBuffers: number; // total number of buffers
  compressionThreshold: number; // bytes - compress buffers larger than this
  rotationInterval: number; // milliseconds
}

/**
 * Resource optimizer configuration
 */
export interface ResourceOptimizerConfig {
  pool?: Partial<ResourcePoolConfig>;
  memory?: Partial<MemoryConfig>;
  buffer?: Partial<BufferConfig>;
  enableMetrics?: boolean;
  enableGarbageCollection?: boolean;
}

/**
 * Pooled resource wrapper
 */
interface PooledResource<T> {
  id: string;
  resource: T;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
  isInUse: boolean;
}

/**
 * Terminal connection pool entry
 */
interface TerminalConnection {
  agent: TUIAgent;
  config: TUIAgentConfig;
}

/**
 * Buffer entry with metadata
 */
interface BufferEntry {
  id: string;
  data: Buffer;
  compressed: boolean;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

/**
 * Resource metrics
 */
export interface ResourceMetrics {
  pool: {
    totalResources: number;
    activeResources: number;
    idleResources: number;
    totalCreated: number;
    totalDestroyed: number;
    acquisitionTime: { avg: number; p95: number; p99: number };
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    gcRuns: number;
    lastGcTime?: Date;
  };
  buffers: {
    totalBuffers: number;
    totalSize: number;
    compressedBuffers: number;
    compressionRatio: number;
  };
}

/**
 * ResourceOptimizer Events
 */
export interface ResourceOptimizerEvents {
  memoryWarning: (usage: NodeJS.MemoryUsage) => void;
  memoryAlert: (usage: NodeJS.MemoryUsage) => void;
  resourceCreated: (type: string, id: string) => void;
  resourceDestroyed: (type: string, id: string) => void;
  bufferRotated: (removedCount: number) => void;
  gcTriggered: (reason: string) => void;
  metricsUpdated: (metrics: ResourceMetrics) => void;
}

/**
 * ResourceOptimizer
 *
 * Comprehensive resource management system that addresses memory issues
 * by implementing connection pooling, buffer management, and memory monitoring.
 */
export class ResourceOptimizer extends EventEmitter {
  private config: {
    pool: Required<ResourcePoolConfig>;
    memory: Required<MemoryConfig>;
    buffer: Required<BufferConfig>;
    enableMetrics: boolean;
    enableGarbageCollection: boolean;
  };
  private terminalPool = new Map<string, PooledResource<TerminalConnection>>();
  private bufferPool = new Map<string, BufferEntry>();
  private processManager: ProcessLifecycleManager;

  // Resource management
  private pendingAcquisitions = new Map<string, Array<{ resolve: Function; reject: Function; timeout: NodeJS.Timeout }>>();
  private resourceIdCounter = 0;
  private isDestroying = false;

  // Memory monitoring
  private memoryMonitorInterval?: NodeJS.Timeout;
  private lastMemoryUsage?: NodeJS.MemoryUsage;
  private gcCallCount = 0;

  // Buffer management
  private bufferRotationInterval?: NodeJS.Timeout;
  private totalBufferSize = 0;

  // Metrics tracking
  private metrics: ResourceMetrics = {
    pool: {
      totalResources: 0,
      activeResources: 0,
      idleResources: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      acquisitionTime: { avg: 0, p95: 0, p99: 0 }
    },
    memory: {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0,
      gcRuns: 0
    },
    buffers: {
      totalBuffers: 0,
      totalSize: 0,
      compressedBuffers: 0,
      compressionRatio: 1.0
    }
  };

  private acquisitionTimes: number[] = [];

  constructor(
    config: ResourceOptimizerConfig = {},
    processManager?: ProcessLifecycleManager
  ) {
    super();

    this.processManager = processManager || new ProcessLifecycleManager();

    // Set default configuration with memory-conscious values
    const defaultPoolConfig: Required<ResourcePoolConfig> = {
      maxSize: 10, // Limit concurrent terminals
      minSize: 2,  // Keep minimal pool
      idleTimeout: 300000, // 5 minutes
      maxAge: 1800000, // 30 minutes
      acquisitionTimeout: 30000 // 30 seconds
    };

    const defaultMemoryConfig: Required<MemoryConfig> = {
      maxHeapUsed: 512 * 1024 * 1024, // 512MB
      maxRSS: 1024 * 1024 * 1024, // 1GB
      gcThreshold: 70, // 70% of max heap
      monitorInterval: 10000 // 10 seconds
    };

    const defaultBufferConfig: Required<BufferConfig> = {
      maxBufferSize: 1024 * 1024, // 1MB per buffer
      maxTotalBuffers: 50, // Limit total buffers
      compressionThreshold: 64 * 1024, // 64KB
      rotationInterval: 60000 // 1 minute
    };

    this.config = {
      pool: { ...defaultPoolConfig, ...config.pool },
      memory: { ...defaultMemoryConfig, ...config.memory },
      buffer: { ...defaultBufferConfig, ...config.buffer },
      enableMetrics: config.enableMetrics ?? true,
      enableGarbageCollection: config.enableGarbageCollection ?? true
    };

    this.startMemoryMonitoring();
    this.startBufferRotation();
  }

  /**
   * Acquire a terminal connection from the pool
   */
  public async acquireTerminal(config: TUIAgentConfig = {}): Promise<TUIAgent> {
    if (this.isDestroying) {
      throw new Error('ResourceOptimizer is being destroyed');
    }

    const configKey = this.getConfigKey(config);
    const startTime = Date.now();

    try {
      // Check for available idle terminal
      const availableTerminal = this.findAvailableTerminal(configKey);
      if (availableTerminal) {
        availableTerminal.isInUse = true;
        availableTerminal.lastUsed = new Date();
        availableTerminal.useCount++;

        this.updateMetrics();
        this.trackAcquisitionTime(Date.now() - startTime);

        return availableTerminal.resource.agent;
      }

      // Create new terminal if pool not at capacity
      if (this.getPoolSize() < this.config.pool.maxSize) {
        return await this.createTerminal(config);
      }

      // Wait for available terminal
      return await this.waitForTerminal(configKey, startTime);

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Release a terminal back to the pool
   */
  public async releaseTerminal(agent: TUIAgent): Promise<void> {
    const resource = this.findResourceByAgent(agent);
    if (!resource) {
      return; // Already released or not from pool
    }

    resource.isInUse = false;
    resource.lastUsed = new Date();

    // Clean up agent state for reuse
    try {
      agent.clearOutput();
      // Don't destroy - keep for reuse
    } catch (error) {
      // If cleanup fails, remove from pool
      await this.destroyTerminalResource(resource.id);
      return;
    }

    this.updateMetrics();
    this.notifyWaitingAcquisitions();
  }

  /**
   * Create a managed buffer with automatic cleanup
   */
  public createBuffer(data: string | Buffer, compress: boolean = false): string {
    if (this.bufferPool.size >= this.config.buffer.maxTotalBuffers) {
      this.rotateBuffers(true); // Force rotation
    }

    const bufferId = this.generateId('buffer');
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

    // Compress if enabled and above threshold
    const shouldCompress = compress || buffer.length >= this.config.buffer.compressionThreshold;
    const finalBuffer = shouldCompress ? this.compressBuffer(buffer) : buffer;

    const bufferEntry: BufferEntry = {
      id: bufferId,
      data: finalBuffer,
      compressed: shouldCompress,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0
    };

    this.bufferPool.set(bufferId, bufferEntry);
    this.totalBufferSize += finalBuffer.length;

    this.updateMetrics();

    return bufferId;
  }

  /**
   * Get buffer data by ID
   */
  public getBuffer(bufferId: string): Buffer | null {
    const bufferEntry = this.bufferPool.get(bufferId);
    if (!bufferEntry) {
      return null;
    }

    bufferEntry.lastAccessed = new Date();
    bufferEntry.accessCount++;

    return bufferEntry.compressed
      ? this.decompressBuffer(bufferEntry.data)
      : bufferEntry.data;
  }

  /**
   * Remove buffer from pool
   */
  public destroyBuffer(bufferId: string): boolean {
    const bufferEntry = this.bufferPool.get(bufferId);
    if (!bufferEntry) {
      return false;
    }

    this.totalBufferSize -= bufferEntry.data.length;
    this.bufferPool.delete(bufferId);

    this.updateMetrics();

    return true;
  }

  /**
   * Get current resource metrics
   */
  public getMetrics(): ResourceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Force garbage collection if enabled
   */
  public async triggerGarbageCollection(reason: string = 'manual'): Promise<void> {
    if (!this.config.enableGarbageCollection || !global.gc) {
      return;
    }

    try {
      global.gc();
      this.gcCallCount++;
      this.metrics.memory.gcRuns = this.gcCallCount;
      this.metrics.memory.lastGcTime = new Date();

      this.emit('gcTriggered', reason);
    } catch (error) {
      this.emit('error', new Error(`Garbage collection failed: ${error}`));
    }
  }

  /**
   * Cleanup idle resources
   */
  public async cleanupIdleResources(): Promise<number> {
    const now = new Date();
    const idleTimeout = this.config.pool.idleTimeout;
    const maxAge = this.config.pool.maxAge;

    let cleanedCount = 0;
    const toDestroy: string[] = [];

    // Find idle or old terminals
    for (const [id, resource] of this.terminalPool) {
      if (resource.isInUse) continue;

      const idleTime = now.getTime() - resource.lastUsed.getTime();
      const age = now.getTime() - resource.createdAt.getTime();

      if (idleTime >= idleTimeout || age >= maxAge) {
        toDestroy.push(id);
      }
    }

    // Destroy idle resources
    for (const id of toDestroy) {
      await this.destroyTerminalResource(id);
      cleanedCount++;
    }

    return cleanedCount;
  }

  /**
   * Full system cleanup and destruction
   */
  public async destroy(): Promise<void> {
    if (this.isDestroying) {
      return;
    }

    this.isDestroying = true;

    // Stop monitoring
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }

    if (this.bufferRotationInterval) {
      clearInterval(this.bufferRotationInterval);
    }

    // Reject pending acquisitions
    for (const [configKey, requests] of this.pendingAcquisitions) {
      requests.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error('ResourceOptimizer is being destroyed'));
      });
    }
    this.pendingAcquisitions.clear();

    // Destroy all terminal resources
    const terminalIds = Array.from(this.terminalPool.keys());
    await Promise.all(terminalIds.map(id => this.destroyTerminalResource(id)));

    // Clear all buffers
    this.bufferPool.clear();
    this.totalBufferSize = 0;

    // Final garbage collection
    await this.triggerGarbageCollection('shutdown');

    this.updateMetrics();
    this.emit('destroyed');
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (!this.config.memory.monitorInterval) {
      return;
    }

    this.memoryMonitorInterval = setInterval(() => {
      const usage = process.memoryUsage();

      // Check for memory warnings
      if (usage.heapUsed > this.config.memory.maxHeapUsed * (this.config.memory.gcThreshold / 100)) {
        this.emit('memoryWarning', usage);
        this.triggerGarbageCollection('high_memory');
      }

      if (usage.heapUsed > this.config.memory.maxHeapUsed) {
        this.emit('memoryAlert', usage);
        this.cleanupIdleResources();
        this.rotateBuffers(true);
      }

      if (usage.rss > this.config.memory.maxRSS) {
        this.emit('memoryAlert', usage);
        this.aggressiveCleanup();
      }

      this.lastMemoryUsage = usage;
      this.updateMemoryMetrics(usage);

    }, this.config.memory.monitorInterval);
  }

  /**
   * Start buffer rotation
   */
  private startBufferRotation(): void {
    if (!this.config.buffer.rotationInterval) {
      return;
    }

    this.bufferRotationInterval = setInterval(() => {
      this.rotateBuffers(false);
    }, this.config.buffer.rotationInterval);
  }

  /**
   * Rotate old buffers
   */
  private rotateBuffers(force: boolean): void {
    const now = new Date();
    const oldBuffers: string[] = [];

    for (const [id, buffer] of this.bufferPool) {
      const age = now.getTime() - buffer.lastAccessed.getTime();

      if (force || age > this.config.buffer.rotationInterval) {
        oldBuffers.push(id);
      }
    }

    // Remove oldest buffers first
    oldBuffers
      .sort((a, b) => {
        const bufferA = this.bufferPool.get(a)!;
        const bufferB = this.bufferPool.get(b)!;
        return bufferA.lastAccessed.getTime() - bufferB.lastAccessed.getTime();
      })
      .slice(0, Math.max(1, oldBuffers.length / 2)) // Remove at most half
      .forEach(id => this.destroyBuffer(id));

    if (oldBuffers.length > 0) {
      this.emit('bufferRotated', oldBuffers.length);
    }
  }

  /**
   * Aggressive cleanup during memory pressure
   */
  private async aggressiveCleanup(): Promise<void> {
    // Force cleanup all idle resources
    await this.cleanupIdleResources();

    // Rotate all but most recent buffers
    const bufferIds = Array.from(this.bufferPool.keys());
    bufferIds
      .sort((a, b) => {
        const bufferA = this.bufferPool.get(a)!;
        const bufferB = this.bufferPool.get(b)!;
        return bufferB.lastAccessed.getTime() - bufferA.lastAccessed.getTime();
      })
      .slice(5) // Keep only 5 most recent
      .forEach(id => this.destroyBuffer(id));

    // Force garbage collection
    await this.triggerGarbageCollection('memory_pressure');
  }

  /**
   * Create a new terminal connection
   */
  private async createTerminal(config: TUIAgentConfig): Promise<TUIAgent> {
    const terminalId = this.generateId('terminal');
    const agent = new TUIAgent(config, this.processManager);

    const pooledResource: PooledResource<TerminalConnection> = {
      id: terminalId,
      resource: { agent, config },
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 1,
      isInUse: true
    };

    this.terminalPool.set(terminalId, pooledResource);
    this.metrics.pool.totalCreated++;

    try {
      await agent.start();
      this.emit('resourceCreated', 'terminal', terminalId);
      this.updateMetrics();
      return agent;
    } catch (error) {
      // Remove from pool if start fails
      this.terminalPool.delete(terminalId);
      throw error;
    }
  }

  /**
   * Wait for available terminal
   */
  private async waitForTerminal(configKey: string, startTime: number): Promise<TUIAgent> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeFromWaitingQueue(configKey, resolve);
        reject(new Error(`Terminal acquisition timeout after ${this.config.pool.acquisitionTimeout}ms`));
      }, this.config.pool.acquisitionTimeout);

      if (!this.pendingAcquisitions.has(configKey)) {
        this.pendingAcquisitions.set(configKey, []);
      }

      this.pendingAcquisitions.get(configKey)!.push({ resolve, reject, timeout });
    });
  }

  /**
   * Find available terminal for config
   */
  private findAvailableTerminal(configKey: string): PooledResource<TerminalConnection> | null {
    for (const resource of this.terminalPool.values()) {
      if (!resource.isInUse && this.getConfigKey(resource.resource.config) === configKey) {
        return resource;
      }
    }
    return null;
  }

  /**
   * Find resource by agent instance
   */
  private findResourceByAgent(agent: TUIAgent): PooledResource<TerminalConnection> | null {
    for (const resource of this.terminalPool.values()) {
      if (resource.resource.agent === agent) {
        return resource;
      }
    }
    return null;
  }

  /**
   * Destroy terminal resource
   */
  private async destroyTerminalResource(resourceId: string): Promise<void> {
    const resource = this.terminalPool.get(resourceId);
    if (!resource) {
      return;
    }

    this.terminalPool.delete(resourceId);

    try {
      await resource.resource.agent.destroy();
    } catch (error) {
      // Ignore cleanup errors
    }

    this.metrics.pool.totalDestroyed++;
    this.emit('resourceDestroyed', 'terminal', resourceId);
    this.updateMetrics();
  }

  /**
   * Notify waiting acquisitions
   */
  private notifyWaitingAcquisitions(): void {
    for (const [configKey, requests] of this.pendingAcquisitions) {
      if (requests.length === 0) continue;

      const availableTerminal = this.findAvailableTerminal(configKey);
      if (availableTerminal) {
        const { resolve, timeout } = requests.shift()!;
        clearTimeout(timeout);

        availableTerminal.isInUse = true;
        availableTerminal.lastUsed = new Date();
        availableTerminal.useCount++;

        resolve(availableTerminal.resource.agent);
      }
    }
  }

  /**
   * Remove from waiting queue
   */
  private removeFromWaitingQueue(configKey: string, resolve: Function): void {
    const requests = this.pendingAcquisitions.get(configKey);
    if (!requests) return;

    const index = requests.findIndex(req => req.resolve === resolve);
    if (index !== -1) {
      requests.splice(index, 1);
    }
  }

  /**
   * Get configuration key for pooling
   */
  private getConfigKey(config: TUIAgentConfig): string {
    return JSON.stringify({
      shell: config.shell,
      cwd: config.cwd,
      env: config.env
    });
  }

  /**
   * Get current pool size
   */
  private getPoolSize(): number {
    return this.terminalPool.size;
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${++this.resourceIdCounter}_${Date.now()}`;
  }

  /**
   * Track acquisition time for metrics
   */
  private trackAcquisitionTime(time: number): void {
    this.acquisitionTimes.push(time);

    // Keep only last 100 measurements
    if (this.acquisitionTimes.length > 100) {
      this.acquisitionTimes.shift();
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    if (!this.config.enableMetrics) return;

    // Pool metrics
    const activeTerminals = Array.from(this.terminalPool.values()).filter(r => r.isInUse).length;
    this.metrics.pool = {
      totalResources: this.terminalPool.size,
      activeResources: activeTerminals,
      idleResources: this.terminalPool.size - activeTerminals,
      totalCreated: this.metrics.pool.totalCreated,
      totalDestroyed: this.metrics.pool.totalDestroyed,
      acquisitionTime: this.calculateAcquisitionStats()
    };

    // Buffer metrics
    const compressedBuffers = Array.from(this.bufferPool.values()).filter(b => b.compressed).length;
    this.metrics.buffers = {
      totalBuffers: this.bufferPool.size,
      totalSize: this.totalBufferSize,
      compressedBuffers,
      compressionRatio: compressedBuffers / Math.max(1, this.bufferPool.size)
    };

    // Update memory metrics
    this.updateMemoryMetrics();

    this.emit('metricsUpdated', this.metrics);
  }

  /**
   * Update memory metrics
   */
  private updateMemoryMetrics(usage?: NodeJS.MemoryUsage): void {
    const memoryUsage = usage || process.memoryUsage();
    this.metrics.memory = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      gcRuns: this.gcCallCount,
      lastGcTime: this.metrics.memory.lastGcTime
    };
  }

  /**
   * Calculate acquisition time statistics
   */
  private calculateAcquisitionStats(): { avg: number; p95: number; p99: number } {
    if (this.acquisitionTimes.length === 0) {
      return { avg: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.acquisitionTimes].sort((a, b) => a - b);
    const avg = sorted.reduce((sum, time) => sum + time, 0) / sorted.length;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      avg: Math.round(avg),
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0
    };
  }

  /**
   * Compress buffer using Node.js built-in compression
   */
  private compressBuffer(buffer: Buffer): Buffer {
    const zlib = require('zlib');
    try {
      return zlib.gzipSync(buffer);
    } catch (error) {
      // If compression fails, return original
      return buffer;
    }
  }

  /**
   * Decompress buffer
   */
  private decompressBuffer(buffer: Buffer): Buffer {
    const zlib = require('zlib');
    try {
      return zlib.gunzipSync(buffer);
    } catch (error) {
      // If decompression fails, return original
      return buffer;
    }
  }
}

/**
 * Singleton instance for global resource management
 */
export const resourceOptimizer = new ResourceOptimizer();