/**
 * Shared output helpers for CLI commands.
 * Provides colored console output functions used across all commands.
 */
import { SingleBar } from 'cli-progress';
export declare function logSuccess(message: string): void;
export declare function logError(message: string): void;
export declare function logWarning(message: string): void;
export declare function logInfo(message: string): void;
export declare function createProgressBar(total: number, description: string): SingleBar;
/**
 * Enhanced error class for CLI-specific errors with optional error codes.
 */
export declare class CLIError extends Error {
    code?: string | undefined;
    constructor(message: string, code?: string | undefined);
}
/**
 * Handle a CLIError or unknown error uniformly, logging and exiting.
 */
export declare function handleCommandError(error: unknown): never;
//# sourceMappingURL=output.d.ts.map