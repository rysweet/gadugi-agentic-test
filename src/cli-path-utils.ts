/**
 * CLI path utilities — safe path resolution to prevent directory traversal.
 *
 * Issue #93: User-supplied --directory, --file, --config, and --scenario values
 * must be bounds-checked before being passed to file I/O.  An attacker could
 * otherwise supply `../../etc/passwd` to read arbitrary files on the host.
 *
 * Rules enforced by safeResolvePath:
 *   1. Relative paths are resolved against `base` (defaults to process.cwd()).
 *   2. The resolved path must start with `base + path.sep` OR equal `base`
 *      exactly.  Anything outside that range throws CLIPathError.
 *   3. Absolute paths supplied by the user are validated against the same
 *      bounds — they must still reside inside `base`.
 */

import * as path from 'path';

/** Thrown when a user-supplied path attempts to escape the allowed directory. */
export class CLIPathError extends Error {
  constructor(input: string, base: string) {
    super(
      `Path '${input}' escapes the allowed directory '${base}'. ` +
        `Use an absolute path that is inside the allowed directory, ` +
        `or a relative path that does not traverse above it.`
    );
    this.name = 'CLIPathError';
  }
}

/**
 * Resolve `input` relative to `base` and verify the result stays inside `base`.
 *
 * @param input - The raw path string provided by the user (e.g., from a CLI flag).
 * @param base  - The directory that `input` must reside within.
 *                Defaults to `process.cwd()`.
 * @returns The absolute, canonical path string.
 * @throws CLIPathError if the resolved path escapes `base`.
 */
export function safeResolvePath(
  input: string,
  base: string = process.cwd()
): string {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, input);

  // Allow the path if it is exactly the base dir or a descendant of it.
  const isExactBase = resolved === resolvedBase;
  const isDescendant = resolved.startsWith(resolvedBase + path.sep);

  if (!isExactBase && !isDescendant) {
    throw new CLIPathError(input, resolvedBase);
  }

  return resolved;
}
