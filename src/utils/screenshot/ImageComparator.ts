/**
 * ImageComparator - Pixel-level image comparison logic
 *
 * compareScreenshots, createDiff, calculateSimilarityScore, batchCompare
 */

import * as path from 'path';
import { Jimp, loadFont } from 'jimp';
import { logger } from '../logger';
import { FileUtils } from '../fileUtils';
import pixelmatchDefault from 'pixelmatch';
import { ComparisonOptions, ComparisonResult, DiffAlgorithm, DiffColorOptions } from './types';
import { createPixelDiff, createPerceptualDiff, createStructuralDiff } from './DiffRenderer';

export class ImageComparator {
  /**
   * Compare two screenshots with advanced pixel-level comparison
   */
  async compareScreenshots(
    baselineImage: string, actualImage: string, options: ComparisonOptions = {}
  ): Promise<ComparisonResult> {
    const {
      threshold = 0.1, algorithm = 'pixel-by-pixel', includeAA = false,
      createDiffImage = true, colorOptions = {},
    } = options;

    try {
      const [baseline, actual] = await Promise.all([Jimp.read(baselineImage), Jimp.read(actualImage)]);
      const baselineSize = { width: baseline.width, height: baseline.height };
      const actualSize = { width: actual.width, height: actual.height };

      let resized = false;
      if (baselineSize.width !== actualSize.width || baselineSize.height !== actualSize.height) {
        const maxW = Math.max(baselineSize.width, actualSize.width);
        const maxH = Math.max(baselineSize.height, actualSize.height);
        baseline.resize({ w: maxW, h: maxH });
        actual.resize({ w: maxW, h: maxH });
        resized = true;
      }

      const width = baseline.width;
      const height = baseline.height;
      const pixelCount = width * height;

      const baselineBuffer = new Uint8ClampedArray(baseline.bitmap.data);
      const actualBuffer = new Uint8ClampedArray(actual.bitmap.data);
      const diffBuffer = new Uint8ClampedArray(width * height * 4);

      const differentPixels = pixelmatchDefault(baselineBuffer, actualBuffer, diffBuffer, width, height, {
        threshold: algorithm === 'perceptual' ? 0.2 : 0.1,
        includeAA,
        alpha: colorOptions.alpha || 1.0,
        aaColor: [255, 255, 0] as [number, number, number],
        diffColor: (colorOptions.changedColor || [255, 0, 255]) as [number, number, number],
        diffColorAlt: (colorOptions.addedColor || [0, 255, 0]) as [number, number, number],
      });

      const differencePercentage = (differentPixels / pixelCount) * 100;
      const similarityPercentage = 100 - differencePercentage;
      const matches = differencePercentage <= threshold * 100;

      let diffImagePath: string | undefined;
      if (createDiffImage && differentPixels > 0) {
        diffImagePath = await this.createDiff(
          baselineImage, actualImage,
          path.join(path.dirname(baselineImage), `diff_${Date.now()}.png`),
          { algorithm, colorOptions, includeAA }
        );
      }

      return {
        matches,
        differencePercentage: Math.round(differencePercentage * 100) / 100,
        similarityPercentage: Math.round(similarityPercentage * 100) / 100,
        diffImagePath,
        metadata: {
          baselineImage, actualImage, threshold, algorithm,
          pixelCount, differentPixels, baselineSize, actualSize, resized,
        },
      };
    } catch (error) {
      throw new Error(`Screenshot comparison failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create an advanced visual difference image
   */
  async createDiff(
    baselineImage: string, actualImage: string, outputPath: string,
    options: { algorithm?: DiffAlgorithm; colorOptions?: DiffColorOptions; includeAA?: boolean; showSideBySide?: boolean } = {}
  ): Promise<string> {
    const { algorithm = 'pixel-by-pixel', colorOptions = {}, includeAA = false, showSideBySide = false } = options;

    try {
      const [baseline, actual] = await Promise.all([Jimp.read(baselineImage), Jimp.read(actualImage)]);
      const tw = Math.max(baseline.width, actual.width);
      const th = Math.max(baseline.height, actual.height);
      if (baseline.width !== tw || baseline.height !== th) baseline.resize({ w: tw, h: th });
      if (actual.width !== tw || actual.height !== th) actual.resize({ w: tw, h: th });

      let diffImage: any;
      if (algorithm === 'structural') diffImage = await createStructuralDiff(baseline, actual, colorOptions);
      else if (algorithm === 'perceptual') diffImage = await createPerceptualDiff(baseline, actual, colorOptions);
      else diffImage = await createPixelDiff(baseline, actual, colorOptions, includeAA);

      if (showSideBySide) {
        const sbs = new Jimp({ width: tw * 3, height: th, color: 0xFFFFFFFF });
        sbs.composite(baseline, 0, 0);
        sbs.composite(actual, tw, 0);
        sbs.composite(diffImage, tw * 2, 0);
        try {
          const fontPath = require.resolve(
            '@jimp/plugin-print/fonts/open-sans/open-sans-16-black/open-sans-16-black.fnt'
          );
          const font = await loadFont(fontPath);
          sbs.print({ font, x: 10, y: 10, text: 'Baseline' });
          sbs.print({ font, x: tw + 10, y: 10, text: 'Actual' });
          sbs.print({ font, x: tw * 2 + 10, y: 10, text: 'Diff' });
        } catch {
          // Skip text annotations if the font is not available (e.g. bundled scenarios)
          logger.warn('Could not load diff font, text annotations disabled');
        }
        diffImage = sbs;
      }

      await FileUtils.ensureDirectory(path.dirname(outputPath));
      await diffImage.write(outputPath as `${string}.${string}`);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to create diff image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate similarity score using multiple algorithms
   */
  async calculateSimilarityScore(
    baseline: string, actual: string,
    options: { weights?: { pixel: number; perceptual: number; structural: number } } = {}
  ): Promise<{ overall: number; pixel: number; perceptual: number; structural: number }> {
    const { weights = { pixel: 0.4, perceptual: 0.4, structural: 0.2 } } = options;
    const [px, pe, st] = await Promise.all([
      this.compareScreenshots(baseline, actual, { algorithm: 'pixel-by-pixel', createDiffImage: false }),
      this.compareScreenshots(baseline, actual, { algorithm: 'perceptual', createDiffImage: false }),
      this.compareScreenshots(baseline, actual, { algorithm: 'structural', createDiffImage: false }),
    ]);
    const overall = px.similarityPercentage * weights.pixel + pe.similarityPercentage * weights.perceptual + st.similarityPercentage * weights.structural;
    return {
      overall: Math.round(overall * 100) / 100,
      pixel: px.similarityPercentage,
      perceptual: pe.similarityPercentage,
      structural: st.similarityPercentage,
    };
  }

}
