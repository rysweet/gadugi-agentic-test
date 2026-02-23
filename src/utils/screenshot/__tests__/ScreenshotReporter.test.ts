/**
 * ScreenshotReporter unit tests
 *
 * Mocks fs/promises to test:
 * - generateComparisonReport(): writes JSON to the correct path, returns path
 * - generateComparisonReport(): report contains summary and result details
 * - exportManifest(): writes JSON to manifests/ directory (not .tar.gz)
 * - exportManifest(): returns correct .json path
 * - exportMetadata(): writes all metadata to JSON
 */

import { ScreenshotReporter } from '../../../utils/screenshot/ScreenshotReporter';
import { OrganizationOptions, ScreenshotMetadata, ComparisonResult } from '../../../utils/screenshot/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

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

const RUN_ID = 'run-2026-test-001';

const orgOptions: OrganizationOptions = {
  baseDir: '/tmp/screenshots',
  strategy: 'by-run',
  includeTimestamp: true,
};

function makeMeta(filePath: string): ScreenshotMetadata {
  return {
    filePath,
    fileName: filePath.split('/').pop()!,
    timestamp: new Date('2026-01-01T00:00:00Z'),
    tags: ['page'],
  };
}

function makeComparisonResult(name: string, matches: boolean): ComparisonResult & { name: string } {
  return {
    name,
    matches,
    differencePercentage: matches ? 0 : 15,
    similarityPercentage: matches ? 100 : 85,
    metadata: {
      baselineImage: `/tmp/${name}_baseline.png`,
      actualImage: `/tmp/${name}_actual.png`,
      threshold: 0.1,
      algorithm: 'pixel-by-pixel',
      pixelCount: 10000,
      differentPixels: matches ? 0 : 1500,
      baselineSize: { width: 100, height: 100 },
      actualSize: { width: 100, height: 100 },
      resized: false,
    },
  };
}

