import {
  ResourceOptimizer,
  TUIAgent,
  ProcessLifecycleManager,
  ResourceOptimizerConfig
} from '../src';

/**
 * Resource Optimization Example
 *
 * Demonstrates how to use ResourceOptimizer to address memory issues
 * and improve performance in terminal-heavy applications.
 */

async function main() {
  console.log('ResourceOptimizer Example - Fixing Memory Issues\n');

  // Configure ResourceOptimizer with memory-conscious settings
  const config: ResourceOptimizerConfig = {
    pool: {
      maxSize: 10,        // Limit concurrent terminals
      minSize: 2,         // Maintain minimal pool
      idleTimeout: 300000, // 5 minutes idle timeout
      maxAge: 1800000,    // 30 minutes max age
      acquisitionTimeout: 30000
    },
    memory: {
      maxHeapUsed: 512 * 1024 * 1024,  // 512MB heap limit
      maxRSS: 1024 * 1024 * 1024,      // 1GB RSS limit
      gcThreshold: 70,                  // GC at 70% of limit
      monitorInterval: 10000            // Monitor every 10 seconds
    },
    buffer: {
      maxBufferSize: 1024 * 1024,       // 1MB per buffer
      maxTotalBuffers: 50,              // Max 50 buffers
      compressionThreshold: 64 * 1024,  // Compress buffers > 64KB
      rotationInterval: 60000           // Rotate every minute
    },
    enableMetrics: true,
    enableGarbageCollection: true
  };

  // Create ResourceOptimizer with shared ProcessLifecycleManager
  const processManager = new ProcessLifecycleManager();
  const resourceOptimizer = new ResourceOptimizer(config, processManager);

  // Set up event listeners for monitoring
  setupEventListeners(resourceOptimizer);

  try {
    // Simulate the problematic scenario: 50 test terminals
    console.log('🚀 Starting memory-optimized terminal simulation...');
    await simulateTerminalTests(resourceOptimizer, 50);

    console.log('\n✅ All tests completed successfully!');
    console.log('📊 Final metrics:', JSON.stringify(resourceOptimizer.getMetrics(), null, 2));

  } catch (error) {
    console.error('❌ Error during simulation:', error);
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up resources...');
    await resourceOptimizer.destroy();
    await processManager.shutdown();
    console.log('✅ Cleanup complete');
  }
}

/**
 * Set up event listeners to monitor ResourceOptimizer behavior
 */
function setupEventListeners(optimizer: ResourceOptimizer) {
  optimizer.on('memoryWarning', (usage) => {
    console.log(`⚠️  Memory warning: Heap ${Math.round(usage.heapUsed / 1024 / 1024)}MB, RSS ${Math.round(usage.rss / 1024 / 1024)}MB`);
  });

  optimizer.on('memoryAlert', (usage) => {
    console.log(`🚨 Memory alert: Heap ${Math.round(usage.heapUsed / 1024 / 1024)}MB, RSS ${Math.round(usage.rss / 1024 / 1024)}MB`);
  });

  optimizer.on('resourceCreated', (type, id) => {
    console.log(`➕ Created ${type}: ${id}`);
  });

  optimizer.on('resourceDestroyed', (type, id) => {
    console.log(`➖ Destroyed ${type}: ${id}`);
  });

  optimizer.on('bufferRotated', (count) => {
    console.log(`🔄 Rotated ${count} old buffers`);
  });

  optimizer.on('gcTriggered', (reason) => {
    console.log(`🗑️  Garbage collection triggered: ${reason}`);
  });

  let metricsCounter = 0;
  optimizer.on('metricsUpdated', (metrics) => {
    // Only log every 10th metrics update to avoid spam
    if (++metricsCounter % 10 === 0) {
      console.log(`📈 Pool: ${metrics.pool.totalResources} total, ${metrics.pool.activeResources} active | Buffers: ${metrics.buffers.totalBuffers} (${Math.round(metrics.buffers.totalSize / 1024)}KB)`);
    }
  });
}

/**
 * Simulate the problematic scenario that caused 2.3GB memory usage
 */
