/**
 * Shared types for optimizer sub-modules
 */

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
export interface PooledResource<T> {
  id: string;
  resource: T;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
  isInUse: boolean;
}

/**
 * Buffer entry with metadata
 */
export interface BufferEntry {
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
