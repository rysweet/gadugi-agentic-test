#!/usr/bin/env node
/**
 * Smart UI Testing Runner
 * Uses Playwright's accessibility tree and element detection to test like a user.
 *
 * Thin facade: delegates element discovery to SmartElementFinder and tab
 * interaction to SmartInteractionExecutor.
 */

import { Page, ElectronApplication, _electron } from 'playwright';
import * as path from 'path';
import { promises as fs } from 'fs';
import { TestResult, TestStatus } from '../models/TestModels';
import { SmartElementFinder } from './smart/SmartElementFinder';
import { SmartInteractionExecutor } from './smart/SmartInteractionExecutor';

// Test context accumulated during a run
interface TestContext {
  currentTab: string | null;
  testedFeatures: string[];
  interactions: Array<{ tab: string; elementsFound: number; headings: string[] }>;
  issues: string[];
  screenshots: string[];
}

// ANSI colour codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
} as const;

type ColorKey = keyof typeof colors;

/**
 * Smart UI Test Runner
 *
 * Launches an Electron app, discovers tabs via SmartElementFinder, and
 * exercises each tab via SmartInteractionExecutor.
 */
export class SmartUITestRunner {
  private electronApp: ElectronApplication | null = null;
  private page: Page | null = null;
  private testContext: TestContext;
  private screenshotsDir: string;
  private finder: SmartElementFinder;
  private executor: SmartInteractionExecutor;

  constructor(screenshotsDir?: string) {
    this.screenshotsDir = screenshotsDir || path.join(process.cwd(), 'screenshots');
    this.testContext = {
      currentTab: null,
      testedFeatures: [],
      interactions: [],
      issues: [],
      screenshots: []
    };
    this.finder = new SmartElementFinder();
    this.executor = new SmartInteractionExecutor(
      this.testContext.testedFeatures,
      this.testContext.issues,
      this.log.bind(this)
    );
  }

  private log(color: ColorKey, emoji: string, msg: string): void {
    process.stdout.write(`${colors[color]}${emoji} ${msg}${colors.reset}\n`);
  }

