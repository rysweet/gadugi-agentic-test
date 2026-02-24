/**
 * ElectronPageInteractor test suite
 *
 * Verifies page interaction methods: navigate, click, fill, screenshot,
 * waitForSelector, text assertions, getElements, and executeStep dispatch.
 */

jest.mock('../../electron/ElectronPageInteractor', () => {
  // We import the real module — no mock replacement needed.
  // This empty mock block keeps jest from auto-mocking dependencies.
  return jest.requireActual('../../electron/ElectronPageInteractor');
});

// Mock the screenshot module so we don't need a real filesystem
jest.mock('../../../utils/screenshot', () => {
  const metadata = {
    fileName: 'shot.png',
    filePath: '/tmp/shot.png',
    timestamp: new Date(),
    scenarioId: undefined,
    fileSize: 100,
  };
  return {
    createScreenshotManager: jest.fn(() => ({
      capturePageScreenshot: jest.fn().mockResolvedValue(metadata),
      getScreenshotsByScenario: jest.fn().mockReturnValue([metadata]),
      exportMetadata: jest.fn().mockResolvedValue('/tmp/meta.json'),
    })),
    ScreenshotManager: class {},
  };
});

// Mock ids.ts so stateSnapshot IDs are deterministic
jest.mock('../../../utils/ids', () => ({
  generateId: jest.fn().mockReturnValue('test-id-001'),
}));

import { ElectronPageInteractor, StepLifecycleCallbacks } from '../../electron/ElectronPageInteractor';
import { ElectronUIAgentConfig } from '../../electron/types';
import { TestStatus } from '../../../models/TestModels';
import { createScreenshotManager } from '../../../utils/screenshot';

function makeConfig(overrides: Partial<ElectronUIAgentConfig> = {}): ElectronUIAgentConfig {
  return {
    executablePath: '/usr/bin/electron-app',
    defaultTimeout: 3000,
    screenshotConfig: {
      mode: 'only-on-failure',
      directory: './screenshots',
      fullPage: true,
    },
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

/** Build a minimal Page mock with spy-able methods */
function makePage() {
  const locatorMock = {
    waitFor: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    fill: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    inputValue: jest.fn().mockResolvedValue('filled-value'),
    textContent: jest.fn().mockResolvedValue('element text'),
    scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined),
    all: jest.fn().mockResolvedValue(['el1', 'el2']),
  };

  return {
    goto: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn().mockReturnValue(locatorMock),
    click: jest.fn().mockResolvedValue(undefined),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(null),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('')),
    url: jest.fn().mockReturnValue('app://main'),
    title: jest.fn().mockResolvedValue('App Title'),
    __locator: locatorMock,
  };
}

/** Build a ScreenshotManager mock via the mocked factory */
function makeScreenshotManager() {
  return (createScreenshotManager as jest.Mock)();
}

