"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resourceOptimizer = exports.ResourceOptimizer = void 0;
exports.getResourceOptimizer = getResourceOptimizer;
const events_1 = require("events");
const ProcessLifecycleManager_1 = require("./ProcessLifecycleManager");
const MemoryOptimizer_1 = require("./optimizer/MemoryOptimizer");
const CpuOptimizer_1 = require("./optimizer/CpuOptimizer");
const ConcurrencyOptimizer_1 = require("./optimizer/ConcurrencyOptimizer");
/**
 * ResourceOptimizer
 *
 * Thin facade over MemoryOptimizer, CpuOptimizer (buffer management),
 * and ConcurrencyOptimizer (terminal pool). Preserves the original public API.
 */
class ResourceOptimizer extends events_1.EventEmitter {
    /**
     * Used by tests that inspect internal pool state via findResourceByAgent(...)
     */
    findResourceByAgent(agent) {
        return this.concurrencyOpt.findResourceByAgent(agent);
    }
    /**
     * Used by tests that call rotateBuffers(true)
     */
    rotateBuffers(force) {
        this.cpuOpt.rotateBuffers(force);
    }
    constructor(config = {}, processManager) {
        super();
        this.isDestroying = false;
        const pm = processManager || new ProcessLifecycleManager_1.ProcessLifecycleManager();
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
        this.memoryOpt = new MemoryOptimizer_1.MemoryOptimizer(memConfig, enableGC);
        this.cpuOpt = new CpuOptimizer_1.CpuOptimizer(bufConfig);
        this.concurrencyOpt = new ConcurrencyOptimizer_1.ConcurrencyOptimizer(poolConfig, pm);
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
    async acquireTerminal(config = {}) {
        const agent = await this.concurrencyOpt.acquireTerminal(config, this.isDestroying);
        this.emit('metricsUpdated', this.getMetrics());
        return agent;
    }
    async releaseTerminal(agent) {
        await this.concurrencyOpt.releaseTerminal(agent);
        this.emit('metricsUpdated', this.getMetrics());
    }
    async cleanupIdleResources() {
        return this.concurrencyOpt.cleanupIdleResources();
    }
    // ---- Buffer pool ----
    createBuffer(data, compress = false) {
        const id = this.cpuOpt.createBuffer(data, compress);
        this.emit('metricsUpdated', this.getMetrics());
        return id;
    }
    getBuffer(bufferId) {
        return this.cpuOpt.getBuffer(bufferId);
    }
    destroyBuffer(bufferId) {
        const ok = this.cpuOpt.destroyBuffer(bufferId);
        if (ok)
            this.emit('metricsUpdated', this.getMetrics());
        return ok;
    }
    // ---- Metrics & GC ----
    getMetrics() {
        return {
            pool: this.concurrencyOpt.getMetrics(),
            memory: this.memoryOpt.getMetrics(),
            buffers: this.cpuOpt.getMetrics()
        };
    }
    async triggerGarbageCollection(reason = 'manual') {
        await this.memoryOpt.triggerGarbageCollection(reason);
    }
    // ---- Lifecycle ----
    async aggressiveCleanup() {
        await this.cleanupIdleResources();
        this.cpuOpt.aggressiveClear();
        await this.triggerGarbageCollection('memory_pressure');
    }
    async destroy() {
        if (this.isDestroying)
            return;
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
exports.ResourceOptimizer = ResourceOptimizer;
/**
 * Singleton instance for global resource management.
 * Lazily initialised via a Proxy so that importing this module does not
 * immediately start background monitoring timers.
 */
let _globalResourceOptimizer = null;
function getResourceOptimizer() {
    if (!_globalResourceOptimizer) {
        _globalResourceOptimizer = new ResourceOptimizer();
    }
    return _globalResourceOptimizer;
}
exports.resourceOptimizer = new Proxy({}, {
    get(_target, prop, receiver) {
        return Reflect.get(getResourceOptimizer(), prop, receiver);
    },
    set(_target, prop, value, receiver) {
        return Reflect.set(getResourceOptimizer(), prop, value, receiver);
    }
});
//# sourceMappingURL=ResourceOptimizer.js.map