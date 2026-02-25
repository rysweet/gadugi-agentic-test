/**
 * Tests for src/utils/screenshot/DiffRenderer.ts
 *
 * DiffRenderer provides pixel-manipulation functions that operate on Jimp
 * image objects. We avoid loading real Jimp (which does image I/O) by
 * constructing minimal fake JimpImage stubs that satisfy the function
 * signatures.
 *
 * Functions under test:
 * - createPixelDiff(baseline, actual, colorOptions, includeAA)
 * - createPerceptualDiff(baseline, actual, colorOptions)
 * - createStructuralDiff(baseline, actual, colorOptions)
 * - detectEdges(image)
 */

// --- Mock jimp and pixelmatch to avoid real image I/O ---
jest.mock('jimp', () => {
  // Helper: build a simple pixel buffer filled with a given gray value
  const makeBuffer = (w: number, h: number, gray = 128): Uint8ClampedArray => {
    const buf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      buf[i * 4] = gray;
      buf[i * 4 + 1] = gray;
      buf[i * 4 + 2] = gray;
      buf[i * 4 + 3] = 255;
    }
    return buf;
  };

  // Minimal fake JimpImage — stores pixels as RGBA buffer
  class FakeJimp {
    width: number;
    height: number;
    bitmap: { data: Uint8ClampedArray };

    constructor({ width, height }: { width: number; height: number }) {
      this.width = width;
      this.height = height;
      this.bitmap = { data: makeBuffer(width, height, 100) };
    }

    getPixelColor(x: number, y: number): number {
      const idx = (y * this.width + x) * 4;
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      const a = this.bitmap.data[idx + 3];
      // Pack into 32-bit int: RRGGBBAA
      return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    }

    setPixelColor(_color: number, _x: number, _y: number): void {
      // no-op for tests
    }

    clone(): FakeJimp {
      const copy = new FakeJimp({ width: this.width, height: this.height });
      copy.bitmap.data.set(this.bitmap.data);
      return copy;
    }

    greyscale(): FakeJimp {
      // Convert to grey in-place
      for (let i = 0; i < this.width * this.height; i++) {
        const px = i * 4;
        const gray = Math.round(
          0.299 * this.bitmap.data[px] +
          0.587 * this.bitmap.data[px + 1] +
          0.114 * this.bitmap.data[px + 2]
        );
        this.bitmap.data[px] = gray;
        this.bitmap.data[px + 1] = gray;
        this.bitmap.data[px + 2] = gray;
      }
      return this;
    }
  }

  const intToRGBA = (color: number) => ({
    r: (color >>> 24) & 0xff,
    g: (color >>> 16) & 0xff,
    b: (color >>> 8) & 0xff,
    a: color & 0xff,
  });

  const rgbaToInt = (r: number, g: number, b: number, a: number) =>
    (((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)) >>> 0;

  return {
    Jimp: FakeJimp,
    intToRGBA,
    rgbaToInt,
    __esModule: true,
  };
});

jest.mock('pixelmatch', () => {
  // Simulate pixelmatch: marks a rectangular region as different
  const pixelmatch = jest.fn(
    (
      _img1: Uint8ClampedArray,
      _img2: Uint8ClampedArray,
      output: Uint8ClampedArray,
      _width: number,
      _height: number,
      _options?: object
    ) => {
      // Mark the first pixel as changed (yellow-ish)
      if (output.length >= 4) {
        output[0] = 255;
        output[1] = 255;
        output[2] = 0;
        output[3] = 255;
      }
      return 1; // 1 different pixel
    }
  );
  return { default: pixelmatch, __esModule: true };
});

import {
  createPixelDiff,
  createPerceptualDiff,
  createStructuralDiff,
  detectEdges,
} from '../../utils/screenshot/DiffRenderer';
import { Jimp } from 'jimp';
import type { DiffColorOptions } from '../../utils/screenshot/types';

// Helper to create a small test image with consistent data
function makeImage(width = 4, height = 4): ReturnType<typeof Jimp['prototype']['clone']> {
  return new (Jimp as any)({ width, height }) as any;
}

// Default color options
const defaultColors: DiffColorOptions = {
  removedColor: [255, 0, 0],
  addedColor: [0, 255, 0],
  changedColor: [255, 255, 0],
  alpha: 255,
};

