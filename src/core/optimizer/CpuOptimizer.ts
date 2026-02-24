/**
 * CpuOptimizer
 *
 * Buffer pool management with compression, rotation, and size limits.
 * Named CpuOptimizer to match the file split plan; manages I/O buffers
 * which are the primary CPU-adjacent resource in this system.
 */

import { EventEmitter } from 'events';
import { BufferConfig, BufferEntry, ResourceMetrics } from './types';

export class CpuOptimizer extends EventEmitter {
  private config: Required<BufferConfig>;
  private bufferPool = new Map<string, BufferEntry>();
  private totalBufferSize = 0;
  private rotationInterval?: NodeJS.Timeout;
  private idCounter = 0;

  constructor(config: Required<BufferConfig>) {
    super();
    this.config = config;
  }

  /**
   * Start periodic buffer rotation
   */
  start(): void {
    if (!this.config.rotationInterval) return;
    this.rotationInterval = setInterval(() => {
      this.rotateBuffers(false);
    }, this.config.rotationInterval).unref();
  }

  /**
   * Stop rotation timer
   */
  stop(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = undefined;
    }
  }

  /**
   * Create a managed buffer
   */
  createBuffer(data: string | Buffer, compress: boolean = false): string {
    if (this.bufferPool.size >= this.config.maxTotalBuffers) {
      this.rotateBuffers(true);
    }

    const bufferId = `buffer_${++this.idCounter}_${Date.now()}`;
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const shouldCompress = compress || raw.length >= this.config.compressionThreshold;
    const finalBuffer = shouldCompress ? this.compressBuffer(raw) : raw;

    const entry: BufferEntry = {
      id: bufferId,
      data: finalBuffer,
      compressed: shouldCompress,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0
    };

    this.bufferPool.set(bufferId, entry);
    this.totalBufferSize += finalBuffer.length;

    return bufferId;
  }

  /**
   * Retrieve buffer by ID
   */
  getBuffer(bufferId: string): Buffer | null {
    const entry = this.bufferPool.get(bufferId);
    if (!entry) return null;
    entry.lastAccessed = new Date();
    entry.accessCount++;
    return entry.compressed ? this.decompressBuffer(entry.data) : entry.data;
  }

  /**
   * Destroy a single buffer
   */
  destroyBuffer(bufferId: string): boolean {
    const entry = this.bufferPool.get(bufferId);
    if (!entry) return false;
    this.totalBufferSize -= entry.data.length;
    this.bufferPool.delete(bufferId);
    return true;
  }

  /**
   * Aggressively clear all but 5 most-recent buffers
   */
  aggressiveClear(): void {
    const ids = Array.from(this.bufferPool.keys());
    ids
      .sort((a, b) => {
        const ba = this.bufferPool.get(a)!;
        const bb = this.bufferPool.get(b)!;
        return bb.lastAccessed.getTime() - ba.lastAccessed.getTime();
      })
      .slice(5)
      .forEach(id => this.destroyBuffer(id));
  }

  /**
   * Clear all buffers
   */
  destroyAll(): void {
    this.bufferPool.clear();
    this.totalBufferSize = 0;
  }

  /**
   * Rotate (evict) old buffers, emitting bufferRotated when any are removed
   */
  rotateBuffers(force: boolean): void {
    const now = new Date();
    const old: string[] = [];

    for (const [id, buf] of this.bufferPool) {
      const age = now.getTime() - buf.lastAccessed.getTime();
      if (force || age > this.config.rotationInterval) old.push(id);
    }

    old
      .sort((a, b) => {
        const ba = this.bufferPool.get(a)!;
        const bb = this.bufferPool.get(b)!;
        return ba.lastAccessed.getTime() - bb.lastAccessed.getTime();
      })
      .slice(0, Math.max(1, Math.floor(old.length / 2)))
      .forEach(id => this.destroyBuffer(id));

    if (old.length > 0) {
      this.emit('bufferRotated', old.length);
    }
  }

  /**
   * Get buffer metrics
   */
  getMetrics(): ResourceMetrics['buffers'] {
    const compressed = Array.from(this.bufferPool.values()).filter(b => b.compressed).length;
    return {
      totalBuffers: this.bufferPool.size,
      totalSize: this.totalBufferSize,
      compressedBuffers: compressed,
      compressionRatio: compressed / Math.max(1, this.bufferPool.size)
    };
  }

  private compressBuffer(buffer: Buffer): Buffer {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const zlib = require('zlib') as typeof import('zlib');
    try {
      return zlib.gzipSync(buffer);
    } catch {
      return buffer;
    }
  }

  private decompressBuffer(buffer: Buffer): Buffer {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const zlib = require('zlib') as typeof import('zlib');
    try {
      return zlib.gunzipSync(buffer);
    } catch {
      return buffer;
    }
  }
}
