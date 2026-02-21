/**
 * ElectronUIAgent - Thin facade delegating to focused electron sub-modules.
 *
 * Coordinates ElectronLauncher, ElectronPageInteractor,
 * ElectronPerformanceMonitor, and ElectronWebSocketMonitor.
 */

import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { TestStep, TestStatus, StepResult } from '../models/TestModels';
import { AppState } from '../models/AppState';
import { ScreenshotMetadata, createScreenshotManager } from '../utils/screenshot';
import { createLogger, LogLevel, TestLogger } from '../utils/logger';
import {
  ElectronUIAgentConfig,
  DEFAULT_CONFIG,
  TestError,
  ElectronLauncher,
  ElectronPageInteractor,
  ElectronPerformanceMonitor,
  ElectronWebSocketMonitor
} from './electron';

export { ElectronUIAgentConfig, WebSocketEvent, PerformanceSample } from './electron';

/** Comprehensive Electron UI testing agent — facade over focused sub-modules. */
export class ElectronUIAgent extends EventEmitter implements IAgent {
  public readonly name = 'ElectronUIAgent';
  public readonly type = AgentType.UI;

  private config: ElectronUIAgentConfig;
  private launcher: ElectronLauncher;
  private interactor: ElectronPageInteractor;
  private perfMonitor: ElectronPerformanceMonitor;
  private wsMonitor: ElectronWebSocketMonitor;
  private logger: TestLogger;
  private isInitialized = false;
  private currentScenarioId?: string;

  constructor(config: ElectronUIAgentConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as ElectronUIAgentConfig;
    this.logger = createLogger({ level: LogLevel.DEBUG, logDir: './logs/electron-agent' });
    const screenshotManager = createScreenshotManager({
      baseDir: this.config.screenshotConfig!.directory,
      strategy: 'by-scenario'
    });
    this.launcher = new ElectronLauncher(this.config, this.logger);
    this.interactor = new ElectronPageInteractor(this.config, this.logger, screenshotManager);
    this.perfMonitor = new ElectronPerformanceMonitor(this.config, this.logger);
    this.wsMonitor = new ElectronWebSocketMonitor(this.config, this.logger, this);
    this.on('error', (err) => this.logger.error('ElectronUIAgent error', { error: err.message }));
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing ElectronUIAgent', { config: this.sanitizeConfig() });
    try {
      await this.launcher.validateExecutablePath();
      this.isInitialized = true;
      this.logger.info('ElectronUIAgent initialized successfully');
      this.emit('initialized');
    } catch (error: any) {
      throw new TestError({
        type: 'InitializationError',
        message: `Failed to initialize ElectronUIAgent: ${error?.message}`,
        stackTrace: error?.stack,
        timestamp: new Date(),
        context: { config: this.sanitizeConfig() }
      });
    }
  }

  async execute(scenario: any): Promise<any> {
    if (!this.isInitialized) throw new Error('Agent not initialized. Call initialize() first.');
    this.currentScenarioId = scenario.id;
    this.logger.setContext({ scenarioId: scenario.id, component: 'ElectronUIAgent' });
    this.logger.scenarioStart(scenario.id, scenario.name);
    const startTime = Date.now();
    let status = TestStatus.PASSED;
    let error: string | undefined;
    try {
      const stepResults: StepResult[] = [];
      for (let i = 0; i < scenario.steps.length; i++) {
        const stepResult = await this.executeStep(scenario.steps[i], i);
        stepResults.push(stepResult);
        if (stepResult.status === TestStatus.FAILED || stepResult.status === TestStatus.ERROR) {
          status = stepResult.status; error = stepResult.error; break;
        }
      }
      return {
        scenarioId: scenario.id, status,
        duration: Date.now() - startTime, startTime: new Date(startTime), endTime: new Date(),
        error, stepResults,
        screenshots: this.interactor.getScenarioScreenshots(this.currentScenarioId),
        logs: this.getScenarioLogs(),
        performanceSamples: [...this.perfMonitor.samples],
        websocketEvents: [...this.wsMonitor.events],
        stateSnapshots: [...this.interactor.stateSnapshots]
      };
    } catch (execError: any) {
      this.logger.error('Scenario execution failed', { error: execError?.message });
      status = TestStatus.ERROR; error = execError?.message;
      if (this.launcher.page) {
        await this.interactor.captureFailureScreenshot(this.launcher.page, undefined, this.currentScenarioId);
      }
      throw execError;
    } finally {
      this.logger.scenarioEnd(scenario.id, status, Date.now() - startTime);
      this.currentScenarioId = undefined;
    }
  }

