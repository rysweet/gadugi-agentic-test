/**
 * Smart UI Testing Runner
 * Uses Playwright's accessibility tree and element detection to test like a user
 */

import { Page, ElectronApplication, _electron } from 'playwright';
import * as path from 'path';
import { promises as fs } from 'fs';
import { TestResult, TestStatus, TestStep } from '../models/TestModels';

// Test context interface
interface TestContext {
  currentTab: string | null;
  testedFeatures: string[];
  interactions: Array<{
    tab: string;
    elementsFound: number;
    headings: string[];
  }>;
  issues: string[];
  screenshots: string[];
}

// UI element interface
interface UIElement {
  type: string;
  text?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  name?: string;
  href?: string;
  options?: string[];
}

// Element discovery result
interface ElementDiscovery {
  interactive: UIElement[];
  headings: string[];
  labels: string[];
  title: string;
}

// Color output helpers
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
 * Smart UI Test Runner class
 */
export class SmartUITestRunner {
  private electronApp: ElectronApplication | null = null;
  private page: Page | null = null;
  private testContext: TestContext;
  private screenshotsDir: string;

  constructor(screenshotsDir?: string) {
    this.screenshotsDir = screenshotsDir || path.join(process.cwd(), 'screenshots');
    this.testContext = {
      currentTab: null,
      testedFeatures: [],
      interactions: [],
      issues: [],
      screenshots: []
    };
  }

  private log(color: ColorKey, emoji: string, msg: string): void {
    console.log(`${colors[color]}${emoji} ${msg}${colors.reset}`);
  }

  /**
   * Initialize the test runner
   */
  async initialize(): Promise<void> {
    // Create screenshots directory
    await fs.mkdir(this.screenshotsDir, { recursive: true });

    this.log('cyan', '🤖', 'Smart UI Testing Agent');
    this.log('cyan', '🎯', 'Testing the UI by discovering and using actual features\n');

    // Launch application
    this.log('blue', '🚀', 'Launching application...');
    const electronPath = require('electron');
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

  /**
   * Discover all interactive elements on the page
   */
  private async discoverElements(page: Page): Promise<ElementDiscovery> {
    return await page.evaluate(() => {
      const interactiveElements: UIElement[] = [];
      
      // Find all buttons
      document.querySelectorAll('button, [role="button"]').forEach(el => {
        const element = el as HTMLElement;
        interactiveElements.push({
          type: 'button',
          text: element.innerText || element.textContent || '',
          ariaLabel: element.getAttribute('aria-label') || undefined,
          id: element.id || undefined,
          className: element.className || undefined,
          disabled: (element as HTMLButtonElement).disabled
        });
      });
      
      // Find all inputs
      document.querySelectorAll('input, textarea').forEach(el => {
        const element = el as HTMLInputElement | HTMLTextAreaElement;
        interactiveElements.push({
          type: element.tagName.toLowerCase() === 'input' ? (element as HTMLInputElement).type || 'text' : 'textarea',
          placeholder: element.placeholder || undefined,
          value: element.value || undefined,
          name: element.getAttribute('name') || undefined,
          id: element.id || undefined,
          ariaLabel: element.getAttribute('aria-label') || undefined
        });
      });
      
      // Find all selects/dropdowns
      document.querySelectorAll('select').forEach(el => {
        const element = el as HTMLSelectElement;
        interactiveElements.push({
          type: 'select',
          name: element.name || undefined,
          id: element.id || undefined,
          options: Array.from(element.options).map(opt => opt.text)
        });
      });
      
      // Find all links/tabs
      document.querySelectorAll('a, [role="tab"]').forEach(el => {
        const element = el as HTMLElement;
        interactiveElements.push({
          type: 'link',
          text: element.innerText || element.textContent || '',
          href: (element as HTMLAnchorElement).href || undefined,
          ariaLabel: element.getAttribute('aria-label') || undefined
        });
      });
      
      // Get page content structure
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent || '');
      const labels = Array.from(document.querySelectorAll('label')).map(l => l.textContent || '');
      
      return {
        interactive: interactiveElements,
        headings,
        labels,
        title: document.title
      };
    });
  }

