/**
 * ElectronLauncher test suite
 *
 * Tests lifecycle management: launch, close, process info, and event listeners.
 * Uses manual mocks for playwright._electron to avoid real process spawning.
 */

// Must be declared before imports so jest.mock is hoisted
jest.mock('playwright', () => {
  const { EventEmitter } = require('events');

  class MockPage extends EventEmitter {
    private _url = 'app://main';
    private _title = 'Test App';
    public defaultTimeout = 30000;

    url() { return this._url; }
    async title() { return this._title; }
    context() { return mockContext; }
    setDefaultTimeout(t: number) { this.defaultTimeout = t; }
    async goto(url: string) { this._url = url; }
    async waitForTimeout() {}
    async screenshot() { return Buffer.from(''); }
    locator(sel: string) { return mockLocator; }
    async waitForSelector() {}
    async click() {}
    async $() { return null; }
    async $$() { return []; }
    async evaluate(fn: () => any) { return fn(); }
    async textContent() { return ''; }
    on(ev: string, h: any) { return super.on(ev, h); }
    once(ev: string, h: any) { return super.once(ev, h); }
  }

  const mockLocator = {
    click: jest.fn().mockResolvedValue(undefined),
    fill: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    waitFor: jest.fn().mockResolvedValue(undefined),
    inputValue: jest.fn().mockResolvedValue(''),
    textContent: jest.fn().mockResolvedValue(''),
    all: jest.fn().mockResolvedValue([]),
    scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined),
  };

  const mockContext = {
    pages: jest.fn().mockReturnValue([]),
  };

  class MockElectronApp extends EventEmitter {
    private _pid = 12345;
    public page: MockPage | null = new MockPage();

    async firstWindow() { return this.page; }
    async evaluate(fn: () => any) { return fn(); }
    async close() {
      this.page = null;
    }
  }

  const mockElectronApp = new MockElectronApp();

  const _electron = {
    launch: jest.fn().mockResolvedValue(mockElectronApp),
    __mockApp: mockElectronApp,
    __MockPage: MockPage,
    __mockLocator: mockLocator,
    __mockContext: mockContext,
  };

  return { _electron, ElectronApplication: class {}, Page: class {}, BrowserContext: class {}, ConsoleMessage: class {}, Dialog: class {} };
});

jest.mock('fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import * as fs from 'fs/promises';
import { _electron as electron } from 'playwright';
import { ElectronLauncher } from '../../electron/ElectronLauncher';
import { ElectronUIAgentConfig } from '../../electron/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockApp, __MockPage } = require('playwright')._electron;

function makeConfig(overrides: Partial<ElectronUIAgentConfig> = {}): ElectronUIAgentConfig {
  return {
    executablePath: '/usr/bin/electron-app',
    launchTimeout: 5000,
    defaultTimeout: 3000,
    args: ['--no-sandbox'],
    env: { NODE_ENV: 'test' },
    ...overrides,
  };
}

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    scenarioStart: jest.fn(),
    scenarioEnd: jest.fn(),
    stepExecution: jest.fn(),
    stepComplete: jest.fn(),
    screenshot: jest.fn(),
  } as any;
}

