"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resourceOptimizer = exports.ResourceOptimizer = void 0;
const events_1 = require("events");
const ProcessLifecycleManager_1 = require("./ProcessLifecycleManager");
const TUIAgent_1 = require("./TUIAgent");
/**
 * ResourceOptimizer
 *
 * Comprehensive resource management system that addresses memory issues
 * by implementing connection pooling, buffer management, and memory monitoring.
 */
class ResourceOptimizer extends events_1.EventEmitter {
    constructor(config = {}, processManager) {
        super();
        this.terminalPool = new Map();
        this.bufferPool = new Map();
        // Resource management
        this.pendingAcquisitions = new Map();
        this.resourceIdCounter = 0;
        this.isDestroying = false;
        this.gcCallCount = 0;
        this.totalBufferSize = 0;
        // Metrics tracking
        this.metrics = {
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
        this.acquisitionTimes = [];
        this.processManager = processManager || new ProcessLifecycleManager_1.ProcessLifecycleManager();
        // Set default configuration with memory-conscious values
        const defaultPoolConfig = {
            maxSize: 10, // Limit concurrent terminals
            minSize: 2, // Keep minimal pool
            idleTimeout: 300000, // 5 minutes
            maxAge: 1800000, // 30 minutes
            acquisitionTimeout: 30000 // 30 seconds
        };
        const defaultMemoryConfig = {
            maxHeapUsed: 512 * 1024 * 1024, // 512MB
            maxRSS: 1024 * 1024 * 1024, // 1GB
            gcThreshold: 70, // 70% of max heap
            monitorInterval: 10000 // 10 seconds
        };
        const defaultBufferConfig = {
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
    async acquireTerminal(config = {}) {
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
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Release a terminal back to the pool
     */
    async releaseTerminal(agent) {
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
        }
        catch (error) {
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
    createBuffer(data, compress = false) {
        if (this.bufferPool.size >= this.config.buffer.maxTotalBuffers) {
            this.rotateBuffers(true); // Force rotation
        }
        const bufferId = this.generateId('buffer');
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        // Compress if enabled and above threshold
        const shouldCompress = compress || buffer.length >= this.config.buffer.compressionThreshold;
        const finalBuffer = shouldCompress ? this.compressBuffer(buffer) : buffer;
        const bufferEntry = {
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
    getBuffer(bufferId) {
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
    destroyBuffer(bufferId) {
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
    getMetrics() {
        this.updateMetrics();
        return { ...this.metrics };
    }
    /**
     * Force garbage collection if enabled
     */
    async triggerGarbageCollection(reason = 'manual') {
        if (!this.config.enableGarbageCollection || !global.gc) {
            return;
        }
        try {
            global.gc();
            this.gcCallCount++;
            this.metrics.memory.gcRuns = this.gcCallCount;
            this.metrics.memory.lastGcTime = new Date();
            this.emit('gcTriggered', reason);
        }
        catch (error) {
            this.emit('error', new Error(`Garbage collection failed: ${error}`));
        }
    }
    /**
     * Cleanup idle resources
     */
    async cleanupIdleResources() {
        const now = new Date();
        const idleTimeout = this.config.pool.idleTimeout;
        const maxAge = this.config.pool.maxAge;
        let cleanedCount = 0;
        const toDestroy = [];
        // Find idle or old terminals
        for (const [id, resource] of this.terminalPool) {
            if (resource.isInUse)
                continue;
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
    async destroy() {
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
    startMemoryMonitoring() {
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
    startBufferRotation() {
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
    rotateBuffers(force) {
        const now = new Date();
        const oldBuffers = [];
        for (const [id, buffer] of this.bufferPool) {
            const age = now.getTime() - buffer.lastAccessed.getTime();
            if (force || age > this.config.buffer.rotationInterval) {
                oldBuffers.push(id);
            }
        }
        // Remove oldest buffers first
        oldBuffers
            .sort((a, b) => {
            const bufferA = this.bufferPool.get(a);
            const bufferB = this.bufferPool.get(b);
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
    async aggressiveCleanup() {
        // Force cleanup all idle resources
        await this.cleanupIdleResources();
        // Rotate all but most recent buffers
        const bufferIds = Array.from(this.bufferPool.keys());
        bufferIds
            .sort((a, b) => {
            const bufferA = this.bufferPool.get(a);
            const bufferB = this.bufferPool.get(b);
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
    async createTerminal(config) {
        const terminalId = this.generateId('terminal');
        const agent = new TUIAgent_1.TUIAgent(config, this.processManager);
        const pooledResource = {
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
        }
        catch (error) {
            // Remove from pool if start fails
            this.terminalPool.delete(terminalId);
            throw error;
        }
    }
    /**
     * Wait for available terminal
     */
    async waitForTerminal(configKey, startTime) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.removeFromWaitingQueue(configKey, resolve);
                reject(new Error(`Terminal acquisition timeout after ${this.config.pool.acquisitionTimeout}ms`));
            }, this.config.pool.acquisitionTimeout);
            if (!this.pendingAcquisitions.has(configKey)) {
                this.pendingAcquisitions.set(configKey, []);
            }
            this.pendingAcquisitions.get(configKey).push({ resolve, reject, timeout });
        });
    }
    /**
     * Find available terminal for config
     */
    findAvailableTerminal(configKey) {
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
    findResourceByAgent(agent) {
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
    async destroyTerminalResource(resourceId) {
        const resource = this.terminalPool.get(resourceId);
        if (!resource) {
            return;
        }
        this.terminalPool.delete(resourceId);
        try {
            await resource.resource.agent.destroy();
        }
        catch (error) {
            // Ignore cleanup errors
        }
        this.metrics.pool.totalDestroyed++;
        this.emit('resourceDestroyed', 'terminal', resourceId);
        this.updateMetrics();
    }
    /**
     * Notify waiting acquisitions
     */
    notifyWaitingAcquisitions() {
        for (const [configKey, requests] of this.pendingAcquisitions) {
            if (requests.length === 0)
                continue;
            const availableTerminal = this.findAvailableTerminal(configKey);
            if (availableTerminal) {
                const { resolve, timeout } = requests.shift();
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
    removeFromWaitingQueue(configKey, resolve) {
        const requests = this.pendingAcquisitions.get(configKey);
        if (!requests)
            return;
        const index = requests.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
            requests.splice(index, 1);
        }
    }
    /**
     * Get configuration key for pooling
     */
    getConfigKey(config) {
        return JSON.stringify({
            shell: config.shell,
            cwd: config.cwd,
            env: config.env
        });
    }
    /**
     * Get current pool size
     */
    getPoolSize() {
        return this.terminalPool.size;
    }
    /**
     * Generate unique ID
     */
    generateId(prefix) {
        return `${prefix}_${++this.resourceIdCounter}_${Date.now()}`;
    }
    /**
     * Track acquisition time for metrics
     */
    trackAcquisitionTime(time) {
        this.acquisitionTimes.push(time);
        // Keep only last 100 measurements
        if (this.acquisitionTimes.length > 100) {
            this.acquisitionTimes.shift();
        }
    }
    /**
     * Update metrics
     */
    updateMetrics() {
        if (!this.config.enableMetrics)
            return;
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
    updateMemoryMetrics(usage) {
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
    calculateAcquisitionStats() {
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
    compressBuffer(buffer) {
        const zlib = require('zlib');
        try {
            return zlib.gzipSync(buffer);
        }
        catch (error) {
            // If compression fails, return original
            return buffer;
        }
    }
    /**
     * Decompress buffer
     */
    decompressBuffer(buffer) {
        const zlib = require('zlib');
        try {
            return zlib.gunzipSync(buffer);
        }
        catch (error) {
            // If decompression fails, return original
            return buffer;
        }
    }
}
exports.ResourceOptimizer = ResourceOptimizer;
/**
 * Singleton instance for global resource management
 */
exports.resourceOptimizer = new ResourceOptimizer();
//# sourceMappingURL=ResourceOptimizer.js.map