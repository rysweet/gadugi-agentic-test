/**
 * Core retry loop with configurable backoff strategies
 */

import {
  RetryOptions,
  RetryResult,
  AttemptDetail,
  RetryStrategy,
  DEFAULT_RETRY_OPTIONS
} from './types';

/**
 * Retry utility class providing exponential backoff, linear, fixed, and custom strategies.
 */
export class RetryManager {
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  /**
   * Execute a function with retry logic, returning the result on success.
   *
   * @throws The last error after all attempts are exhausted.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const result = await this.executeWithDetails(fn);

    if (result.success && result.result !== undefined) {
      return result.result;
    }

    throw result.error || new Error('Operation failed after all retry attempts');
  }

  /**
   * Execute a function with detailed per-attempt metadata.
   */
  async executeWithDetails<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    const attemptDetails: AttemptDetail[] = [];
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      const attemptStart = new Date();
      const delay = attempt === 1 ? 0 : this.calculateDelay(attempt - 1);

      if (delay > 0) {
        await this.sleep(delay);
      }

      try {
        const result = this.options.attemptTimeout
          ? await this.withTimeout(fn(), this.options.attemptTimeout)
          : await fn();

        const attemptEnd = new Date();
        attemptDetails.push({
          attempt,
          startTime: attemptStart,
          endTime: attemptEnd,
          duration: attemptEnd.getTime() - attemptStart.getTime(),
          success: true,
          delay
        });

        return {
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime,
          success: true,
          attemptDetails
        };
      } catch (error) {
        const attemptEnd = new Date();
        lastError = error instanceof Error ? error : new Error(String(error));

        attemptDetails.push({
          attempt,
          startTime: attemptStart,
          endTime: attemptEnd,
          duration: attemptEnd.getTime() - attemptStart.getTime(),
          error: lastError,
          success: false,
          delay
        });

        const shouldRetry = this.options.shouldRetry?.(lastError, attempt) ?? true;

        if (attempt < this.options.maxAttempts && shouldRetry) {
          this.options.onRetry?.(lastError, attempt, this.calculateDelay(attempt));
        }
      }
    }

    this.options.onFailure?.(lastError!, this.options.maxAttempts);

    return {
      error: lastError,
      attempts: this.options.maxAttempts,
      totalTime: Date.now() - startTime,
      success: false,
      attemptDetails
    };
  }

  /**
   * Calculate the delay for the given attempt number (1-based after first).
   */
  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.options.strategy) {
      case RetryStrategy.FIXED:
        delay = this.options.initialDelay;
        break;

      case RetryStrategy.EXPONENTIAL:
        delay = this.options.initialDelay * Math.pow(this.options.backoffMultiplier || 2, attempt - 1);
        break;

      case RetryStrategy.LINEAR:
        delay = this.options.initialDelay * attempt;
        break;

      case RetryStrategy.CUSTOM:
        delay = this.options.delayFunction?.(attempt) || this.options.initialDelay;
        break;

      default:
        delay = this.options.initialDelay;
    }

    if (this.options.maxDelay) {
      delay = Math.min(delay, this.options.maxDelay);
    }

    if (this.options.jitter && this.options.jitter > 0) {
      const jitterAmount = delay * this.options.jitter;
      delay += (Math.random() - 0.5) * jitterAmount;
    }

    return Math.max(0, Math.round(delay));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }
}

/**
 * Simple retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retry = new RetryManager({
    strategy: RetryStrategy.EXPONENTIAL,
    ...options
  });
  return retry.execute(fn);
}

/**
 * Fixed interval retry
 */
export async function retryWithFixedDelay<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delay: number = 1000
): Promise<T> {
  const retry = new RetryManager({
    maxAttempts: attempts,
    initialDelay: delay,
    strategy: RetryStrategy.FIXED
  });
  return retry.execute(fn);
}

/**
 * Retry only specific error types
 */
export async function retryOnSpecificErrors<T>(
  fn: () => Promise<T>,
  errorTypes: (new (...args: any[]) => Error)[],
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retry = new RetryManager({
    ...options,
    shouldRetry: (error) => errorTypes.some(ErrorType => error instanceof ErrorType)
  });
  return retry.execute(fn);
}

/**
 * Create retry manager with test-specific defaults
 */
export function createTestRetry(options: Partial<RetryOptions> = {}): RetryManager {
  return new RetryManager({
    maxAttempts: 3,
    initialDelay: 1000,
    strategy: RetryStrategy.EXPONENTIAL,
    backoffMultiplier: 1.5,
    jitter: 0.1,
    shouldRetry: (error) => {
      return !error.message.includes('AssertionError') &&
             !error.message.includes('SyntaxError');
    },
    ...options
  });
}