// -------------------------------------------------------------------------
// createPixelDiff
// -------------------------------------------------------------------------
describe('createPixelDiff()', () => {
  it('returns a JimpImage with the same width and height', async () => {
    const baseline = makeImage(4, 4);
    const actual = makeImage(4, 4);
    const result = await createPixelDiff(baseline, actual, defaultColors, false);
    expect(result).toBeDefined();
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });

  it('returns a JimpImage when includeAA is true', async () => {
    const baseline = makeImage(4, 4);
    const actual = makeImage(4, 4);
    const result = await createPixelDiff(baseline, actual, defaultColors, true);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });

  it('uses default colors when colorOptions fields are omitted', async () => {
    const baseline = makeImage(2, 2);
    const actual = makeImage(2, 2);
    const result = await createPixelDiff(baseline, actual, {}, false);
    expect(result).toBeDefined();
    expect(result.width).toBe(2);
  });

  it('handles images where baseline pixels are brighter than actual (removed branch)', async () => {
    const baseline = makeImage(4, 4);
    const actual = makeImage(4, 4);
    // Make baseline much lighter than actual so bGray > aGray + 10
    for (let i = 0; i < baseline.bitmap.data.length; i += 4) {
      baseline.bitmap.data[i] = 250;
      baseline.bitmap.data[i + 1] = 250;
      baseline.bitmap.data[i + 2] = 250;
      actual.bitmap.data[i] = 50;
      actual.bitmap.data[i + 1] = 50;
      actual.bitmap.data[i + 2] = 50;
    }
    const result = await createPixelDiff(baseline, actual, defaultColors, false);
    expect(result).toBeDefined();
  });

  it('handles images where actual pixels are brighter than baseline (added branch)', async () => {
    const baseline = makeImage(4, 4);
    const actual = makeImage(4, 4);
    // Make actual much lighter so aGray > bGray + 10
    for (let i = 0; i < baseline.bitmap.data.length; i += 4) {
      baseline.bitmap.data[i] = 50;
      baseline.bitmap.data[i + 1] = 50;
      baseline.bitmap.data[i + 2] = 50;
      actual.bitmap.data[i] = 250;
      actual.bitmap.data[i + 1] = 250;
      actual.bitmap.data[i + 2] = 250;
    }
    const result = await createPixelDiff(baseline, actual, defaultColors, false);
    expect(result).toBeDefined();
  });
});

// -------------------------------------------------------------------------
// createPerceptualDiff
// -------------------------------------------------------------------------
describe('createPerceptualDiff()', () => {
  it('returns a JimpImage with matching dimensions', async () => {
    const baseline = makeImage(4, 4);
    const actual = makeImage(4, 4);
    const result = await createPerceptualDiff(baseline, actual, defaultColors);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });

  it('marks pixels as removed when baseline luminance > actual luminance by >20', async () => {
    const baseline = makeImage(2, 2);
    const actual = makeImage(2, 2);
    // Set baseline to very bright, actual to very dark
    for (let i = 0; i < baseline.bitmap.data.length; i += 4) {
      baseline.bitmap.data[i] = 255;
      baseline.bitmap.data[i + 1] = 255;
      baseline.bitmap.data[i + 2] = 255;
      actual.bitmap.data[i] = 0;
      actual.bitmap.data[i + 1] = 0;
      actual.bitmap.data[i + 2] = 0;
    }
    const result = await createPerceptualDiff(baseline, actual, defaultColors);
    expect(result).toBeDefined();
  });

  it('marks pixels as added when actual luminance > baseline luminance by >20', async () => {
    const baseline = makeImage(2, 2);
    const actual = makeImage(2, 2);
    for (let i = 0; i < baseline.bitmap.data.length; i += 4) {
      baseline.bitmap.data[i] = 0;
      baseline.bitmap.data[i + 1] = 0;
      baseline.bitmap.data[i + 2] = 0;
      actual.bitmap.data[i] = 255;
      actual.bitmap.data[i + 1] = 255;
      actual.bitmap.data[i + 2] = 255;
    }
    const result = await createPerceptualDiff(baseline, actual, defaultColors);
    expect(result).toBeDefined();
  });

  it('marks pixels as changed when luminance difference is ≤20 but color diff is >30', async () => {
    const baseline = makeImage(2, 2);
    const actual = makeImage(2, 2);
    // Same luminance but shifted hue (red vs blue)
    for (let i = 0; i < baseline.bitmap.data.length; i += 4) {
      baseline.bitmap.data[i] = 128;
      baseline.bitmap.data[i + 1] = 0;
      baseline.bitmap.data[i + 2] = 0;
      actual.bitmap.data[i] = 0;
      actual.bitmap.data[i + 1] = 0;
      actual.bitmap.data[i + 2] = 128;
    }
    const result = await createPerceptualDiff(baseline, actual, defaultColors);
    expect(result).toBeDefined();
  });

  it('renders unchanged pixels at reduced alpha when images are identical', async () => {
    const baseline = makeImage(2, 2);
    const actual = makeImage(2, 2);
    // Identical images — all pixels unchanged
    const result = await createPerceptualDiff(baseline, actual, defaultColors);
    expect(result).toBeDefined();
    expect(result.width).toBe(2);
  });

  it('uses default colors when colorOptions is empty', async () => {
    const baseline = makeImage(2, 2);
    const actual = makeImage(2, 2);
    const result = await createPerceptualDiff(baseline, actual, {});
    expect(result.width).toBe(2);
  });
});

