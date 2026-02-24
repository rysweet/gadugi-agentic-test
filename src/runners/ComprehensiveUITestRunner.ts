/**
 * Comprehensive UI Test Runner
 * Exercises all tabs and features systematically.
 *
 * Thin facade: delegates tab-interaction logic to UIFlowTester.
 */

import { ElectronApplication, _electron } from 'playwright';
import * as path from 'path';
import { promises as fs } from 'fs';
import { TestResult, TestStatus } from '../models/TestModels';
import { UIFlowTester, TestResults } from './comprehensive/UIFlowTester';

// ANSI colour codes (only used for the final summary here)
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
} as const;

/**
 * Comprehensive UI Test Runner
 *
 * Launches an Electron app and exercises every known tab using UIFlowTester.
 */
export class ComprehensiveUITestRunner {
  private electronApp: ElectronApplication | null = null;
  private page: import('playwright').Page | null = null;
  private results: TestResults;
  private screenshotsDir: string;
  private tester: UIFlowTester;

  constructor(screenshotsDir?: string) {
    this.screenshotsDir = screenshotsDir || path.join(process.cwd(), 'screenshots');
    this.results = { passed: 0, failed: 0, errors: [] };
    this.tester = new UIFlowTester(this.results, this.screenshotsDir);
  }

  /** Initialize the runner: create screenshot dir and launch Electron. */
  async initialize(): Promise<void> {
    this.tester.logSection('Azure Tenant Grapher - Comprehensive UI Testing');
    await fs.mkdir(this.screenshotsDir, { recursive: true });
    this.tester.logInfo('Launching Electron application...');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electronPath = require('electron') as string;
    const appPath = path.resolve(process.cwd(), '..');

    this.electronApp = await _electron.launch({
      executablePath: electronPath,
      args: [appPath],
      env: { ...process.env, NODE_ENV: 'test', TESTING: 'true' }
    });

    this.page = await this.electronApp.firstWindow();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Run all tab tests plus responsiveness checks. */
  async runTests(): Promise<TestResult> {
    const startTime = new Date();
    let status = TestStatus.PASSED;
    const screenshots: string[] = [];
    const logs: string[] = [];

    try {
      if (!this.page) {
        throw new Error('Page not initialized. Call initialize() first.');
      }
      const p = this.page;
      const t = this.tester;

      const addScreenshot = (p: string | null) => { if (p) screenshots.push(p); };
      addScreenshot(await t.testTab(p, 'Build',         [t.testTenantIdInput.bind(t), t.testBuildButton.bind(t)]));
      addScreenshot(await t.testTab(p, 'Generate Spec', [t.testSpecGeneration.bind(t)]));
      addScreenshot(await t.testTab(p, 'Generate IaC',  [t.testFormatSelector.bind(t)]));
      addScreenshot(await t.testTab(p, 'Create Tenant', [t.testSpecUpload.bind(t)]));
      addScreenshot(await t.testTab(p, 'Visualize',     [t.testGraphVisualization.bind(t)]));
      addScreenshot(await t.testTab(p, 'Agent Mode',    [t.testAgentInterface.bind(t)]));
      addScreenshot(await t.testTab(p, 'Threat Model',  [t.testThreatModelGeneration.bind(t)]));
      addScreenshot(await t.testTab(p, 'Config',        [t.testConfigFields.bind(t), t.testSaveConfig.bind(t)]));
      addScreenshot(await t.testTab(p, 'Status',        [t.testSystemStatus.bind(t), t.testNeo4jStatus.bind(t)]));
      addScreenshot(await t.testTab(p, 'Help',          [t.testHelpContent.bind(t)]));

      // Responsiveness tests
      t.logSection('UI Responsiveness Tests');
      await p.setViewportSize({ width: 1920, height: 1080 });
      await p.waitForTimeout(500);
      await p.setViewportSize({ width: 1024, height: 768 });
      await p.waitForTimeout(500);
      await p.keyboard.press('Tab');
      await p.keyboard.press('Tab');

      const darkModeToggle = await p.$('[aria-label*="theme"], [aria-label*="dark"], button:has-text("Dark")');
      if (darkModeToggle) {
        await darkModeToggle.click();
        await p.waitForTimeout(500);
      } else {
        t.logInfo('Dark mode toggle not found');
      }

    } catch (error) {
      this.tester.logInfo(`Test suite failed: ${(error as Error).message}`);
      status = TestStatus.FAILED;
      logs.push(`Test suite failed: ${(error as Error).message}`);
    }

    const endTime = new Date();
    this.generateFinalReport();

    const resultsPath = path.join(process.cwd(), 'test-results.json');
    await fs.writeFile(resultsPath, JSON.stringify(this.results, null, 2));
    this.tester.logInfo(`Results saved to ${resultsPath}`);

    if (this.results.failed > 0) {
      status = TestStatus.FAILED;
    } else if (this.results.errors.length > 0) {
      status = TestStatus.ERROR;
    }

    return {
      scenarioId: 'comprehensive-ui-test',
      status,
      duration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
      screenshots,
      logs,
      metadata: {
        totalTests: this.results.passed + this.results.failed,
        passed: this.results.passed,
        failed: this.results.failed,
        errors: this.results.errors
      }
    };
  }

  private generateFinalReport(): void {
    this.tester.logSection('Test Results Summary');
    process.stdout.write(`${colors.green}Passed: ${this.results.passed}${colors.reset}\n`);
    process.stdout.write(`${colors.red}Failed: ${this.results.failed}${colors.reset}\n`);

    if (this.results.errors.length > 0) {
      process.stdout.write(`\n${colors.red}Errors:${colors.reset}\n`);
      this.results.errors.forEach((err, idx) => {
        process.stdout.write(`  ${idx + 1}. ${err.test}: ${err.error}\n`);
      });
    }
  }

  /** Close the Electron application. */
  async cleanup(): Promise<void> {
    if (this.electronApp) {
      await this.electronApp.close();
      this.tester.logInfo('Electron app closed');
    }
  }

  /** Return a snapshot of current test results. */
  getResults(): TestResults {
    return { ...this.results };
  }
}

/** Create and configure a Comprehensive UI Test Runner. */
export function createComprehensiveUITestRunner(screenshotsDir?: string): ComprehensiveUITestRunner {
  return new ComprehensiveUITestRunner(screenshotsDir);
}

/** Run Comprehensive UI Tests as a standalone invocation. */
export async function runComprehensiveUITests(screenshotsDir?: string): Promise<TestResult> {
  const runner = createComprehensiveUITestRunner(screenshotsDir);
  try {
    await runner.initialize();
    return await runner.runTests();
  } finally {
    await runner.cleanup();
  }
}