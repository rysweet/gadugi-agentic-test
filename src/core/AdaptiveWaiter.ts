/**
 * AdaptiveWaiter - Intelligent waiting strategies to replace hard-coded delays
 *
 * This class addresses the 15-20% CI failure rate caused by hard-coded timeouts
 * that don't account for varying system performance. It provides:
 *
 * - Exponential backoff with jitter
 * - Condition-based waiting with smart intervals
 * - Adaptive timeout management
 * - Integration with terminal output detection
 */

export interface WaitCondition<T = any> {
  (): T | false | Promise<T | false>;
}

export interface WaitOptions {
  /** Initial delay in ms (default: 10) */
  initialDelay?: number;
  /** Maximum delay between attempts in ms (default: 2000) */
  maxDelay?: number;
  /** Maximum total wait time in ms (default: 30000) */
  timeout?: number;
  /** Backoff multiplier (default: 1.5) */
  backoffMultiplier?: number;
  /** Jitter factor 0-1 (default: 0.1 for 10% jitter) */
  jitter?: number;
  /** Custom interval function for advanced strategies */
  intervalFunction?: (attempt: number, baseDelay: number) => number;
}

export interface WaitResult<T = any> {
  success: boolean;
  attempts: number;
  totalWaitTime: number;
  lastError?: Error;
  result?: T;
}

/**
 * Exponential backoff strategies
 */
export enum BackoffStrategy {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  FIBONACCI = 'fibonacci',
  QUADRATIC = 'quadratic'
}

export class AdaptiveWaiter {
  private static instance: AdaptiveWaiter;

  /**
   * Get singleton instance
   */
  public static getInstance(): AdaptiveWaiter {
    if (!AdaptiveWaiter.instance) {
      AdaptiveWaiter.instance = new AdaptiveWaiter();
    }
    return AdaptiveWaiter.instance;
  }

  /**
   * Wait for a condition to be true with exponential backoff and jitter
   */
  public async waitForCondition<T = any>(
    condition: WaitCondition<T>,
    options: WaitOptions = {}
  ): Promise<WaitResult<T>> {
    const {
      initialDelay = 10,
      maxDelay = 2000,
      timeout = 30000,
      backoffMultiplier = 1.5,
      jitter = 0.1,
      intervalFunction
    } = options;

    const startTime = Date.now();
    let attempts = 0;
    let currentDelay = initialDelay;
    let lastError: Error | undefined;

    while (Date.now() - startTime < timeout) {
      attempts++;

      try {
        const result = await condition();
        if (result !== false) {
          return {
            success: true,
            attempts,
            totalWaitTime: Date.now() - startTime,
            result: result as T
          };
        }
      } catch (error) {
        lastError = error as Error;
      }

      // Calculate next delay
      const nextDelay = intervalFunction
        ? intervalFunction(attempts, currentDelay)
        : this.calculateBackoffDelay(currentDelay, backoffMultiplier, maxDelay, jitter);

      await this.delay(nextDelay);
      currentDelay = nextDelay;
    }

    return {
      success: false,
      attempts,
      totalWaitTime: Date.now() - startTime,
      lastError
    };
  }

  /**
   * Wait for terminal output to contain specific text or pattern
   */
  public async waitForOutput(
    outputProvider: () => string,
    expectedOutput: string | RegExp,
    options: WaitOptions = {}
  ): Promise<WaitResult<string>> {
    return this.waitForCondition(() => {
      const output = outputProvider();
      if (expectedOutput instanceof RegExp) {
        return expectedOutput.test(output) ? output : false;
      }
      return output.includes(expectedOutput) ? output : false;
    }, options);
  }

  /**
   * Wait for terminal to be ready (detecting shell prompt)
   */
  public async waitForTerminalReady(
    outputProvider: () => string,
    promptPattern: RegExp = /\$\s*$/,
    options: WaitOptions = {}
  ): Promise<WaitResult<string>> {
    const defaultOptions = {
      initialDelay: 50,
      maxDelay: 1000,
      timeout: 10000,
      ...options
    };

    return this.waitForCondition(() => {
      const output = outputProvider();
      const lines = output.split('\n');
      const lastLine = lines[lines.length - 1] || '';
      return promptPattern.test(lastLine.trim()) ? output : false;
    }, defaultOptions);
  }

  /**
   * Wait for process to start (PID available)
   */
  public async waitForProcessStart(
    processProvider: () => number | null | undefined,
    options: WaitOptions = {}
  ): Promise<WaitResult<number>> {
    const defaultOptions = {
      initialDelay: 10,
      maxDelay: 500,
      timeout: 5000,
      ...options
    };

    return this.waitForCondition(() => {
      const pid = processProvider();
      return pid && pid > 0 ? pid : false;
    }, defaultOptions);
  }

  /**
   * Wait for process to exit
   */
  public async waitForProcessExit(
    processProvider: () => boolean,
    options: WaitOptions = {}
  ): Promise<WaitResult<boolean>> {
    const defaultOptions = {
      initialDelay: 100,
      maxDelay: 2000,
      timeout: 30000,
      ...options
    };

    return this.waitForCondition(() => {
      return !processProvider();
    }, defaultOptions);
  }

