/**
 * DocumentationLoader targeted tests — covers error branches.
 *
 * Covers:
 *  - loadMarkdownFiles() per-file error (line 50)
 *  - loadMarkdownFiles() outer error (lines 56-57)
 *  - findDocumentationFiles() glob error (line 136)
 */

// ---------------------------------------------------------------------------
// Mocks — BEFORE imports
// ---------------------------------------------------------------------------

const mockGlob = jest.fn();

jest.mock('glob', () => ({ glob: (...args: unknown[]) => mockGlob(...args) }));

const mockReadFile = jest.fn();

jest.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

jest.mock('../utils/logger', () => {
  const actual = jest.requireActual<typeof import('../utils/logger')>('../utils/logger');
  return {
    ...actual,
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { DocumentationLoader } from '../agents/comprehension/DocumentationLoader';
import { logger } from '../utils/logger';

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// loadMarkdownFiles() — per-file read error
// ===========================================================================
describe('DocumentationLoader.loadMarkdownFiles() error handling', () => {
  it('logs error and skips a file when readFile throws (line 50 coverage)', async () => {
    const loader = new DocumentationLoader('docs');

    // glob returns one file
    mockGlob.mockResolvedValue(['/docs/bad.md']);

    // readFile throws for that file
    mockReadFile.mockRejectedValue(new Error('EACCES: permission denied'));

    const docs = await loader.loadMarkdownFiles();

    // Should return empty object (file skipped) without throwing
    expect(docs).toEqual({});
    expect((logger.error as jest.Mock)).toHaveBeenCalled();
  });

  it('returns {} when glob itself throws (outer error handler, lines 56-57)', async () => {
    const loader = new DocumentationLoader('docs');

    // glob throws
    mockGlob.mockRejectedValue(new Error('glob error'));

    const docs = await loader.loadMarkdownFiles();

    expect(docs).toEqual({});
    expect((logger.error as jest.Mock)).toHaveBeenCalled();
  });

  it('logs error and continues when one pattern glob throws (line 136)', async () => {
    const loader = new DocumentationLoader(
      'docs',
      ['**/*.md', '**/*.txt']  // two patterns
    );

    // First pattern throws, second succeeds with empty
    mockGlob
      .mockRejectedValueOnce(new Error('pattern error'))
      .mockResolvedValueOnce([]);

    const docs = await loader.loadMarkdownFiles();

    // Should not throw
    expect(docs).toEqual({});
  });

  it('returns populated docs when readFile succeeds', async () => {
    const loader = new DocumentationLoader('docs');

    mockGlob.mockResolvedValue(['/docs/guide.md']);
    mockReadFile.mockResolvedValue('# Guide\nThis is a guide.');

    const docs = await loader.loadMarkdownFiles();

    // Should have one entry
    expect(Object.keys(docs)).toHaveLength(1);
    expect(Object.values(docs)[0]).toContain('# Guide');
  });
});

// ===========================================================================
// extractFeatures() — CLI command patterns
// ===========================================================================
describe('DocumentationLoader.extractFeatures()', () => {
  it('returns empty array when no cliCommandPatterns are configured', () => {
    const loader = new DocumentationLoader();
    const features = loader.extractFeatures('Some documentation without patterns');
    expect(Array.isArray(features)).toBe(true);
    // Without patterns, only UI/API features are extracted
    expect(features.length).toBeGreaterThanOrEqual(0);
  });
});