function makeCallbacks(): StepLifecycleCallbacks {
  return {
    onLaunch: jest.fn().mockResolvedValue(undefined),
    onClose: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ElectronPageInteractor', () => {
  let page: ReturnType<typeof makePage>;
  let screenshotMgr: ReturnType<typeof makeScreenshotManager>;
  let interactor: ElectronPageInteractor;

  beforeEach(() => {
    jest.clearAllMocks();
    page = makePage();
    screenshotMgr = makeScreenshotManager();
    interactor = new ElectronPageInteractor(makeConfig(), makeLogger(), screenshotMgr as any);
  });

  // ---------------------------------------------------------------- fillInput
  describe('fillInput()', () => {
    it('calls locator().fill() with the provided value', async () => {
      await interactor.fillInput(page as any, '#name', 'Alice');

      expect(page.locator).toHaveBeenCalledWith('#name');
      expect(page.__locator.fill).toHaveBeenCalledWith('Alice');
    });

    it('calls locator().clear() before fill()', async () => {
      const callOrder: string[] = [];
      page.__locator.clear.mockImplementation(() => { callOrder.push('clear'); return Promise.resolve(); });
      page.__locator.fill.mockImplementation(() => { callOrder.push('fill'); return Promise.resolve(); });

      await interactor.fillInput(page as any, '#field', 'value');

      expect(callOrder).toEqual(['clear', 'fill']);
    });

    it('throws wrapped error when locator().fill() rejects', async () => {
      page.__locator.waitFor.mockRejectedValueOnce(new Error('element not found'));

      await expect(interactor.fillInput(page as any, '#missing', 'v'))
        .rejects.toThrow('Failed to fill input');
    });
  });

  // --------------------------------------------------------------- clickButton
  describe('clickButton()', () => {
    it('calls locator().click()', async () => {
      await interactor.clickButton(page as any, '#submit');

      expect(page.locator).toHaveBeenCalledWith('#submit');
      expect(page.__locator.click).toHaveBeenCalledTimes(1);
    });

    it('calls scrollIntoViewIfNeeded before click', async () => {
      const callOrder: string[] = [];
      page.__locator.scrollIntoViewIfNeeded.mockImplementation(() => { callOrder.push('scroll'); return Promise.resolve(); });
      page.__locator.click.mockImplementation(() => { callOrder.push('click'); return Promise.resolve(); });

      await interactor.clickButton(page as any, '#btn');

      expect(callOrder).toEqual(['scroll', 'click']);
    });

    it('throws wrapped error when locator throws', async () => {
      page.__locator.waitFor.mockRejectedValueOnce(new Error('button missing'));

      await expect(interactor.clickButton(page as any, '#gone'))
        .rejects.toThrow('Failed to click button');
    });
  });

  // ----------------------------------------------------------- waitForElement
  describe('waitForElement()', () => {
    it('calls locator().waitFor() with visible state by default', async () => {
      await interactor.waitForElement(page as any, '.modal');

      expect(page.locator).toHaveBeenCalledWith('.modal');
      expect(page.__locator.waitFor).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'visible' })
      );
    });

    it('passes custom state and timeout to waitFor', async () => {
      await interactor.waitForElement(page as any, '.loader', { state: 'detached', timeout: 1500 });

      expect(page.__locator.waitFor).toHaveBeenCalledWith({ state: 'detached', timeout: 1500 });
    });

    it('throws wrapped error when element not found', async () => {
      page.__locator.waitFor.mockRejectedValueOnce(new Error('timeout'));

      await expect(interactor.waitForElement(page as any, '.ghost'))
        .rejects.toThrow('Element ".ghost" not found');
    });
  });

  // --------------------------------------------------------------- getElementText
  describe('getElementText()', () => {
    it('returns text content from the element', async () => {
      page.__locator.textContent.mockResolvedValueOnce('Hello World');

      const text = await interactor.getElementText(page as any, '#heading');

      expect(page.locator).toHaveBeenCalledWith('#heading');
      expect(text).toBe('Hello World');
    });

    it('returns empty string when textContent is null', async () => {
      page.__locator.textContent.mockResolvedValueOnce(null);

      const text = await interactor.getElementText(page as any, '#empty');

      expect(text).toBe('');
    });

    it('throws wrapped error when locator throws', async () => {
      page.__locator.waitFor.mockRejectedValueOnce(new Error('not found'));

      await expect(interactor.getElementText(page as any, '#gone'))
        .rejects.toThrow('Failed to get text from element');
    });
  });

  // ---------------------------------------------------------------- screenshot
  describe('screenshot()', () => {
    it('calls screenshotManager.capturePageScreenshot with name and scenarioId', async () => {
      const meta = await interactor.screenshot(page as any, 'my-shot', 'scenario-1');

      expect(screenshotMgr.capturePageScreenshot).toHaveBeenCalledWith(
        page,
        expect.objectContaining({ description: 'my-shot', scenarioId: 'scenario-1' })
      );
      expect(meta.fileName).toBe('shot.png');
    });

    it('rethrows errors from screenshotManager', async () => {
      screenshotMgr.capturePageScreenshot.mockRejectedValueOnce(new Error('disk full'));

      await expect(interactor.screenshot(page as any, 'fail-shot'))
        .rejects.toThrow('disk full');
    });
  });

  // ------------------------------------------------------- captureFailureScreenshot
  describe('captureFailureScreenshot()', () => {
    it('is a no-op when page is null', async () => {
      await expect(interactor.captureFailureScreenshot(null)).resolves.toBeUndefined();
      expect(screenshotMgr.capturePageScreenshot).not.toHaveBeenCalled();
    });

    it('is a no-op when screenshotConfig.mode is "off"', async () => {
      const interactorOff = new ElectronPageInteractor(
        makeConfig({ screenshotConfig: { mode: 'off', directory: '.', fullPage: false } }),
        makeLogger(),
        screenshotMgr as any
      );

      await interactorOff.captureFailureScreenshot(page as any);
      expect(screenshotMgr.capturePageScreenshot).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------- getScenarioScreenshots
  describe('getScenarioScreenshots()', () => {
    it('returns empty array when scenarioId is undefined', () => {
      expect(interactor.getScenarioScreenshots(undefined)).toEqual([]);
    });

    it('delegates to screenshotManager.getScreenshotsByScenario', () => {
      const paths = interactor.getScenarioScreenshots('scen-1');
      expect(screenshotMgr.getScreenshotsByScenario).toHaveBeenCalledWith('scen-1');
      expect(paths).toEqual(['/tmp/shot.png']);
    });
  });

  // ---------------------------------------------------------------- executeStep
  describe('executeStep()', () => {
    const callbacks = makeCallbacks();

    it('dispatches "navigate" action via page.goto', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'navigate', target: 'https://example.com' },
        0, undefined, 3000, callbacks
      );

      expect(page.goto).toHaveBeenCalledWith('https://example.com');
      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('dispatches "click" action via clickButton', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'click', target: '#btn' },
        1, undefined, 3000, callbacks
      );

      expect(page.locator).toHaveBeenCalledWith('#btn');
      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('dispatches "click_button" action alias via clickButton', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'click_button', target: '#link' },
        1, undefined, 3000, callbacks
      );

      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('dispatches "fill" action via fillInput', async () => {
      page.__locator.inputValue.mockResolvedValueOnce('test-val');

      const result = await interactor.executeStep(
        page as any,
        { action: 'fill', target: '#input', value: 'test-val' },
        2, undefined, 3000, callbacks
      );

      expect(page.__locator.fill).toHaveBeenCalledWith('test-val');
      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('dispatches "type" action alias for fill', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'type', target: '#input', value: 'typed' },
        2, undefined, 3000, callbacks
      );

      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('fill action: returns FAILED when value is missing', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'fill', target: '#input', value: undefined },
        2, undefined, 3000, callbacks
      );

      expect(result.status).toBe(TestStatus.FAILED);
      expect(result.error).toContain('Fill action requires a value');
    });

    it('dispatches "screenshot" action', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'screenshot', target: 'my-screenshot' },
        3, 'scen-1', 3000, callbacks
      );

      expect(screenshotMgr.capturePageScreenshot).toHaveBeenCalled();
      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('dispatches "wait_for_element" action', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'wait_for_element', target: '.spinner' },
        4, undefined, 3000, callbacks
      );

      expect(page.__locator.waitFor).toHaveBeenCalled();
      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('dispatches "wait_for" alias for wait_for_element', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'wait_for', target: '.spinner' },
        4, undefined, 3000, callbacks
      );

      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('dispatches "get_text" action and returns text', async () => {
      page.__locator.textContent.mockResolvedValueOnce('result text');

      const result = await interactor.executeStep(
        page as any,
        { action: 'get_text', target: '#heading' },
        5, undefined, 3000, callbacks
      );

      expect(result.status).toBe(TestStatus.PASSED);
      expect(result.actualResult).toBe('result text');
    });

    it('dispatches "wait" action with timeout value', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'wait', target: '', value: '500' },
        6, undefined, 3000, callbacks
      );

      expect(page.waitForTimeout).toHaveBeenCalledWith(500);
      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('dispatches "launch" action via callbacks.onLaunch', async () => {
      const cbs = makeCallbacks();
      const result = await interactor.executeStep(
        page as any,
        { action: 'launch', target: '' },
        7, undefined, 3000, cbs
      );

      expect(cbs.onLaunch).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('dispatches "close" action via callbacks.onClose', async () => {
      const cbs = makeCallbacks();
      const result = await interactor.executeStep(
        page as any,
        { action: 'close', target: '' },
        8, undefined, 3000, cbs
      );

      expect(cbs.onClose).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('returns FAILED status for unsupported action', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'teleport', target: 'mars' },
        9, undefined, 3000, callbacks
      );

      expect(result.status).toBe(TestStatus.FAILED);
      expect(result.error).toContain('Unsupported action: teleport');
    });

    it('returns FAILED status when action throws', async () => {
      page.__locator.waitFor.mockRejectedValueOnce(new Error('element gone'));

      const result = await interactor.executeStep(
        page as any,
        { action: 'click', target: '#gone' },
        10, undefined, 3000, callbacks
      );

      expect(result.status).toBe(TestStatus.FAILED);
      expect(result.error).toContain('Failed to click button');
    });

    it('result includes stepIndex and duration', async () => {
      const result = await interactor.executeStep(
        page as any,
        { action: 'navigate', target: 'app://home' },
        42, undefined, 3000, callbacks
      );

      expect(result.stepIndex).toBe(42);
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------- clickTab
  describe('clickTab()', () => {
    it('tries multiple selector strategies until one succeeds', async () => {
      // Fail first 3 selectors, succeed on 4th (button:has-text)
      let callCount = 0;
      page.click = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 4) return Promise.reject(new Error('not found'));
        return Promise.resolve();
      });

      await expect(interactor.clickTab(page as any, 'Settings')).resolves.toBeUndefined();
    });

    it('throws when no selector strategy matches', async () => {
      page.click = jest.fn().mockRejectedValue(new Error('not found'));

      await expect(interactor.clickTab(page as any, 'Ghost'))
        .rejects.toThrow('Failed to click tab "Ghost"');
    });
  });
});
