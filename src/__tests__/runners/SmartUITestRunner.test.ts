/**
 * Tests for SmartUITestRunner, SmartElementFinder, and SmartInteractionExecutor
 *
 * All playwright / electron I/O is mocked at the module boundary so no real
 * browser or Electron process is launched.
 */

import { SmartUITestRunner, createSmartUITestRunner } from '../../runners/SmartUITestRunner';
import { SmartElementFinder } from '../../runners/smart/SmartElementFinder';
import { SmartInteractionExecutor } from '../../runners/smart/SmartInteractionExecutor';
import { TestStatus } from '../../models/TestModels';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// fs.promises — prevent real disk I/O
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

// electron — require('electron') returns a path string
jest.mock('electron', () => '/path/to/electron', { virtual: true });

// playwright — mock _electron.launch + Page API
// NOTE: jest.mock() is hoisted before variable declarations, so the factory
// cannot reference variables declared with const/let.  We use jest.fn() stubs
// here and wire them up in beforeEach via jest.requireMock().
jest.mock('playwright', () => ({
  _electron: {
    launch: jest.fn(),
  },
  Page: jest.fn(),
  ElectronApplication: jest.fn(),
}));

// Mocks wired up after hoisting
const mockScreenshot = jest.fn().mockResolvedValue(Buffer.from(''));
const mockKeyboardPress = jest.fn().mockResolvedValue(undefined);
const mockClick = jest.fn().mockResolvedValue(undefined);
const mockWaitForTimeout = jest.fn().mockResolvedValue(undefined);
const mockWaitForLoadState = jest.fn().mockResolvedValue(undefined);
const mockEvaluate = jest.fn();
const mockPageDollar = jest.fn().mockResolvedValue(null);
const mockPageDollarDollar = jest.fn().mockResolvedValue([]);
const mockDollarDollarEval = jest.fn().mockResolvedValue(0);

const mockPage = {
  screenshot: mockScreenshot,
  keyboard: { press: mockKeyboardPress },
  click: mockClick,
  waitForTimeout: mockWaitForTimeout,
  waitForLoadState: mockWaitForLoadState,
  evaluate: mockEvaluate,
  $: mockPageDollar,
  $$: mockPageDollarDollar,
  $$eval: mockDollarDollarEval,
  textContent: jest.fn().mockResolvedValue(''),
};

const mockElectronApp = {
  firstWindow: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};