describe('ElectronLauncher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock app to have a fresh page
    __mockApp.page = new __MockPage();
    (electron.launch as jest.Mock).mockResolvedValue(__mockApp);
  });

  // ------------------------------------------------------------------ launch
  describe('launch()', () => {
    it('calls _electron.launch with executablePath, args, env, timeout', async () => {
      const config = makeConfig();
      const launcher = new ElectronLauncher(config, makeLogger());

      await launcher.launch();

      expect(electron.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          executablePath: '/usr/bin/electron-app',
          args: ['--no-sandbox'],
          timeout: 5000,
        })
      );
    });

    it('merges process.env with config.env when launching', async () => {
      const config = makeConfig({ env: { CUSTOM_VAR: 'hello' } });
      const launcher = new ElectronLauncher(config, makeLogger());

      await launcher.launch();

      const callArgs = (electron.launch as jest.Mock).mock.calls[0][0];
      expect(callArgs.env).toMatchObject({ CUSTOM_VAR: 'hello' });
    });

    it('enables video recording when recordVideo is true', async () => {
      const config = makeConfig({ recordVideo: true, videoDir: './videos' });
      const launcher = new ElectronLauncher(config, makeLogger());

      await launcher.launch();

      const callArgs = (electron.launch as jest.Mock).mock.calls[0][0];
      expect(callArgs.recordVideo).toEqual({ dir: './videos' });
    });

    it('defaults video dir to ./videos when recordVideo is true but videoDir is absent', async () => {
      const config = makeConfig({ recordVideo: true, videoDir: undefined });
      const launcher = new ElectronLauncher(config, makeLogger());

      await launcher.launch();

      const callArgs = (electron.launch as jest.Mock).mock.calls[0][0];
      expect(callArgs.recordVideo).toEqual({ dir: './videos' });
    });

    it('does not set recordVideo when config.recordVideo is false', async () => {
      const config = makeConfig({ recordVideo: false });
      const launcher = new ElectronLauncher(config, makeLogger());

      await launcher.launch();

      const callArgs = (electron.launch as jest.Mock).mock.calls[0][0];
      expect(callArgs.recordVideo).toBeUndefined();
    });

    it('sets up page event listeners after launch', async () => {
      const config = makeConfig();
      const launcher = new ElectronLauncher(config, makeLogger());

      await launcher.launch();

      // Page should be set and event listeners registered (page is an EventEmitter)
      expect(launcher.page).not.toBeNull();
      expect((launcher.page as any).listenerCount('console')).toBeGreaterThan(0);
      expect((launcher.page as any).listenerCount('dialog')).toBeGreaterThan(0);
    });

    it('console event: stores messages and calls logger methods', async () => {
      const logger = makeLogger();
      const launcher = new ElectronLauncher(makeConfig(), logger);
      await launcher.launch();

      const consoleMsgError = { type: () => 'error', text: () => 'an error' };
      const consoleMsgWarn = { type: () => 'warning', text: () => 'a warning' };
      const consoleMsgInfo = { type: () => 'log', text: () => 'info' };

      launcher.page!.emit('console', consoleMsgError);
      launcher.page!.emit('console', consoleMsgWarn);
      launcher.page!.emit('console', consoleMsgInfo);

      expect(launcher.consoleMessages).toHaveLength(3);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('an error'));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('a warning'));
      expect(logger.debug).toHaveBeenCalled();
    });

    it('dialog event (alert): auto-accepts and emits dialog event', async () => {
      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      await launcher.launch();

      const dialogSpy = jest.fn();
      launcher.on('dialog', dialogSpy);

      const mockDialog = {
        type: () => 'alert',
        message: () => 'Hello!',
        accept: jest.fn().mockResolvedValue(undefined),
        dismiss: jest.fn().mockResolvedValue(undefined),
      };

      launcher.page!.emit('dialog', mockDialog);
      await new Promise(r => setTimeout(r, 0)); // flush microtasks

      expect(mockDialog.accept).toHaveBeenCalledTimes(1);
      expect(mockDialog.dismiss).not.toHaveBeenCalled();
      expect(dialogSpy).toHaveBeenCalledWith({ type: 'alert', message: 'Hello!' });
    });

    it('dialog event (confirm): dismisses and logs warning — regression for non-alert handling', async () => {
      const logger = makeLogger();
      const launcher = new ElectronLauncher(makeConfig(), logger);
      await launcher.launch();

      const mockDialog = {
        type: () => 'confirm',
        message: () => 'Are you sure?',
        accept: jest.fn().mockResolvedValue(undefined),
        dismiss: jest.fn().mockResolvedValue(undefined),
      };

      launcher.page!.emit('dialog', mockDialog);
      await new Promise(r => setTimeout(r, 0));

      expect(mockDialog.dismiss).toHaveBeenCalledTimes(1);
      expect(mockDialog.accept).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Non-alert dialog dismissed'),
        expect.any(Object)
      );
    });

    it('dialog event (prompt): dismisses — regression for non-alert handling', async () => {
      const logger = makeLogger();
      const launcher = new ElectronLauncher(makeConfig(), logger);
      await launcher.launch();

      const mockDialog = {
        type: () => 'prompt',
        message: () => 'Enter value',
        accept: jest.fn().mockResolvedValue(undefined),
        dismiss: jest.fn().mockResolvedValue(undefined),
      };

      launcher.page!.emit('dialog', mockDialog);
      await new Promise(r => setTimeout(r, 0));

      expect(mockDialog.dismiss).toHaveBeenCalledTimes(1);
      expect(mockDialog.accept).not.toHaveBeenCalled();
    });

    it('throws when _electron.launch rejects', async () => {
      (electron.launch as jest.Mock).mockRejectedValueOnce(new Error('spawn failed'));

      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      await expect(launcher.launch()).rejects.toThrow('spawn failed');
    });

    it('throws "No main window found" when firstWindow returns null', async () => {
      const appWithNoWindow = { firstWindow: jest.fn().mockResolvedValue(null) };
      (electron.launch as jest.Mock).mockResolvedValueOnce(appWithNoWindow);

      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      await expect(launcher.launch()).rejects.toThrow('No main window found');
    });
  });

  // ------------------------------------------------------------------- close
  describe('close()', () => {
    it('calls electronApp.close() and nulls page/app/context', async () => {
      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      await launcher.launch();

      const closeSpy = jest.spyOn(__mockApp, 'close');
      await launcher.close();

      expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(launcher.app).toBeNull();
      expect(launcher.page).toBeNull();
      expect(launcher.context).toBeNull();
    });

    it('is safe to call when app is already null (no-op)', async () => {
      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      // Do NOT launch — app is null from the start
      await expect(launcher.close()).resolves.toBeUndefined();
      expect(launcher.app).toBeNull();
    });

    it('is safe to call twice (second call is no-op)', async () => {
      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      await launcher.launch();

      const closeSpy = jest.spyOn(__mockApp, 'close');
      await launcher.close();
      await launcher.close(); // second call — app is already null

      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------ forceClose
  describe('forceClose()', () => {
    it('closes app without throwing even if close() rejects', async () => {
      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      await launcher.launch();

      jest.spyOn(__mockApp, 'close').mockRejectedValueOnce(new Error('already closed'));
      await expect(launcher.forceClose()).resolves.toBeUndefined();
      expect(launcher.app).toBeNull();
    });
  });

  // ---------------------------------------------- validateExecutablePath
  describe('validateExecutablePath()', () => {
    it('resolves when fs.access succeeds', async () => {
      (fs.access as jest.Mock).mockResolvedValueOnce(undefined);
      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      await expect(launcher.validateExecutablePath()).resolves.toBeUndefined();
    });

    it('throws descriptive error when executable is not found', async () => {
      (fs.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));
      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      await expect(launcher.validateExecutablePath()).rejects.toThrow(
        'Electron executable not found: /usr/bin/electron-app'
      );
    });
  });

  // ---------------------------------------------------- getProcessInfo
  describe('getProcessInfo()', () => {
    it('returns undefined when app is null', async () => {
      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      const info = await launcher.getProcessInfo();
      expect(info).toBeUndefined();
    });

    it('returns ProcessInfo with pid, name, status, startTime when app is running', async () => {
      const launcher = new ElectronLauncher(makeConfig(), makeLogger());
      await launcher.launch();

      // mock evaluate to return a deterministic pid
      jest.spyOn(__mockApp, 'evaluate').mockResolvedValueOnce(42);
      const info = await launcher.getProcessInfo();

      expect(info).toBeDefined();
      expect(info!.pid).toBe(42);
      expect(info!.name).toBe('electron');
      expect(info!.status).toBe('running');
      expect(info!.startTime).toBeInstanceOf(Date);
    });

    it('returns undefined and logs debug when evaluate throws', async () => {
      const logger = makeLogger();
      const launcher = new ElectronLauncher(makeConfig(), logger);
      await launcher.launch();

      jest.spyOn(__mockApp, 'evaluate').mockRejectedValueOnce(new Error('eval error'));
      const info = await launcher.getProcessInfo();

      expect(info).toBeUndefined();
      expect(logger.debug).toHaveBeenCalled();
    });
  });
});
