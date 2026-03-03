import { EventEmitter } from 'events';
import { ProcessLifecycleManager } from './ProcessLifecycleManager';
import { PtyTerminal, PtyTerminalConfig } from './PtyTerminal';
export type { ResourcePoolConfig, MemoryConfig, BufferConfig, ResourceOptimizerConfig, ResourceMetrics, ResourceOptimizerEvents } from './optimizer/types';
/**
 * ResourceOptimizer
 *
 * Thin facade over MemoryOptimizer, CpuOptimizer (buffer management),
 * and ConcurrencyOptimizer (terminal pool). Preserves the original public API.
 */
export declare class ResourceOptimizer extends EventEmitter {
    private memoryOpt;
    private cpuOpt;
    private concurrencyOpt;
    private isDestroying;
    /**
     * Used by tests that inspect internal pool state via findResourceByAgent(...)
     */
    findResourceByAgent(agent: PtyTerminal): unknown;
    /**
     * Used by tests that call rotateBuffers(true)
     */
    rotateBuffers(force: boolean): void;
    constructor(config?: import('./optimizer/types').ResourceOptimizerConfig, processManager?: ProcessLifecycleManager);
    acquireTerminal(config?: PtyTerminalConfig): Promise<PtyTerminal>;
    releaseTerminal(agent: PtyTerminal): Promise<void>;
    cleanupIdleResources(): Promise<number>;
    createBuffer(data: string | Buffer, compress?: boolean): string;
    getBuffer(bufferId: string): Buffer | null;
    destroyBuffer(bufferId: string): boolean;
    getMetrics(): import('./optimizer/types').ResourceMetrics;
    triggerGarbageCollection(reason?: string): Promise<void>;
    private aggressiveCleanup;
    destroy(): Promise<void>;
}
export declare function getResourceOptimizer(): ResourceOptimizer;
export declare const resourceOptimizer: ResourceOptimizer;
//# sourceMappingURL=ResourceOptimizer.d.ts.map