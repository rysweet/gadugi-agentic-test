/**
 * Watch command handler - watches for scenario file changes and re-runs tests.
 */

import { Command } from 'commander';
import { ScenarioLoader } from '../../scenarios';
import { ConfigManager } from '../../utils';
import * as fs from 'fs/promises';
import * as chokidar from 'chokidar';
import chalk from 'chalk';
import { createDefaultConfig } from '../../lib';
import {
  logSuccess,
  logError,
  logWarning,
  logInfo,
  CLIError,
  handleCommandError,
} from '../output';

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Watch for scenario file changes and run tests')
    .option('-d, --directory <path>', 'Scenarios directory to watch', './scenarios')
    .option('-c, --config <file>', 'Configuration file')
    .action(async (options) => {
      try {
        logInfo('Starting watch mode...');
        logInfo(`Watching directory: ${chalk.cyan(options.directory)}`);

        // Validate directory exists
        try {
          await fs.access(options.directory);
        } catch {
          throw new CLIError(
            `Watch directory not found: ${options.directory}`,
            'DIRECTORY_NOT_FOUND'
          );
        }

        let config = null;

        // Load configuration if provided
        if (options.config) {
          try {
            const configManager = new ConfigManager();
            await configManager.loadFromFile(options.config);
            config = configManager.getConfig();
            logSuccess(`Configuration loaded from: ${options.config}`);
          } catch (error: any) {
            throw new CLIError(
              `Failed to load configuration: ${error.message}`,
              'CONFIG_ERROR'
            );
          }
        }

        // Setup file watcher
        const watcher = chokidar.watch(options.directory, {
          ignored: /(^|[\/\\])\./, // ignore dotfiles
          persistent: true,
          ignoreInitial: true,
        });

        // Debounce mechanism to prevent multiple rapid executions
        let timeout: NodeJS.Timeout | null = null;
        const debounceTime = 1000; // 1 second

        const runTests = async (changedFile?: string) => {
          if (changedFile) {
            logInfo(`File changed: ${chalk.yellow(changedFile)}`);
          }

          try {
            logInfo('Running tests...');

            // Load and execute scenarios
            const scenarios = await ScenarioLoader.loadFromDirectory(options.directory);

            if (scenarios.length === 0) {
              logWarning('No scenarios found to execute');
              return;
            }

            // Run scenarios through the real orchestrator
            const { TestOrchestrator } = await import('../../orchestrator');

            const testConfig: import('../../models/Config').TestConfig =
              config || createDefaultConfig();

            const orchestrator = new TestOrchestrator(testConfig);
            const session = await orchestrator.runWithScenarios('watch', scenarios);
            const passedCount = session.summary.passed;
            const failedCount = session.summary.failed;

            // Report results
            console.log('\n' + chalk.bold('Watch Mode - Test Results:'));
            console.log(chalk.green(`✓ Passed: ${passedCount}`));
            console.log(chalk.red(`✗ Failed: ${failedCount}`));
            console.log(chalk.gray(`- Total: ${scenarios.length}`));
            console.log(chalk.gray(`- Time: ${new Date().toLocaleTimeString()}`));
            console.log('');

            if (failedCount > 0) {
              logWarning('Some tests failed - watching for changes...');
            } else {
              logSuccess('All tests passed - watching for changes...');
            }
          } catch (error: any) {
            logError(`Test execution failed: ${error.message}`);
            logInfo('Watching for changes...');
          }
        };

        // File change handlers
        watcher.on('change', (filePath) => {
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => runTests(filePath), debounceTime);
        });

        watcher.on('add', (filePath) => {
          logInfo(`New file added: ${chalk.green(filePath)}`);
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => runTests(filePath), debounceTime);
        });

        watcher.on('unlink', (filePath) => {
          logInfo(`File deleted: ${chalk.red(filePath)}`);
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => runTests(), debounceTime);
        });

        watcher.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logError(`Watcher error: ${errorMessage}`);
        });

        // Run initial test execution
        await runTests();

        logSuccess('Watch mode started. Press Ctrl+C to stop.');

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          logInfo('Shutting down watch mode...');
          watcher.close().then(() => {
            logSuccess('Watch mode stopped.');
            process.exit(0);
          });
        });
      } catch (error) {
        handleCommandError(error);
      }
    });
}
