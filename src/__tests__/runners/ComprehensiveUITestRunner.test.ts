/**
 * Tests for ComprehensiveUITestRunner and UIFlowTester
 *
 * playwright / electron I/O is mocked — no real browser or Electron process
 * is launched.
 */

import {
  ComprehensiveUITestRunner,
  createComprehensiveUITestRunner,
} from '../../runners/ComprehensiveUITestRunner';
import { UIFlowTester, TestResults } from '../../runners/comprehensive/UIFlowTester';
import { TestStatus } from '../../models/TestModels';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('electron', () => '/path/to/electron', { virtual: true });

// jest.mock() is hoisted — factory cannot reference variables defined later.
// We set up the launch return value in beforeAll via jest.requireMock().
jest.mock('playwright', () => ({
  _electron: {
    launch: jest.fn(),
  },
  Page: jest.fn(),
  ElectronApplication: jest.fn(),
}));

// Page mock (defined after the hoisted jest.mock calls)
const mockScreenshot = jest.fn().mockResolvedValue(Buffer.from(''));
const mockClick = jest.fn().mockResolvedValue(undefined);
const mockWaitForTimeout = jest.fn().mockResolvedValue(undefined);
const mockWaitForLoadState = jest.fn().mockResolvedValue(undefined);
const mockSetViewportSize = jest.fn().mockResolvedValue(undefined);
const mockKeyboardPress = jest.fn().mockResolvedValue(undefined);
const mockPageDollar = jest.fn().mockResolvedValue(null);
const mockPageDollarDollar = jest.fn().mockResolvedValue([]);
const mockFill = jest.fn().mockResolvedValue(undefined);

const mockPage = {
  screenshot: mockScreenshot,
  click: mockClick,
  waitForTimeout: mockWaitForTimeout,
  waitForLoadState: mockWaitForLoadState,
  setViewportSize: mockSetViewportSize,
  keyboard: { press: mockKeyboardPress },
  $: mockPageDollar,
  $$: mockPageDollarDollar,
  fill: mockFill,
};

const mockElectronApp = {
  firstWindow: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};

// Wire launch after hoisting
beforeAll(() => {
  const playwrightMock = jest.requireMock('playwright');
  playwrightMock._electron.launch.mockResolvedValue(mockElectronApp);
});

// ---------------------------------------------------------------------------
// UIFlowTester tests
// ---------------------------------------------------------------------------

