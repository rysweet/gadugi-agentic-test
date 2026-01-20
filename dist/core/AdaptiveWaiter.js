"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = exports.retryOperation = exports.waitForProcessExit = exports.waitForProcessStart = exports.waitForTerminalReady = exports.waitForOutput = exports.waitFor = exports.adaptiveWaiter = exports.AdaptiveWaiter = exports.BackoffStrategy = void 0;
/**
 * Exponential backoff strategies
 */
var BackoffStrategy;
(function (BackoffStrategy) {
    BackoffStrategy["LINEAR"] = "linear";
    BackoffStrategy["EXPONENTIAL"] = "exponential";
    BackoffStrategy["FIBONACCI"] = "fibonacci";
    BackoffStrategy["QUADRATIC"] = "quadratic";
})(BackoffStrategy || (exports.BackoffStrategy = BackoffStrategy = {}));
class AdaptiveWaiter {
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!AdaptiveWaiter.instance) {
            AdaptiveWaiter.instance = new AdaptiveWaiter();
        }
        return AdaptiveWaiter.instance;
    }
    /**
     * Wait for a condition to be true with exponential backoff and jitter
     */
    async waitForCondition(condition, options = {}) {
        const { initialDelay = 10, maxDelay = 2000, timeout = 30000, backoffMultiplier = 1.5, jitter = 0.1, intervalFunction } = options;
        const startTime = Date.now();
        let attempts = 0;
        let currentDelay = initialDelay;
        let lastError;
        while (Date.now() - startTime < timeout) {
            attempts++;
            try {
                const result = await condition();
                if (result !== false) {
                    return {
                        success: true,
                        attempts,
                        totalWaitTime: Date.now() - startTime,
                        result: result
                    };
                }
            }
            catch (error) {
                lastError = error;
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
    async waitForOutput(outputProvider, expectedOutput, options = {}) {
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
    async waitForTerminalReady(outputProvider, promptPattern = /\$\s*$/, options = {}) {
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
    async waitForProcessStart(processProvider, options = {}) {
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
    async waitForProcessExit(processProvider, options = {}) {
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
    async waitWithStrategy(condition, strategy, options = {}) {
        const strategyFunction = this.getStrategyFunction(strategy);
        return this.waitForCondition(condition, {
            ...options,
            intervalFunction: strategyFunction
        });
    }
    /**
     * Retry an async operation with exponential backoff
     */
    async retryOperation(operation, options = {}) {
        return this.waitForCondition(async () => {
            try {
                const result = await operation();
                return result;
            }
            catch (error) {
                throw error; // Let waitForCondition handle the retry logic
            }
        }, options);
    }
    /**
     * Wait for file to exist or be modified
     */
    async waitForFile(fileChecker, options = {}) {
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
    async waitForAll(conditions, options = {}) {
        return this.waitForCondition(async () => {
            const results = await Promise.all(conditions.map(async (condition) => {
                try {
                    return await condition();
                }
                catch {
                    return false;
                }
            }));
            return results.every(result => result !== false) ? results : false;
        }, options);
    }
    /**
     * Race wait for multiple conditions (any can be true)
     */
    async waitForAny(conditions, options = {}) {
        return this.waitForCondition(async () => {
            for (let i = 0; i < conditions.length; i++) {
                try {
                    const result = await conditions[i]();
                    if (result !== false) {
                        return { index: i, result };
                    }
                }
                catch {
                    // Continue to next condition
                }
            }
            return false;
        }, options);
    }
    /**
     * Simple delay with jitter
     */
    async delay(ms, jitter = 0) {
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
    calculateBackoffDelay(currentDelay, multiplier, maxDelay, jitter) {
        const nextDelay = Math.min(currentDelay * multiplier, maxDelay);
        const jitterAmount = jitter * nextDelay * (Math.random() - 0.5);
        return Math.max(1, nextDelay + jitterAmount);
    }
    /**
     * Get interval function for different backoff strategies
     */
    getStrategyFunction(strategy) {
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
    fibonacci(n) {
        if (n <= 1)
            return 1;
        if (n === 2)
            return 1;
        let a = 1, b = 1;
        for (let i = 3; i <= n; i++) {
            [a, b] = [b, a + b];
        }
        return b;
    }
}
exports.AdaptiveWaiter = AdaptiveWaiter;
// Export singleton instance for convenience
exports.adaptiveWaiter = AdaptiveWaiter.getInstance();
// Export commonly used helper functions
exports.waitFor = exports.adaptiveWaiter.waitForCondition.bind(exports.adaptiveWaiter);
exports.waitForOutput = exports.adaptiveWaiter.waitForOutput.bind(exports.adaptiveWaiter);
exports.waitForTerminalReady = exports.adaptiveWaiter.waitForTerminalReady.bind(exports.adaptiveWaiter);
exports.waitForProcessStart = exports.adaptiveWaiter.waitForProcessStart.bind(exports.adaptiveWaiter);
exports.waitForProcessExit = exports.adaptiveWaiter.waitForProcessExit.bind(exports.adaptiveWaiter);
exports.retryOperation = exports.adaptiveWaiter.retryOperation.bind(exports.adaptiveWaiter);
exports.delay = exports.adaptiveWaiter.delay.bind(exports.adaptiveWaiter);
//# sourceMappingURL=AdaptiveWaiter.js.map