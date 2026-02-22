/**
 * Run command handler - executes test scenarios.
 */

import { Command } from 'commander';
import { ScenarioLoader } from '../../scenarios';
import { logger, ConfigManager } from '../../utils';
import * as path from 'path';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import { createDefaultConfig } from '../../lib';
import {
  logSuccess,
  logError,
  logWarning,
  logInfo,
  createProgressBar,
  CLIError,
  handleCommandError,
} from '../output';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run test scenarios')
    .option('-s, --scenario <name>', 'Run specific scenario by name')
    .option('-d, --directory <path>', 'Scenarios directory', './scenarios')
    .option('-c, --config <file>', 'Configuration file')
    .option('--parallel', 'Run scenarios in parallel')
    .option('--timeout <ms>', 'Global timeout in milliseconds', '300000')
    .action(async (options) => {
      try {
        logger.info('Starting Agentic Testing System');

        let config = null;

        // Load configuration if provided
        if (options.config) {
          try {
            const configManager = new ConfigManager();
            await configManager.loadFromFile(options.config);
            config = configManager.getConfig();
            logSuccess(`Configuration loaded from: ${options.config}`);
          } catch (error: any) {
            throw new CLIError(`Failed to load configuration: ${error.message}`, 'CONFIG_ERROR');
          }
        } else {
          // Try loading default config files
          const defaultConfigs = [
            'agentic-test.config.yaml',
            'agentic-test.config.yml',
            'agentic-test.config.json',
            '.agentic-testrc.yaml',
            '.agentic-testrc.yml',
            '.agentic-testrc.json',
          ];

          for (const configFile of defaultConfigs) {
            try {
              await fs.access(configFile);
              const configManager = new ConfigManager();
              await configManager.loadFromFile(configFile);
              config = configManager.getConfig();
              logInfo(`Default configuration loaded from: ${configFile}`);
              break;
            } catch {
              // Continue to next file
            }
          }
        }

        // Validate scenario directory exists
        try {
          await fs.access(options.directory);
        } catch {
          throw new CLIError(
            `Scenarios directory not found: ${options.directory}`,
            'DIRECTORY_NOT_FOUND'
          );
        }

        let scenarios;
        const progressBar = createProgressBar(1, 'Loading scenarios');
        progressBar.start(1, 0);

        try {
          if (options.scenario) {
            // Load specific scenario
            const scenarioPath = path.join(options.directory, `${options.scenario}.yaml`);
            logInfo(`Loading scenario: ${scenarioPath}`);
            scenarios = [await ScenarioLoader.loadFromFile(scenarioPath)];
          } else {
            // Load all scenarios from directory
            logInfo(`Loading scenarios from directory: ${options.directory}`);
            scenarios = await ScenarioLoader.loadFromDirectory(options.directory);
          }
          progressBar.update(1);
          progressBar.stop();

          logSuccess(`Loaded ${scenarios.length} scenario(s)`);

          if (scenarios.length === 0) {
            logWarning('No scenarios found to execute');
            return;
          }

          // Import orchestrator
          const { TestOrchestrator } = await import('../../orchestrator');

          // Use shared default config, with CLI timeout override
          const testConfig: import('../../models/Config').TestConfig =
            config ||
            (() => {
              const defaults = createDefaultConfig();
              const timeoutMs = parseInt(options.timeout);
              defaults.execution.defaultTimeout = timeoutMs;
              defaults.execution.resourceLimits.maxExecutionTime = timeoutMs;
              defaults.cli.defaultTimeout = timeoutMs;
              defaults.ui.defaultTimeout = timeoutMs;
              defaults.tui.defaultTimeout = timeoutMs;
              return defaults;
            })();

          const orchestrator = new TestOrchestrator(testConfig);

          logInfo('Executing test scenarios...');
          const session = await orchestrator.runWithScenarios('test-suite', scenarios);

          // Extract results from session
          const passedCount = session.summary.passed;
          const failedCount = session.summary.failed;

          // Report results with colors
          console.log('\n' + chalk.bold('Test Execution Results:'));
          console.log(chalk.green(`✓ Passed: ${passedCount}`));
          console.log(chalk.red(`✗ Failed: ${failedCount}`));
          console.log(chalk.gray(`- Total: ${scenarios.length}`));

          if (failedCount > 0) {
            logError('Some tests failed');
            process.exit(1);
          } else {
            logSuccess('All tests passed!');
          }
        } catch (loadError) {
          progressBar.stop();
          throw loadError;
        }
      } catch (error) {
        handleCommandError(error);
      }
    });
}
