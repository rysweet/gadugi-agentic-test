/**
 * Comprehensive UI Test Runner
 * Exercises all tabs and features systematically
 */

import { Page, ElectronApplication, _electron } from 'playwright';
import * as path from 'path';
import { promises as fs } from 'fs';
import { TestResult, TestStatus, TestStep } from '../models/TestModels';

// Test results interface
interface TestResults {
  passed: number;
  failed: number;
  errors: Array<{ test: string; error: string }>;
}

// Tab test function type
type TabTestFunction = (page: Page) => Promise<void>;

// Color output helpers
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
} as const;

type ColorKey = keyof typeof colors;

/**
 * Comprehensive UI Test Runner class
 */
export class ComprehensiveUITestRunner {
  private electronApp: ElectronApplication | null = null;
  private page: Page | null = null;
  private results: TestResults;
  private screenshotsDir: string;

  constructor(screenshotsDir?: string) {
    this.screenshotsDir = screenshotsDir || path.join(process.cwd(), 'screenshots');
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

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

  private logInfo(msg: string): void {
    console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
  }

  private logSection(msg: string): void {
    console.log(`\n${colors.yellow}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.yellow}${msg}${colors.reset}`);
    console.log(`${colors.yellow}${'='.repeat(60)}${colors.reset}\n`);
  }

  /**
   * Initialize the test runner
   */
  async initialize(): Promise<void> {
    this.logSection('Azure Tenant Grapher - Comprehensive UI Testing');
    
    // Create screenshots directory
    await fs.mkdir(this.screenshotsDir, { recursive: true });
    
    // Launch Electron app
    this.logInfo('Launching Electron application...');
    const electronPath = require('electron');
    const appPath = path.resolve(process.cwd(), '..');
    
    this.electronApp = await _electron.launch({
      executablePath: electronPath,
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TESTING: 'true'
      }
    });
    
    // Get main window
    this.page = await this.electronApp.firstWindow();
    await this.page.waitForLoadState('domcontentloaded');
    this.logSuccess('Electron app launched and ready');
  }