async function simulateTerminalTests(optimizer: ResourceOptimizer, testCount: number): Promise<void> {
  const startTime = Date.now();
  const terminals: TUIAgent[] = [];
  const buffers: string[] = [];

  try {
    // Simulate running multiple tests concurrently (like the original issue)
    console.log(`Running ${testCount} terminal tests with ResourceOptimizer...`);

    for (let i = 0; i < testCount; i++) {
      console.log(`\n🧪 Test ${i + 1}/${testCount}: Simulating terminal test`);

      // Acquire terminal from pool (reuses existing ones)
      const terminal = await optimizer.acquireTerminal({
        shell: '/bin/bash',
        cwd: process.cwd(),
        timeout: 30000
      });

      terminals.push(terminal);

      // Simulate test execution with output buffering
      const testOutput = `Test ${i + 1} output: ${'x'.repeat(Math.random() * 1000 + 100)}`;
      const bufferId = optimizer.createBuffer(testOutput, true); // Enable compression
      buffers.push(bufferId);

      // Simulate some terminal operations
      if (terminal.isRunning()) {
        // In a real test, you'd execute commands here
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
      }

      // Release terminal back to pool for reuse (key difference from original issue)
      await optimizer.releaseTerminal(terminal);
      terminals.pop(); // Remove from active list

      // Periodically clean up old buffers (simulate test cleanup)
      if (i > 0 && i % 10 === 0) {
        const oldBuffers = buffers.splice(0, 5); // Clean up oldest 5 buffers
        oldBuffers.forEach(bufferId => optimizer.destroyBuffer(bufferId));
        console.log(`🧹 Cleaned up ${oldBuffers.length} test output buffers`);
      }

      // Show progress every 10 tests
      if (i % 10 === 9) {
        const currentMetrics = optimizer.getMetrics();
        console.log(`Progress: ${Math.round(((i + 1) / testCount) * 100)}% | Memory: ${Math.round(currentMetrics.memory.heapUsed / 1024 / 1024)}MB`);
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n🎉 Completed ${testCount} tests in ${duration}ms`);
    console.log(`📊 Average test time: ${Math.round(duration / testCount)}ms`);

    // Final cleanup of remaining buffers
    buffers.forEach(bufferId => optimizer.destroyBuffer(bufferId));
    console.log(`🧹 Final cleanup: destroyed ${buffers.length} remaining buffers`);

  } catch (error) {
    console.error('❌ Error during test simulation:', error);
    throw error;
  }
}

/**
 * Advanced usage example: Custom memory monitoring
 */
async function advancedMemoryMonitoring() {
  console.log('\n🔬 Advanced Memory Monitoring Example');

  const optimizer = new ResourceOptimizer({
    memory: {
      maxHeapUsed: 100 * 1024 * 1024, // 100MB limit
      monitorInterval: 1000,           // Monitor every second
      gcThreshold: 60
    }
  });

  // Custom memory monitoring
  const monitoringInterval = setInterval(() => {
    const metrics = optimizer.getMetrics();
    const memoryUsage = process.memoryUsage();

    console.log(`Memory Usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memoryUsage.rss / 1024 / 1024)}MB RSS`);
    console.log(`Pool Status: ${metrics.pool.activeResources}/${metrics.pool.totalResources} active terminals`);
    console.log(`Buffers: ${metrics.buffers.totalBuffers} (${Math.round(metrics.buffers.totalSize / 1024)}KB total)`);
    console.log('---');
  }, 2000);

  // Simulate memory-intensive operations
  const terminals: TUIAgent[] = [];
  const buffers: string[] = [];

  try {
    for (let i = 0; i < 20; i++) {
      const terminal = await optimizer.acquireTerminal({ cwd: `/tmp/test-${i}` });
      terminals.push(terminal);

      // Create some large buffers
      const largeData = 'x'.repeat(50000); // 50KB buffer
      buffers.push(optimizer.createBuffer(largeData, true));

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Release all terminals
    for (const terminal of terminals) {
      await optimizer.releaseTerminal(terminal);
    }

  } finally {
    clearInterval(monitoringInterval);
    await optimizer.destroy();
  }
}

// Run the examples
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ All examples completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Example failed:', error);
      process.exit(1);
    });
}