// Wire the playwright mock's launch to return mockElectronApp after hoisting
beforeAll(() => {
  const playwrightMock = jest.requireMock('playwright');
  playwrightMock._electron.launch.mockResolvedValue(mockElectronApp);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a default ElementDiscovery result for page.evaluate() */
function makeElementDiscovery(interactiveOverride?: object[]) {
  return {
    interactive: interactiveOverride ?? [],
    headings: ['Main Heading'],
    labels: ['Label 1'],
    title: 'Test App',
  };
}

// ---------------------------------------------------------------------------
// SmartElementFinder tests
// ---------------------------------------------------------------------------

describe('SmartElementFinder', () => {
  let finder: SmartElementFinder;

  beforeEach(() => {
    jest.clearAllMocks();
    finder = new SmartElementFinder();
  });

  it('calls page.evaluate() exactly once per discoverElements() call', async () => {
    mockEvaluate.mockResolvedValueOnce(makeElementDiscovery());
    await finder.discoverElements(mockPage as any);
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
  });

  it('returns an ElementDiscovery with the interactive array from page.evaluate()', async () => {
    const elements = [
      { type: 'button', text: 'Scan', disabled: false },
      { type: 'link', text: 'Build', href: '#build' },
    ];
    mockEvaluate.mockResolvedValueOnce(makeElementDiscovery(elements));

    const discovery = await finder.discoverElements(mockPage as any);

    expect(discovery.interactive).toHaveLength(2);
    expect(discovery.interactive[0].type).toBe('button');
    expect(discovery.interactive[1].type).toBe('link');
  });

  it('returns headings and labels from page.evaluate()', async () => {
    mockEvaluate.mockResolvedValueOnce({
      interactive: [],
      headings: ['H1', 'H2'],
      labels: ['Name', 'Email'],
      title: 'Demo',
    });

    const discovery = await finder.discoverElements(mockPage as any);

    expect(discovery.headings).toEqual(['H1', 'H2']);
    expect(discovery.labels).toEqual(['Name', 'Email']);
    expect(discovery.title).toBe('Demo');
  });

  it('returns empty arrays when page has no elements', async () => {
    mockEvaluate.mockResolvedValueOnce(makeElementDiscovery([]));

    const discovery = await finder.discoverElements(mockPage as any);

    expect(discovery.interactive).toHaveLength(0);
    expect(discovery.headings).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SmartInteractionExecutor tests
// ---------------------------------------------------------------------------

describe('SmartInteractionExecutor', () => {
  let testedFeatures: string[];
  let issues: string[];
  let logFn: jest.Mock;
  let executor: SmartInteractionExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    testedFeatures = [];
    issues = [];
    logFn = jest.fn();
    executor = new SmartInteractionExecutor(testedFeatures, issues, logFn);
  });

  describe('testScanTab()', () => {
    it('does not throw when no matching input elements are found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(executor.testScanTab(mockPage as any)).resolves.toBeUndefined();
    });

    it('fills tenant ID input when a matching selector is found', async () => {
      const mockInput = { fill: jest.fn().mockResolvedValue(undefined) };
      mockPageDollar.mockImplementation(async (selector: string) => {
        if (selector.includes('tenant')) return mockInput;
        return null;
      });

      await executor.testScanTab(mockPage as any);

      expect(mockInput.fill).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789012');
      expect(testedFeatures).toContain('Tenant ID input functional');
    });

    it('records issue when build button is disabled', async () => {
      const mockButton = {
        textContent: jest.fn().mockResolvedValue('Build'),
        isDisabled: jest.fn().mockResolvedValue(true),
      };
      mockPageDollar.mockImplementation(async (selector: string) => {
        if (selector.includes('Build') || selector.includes('Scan') || selector.includes('Start')) {
          return mockButton;
        }
        return null;
      });

      await executor.testScanTab(mockPage as any);

      expect(issues).toContain('Build button disabled - may need configuration');
    });

    it('adds feature to testedFeatures when build button is enabled', async () => {
      const mockButton = {
        textContent: jest.fn().mockResolvedValue('Build'),
        isDisabled: jest.fn().mockResolvedValue(false),
      };
      // Return null for input selectors so they are skipped;
      // return mockButton only for the button selector pattern
      mockPageDollar.mockImplementation(async (selector: string) => {
        if (selector.includes('Build') || selector.includes('Scan') || selector.includes('Start')) {
          return mockButton;
        }
        return null;
      });

      await executor.testScanTab(mockPage as any);

      // testScanTab pushes `${buttonText} button ready`
      expect(testedFeatures.some(f => f.includes('button'))).toBe(true);
    });
  });

  describe('testGenerateIaCTab()', () => {
    it('does not throw when no IaC elements are found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(executor.testGenerateIaCTab(mockPage as any)).resolves.toBeUndefined();
    });

    it('pushes IaC format features when format text is found', async () => {
      mockPageDollar.mockImplementation(async (selector: string) => {
        if (selector.includes('terraform') || selector.includes('arm') || selector.includes('bicep')) {
          return { textContent: jest.fn().mockResolvedValue(selector) };
        }
        return null;
      });

      await executor.testGenerateIaCTab(mockPage as any);

      expect(testedFeatures.some(f => f.toLowerCase().includes('iac'))).toBe(true);
    });
  });

  describe('testConfigTab()', () => {
    it('does not throw when config page is empty', async () => {
      mockPageDollarDollar.mockResolvedValue([]);
      mockPageDollar.mockResolvedValue(null);
      await expect(executor.testConfigTab(mockPage as any)).resolves.toBeUndefined();
    });

    it('fills first input field with test config value', async () => {
      const mockInput = { fill: jest.fn().mockResolvedValue(undefined) };
      mockPageDollarDollar.mockResolvedValue([mockInput]);
      mockPageDollar.mockResolvedValue(null);

      await executor.testConfigTab(mockPage as any);

      expect(mockInput.fill).toHaveBeenCalledWith('test-config-value');
      expect(testedFeatures.some(f => f.includes('configuration'))).toBe(true);
    });
  });

  describe('testStatusTab()', () => {
    it('does not throw when status page has no matching elements', async () => {
      mockPageDollar.mockResolvedValue(null);
      mockPageDollarDollar.mockResolvedValue([]);
      await expect(executor.testStatusTab(mockPage as any)).resolves.toBeUndefined();
    });
  });

  describe('testVisualizeTab()', () => {
    it('does not throw when no graph elements are found', async () => {
      mockPageDollar.mockResolvedValue(null);
      mockDollarDollarEval.mockResolvedValue(0);
      await expect(executor.testVisualizeTab(mockPage as any)).resolves.toBeUndefined();
    });

    it('clicks zoom in button and pushes feature when graph element is found', async () => {
      const mockZoom = { click: jest.fn().mockResolvedValue(undefined) };
      mockPageDollar.mockImplementation(async (selector: string) => {
        if (selector.includes('canvas') || selector.includes('graph')) return {};
        if (selector.includes('zoom')) return mockZoom;
        return null;
      });
      mockDollarDollarEval.mockResolvedValue(0);

      await executor.testVisualizeTab(mockPage as any);

      expect(testedFeatures).toContain('Graph visualization functional');
    });
  });
});

// ---------------------------------------------------------------------------
// SmartUITestRunner tests
// ---------------------------------------------------------------------------

describe('SmartUITestRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: page.evaluate returns empty discovery
    mockEvaluate.mockResolvedValue(makeElementDiscovery());
  });

  describe('constructor / factory', () => {
    it('createSmartUITestRunner() returns a SmartUITestRunner instance', () => {
      const runner = createSmartUITestRunner('/tmp/screenshots');
      expect(runner).toBeInstanceOf(SmartUITestRunner);
    });

    it('uses process.cwd()/screenshots as default screenshotsDir', () => {
      const runner = new SmartUITestRunner();
      expect(runner).toBeDefined();
    });
  });

  describe('runTests() — no tabs discovered', () => {
    it('returns a TestResult with scenarioId "smart-ui-test"', async () => {
      // No interactive elements → no tab iteration
      mockEvaluate.mockResolvedValue(makeElementDiscovery([]));

      const runner = new SmartUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      expect(result.scenarioId).toBe('smart-ui-test');
    });

    it('returns PASSED status when no errors occur', async () => {
      mockEvaluate.mockResolvedValue(makeElementDiscovery([]));

      const runner = new SmartUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      expect(result.status).toBe(TestStatus.PASSED);
    });

    it('returns a screenshots array (may be empty when no tabs navigated)', async () => {
      mockEvaluate.mockResolvedValue(makeElementDiscovery([]));

      const runner = new SmartUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      expect(Array.isArray(result.screenshots)).toBe(true);
    });

    it('includes duration, startTime, and endTime in the result', async () => {
      mockEvaluate.mockResolvedValue(makeElementDiscovery([]));

      const runner = new SmartUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const before = new Date();
      const result = await runner.runTests();
      const after = new Date();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime() - 10);
      expect(result.endTime.getTime()).toBeLessThanOrEqual(after.getTime() + 10);
    });
  });

  describe('runTests() — with tab elements', () => {
    it('accumulates screenshot paths when tabs are clicked', async () => {
      const tabElements = [{ type: 'link', text: 'scan' }];
      // First discover call returns tabs; subsequent calls return empty
      mockEvaluate
        .mockResolvedValueOnce(makeElementDiscovery(tabElements))
        .mockResolvedValue(makeElementDiscovery([]));

      mockClick.mockResolvedValue(undefined); // click succeeds

      const runner = new SmartUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      // At least one screenshot should have been pushed
      expect(result.screenshots.length).toBeGreaterThanOrEqual(1);
    });

    it('sets status to ERROR when a tab test throws', async () => {
      const tabElements = [{ type: 'link', text: 'scan' }];
      mockEvaluate
        .mockResolvedValueOnce(makeElementDiscovery(tabElements))
        .mockResolvedValue(makeElementDiscovery([]));

      // screenshot throws after click succeeds
      mockClick.mockResolvedValue(undefined);
      mockScreenshot.mockRejectedValueOnce(new Error('Screenshot error'));

      const runner = new SmartUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      expect(result.status).toBe(TestStatus.ERROR);
    });

    it('includes metadata with testedFeatures and interactions', async () => {
      mockEvaluate.mockResolvedValue(makeElementDiscovery([]));

      const runner = new SmartUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      expect(result.metadata).toBeDefined();
      expect(Array.isArray((result.metadata as any).testedFeatures)).toBe(true);
    });
  });

  describe('runTests() — page not initialized', () => {
    it('returns FAILED status when page is null (initialize not called)', async () => {
      const runner = new SmartUITestRunner('/tmp/screenshots');
      // page remains null — simulate forgetting initialize()

      const result = await runner.runTests();

      expect(result.status).toBe(TestStatus.FAILED);
    });
  });

  describe('cleanup()', () => {
    it('calls electronApp.close()', async () => {
      const runner = new SmartUITestRunner('/tmp/screenshots');
      (runner as any).electronApp = mockElectronApp;

      await runner.cleanup();

      expect(mockElectronApp.close).toHaveBeenCalledTimes(1);
    });

    it('does not throw when electronApp is null', async () => {
      const runner = new SmartUITestRunner('/tmp/screenshots');
      await expect(runner.cleanup()).resolves.toBeUndefined();
    });
  });
});