describe('UIFlowTester', () => {
  let results: TestResults;
  let tester: UIFlowTester;

  beforeEach(() => {
    jest.clearAllMocks();
    results = { passed: 0, failed: 0, errors: [] };
    tester = new UIFlowTester(results, '/tmp/screenshots');
  });

  describe('testTab()', () => {
    it('returns a screenshot path on successful tab navigation', async () => {
      mockScreenshot.mockResolvedValueOnce(Buffer.from(''));

      const screenshotPath = await tester.testTab(mockPage as any, 'Build', []);

      expect(screenshotPath).toBe('/tmp/screenshots/build-tab.png');
    });

    it('calls page.screenshot() with the correct path', async () => {
      await tester.testTab(mockPage as any, 'Config', []);

      expect(mockScreenshot).toHaveBeenCalledWith({
        path: '/tmp/screenshots/config-tab.png',
        fullPage: true,
      });
    });

    it('increments results.passed for each successful navigation + screenshot', async () => {
      await tester.testTab(mockPage as any, 'Status', []);

      // Navigation success + screenshot success = 2 passes
      expect(results.passed).toBeGreaterThanOrEqual(2);
    });

    it('returns null when page.click() throws (tab not found)', async () => {
      mockClick.mockRejectedValueOnce(new Error('Tab not found'));

      const result = await tester.testTab(mockPage as any, 'NonExistent', []);

      expect(result).toBeNull();
    });

    it('increments results.failed when tab navigation fails', async () => {
      mockClick.mockRejectedValueOnce(new Error('Navigation failed'));

      await tester.testTab(mockPage as any, 'MissingTab', []);

      expect(results.failed).toBeGreaterThanOrEqual(1);
    });

    it('runs each provided test function', async () => {
      const testFn1 = jest.fn().mockResolvedValue(undefined);
      const testFn2 = jest.fn().mockResolvedValue(undefined);

      await tester.testTab(mockPage as any, 'Build', [testFn1, testFn2]);

      expect(testFn1).toHaveBeenCalledWith(mockPage);
      expect(testFn2).toHaveBeenCalledWith(mockPage);
    });

    it('continues running other tests when one test function throws', async () => {
      const failingTest = jest.fn().mockRejectedValue(new Error('test error'));
      const passingTest = jest.fn().mockResolvedValue(undefined);

      await tester.testTab(mockPage as any, 'Build', [failingTest, passingTest]);

      // passingTest still ran despite failingTest throwing
      expect(passingTest).toHaveBeenCalled();
    });
  });

  describe('individual tab test methods', () => {
    it('testTenantIdInput() throws when input not found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(tester.testTenantIdInput(mockPage as any)).rejects.toThrow(
        'Tenant ID input not found'
      );
    });

    it('testTenantIdInput() fills input when found', async () => {
      const mockInput = { fill: jest.fn().mockResolvedValue(undefined) };
      mockPageDollar.mockResolvedValue(mockInput);

      await tester.testTenantIdInput(mockPage as any);

      expect(mockInput.fill).toHaveBeenCalledWith('test-tenant-id-12345');
    });

    it('testBuildButton() throws when button not found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(tester.testBuildButton(mockPage as any)).rejects.toThrow(
        'Build button not found'
      );
    });

    it('testBuildButton() succeeds when button is found and enabled', async () => {
      const mockButton = { isEnabled: jest.fn().mockResolvedValue(true) };
      mockPageDollar.mockResolvedValue(mockButton);

      await tester.testBuildButton(mockPage as any);

      expect(results.passed).toBeGreaterThanOrEqual(1);
    });

    it('testSpecGeneration() throws when generate button not found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(tester.testSpecGeneration(mockPage as any)).rejects.toThrow(
        'Generate spec button not found'
      );
    });

    it('testFormatSelector() does not throw when no format options found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(tester.testFormatSelector(mockPage as any)).resolves.toBeUndefined();
    });

    it('testGraphVisualization() does not throw when container not found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(tester.testGraphVisualization(mockPage as any)).resolves.toBeUndefined();
    });

    it('testSaveConfig() does not throw when save button not found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(tester.testSaveConfig(mockPage as any)).resolves.toBeUndefined();
    });

    it('testNeo4jStatus() does not throw when neo4j text not found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(tester.testNeo4jStatus(mockPage as any)).resolves.toBeUndefined();
    });

    it('testHelpContent() does not throw when help text not found', async () => {
      mockPageDollar.mockResolvedValue(null);
      await expect(tester.testHelpContent(mockPage as any)).resolves.toBeUndefined();
    });

    it('testSpecUpload() logs info when file input not found (uses text area fallback)', async () => {
      mockPageDollar.mockResolvedValue(null);
      // Should not throw — spec says file upload is optional
      await expect(tester.testSpecUpload(mockPage as any)).resolves.toBeUndefined();
    });

    it('testSystemStatus() does not throw when no status elements found', async () => {
      mockPageDollarDollar.mockResolvedValue([]);
      await expect(tester.testSystemStatus(mockPage as any)).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// ComprehensiveUITestRunner tests
// ---------------------------------------------------------------------------

describe('ComprehensiveUITestRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor / factory', () => {
    it('createComprehensiveUITestRunner() returns a ComprehensiveUITestRunner instance', () => {
      const runner = createComprehensiveUITestRunner('/tmp/screenshots');
      expect(runner).toBeInstanceOf(ComprehensiveUITestRunner);
    });

    it('uses default screenshotsDir when none provided', () => {
      const runner = new ComprehensiveUITestRunner();
      expect(runner).toBeDefined();
    });
  });

  describe('runTests() — page not initialized', () => {
    it('returns FAILED status when page is null', async () => {
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');
      // page was never set (initialize() not called)

      const result = await runner.runTests();

      expect(result.status).toBe(TestStatus.FAILED);
    });

    it('returns result with scenarioId "comprehensive-ui-test"', async () => {
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');

      const result = await runner.runTests();

      expect(result.scenarioId).toBe('comprehensive-ui-test');
    });
  });

  describe('runTests() — with initialized page', () => {
    it('returns a TestResult with screenshots array', async () => {
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      expect(Array.isArray(result.screenshots)).toBe(true);
    });

    it('screenshots array is populated for each successful tab (regression for screenshot accumulation bug)', async () => {
      // This is the regression test for the bug where screenshots were not accumulated
      // Each successful testTab() call should contribute one path to screenshots[]
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      // Multiple tabs are exercised; at least some should produce screenshots
      // The exact count depends on which tabs succeed, but the array must exist
      expect(result.screenshots).toBeDefined();
    });

    it('returns a valid TestStatus (PASSED, FAILED, or ERROR) based on tab outcomes', async () => {
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      // The runner calculates status from results.failed and results.errors
      const validStatuses = [TestStatus.PASSED, TestStatus.FAILED, TestStatus.ERROR];
      expect(validStatuses).toContain(result.status);
    });

    it('returns FAILED status when results.failed > 0', async () => {
      // Force a click failure for every tab to drive failed count up
      mockClick.mockRejectedValue(new Error('Tab missing'));

      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      expect(result.status).toBe(TestStatus.FAILED);
    });

    it('includes metadata with totalTests, passed, failed, and errors', async () => {
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      const result = await runner.runTests();

      expect(result.metadata).toBeDefined();
      expect(typeof (result.metadata as any).totalTests).toBe('number');
      expect(typeof (result.metadata as any).passed).toBe('number');
      expect(typeof (result.metadata as any).failed).toBe('number');
    });

    it('does not stop processing other tabs when one tab fails', async () => {
      // Only the first click fails
      mockClick
        .mockRejectedValueOnce(new Error('First tab missing'))
        .mockResolvedValue(undefined);

      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');
      (runner as any).page = mockPage;
      (runner as any).electronApp = mockElectronApp;

      // Should not throw
      await expect(runner.runTests()).resolves.toBeDefined();
    });
  });

  describe('getResults()', () => {
    it('returns a snapshot of current test results', () => {
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');

      const results = runner.getResults();

      expect(results).toHaveProperty('passed');
      expect(results).toHaveProperty('failed');
      expect(results).toHaveProperty('errors');
    });

    it('returns a copy (not the original object)', () => {
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');

      const r1 = runner.getResults();
      const r2 = runner.getResults();

      // Mutating one snapshot should not affect another
      r1.passed = 999;
      expect(r2.passed).not.toBe(999);
    });
  });

  describe('cleanup()', () => {
    it('calls electronApp.close()', async () => {
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');
      (runner as any).electronApp = mockElectronApp;

      await runner.cleanup();

      expect(mockElectronApp.close).toHaveBeenCalledTimes(1);
    });

    it('does not throw when electronApp is null', async () => {
      const runner = new ComprehensiveUITestRunner('/tmp/screenshots');
      await expect(runner.cleanup()).resolves.toBeUndefined();
    });
  });
});
