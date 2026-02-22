/**
 * Help command handler - displays extended usage examples.
 */

import { Command } from 'commander';
import chalk from 'chalk';

export function registerHelpCommand(program: Command): void {
  program
    .command('help [command]')
    .description('Display help for a specific command')
    .action((command) => {
      if (command) {
        program.help({ error: false });
      } else {
        console.log();
        console.log(chalk.bold('Agentic Testing System - Examples:'));
        console.log();
        console.log(chalk.gray('# Run all scenarios'));
        console.log('agentic-test run');
        console.log();
        console.log(chalk.gray('# Run specific scenario'));
        console.log('agentic-test run --scenario my-test');
        console.log();
        console.log(chalk.gray('# Run with custom configuration'));
        console.log('agentic-test run --config my-config.yaml');
        console.log();
        console.log(chalk.gray('# Watch for file changes'));
        console.log('agentic-test watch --directory ./my-scenarios');
        console.log();
        console.log(chalk.gray('# Initialize new project'));
        console.log('agentic-test init --template electron --directory my-project');
        console.log();
        console.log(chalk.gray('# Validate scenarios'));
        console.log('agentic-test validate --strict');
        console.log();
        console.log(chalk.gray('# List scenarios with filtering'));
        console.log('agentic-test list --filter integration');
        console.log();
      }
    });
}
