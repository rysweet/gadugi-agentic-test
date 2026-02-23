/**
 * ImageComparator unit tests
 *
 * Mocks Jimp.read and pixelmatch to test:
 * - compareScreenshots(): returns similarity/difference percentage
 * - compareScreenshots(): resizes images of differing dimensions
 * - compareScreenshots(): identical images return 100% similarity
 * - compareScreenshots(): pixel-by-pixel vs perceptual threshold difference
 * - calculateSimilarityScore(): weighted composite score
 */

import { ImageComparator } from '../../../utils/screenshot/ImageComparator';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock pixelmatch — returns a controllable number of different pixels
const mockPixelmatch = jest.fn().mockReturnValue(0);

jest.mock('pixelmatch', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockPixelmatch(...args),
}));

// Mock FileUtils.ensureDirectory (used in createDiff)
jest.mock('../../../utils/fileUtils', () => ({
  FileUtils: {
    ensureDirectory: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock DiffRenderer functions (used inside createDiff)
jest.mock('../../../utils/screenshot/DiffRenderer', () => ({
  createPixelDiff: jest.fn().mockResolvedValue({
    write: jest.fn().mockResolvedValue(undefined),
    width: 100,
    height: 100,
    bitmap: { data: Buffer.alloc(100 * 100 * 4) },
  }),
  createPerceptualDiff: jest.fn().mockResolvedValue({
    write: jest.fn().mockResolvedValue(undefined),
    width: 100,
    height: 100,
    bitmap: { data: Buffer.alloc(100 * 100 * 4) },
  }),
  createStructuralDiff: jest.fn().mockResolvedValue({
    write: jest.fn().mockResolvedValue(undefined),
    width: 100,
    height: 100,
    bitmap: { data: Buffer.alloc(100 * 100 * 4) },
  }),
}));

// Mock logger used inside ImageComparator
jest.mock('../../../utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Helper to create a mock Jimp image
function makeMockImage(width = 100, height = 100, identical = true) {
  const data = Buffer.alloc(width * height * 4, identical ? 0 : 128);
  return {
    width,
    height,
    bitmap: { data },
    resize: jest.fn(function (this: { width: number; height: number }, { w, h }: { w: number; h: number }) {
      this.width = w;
      this.height = h;
      // Reallocate data for new size
      this.bitmap.data = Buffer.alloc(w * h * 4);
    }),
    write: jest.fn().mockResolvedValue(undefined),
  };
}

// Mock Jimp module
jest.mock('jimp', () => {
  const mockRead = jest.fn();
  const MockJimp = jest.fn().mockImplementation(({ width, height }) => makeMockImage(width, height));
  MockJimp.read = mockRead;
  return {
    Jimp: MockJimp,
    loadFont: jest.fn().mockRejectedValue(new Error('no font')),
    intToRGBA: jest.fn().mockReturnValue({ r: 128, g: 128, b: 128, a: 255 }),
    rgbaToInt: jest.fn().mockReturnValue(0xffffffff),
  };
});

import { Jimp } from 'jimp';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImageComparator', () => {
  let comparator: ImageComparator;

  beforeEach(() => {
    jest.clearAllMocks();
    comparator = new ImageComparator();
  });

  // -------------------------------------------------------------------------
  // compareScreenshots
  // -------------------------------------------------------------------------

  describe('compareScreenshots', () => {
    it('returns 100% similarity when images are identical (0 different pixels)', async () => {
      const img = makeMockImage(100, 100);
      (Jimp.read as jest.Mock).mockResolvedValue(img);
      mockPixelmatch.mockReturnValue(0);

      const result = await comparator.compareScreenshots('/base.png', '/actual.png');

      expect(result.similarityPercentage).toBe(100);
      expect(result.differencePercentage).toBe(0);
      expect(result.matches).toBe(true);
    });

    it('returns correct similarity percentage for partial difference', async () => {
      const img = makeMockImage(100, 100);
      (Jimp.read as jest.Mock).mockResolvedValue(img);
      // 1000 of 10000 pixels differ = 10% difference
      mockPixelmatch.mockReturnValue(1000);

      const result = await comparator.compareScreenshots('/base.png', '/actual.png', {
        createDiffImage: false,
      });

      expect(result.differencePercentage).toBeCloseTo(10, 1);
      expect(result.similarityPercentage).toBeCloseTo(90, 1);
    });

    it('returns matches=false when difference exceeds threshold', async () => {
      const img = makeMockImage(100, 100);
      (Jimp.read as jest.Mock).mockResolvedValue(img);
      // threshold defaults to 0.1 (10%) — 1100 pixels = 11% difference
      mockPixelmatch.mockReturnValue(1100);

      const result = await comparator.compareScreenshots('/base.png', '/actual.png', {
        createDiffImage: false,
        threshold: 0.1,
      });

      expect(result.matches).toBe(false);
    });

    it('resizes images to equal dimensions when they differ', async () => {
      const baseImg = makeMockImage(100, 100);
      const actualImg = makeMockImage(200, 150);
      (Jimp.read as jest.Mock)
        .mockResolvedValueOnce(baseImg)
        .mockResolvedValueOnce(actualImg);
      mockPixelmatch.mockReturnValue(0);

      const result = await comparator.compareScreenshots('/base.png', '/actual.png', {
        createDiffImage: false,
      });

      expect(baseImg.resize).toHaveBeenCalled();
      expect(actualImg.resize).toHaveBeenCalled();
      expect(result.metadata.resized).toBe(true);
    });

    it('does NOT set resized=true for same-size images', async () => {
      const img = makeMockImage(100, 100);
      (Jimp.read as jest.Mock).mockResolvedValue(img);
      mockPixelmatch.mockReturnValue(0);

      const result = await comparator.compareScreenshots('/base.png', '/actual.png', {
        createDiffImage: false,
      });

      expect(result.metadata.resized).toBe(false);
    });

    it('uses perceptual threshold (0.2) for perceptual algorithm', async () => {
      const img = makeMockImage(100, 100);
      (Jimp.read as jest.Mock).mockResolvedValue(img);
      mockPixelmatch.mockReturnValue(0);

      await comparator.compareScreenshots('/base.png', '/actual.png', {
        algorithm: 'perceptual',
        createDiffImage: false,
      });

      // Verify pixelmatch was called with threshold 0.2 for perceptual
      const pixelmatchCall = mockPixelmatch.mock.calls[0];
      const optionsArg = pixelmatchCall[5];
      expect(optionsArg.threshold).toBe(0.2);
    });

    it('uses pixel threshold (0.1) for pixel-by-pixel algorithm', async () => {
      const img = makeMockImage(100, 100);
      (Jimp.read as jest.Mock).mockResolvedValue(img);
      mockPixelmatch.mockReturnValue(0);

      await comparator.compareScreenshots('/base.png', '/actual.png', {
        algorithm: 'pixel-by-pixel',
        createDiffImage: false,
      });

      const pixelmatchCall = mockPixelmatch.mock.calls[0];
      const optionsArg = pixelmatchCall[5];
      expect(optionsArg.threshold).toBe(0.1);
    });

    it('includes metadata with baselineImage and actualImage paths', async () => {
      const img = makeMockImage(100, 100);
      (Jimp.read as jest.Mock).mockResolvedValue(img);
      mockPixelmatch.mockReturnValue(0);

      const result = await comparator.compareScreenshots('/path/base.png', '/path/actual.png', {
        createDiffImage: false,
      });

      expect(result.metadata.baselineImage).toBe('/path/base.png');
      expect(result.metadata.actualImage).toBe('/path/actual.png');
    });

    it('throws a descriptive error when Jimp.read fails', async () => {
      (Jimp.read as jest.Mock).mockRejectedValue(new Error('file not found'));

      await expect(
        comparator.compareScreenshots('/nonexistent.png', '/actual.png')
      ).rejects.toThrow('Screenshot comparison failed');
    });
  });

  // -------------------------------------------------------------------------
  // calculateSimilarityScore
  // -------------------------------------------------------------------------

  describe('calculateSimilarityScore', () => {
    it('returns a composite overall score weighted across all three algorithms', async () => {
      const img = makeMockImage(100, 100);
      (Jimp.read as jest.Mock).mockResolvedValue(img);
      // All algorithms return 0 diffs → 100% similarity
      mockPixelmatch.mockReturnValue(0);

      const score = await comparator.calculateSimilarityScore('/base.png', '/actual.png');

      expect(score.overall).toBeCloseTo(100, 1);
      expect(score.pixel).toBe(100);
      expect(score.perceptual).toBe(100);
      expect(score.structural).toBe(100);
    });

    it('applies custom weights to the overall score', async () => {
      const img = makeMockImage(100, 100);
      (Jimp.read as jest.Mock).mockResolvedValue(img);
      mockPixelmatch.mockReturnValue(0);

      const score = await comparator.calculateSimilarityScore('/base.png', '/actual.png', {
        weights: { pixel: 1, perceptual: 0, structural: 0 },
      });

      // With weight 1 on pixel and 0 elsewhere, overall = pixel value
      expect(score.overall).toBeCloseTo(score.pixel, 1);
    });
  });
});
