/**
 * Retry logic utilities with exponential backoff and circuit breaker patterns
 * Provides robust retry mechanisms for test operations
 */
/**
 * Retry strategy enumeration
 */
export declare enum RetryStrategy {
    /** Fixed delay between retries */
    FIXED = "fixed",
    /** Exponential backoff with jitter */
    EXPONENTIAL = "exponential",
    /** Linear increase in delay */
    LINEAR = "linear",
    /** Custom delay function */
    CUSTOM = "custom"
}
/**
 * Circuit breaker state enumeration
 */
export declare enum CircuitBreakerState {
    CLOSED = "closed",
    OPEN = "open",
    HALF_OPEN = "half_open"
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
 * Retry utility class
 */
export declare class RetryManager {
    private options;
    constructor(options?: Partial<RetryOptions>);
    /**
     * Execute a function with retry logic
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Execute a function with detailed retry information
     */
    executeWithDetails<T>(fn: () => Promise<T>): Promise<RetryResult<T>>;
    /**
     * Calculate delay for the given attempt
     */
    private calculateDelay;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Wrap a promise with timeout
     */
    private withTimeout;
}
/**
 * Circuit breaker implementation
 */
export declare class CircuitBreaker<T> {
    private state;
    private failures;
    private successes;
    private lastFailureTime;
    private options;
    private metrics;
    constructor(options: CircuitBreakerOptions);
    /**
     * Execute function through circuit breaker
     */
    execute(fn: () => Promise<T>): Promise<T>;
    /**
     * Get current circuit breaker state
     */
    getState(): CircuitBreakerState;
    /**
     * Get circuit breaker metrics
     */
    getMetrics(): {
        totalCalls: number;
        totalFailures: number;
        totalSuccesses: number;
        stateChanges: number;
    };
    /**
     * Reset circuit breaker to closed state
     */
    reset(): void;
    /**
     * Handle successful operation
     */
    private onSuccess;
    /**
     * Handle failed operation
     */
    private onFailure;
    /**
     * Change circuit breaker state
     */
    private setState;
}
/**
 * Composite retry with circuit breaker
 */
export declare class RetryWithCircuitBreaker<T> {
    private retryManager;
    private circuitBreaker;
    constructor(retryOptions: Partial<RetryOptions>, circuitBreakerOptions: CircuitBreakerOptions);
    /**
     * Execute function with both retry logic and circuit breaker
     */
    execute(fn: () => Promise<T>): Promise<T>;
    /**
     * Get circuit breaker state
     */
    getCircuitState(): CircuitBreakerState;
    /**
     * Get metrics from both components
     */
    getMetrics(): {
        circuitBreaker: {
            totalCalls: number;
            totalFailures: number;
            totalSuccesses: number;
            stateChanges: number;
        };
    };
    /**
     * Reset both retry and circuit breaker state
     */
    reset(): void;
}
/**
 * Convenience functions for common retry patterns
 */
/**
 * Simple retry with exponential backoff
 */
export declare function retryWithBackoff<T>(fn: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T>;
/**
 * Fixed interval retry
 */
export declare function retryWithFixedDelay<T>(fn: () => Promise<T>, attempts?: number, delay?: number): Promise<T>;
/**
 * Retry only specific error types
 */
export declare function retryOnSpecificErrors<T>(fn: () => Promise<T>, errorTypes: (new (...args: any[]) => Error)[], options?: Partial<RetryOptions>): Promise<T>;
/**
 * Create a circuit breaker for a specific service
 */
export declare function createCircuitBreaker<T>(failureThreshold?: number, resetTimeout?: number): CircuitBreaker<T>;
/**
 * Create retry manager with test-specific defaults
 */
export declare function createTestRetry(options?: Partial<RetryOptions>): RetryManager;
//# sourceMappingURL=retry.d.ts.map