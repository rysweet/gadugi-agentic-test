import { AdaptiveWaiter, BackoffStrategy, WaitCondition, WaitOptions } from '../core/AdaptiveWaiter';

describe('AdaptiveWaiter', () => {
  let waiter: AdaptiveWaiter;

  beforeEach(() => {
    waiter = AdaptiveWaiter.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const waiter1 = AdaptiveWaiter.getInstance();
      const waiter2 = AdaptiveWaiter.getInstance();
      expect(waiter1).toBe(waiter2);
    });
  });

  describe('Basic Waiting', () => {
    it('should wait for condition to become true', async () => {
      let counter = 0;
      const condition = () => {
        counter++;
        return counter >= 3;
      };

      const result = await waiter.waitForCondition(condition, {
        initialDelay: 10,
        maxDelay: 50,
        timeout: 1000
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.totalWaitTime).toBeGreaterThan(0);
    });

    it('should timeout when condition never becomes true', async () => {
      const condition = () => false;

      const result = await waiter.waitForCondition(condition, {
        initialDelay: 10,
        maxDelay: 50,
        timeout: 100
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBeGreaterThan(1);
      expect(result.totalWaitTime).toBeGreaterThanOrEqual(100);
    });

    it('should return immediately when condition is initially true', async () => {
      const condition = () => true;

      const startTime = Date.now();
      const result = await waiter.waitForCondition(condition, {
        initialDelay: 10,
        timeout: 1000
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(Date.now() - startTime).toBeLessThan(50); // Should be very fast
    });
  });

  describe('Exponential Backoff', () => {
    it('should increase delay exponentially', async () => {
      let attempts = 0;
      const delays: number[] = [];
      let lastTime = Date.now();

      const condition = () => {
        const now = Date.now();
        if (attempts > 0) {
          delays.push(now - lastTime);
        }
        lastTime = now;
        attempts++;
        return attempts >= 4;
      };

      await waiter.waitForCondition(condition, {
        initialDelay: 50,
        backoffMultiplier: 2,
        maxDelay: 1000,
        timeout: 5000,
        jitter: 0 // Remove jitter for predictable testing
      });

      // Each delay should be roughly double the previous (with some tolerance)
      expect(delays[0]).toBeGreaterThanOrEqual(45); // ~50ms
      expect(delays[1]).toBeGreaterThanOrEqual(90); // ~100ms
      expect(delays[2]).toBeGreaterThanOrEqual(180); // ~200ms
    });

    it('should respect maximum delay', async () => {
      let attempts = 0;
      const delays: number[] = [];
      let lastTime = Date.now();

      const condition = () => {
        const now = Date.now();
        if (attempts > 0) {
          delays.push(now - lastTime);
        }
        lastTime = now;
        attempts++;
        return attempts >= 6;
      };

      await waiter.waitForCondition(condition, {
        initialDelay: 50,
        backoffMultiplier: 2,
        maxDelay: 100, // Cap at 100ms
        timeout: 5000,
        jitter: 0
      });

      // Later delays should be capped at maxDelay
      const laterDelays = delays.slice(-2);
      laterDelays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(110); // 100ms + small tolerance
      });
    });
  });

  describe('Jitter Implementation', () => {
    it('should apply jitter to delays', async () => {
      let attempts = 0;
      const delays: number[] = [];
      let lastTime = Date.now();

      const condition = () => {
        const now = Date.now();
        if (attempts > 0) {
          delays.push(now - lastTime);
        }
        lastTime = now;
        attempts++;
        return attempts >= 5;
      };

      await waiter.waitForCondition(condition, {
        initialDelay: 100,
        backoffMultiplier: 1.5,
        maxDelay: 500,
        timeout: 5000,
        jitter: 0.2 // 20% jitter
      });

      // Delays should vary due to jitter
      const uniqueDelays = new Set(delays.map(d => Math.round(d / 10) * 10));
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Output Waiting', () => {
    it('should wait for specific text in output', async () => {
      let output = '';

      // Simulate gradual output accumulation
      setTimeout(() => output += 'Hello', 50);
      setTimeout(() => output += ' World', 100);
      setTimeout(() => output += '!', 150);

      const result = await waiter.waitForOutput(
        () => output,
        'World',
        { timeout: 1000, initialDelay: 20 }
      );

      expect(result.success).toBe(true);
      expect(result.result).toContain('World');
    });

    it('should wait for regex pattern in output', async () => {
      let output = '';

      setTimeout(() => output += 'Process 12345 started', 100);

      const result = await waiter.waitForOutput(
        () => output,
        /Process \d+ started/,
        { timeout: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.result).toMatch(/Process \d+ started/);
    });
  });

  describe('Terminal Readiness', () => {
    it('should wait for shell prompt', async () => {
      let output = '';

      // Simulate shell startup
      setTimeout(() => output += 'user@host:~$ ', 100);

      const result = await waiter.waitForTerminalReady(
        () => output,
        /\$\s*$/,
        { timeout: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.result).toContain('$');
    });

    it('should handle different prompt patterns', async () => {
      let output = '';

      setTimeout(() => output += 'C:\\> ', 100);

      const result = await waiter.waitForTerminalReady(
        () => output,
        />\s*$/,
        { timeout: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.result).toContain('>');
    });
  });

  describe('Process Waiting', () => {
    it('should wait for process to start', async () => {
      let pid: number | null = null;

      setTimeout(() => pid = 12345, 50);

      const result = await waiter.waitForProcessStart(
        () => pid,
        { timeout: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(12345);
    });

    it('should wait for process to exit', async () => {
      let isRunning = true;

      setTimeout(() => isRunning = false, 100);

      const result = await waiter.waitForProcessExit(
        () => isRunning,
        { timeout: 1000 }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Backoff Strategies', () => {
    it('should use linear backoff strategy', async () => {
      let attempts = 0;
      const delays: number[] = [];
      let lastTime = Date.now();

      const condition = () => {
        const now = Date.now();
        if (attempts > 0) {
          delays.push(now - lastTime);
        }
        lastTime = now;
        attempts++;
        return attempts >= 4;
      };

      await waiter.waitWithStrategy(condition, BackoffStrategy.LINEAR, {
        initialDelay: 50,
        timeout: 2000,
        jitter: 0
      });

      // Linear: 50, 100, 150, ...
      expect(delays[0]).toBeGreaterThanOrEqual(45);
      expect(delays[1]).toBeGreaterThanOrEqual(95);
      expect(delays[2]).toBeGreaterThanOrEqual(145);
    });

    it('should use fibonacci backoff strategy', async () => {
      let attempts = 0;
      const condition = () => {
        attempts++;
        return attempts >= 6;
      };

      const result = await waiter.waitWithStrategy(condition, BackoffStrategy.FIBONACCI, {
        initialDelay: 10,
        timeout: 2000,
        jitter: 0
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(6);
    });

    it('should use exponential backoff strategy', async () => {
      let attempts = 0;
      const condition = () => {
        attempts++;
        return attempts >= 4;
      };

      const result = await waiter.waitWithStrategy(condition, BackoffStrategy.EXPONENTIAL, {
        initialDelay: 10,
        timeout: 2000,
        jitter: 0
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(4);
    });

    it('should use quadratic backoff strategy', async () => {
      let attempts = 0;
      const condition = () => {
        attempts++;
        return attempts >= 4;
      };

      const result = await waiter.waitWithStrategy(condition, BackoffStrategy.QUADRATIC, {
        initialDelay: 10,
        timeout: 5000,
        jitter: 0
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(4);
    });
  });

  describe('Operation Retry', () => {
    it('should retry failing operations', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return `Success on attempt ${attempts}`;
      };

      const result = await waiter.retryOperation(operation, {
        initialDelay: 10,
        timeout: 1000
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('Success on attempt 3');
      expect(result.attempts).toBe(3);
    });

    it('should timeout on persistent failures', async () => {
      const operation = async () => {
        throw new Error('Always fails');
      };

      const result = await waiter.retryOperation(operation, {
        initialDelay: 10,
        maxDelay: 50,
        timeout: 200
      });

      expect(result.success).toBe(false);
      expect(result.lastError?.message).toBe('Always fails');
      expect(result.attempts).toBeGreaterThan(1);
    });
  });

  describe('Batch Operations', () => {
    it('should wait for all conditions to be true', async () => {
      let counter1 = 0;
      let counter2 = 0;
      let counter3 = 0;

      const conditions = [
        () => { counter1++; return counter1 >= 2; },
        () => { counter2++; return counter2 >= 3; },
        () => { counter3++; return counter3 >= 1; }
      ];

      const result = await waiter.waitForAll(conditions, {
        initialDelay: 10,
        timeout: 1000
      });

      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(3);
      expect(counter1).toBeGreaterThanOrEqual(2);
      expect(counter2).toBeGreaterThanOrEqual(3);
      expect(counter3).toBeGreaterThanOrEqual(1);
    });

    it('should wait for any condition to be true', async () => {
      let counter1 = 0;
      let counter2 = 0;

      const conditions = [
        () => { counter1++; return false; }, // Never true
        () => { counter2++; return counter2 >= 2; } // True on 2nd attempt
      ];

      const result = await waiter.waitForAny(conditions, {
        initialDelay: 10,
        timeout: 1000
      });

      expect(result.success).toBe(true);
      expect(result.result.index).toBe(1);
      expect(counter2).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle async condition errors', async () => {
      let attempts = 0;
      const condition = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Error on attempt ${attempts}`);
        }
        return true;
      };

      const result = await waiter.waitForCondition(condition, {
        initialDelay: 10,
        timeout: 1000
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should capture last error on timeout', async () => {
      const condition = () => {
        throw new Error('Persistent error');
      };

      const result = await waiter.waitForCondition(condition, {
        initialDelay: 10,
        timeout: 100
      });

      expect(result.success).toBe(false);
      expect(result.lastError?.message).toBe('Persistent error');
    });
  });

  describe('Custom Interval Functions', () => {
    it('should use custom interval function', async () => {
      let attempts = 0;
      const delays: number[] = [];
      let lastTime = Date.now();

      const condition = () => {
        const now = Date.now();
        if (attempts > 0) {
          delays.push(now - lastTime);
        }
        lastTime = now;
        attempts++;
        return attempts >= 4;
      };

      const customInterval = (attempt: number, baseDelay: number) => {
        return baseDelay + (attempt * 10); // Linear increase by 10ms per attempt
      };

      await waiter.waitForCondition(condition, {
        initialDelay: 50,
        timeout: 2000,
        intervalFunction: customInterval
      });

      // Custom function: 50, 60, 70, ...
      expect(delays[0]).toBeGreaterThanOrEqual(45);
      expect(delays[1]).toBeGreaterThanOrEqual(55);
      expect(delays[2]).toBeGreaterThanOrEqual(65);
    });
  });

  describe('Delay Function', () => {
    it('should delay for specified time', async () => {
      const startTime = Date.now();
      await waiter.delay(100);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow 10ms tolerance
      expect(elapsed).toBeLessThan(150);
    });

    it('should apply jitter to delay', async () => {
      const delays: number[] = [];

      // Test multiple delays with jitter
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await waiter.delay(100, 0.2); // 20% jitter
        delays.push(Date.now() - startTime);
      }

      // With jitter, delays should vary
      const uniqueRoundedDelays = new Set(delays.map(d => Math.round(d / 5) * 5));
      expect(uniqueRoundedDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Performance and Timing', () => {
    it('should complete fast operations quickly', async () => {
      const startTime = Date.now();

      const result = await waiter.waitForCondition(() => true, {
        initialDelay: 1,
        timeout: 1000
      });

      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(50); // Should be very fast
    });

    it('should handle high-frequency condition checking', async () => {
      let counter = 0;
      const condition = () => {
        counter++;
        return counter >= 100;
      };

      const startTime = Date.now();
      const result = await waiter.waitForCondition(condition, {
        initialDelay: 1,
        maxDelay: 5,
        timeout: 5000
      });
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(100);
      expect(elapsed).toBeLessThan(2000); // Should complete reasonably fast
    });
  });
});