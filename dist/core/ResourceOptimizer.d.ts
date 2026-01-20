import { EventEmitter } from 'events';
import { ProcessLifecycleManager } from './ProcessLifecycleManager';
import { TUIAgent, TUIAgentConfig } from './TUIAgent';
/**
 * Resource pool configuration
 */
export interface ResourcePoolConfig {
    maxSize: number;
    minSize: number;
    idleTimeout: number;
    maxAge: number;
    acquisitionTimeout: number;
}
/**
 * Memory monitoring configuration
 */
export interface MemoryConfig {
    maxHeapUsed: number;
    maxRSS: number;
    gcThreshold: number;
    monitorInterval: number;
}
/**
 * Buffer management configuration
 */
export interface BufferConfig {
    maxBufferSize: number;
    maxTotalBuffers: number;
    compressionThreshold: number;
    rotationInterval: number;
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
 * Resource metrics
 */
export interface ResourceMetrics {
    pool: {
        totalResources: number;
        activeResources: number;
        idleResources: number;
        totalCreated: number;
        totalDestroyed: number;
        acquisitionTime: {
            avg: number;
            p95: number;
            p99: number;
        };
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
export declare class ResourceOptimizer extends EventEmitter {
    private config;
    private terminalPool;
    private bufferPool;
    private processManager;
    private pendingAcquisitions;
    private resourceIdCounter;
    private isDestroying;
    private memoryMonitorInterval?;
    private lastMemoryUsage?;
    private gcCallCount;
    private bufferRotationInterval?;
    private totalBufferSize;
    private metrics;
    private acquisitionTimes;
    constructor(config?: ResourceOptimizerConfig, processManager?: ProcessLifecycleManager);
    /**
     * Acquire a terminal connection from the pool
     */
    acquireTerminal(config?: TUIAgentConfig): Promise<TUIAgent>;
    /**
     * Release a terminal back to the pool
     */
    releaseTerminal(agent: TUIAgent): Promise<void>;
    /**
     * Create a managed buffer with automatic cleanup
     */
    createBuffer(data: string | Buffer, compress?: boolean): string;
    /**
     * Get buffer data by ID
     */
    getBuffer(bufferId: string): Buffer | null;
    /**
     * Remove buffer from pool
     */
    destroyBuffer(bufferId: string): boolean;
    /**
     * Get current resource metrics
     */
    getMetrics(): ResourceMetrics;
    /**
     * Force garbage collection if enabled
     */
    triggerGarbageCollection(reason?: string): Promise<void>;
    /**
     * Cleanup idle resources
     */
    cleanupIdleResources(): Promise<number>;
    /**
     * Full system cleanup and destruction
     */
    destroy(): Promise<void>;
    /**
     * Start memory monitoring
     */
    private startMemoryMonitoring;
    /**
     * Start buffer rotation
     */
    private startBufferRotation;
    /**
     * Rotate old buffers
     */
    private rotateBuffers;
    /**
     * Aggressive cleanup during memory pressure
     */
    private aggressiveCleanup;
    /**
     * Create a new terminal connection
     */
    private createTerminal;
    /**
     * Wait for available terminal
     */
    private waitForTerminal;
    /**
     * Find available terminal for config
     */
    private findAvailableTerminal;
    /**
     * Find resource by agent instance
     */
    private findResourceByAgent;
    /**
     * Destroy terminal resource
     */
    private destroyTerminalResource;
    /**
     * Notify waiting acquisitions
     */
    private notifyWaitingAcquisitions;
    /**
     * Remove from waiting queue
     */
    private removeFromWaitingQueue;
    /**
     * Get configuration key for pooling
     */
    private getConfigKey;
    /**
     * Get current pool size
     */
    private getPoolSize;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Track acquisition time for metrics
     */
    private trackAcquisitionTime;
    /**
     * Update metrics
     */
    private updateMetrics;
    /**
     * Update memory metrics
     */
    private updateMemoryMetrics;
    /**
     * Calculate acquisition time statistics
     */
    private calculateAcquisitionStats;
    /**
     * Compress buffer using Node.js built-in compression
     */
    private compressBuffer;
    /**
     * Decompress buffer
     */
    private decompressBuffer;
}
/**
 * Singleton instance for global resource management
 */
export declare const resourceOptimizer: ResourceOptimizer;
//# sourceMappingURL=ResourceOptimizer.d.ts.map