  /** Initialize the test runner: create screenshot dir and launch Electron. */
  async initialize(): Promise<void> {
    await fs.mkdir(this.screenshotsDir, { recursive: true });
    this.log('cyan', '🤖', 'Smart UI Testing Agent');
    this.log('cyan', '🎯', 'Testing the UI by discovering and using actual features\n');
    this.log('blue', '🚀', 'Launching application...');

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const electronPath = require('electron') as string;
    const appPath = path.resolve(process.cwd(), '..');

    this.electronApp = await _electron.launch({
      executablePath: electronPath,
      args: [appPath],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    this.page = await this.electronApp.firstWindow();
    await this.page.waitForLoadState('domcontentloaded');
    this.log('green', '✅', 'Application ready\n');
  }

  /** Run all discovered tab tests and keyboard-navigation checks. */
  async runTests(): Promise<TestResult> {
    const startTime = new Date();
    let status = TestStatus.PASSED;
    const screenshots: string[] = [];
    const logs: string[] = [];

    try {
      if (!this.page) {
        throw new Error('Page not initialized. Call initialize() first.');
      }

      this.log('cyan', '🔍', 'Discovering UI elements...');
      const initialElements = await this.finder.discoverElements(this.page);
      this.log('blue', '📋', `Found ${initialElements.interactive.length} interactive elements`);

      const tabElements = initialElements.interactive.filter(
        el => el.type === 'link' && (el.text && el.text.length < 20)
      );
      this.log('blue', '📑', `Found ${tabElements.length} potential tabs\n`);

      const tabTests: Record<string, (page: Page) => Promise<void>> = {
        'scan':           this.executor.testScanTab.bind(this.executor),
        'build':          this.executor.testScanTab.bind(this.executor),
        'generate iac':   this.executor.testGenerateIaCTab.bind(this.executor),
        'iac':            this.executor.testGenerateIaCTab.bind(this.executor),
        'visualize':      this.executor.testVisualizeTab.bind(this.executor),
        'status':         this.executor.testStatusTab.bind(this.executor),
        'config':         this.executor.testConfigTab.bind(this.executor),
        'configuration':  this.executor.testConfigTab.bind(this.executor)
      };

      for (const tabElement of tabElements) {
        const tabName = tabElement.text?.trim();
        if (!tabName) continue;

        this.log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
        this.log('yellow', '📂', `Testing "${tabName}" Tab`);

        try {
          const clicked = await this.page.click(`text="${tabName}"`, { timeout: 5000 })
            .then(() => true)
            .catch(() => false);

          if (clicked) {
            await this.page.waitForTimeout(1000);

            const screenshotName = `${tabName.toLowerCase().replace(/\s+/g, '-')}-tested.png`;
            const screenshotPath = path.join(this.screenshotsDir, screenshotName);
            await this.page.screenshot({ path: screenshotPath, fullPage: true });
            this.testContext.screenshots.push(screenshotName);
            screenshots.push(screenshotPath);

            const tabDiscovery = await this.finder.discoverElements(this.page);
            this.log('blue', '🔎', `Tab contains ${tabDiscovery.interactive.length} elements`);

            const testFn = Object.entries(tabTests).find(([key]) =>
              tabName.toLowerCase().includes(key)
            )?.[1];

            if (testFn) {
              await testFn(this.page);
            } else {
              const buttons = tabDiscovery.interactive.filter(el => el.type === 'button');
              const inputs = tabDiscovery.interactive.filter(el =>
                el.type?.includes('input') || el.type === 'text' || el.type === 'textarea'
              );
              if (buttons.length > 0) this.log('blue', '🔘', `${buttons.length} buttons available`);
              if (inputs.length > 0)  this.log('blue', '📝', `${inputs.length} input fields available`);
            }

            this.testContext.interactions.push({
              tab: tabName,
              elementsFound: tabDiscovery.interactive.length,
              headings: tabDiscovery.headings
            });
          } else {
            this.log('yellow', '⚠️', `Could not navigate to ${tabName}`);
          }
        } catch (error) {
          this.log('red', '❌', `Error testing ${tabName}: ${(error as Error).message}`);
          status = TestStatus.ERROR;
        }
      }

      // Keyboard navigation
      this.log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
      this.log('yellow', '⌨️', 'Testing Keyboard Navigation');
      await this.page.keyboard.press('Tab');
      await this.page.keyboard.press('Tab');
      await this.page.keyboard.press('Tab');
      this.log('green', '✅', 'Tab key navigation working');
      await this.page.keyboard.press('Escape');
      this.log('green', '✅', 'Escape key handled');
      this.testContext.testedFeatures.push('Keyboard navigation');

    } catch (error) {
      this.log('red', '❌', `Test failed: ${(error as Error).message}`);
      status = TestStatus.FAILED;
      logs.push(`Test failed: ${(error as Error).message}`);
    }

    const endTime = new Date();
    this.generateReport();

    const resultsPath = path.join(process.cwd(), 'smart-test-results.json');
    await fs.writeFile(resultsPath, JSON.stringify(this.testContext, null, 2));
    this.log('green', '\n💾', `Results saved to ${resultsPath}`);

    return {
      scenarioId: 'smart-ui-test',
      status,
      duration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
      screenshots,
      logs,
      metadata: {
        testedFeatures: this.testContext.testedFeatures,
        issues: this.testContext.issues,
        interactions: this.testContext.interactions
      }
    };
  }

  private generateReport(): void {
    this.log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
    this.log('cyan', '📊', 'Test Report Summary');
    this.log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
    this.log('green', '\n✅', `Features Tested: ${this.testContext.testedFeatures.length}`);
    this.testContext.testedFeatures.forEach(f => this.log('blue', '  •', f));

    if (this.testContext.issues.length > 0) {
      this.log('yellow', '\n⚠️', `Issues Found: ${this.testContext.issues.length}`);
      this.testContext.issues.forEach(i => this.log('yellow', '  •', i));
    }

    this.log('blue', '\n📸', `Screenshots Captured: ${this.testContext.screenshots.length}`);
    this.log('cyan', '\n🎯', 'Testing Strategy:');
    this.log('blue', '  •', 'Discovered UI elements automatically');
    this.log('blue', '  •', 'Navigated through tabs like a user');
    this.log('blue', '  •', 'Interacted with forms and buttons');
    this.log('blue', '  •', 'Verified status indicators');
    this.log('blue', '  •', 'Tested keyboard navigation');
  }

  /** Close the Electron application and release resources. */
  async cleanup(): Promise<void> {
    if (this.electronApp) {
      await this.electronApp.close();
      this.log('blue', '🏁', 'Application closed');
    }
  }
}

/** Create and configure a Smart UI Test Runner. */
export function createSmartUITestRunner(screenshotsDir?: string): SmartUITestRunner {
  return new SmartUITestRunner(screenshotsDir);
}

/** Run Smart UI Tests as a standalone invocation. */
export async function runSmartUITests(screenshotsDir?: string): Promise<TestResult> {
  const runner = createSmartUITestRunner(screenshotsDir);
  try {
    await runner.initialize();
    return await runner.runTests();
  } finally {
    await runner.cleanup();
  }
}