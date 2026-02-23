/**
 * Screenshot utilities for Playwright-based testing
 *
 * Facade composing ScreenshotCapture, ImageComparator, and ScreenshotReporter.
 * The public API is unchanged from the original monolithic screenshot.ts.
 */

import { Page, Locator } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ScreenshotCapture } from './ScreenshotCapture';
import { ImageComparator } from './ImageComparator';
import { ScreenshotReporter } from './ScreenshotReporter';
import {
  ScreenshotOptions, ScreenshotMetadata, ComparisonOptions,
  ComparisonResult, OrganizationOptions, DEFAULT_OPTIONS, DEFAULT_ORGANIZATION,
} from './types';

// Re-export all public types
export type {
  ScreenshotOptions, ScreenshotMetadata, DiffAlgorithm, DiffColorOptions,
  ComparisonOptions, ComparisonResult, OrganizationOptions,
} from './types';

type CaptureOpts = ScreenshotOptions & { scenarioId?: string; stepIndex?: number; description?: string };

export class ScreenshotManager {
  private organizationOptions: OrganizationOptions;
  private metadata: Map<string, ScreenshotMetadata> = new Map();
  private runId: string;
  private capture: ScreenshotCapture;
  private comparator: ImageComparator;
  private reporter: ScreenshotReporter;

  constructor(options: Partial<OrganizationOptions> = {}) {
    this.organizationOptions = { ...DEFAULT_ORGANIZATION, ...options };
    this.runId = options.runId || this.generateRunId();
    this.capture = new ScreenshotCapture(this.organizationOptions, this.metadata, this.generateFilePath.bind(this));
    this.comparator = new ImageComparator();
    this.reporter = new ScreenshotReporter(this.organizationOptions, this.runId, this.metadata);
  }

  // -- Capture delegation --
  capturePageScreenshot(page: Page, opts: CaptureOpts = {}): Promise<ScreenshotMetadata> { return this.capture.capturePageScreenshot(page, opts); }
  captureElementScreenshot(el: Locator, opts: CaptureOpts = {}): Promise<ScreenshotMetadata> { return this.capture.captureElementScreenshot(el, opts); }
  captureSequence(page: Page, count: number, interval: number, opts: ScreenshotOptions & { scenarioId?: string; description?: string } = {}): Promise<ScreenshotMetadata[]> { return this.capture.captureSequence(page, count, interval, opts); }
  captureComparison(page: Page, action: () => Promise<void>, opts: CaptureOpts = {}): Promise<{ before: ScreenshotMetadata; after: ScreenshotMetadata }> { return this.capture.captureComparison(page, action, opts); }

  // -- Comparison delegation --
  compareScreenshots(baseline: string, actual: string, opts: ComparisonOptions = {}): Promise<ComparisonResult> { return this.comparator.compareScreenshots(baseline, actual, opts); }
  /** @deprecated Use createDiff instead. Will be removed in v2.0. */
  createDifferenceImage(baseline: string, actual: string, outputPath: string): Promise<string> { return this.comparator.createDiff(baseline, actual, outputPath); }
  createDiff(baseline: string, actual: string, outputPath: string, opts: { algorithm?: import('./types').DiffAlgorithm; colorOptions?: import('./types').DiffColorOptions; includeAA?: boolean; showSideBySide?: boolean } = {}): Promise<string> { return this.comparator.createDiff(baseline, actual, outputPath, opts); }
  calculateSimilarityScore(baseline: string, actual: string, opts: { weights?: { pixel: number; perceptual: number; structural: number } } = {}): Promise<{ overall: number; pixel: number; perceptual: number; structural: number }> { return this.comparator.calculateSimilarityScore(baseline, actual, opts); }

  async batchCompareScreenshots(comparisons: Array<{ baseline: string; actual: string; name: string; options?: ComparisonOptions }>): Promise<Array<ComparisonResult & { name: string }>> {
    const results: Array<ComparisonResult & { name: string }> = [];
    for (const c of comparisons) {
      try {
        results.push({ ...await this.comparator.compareScreenshots(c.baseline, c.actual, c.options), name: c.name });
      } catch {
        results.push({
          name: c.name, matches: false, differencePercentage: 100, similarityPercentage: 0,
          metadata: { baselineImage: c.baseline, actualImage: c.actual, threshold: c.options?.threshold || 0.1, algorithm: c.options?.algorithm || 'pixel-by-pixel', pixelCount: 0, differentPixels: 0, baselineSize: { width: 0, height: 0 }, actualSize: { width: 0, height: 0 }, resized: false },
        });
      }
    }
    return results;
  }

