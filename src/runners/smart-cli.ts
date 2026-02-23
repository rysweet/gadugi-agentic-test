#!/usr/bin/env node
/**
 * smart-cli.ts
 *
 * CLI entry point for the Smart UI Test Runner.
 * Exposed as the `gadugi-smart-test` binary in package.json.
 *
 * Usage:
 *   gadugi-smart-test [--screenshots-dir <path>]
 */

import { Command } from 'commander';
import { runSmartUITests } from './SmartUITestRunner';
import { TestStatus } from '../models/TestModels';

const program = new Command();

program
  .name('gadugi-smart-test')
  .description('Smart UI testing agent — discovers and exercises Electron app tabs automatically')
  .option('--screenshots-dir <path>', 'directory for captured screenshots', 'screenshots')
  .action(async (options: { screenshotsDir: string }) => {
    try {
      const result = await runSmartUITests(options.screenshotsDir);
      process.exitCode = result.status === TestStatus.PASSED ? 0 : 1;
    } catch (err) {
      process.stderr.write(`Smart UI test failed: ${(err as Error).message}\n`);
      process.exitCode = 1;
    }
  });

// Only execute when invoked as a CLI binary, not when required as a module.
if (require.main === module) {
  program.parseAsync(process.argv).catch((err: Error) => {
    process.stderr.write(`Unexpected error: ${err.message}\n`);
    process.exit(1);
  });
}