  async launch(): Promise<void> {
    const page = await this.launcher.launch();
    if (this.config.websocketConfig) await this.wsMonitor.connect();
    if (this.config.performanceConfig?.enabled) this.perfMonitor.start(page);
    this.emit('launched');
  }

  async close(): Promise<void> {
    this.perfMonitor.stop();
    this.wsMonitor.disconnect();
    await this.launcher.close();
    this.emit('closed');
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up ElectronUIAgent resources');
    try {
      this.perfMonitor.stop();
      this.wsMonitor.disconnect();
      await this.launcher.forceClose();
      await this.launcher.exportFinalData({
        performanceSamples: this.perfMonitor.samples,
        websocketEvents: this.wsMonitor.events,
        stateSnapshots: this.interactor.stateSnapshots,
        exportScreenshots: () => this.interactor.exportScreenshots(
          `./logs/electron-agent-exports/screenshots_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
        )
      });
      this.logger.info('ElectronUIAgent cleanup completed');
      this.emit('cleanup');
    } catch (error: any) {
      this.logger.error('Error during cleanup', { error: error?.message });
    }
  }

  async screenshot(name: string): Promise<ScreenshotMetadata> {
    if (!this.launcher.page) throw new Error('Application not launched');
    return this.interactor.screenshot(this.launcher.page, name, this.currentScenarioId);
  }

  async clickTab(tabName: string): Promise<void> {
    if (!this.launcher.page) throw new Error('Application not launched');
    return this.interactor.clickTab(this.launcher.page, tabName);
  }

  async fillInput(selector: string, value: string): Promise<void> {
    if (!this.launcher.page) throw new Error('Application not launched');
    return this.interactor.fillInput(this.launcher.page, selector, value);
  }

  async clickButton(selector: string): Promise<void> {
    if (!this.launcher.page) throw new Error('Application not launched');
    return this.interactor.clickButton(this.launcher.page, selector);
  }

  async waitForElement(selector: string, options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeout?: number }) {
    if (!this.launcher.page) throw new Error('Application not launched');
    return this.interactor.waitForElement(this.launcher.page, selector, options);
  }

  async getElementText(selector: string): Promise<string> {
    if (!this.launcher.page) throw new Error('Application not launched');
    return this.interactor.getElementText(this.launcher.page, selector);
  }

  async captureState(): Promise<AppState> {
    if (!this.launcher.page) throw new Error('Application not launched');
    return this.interactor.captureState(this.launcher.page, this.currentScenarioId, {
      getProcessInfo: () => this.launcher.getProcessInfo(),
      getLatestPerformanceMetrics: () => this.perfMonitor.getLatestMetrics(),
      getNetworkState: () => this.perfMonitor.getNetworkState(),
      counters: {
        consoleMessages: this.launcher.consoleMessages.length,
        websocketEvents: this.wsMonitor.events.length,
        performanceSamples: this.perfMonitor.samples.length
      }
    });
  }

  async executeStep(step: TestStep, stepIndex: number): Promise<StepResult> {
    if (!this.launcher.page) throw new Error('Application not launched');
    return this.interactor.executeStep(
      this.launcher.page, step, stepIndex, this.currentScenarioId, this.config.defaultTimeout,
      { onLaunch: () => this.launch(), onClose: () => this.close() }
    );
  }

  private sanitizeConfig(): Record<string, any> {
    const { env, ...safeConfig } = this.config;
    return { ...safeConfig, env: env ? Object.keys(env) : undefined };
  }

  private getScenarioLogs(): string[] {
    return this.launcher.consoleMessages
      .filter(msg => msg.type() === 'error' || msg.type() === 'warning')
      .map(msg => `[${msg.type()}] ${msg.text()}`);
  }
}

/** Factory function to create an ElectronUIAgent instance */
export function createElectronUIAgent(config: ElectronUIAgentConfig): ElectronUIAgent {
  return new ElectronUIAgent(config);
}
