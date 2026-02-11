#!/usr/bin/env node

/**
 * E2E Test Runner for Gadugi Agentic Test Framework
 * 
 * This runner executes comprehensive end-to-end tests using AI agents
 * to validate the framework's own functionality. It tests:
 * 
 * 1. TUIAgent session management and PATH inheritance
 * 2. ScenarioAdapter defensive checks and YAML parsing
 * 3. TestOrchestrator multi-agent coordination
 * 4. CLIAgent interactive session handling
 * 5. TUI color parsing and output validation
 * 
 * Usage: node e2e-test-runner.js [scenario-name]
 */

import { TestOrchestrator } from './dist/orchestrator/TestOrchestrator';
import { ScenarioLoader } from './dist/scenarios';
import { logger } from './dist/utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';
import chalk from 'chalk';

interface TestRunnerConfig {
  scenariosDir: string;
  outputDir: string;
  parallel: boolean;
  failFast: boolean;
  verbose: boolean;
}

interface TestReport {
  timestamp: Date;
  totalScenarios: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  scenarios: ScenarioResult[];
}

interface ScenarioResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  duration: number;
  steps: number;
  failureReason?: string;
}

class E2ETestRunner {
  private config: TestRunnerConfig;
  private report: TestReport;

  constructor(config: Partial<TestRunnerConfig> = {}) {
    this.config = {
      scenariosDir: config.scenariosDir || './scenarios',
      outputDir: config.outputDir || './test-results',
      parallel: config.parallel ?? false,
      failFast: config.failFast ?? false,
      verbose: config.verbose ?? true,
    };

    this.report = {
      timestamp: new Date(),
      totalScenarios: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      scenarios: [],
    };
  }

  /**
   * Main test execution method
   */
  async run(scenarioFilter?: string): Promise<void> {
    console.log(chalk.blue('╔════════════════════════════════════════════════════╗'));
    console.log(chalk.blue('║') + chalk.bold('  Gadugi E2E Test Runner                        ') + chalk.blue('║'));
    console.log(chalk.blue('╚════════════════════════════════════════════════════╝'));
    console.log();

    const startTime = Date.now();

    try {
      // Load test scenarios
      const scenarios = await this.loadTestScenarios(scenarioFilter);
      this.report.totalScenarios = scenarios.length;

      if (scenarios.length === 0) {
        console.log(chalk.yellow('⚠ No test scenarios found'));
        return;
      }

      console.log(chalk.blue(`📋 Loaded ${scenarios.length} test scenario(s)`));
      console.log();

      // Create orchestrator
      const orchestrator = this.createOrchestrator();

      // Execute scenarios
      if (this.config.parallel) {
        await this.runParallel(orchestrator, scenarios);
      } else {
        await this.runSequential(orchestrator, scenarios);
      }

      // Calculate duration
      this.report.duration = Date.now() - startTime;

      // Generate report
      await this.generateReport();

      // Display summary
      this.displaySummary();

      // Exit with appropriate code
      process.exit(this.report.failed > 0 ? 1 : 0);

    } catch (error: any) {
      console.error(chalk.red('✗ Fatal error during test execution:'));
      console.error(chalk.red(error.message));
      console.error(error.stack);
      process.exit(1);
    }
  }

  /**
   * Load test scenarios with optional filtering
   */
  private async loadTestScenarios(filter?: string): Promise<any[]> {
    console.log(chalk.gray('Loading test scenarios...'));

    const e2eScenarios = [
      'e2e-tui-session-management.yaml',
      'e2e-scenario-adapter-validation.yaml',
      'e2e-orchestrator-coordination.yaml',
      'e2e-cli-interactive-sessions.yaml',
      'e2e-tui-color-parsing.yaml',
    ];

    const scenarios = [];

    for (const scenarioFile of e2eScenarios) {
      if (filter && !scenarioFile.includes(filter)) {
        continue;
      }

      const scenarioPath = path.join(this.config.scenariosDir, scenarioFile);

      try {
        await fs.access(scenarioPath);
        const scenario = await ScenarioLoader.loadFromFile(scenarioPath);
        scenarios.push(scenario);
        console.log(chalk.gray(`  ✓ Loaded: ${scenario.name}`));
      } catch (error: any) {
        console.log(chalk.yellow(`  ⚠ Skipped: ${scenarioFile} (${error.message})`));
      }
    }

    return scenarios;
  }

  /**
   * Create and configure test orchestrator
   */
  private createOrchestrator(): TestOrchestrator {
    const config = {
      execution: {
        maxParallel: this.config.parallel ? 3 : 1,
        retryAttempts: 1,
        failFast: this.config.failFast,
        timeout: 300000, // 5 minutes per scenario
      },
      cli: {
        timeout: 30000,
        workingDirectory: process.cwd(),
      },
      tui: {
        defaultTimeout: 30000,
        terminalType: 'xterm-256color',
        terminalSize: { cols: 80, rows: 24 },
      },
      github: {
        token: process.env.GITHUB_TOKEN || '',
        owner: '',
        repository: '',
        baseBranch: 'main',
        createIssuesOnFailure: false,
      },
      logging: {
        level: this.config.verbose ? 'debug' : 'info',
        outputFile: path.join(this.config.outputDir, 'test-execution.log'),
      },
    };

    return new TestOrchestrator(config);
  }