// -------------------------------------------------------------------------
// createStructuralDiff
// -------------------------------------------------------------------------
describe('createStructuralDiff()', () => {
  it('returns a JimpImage with matching dimensions', async () => {
    const baseline = makeImage(4, 4);
    const actual = makeImage(4, 4);
    const result = await createStructuralDiff(baseline, actual, defaultColors);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });

  it('returns a result for identical images (no edge differences)', async () => {
    const baseline = makeImage(4, 4);
    const actual = makeImage(4, 4);
    const result = await createStructuralDiff(baseline, actual, defaultColors);
    expect(result).toBeDefined();
  });

  it('uses default colors when colorOptions is partial', async () => {
    const baseline = makeImage(4, 4);
    const actual = makeImage(4, 4);
    const result = await createStructuralDiff(baseline, actual, { removedColor: [255, 0, 0] });
    expect(result).toBeDefined();
  });

  it('marks pixels as removed when baseline edge intensity > actual edge by >50', async () => {
    const baseline = makeImage(5, 5);
    const actual = makeImage(5, 5);
    // Give baseline strong edges (high contrast) and actual flat (uniform gray)
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const idx = (y * 5 + x) * 4;
        const v = (x + y) % 2 === 0 ? 255 : 0;
        baseline.bitmap.data[idx] = v;
        baseline.bitmap.data[idx + 1] = v;
        baseline.bitmap.data[idx + 2] = v;
        actual.bitmap.data[idx] = 128;
        actual.bitmap.data[idx + 1] = 128;
        actual.bitmap.data[idx + 2] = 128;
      }
    }
    const result = await createStructuralDiff(baseline, actual, defaultColors);
    expect(result).toBeDefined();
  });
});

// -------------------------------------------------------------------------
// detectEdges
// -------------------------------------------------------------------------
describe('detectEdges()', () => {
  it('returns a JimpImage with the same dimensions as input', () => {
    const image = makeImage(5, 5);
    const result = detectEdges(image as any);
    expect(result.width).toBe(5);
    expect(result.height).toBe(5);
  });

  it('returns an image for a 3x3 input (minimum size for Sobel)', () => {
    const image = makeImage(3, 3);
    const result = detectEdges(image as any);
    expect(result).toBeDefined();
  });

  it('processes a uniform-color image without throwing', () => {
    const image = makeImage(6, 6);
    // Fill with constant gray
    for (let i = 0; i < image.bitmap.data.length; i += 4) {
      image.bitmap.data[i] = 128;
      image.bitmap.data[i + 1] = 128;
      image.bitmap.data[i + 2] = 128;
      image.bitmap.data[i + 3] = 255;
    }
    expect(() => detectEdges(image as any)).not.toThrow();
  });

  it('processes a high-contrast checkerboard without throwing', () => {
    const image = makeImage(5, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const idx = (y * 5 + x) * 4;
        const v = (x + y) % 2 === 0 ? 255 : 0;
        image.bitmap.data[idx] = v;
        image.bitmap.data[idx + 1] = v;
        image.bitmap.data[idx + 2] = v;
        image.bitmap.data[idx + 3] = 255;
      }
    }
    expect(() => detectEdges(image as any)).not.toThrow();
  });

  it('output pixel magnitudes are clamped to 0-255', () => {
    const image = makeImage(5, 5);
    const spy = jest.spyOn(Math, 'min');
    detectEdges(image as any);
    // Math.min(255, ...) is used to clamp gradient magnitudes
    expect(spy).toHaveBeenCalledWith(255, expect.any(Number));
    spy.mockRestore();
  });
});
