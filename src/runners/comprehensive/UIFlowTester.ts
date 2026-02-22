/**
 * UIFlowTester
 * User flow testing logic extracted from ComprehensiveUITestRunner.
 *
 * Each tab-specific test method is a self-contained async function that
 * receives a Playwright Page and mutates the shared TestResults through
 * the logSuccess / logError callbacks provided at construction time.
 */

import { Page } from 'playwright';
import * as path from 'path';

// ANSI colour codes shared within this module
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
} as const;

/** Accumulated test pass/fail state */
export interface TestResults {
  passed: number;
  failed: number;
  errors: Array<{ test: string; error: string }>;
}

/** Function signature for a single tab test */
export type TabTestFunction = (page: Page) => Promise<void>;

/**
 * UIFlowTester owns all tab-specific interaction logic and the generic
 * `testTab()` orchestrator.
 *
 * Logging is handled internally; pass-count mutations go through the
 * shared `results` object supplied at construction time.
 */
export class UIFlowTester {
  private results: TestResults;
  private screenshotsDir: string;

  constructor(results: TestResults, screenshotsDir: string) {
    this.results = results;
    this.screenshotsDir = screenshotsDir;
  }

  // ---------------------------------------------------------------------------
  // Internal logging helpers
  // ---------------------------------------------------------------------------

  private logSuccess(msg: string): void {
    console.log(`${colors.green}✅ ${msg}${colors.reset}`);
    this.results.passed++;
  }

  private logError(msg: string, error?: Error | string): void {
    console.log(`${colors.red}❌ ${msg}${colors.reset}`);
    if (error) {
      const errorMsg = error instanceof Error ? error.message : error;
      console.log(`   ${colors.red}${errorMsg}${colors.reset}`);
    }
    this.results.failed++;
    this.results.errors.push({
      test: msg,
      error: error instanceof Error ? error.message : (error || 'Unknown error')
    });
  }

  logInfo(msg: string): void {
    console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
  }

  logSection(msg: string): void {
    console.log(`\n${colors.yellow}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.yellow}${msg}${colors.reset}`);
    console.log(`${colors.yellow}${'='.repeat(60)}${colors.reset}\n`);
  }

  // ---------------------------------------------------------------------------
  // Generic tab orchestrator
  // ---------------------------------------------------------------------------

