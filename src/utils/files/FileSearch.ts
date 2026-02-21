/**
 * FileSearch - File discovery operations
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import { glob } from 'glob';
import { FileOperationError } from './types';

/**
 * Find files matching patterns
 */
export async function findFiles(
  patterns: string | string[],
  options?: {
    cwd?: string;
    ignore?: string[];
    absolute?: boolean;
  }
): Promise<string[]> {
  try {
    const globPatterns = Array.isArray(patterns) ? patterns : [patterns];
    const results: string[] = [];

    for (const pattern of globPatterns) {
      const matches = await glob(pattern, {
        cwd: options?.cwd,
        ignore: options?.ignore,
        absolute: options?.absolute ?? true
      });
      results.push(...matches);
    }

    // Remove duplicates
    return [...new Set(results)];
  } catch (error: unknown) {
    throw new FileOperationError(
      `Failed to find files: ${error instanceof Error ? error.message : String(error)}`,
      'findFiles'
    );
  }
}

/**
 * Calculate file hash
 */
export async function calculateHash(filePath: string, algorithm: string = 'md5'): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash(algorithm).update(buffer).digest('hex');
  } catch (error: unknown) {
    throw new FileOperationError(
      `Failed to calculate hash: ${error instanceof Error ? error.message : String(error)}`,
      'calculateHash',
      filePath
    );
  }
}

/**
 * Filter files by age
 */
export async function filterByAge(files: string[], cutoffTime: number): Promise<string[]> {
  const filtered: string[] = [];

  for (const filePath of files) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.mtime.getTime() < cutoffTime) {
        filtered.push(filePath);
      }
    } catch {
      // Skip files that can't be accessed
    }
  }

  return filtered;
}

/**
 * Convert a glob pattern to a RegExp safely.
 *
 * Security: user-supplied patterns must have all regex metacharacters
 * escaped before wildcard substitution, otherwise an attacker can inject
 * a ReDoS-prone pattern such as `(a+)+` via a YAML config file.
 *
 * Escaping order matters:
 *   1. Escape the backslash first (it is the escape character itself).
 *   2. Escape every other regex metacharacter as a literal.
 *   3. Replace glob wildcards (* and ?) with their regex equivalents.
 */
function globToRegex(glob: string): RegExp {
  const escaped = glob
    // Step 1: escape backslashes first so later replacements are not affected
    .replace(/\\/g, '\\\\')
    // Step 2: escape all other regex metacharacters except * and ?
    //         (which are the glob wildcards we intentionally convert below)
    .replace(/[.+^${}()|[\]]/g, '\\$&')
    // Step 3: convert glob wildcards to regex equivalents
    .replace(/\*/g, '.*')   // * matches any sequence of characters
    .replace(/\?/g, '.');   // ? matches exactly one character
  // Anchor to the full string so 'foo.txt' does not match 'bar/foo.txt'
  // when used as a simple name-only pattern.
  return new RegExp(`^${escaped}$`);
}

/**
 * Filter files by patterns
 *
 * Security fix (issue #106): patterns are now converted to RegExp via
 * globToRegex() which escapes all metacharacters before substituting
 * wildcards, preventing ReDoS through user-supplied config patterns.
 */
export function filterByPatterns(files: string[], patterns: string[], exclude: boolean): string[] {
  // Pre-compile all regexes outside the inner loop; globToRegex() safely
  // escapes metacharacters so no user input reaches the RegExp engine raw.
  const regexes = patterns.map(p => globToRegex(p));

  return files.filter(filePath => {
    const fileName = filePath.split('/').pop() || filePath;
    // Match against both the full path and the file name so that patterns
    // like '*.log' work for both '/tmp/foo.log' and 'foo.log' inputs.
    const matches = regexes.some(re => re.test(filePath) || re.test(fileName));
    return exclude ? !matches : matches;
  });
}
