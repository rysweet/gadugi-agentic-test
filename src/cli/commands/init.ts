/**
 * Init command handler - initializes a new testing project with templates and configuration.
 * Template content is in init-templates.ts to keep this file under 300 LOC.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import {
  logSuccess,
  logInfo,
  CLIError,
  handleCommandError,
} from '../output';
import {
  getConfigTemplate,
  getEnvTemplate,
  getScenarioTemplates,
  getPackageJsonTemplate,
  getReadmeTemplate,
  getGitignoreTemplate,
} from './init-templates';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new testing project with templates and configuration')
    .option('-d, --directory <path>', 'Target directory', './agentic-testing')
    .option('--force', 'Overwrite existing files')
    .option('--template <type>', 'Project template (basic, advanced, electron)', 'basic')
    .action(async (options) => {
      try {
        logInfo(`Initializing new testing project in: ${chalk.cyan(options.directory)}`);

        // Check if directory exists
        let directoryExists = false;
        try {
          await fs.access(options.directory);
          directoryExists = true;
        } catch {
          // Directory doesn't exist, we'll create it
        }

        if (directoryExists && !options.force) {
          // Check if directory is empty
          const files = await fs.readdir(options.directory);
          if (files.length > 0) {
            throw new CLIError(
              `Directory ${options.directory} is not empty. Use --force to overwrite existing files.`,
              'DIRECTORY_NOT_EMPTY'
            );
          }
        }

        // Create directory if it doesn't exist
        if (!directoryExists) {
          await fs.mkdir(options.directory, { recursive: true });
          logSuccess(`Created directory: ${options.directory}`);
        }

        // Create subdirectories
        const subdirs = ['scenarios', 'scripts', 'reports', 'screenshots', 'temp'];
        for (const subdir of subdirs) {
          const dirPath = path.join(options.directory, subdir);
          await fs.mkdir(dirPath, { recursive: true });
          logSuccess(`Created directory: ${subdir}/`);
        }

        // Create configuration file
        const configPath = path.join(options.directory, 'agentic-test.config.yaml');
        await fs.writeFile(configPath, getConfigTemplate(options.template), 'utf-8');
        logSuccess('Created configuration file: agentic-test.config.yaml');

        // Create .env template
        const envPath = path.join(options.directory, '.env.example');
        await fs.writeFile(envPath, getEnvTemplate(), 'utf-8');
        logSuccess('Created environment template: .env.example');

        // Create scenario templates
        const scenarioTemplates = getScenarioTemplates(options.template);
        for (const [filename, content] of Object.entries(scenarioTemplates)) {
          const scenarioPath = path.join(options.directory, 'scenarios', filename);
          await fs.writeFile(scenarioPath, content, 'utf-8');
          logSuccess(`Created scenario template: scenarios/${filename}`);
        }

        // Create package.json for project
        const packagePath = path.join(options.directory, 'package.json');
        await fs.writeFile(
          packagePath,
          getPackageJsonTemplate(path.basename(options.directory)),
          'utf-8'
        );
        logSuccess('Created package.json');

        // Create README.md
        const readmePath = path.join(options.directory, 'README.md');
        await fs.writeFile(readmePath, getReadmeTemplate(options.template), 'utf-8');
        logSuccess('Created README.md');

        // Create .gitignore
        const gitignorePath = path.join(options.directory, '.gitignore');
        await fs.writeFile(gitignorePath, getGitignoreTemplate(), 'utf-8');
        logSuccess('Created .gitignore');

        console.log();
        logSuccess('Project initialization completed!');
        console.log();
        console.log(chalk.bold('Next steps:'));
        console.log(chalk.gray('1.'), `cd ${options.directory}`);
        console.log(chalk.gray('2.'), 'cp .env.example .env');
        console.log(chalk.gray('3.'), 'npm install');
        console.log(chalk.gray('4.'), 'Edit scenarios in the scenarios/ directory');
        console.log(chalk.gray('5.'), 'Run tests with: agentic-test run');
        console.log();
      } catch (error) {
        handleCommandError(error);
      }
    });
}
