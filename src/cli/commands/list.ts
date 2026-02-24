/**
 * List command handler - lists available test scenarios with enhanced formatting.
 */

import { Command } from 'commander';
import { ScenarioLoader } from '../../scenarios';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import {
  logWarning,
  CLIError,
  handleCommandError,
} from '../output';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List available scenarios with enhanced formatting')
    .option('-d, --directory <path>', 'Scenarios directory', './scenarios')
    .option('--json', 'Output as JSON')
    .option('--filter <tag>', 'Filter by tag')
    .action(async (options) => {
      try {
        // Validate directory exists
        try {
          await fs.access(options.directory);
        } catch {
          throw new CLIError(
            `Directory not found: ${options.directory}`,
            'DIRECTORY_NOT_FOUND'
          );
        }

        const scenarios = await ScenarioLoader.loadFromDirectory(options.directory);

        if (scenarios.length === 0) {
          logWarning('No scenarios found');
          return;
        }

        // Filter by tag if specified
        let filteredScenarios = scenarios;
        if (options.filter) {
          filteredScenarios = scenarios.filter(
            (scenario) => scenario.metadata?.tags?.includes(options.filter) || false
          );

          if (filteredScenarios.length === 0) {
            logWarning(`No scenarios found with tag: ${options.filter}`);
            return;
          }
        }

        if (options.json) {
          console.log(
            JSON.stringify(
              filteredScenarios.map((scenario) => ({
                name: scenario.name,
                description: scenario.description,
                tags: scenario.metadata?.tags || [],
              })),
              null,
              2
            )
          );
        } else {
          console.log(`\n${  chalk.bold('Available Scenarios:')}`);
          if (options.filter) {
            console.log(chalk.gray(`Filtered by tag: ${options.filter}`));
          }
          console.log();

          filteredScenarios.forEach((scenario, index) => {
            const statusIcon = chalk.green('●'); // Always enabled for now

            console.log(`${statusIcon} ${chalk.bold(`${index + 1}. ${scenario.name}`)}`);

            if (scenario.description) {
              console.log(`   ${chalk.gray('Description:')} ${scenario.description}`);
            }

            if (scenario.metadata?.tags && scenario.metadata.tags.length > 0) {
              const tagStr = scenario.metadata.tags
                .map((tag) => chalk.cyan(`#${tag}`))
                .join(' ');
              console.log(`   ${chalk.gray('Tags:')} ${tagStr}`);
            }

            console.log();
          });

          // Summary
          console.log(chalk.bold('Summary:'));
          console.log(`${chalk.green('●')} Scenarios: ${filteredScenarios.length}`);
        }
      } catch (error) {
        handleCommandError(error);
      }
    });
}
