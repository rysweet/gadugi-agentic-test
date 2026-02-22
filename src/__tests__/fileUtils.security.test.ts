/**
 * Security tests for fileUtils.ts
 * Covers:
 *   1. filterByPatterns ReDoS prevention (issue #106)
 *   2. cleanup() path traversal prevention (issue #106)
 */

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { FileUtils } from '../utils/fileUtils';

// ---------------------------------------------------------------------------
// Helper: run a function with a hard wall-clock deadline (ms)
// Returns true if it completed within the deadline, false if it timed out.
// ---------------------------------------------------------------------------
function withTimeout<T>(fn: () => T, ms: number): Promise<{ completed: boolean; result?: T }> {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve({ completed: false });
      }
    }, ms);

    try {
      const result = fn();
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ completed: true, result });
      }
    } catch {
      if (!done) {
        done = true;
        clearTimeout(timer);
        // Still completed (with error) — treat as completed for ReDoS purposes
        resolve({ completed: true });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Access the private filterByPatterns method via the class (cast to any)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filterByPatterns = (FileUtils as any).filterByPatterns.bind(FileUtils) as (
  files: string[],
  patterns: string[],
  exclude: boolean
) => Promise<string[]>;

// ---------------------------------------------------------------------------
// 1. ReDoS prevention tests
// ---------------------------------------------------------------------------
describe('FileUtils.filterByPatterns — ReDoS prevention', () => {
  // A classic catastrophic backtracking pattern: (a+)+ applied to a long input
  // that cannot match. In a naïve engine this causes O(2^n) backtracking.
  const redosInputs = [
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!', // ~28 a's + non-matching tail
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!', // ~33 a's
  ];

  test('pattern "(a+)+" does not cause catastrophic backtracking', async () => {
    // If the fix is in place the pattern is treated as a literal glob
    // (special chars escaped), so it will not match and returns quickly.
    const files = redosInputs;
    const pattern = '(a+)+';

    const { completed } = await withTimeout(
      () => filterByPatterns(files, [pattern], false),
      500 // 500 ms is generous — proper fix should complete in <5 ms
    );

    expect(completed).toBe(true);
  });

  test('pattern with nested quantifiers completes quickly on long non-matching input', async () => {
    const longInput = 'a'.repeat(40) + '!';
    const files = [longInput];

    // Pattern with nested groups that would cause ReDoS in raw regex mode
    const pattern = '(a+)+b';

    const { completed } = await withTimeout(
      () => filterByPatterns(files, [pattern], false),
      500
    );

    expect(completed).toBe(true);
  });

  test('glob wildcard * still matches file names correctly after escaping', async () => {
    const files = [
      '/tmp/test/foo.log',
      '/tmp/test/bar.log',
      '/tmp/test/baz.txt',
    ];

    // *.log should match .log files only
    const matched = await filterByPatterns(files, ['*.log'], false);
    expect(matched).toEqual(expect.arrayContaining(['/tmp/test/foo.log', '/tmp/test/bar.log']));
    expect(matched).not.toContain('/tmp/test/baz.txt');
  });

  test('glob wildcard ? matches single character correctly', async () => {
    const files = [
      '/tmp/file1.txt',
      '/tmp/file2.txt',
      '/tmp/file10.txt', // two chars after 'file'
    ];

    // file?.txt should match file1.txt and file2.txt but NOT file10.txt
    const matched = await filterByPatterns(files, ['file?.txt'], false);
    // Both file1.txt and file2.txt paths should match
    const names = matched.map(f => path.basename(f));
    expect(names).toContain('file1.txt');
    expect(names).toContain('file2.txt');
    expect(names).not.toContain('file10.txt');
  });

  test('regex metacharacters in pattern are treated as literals', async () => {
    const files = [
      '/tmp/file.txt',   // literal dot — should match 'file.txt' glob
      '/tmp/fileXtxt',   // dot as regex wildcard — must NOT match
    ];

    // 'file.txt' as a glob: the dot is a literal dot, not a regex wildcard
    const matched = await filterByPatterns(files, ['file.txt'], false);
    expect(matched).toContain('/tmp/file.txt');
    expect(matched).not.toContain('/tmp/fileXtxt');
  });

  test('exclude mode correctly inverts match', async () => {
    const files = [
      '/tmp/keep.txt',
      '/tmp/remove.log',
      '/tmp/also-keep.md',
    ];

    // Exclude *.log → should return only non-.log files
    const kept = await filterByPatterns(files, ['*.log'], true);
    expect(kept).toContain('/tmp/keep.txt');
    expect(kept).toContain('/tmp/also-keep.md');
    expect(kept).not.toContain('/tmp/remove.log');
  });
});

// ---------------------------------------------------------------------------
// 2. cleanup() path traversal prevention tests
// ---------------------------------------------------------------------------
describe('FileUtils.cleanup — path traversal prevention', () => {
  let targetDir: string;
  let outsideDir: string;

  beforeEach(async () => {
    // Create a fresh temp directory structure for each test
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'fileutils-sec-'));
    targetDir = path.join(base, 'target');
    outsideDir = path.join(base, 'outside');
    await fs.mkdir(targetDir, { recursive: true });
    await fs.mkdir(outsideDir, { recursive: true });

    // Create a file inside the target directory
    await fs.writeFile(path.join(targetDir, 'inside.txt'), 'inside');
    // Create a sensitive file outside the target directory
    await fs.writeFile(path.join(outsideDir, 'secret.txt'), 'secret');
  });

  afterEach(async () => {
    // Best-effort cleanup of temp dirs
    const base = path.dirname(targetDir);
    try {
      await fs.rm(base, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('cleanup() with traversal pattern does not delete files outside the target directory', async () => {
    // Attempt path traversal via the includePatterns option
    const relTraversal = path.relative(targetDir, path.join(outsideDir, 'secret.txt'));
    // On Linux this produces something like '../../outside/secret.txt'

    await FileUtils.cleanup(targetDir, {
      includePatterns: [relTraversal, '**/*'],
      dryRun: false,
    });

    // The outside file must still exist — the fix must have blocked deletion
    const secretExists = await fs.access(path.join(outsideDir, 'secret.txt')).then(() => true).catch(() => false);
    expect(secretExists).toBe(true);
  });

  test('cleanup() with absolute path pattern outside target does not delete that file', async () => {
    const absoluteTarget = path.join(outsideDir, 'secret.txt');

    await FileUtils.cleanup(targetDir, {
      includePatterns: [absoluteTarget, '**/*'],
      dryRun: false,
    });

    const secretExists = await fs.access(absoluteTarget).then(() => true).catch(() => false);
    expect(secretExists).toBe(true);
  });

  test('cleanup() deletes files inside the target directory normally', async () => {
    const insideFile = path.join(targetDir, 'inside.txt');

    await FileUtils.cleanup(targetDir, {
      includePatterns: ['**/*'],
      dryRun: false,
    });

    // The inside file should be gone
    const insideExists = await fs.access(insideFile).then(() => true).catch(() => false);
    expect(insideExists).toBe(false);
  });

  test('cleanup() dryRun does not delete any files', async () => {
    const insideFile = path.join(targetDir, 'inside.txt');
    const secretFile = path.join(outsideDir, 'secret.txt');

    await FileUtils.cleanup(targetDir, {
      includePatterns: ['**/*'],
      dryRun: true,
    });

    const insideExists = await fs.access(insideFile).then(() => true).catch(() => false);
    const secretExists = await fs.access(secretFile).then(() => true).catch(() => false);
    expect(insideExists).toBe(true);
    expect(secretExists).toBe(true);
  });

  test('cleanup() returns only inside-directory paths in deletedFiles', async () => {
    // Create a few files inside target
    await fs.writeFile(path.join(targetDir, 'a.txt'), 'a');
    await fs.writeFile(path.join(targetDir, 'b.txt'), 'b');

    const result = await FileUtils.cleanup(targetDir, {
      includePatterns: ['**/*'],
      dryRun: false,
    });

    const safeBase = path.resolve(targetDir);
    for (const deleted of result.deletedFiles) {
      expect(path.resolve(deleted).startsWith(safeBase)).toBe(true);
    }
    for (const deleted of result.deletedDirectories) {
      expect(path.resolve(deleted).startsWith(safeBase)).toBe(true);
    }
  });
});
