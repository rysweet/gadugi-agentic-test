/**
 * DiffRenderer - Low-level diff image rendering algorithms
 *
 * createPixelDiff, createPerceptualDiff, createStructuralDiff, detectEdges
 */

import { Jimp, intToRGBA, rgbaToInt } from 'jimp';
import pixelmatchDefault from 'pixelmatch';
import { DiffColorOptions } from './types';

type JimpImage = Awaited<ReturnType<typeof Jimp.read>>;

/**
 * Create pixel-by-pixel difference image
 */
export async function createPixelDiff(
  baseline: JimpImage,
  actual: JimpImage,
  colorOptions: DiffColorOptions,
  includeAA: boolean
): Promise<JimpImage> {
  const width = baseline.width;
  const height = baseline.height;
  const { removedColor = [255, 0, 0], addedColor = [0, 255, 0], changedColor = [255, 255, 0], alpha = 255 } = colorOptions;

  const baselineBuffer = new Uint8ClampedArray(baseline.bitmap.data);
  const actualBuffer = new Uint8ClampedArray(actual.bitmap.data);
  const diffBuffer = new Uint8ClampedArray(width * height * 4);

  pixelmatchDefault(baselineBuffer, actualBuffer, diffBuffer, width, height, {
    threshold: 0.1, includeAA, alpha: 1.0, diffColor: changedColor, diffColorAlt: addedColor,
  });

  const diffImage = new Jimp({ width, height });

  for (let i = 0; i < width * height; i++) {
    const px = i * 4;
    const bGray = (baselineBuffer[px] + baselineBuffer[px + 1] + baselineBuffer[px + 2]) / 3;
    const aGray = (actualBuffer[px] + actualBuffer[px + 1] + actualBuffer[px + 2]) / 3;
    const hasDiff = diffBuffer[px] > 0 || diffBuffer[px + 1] > 0 || diffBuffer[px + 2] > 0;

    let finalColor: [number, number, number, number];
    if (hasDiff) {
      if (bGray > aGray + 10) finalColor = [...removedColor, alpha];
      else if (aGray > bGray + 10) finalColor = [...addedColor, alpha];
      else finalColor = [...changedColor, alpha];
    } else {
      finalColor = [actualBuffer[px], actualBuffer[px + 1], actualBuffer[px + 2], 128];
    }

    diffImage.setPixelColor(
      rgbaToInt(finalColor[0], finalColor[1], finalColor[2], finalColor[3]),
      i % width, Math.floor(i / width)
    );
  }

  return diffImage as any;
}

/**
 * Create perceptual difference image (focuses on human-visible differences)
 */
export async function createPerceptualDiff(
  baseline: JimpImage,
  actual: JimpImage,
  colorOptions: DiffColorOptions
): Promise<JimpImage> {
  const width = baseline.width;
  const height = baseline.height;
  const diffImage = new Jimp({ width, height });
  const { removedColor = [255, 0, 0], addedColor = [0, 255, 0], changedColor = [255, 255, 0], alpha = 255 } = colorOptions;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bc = intToRGBA(baseline.getPixelColor(x, y));
      const ac = intToRGBA(actual.getPixelColor(x, y));
      const bLum = 0.299 * bc.r + 0.587 * bc.g + 0.114 * bc.b;
      const aLum = 0.299 * ac.r + 0.587 * ac.g + 0.114 * ac.b;
      const lumDiff = Math.abs(bLum - aLum);
      const colorDiff = Math.sqrt(Math.pow(bc.r - ac.r, 2) + Math.pow(bc.g - ac.g, 2) + Math.pow(bc.b - ac.b, 2));

      let finalColor: [number, number, number, number];
      if (lumDiff > 20 || colorDiff > 30) {
        if (bLum > aLum) finalColor = [...removedColor, alpha];
        else if (aLum > bLum) finalColor = [...addedColor, alpha];
        else finalColor = [...changedColor, alpha];
      } else {
        finalColor = [ac.r, ac.g, ac.b, 128];
      }
      diffImage.setPixelColor(rgbaToInt(finalColor[0], finalColor[1], finalColor[2], finalColor[3]), x, y);
    }
  }
  return diffImage as any;
}

/**
 * Create structural difference image (focuses on edges and shapes)
 */
export async function createStructuralDiff(
  baseline: JimpImage,
  actual: JimpImage,
  colorOptions: DiffColorOptions
): Promise<JimpImage> {
  const width = baseline.width;
  const height = baseline.height;
  const { removedColor = [255, 0, 0], addedColor = [0, 255, 0], alpha = 255 } = colorOptions;

  const baselineEdges = detectEdges(baseline);
  const actualEdges = detectEdges(actual);
  const diffImage = new Jimp({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bGray = intToRGBA(baselineEdges.getPixelColor(x, y));
      const aGray = intToRGBA(actualEdges.getPixelColor(x, y));
      const edgeDiff = Math.abs(bGray.r - aGray.r);

      let finalColor: [number, number, number, number];
      if (edgeDiff > 50) {
        finalColor = bGray.r > aGray.r ? [...removedColor, alpha] : [...addedColor, alpha];
      } else {
        const oc = intToRGBA(actual.getPixelColor(x, y));
        finalColor = [oc.r, oc.g, oc.b, 128];
      }
      diffImage.setPixelColor(rgbaToInt(finalColor[0], finalColor[1], finalColor[2], finalColor[3]), x, y);
    }
  }
  return diffImage as any;
}

/**
 * Simple edge detection using Sobel filter
 */
export function detectEdges(image: JimpImage): JimpImage {
  const width = image.width;
  const height = image.height;
  const edges = image.clone().greyscale() as JimpImage;
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const gray = intToRGBA(image.getPixelColor(x + kx, y + ky)).r;
          gx += gray * sobelX[ky + 1][kx + 1];
          gy += gray * sobelY[ky + 1][kx + 1];
        }
      }
      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      edges.setPixelColor(rgbaToInt(mag, mag, mag, 255), x, y);
    }
  }
  return edges;
}
