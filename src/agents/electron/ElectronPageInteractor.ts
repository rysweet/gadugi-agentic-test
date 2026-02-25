/**
 * ElectronPageInteractor - Page interaction: click, fill, navigate, assert, screenshot, state capture
 */

import { Page, Locator } from 'playwright';
import { ElectronUIAgentConfig } from './types';
import { TestLogger } from '../../utils/logger';
import { generateId } from '../../utils/ids';
import { TestStep, TestStatus, StepResult } from '../../models/TestModels';
import { AppState, NetworkState, PerformanceMetrics, StateSnapshot, ProcessInfo } from '../../models/AppState';
import { ScreenshotManager, ScreenshotMetadata } from '../../utils/screenshot';

/** Callbacks supplied by the facade for lifecycle steps inside executeStep */
export interface StepLifecycleCallbacks {
  onLaunch: () => Promise<void>;
  onClose: () => Promise<void>;
}

/** Callbacks for captureState to pull metrics from sibling modules */
export interface StateCaptureProviders {
  getProcessInfo: () => Promise<ProcessInfo | undefined>;
  getLatestPerformanceMetrics: () => PerformanceMetrics | undefined;
  getNetworkState: () => NetworkState;
  counters: { consoleMessages: number; websocketEvents: number; performanceSamples: number };
}

/**
 * Handles all page-level interactions with a launched Electron window.
 */
export class ElectronPageInteractor {
  private config: ElectronUIAgentConfig;
  private logger: TestLogger;
  private screenshotManager: ScreenshotManager;

  public stateSnapshots: StateSnapshot[] = [];

  constructor(config: ElectronUIAgentConfig, logger: TestLogger, screenshotManager: ScreenshotManager) {
    this.config = config;
    this.logger = logger;
    this.screenshotManager = screenshotManager;
  }