function makeReporter(metadataEntries: [string, ScreenshotMetadata][] = []) {
  const metadata = new Map<string, ScreenshotMetadata>(metadataEntries);
  return new ScreenshotReporter(orgOptions, RUN_ID, metadata);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScreenshotReporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // generateComparisonReport
  // -------------------------------------------------------------------------

  describe('generateComparisonReport', () => {
    it('writes a JSON file to the base directory with runId in filename', async () => {
      const reporter = makeReporter();
      const results = [makeComparisonResult('login', true)];

      const reportPath = await reporter.generateComparisonReport(results);

      expect(reportPath).toContain(RUN_ID);
      expect(reportPath).toMatch(/\.json$/);
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        reportPath,
        expect.any(String)
      );
    });

    it('uses provided outputPath when specified', async () => {
      const reporter = makeReporter();
      const customPath = '/tmp/my-report.json';
      const results = [makeComparisonResult('login', true)];

      const returnedPath = await reporter.generateComparisonReport(results, customPath);

      expect(returnedPath).toBe(customPath);
    });

    it('includes correct summary counts for passed/failed', async () => {
      const reporter = makeReporter();
      const results = [
        makeComparisonResult('login', true),
        makeComparisonResult('dashboard', false),
        makeComparisonResult('profile', true),
      ];

      await reporter.generateComparisonReport(results);

      const writtenJson = (fsPromises.writeFile as jest.Mock).mock.calls[0][1] as string;
      const report = JSON.parse(writtenJson);

      expect(report.summary.totalComparisons).toBe(3);
      expect(report.summary.passed).toBe(2);
      expect(report.summary.failed).toBe(1);
    });

    it('includes runId and timestamp in the report', async () => {
      const reporter = makeReporter();
      const results = [makeComparisonResult('test', true)];

      await reporter.generateComparisonReport(results);

      const writtenJson = (fsPromises.writeFile as jest.Mock).mock.calls[0][1] as string;
      const report = JSON.parse(writtenJson);

      expect(report.runId).toBe(RUN_ID);
      expect(report.timestamp).toBeDefined();
    });

    it('includes per-result details in the report', async () => {
      const reporter = makeReporter();
      const results = [makeComparisonResult('login', false)];

      await reporter.generateComparisonReport(results);

      const writtenJson = (fsPromises.writeFile as jest.Mock).mock.calls[0][1] as string;
      const report = JSON.parse(writtenJson);

      expect(report.results).toHaveLength(1);
      expect(report.results[0].name).toBe('login');
      expect(report.results[0].matches).toBe(false);
      expect(report.results[0].similarity).toBe(85);
    });

    it('calls FileUtils.ensureDirectory before writing', async () => {
      const reporter = makeReporter();

      await reporter.generateComparisonReport([makeComparisonResult('test', true)]);

      expect(FileUtils.ensureDirectory).toHaveBeenCalledWith(expect.any(String));
    });

    it('computes averageSimilarity correctly', async () => {
      const reporter = makeReporter();
      const results = [
        makeComparisonResult('a', true),  // 100% similarity
        makeComparisonResult('b', false), // 85% similarity
      ];

      await reporter.generateComparisonReport(results);

      const writtenJson = (fsPromises.writeFile as jest.Mock).mock.calls[0][1] as string;
      const report = JSON.parse(writtenJson);

      expect(report.summary.averageSimilarity).toBeCloseTo(92.5, 1);
    });
  });

  // -------------------------------------------------------------------------
  // exportManifest
  // -------------------------------------------------------------------------

  describe('exportManifest', () => {
    it('writes a JSON file to manifests/ subdirectory by default', async () => {
      const reporter = makeReporter();

      const manifestPath = await reporter.exportManifest();

      expect(manifestPath).toContain('manifests');
      expect(manifestPath).toMatch(/\.json$/);
      // Must NOT be a .tar.gz archive
      expect(manifestPath).not.toMatch(/\.tar\.gz$/);
    });

    it('uses runId as the manifest filename', async () => {
      const reporter = makeReporter();

      const manifestPath = await reporter.exportManifest();

      expect(manifestPath).toContain(RUN_ID);
      expect(manifestPath).toContain('.json');
    });

    it('uses provided manifestPath when specified', async () => {
      const reporter = makeReporter();
      const customPath = '/tmp/manifests/custom.json';

      const returnedPath = await reporter.exportManifest(customPath);

      expect(returnedPath).toBe(customPath);
    });

    it('writes JSON containing runId, timestamp, and screenshots array', async () => {
      const meta = makeMeta('/tmp/screenshots/shot1.png');
      const reporter = makeReporter([[meta.filePath, meta]]);

      await reporter.exportManifest();

      const writtenJson = (fsPromises.writeFile as jest.Mock).mock.calls[0][1] as string;
      const manifest = JSON.parse(writtenJson);

      expect(manifest.runId).toBe(RUN_ID);
      expect(manifest.timestamp).toBeDefined();
      expect(manifest.screenshots).toHaveLength(1);
      expect(manifest.totalCount).toBe(1);
    });

    it('writes empty screenshots array when no metadata captured', async () => {
      const reporter = makeReporter([]);

      await reporter.exportManifest();

      const writtenJson = (fsPromises.writeFile as jest.Mock).mock.calls[0][1] as string;
      const manifest = JSON.parse(writtenJson);

      expect(manifest.screenshots).toEqual([]);
      expect(manifest.totalCount).toBe(0);
    });

    it('calls FileUtils.ensureDirectory for the manifests directory', async () => {
      const reporter = makeReporter();

      await reporter.exportManifest();

      expect(FileUtils.ensureDirectory).toHaveBeenCalledWith(
        expect.stringContaining('manifests')
      );
    });
  });

  // -------------------------------------------------------------------------
  // exportMetadata
  // -------------------------------------------------------------------------

  describe('exportMetadata', () => {
    it('writes a JSON file containing all metadata entries', async () => {
      const meta1 = makeMeta('/tmp/screenshots/shot1.png');
      const meta2 = makeMeta('/tmp/screenshots/shot2.png');
      const reporter = makeReporter([
        [meta1.filePath, meta1],
        [meta2.filePath, meta2],
      ]);

      await reporter.exportMetadata();

      const writtenJson = (fsPromises.writeFile as jest.Mock).mock.calls[0][1] as string;
      const exported = JSON.parse(writtenJson);

      expect(exported.runId).toBe(RUN_ID);
      expect(exported.totalScreenshots).toBe(2);
      expect(exported.screenshots).toHaveLength(2);
    });

    it('uses provided filePath when specified', async () => {
      const reporter = makeReporter();
      const customPath = '/tmp/run-metadata.json';

      const returnedPath = await reporter.exportMetadata(customPath);

      expect(returnedPath).toBe(customPath);
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        customPath,
        expect.any(String)
      );
    });

    it('includes runId in default filename', async () => {
      const reporter = makeReporter();

      const returnedPath = await reporter.exportMetadata();

      expect(returnedPath).toContain(RUN_ID);
    });
  });
});
