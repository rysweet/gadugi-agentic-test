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
export declare enum BackoffStrategy {
    LINEAR = "linear",
    EXPONENTIAL = "exponential",
    FIBONACCI = "fibonacci",
    QUADRATIC = "quadratic"
}
export declare class AdaptiveWaiter {
    private static instance;
    /**
     * Get singleton instance
     */
    static getInstance(): AdaptiveWaiter;
    /**
     * Wait for a condition to be true with exponential backoff and jitter
     */
    waitForCondition<T = any>(condition: WaitCondition<T>, options?: WaitOptions): Promise<WaitResult<T>>;
    /**
     * Wait for terminal output to contain specific text or pattern
     */
    waitForOutput(outputProvider: () => string, expectedOutput: string | RegExp, options?: WaitOptions): Promise<WaitResult<string>>;
    /**
     * Wait for terminal to be ready (detecting shell prompt)
     */
    waitForTerminalReady(outputProvider: () => string, promptPattern?: RegExp, options?: WaitOptions): Promise<WaitResult<string>>;
    /**
     * Wait for process to start (PID available)
     */
    waitForProcessStart(processProvider: () => number | null | undefined, options?: WaitOptions): Promise<WaitResult<number>>;
    /**
     * Wait for process to exit
     */
    waitForProcessExit(processProvider: () => boolean, options?: WaitOptions): Promise<WaitResult<boolean>>;
    /**
     * Advanced backoff with different strategies
     */
    waitWithStrategy(condition: WaitCondition, strategy: BackoffStrategy, options?: WaitOptions): Promise<WaitResult>;
    /**
     * Retry an async operation with exponential backoff
     */
    retryOperation<T>(operation: () => Promise<T>, options?: WaitOptions): Promise<WaitResult<T>>;
    /**
     * Wait for file to exist or be modified
     */
    waitForFile(fileChecker: () => boolean | Promise<boolean>, options?: WaitOptions): Promise<WaitResult<boolean>>;
    /**
     * Batch wait for multiple conditions (all must be true)
     */
    waitForAll(conditions: WaitCondition[], options?: WaitOptions): Promise<WaitResult<any[]>>;
    /**
     * Race wait for multiple conditions (any can be true)
     */
    waitForAny(conditions: WaitCondition[], options?: WaitOptions): Promise<WaitResult<any>>;
    /**
     * Simple delay with jitter
     */
    delay(ms: number, jitter?: number): Promise<void>;
    /**
     * Calculate next backoff delay with jitter
     */
    private calculateBackoffDelay;
    /**
     * Get interval function for different backoff strategies
     */
    private getStrategyFunction;
    /**
     * Calculate fibonacci number for fibonacci backoff
     */
    private fibonacci;
}
export declare const adaptiveWaiter: AdaptiveWaiter;
export declare const waitFor: <T = any>(condition: WaitCondition<T>, options?: WaitOptions) => Promise<WaitResult<T>>;
export declare const waitForOutput: (outputProvider: () => string, expectedOutput: string | RegExp, options?: WaitOptions) => Promise<WaitResult<string>>;
export declare const waitForTerminalReady: (outputProvider: () => string, promptPattern?: RegExp, options?: WaitOptions) => Promise<WaitResult<string>>;
export declare const waitForProcessStart: (processProvider: () => number | null | undefined, options?: WaitOptions) => Promise<WaitResult<number>>;
export declare const waitForProcessExit: (processProvider: () => boolean, options?: WaitOptions) => Promise<WaitResult<boolean>>;
export declare const retryOperation: <T>(operation: () => Promise<T>, options?: WaitOptions) => Promise<WaitResult<T>>;
export declare const delay: (ms: number, jitter?: number) => Promise<void>;
//# sourceMappingURL=AdaptiveWaiter.d.ts.map