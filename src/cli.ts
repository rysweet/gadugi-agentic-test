#!/usr/bin/env node

/**
 * Command Line Interface for the Agentic Testing System
 *
 * This file is the Commander entry point only. All command logic lives in
 * src/cli/commands/. Shared output utilities are in src/cli/output.ts.
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { logError, logInfo, logWarning } from './cli/output';
import { registerRunCommand } from './cli/commands/run';
import { registerWatchCommand } from './cli/commands/watch';
import { registerValidateCommand } from './cli/commands/validate';
import { registerListCommand } from './cli/commands/list';
import { registerInitCommand } from './cli/commands/init';
import { registerHelpCommand } from './cli/commands/help';
import { safeResolvePath, CLIPathError } from './cli-path-utils';

// Load environment variables from .env file if it exists
try {
  dotenv.config();
} catch (error) {
  // Silently ignore if .env doesn't exist
}

const program = new Command();

program
  .name('agentic-test')
  .description('TypeScript Agentic Testing System for Electron applications')
  .version('1.0.0');

// Global options
program
  .option('--verbose', 'Enable verbose logging')
  .option('--debug', 'Enable debug logging')
  .option('--no-color', 'Disable colored output')
  .option('--env <file>', 'Load environment variables from file', '.env')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();

    // Handle color option
    if (opts.noColor) {
      chalk.level = 0; // Disable colors
    }

    // Load additional .env file if specified
    if (opts.env && opts.env !== '.env') {
      try {
        // Validate the env file path to prevent traversal (issue #93)
        const safeEnvPath = safeResolvePath(opts.env);
        dotenv.config({ path: safeEnvPath });
        logInfo(`Loaded environment from: ${safeEnvPath}`);
      } catch (error) {
        if (error instanceof CLIPathError) {
          logWarning(`Rejected environment file path (path traversal attempt): ${opts.env}`);
        } else {
          logWarning(`Failed to load environment file: ${opts.env}`);
        }
      }
    }

    // Set logging level (simplified for compatibility)
    if (opts.debug) {
      console.log('Debug logging enabled');
    } else if (opts.verbose) {
      console.log('Verbose logging enabled');
    }
  });

// Register all commands
registerRunCommand(program);
registerWatchCommand(program);
registerValidateCommand(program);
registerListCommand(program);
registerInitCommand(program);
registerHelpCommand(program);

// Handle unknown commands
program
  .command('*', { hidden: true })
  .action((cmd) => {
    logError(`Unknown command: ${cmd}`);
    console.log();
    console.log('Run', chalk.cyan('agentic-test help'), 'for usage information.');
    process.exit(1);
  });

// Enhanced error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logError(`Unhandled promise rejection: ${message}`);
  process.exit(1);
});

// Parse command line arguments
if (require.main === module) {
  program.parse();
}

export default program;
