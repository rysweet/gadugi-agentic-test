/**
 * ScreenshotReporter - Reporting and persistence
 *
 * generateComparisonReport, archiveRun, exportMetadata
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ScreenshotMetadata,
  ComparisonResult,
  OrganizationOptions,
} from './types';

export class ScreenshotReporter {
  constructor(
    private readonly organizationOptions: OrganizationOptions,
    private readonly runId: string,
    private readonly metadata: Map<string, ScreenshotMetadata>
  ) {}

  /**
   * Generate comparison report
   */
  async generateComparisonReport(
    results: Array<ComparisonResult & { name: string }>,
    outputPath?: string
  ): Promise<string> {
    const reportPath =
      outputPath ||
      path.join(
        this.organizationOptions.baseDir,
        `comparison_report_${this.runId}.json`
      );

    const report = {
      runId: this.runId,
      timestamp: new Date(),
      summary: {
        totalComparisons: results.length,
        passed: results.filter((r) => r.matches).length,
        failed: results.filter((r) => !r.matches).length,
        averageSimilarity:
          results.reduce((sum, r) => sum + r.similarityPercentage, 0) /
          results.length,
      },
      results: results.map((result) => ({
        name: result.name,
        matches: result.matches,
        similarity: result.similarityPercentage,
        difference: result.differencePercentage,
        algorithm: result.metadata.algorithm,
        diffImagePath: result.diffImagePath,
        resized: result.metadata.resized,
        pixelCount: result.metadata.pixelCount,
        differentPixels: result.metadata.differentPixels,
      })),
    };

    await this.ensureDirectoryExists(path.dirname(reportPath));
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    return reportPath;
  }

  /**
   * Archive screenshots for a completed run
   */
  async archiveRun(archivePath?: string): Promise<string> {
    const finalArchivePath =
      archivePath ||
      path.join(
        this.organizationOptions.baseDir,
        'archives',
        `${this.runId}.tar.gz`
      );

    await this.ensureDirectoryExists(path.dirname(finalArchivePath));

    const runScreenshots = Array.from(this.metadata.values());
    const manifest = {
      runId: this.runId,
      timestamp: new Date(),
      screenshots: runScreenshots,
      totalCount: runScreenshots.length,
    };

    await fs.writeFile(
      finalArchivePath.replace('.tar.gz', '.json'),
      JSON.stringify(manifest, null, 2)
    );

    return finalArchivePath;
  }

  /**
   * Export metadata to JSON
   */
  async exportMetadata(filePath?: string): Promise<string> {
    const finalFilePath =
      filePath ||
      path.join(
        this.organizationOptions.baseDir,
        `${this.runId}_metadata.json`
      );

    const metadataArray = Array.from(this.metadata.values());
    const exportData = {
      runId: this.runId,
      exportTimestamp: new Date(),
      totalScreenshots: metadataArray.length,
      screenshots: metadataArray,
    };

    await fs.writeFile(finalFilePath, JSON.stringify(exportData, null, 2));
    return finalFilePath;
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}