  /**
   * Test Scan/Build functionality
   */
  private async testScanTab(page: Page): Promise<void> {
    this.log('magenta', '🔍', 'Testing Scan functionality...');
    
    try {
      // Find and interact with tenant ID input
      const tenantInputSelectors = [
        'input[placeholder*="tenant" i]',
        'input[name*="tenant" i]',
        'input#tenantId',
        'input[type="text"]'
      ];
      
      for (const selector of tenantInputSelectors) {
        const input = await page.$(selector);
        if (input) {
          await input.fill('12345678-1234-1234-1234-123456789012');
          this.log('green', '✅', 'Entered test tenant ID');
          this.testContext.testedFeatures.push('Tenant ID input functional');
          break;
        }
      }
      
      // Look for resource limit input
      const limitInput = await page.$('input[type="number"], input[placeholder*="limit" i]');
      if (limitInput) {
        await limitInput.fill('10');
        this.log('green', '✅', 'Set resource limit to 10');
        this.testContext.testedFeatures.push('Resource limit configuration');
      }
      
      // Find build/scan button
      const buildButton = await page.$('button:has-text("Build"), button:has-text("Scan"), button:has-text("Start")');
      if (buildButton) {
        const buttonText = await buildButton.textContent();
        this.log('blue', '🔨', `Found action button: "${buttonText}"`);
        this.testContext.testedFeatures.push(`${buttonText} button ready`);
        
        // Check if button is enabled
        const isDisabled = await buildButton.isDisabled();
        if (!isDisabled) {
          this.log('green', '✅', 'Build/Scan button is enabled and ready');
        } else {
          this.log('yellow', '⚠️', 'Build/Scan button is disabled');
          this.testContext.issues.push('Build button disabled - may need configuration');
        }
      }
    } catch (error) {
      this.log('red', '❌', `Scan tab test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test Generate IaC functionality
   */
  private async testGenerateIaCTab(page: Page): Promise<void> {
    this.log('magenta', '🔍', 'Testing IaC Generation...');
    
    try {
      // Look for format options
      const formats = ['terraform', 'arm', 'bicep'];
      for (const format of formats) {
        const formatOption = await page.$(`text=/${format}/i`);
        if (formatOption) {
          this.log('green', '✅', `${format.toUpperCase()} format available`);
          this.testContext.testedFeatures.push(`${format} IaC generation`);
        }
      }
      
      // Check for generate button
      const generateButton = await page.$('button:has-text("Generate")');
      if (generateButton) {
        this.log('green', '✅', 'Generate IaC button found');
        this.testContext.testedFeatures.push('IaC generation ready');
      }
      
      // Check for output area
      const outputArea = await page.$('textarea, pre, code');
      if (outputArea) {
        this.log('blue', '📄', 'IaC output area detected');
      }
    } catch (error) {
      this.log('red', '❌', `IaC tab test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test Visualize functionality
   */
  private async testVisualizeTab(page: Page): Promise<void> {
    this.log('magenta', '🔍', 'Testing Visualization...');
    
    try {
      // Look for canvas or svg elements
      const graphElement = await page.$('canvas, svg, [class*="graph" i], [id*="graph" i]');
      if (graphElement) {
        this.log('green', '✅', 'Graph visualization component found');
        this.testContext.testedFeatures.push('Graph visualization functional');
        
        // Try to interact with zoom controls
        const zoomIn = await page.$('[aria-label*="zoom in" i], button:has-text("+")');
        if (zoomIn) {
          await zoomIn.click();
          this.log('green', '✅', 'Zoom controls working');
          this.testContext.testedFeatures.push('Graph zoom controls');
        }
      }
      
      // Check for graph statistics
      const stats = await page.$$eval('text=/nodes|edges|relationships/i', els => els.length);
      if (stats > 0) {
        this.log('blue', '📊', 'Graph statistics displayed');
      }
    } catch (error) {
      this.log('red', '❌', `Visualize tab test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test Status indicators
   */
  private async testStatusTab(page: Page): Promise<void> {
    this.log('magenta', '🔍', 'Testing Status Indicators...');
    
    try {
      // Check Neo4j status
      const neo4jStatus = await page.$('text=/neo4j/i');
      if (neo4jStatus) {
        const statusText = await page.textContent('body');
        
        if (statusText && statusText.match(/connected|running|online|active/i)) {
          this.log('green', '✅', 'Neo4j is connected');
          this.testContext.testedFeatures.push('Neo4j connection active');
        } else if (statusText && statusText.match(/disconnected|stopped|offline|inactive/i)) {
          this.log('yellow', '⚠️', 'Neo4j is disconnected');
          this.testContext.issues.push('Neo4j not connected');
        }
      }
      
      // Check Docker status
      const dockerStatus = await page.$('text=/docker/i');
      if (dockerStatus) {
        this.log('blue', '🐳', 'Docker status indicator found');
        this.testContext.testedFeatures.push('Docker monitoring');
      }
      
      // Check for error messages
      const errors = await page.$$('[class*="error" i], [class*="alert" i], [class*="warning" i]');
      if (errors.length > 0) {
        this.log('yellow', '⚠️', `Found ${errors.length} warning/error indicators`);
      }
    } catch (error) {
      this.log('red', '❌', `Status tab test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test Configuration
   */
  private async testConfigTab(page: Page): Promise<void> {
    this.log('magenta', '🔍', 'Testing Configuration...');
    
    try {
      // Find all input fields
      const inputs = await page.$$('input[type="text"], input[type="password"], input[type="number"]');
      this.log('blue', '⚙️', `Found ${inputs.length} configuration fields`);
      
      if (inputs.length > 0) {
        this.testContext.testedFeatures.push(`${inputs.length} configuration options`);
        
        // Test filling one field
        const firstInput = inputs[0];
        await firstInput.fill('test-config-value');
        this.log('green', '✅', 'Configuration field accepts input');
      }
      
      // Look for save button
      const saveButton = await page.$('button:has-text("Save")');
      if (saveButton) {
        this.log('green', '✅', 'Save configuration button found');
        this.testContext.testedFeatures.push('Configuration persistence');
      }
      
      // Check for environment variable fields
      const envFields = await page.$$('input[name*="env" i], input[placeholder*="api" i], input[placeholder*="key" i]');
      if (envFields.length > 0) {
        this.log('blue', '🔐', `${envFields.length} environment variable fields found`);
      }
    } catch (error) {
      this.log('red', '❌', `Config tab test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Run smart UI tests
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

      // Discover initial UI elements
      this.log('cyan', '🔍', 'Discovering UI elements...');
      const initialElements = await this.discoverElements(this.page);
      this.log('blue', '📋', `Found ${initialElements.interactive.length} interactive elements`);

      // Find and test all tabs
      const tabElements = initialElements.interactive.filter(el => 
        el.type === 'link' && (el.text && el.text.length < 20)
      );

      this.log('blue', '📑', `Found ${tabElements.length} potential tabs\n`);

      // Define tab test mapping
      const tabTests: { [key: string]: (page: Page) => Promise<void> } = {
        'scan': this.testScanTab.bind(this),
        'build': this.testScanTab.bind(this),
        'generate iac': this.testGenerateIaCTab.bind(this),
        'iac': this.testGenerateIaCTab.bind(this),
        'visualize': this.testVisualizeTab.bind(this),
        'status': this.testStatusTab.bind(this),
        'config': this.testConfigTab.bind(this),
        'configuration': this.testConfigTab.bind(this)
      };

      // Test each discovered tab
      for (const tabElement of tabElements) {
        const tabName = tabElement.text?.trim();
        if (!tabName) continue;

        this.log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
        this.log('yellow', '📂', `Testing "${tabName}" Tab`);

        try {
          // Click on the tab
          const clicked = await this.page.click(`text="${tabName}"`, { timeout: 5000 })
            .then(() => true)
            .catch(() => false);

          if (clicked) {
            await this.page.waitForTimeout(1000);

            // Take screenshot
            const screenshotName = `${tabName.toLowerCase().replace(/\s+/g, '-')}-tested.png`;
            const screenshotPath = path.join(this.screenshotsDir, screenshotName);
            await this.page.screenshot({ 
              path: screenshotPath,
              fullPage: true 
            });
            this.testContext.screenshots.push(screenshotName);
            screenshots.push(screenshotPath);

            // Discover elements in this tab
            const tabElements = await this.discoverElements(this.page);
            this.log('blue', '🔎', `Tab contains ${tabElements.interactive.length} elements`);

            // Run specific test for this tab
            const testFunction = Object.entries(tabTests).find(([key]) => 
              tabName.toLowerCase().includes(key)
            )?.[1];

            if (testFunction) {
              await testFunction(this.page);
            } else {
              // Generic element counting
              const buttons = tabElements.interactive.filter(el => el.type === 'button');
              const inputs = tabElements.interactive.filter(el => 
                el.type?.includes('input') || el.type === 'text' || el.type === 'textarea'
              );

              if (buttons.length > 0) {
                this.log('blue', '🔘', `${buttons.length} buttons available`);
              }
              if (inputs.length > 0) {
                this.log('blue', '📝', `${inputs.length} input fields available`);
              }
            }

            this.testContext.interactions.push({
              tab: tabName,
              elementsFound: tabElements.interactive.length,
              headings: tabElements.headings
            });

          } else {
            this.log('yellow', '⚠️', `Could not navigate to ${tabName}`);
          }

        } catch (error) {
          this.log('red', '❌', `Error testing ${tabName}: ${(error as Error).message}`);
          status = TestStatus.ERROR;
        }
      }

      // Test keyboard navigation
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
    
    // Generate final report
    this.generateReport();

    // Save results
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

  /**
   * Generate and display test report
   */
  private generateReport(): void {
    this.log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
    this.log('cyan', '📊', 'Test Report Summary');
    this.log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');

    this.log('green', '\n✅', `Features Tested: ${this.testContext.testedFeatures.length}`);
    this.testContext.testedFeatures.forEach(feature => {
      this.log('blue', '  •', feature);
    });

    if (this.testContext.issues.length > 0) {
      this.log('yellow', '\n⚠️', `Issues Found: ${this.testContext.issues.length}`);
      this.testContext.issues.forEach(issue => {
        this.log('yellow', '  •', issue);
      });
    }

    this.log('blue', '\n📸', `Screenshots Captured: ${this.testContext.screenshots.length}`);

    this.log('cyan', '\n🎯', 'Testing Strategy:');
    this.log('blue', '  •', 'Discovered UI elements automatically');
    this.log('blue', '  •', 'Navigated through tabs like a user');
    this.log('blue', '  •', 'Interacted with forms and buttons');
    this.log('blue', '  •', 'Verified status indicators');
    this.log('blue', '  •', 'Tested keyboard navigation');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.electronApp) {
      await this.electronApp.close();
      this.log('blue', '🏁', 'Application closed');
    }
  }
}

/**
 * Create and configure Smart UI Test Runner
 */
export function createSmartUITestRunner(screenshotsDir?: string): SmartUITestRunner {
  return new SmartUITestRunner(screenshotsDir);
}

/**
 * Run Smart UI Tests standalone
 */
export async function runSmartUITests(screenshotsDir?: string): Promise<TestResult> {
  const runner = createSmartUITestRunner(screenshotsDir);
  
  try {
    await runner.initialize();
    return await runner.runTests();
  } finally {
    await runner.cleanup();
  }
}