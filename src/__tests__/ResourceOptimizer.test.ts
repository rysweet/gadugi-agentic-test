import { ResourceOptimizer, ResourceOptimizerConfig } from '../core/ResourceOptimizer';
import { ProcessLifecycleManager } from '../core/ProcessLifecycleManager';
import { PtyTerminal, PtyTerminalConfig } from '../core/PtyTerminal';

// Mock the PtyTerminal to avoid actual terminal processes in tests
jest.mock('../core/PtyTerminal');

describe('ResourceOptimizer', () => {
  let resourceOptimizer: ResourceOptimizer;
  let mockProcessManager: ProcessLifecycleManager;

  // Helper to create mock PtyTerminal instances
  const createMockPtyTerminal = (config: PtyTerminalConfig = {}): jest.Mocked<PtyTerminal> => {
    const mockAgent = {
      start: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      clearOutput: jest.fn(),
      isRunning: jest.fn().mockReturnValue(true),
      getProcessInfo: jest.fn().mockReturnValue({
        pid: Math.floor(Math.random() * 10000),
        command: 'bash',
        args: [],
        startTime: new Date(),
        status: 'running' as const
      })
    } as unknown as jest.Mocked<PtyTerminal>;

    // Mock the constructor to return our mock instance
    (PtyTerminal as jest.MockedClass<typeof PtyTerminal>).mockImplementation(() => mockAgent);

    return mockAgent;
  };

  beforeEach(() => {
    // Create a new process manager for each test to avoid shared state
    mockProcessManager = {
      on: jest.fn(),
      emit: jest.fn(),
      startProcess: jest.fn(),
      killProcess: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProcessLifecycleManager;

    const config: ResourceOptimizerConfig = {
      pool: {
        maxSize: 5,
        minSize: 1,
        idleTimeout: 1000, // 1 second for fast tests
        maxAge: 5000, // 5 seconds for fast tests
        acquisitionTimeout: 2000
      },
      memory: {
        maxHeapUsed: 10 * 1024 * 1024, // 10MB for tests
        maxRSS: 50 * 1024 * 1024, // 50MB for tests
        gcThreshold: 70,
        monitorInterval: 100 // 100ms for fast tests
      },
      buffer: {
        maxBufferSize: 1024, // 1KB for tests
        maxTotalBuffers: 10,
        compressionThreshold: 64,
        rotationInterval: 500 // 500ms for fast tests
      },
      enableMetrics: true,
      enableGarbageCollection: false // Disable GC in tests
    };

    resourceOptimizer = new ResourceOptimizer(config, mockProcessManager);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await resourceOptimizer.destroy();
  });

  describe('Terminal Connection Pooling', () => {
    it('should create and acquire terminal connections', async () => {
      const mockAgent = createMockPtyTerminal();

      const config: PtyTerminalConfig = { shell: '/bin/bash', cwd: '/tmp' };
      const terminal = await resourceOptimizer.acquireTerminal(config);

      expect(terminal).toBe(mockAgent);
      expect(mockAgent.start).toHaveBeenCalledTimes(1);

      const metrics = resourceOptimizer.getMetrics();
      expect(metrics.pool.totalResources).toBe(1);
      expect(metrics.pool.activeResources).toBe(1);
      expect(metrics.pool.totalCreated).toBe(1);
    });

    it('should reuse idle terminals with same configuration', async () => {
      const mockAgent = createMockPtyTerminal();
      mockAgent.clearOutput.mockImplementation(() => {});

      const config: PtyTerminalConfig = { shell: '/bin/bash', cwd: '/tmp' };

      // Acquire and release terminal
      const terminal1 = await resourceOptimizer.acquireTerminal(config);
      await resourceOptimizer.releaseTerminal(terminal1);

      // Acquire again with same config - should reuse
      const terminal2 = await resourceOptimizer.acquireTerminal(config);

      expect(terminal1).toBe(terminal2);
      expect(mockAgent.start).toHaveBeenCalledTimes(1); // Only called once
      expect(mockAgent.clearOutput).toHaveBeenCalledTimes(1);
    });

    it('should respect pool size limits', async () => {
      const terminals: PtyTerminal[] = [];
      const configs: PtyTerminalConfig[] = [];

      // Fill the pool to maxSize (5)
      for (let i = 0; i < 5; i++) {
        createMockPtyTerminal(); // Create new mock for each acquisition
        const config: PtyTerminalConfig = { shell: '/bin/bash', cwd: `/tmp${i}` };
        configs.push(config);
        terminals.push(await resourceOptimizer.acquireTerminal(config));
      }

      const metrics = resourceOptimizer.getMetrics();
      expect(metrics.pool.totalResources).toBe(5);
      expect(metrics.pool.activeResources).toBe(5);

      // Try to acquire one more - should timeout since pool is full
      const config6: PtyTerminalConfig = { shell: '/bin/bash', cwd: '/tmp6' };
      const acquisitionPromise = resourceOptimizer.acquireTerminal(config6);

      // Should timeout
      await expect(acquisitionPromise).rejects.toThrow(/acquisition timeout/);
    });

    it('should wait for available terminal when pool is full', async () => {
      const terminals: PtyTerminal[] = [];
      const configs: PtyTerminalConfig[] = [];

      // Fill the pool
      for (let i = 0; i < 5; i++) {
        createMockPtyTerminal();
        const config: PtyTerminalConfig = { shell: '/bin/bash', cwd: `/tmp${i}` };
        configs.push(config);
        terminals.push(await resourceOptimizer.acquireTerminal(config));
      }

      // Try to acquire with existing config while pool is full
      const acquisitionPromise = resourceOptimizer.acquireTerminal(configs[0]);

      // Release one terminal after a short delay
      setTimeout(() => {
        resourceOptimizer.releaseTerminal(terminals[0]);
      }, 100);

      // Should eventually get the released terminal
      const terminal = await acquisitionPromise;
      expect(terminal).toBe(terminals[0]);
    });

    it('should clean up idle resources', async () => {
      const mockAgent = createMockPtyTerminal();
      mockAgent.destroy = jest.fn().mockResolvedValue(undefined);

      const config: PtyTerminalConfig = { shell: '/bin/bash', cwd: '/tmp' };
      const terminal = await resourceOptimizer.acquireTerminal(config);
      await resourceOptimizer.releaseTerminal(terminal);

      // Manually set last used time to simulate idle timeout.
      // findResourceByAgent is a public method on ResourceOptimizer exposed for
      // testing internal pool state without requiring private member access.
      const resource = resourceOptimizer.findResourceByAgent(terminal);
      if (resource) {
        resource.lastUsed = new Date(Date.now() - 2000); // 2 seconds ago
      }

      const cleanedCount = await resourceOptimizer.cleanupIdleResources();
      expect(cleanedCount).toBe(1);
      expect(mockAgent.destroy).toHaveBeenCalledTimes(1);

      const metrics = resourceOptimizer.getMetrics();
      expect(metrics.pool.totalResources).toBe(0);
    });
  });

  describe('Buffer Management', () => {
    it('should create and retrieve buffers', () => {
      const testData = 'Hello, World!';
      const bufferId = resourceOptimizer.createBuffer(testData);

      expect(typeof bufferId).toBe('string');
      expect(bufferId).toMatch(/^buffer_/);

      const retrievedBuffer = resourceOptimizer.getBuffer(bufferId);
      expect(retrievedBuffer).toBeInstanceOf(Buffer);
      expect(retrievedBuffer?.toString('utf8')).toBe(testData);

      const metrics = resourceOptimizer.getMetrics();
      expect(metrics.buffers.totalBuffers).toBe(1);
    });

    it('should compress large buffers', () => {
      // Create buffer larger than compression threshold (64 bytes)
      const largeData = 'x'.repeat(100);
      const bufferId = resourceOptimizer.createBuffer(largeData, true);

      const retrievedBuffer = resourceOptimizer.getBuffer(bufferId);
      expect(retrievedBuffer?.toString('utf8')).toBe(largeData);

      const metrics = resourceOptimizer.getMetrics();
      expect(metrics.buffers.compressedBuffers).toBe(1);
      expect(metrics.buffers.compressionRatio).toBeCloseTo(1.0);
    });

    it('should respect buffer limits', () => {
      // Create buffers up to the limit (10)
      const bufferIds: string[] = [];
      for (let i = 0; i < 12; i++) { // Try to create more than limit
        const bufferId = resourceOptimizer.createBuffer(`Buffer ${i}`);
        bufferIds.push(bufferId);
      }

      const metrics = resourceOptimizer.getMetrics();
      // Should have triggered rotation when limit was exceeded
      expect(metrics.buffers.totalBuffers).toBeLessThanOrEqual(10);
    });

    it('should destroy buffers', () => {
      const bufferId = resourceOptimizer.createBuffer('Test buffer');
      expect(resourceOptimizer.getBuffer(bufferId)).toBeTruthy();

      const destroyed = resourceOptimizer.destroyBuffer(bufferId);
      expect(destroyed).toBe(true);
      expect(resourceOptimizer.getBuffer(bufferId)).toBeNull();

      const metrics = resourceOptimizer.getMetrics();
      expect(metrics.buffers.totalBuffers).toBe(0);
    });

    it('should rotate old buffers', async () => {
      // Create several buffers
      const bufferIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        bufferIds.push(resourceOptimizer.createBuffer(`Buffer ${i}`));
      }

      expect(resourceOptimizer.getMetrics().buffers.totalBuffers).toBe(5);

      // Wait for rotation interval
      await new Promise(resolve => setTimeout(resolve, 600));

      const metricsAfter = resourceOptimizer.getMetrics();
      // Some buffers should have been rotated
      expect(metricsAfter.buffers.totalBuffers).toBeLessThan(5);
    });
  });

  describe('Memory Monitoring', () => {
    it('should track memory metrics', () => {
      const metrics = resourceOptimizer.getMetrics();

      expect(metrics.memory).toHaveProperty('heapUsed');
      expect(metrics.memory).toHaveProperty('heapTotal');
      expect(metrics.memory).toHaveProperty('rss');
      expect(metrics.memory).toHaveProperty('external');
      expect(typeof metrics.memory.heapUsed).toBe('number');
      expect(typeof metrics.memory.rss).toBe('number');
    });

    it('should emit memory warnings', (done) => {
      // Create a ResourceOptimizer with very low memory limits
      const lowMemoryConfig: ResourceOptimizerConfig = {
        memory: {
          maxHeapUsed: 1024, // Very low limit
          maxRSS: 2048,
          gcThreshold: 50, // Low threshold
          monitorInterval: 50 // Fast monitoring
        },
        enableGarbageCollection: false
      };

      const lowMemoryOptimizer = new ResourceOptimizer(lowMemoryConfig, mockProcessManager);

      lowMemoryOptimizer.on('memoryWarning', (usage) => {
        expect(usage).toHaveProperty('heapUsed');
        lowMemoryOptimizer.destroy().then(() => done());
      });

      // The memory warning should be triggered during normal operation
      // since our limits are extremely low
    });
  });

  describe('Resource Metrics', () => {
    it('should provide comprehensive metrics', async () => {
      // Create some resources and buffers
      const mockAgent = createMockPtyTerminal();
      const terminal = await resourceOptimizer.acquireTerminal({ shell: '/bin/bash' });
      const bufferId = resourceOptimizer.createBuffer('Test data');

      const metrics = resourceOptimizer.getMetrics();

      // Pool metrics
      expect(metrics.pool.totalResources).toBe(1);
      expect(metrics.pool.activeResources).toBe(1);
      expect(metrics.pool.totalCreated).toBe(1);
      expect(metrics.pool.totalDestroyed).toBe(0);

      // Buffer metrics
      expect(metrics.buffers.totalBuffers).toBe(1);
      expect(metrics.buffers.totalSize).toBeGreaterThan(0);

      // Memory metrics
      expect(metrics.memory.heapUsed).toBeGreaterThan(0);
      expect(metrics.memory.rss).toBeGreaterThan(0);

      await resourceOptimizer.releaseTerminal(terminal);
      resourceOptimizer.destroyBuffer(bufferId);
    });

    it('should track acquisition times', async () => {
      const mockAgent = createMockPtyTerminal();

      // Acquire and release several terminals to build acquisition time data
      for (let i = 0; i < 5; i++) {
        createMockPtyTerminal(); // New mock for each iteration
        const terminal = await resourceOptimizer.acquireTerminal({ shell: '/bin/bash', cwd: `/tmp${i}` });
        await resourceOptimizer.releaseTerminal(terminal);
      }

      const metrics = resourceOptimizer.getMetrics();
      expect(metrics.pool.acquisitionTime.avg).toBeGreaterThanOrEqual(0);
      expect(metrics.pool.acquisitionTime.p95).toBeGreaterThanOrEqual(0);
      expect(metrics.pool.acquisitionTime.p99).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle terminal start failures', async () => {
      const mockAgent = createMockPtyTerminal();
      mockAgent.start.mockRejectedValue(new Error('Failed to start terminal'));

      await expect(resourceOptimizer.acquireTerminal({ shell: '/bin/bash' }))
        .rejects.toThrow('Failed to start terminal');

      // Should not leave the failed terminal in the pool
      const metrics = resourceOptimizer.getMetrics();
      expect(metrics.pool.totalResources).toBe(0);
    });

    it('should handle terminal cleanup failures gracefully', async () => {
      const mockAgent = createMockPtyTerminal();
      mockAgent.clearOutput.mockImplementation(() => {
        throw new Error('Cleanup failed');
      });
      mockAgent.destroy = jest.fn().mockResolvedValue(undefined);

      const terminal = await resourceOptimizer.acquireTerminal({ shell: '/bin/bash' });

      // Release should handle cleanup failure by destroying the terminal
      await resourceOptimizer.releaseTerminal(terminal);

      // Should have destroyed the terminal due to cleanup failure
      expect(mockAgent.destroy).toHaveBeenCalledTimes(1);
    });

    it('should reject pending acquisitions on destroy', async () => {
      // Fill the pool
      const terminals: PtyTerminal[] = [];
      for (let i = 0; i < 5; i++) {
        createMockPtyTerminal();
        terminals.push(await resourceOptimizer.acquireTerminal({ shell: '/bin/bash', cwd: `/tmp${i}` }));
      }

      // Try to acquire another (will be pending)
      const pendingAcquisition = resourceOptimizer.acquireTerminal({ shell: '/bin/bash', cwd: '/tmp-pending' });

      // Destroy optimizer
      await resourceOptimizer.destroy();

      // Pending acquisition should be rejected
      await expect(pendingAcquisition).rejects.toThrow('ResourceOptimizer is being destroyed');
    });
  });

  describe('Lifecycle Management', () => {
    it('should prevent operations after destruction', async () => {
      await resourceOptimizer.destroy();

      await expect(resourceOptimizer.acquireTerminal({ shell: '/bin/bash' }))
        .rejects.toThrow('ResourceOptimizer is being destroyed');
    });

    it('should clean up all resources on destroy', async () => {
      const mockAgent = createMockPtyTerminal();
      mockAgent.destroy = jest.fn().mockResolvedValue(undefined);

      // Create some resources
      const terminal = await resourceOptimizer.acquireTerminal({ shell: '/bin/bash' });
      const bufferId = resourceOptimizer.createBuffer('Test data');

      expect(resourceOptimizer.getMetrics().pool.totalResources).toBe(1);
      expect(resourceOptimizer.getMetrics().buffers.totalBuffers).toBe(1);

      // Destroy should clean up everything
      await resourceOptimizer.destroy();

      expect(mockAgent.destroy).toHaveBeenCalledTimes(1);

      // Metrics should show empty state
      const finalMetrics = resourceOptimizer.getMetrics();
      expect(finalMetrics.pool.totalResources).toBe(0);
      expect(finalMetrics.buffers.totalBuffers).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit resource lifecycle events', async () => {
      const mockAgent = createMockPtyTerminal();
      mockAgent.destroy = jest.fn().mockResolvedValue(undefined);

      const resourceCreatedSpy = jest.fn();
      const resourceDestroyedSpy = jest.fn();

      resourceOptimizer.on('resourceCreated', resourceCreatedSpy);
      resourceOptimizer.on('resourceDestroyed', resourceDestroyedSpy);

      const terminal = await resourceOptimizer.acquireTerminal({ shell: '/bin/bash' });
      expect(resourceCreatedSpy).toHaveBeenCalledWith('terminal', expect.stringContaining('terminal_'));

      await resourceOptimizer.releaseTerminal(terminal);

      // Manually set last used time to simulate idle timeout.
      // findResourceByAgent is a public method on ResourceOptimizer exposed for
      // testing internal pool state without requiring private member access.
      const resource = resourceOptimizer.findResourceByAgent(terminal);
      if (resource) {
        resource.lastUsed = new Date(Date.now() - 2000); // 2 seconds ago
      }

      await resourceOptimizer.cleanupIdleResources();

      expect(resourceDestroyedSpy).toHaveBeenCalledWith('terminal', expect.stringContaining('terminal_'));
    });

    it('should emit buffer rotation events', (done) => {
      resourceOptimizer.on('bufferRotated', (count) => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThan(0);
        done();
      });

      // Create some buffers and wait for rotation
      for (let i = 0; i < 3; i++) {
        resourceOptimizer.createBuffer(`Buffer ${i}`);
      }

      // Manually trigger rotation after short delay.
      // rotateBuffers is a public method on ResourceOptimizer exposed for
      // testing buffer rotation behavior without requiring private member access.
      setTimeout(() => {
        resourceOptimizer.rotateBuffers(true);
      }, 100);
    });

    it('should emit metrics update events', (done) => {
      resourceOptimizer.on('metricsUpdated', (metrics) => {
        expect(metrics).toHaveProperty('pool');
        expect(metrics).toHaveProperty('memory');
        expect(metrics).toHaveProperty('buffers');
        done();
      });

      // Trigger metrics update
      resourceOptimizer.createBuffer('Test');
    });
  });
});