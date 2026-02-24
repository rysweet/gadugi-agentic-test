/**
 * Shared output helpers for CLI commands.
 * Provides colored console output functions used across all commands.
 */

import chalk from 'chalk';
import { SingleBar, Presets } from 'cli-progress';

export function logSuccess(message: string): void {
  console.log(chalk.green('✓'), message);
}

export function logError(message: string): void {
  console.log(chalk.red('✗'), message);
}

export function logWarning(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

export function logInfo(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

export function createProgressBar(_total: number, description: string): SingleBar {
  return new SingleBar({
    format: `${chalk.blue(description)  } |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  }, Presets.rect);
}

/**
 * Enhanced error class for CLI-specific errors with optional error codes.
 */
export class CLIError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Handle a CLIError or unknown error uniformly, logging and exiting.
 */
export function handleCommandError(error: unknown): never {
  if (error instanceof CLIError) {
    logError(error.message);
    if (error.code) {
      logInfo(`Error code: ${error.code}`);
    }
  } else {
    logError('Command failed:');
    console.error(error);
  }
  process.exit(1);
}
