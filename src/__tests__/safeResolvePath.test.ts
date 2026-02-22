/**
 * Tests for safeResolvePath - path traversal prevention (issue #93)
 *
 * Ensures user-supplied path arguments cannot escape the allowed base directory
 * via traversal sequences like ../../etc/passwd.
 */

import * as path from 'path';

// We import the function under test from its module location.
// safeResolvePath is exported from cli-path-utils for testability.
import { safeResolvePath } from '../cli-path-utils';

describe('safeResolvePath', () => {
  const base = '/tmp/test-base';

  describe('legitimate relative paths', () => {
    it('allows a simple relative subdirectory', () => {
      const result = safeResolvePath('./scenarios', base);
      expect(result).toBe(path.join(base, 'scenarios'));
    });

    it('allows a nested relative path', () => {
      const result = safeResolvePath('foo/bar/baz', base);
      expect(result).toBe(path.join(base, 'foo', 'bar', 'baz'));
    });

    it('allows the base directory itself (dot)', () => {
      const result = safeResolvePath('.', base);
      expect(result).toBe(base);
    });

    it('allows a relative path with no leading dot', () => {
      const result = safeResolvePath('scenarios/my-test.yaml', base);
      expect(result).toBe(path.join(base, 'scenarios', 'my-test.yaml'));
    });
  });

  describe('path traversal attacks', () => {
    it('rejects a simple double-dot traversal', () => {
      expect(() => safeResolvePath('../etc/passwd', base)).toThrow(
        /escapes the allowed directory/
      );
    });

    it('rejects a deep traversal attempt', () => {
      expect(() => safeResolvePath('../../../etc/passwd', base)).toThrow(
        /escapes the allowed directory/
      );
    });

    it('rejects a traversal that goes up and then down into a sibling', () => {
      expect(() => safeResolvePath('../sibling-dir/file.txt', base)).toThrow(
        /escapes the allowed directory/
      );
    });

    it('rejects a traversal sequence embedded in a longer path', () => {
      expect(() => safeResolvePath('scenarios/../../etc/shadow', base)).toThrow(
        /escapes the allowed directory/
      );
    });

    it('rejects a path that resolves exactly to the parent directory', () => {
      // Resolves to /tmp/test-base/.. which is /tmp
      expect(() => safeResolvePath('..', base)).toThrow(
        /escapes the allowed directory/
      );
    });
  });

  describe('absolute paths', () => {
    it('allows an absolute path that is inside the base directory', () => {
      const insidePath = path.join(base, 'subdir', 'file.yaml');
      const result = safeResolvePath(insidePath, base);
      expect(result).toBe(insidePath);
    });

    it('rejects an absolute path outside the base directory', () => {
      expect(() => safeResolvePath('/etc/passwd', base)).toThrow(
        /escapes the allowed directory/
      );
    });

    it('rejects an absolute path to /tmp (parent of base)', () => {
      expect(() => safeResolvePath('/tmp', base)).toThrow(
        /escapes the allowed directory/
      );
    });
  });

  describe('edge cases', () => {
    it('allows a path equal to the base directory itself', () => {
      const result = safeResolvePath(base, base);
      expect(result).toBe(base);
    });

    it('uses process.cwd() as the default base when none is supplied', () => {
      const cwd = process.cwd();
      const result = safeResolvePath('./relative-path');
      expect(result).toBe(path.join(cwd, 'relative-path'));
    });

    it('rejects traversal even when base is process.cwd()', () => {
      expect(() => safeResolvePath('../../etc/passwd')).toThrow(
        /escapes the allowed directory/
      );
    });

    it('handles a path with encoded-looking sequences (plain string, not URL)', () => {
      // Node path.resolve does NOT decode URL encoding - literal %2F is kept
      // A path like 'foo%2F..%2Fetc' is treated as a filename component, not traversal
      const result = safeResolvePath('foo%2F..%2Fetc', base);
      expect(result).toBe(path.join(base, 'foo%2F..%2Fetc'));
    });
  });
});
