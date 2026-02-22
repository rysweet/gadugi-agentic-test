/**
 * Retry and circuit breaker type definitions
 */

/**
 * Retry strategy enumeration
 */
export enum RetryStrategy {
  /** Fixed delay between retries */
  FIXED = 'fixed',
  /** Exponential backoff with jitter */
  EXPONENTIAL = 'exponential',
  /** Linear increase in delay */
  LINEAR = 'linear',
  /** Custom delay function */
  CUSTOM = 'custom'
}

/**
 * Circuit breaker state enumeration
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Retry strategy to use */
  strategy: RetryStrategy;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Jitter factor (0-1) for adding randomness to delays */
  jitter?: number;
  /** Custom delay function for CUSTOM strategy */
  delayFunction?: (attempt: number) => number;
  /** Function to determine if error should trigger retry */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Timeout for each individual attempt in milliseconds */
  attemptTimeout?: number;
  /** Callback for retry attempts */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  /** Callback for final failure */
  onFailure?: (error: Error, totalAttempts: number) => void;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /** Failure threshold to open circuit */
  failureThreshold: number;
  /** Reset timeout in milliseconds */
  resetTimeout: number;
  /** Success threshold to close circuit from half-open */
  successThreshold?: number;
  /** Monitoring window in milliseconds */
  monitoringWindow?: number;
  /** Function to determine if error counts as failure */
  isFailure?: (error: Error) => boolean;
  /** Callback when circuit opens */
  onCircuitOpen?: () => void;
  /** Callback when circuit closes */
  onCircuitClose?: () => void;
}

/**
 * Retry result interface
 */
export interface RetryResult<T> {
  /** Final result if successful */
  result?: T;
  /** Final error if all retries failed */
  error?: Error;
  /** Total number of attempts made */
  attempts: number;
  /** Total time taken in milliseconds */
  totalTime: number;
  /** Whether operation succeeded */
  success: boolean;
  /** Details of each attempt */
  attemptDetails: AttemptDetail[];
}

/**
 * Individual attempt details
 */
export interface AttemptDetail {
  /** Attempt number (1-indexed) */
  attempt: number;
  /** Start timestamp */
  startTime: Date;
  /** End timestamp */
  endTime: Date;
  /** Duration in milliseconds */
  duration: number;
  /** Error if attempt failed */
  error?: Error;
  /** Whether attempt succeeded */
  success: boolean;
  /** Delay before this attempt */
  delay: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  strategy: RetryStrategy.EXPONENTIAL,
  backoffMultiplier: 2,
  jitter: 0.1,
  shouldRetry: (_error: Error) => true,
  attemptTimeout: 30000
};