  // -- Reporting delegation --
  generateComparisonReport(results: Array<ComparisonResult & { name: string }>, outputPath?: string): Promise<string> { return this.reporter.generateComparisonReport(results, outputPath); }
  exportManifest(manifestPath?: string): Promise<string> { return this.reporter.exportManifest(manifestPath); }
  /** @deprecated Use exportManifest instead. Will be removed in v2.0. */
  archiveRun(manifestPath?: string): Promise<string> { return this.reporter.exportManifest(manifestPath); }
  exportMetadata(filePath?: string): Promise<string> { return this.reporter.exportMetadata(filePath); }

  // -- Query methods --
  getScreenshotsByScenario(scenarioId: string): ScreenshotMetadata[] { return Array.from(this.metadata.values()).filter(m => m.scenarioId === scenarioId); }
  getScreenshotsByStep(scenarioId: string, stepIndex: number): ScreenshotMetadata[] { return Array.from(this.metadata.values()).filter(m => m.scenarioId === scenarioId && m.stepIndex === stepIndex); }

  async cleanupOldScreenshots(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let deleted = 0;
    for (const [fp, meta] of this.metadata.entries()) {
      if (now - meta.timestamp.getTime() > maxAge) {
        try { await fs.unlink(fp); this.metadata.delete(fp); deleted++; }
        catch (e) { console.warn(`Failed to delete old screenshot ${fp}:`, e instanceof Error ? e.message : String(e)); }
      }
    }
    return deleted;
  }

  getRunStatistics() {
    const screenshots = Array.from(this.metadata.values());
    const byScenario = screenshots.reduce((acc, m) => { if (m.scenarioId) acc[m.scenarioId] = (acc[m.scenarioId] || 0) + 1; return acc; }, {} as Record<string, number>);
    const totalSize = screenshots.reduce((s, m) => s + (m.fileSize || 0), 0);
    return {
      runId: this.runId, totalScreenshots: screenshots.length, byScenario,
      totalSizeBytes: totalSize, totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      oldestScreenshot: screenshots.length > 0 ? Math.min(...screenshots.map(s => s.timestamp.getTime())) : null,
      newestScreenshot: screenshots.length > 0 ? Math.max(...screenshots.map(s => s.timestamp.getTime())) : null,
    };
  }

  // -- Private helpers --
  private generateFilePath(type: string, scenarioId?: string, stepIndex?: number): string {
    const ts = this.organizationOptions.includeTimestamp ? new Date().toISOString().replace(/[:.]/g, '-').split('.')[0] : '';
    let fn = type;
    if (scenarioId) fn += `_${this.sanitizeFilename(scenarioId)}`;
    if (stepIndex !== undefined) fn += `_step${stepIndex + 1}`;
    if (ts) fn += `_${ts}`;
    fn += '.png';
    return path.join(this.getDirectoryPath(scenarioId), fn);
  }

  private getDirectoryPath(scenarioId?: string): string {
    const bd = this.organizationOptions.baseDir;
    switch (this.organizationOptions.strategy) {
      case 'flat': return bd;
      case 'by-date': return path.join(bd, new Date().toISOString().split('T')[0]);
      case 'by-scenario': return path.join(bd, scenarioId ? this.sanitizeFilename(scenarioId) : 'unassigned');
      case 'by-run': return path.join(bd, this.runId);
      default: return bd;
    }
  }

  private sanitizeFilename(fn: string): string { return fn.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase(); }
  private generateRunId(): string { return `run_${new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]}_${Math.random().toString(36).substring(2, 8)}`; }
}

export function createScreenshotManager(options?: Partial<OrganizationOptions>): ScreenshotManager { return new ScreenshotManager(options); }

export async function capturePageScreenshot(page: Page, filePath: string, options?: ScreenshotOptions): Promise<void> {
  await page.screenshot({ ...DEFAULT_OPTIONS, ...options, path: filePath });
}

export async function captureElementScreenshot(element: Locator, filePath: string, options?: ScreenshotOptions): Promise<void> {
  await element.screenshot({ ...DEFAULT_OPTIONS, ...options, path: filePath });
}