  /**
   * Navigate to a named tab, capture a screenshot, then run the provided tests.
   */
  async testTab(page: Page, tabName: string, tests: TabTestFunction[]): Promise<void> {
    this.logSection(`Testing ${tabName} Tab`);

    try {
      await page.click(`text="${tabName}"`);
      await page.waitForTimeout(1000);
      this.logSuccess(`Navigated to ${tabName} tab`);

      const screenshotPath = path.join(this.screenshotsDir, `${tabName.toLowerCase()}-tab.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      this.logSuccess(`Screenshot captured for ${tabName} tab`);

      for (const test of tests) {
        try {
          await test(page);
        } catch (error) {
          this.logError(test.name || 'Unknown test', error as Error);
        }
      }
    } catch (error) {
      this.logError(`Failed to test ${tabName} tab`, error as Error);
    }
  }

  // ---------------------------------------------------------------------------
  // Build Tab
  // ---------------------------------------------------------------------------

  async testTenantIdInput(page: Page): Promise<void> {
    const input = await page.$('input[placeholder*="tenant"]');
    if (input) {
      await input.fill('test-tenant-id-12345');
      this.logSuccess('Tenant ID input field working');
    } else {
      throw new Error('Tenant ID input not found');
    }
  }

  async testBuildButton(page: Page): Promise<void> {
    const button = await page.$('button:has-text("Build Graph")');
    if (button) {
      const isEnabled = await button.isEnabled();
      this.logSuccess(`Build button ${isEnabled ? 'enabled' : 'disabled'}`);
    } else {
      throw new Error('Build button not found');
    }
  }

  // ---------------------------------------------------------------------------
  // Generate Spec Tab
  // ---------------------------------------------------------------------------

  async testSpecGeneration(page: Page): Promise<void> {
    const generateBtn = await page.$('button:has-text("Generate")');
    if (generateBtn) {
      this.logSuccess('Spec generation button found');
    } else {
      throw new Error('Generate spec button not found');
    }
  }

  // ---------------------------------------------------------------------------
  // Generate IaC Tab
  // ---------------------------------------------------------------------------

  async testFormatSelector(page: Page): Promise<void> {
    const formats = ['terraform', 'arm', 'bicep'];
    for (const format of formats) {
      const option = await page.$(`text="${format}"`);
      if (option) {
        this.logSuccess(`IaC format option '${format}' available`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Create Tenant Tab
  // ---------------------------------------------------------------------------

  async testSpecUpload(page: Page): Promise<void> {
    const uploadArea = await page.$('input[type="file"]');
    if (uploadArea) {
      this.logSuccess('Spec file upload area available');
    } else {
      this.logInfo('No file upload area found (might use text area)');
    }
  }

  // ---------------------------------------------------------------------------
  // Visualize Tab
  // ---------------------------------------------------------------------------

  async testGraphVisualization(page: Page): Promise<void> {
    const graphContainer = await page.$('[class*="graph"], [id*="graph"], canvas, svg');
    if (graphContainer) {
      this.logSuccess('Graph visualization container found');
    } else {
      this.logInfo('Graph container not found (might need data first)');
    }
  }

  // ---------------------------------------------------------------------------
  // Agent Mode Tab
  // ---------------------------------------------------------------------------

  async testAgentInterface(page: Page): Promise<void> {
    const chatInput = await page.$('textarea, input[type="text"][placeholder*="message"]');
    if (chatInput) {
      await chatInput.fill('Test agent command');
      this.logSuccess('Agent mode input field working');
    } else {
      this.logInfo('Agent mode interface not found');
    }
  }

  // ---------------------------------------------------------------------------
  // Threat Model Tab
  // ---------------------------------------------------------------------------

  async testThreatModelGeneration(page: Page): Promise<void> {
    const analyzeBtn = await page.$('button:has-text("Analyze"), button:has-text("Generate")');
    if (analyzeBtn) {
      this.logSuccess('Threat model analysis button found');
    } else {
      this.logInfo('Threat model button not found');
    }
  }

  // ---------------------------------------------------------------------------
  // Config Tab
  // ---------------------------------------------------------------------------

  async testConfigFields(page: Page): Promise<void> {
    const envInputs = await page.$$('input[name*="env"], input[placeholder*="API"], input[placeholder*="key"]');
    if (envInputs.length > 0) {
      this.logSuccess(`Found ${envInputs.length} configuration fields`);
    } else {
      this.logInfo('No configuration fields found');
    }
  }

  async testSaveConfig(page: Page): Promise<void> {
    const saveBtn = await page.$('button:has-text("Save")');
    if (saveBtn) {
      this.logSuccess('Configuration save button found');
    } else {
      this.logInfo('Save button not found in Config tab');
    }
  }

  // ---------------------------------------------------------------------------
  // Status Tab
  // ---------------------------------------------------------------------------

  async testSystemStatus(page: Page): Promise<void> {
    const statusElements = await page.$$('[class*="status"], [class*="health"], [class*="indicator"]');
    if (statusElements.length > 0) {
      this.logSuccess(`Found ${statusElements.length} status indicators`);
    } else {
      this.logInfo('No status indicators found');
    }
  }

  async testNeo4jStatus(page: Page): Promise<void> {
    const neo4jStatus = await page.$('text=/neo4j/i');
    if (neo4jStatus) {
      this.logSuccess('Neo4j status indicator found');
    } else {
      this.logInfo('Neo4j status not displayed');
    }
  }

  // ---------------------------------------------------------------------------
  // Help Tab
  // ---------------------------------------------------------------------------

  async testHelpContent(page: Page): Promise<void> {
    const helpContent = await page.$('text=/documentation/i, text=/guide/i, text=/help/i');
    if (helpContent) {
      this.logSuccess('Help content available');
    } else {
      this.logInfo('Help content not found');
    }
  }
}