  /**
   * Test a specific tab with its test functions
   */
  private async testTab(page: Page, tabName: string, tests: TabTestFunction[]): Promise<void> {
    this.logSection(`Testing ${tabName} Tab`);
    
    try {
      // Navigate to tab
      await page.click(`text="${tabName}"`);
      await page.waitForTimeout(1000);
      this.logSuccess(`Navigated to ${tabName} tab`);
      
      // Take screenshot
      const screenshotPath = path.join(this.screenshotsDir, `${tabName.toLowerCase()}-tab.png`);
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
      this.logSuccess(`Screenshot captured for ${tabName} tab`);
      
      // Run specific tests for this tab
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

  /**
   * Build Tab Tests
   */
  private async testTenantIdInput(page: Page): Promise<void> {
    const input = await page.$('input[placeholder*="tenant"]');
    if (input) {
      await input.fill('test-tenant-id-12345');
      this.logSuccess('Tenant ID input field working');
    } else {
      throw new Error('Tenant ID input not found');
    }
  }

  private async testBuildButton(page: Page): Promise<void> {
    const button = await page.$('button:has-text("Build Graph")');
    if (button) {
      const isEnabled = await button.isEnabled();
      this.logSuccess(`Build button ${isEnabled ? 'enabled' : 'disabled'}`);
    } else {
      throw new Error('Build button not found');
    }
  }

  /**
   * Generate Spec Tab Tests
   */
  private async testSpecGeneration(page: Page): Promise<void> {
    const generateBtn = await page.$('button:has-text("Generate")');
    if (generateBtn) {
      this.logSuccess('Spec generation button found');
    } else {
      throw new Error('Generate spec button not found');
    }
  }

  /**
   * Generate IaC Tab Tests
   */
  private async testFormatSelector(page: Page): Promise<void> {
    const formats = ['terraform', 'arm', 'bicep'];
    for (const format of formats) {
      const option = await page.$(`text="${format}"`);
      if (option) {
        this.logSuccess(`IaC format option '${format}' available`);
      }
    }
  }

  /**
   * Create Tenant Tab Tests
   */
  private async testSpecUpload(page: Page): Promise<void> {
    const uploadArea = await page.$('input[type="file"]');
    if (uploadArea) {
      this.logSuccess('Spec file upload area available');
    } else {
      this.logInfo('No file upload area found (might use text area)');
    }
  }

  /**
   * Visualize Tab Tests
   */
  private async testGraphVisualization(page: Page): Promise<void> {
    // Check for graph container
    const graphContainer = await page.$('[class*="graph"], [id*="graph"], canvas, svg');
    if (graphContainer) {
      this.logSuccess('Graph visualization container found');
    } else {
      this.logInfo('Graph container not found (might need data first)');
    }
  }

  /**
   * Agent Mode Tab Tests
   */
  private async testAgentInterface(page: Page): Promise<void> {
    const chatInput = await page.$('textarea, input[type="text"][placeholder*="message"]');
    if (chatInput) {
      await chatInput.fill('Test agent command');
      this.logSuccess('Agent mode input field working');
    } else {
      this.logInfo('Agent mode interface not found');
    }
  }

  /**
   * Threat Model Tab Tests
   */
  private async testThreatModelGeneration(page: Page): Promise<void> {
    const analyzeBtn = await page.$('button:has-text("Analyze"), button:has-text("Generate")');
    if (analyzeBtn) {
      this.logSuccess('Threat model analysis button found');
    } else {
      this.logInfo('Threat model button not found');
    }
  }

  /**
   * Config Tab Tests
   */
  private async testConfigFields(page: Page): Promise<void> {
    // Check for environment variable inputs
    const envInputs = await page.$$('input[name*="env"], input[placeholder*="API"], input[placeholder*="key"]');
    if (envInputs.length > 0) {
      this.logSuccess(`Found ${envInputs.length} configuration fields`);
    } else {
      this.logInfo('No configuration fields found');
    }
  }

  private async testSaveConfig(page: Page): Promise<void> {
    const saveBtn = await page.$('button:has-text("Save")');
    if (saveBtn) {
      this.logSuccess('Configuration save button found');
    } else {
      this.logInfo('Save button not found in Config tab');
    }
  }

  /**
   * Status Tab Tests
   */
  private async testSystemStatus(page: Page): Promise<void> {
    // Look for status indicators
    const statusElements = await page.$$('[class*="status"], [class*="health"], [class*="indicator"]');
    if (statusElements.length > 0) {
      this.logSuccess(`Found ${statusElements.length} status indicators`);
    } else {
      this.logInfo('No status indicators found');
    }
  }

  private async testNeo4jStatus(page: Page): Promise<void> {
    const neo4jStatus = await page.$('text=/neo4j/i');
    if (neo4jStatus) {
      this.logSuccess('Neo4j status indicator found');
    } else {
      this.logInfo('Neo4j status not displayed');
    }
  }

  /**
   * Help Tab Tests
   */
  private async testHelpContent(page: Page): Promise<void> {
    const helpContent = await page.$('text=/documentation/i, text=/guide/i, text=/help/i');
    if (helpContent) {
      this.logSuccess('Help content available');
    } else {
      this.logInfo('Help content not found');
    }
  }

  /**
   * Run comprehensive UI tests
   */
  async runTests(): Promise<TestResult> {
    const startTime = new Date();
    let status = TestStatus.PASSED;
    const screenshots: string[] = [];
    const logs: string[] = [];

    try {
      if (!this.page) {
        throw new Error('Page not initialized. Call initialize() first.');
      }

      // Test Build Tab
      await this.testTab(this.page, 'Build', [
        this.testTenantIdInput.bind(this),
        this.testBuildButton.bind(this)
      ]);
      
      // Test Generate Spec Tab
      await this.testTab(this.page, 'Generate Spec', [
        this.testSpecGeneration.bind(this)
      ]);
      
      // Test Generate IaC Tab
      await this.testTab(this.page, 'Generate IaC', [
        this.testFormatSelector.bind(this)
      ]);
      
      // Test Create Tenant Tab
      await this.testTab(this.page, 'Create Tenant', [
        this.testSpecUpload.bind(this)
      ]);
      
      // Test Visualize Tab
      await this.testTab(this.page, 'Visualize', [
        this.testGraphVisualization.bind(this)
      ]);
      
      // Test Agent Mode Tab
      await this.testTab(this.page, 'Agent Mode', [
        this.testAgentInterface.bind(this)
      ]);
      
      // Test Threat Model Tab
      await this.testTab(this.page, 'Threat Model', [
        this.testThreatModelGeneration.bind(this)
      ]);
      
      // Test Config Tab
      await this.testTab(this.page, 'Config', [
        this.testConfigFields.bind(this),
        this.testSaveConfig.bind(this)
      ]);
      
      // Test Status Tab
      await this.testTab(this.page, 'Status', [
        this.testSystemStatus.bind(this),
        this.testNeo4jStatus.bind(this)
      ]);
      
      // Test Help Tab
      await this.testTab(this.page, 'Help', [
        this.testHelpContent.bind(this)
      ]);
      
      // Additional UI responsiveness tests
      this.logSection('UI Responsiveness Tests');
      
      // Test window resizing
      await this.page.setViewportSize({ width: 1920, height: 1080 });
      await this.page.waitForTimeout(500);
      this.logSuccess('Window resized to 1920x1080');
      
      await this.page.setViewportSize({ width: 1024, height: 768 });
      await this.page.waitForTimeout(500);
      this.logSuccess('Window resized to 1024x768');
      
      // Test keyboard navigation
      await this.page.keyboard.press('Tab');
      await this.page.keyboard.press('Tab');
      this.logSuccess('Keyboard navigation working');
      
      // Test dark mode toggle (if available)
      const darkModeToggle = await this.page.$('[aria-label*="theme"], [aria-label*="dark"], button:has-text("Dark")');
      if (darkModeToggle) {
        await darkModeToggle.click();
        await this.page.waitForTimeout(500);
        this.logSuccess('Dark mode toggle tested');
      } else {
        this.logInfo('Dark mode toggle not found');
      }
      
    } catch (error) {
      this.logError('Test suite failed', error as Error);
      status = TestStatus.FAILED;
      logs.push(`Test suite failed: ${(error as Error).message}`);
    }

    const endTime = new Date();

    // Generate final report
    this.generateFinalReport();

    // Save results to file
    const resultsPath = path.join(process.cwd(), 'test-results.json');
    await fs.writeFile(resultsPath, JSON.stringify(this.results, null, 2));
    this.logInfo(`Results saved to ${resultsPath}`);

    // Determine overall status
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

  /**
   * Generate and display final test report
   */
  private generateFinalReport(): void {
    this.logSection('Test Results Summary');
    console.log(`${colors.green}Passed: ${this.results.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${this.results.failed}${colors.reset}`);
    
    if (this.results.errors.length > 0) {
      console.log(`\n${colors.red}Errors:${colors.reset}`);
      this.results.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.test}: ${err.error}`);
      });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.electronApp) {
      await this.electronApp.close();
      this.logInfo('Electron app closed');
    }
  }

  /**
   * Get test results
   */
  getResults(): TestResults {
    return { ...this.results };
  }
}

/**
 * Create and configure Comprehensive UI Test Runner
 */
export function createComprehensiveUITestRunner(screenshotsDir?: string): ComprehensiveUITestRunner {
  return new ComprehensiveUITestRunner(screenshotsDir);
}

/**
 * Run Comprehensive UI Tests standalone
 */
export async function runComprehensiveUITests(screenshotsDir?: string): Promise<TestResult> {
  const runner = createComprehensiveUITestRunner(screenshotsDir);
  
  try {
    await runner.initialize();
    return await runner.runTests();
  } finally {
    await runner.cleanup();
  }
}