  /** Click a named tab using multiple selector strategies */
  async clickTab(page: Page, tabName: string): Promise<void> {
    this.logger.debug(`Clicking tab: ${tabName}`);
    try {
      const selectors = [
        `[data-testid="tab-${tabName.toLowerCase()}"]`,
        `[data-testid="tab-${tabName}"]`,
        `button:has-text("${tabName}")`,
        `.tab:has-text("${tabName}")`,
        `[role="tab"]:has-text("${tabName}")`
      ];

      let clicked = false;
      for (const selector of selectors) {
        try { await page.click(selector, { timeout: 2000 }); clicked = true; break; }
        catch { /* try next */ }
      }

      if (!clicked) throw new Error(`Tab "${tabName}" not found with any selector strategy`);
      await page.waitForTimeout(500);
      await this.captureCurrentState(page, `tab_${tabName.toLowerCase()}`);
      this.logger.debug(`Successfully clicked tab: ${tabName}`);
    } catch (error: unknown) {
      await this.captureFailureScreenshot(page, `tab_click_failure_${tabName}`);
      throw new Error(`Failed to click tab "${tabName}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Fill an input field with a value */
  async fillInput(page: Page, selector: string, value: string): Promise<void> {
    this.logger.debug(`Filling input: ${selector} with value: ${value}`);
    try {
      const element = page.locator(selector);
      await element.waitFor({ state: 'attached', ...(this.config.defaultTimeout !== undefined ? { timeout: this.config.defaultTimeout } : {}) });
      await element.waitFor({ state: 'visible', ...(this.config.defaultTimeout !== undefined ? { timeout: this.config.defaultTimeout } : {}) });
      await element.clear();
      await element.fill(value);
      const actual = await element.inputValue();
      if (actual !== value) this.logger.warn(`Input value mismatch. Expected: "${value}", Actual: "${actual}"`);
      this.logger.debug(`Successfully filled input: ${selector}`);
    } catch (error: unknown) {
      await this.captureFailureScreenshot(page, 'fill_input_failure');
      throw new Error(`Failed to fill input "${selector}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Click a button or element by selector */
  async clickButton(page: Page, selector: string): Promise<void> {
    this.logger.debug(`Clicking button: ${selector}`);
    try {
      const element = page.locator(selector);
      await element.waitFor({ state: 'attached', ...(this.config.defaultTimeout !== undefined ? { timeout: this.config.defaultTimeout } : {}) });
      await element.waitFor({ state: 'visible', ...(this.config.defaultTimeout !== undefined ? { timeout: this.config.defaultTimeout } : {}) });
      await element.scrollIntoViewIfNeeded();
      await element.click();
      this.logger.debug(`Successfully clicked button: ${selector}`);
    } catch (error: unknown) {
      await this.captureFailureScreenshot(page, 'click_button_failure');
      throw new Error(`Failed to click button "${selector}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Wait for an element to reach the given state */
  async waitForElement(
    page: Page,
    selector: string,
    options: { state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeout?: number } = {}
  ): Promise<Locator> {
    const { state = 'visible', timeout = this.config.defaultTimeout } = options;
    this.logger.debug(`Waiting for element: ${selector} (state: ${state})`);
    try {
      const element = page.locator(selector);
      await element.waitFor({ state, ...(timeout !== undefined ? { timeout } : {}) });
      this.logger.debug(`Element found: ${selector}`);
      return element;
    } catch (error: unknown) {
      await this.captureFailureScreenshot(page, 'wait_for_element_failure');
      throw new Error(`Element "${selector}" not found: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Get the text content of an element */
  async getElementText(page: Page, selector: string): Promise<string> {
    this.logger.debug(`Getting text from element: ${selector}`);
    try {
      const element = page.locator(selector);
      await element.waitFor({ state: 'visible', ...(this.config.defaultTimeout !== undefined ? { timeout: this.config.defaultTimeout } : {}) });
      const text = await element.textContent() || '';
      this.logger.debug(`Element text: ${text}`);
      return text;
    } catch (error: unknown) {
      await this.captureFailureScreenshot(page, 'get_element_text_failure');
      throw new Error(`Failed to get text from element "${selector}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Take a named screenshot */
  async screenshot(page: Page, name: string, currentScenarioId?: string): Promise<ScreenshotMetadata> {
    this.logger.debug(`Taking screenshot: ${name}`);
    try {
      const metadata = await this.screenshotManager.capturePageScreenshot(page, {
        ...(currentScenarioId !== undefined ? { scenarioId: currentScenarioId } : {}),
        description: name,
        ...(this.config.screenshotConfig?.fullPage !== undefined ? { fullPage: this.config.screenshotConfig.fullPage } : {}),
      });
      this.logger.screenshot(metadata.fileName);
      return metadata;
    } catch (error: unknown) {
      this.logger.error(`Failed to take screenshot "${name}"`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /** Capture the current application state and store a snapshot */
  async captureState(page: Page, scenarioId: string | undefined, providers: StateCaptureProviders): Promise<AppState> {
    const timestamp = new Date();
    const screenshotMeta = await this.screenshotManager.capturePageScreenshot(page, {
      ...(scenarioId !== undefined ? { scenarioId } : {}),
      description: 'State capture'
    });

    const processInfo = await providers.getProcessInfo();
    const performance = providers.getLatestPerformanceMetrics();
    const state: AppState = {
      timestamp,
      interface: 'GUI',
      screenshotPath: screenshotMeta.filePath,
      url: page.url(),
      title: await page.title(),
      ...(processInfo !== undefined ? { processInfo } : {}),
      ...(performance !== undefined ? { performance } : {}),
      networkState: providers.getNetworkState(),
      customData: {
        consoleMessageCount: providers.counters.consoleMessages,
        websocketEventCount: providers.counters.websocketEvents,
        performanceSampleCount: providers.counters.performanceSamples
      }
    };

    this.stateSnapshots.push({
      id: generateId(),
      timestamp,
      state,
      ...(scenarioId !== undefined ? { scenarioId } : {}),
    });
    return state;
  }

  /** Execute a single test step, dispatching to the appropriate interaction method */
  async executeStep(
    page: Page,
    step: TestStep,
    stepIndex: number,
    currentScenarioId: string | undefined,
    defaultTimeout: number | undefined,
    callbacks: StepLifecycleCallbacks
  ): Promise<StepResult> {
    const startTime = Date.now();
    this.logger.stepExecution(stepIndex, step.action, step.target);

    try {
      let result: any;

      switch (step.action.toLowerCase()) {
        case 'launch': case 'launch_electron':
          await callbacks.onLaunch(); break;
        case 'close': case 'close_app':
          await callbacks.onClose(); break;
        case 'click_tab':
          await this.clickTab(page, step.target); break;
        case 'click': case 'click_button':
          await this.clickButton(page, step.target); break;
        case 'fill': case 'type':
          if (!step.value) throw new Error('Fill action requires a value');
          await this.fillInput(page, step.target, step.value); break;
        case 'wait_for_element': case 'wait_for': {
          const waitTimeout = step.timeout ?? defaultTimeout;
          await this.waitForElement(page, step.target, waitTimeout !== undefined ? { timeout: waitTimeout } : {}); break;
        }
        case 'get_text':
          result = await this.getElementText(page, step.target); break;
        case 'screenshot':
          result = await this.screenshot(page, step.target, currentScenarioId); break;
        case 'wait':
          await page.waitForTimeout(parseInt(step.value || '1000')); break;
        case 'navigate':
          await page.goto(step.target); break;
        default:
          throw new Error(`Unsupported action: ${step.action}`);
      }

      const duration = Date.now() - startTime;
      this.logger.stepComplete(stepIndex, TestStatus.PASSED, duration);
      const actualResult = typeof result === 'string' ? result : undefined;
      return { stepIndex, status: TestStatus.PASSED, duration, ...(actualResult !== undefined ? { actualResult } : {}) };

    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      this.logger.stepComplete(stepIndex, TestStatus.FAILED, duration);
      await this.captureFailureScreenshot(page, `step_${stepIndex}_failure`, currentScenarioId);
      const screenshot = await this.getLastScreenshotPath(currentScenarioId);
      return {
        stepIndex, status: TestStatus.FAILED, duration, error: error instanceof Error ? error.message : String(error),
        ...(screenshot !== undefined ? { screenshot } : {}),
      };
    }
  }

  /** Return file paths for all screenshots captured in a scenario */
  getScenarioScreenshots(currentScenarioId?: string): string[] {
    if (!currentScenarioId) return [];
    return this.screenshotManager.getScreenshotsByScenario(currentScenarioId).map(s => s.filePath);
  }

  /** Export screenshot metadata to a file path */
  async exportScreenshots(filePath: string): Promise<void> {
    await this.screenshotManager.exportMetadata(filePath);
  }

  /** Capture failure screenshot — public so facade can call it directly */
  async captureFailureScreenshot(page: Page | null, name?: string, currentScenarioId?: string): Promise<void> {
    try {
      if (page && this.config.screenshotConfig?.mode !== 'off') {
        await this.screenshot(page, name || `failure_${Date.now()}`, currentScenarioId);
      }
    } catch (error: unknown) {
      this.logger.warn('Failed to capture failure screenshot', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // --- Private ---

  private async captureCurrentState(page: Page, label: string): Promise<void> {
    try {
      await this.screenshotManager.capturePageScreenshot(page, { description: label });
    } catch (error: unknown) {
      this.logger.debug('Failed to capture current state', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async getLastScreenshotPath(currentScenarioId?: string): Promise<string | undefined> {
    if (!currentScenarioId) return undefined;
    const screenshots = this.screenshotManager.getScreenshotsByScenario(currentScenarioId);
    return screenshots.length > 0 ? screenshots[screenshots.length - 1].filePath : undefined;
  }
}
