/**
 * ScreenshotCapture - Screenshot taking logic
 *
 * capturePageScreenshot, captureElementScreenshot, captureSequence,
 * captureComparison
 */

import { Page, Locator } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ScreenshotOptions,
  ScreenshotMetadata,
  OrganizationOptions,
  DEFAULT_OPTIONS,
} from './types';

export class ScreenshotCapture {
  constructor(
    private readonly organizationOptions: OrganizationOptions,
    private readonly metadata: Map<string, ScreenshotMetadata>,
    private readonly generateFilePath: (
      type: string,
      scenarioId?: string,
      stepIndex?: number
    ) => string
  ) {}

  /**
   * Capture a screenshot of the page
   */
  async capturePageScreenshot(
    page: Page,
    options: ScreenshotOptions & {
      scenarioId?: string;
      stepIndex?: number;
      description?: string;
    } = {}
  ): Promise<ScreenshotMetadata> {
    const finalOptions = { ...DEFAULT_OPTIONS, ...options };

    if (!finalOptions.path) {
      finalOptions.path = this.generateFilePath(
        'page',
        options.scenarioId,
        options.stepIndex
      );
    }

    await this.ensureDirectoryExists(path.dirname(finalOptions.path));

    const buffer = await page.screenshot(finalOptions);
    await fs.writeFile(finalOptions.path, buffer);

    const url = page.url();
    const viewport = page.viewportSize();

    const meta: ScreenshotMetadata = {
      filePath: finalOptions.path,
      fileName: path.basename(finalOptions.path),
      timestamp: new Date(),
      scenarioId: options.scenarioId,
      stepIndex: options.stepIndex,
      description: options.description,
      url,
      viewport: viewport || undefined,
      fileSize: buffer.length,
      hash: this.calculateHash(buffer),
      tags: ['page'],
    };

    this.metadata.set(finalOptions.path, meta);
    return meta;
  }

  /**
   * Capture a screenshot of a specific element
   */
  async captureElementScreenshot(
    element: Locator,
    options: ScreenshotOptions & {
      scenarioId?: string;
      stepIndex?: number;
      description?: string;
    } = {}
  ): Promise<ScreenshotMetadata> {
    const finalOptions = { ...DEFAULT_OPTIONS, ...options };

    if (!finalOptions.path) {
      finalOptions.path = this.generateFilePath(
        'element',
        options.scenarioId,
        options.stepIndex
      );
    }

    await this.ensureDirectoryExists(path.dirname(finalOptions.path));

    const buffer = await element.screenshot(finalOptions);
    await fs.writeFile(finalOptions.path, buffer);

    const page = element.page();
    const url = page.url();
    const viewport = page.viewportSize();

    const meta: ScreenshotMetadata = {
      filePath: finalOptions.path,
      fileName: path.basename(finalOptions.path),
      timestamp: new Date(),
      scenarioId: options.scenarioId,
      stepIndex: options.stepIndex,
      description: options.description,
      url,
      viewport: viewport || undefined,
      fileSize: buffer.length,
      hash: this.calculateHash(buffer),
      tags: ['element'],
    };

    this.metadata.set(finalOptions.path, meta);
    return meta;
  }

  /**
   * Capture multiple screenshots in sequence
   */
  async captureSequence(
    page: Page,
    count: number,
    interval: number,
    options: ScreenshotOptions & {
      scenarioId?: string;
      description?: string;
    } = {}
  ): Promise<ScreenshotMetadata[]> {
    const screenshots: ScreenshotMetadata[] = [];

    for (let i = 0; i < count; i++) {
      const sequenceOptions = {
        ...options,
        description: `${options.description || 'Sequence'} - ${i + 1}/${count}`,
        path: this.generateFilePath(
          `sequence_${i + 1}`,
          options.scenarioId
        ),
      };

      const meta = await this.capturePageScreenshot(page, sequenceOptions);
      screenshots.push(meta);

      if (i < count - 1) {
        await this.sleep(interval);
      }
    }

    return screenshots;
  }

  /**
   * Capture before/after comparison screenshots
   */
  async captureComparison(
    page: Page,
    action: () => Promise<void>,
    options: ScreenshotOptions & {
      scenarioId?: string;
      stepIndex?: number;
      description?: string;
    } = {}
  ): Promise<{ before: ScreenshotMetadata; after: ScreenshotMetadata }> {
    const beforeOptions = {
      ...options,
      description: `${options.description || 'Comparison'} - Before`,
      path: this.generateFilePath(
        'before',
        options.scenarioId,
        options.stepIndex
      ),
    };
    const before = await this.capturePageScreenshot(page, beforeOptions);

    await action();

    const afterOptions = {
      ...options,
      description: `${options.description || 'Comparison'} - After`,
      path: this.generateFilePath(
        'after',
        options.scenarioId,
        options.stepIndex
      ),
    };
    const after = await this.capturePageScreenshot(page, afterOptions);

    return { before, after };
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
