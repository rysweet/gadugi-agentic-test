/**
 * ScreenshotCapture unit tests
 *
 * Mocks Playwright Page/Locator and fs/promises to verify:
 * - capturePageScreenshot(): calls page.screenshot(), writes file, returns metadata
 * - captureElementScreenshot(): calls element.screenshot(), returns metadata
 * - captureSequence(): captures N screenshots with correct descriptions
 * - captureComparison(): captures before/after, calls action() between them
 */

import { ScreenshotCapture } from '../../../utils/screenshot/ScreenshotCapture';
import { OrganizationOptions } from '../../../utils/screenshot/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock fs/promises
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([]),
}));

// Mock FileUtils
jest.mock('../../../utils/fileUtils', () => ({
  FileUtils: {
    ensureDirectory: jest.fn().mockResolvedValue(undefined),
  },
}));

import * as fsPromises from 'fs/promises';
import { FileUtils } from '../../../utils/fileUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function makeMockPage(url = 'http://localhost:3000') {
  return {
    screenshot: jest.fn().mockResolvedValue(FAKE_PNG),
    url: jest.fn().mockReturnValue(url),
    viewportSize: jest.fn().mockReturnValue({ width: 1280, height: 720 }),
  };
}

function makeMockLocator(url = 'http://localhost:3000/element') {
  const mockPage = {
    url: jest.fn().mockReturnValue(url),
    viewportSize: jest.fn().mockReturnValue({ width: 1280, height: 720 }),
  };
  return {
    screenshot: jest.fn().mockResolvedValue(FAKE_PNG),
    page: jest.fn().mockReturnValue(mockPage),
  };
}

const organizationOptions: OrganizationOptions = {
  baseDir: '/tmp/screenshots',
  strategy: 'flat',
  includeTimestamp: false,
};

const metadataMap = new Map();

function generateFilePath(type: string, scenarioId?: string, stepIndex?: number): string {
  const parts = ['/tmp/screenshots', type];
  if (scenarioId) parts.push(scenarioId);
  if (stepIndex !== undefined) parts.push(String(stepIndex));
  return parts.join('_') + '.png';
}

function makeCapture() {
  return new ScreenshotCapture(organizationOptions, metadataMap, generateFilePath);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScreenshotCapture', () => {
  let capture: ScreenshotCapture;

  beforeEach(() => {
    jest.clearAllMocks();
    metadataMap.clear();
    capture = makeCapture();
  });

  // -------------------------------------------------------------------------
  // capturePageScreenshot
  // -------------------------------------------------------------------------

  describe('capturePageScreenshot', () => {
    it('calls page.screenshot() and returns metadata with correct filePath', async () => {
      const page = makeMockPage();

      const meta = await capture.capturePageScreenshot(page as any);

      expect(page.screenshot).toHaveBeenCalledTimes(1);
      expect(meta.filePath).toBeDefined();
      expect(meta.fileName).toBeDefined();
      expect(meta.tags).toContain('page');
    });

    it('writes screenshot buffer to disk via fs.writeFile', async () => {
      const page = makeMockPage();

      await capture.capturePageScreenshot(page as any);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        FAKE_PNG
      );
    });

    it('calls FileUtils.ensureDirectory before writing', async () => {
      const page = makeMockPage();

      await capture.capturePageScreenshot(page as any);

      expect(FileUtils.ensureDirectory).toHaveBeenCalledWith(expect.any(String));
    });

    it('stores metadata in the shared map', async () => {
      const page = makeMockPage();

      const meta = await capture.capturePageScreenshot(page as any);

      expect(metadataMap.has(meta.filePath)).toBe(true);
      expect(metadataMap.get(meta.filePath)).toEqual(meta);
    });

    it('includes scenarioId and stepIndex in metadata when provided', async () => {
      const page = makeMockPage();

      const meta = await capture.capturePageScreenshot(page as any, {
        scenarioId: 'scenario-1',
        stepIndex: 3,
        description: 'Login step',
      });

      expect(meta.scenarioId).toBe('scenario-1');
      expect(meta.stepIndex).toBe(3);
      expect(meta.description).toBe('Login step');
    });

    it('includes url and viewport from the page', async () => {
      const page = makeMockPage('http://example.com/page');

      const meta = await capture.capturePageScreenshot(page as any);

      expect(meta.url).toBe('http://example.com/page');
      expect(meta.viewport).toEqual({ width: 1280, height: 720 });
    });

    it('includes fileSize equal to buffer length', async () => {
      const page = makeMockPage();

      const meta = await capture.capturePageScreenshot(page as any);

      expect(meta.fileSize).toBe(FAKE_PNG.length);
    });

    it('computes a non-empty hash', async () => {
      const page = makeMockPage();

      const meta = await capture.capturePageScreenshot(page as any);

      expect(typeof meta.hash).toBe('string');
      expect(meta.hash!.length).toBeGreaterThan(0);
    });

    it('uses provided path instead of generating one', async () => {
      const page = makeMockPage();

      const meta = await capture.capturePageScreenshot(page as any, {
        path: '/tmp/custom.png',
      });

      expect(meta.filePath).toBe('/tmp/custom.png');
    });
  });

  // -------------------------------------------------------------------------
  // captureElementScreenshot
  // -------------------------------------------------------------------------

  describe('captureElementScreenshot', () => {
    it('calls element.screenshot() and tags result with "element"', async () => {
      const locator = makeMockLocator();

      const meta = await capture.captureElementScreenshot(locator as any);

      expect(locator.screenshot).toHaveBeenCalledTimes(1);
      expect(meta.tags).toContain('element');
    });

    it('writes element screenshot buffer to disk', async () => {
      const locator = makeMockLocator();

      await capture.captureElementScreenshot(locator as any);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        FAKE_PNG
      );
    });
  });

  // -------------------------------------------------------------------------
  // captureSequence
  // -------------------------------------------------------------------------

  describe('captureSequence', () => {
    it('captures exactly N screenshots', async () => {
      const page = makeMockPage();

      const results = await capture.captureSequence(page as any, 3, 0);

      expect(results).toHaveLength(3);
      expect(page.screenshot).toHaveBeenCalledTimes(3);
    });

    it('includes index in description for each screenshot', async () => {
      const page = makeMockPage();

      const results = await capture.captureSequence(page as any, 2, 0, {
        description: 'TestSeq',
      });

      expect(results[0].description).toContain('1/2');
      expect(results[1].description).toContain('2/2');
    });
  });

  // -------------------------------------------------------------------------
  // captureComparison
  // -------------------------------------------------------------------------

  describe('captureComparison', () => {
    it('captures before and after screenshots and calls action in between', async () => {
      const page = makeMockPage();
      const action = jest.fn().mockResolvedValue(undefined);

      const { before, after } = await capture.captureComparison(
        page as any,
        action
      );

      expect(page.screenshot).toHaveBeenCalledTimes(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(before).toBeDefined();
      expect(after).toBeDefined();
    });

    it('includes "Before" and "After" in descriptions', async () => {
      const page = makeMockPage();
      const action = jest.fn().mockResolvedValue(undefined);

      const { before, after } = await capture.captureComparison(
        page as any,
        action,
        { description: 'Modal open' }
      );

      expect(before.description).toContain('Before');
      expect(after.description).toContain('After');
    });
  });
});