  /**
   * Run scenarios sequentially
   */
  private async runSequential(orchestrator: TestOrchestrator, scenarios: any[]): Promise<void> {
    console.log(chalk.blue('🚀 Executing scenarios sequentially...\n'));

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      console.log(chalk.cyan(`[${i + 1}/${scenarios.length}] Running: ${scenario.name}`));

      const result = await this.executeScenario(orchestrator, scenario);
      this.report.scenarios.push(result);

      if (result.status === 'PASSED') {
        this.report.passed++;
        console.log(chalk.green(`✓ PASSED (${result.duration}ms)\n`));
      } else if (result.status === 'FAILED') {
        this.report.failed++;
        console.log(chalk.red(`✗ FAILED (${result.duration}ms)`));
        console.log(chalk.red(`  Reason: ${result.failureReason}\n`));

        if (this.config.failFast) {
          console.log(chalk.yellow('⚠ Fail-fast enabled, stopping execution'));
          break;
        }
      } else {
        this.report.skipped++;
        console.log(chalk.yellow(`⊘ SKIPPED\n`));
      }
    }
  }

  /**
   * Run scenarios in parallel
   */
  private async runParallel(orchestrator: TestOrchestrator, scenarios: any[]): Promise<void> {
    console.log(chalk.blue('🚀 Executing scenarios in parallel...\n'));

    const promises = scenarios.map(scenario => this.executeScenario(orchestrator, scenario));
    const results = await Promise.all(promises);

    results.forEach(result => {
      this.report.scenarios.push(result);
      if (result.status === 'PASSED') this.report.passed++;
      else if (result.status === 'FAILED') this.report.failed++;
      else this.report.skipped++;
    });
  }

  /**
   * Execute a single scenario
   */
  private async executeScenario(orchestrator: TestOrchestrator, scenario: any): Promise<ScenarioResult> {
    const startTime = Date.now();

    try {
      const session = await orchestrator.runWithScenarios([scenario]);
      const duration = Date.now() - startTime;

      const testResult = session.results[0];
      const passedSteps = testResult.steps.filter(s => s.status === 'PASSED').length;
      const totalSteps = testResult.steps.length;

      return {
        name: scenario.name,
        status: testResult.status === 'PASSED' ? 'PASSED' : 'FAILED',
        duration,
        steps: totalSteps,
        failureReason: testResult.status === 'FAILED' 
          ? `${totalSteps - passedSteps}/${totalSteps} steps failed`
          : undefined,
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        name: scenario.name,
        status: 'FAILED',
        duration,
        steps: 0,
        failureReason: error.message,
      };
    }
  }

  /**
   * Generate detailed test report
   */
  private async generateReport(): Promise<void> {
    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });

      const reportPath = path.join(this.config.outputDir, 'e2e-test-report.json');
      await fs.writeFile(reportPath, JSON.stringify(this.report, null, 2));

      console.log(chalk.gray(`\n📊 Report saved to: ${reportPath}`));

    } catch (error: any) {
      console.error(chalk.red('Failed to generate report:'), error.message);
    }
  }

  /**
   * Display test summary
   */
  private displaySummary(): void {
    console.log();
    console.log(chalk.blue('═══════════════════════════════════════════════════'));
    console.log(chalk.bold('  Test Execution Summary'));
    console.log(chalk.blue('═══════════════════════════════════════════════════'));
    console.log();
    console.log(`  Total Scenarios: ${this.report.totalScenarios}`);
    console.log(chalk.green(`  ✓ Passed:        ${this.report.passed}`));
    console.log(chalk.red(`  ✗ Failed:        ${this.report.failed}`));
    console.log(chalk.yellow(`  ⊘ Skipped:       ${this.report.skipped}`));
    console.log();
    console.log(`  Duration:        ${(this.report.duration / 1000).toFixed(2)}s`);
    console.log();

    if (this.report.failed > 0) {
      console.log(chalk.red.bold('  ❌ TEST RUN FAILED'));
      console.log();
      console.log(chalk.yellow('  Failed Scenarios:'));
      this.report.scenarios
        .filter(s => s.status === 'FAILED')
        .forEach(s => {
          console.log(chalk.red(`    • ${s.name}`));
          console.log(chalk.gray(`      ${s.failureReason}`));
        });
    } else {
      console.log(chalk.green.bold('  ✅ ALL TESTS PASSED'));
    }

    console.log();
    console.log(chalk.blue('═══════════════════════════════════════════════════'));
    console.log();
  }
}

// Main execution
const args = process.argv.slice(2);
const scenarioFilter = args[0];

const runner = new E2ETestRunner({
  scenariosDir: './scenarios',
  outputDir: './test-results/e2e',
  parallel: args.includes('--parallel'),
  failFast: args.includes('--fail-fast'),
  verbose: !args.includes('--quiet'),
});

runner.run(scenarioFilter).catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
