/**
 * Circuit breaker implementation to prevent cascading failures
 */

import { CircuitBreakerOptions, CircuitBreakerState } from './types';
import { RetryManager } from './RetryExecutor';
import { RetryOptions } from './types';
import { logger } from '../logger';

/**
 * Circuit breaker that wraps an operation and trips open after repeated failures.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through.
 * - OPEN: Requests rejected immediately.
 * - HALF_OPEN: One request allowed through to test recovery.
 */
export class CircuitBreaker<T> {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private options: CircuitBreakerOptions;
  private metrics: {
    totalCalls: number;
    totalFailures: number;
    totalSuccesses: number;
    stateChanges: number;
  } = {
    totalCalls: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    stateChanges: 0
  };

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      successThreshold: 1,
      monitoringWindow: 60000,
      isFailure: () => true,
      ...options
    };
  }

  /**
   * Execute function through circuit breaker.
   *
   * @throws Error('Circuit breaker is OPEN') when circuit is open and reset timeout not elapsed.
   */
  async execute(fn: () => Promise<T>): Promise<T> {
    this.metrics.totalCalls++;

    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.setState(CircuitBreakerState.HALF_OPEN);
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.setState(CircuitBreakerState.CLOSED);
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }

  private onSuccess(): void {
    this.metrics.totalSuccesses++;
    this.successes++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.successes >= (this.options.successThreshold || 1)) {
        this.setState(CircuitBreakerState.CLOSED);
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      this.failures = 0;
    }
  }

  private onFailure(error: Error): void {
    const isFailure = this.options.isFailure?.(error) ?? true;

    if (!isFailure) {
      return;
    }

    this.metrics.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.CLOSED) {
      if (this.failures >= this.options.failureThreshold) {
        this.setState(CircuitBreakerState.OPEN);
      }
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.setState(CircuitBreakerState.OPEN);
    }
  }

  private setState(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.metrics.stateChanges++;

      if (newState === CircuitBreakerState.OPEN) {
        this.options.onCircuitOpen?.();
      } else if (newState === CircuitBreakerState.CLOSED && oldState === CircuitBreakerState.OPEN) {
        this.options.onCircuitClose?.();
      }
    }
  }
}

/**
 * Composite class combining retry logic with circuit breaker protection.
 */
export class RetryWithCircuitBreaker<T> {
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker<T>;

  constructor(retryOptions: Partial<RetryOptions>, circuitBreakerOptions: CircuitBreakerOptions) {
    this.retryManager = new RetryManager(retryOptions);
    this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
  }

  /**
   * Execute function with both retry logic and circuit breaker
   */
  async execute(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return this.retryManager.execute(fn);
    });
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  /**
   * Get metrics from both components
   */
  getMetrics() {
    return {
      circuitBreaker: this.circuitBreaker.getMetrics()
    };
  }

  /**
   * Reset both retry and circuit breaker state
   */
  reset(): void {
    this.circuitBreaker.reset();
  }
}

/**
 * Create a circuit breaker for a specific service
 */
export function createCircuitBreaker<T>(
  failureThreshold: number = 5,
  resetTimeout: number = 60000
): CircuitBreaker<T> {
  return new CircuitBreaker({
    failureThreshold,
    resetTimeout,
    onCircuitOpen: () => logger.warn('Circuit breaker opened'),
    onCircuitClose: () => logger.info('Circuit breaker closed')
  });
}