  /**
   * Advanced backoff with different strategies
   */
  public async waitWithStrategy(
    condition: WaitCondition,
    strategy: BackoffStrategy,
    options: WaitOptions = {}
  ): Promise<WaitResult> {
    const strategyFunction = this.getStrategyFunction(strategy);

    return this.waitForCondition(condition, {
      ...options,
      intervalFunction: strategyFunction
    });
  }

  /**
   * Retry an async operation with exponential backoff
   */
  public async retryOperation<T>(
    operation: () => Promise<T>,
    options: WaitOptions = {}
  ): Promise<WaitResult<T>> {
    return this.waitForCondition(async () => {
      try {
        const result = await operation();
        return result as T;
      } catch (error) {
        throw error; // Let waitForCondition handle the retry logic
      }
    }, options);
  }

  /**
   * Wait for file to exist or be modified
   */
  public async waitForFile(
    fileChecker: () => boolean | Promise<boolean>,
    options: WaitOptions = {}
  ): Promise<WaitResult<boolean>> {
    const defaultOptions = {
      initialDelay: 100,
      maxDelay: 1000,
      timeout: 10000,
      ...options
    };

    return this.waitForCondition(fileChecker, defaultOptions);
  }

  /**
   * Batch wait for multiple conditions (all must be true)
   */
  public async waitForAll(
    conditions: WaitCondition[],
    options: WaitOptions = {}
  ): Promise<WaitResult<any[]>> {
    return this.waitForCondition(async () => {
      const results = await Promise.all(
        conditions.map(async (condition) => {
          try {
            return await condition();
          } catch {
            return false;
          }
        })
      );

      return results.every(result => result !== false) ? results : false;
    }, options);
  }

  /**
   * Race wait for multiple conditions (any can be true)
   */
  public async waitForAny(
    conditions: WaitCondition[],
    options: WaitOptions = {}
  ): Promise<WaitResult<any>> {
    return this.waitForCondition(async () => {
      for (let i = 0; i < conditions.length; i++) {
        try {
          const result = await conditions[i]();
          if (result !== false) {
            return { index: i, result };
          }
        } catch {
          // Continue to next condition
        }
      }
      return false;
    }, options);
  }

  /**
   * Simple delay with jitter
   */
  public async delay(ms: number, jitter: number = 0): Promise<void> {
    const jitterMs = jitter > 0 ? ms * jitter * (Math.random() - 0.5) : 0;
    const actualDelay = Math.max(1, ms + jitterMs);

    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(), actualDelay);
      return timer;
    });
  }

  /**
   * Calculate next backoff delay with jitter
   */
  private calculateBackoffDelay(
    currentDelay: number,
    multiplier: number,
    maxDelay: number,
    jitter: number
  ): number {
    const nextDelay = Math.min(currentDelay * multiplier, maxDelay);
    const jitterAmount = jitter * nextDelay * (Math.random() - 0.5);
    return Math.max(1, nextDelay + jitterAmount);
  }

  /**
   * Get interval function for different backoff strategies
   */
  private getStrategyFunction(strategy: BackoffStrategy): (attempt: number, baseDelay: number) => number {
    switch (strategy) {
      case BackoffStrategy.LINEAR:
        return (attempt, baseDelay) => baseDelay * attempt;

      case BackoffStrategy.EXPONENTIAL:
        return (attempt, baseDelay) => baseDelay * Math.pow(2, attempt - 1);

      case BackoffStrategy.FIBONACCI:
        return (attempt, baseDelay) => {
          const fib = this.fibonacci(attempt);
          return baseDelay * fib;
        };

      case BackoffStrategy.QUADRATIC:
        return (attempt, baseDelay) => baseDelay * Math.pow(attempt, 2);

      default:
        return (attempt, baseDelay) => baseDelay * 1.5; // Default exponential
    }
  }

  /**
   * Calculate fibonacci number for fibonacci backoff
   */
  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    if (n === 2) return 1;

    let a = 1, b = 1;
    for (let i = 3; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }
}

// Export singleton instance for convenience
export const adaptiveWaiter = AdaptiveWaiter.getInstance();

// Export commonly used helper functions
export const waitFor = adaptiveWaiter.waitForCondition.bind(adaptiveWaiter);
export const waitForOutput = adaptiveWaiter.waitForOutput.bind(adaptiveWaiter);
export const waitForTerminalReady = adaptiveWaiter.waitForTerminalReady.bind(adaptiveWaiter);
export const waitForProcessStart = adaptiveWaiter.waitForProcessStart.bind(adaptiveWaiter);
export const waitForProcessExit = adaptiveWaiter.waitForProcessExit.bind(adaptiveWaiter);
export const retryOperation = adaptiveWaiter.retryOperation.bind(adaptiveWaiter);
export const delay = adaptiveWaiter.delay.bind(adaptiveWaiter);