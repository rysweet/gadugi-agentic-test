"use strict";
/**
 * Retry logic utilities with exponential backoff and circuit breaker patterns
 * Provides robust retry mechanisms for test operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryWithCircuitBreaker = exports.CircuitBreaker = exports.RetryManager = exports.CircuitBreakerState = exports.RetryStrategy = void 0;
exports.retryWithBackoff = retryWithBackoff;
exports.retryWithFixedDelay = retryWithFixedDelay;
exports.retryOnSpecificErrors = retryOnSpecificErrors;
exports.createCircuitBreaker = createCircuitBreaker;
exports.createTestRetry = createTestRetry;
/**
 * Retry strategy enumeration
 */
var RetryStrategy;
(function (RetryStrategy) {
    /** Fixed delay between retries */
    RetryStrategy["FIXED"] = "fixed";
    /** Exponential backoff with jitter */
    RetryStrategy["EXPONENTIAL"] = "exponential";
    /** Linear increase in delay */
    RetryStrategy["LINEAR"] = "linear";
    /** Custom delay function */
    RetryStrategy["CUSTOM"] = "custom";
})(RetryStrategy || (exports.RetryStrategy = RetryStrategy = {}));
/**
 * Circuit breaker state enumeration
 */
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "closed";
    CircuitBreakerState["OPEN"] = "open";
    CircuitBreakerState["HALF_OPEN"] = "half_open";
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    strategy: RetryStrategy.EXPONENTIAL,
    backoffMultiplier: 2,
    jitter: 0.1,
    shouldRetry: (error) => true, // Retry all errors by default
    attemptTimeout: 30000
};
/**
 * Retry utility class
 */
