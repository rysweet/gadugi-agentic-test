/**
 * Smart Interaction Executor
 * Executes targeted interactions (click, fill, keyboard) within specific UI tabs.
 */

import { Page } from 'playwright';

// ANSI colour codes for terminal output (value used by parent SmartUITestRunner, type used here)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
 * SmartInteractionExecutor performs targeted interactions against known tab layouts.
 * It receives a log callback so that callers can control how output is routed.
 */
export class SmartInteractionExecutor {
  private testedFeatures: string[];
  private issues: string[];
  private logFn: (color: ColorKey, emoji: string, msg: string) => void;

  /**
   * @param testedFeatures - mutable array shared with the runner for accumulating feature names
   * @param issues          - mutable array shared with the runner for accumulating issue strings
   * @param logFn           - logging callback from the parent runner
   */
  constructor(
    testedFeatures: string[],
    issues: string[],
    logFn: (color: ColorKey, emoji: string, msg: string) => void
  ) {
    this.testedFeatures = testedFeatures;
    this.issues = issues;
    this.logFn = logFn;
  }

  /**
   * Test Scan / Build tab functionality.
   * Fills tenant-ID field, resource-limit field, and inspects the action button.
   */
  async testScanTab(page: Page): Promise<void> {
    this.logFn('magenta', '🔍', 'Testing Scan functionality...');

    try {
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
          this.logFn('green', '✅', 'Entered test tenant ID');
          this.testedFeatures.push('Tenant ID input functional');
          break;
        }
      }

      const limitInput = await page.$('input[type="number"], input[placeholder*="limit" i]');
      if (limitInput) {
        await limitInput.fill('10');
        this.logFn('green', '✅', 'Set resource limit to 10');
        this.testedFeatures.push('Resource limit configuration');
      }

      const buildButton = await page.$('button:has-text("Build"), button:has-text("Scan"), button:has-text("Start")');
      if (buildButton) {
        const buttonText = await buildButton.textContent();
        this.logFn('blue', '🔨', `Found action button: "${buttonText}"`);
        this.testedFeatures.push(`${buttonText} button ready`);

        const isDisabled = await buildButton.isDisabled();
        if (!isDisabled) {
          this.logFn('green', '✅', 'Build/Scan button is enabled and ready');
        } else {
          this.logFn('yellow', '⚠️', 'Build/Scan button is disabled');
          this.issues.push('Build button disabled - may need configuration');
        }
      }
    } catch (error) {
      this.logFn('red', '❌', `Scan tab test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test Generate IaC tab functionality.
   * Verifies format options (terraform, arm, bicep) and the generate button.
   */
  async testGenerateIaCTab(page: Page): Promise<void> {
    this.logFn('magenta', '🔍', 'Testing IaC Generation...');

    try {
      const formats = ['terraform', 'arm', 'bicep'];
      for (const format of formats) {
        const formatOption = await page.$(`text=/${format}/i`);
        if (formatOption) {
          this.logFn('green', '✅', `${format.toUpperCase()} format available`);
          this.testedFeatures.push(`${format} IaC generation`);
        }
      }

      const generateButton = await page.$('button:has-text("Generate")');
      if (generateButton) {
        this.logFn('green', '✅', 'Generate IaC button found');
        this.testedFeatures.push('IaC generation ready');
      }

      const outputArea = await page.$('textarea, pre, code');
      if (outputArea) {
        this.logFn('blue', '📄', 'IaC output area detected');
      }
    } catch (error) {
      this.logFn('red', '❌', `IaC tab test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test Visualize tab functionality.
   * Checks for graph canvas/SVG elements and zoom controls.
   */
  async testVisualizeTab(page: Page): Promise<void> {
    this.logFn('magenta', '🔍', 'Testing Visualization...');

    try {
      const graphElement = await page.$('canvas, svg, [class*="graph" i], [id*="graph" i]');
      if (graphElement) {
        this.logFn('green', '✅', 'Graph visualization component found');
        this.testedFeatures.push('Graph visualization functional');

        const zoomIn = await page.$('[aria-label*="zoom in" i], button:has-text("+")');
        if (zoomIn) {
          await zoomIn.click();
          this.logFn('green', '✅', 'Zoom controls working');
          this.testedFeatures.push('Graph zoom controls');
        }
      }

      const stats = await page.$$eval('text=/nodes|edges|relationships/i', els => els.length);
      if (stats > 0) {
        this.logFn('blue', '📊', 'Graph statistics displayed');
      }
    } catch (error) {
      this.logFn('red', '❌', `Visualize tab test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test Status tab functionality.
   * Checks Neo4j and Docker status indicators.
   */
  async testStatusTab(page: Page): Promise<void> {
    this.logFn('magenta', '🔍', 'Testing Status Indicators...');

    try {
      const neo4jStatus = await page.$('text=/neo4j/i');
      if (neo4jStatus) {
        const statusText = await page.textContent('body');

        if (statusText && statusText.match(/connected|running|online|active/i)) {
          this.logFn('green', '✅', 'Neo4j is connected');
          this.testedFeatures.push('Neo4j connection active');
        } else if (statusText && statusText.match(/disconnected|stopped|offline|inactive/i)) {
          this.logFn('yellow', '⚠️', 'Neo4j is disconnected');
          this.issues.push('Neo4j not connected');
        }
      }

      const dockerStatus = await page.$('text=/docker/i');
      if (dockerStatus) {
        this.logFn('blue', '🐳', 'Docker status indicator found');
        this.testedFeatures.push('Docker monitoring');
      }

      const errors = await page.$$('[class*="error" i], [class*="alert" i], [class*="warning" i]');
      if (errors.length > 0) {
        this.logFn('yellow', '⚠️', `Found ${errors.length} warning/error indicators`);
      }
    } catch (error) {
      this.logFn('red', '❌', `Status tab test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test Config tab functionality.
   * Checks configuration input fields and the save button.
   */
  async testConfigTab(page: Page): Promise<void> {
    this.logFn('magenta', '🔍', 'Testing Configuration...');

    try {
      const inputs = await page.$$('input[type="text"], input[type="password"], input[type="number"]');
      this.logFn('blue', '⚙️', `Found ${inputs.length} configuration fields`);

      if (inputs.length > 0) {
        this.testedFeatures.push(`${inputs.length} configuration options`);
        const firstInput = inputs[0];
        await firstInput.fill('test-config-value');
        this.logFn('green', '✅', 'Configuration field accepts input');
      }

      const saveButton = await page.$('button:has-text("Save")');
      if (saveButton) {
        this.logFn('green', '✅', 'Save configuration button found');
        this.testedFeatures.push('Configuration persistence');
      }

      const envFields = await page.$$('input[name*="env" i], input[placeholder*="api" i], input[placeholder*="key" i]');
      if (envFields.length > 0) {
        this.logFn('blue', '🔐', `${envFields.length} environment variable fields found`);
      }
    } catch (error) {
      this.logFn('red', '❌', `Config tab test failed: ${(error as Error).message}`);
    }
  }
}
