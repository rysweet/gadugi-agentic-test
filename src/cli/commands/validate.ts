/**
 * Validate command handler - validates scenario YAML files with detailed error reporting.
 */

import { Command } from 'commander';
import { ScenarioLoader } from '../../scenarios';
import { createYamlParser } from '../../utils';
import * as path from 'path';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import {
  logSuccess,
  logWarning,
  logInfo,
  createProgressBar,
  CLIError,
  handleCommandError,
} from '../output';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate scenario files with detailed error reporting')
    .option('-d, --directory <path>', 'Scenarios directory', './scenarios')
    .option('-f, --file <path>', 'Single scenario file to validate')
    .option('--strict', 'Enable strict validation mode')
    .action(async (options) => {
      try {
        logInfo('Validating scenarios...');

        const parser = createYamlParser({
          strictValidation: options.strict || false,
        });

        const validationResults: Array<{ file: string; valid: boolean; errors: string[] }> = [];

        if (options.file) {
          try {
            await fs.access(options.file);
            const result = await parser.validateYamlFile(options.file);
            validationResults.push({
              file: options.file,
              valid: result.valid,
              errors: result.errors,
            });

            if (result.valid) {
              const scenario = await ScenarioLoader.loadFromFile(options.file);
              logSuccess(`Scenario "${scenario.name}" is valid`);
            }
          } catch (error: unknown) {
            validationResults.push({
              file: options.file,
              valid: false,
              errors: [error instanceof Error ? error.message : String(error)],
            });
          }
        } else {
          try {
            await fs.access(options.directory);
          } catch {
            throw new CLIError(
              `Directory not found: ${options.directory}`,
              'DIRECTORY_NOT_FOUND'
            );
          }

          // Get all YAML files in directory
          const files = await fs.readdir(options.directory);
          const yamlFiles = files.filter(
            (file) => file.endsWith('.yaml') || file.endsWith('.yml')
          );

          if (yamlFiles.length === 0) {
            logWarning('No YAML files found to validate');
            return;
          }

          const progressBar = createProgressBar(yamlFiles.length, 'Validating files');
          progressBar.start(yamlFiles.length, 0);

          for (let index = 0; index < yamlFiles.length; index++) {
            const file = yamlFiles[index];
            const filePath = path.join(options.directory, file);
            try {
              const result = await parser.validateYamlFile(filePath);
              validationResults.push({
                file: filePath,
                valid: result.valid,
                errors: result.errors,
              });

              if (result.valid) {
                await ScenarioLoader.loadFromFile(filePath); // Additional validation
              }
            } catch (error: unknown) {
              validationResults.push({
                file: filePath,
                valid: false,
                errors: [error instanceof Error ? error.message : String(error)],
              });
            }
            progressBar.update(index + 1);
          }
          progressBar.stop();
        }

        // Report validation results
        const validFiles = validationResults.filter((r) => r.valid);
        const invalidFiles = validationResults.filter((r) => !r.valid);

        console.log(`\n${  chalk.bold('Validation Results:')}`);
        console.log(chalk.green(`✓ Valid files: ${validFiles.length}`));
        console.log(chalk.red(`✗ Invalid files: ${invalidFiles.length}`));

        if (invalidFiles.length > 0) {
          console.log(`\n${  chalk.red('Validation Errors:')}`);
          invalidFiles.forEach((result) => {
            console.log(chalk.red(`\n✗ ${result.file}:`));
            result.errors.forEach((error) => {
              console.log(chalk.red(`  - ${error}`));
            });
          });
          process.exit(1);
        } else {
          logSuccess(`All ${validationResults.length} file(s) are valid`);
        }
      } catch (error) {
        handleCommandError(error);
      }
    });
}
