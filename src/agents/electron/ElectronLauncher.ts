/**
 * ElectronLauncher - Handles Electron application launch, teardown, and lifecycle management
 */

import { EventEmitter } from 'events';
import {
  _electron as electron,
  ElectronApplication,
  Page,
  BrowserContext,
  ConsoleMessage,
  Dialog
} from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ElectronUIAgentConfig } from './types';
import { TestLogger } from '../../utils/logger';
import { ProcessInfo } from '../../models/AppState';

/**
 * Manages Electron application lifecycle: launch, page setup, teardown, and data export.
 *
 * Extends EventEmitter so callers can observe dialog events:
 *   launcher.on('dialog', ({ type, message }) => { ... })
 */
export class ElectronLauncher extends EventEmitter {
  private config: ElectronUIAgentConfig;
  private logger: TestLogger;

  public app: ElectronApplication | null = null;
  public page: Page | null = null;
  public context: BrowserContext | null = null;
  public consoleMessages: ConsoleMessage[] = [];

  constructor(config: ElectronUIAgentConfig, logger: TestLogger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  /**
   * Validate that the executable path exists before launching
   */
  async validateExecutablePath(): Promise<void> {
    try {
      await fs.access(this.config.executablePath);
    } catch {
      throw new Error(`Electron executable not found: ${this.config.executablePath}`);
    }
  }

  /**
   * Launch the Electron application and return the main page
   */
  async launch(): Promise<Page> {
    this.logger.info('Launching Electron application', {
      executablePath: this.config.executablePath,
      args: this.config.args
    });

    this.app = await electron.launch({
      executablePath: this.config.executablePath,
      args: this.config.args,
      cwd: this.config.cwd,
      env: {
        ...process.env as Record<string, string>,
        ...this.config.env
      },
      timeout: this.config.launchTimeout,
      recordVideo: this.config.recordVideo
        ? { dir: this.config.videoDir || './videos' }
        : undefined
    });

    this.page = await this.app.firstWindow({ timeout: this.config.launchTimeout });

    if (!this.page) {
      throw new Error('No main window found');
    }

    this.context = this.page.context();
    this.page.setDefaultTimeout(this.config.defaultTimeout!);
    this.setupPageEventListeners();

    this.logger.info('Electron application launched successfully');
    return this.page;
  }

  /**
   * Close the Electron application
   */
  async close(): Promise<void> {
    this.logger.info('Closing Electron application');

    if (this.app) {
      await this.app.close();
      this.app = null;
    }

    this.page = null;
    this.context = null;
    this.logger.info('Electron application closed successfully');
  }

  /**
   * Force-close without throwing, suitable for cleanup paths
   */
  async forceClose(): Promise<void> {
    if (this.app) {
      try {
        await this.app.close();
      } catch (error: unknown) {
        this.logger.warn('Error closing Electron app during cleanup', { error: error instanceof Error ? error.message : String(error) });
      }
      this.app = null;
    }
    this.page = null;
    this.context = null;
  }

  /**
   * Get process information from the running Electron app
   */
  async getProcessInfo(): Promise<ProcessInfo | undefined> {
    if (!this.app) return undefined;

    try {
      const pid = await this.app.evaluate(async () => {
        return process.pid;
      });

      return {
        pid,
        name: 'electron',
        status: 'running',
        startTime: new Date()
      };
    } catch (error: unknown) {
      this.logger.debug('Failed to get process info', { error: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  }

  /**
   * Export collected data (performance, WebSocket events, state snapshots, screenshots)
   * to the given export directory.
   */
  async exportFinalData(exportData: {
    performanceSamples: any[];
    websocketEvents: any[];
    stateSnapshots: any[];
    exportScreenshots: () => Promise<void>;
  }): Promise<void> {
    try {
      const exportDir = './logs/electron-agent-exports';
      await fs.mkdir(exportDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      if (exportData.performanceSamples.length > 0) {
        await fs.writeFile(
          path.join(exportDir, `performance_${timestamp}.json`),
          JSON.stringify(exportData.performanceSamples, null, 2)
        );
      }

      if (exportData.websocketEvents.length > 0) {
        await fs.writeFile(
          path.join(exportDir, `websocket_events_${timestamp}.json`),
          JSON.stringify(exportData.websocketEvents, null, 2)
        );
      }

      if (exportData.stateSnapshots.length > 0) {
        await fs.writeFile(
          path.join(exportDir, `state_snapshots_${timestamp}.json`),
          JSON.stringify(exportData.stateSnapshots, null, 2)
        );
      }

      await exportData.exportScreenshots();

    } catch (error: unknown) {
      this.logger.warn('Failed to export final data', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // --- Private helpers ---

  private setupPageEventListeners(): void {
    if (!this.page) return;

    this.page.on('console', (msg: ConsoleMessage) => {
      this.consoleMessages.push(msg);

      switch (msg.type()) {
        case 'error':
          this.logger.error(`Console error: ${msg.text()}`);
          break;
        case 'warning':
          this.logger.warn(`Console warning: ${msg.text()}`);
          break;
        default:
          this.logger.debug(`Console ${msg.type()}: ${msg.text()}`);
      }
    });

    this.page.on('dialog', async (dialog: Dialog) => {
      this.logger.info(`Dialog appeared: ${dialog.type()} - ${dialog.message()}`);
      // Record dialog in state for test assertions
      this.emit('dialog', { type: dialog.type(), message: dialog.message() });

      if (dialog.type() === 'alert') {
        // Auto-accept informational alerts (backward compatible)
        await dialog.accept();
      } else {
        // Dismiss confirm/prompt dialogs and log as warning
        // Tests that need these dialogs should handle them explicitly
        this.logger.warn(`Non-alert dialog dismissed: ${dialog.type()} - "${dialog.message()}"`, {
          dialogType: dialog.type(),
          message: dialog.message()
        });
        await dialog.dismiss();
      }
    });

    this.page.on('pageerror', (error: Error) => {
      this.logger.error('Page error', { error: error.message, stack: error.stack });
    });

    this.page.on('request', (request) => {
      this.logger.debug(`Request: ${request.method()} ${request.url()}`);
    });
  }
}