class RetryManager {
    constructor(options = {}) {
        this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
    }
    /**
     * Execute a function with retry logic
     */
    async execute(fn) {
        const result = await this.executeWithDetails(fn);
        if (result.success && result.result !== undefined) {
            return result.result;
        }
        throw result.error || new Error('Operation failed after all retry attempts');
    }
    /**
     * Execute a function with detailed retry information
     */
    async executeWithDetails(fn) {
        const attemptDetails = [];
        const startTime = Date.now();
        let lastError;
        for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
            const attemptStart = new Date();
            const delay = attempt === 1 ? 0 : this.calculateDelay(attempt - 1);
            // Apply delay before attempt (except for first attempt)
            if (delay > 0) {
                await this.sleep(delay);
            }
            try {
                // Execute with timeout if specified
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
            }
            catch (error) {
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
                // Check if we should retry this error
                const shouldRetry = this.options.shouldRetry?.(lastError, attempt) ?? true;
                if (attempt < this.options.maxAttempts && shouldRetry) {
                    this.options.onRetry?.(lastError, attempt, this.calculateDelay(attempt));
                }
            }
        }
        // All attempts failed
        this.options.onFailure?.(lastError, this.options.maxAttempts);
        return {
            error: lastError,
            attempts: this.options.maxAttempts,
            totalTime: Date.now() - startTime,
            success: false,
            attemptDetails
        };
    }
    /**
     * Calculate delay for the given attempt
     */
    calculateDelay(attempt) {
        let delay;
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
        // Apply maximum delay limit
        if (this.options.maxDelay) {
            delay = Math.min(delay, this.options.maxDelay);
        }
        // Apply jitter to avoid thundering herd
        if (this.options.jitter && this.options.jitter > 0) {
            const jitterAmount = delay * this.options.jitter;
            delay += (Math.random() - 0.5) * jitterAmount;
        }
        return Math.max(0, Math.round(delay));
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Wrap a promise with timeout
     */
    withTimeout(promise, timeoutMs) {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
            })
        ]);
    }
}
exports.RetryManager = RetryManager;
/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
    constructor(options) {
        this.state = CircuitBreakerState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = 0;
        this.metrics = {
            totalCalls: 0,
            totalFailures: 0,
            totalSuccesses: 0,
            stateChanges: 0
        };
        this.options = {
            successThreshold: 1,
            monitoringWindow: 60000,
            isFailure: () => true,
            ...options
        };
    }
    /**
     * Execute function through circuit breaker
     */
    async execute(fn) {
        this.metrics.totalCalls++;
        if (this.state === CircuitBreakerState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
                this.setState(CircuitBreakerState.HALF_OPEN);
            }
            else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Get current circuit breaker state
     */
    getState() {
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
    reset() {
        this.setState(CircuitBreakerState.CLOSED);
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = 0;
    }
    /**
     * Handle successful operation
     */
    onSuccess() {
        this.metrics.totalSuccesses++;
        this.successes++;
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            if (this.successes >= (this.options.successThreshold || 1)) {
                this.setState(CircuitBreakerState.CLOSED);
                this.failures = 0;
                this.successes = 0;
            }
        }
        else if (this.state === CircuitBreakerState.CLOSED) {
            this.failures = 0; // Reset failure count on success
        }
    }
    /**
     * Handle failed operation
     */
    onFailure(error) {
        const isFailure = this.options.isFailure?.(error) ?? true;
        if (!isFailure) {
            return; // Don't count this as a failure
        }
        this.metrics.totalFailures++;
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.state === CircuitBreakerState.CLOSED) {
            if (this.failures >= this.options.failureThreshold) {
                this.setState(CircuitBreakerState.OPEN);
            }
        }
        else if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.setState(CircuitBreakerState.OPEN);
        }
    }
    /**
     * Change circuit breaker state
     */
    setState(newState) {
        if (this.state !== newState) {
            const oldState = this.state;
            this.state = newState;
            this.metrics.stateChanges++;
            if (newState === CircuitBreakerState.OPEN) {
                this.options.onCircuitOpen?.();
            }
            else if (newState === CircuitBreakerState.CLOSED && oldState === CircuitBreakerState.OPEN) {
                this.options.onCircuitClose?.();
            }
        }
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Composite retry with circuit breaker
 */
class RetryWithCircuitBreaker {
    constructor(retryOptions, circuitBreakerOptions) {
        this.retryManager = new RetryManager(retryOptions);
        this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
    }
    /**
     * Execute function with both retry logic and circuit breaker
     */
    async execute(fn) {
        return this.circuitBreaker.execute(async () => {
            return this.retryManager.execute(fn);
        });
    }
    /**
     * Get circuit breaker state
     */
    getCircuitState() {
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
    reset() {
        this.circuitBreaker.reset();
    }
}
exports.RetryWithCircuitBreaker = RetryWithCircuitBreaker;
/**
 * Convenience functions for common retry patterns
 */
/**
 * Simple retry with exponential backoff
 */
async function retryWithBackoff(fn, options = {}) {
    const retry = new RetryManager({
        strategy: RetryStrategy.EXPONENTIAL,
        ...options
    });
    return retry.execute(fn);
}
/**
 * Fixed interval retry
 */
async function retryWithFixedDelay(fn, attempts = 3, delay = 1000) {
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
async function retryOnSpecificErrors(fn, errorTypes, options = {}) {
    const retry = new RetryManager({
        ...options,
        shouldRetry: (error) => errorTypes.some(ErrorType => error instanceof ErrorType)
    });
    return retry.execute(fn);
}
/**
 * Create a circuit breaker for a specific service
 */
function createCircuitBreaker(failureThreshold = 5, resetTimeout = 60000) {
    return new CircuitBreaker({
        failureThreshold,
        resetTimeout,
        onCircuitOpen: () => console.warn('Circuit breaker opened'),
        onCircuitClose: () => console.info('Circuit breaker closed')
    });
}
/**
 * Create retry manager with test-specific defaults
 */
function createTestRetry(options = {}) {
    return new RetryManager({
        maxAttempts: 3,
        initialDelay: 1000,
        strategy: RetryStrategy.EXPONENTIAL,
        backoffMultiplier: 1.5,
        jitter: 0.1,
        shouldRetry: (error) => {
            // Don't retry assertion errors or syntax errors
            return !error.message.includes('AssertionError') &&
                !error.message.includes('SyntaxError');
        },
        ...options
    });
}
//# sourceMappingURL=retry.js.map