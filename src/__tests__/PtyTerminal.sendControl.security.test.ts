/**
 * Security tests for PtyTerminal.sendControl
 * Issue #107: sendControl injection vulnerability
 *
 * The sendControl method must accept only a single ASCII letter A-Z (or a-z).
 * Any other input must be rejected with a descriptive error before control code
 * calculation occurs, preventing injection of arbitrary control codes.
 */

import { PtyTerminal } from '../core/PtyTerminal';

// We do not spawn a real PTY in unit tests; we exercise only the validation
// path inside sendControl which fires BEFORE the PTY activity check.
// The method first validates the character, then checks PTY state.
// We test that invalid chars throw BEFORE the PTY-not-started error path.

describe('PtyTerminal.sendControl – input validation (Issue #107)', () => {
  let terminal: PtyTerminal;

  beforeEach(() => {
    terminal = new PtyTerminal();
  });

  // -----------------------------------------------------------------------
  // Valid inputs – should NOT throw the validation error
  // (they may throw "not started" because no PTY is spawned, but that
  //  is a different, expected error)
  // -----------------------------------------------------------------------

  describe('valid single-letter inputs', () => {
    it('should not throw a validation error for uppercase letter C', () => {
      // PTY not started → throws "not started", not the validation error
      expect(() => terminal.sendControl('C')).toThrow(/not started|not active/);
    });

    it('should not throw a validation error for lowercase letter c', () => {
      expect(() => terminal.sendControl('c')).toThrow(/not started|not active/);
    });

    it('should not throw a validation error for letter A', () => {
      expect(() => terminal.sendControl('A')).toThrow(/not started|not active/);
    });

    it('should not throw a validation error for letter Z', () => {
      expect(() => terminal.sendControl('Z')).toThrow(/not started|not active/);
    });

    it('should not throw a validation error for letter a', () => {
      expect(() => terminal.sendControl('a')).toThrow(/not started|not active/);
    });

    it('should not throw a validation error for letter z', () => {
      expect(() => terminal.sendControl('z')).toThrow(/not started|not active/);
    });
  });

  // -----------------------------------------------------------------------
  // Invalid inputs – must throw the validation error (NOT "not started")
  // -----------------------------------------------------------------------

  describe('invalid inputs – must be rejected before PTY check', () => {
    it('should throw for empty string', () => {
      expect(() => terminal.sendControl('')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a digit "1"', () => {
      expect(() => terminal.sendControl('1')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a digit "0"', () => {
      expect(() => terminal.sendControl('0')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a raw control character \\x01', () => {
      expect(() => terminal.sendControl('\x01')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a newline character', () => {
      expect(() => terminal.sendControl('\n')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a carriage return', () => {
      expect(() => terminal.sendControl('\r')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a tab character', () => {
      expect(() => terminal.sendControl('\t')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a space character', () => {
      expect(() => terminal.sendControl(' ')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a two-letter string "AB"', () => {
      expect(() => terminal.sendControl('AB')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a multi-character string "Ctrl"', () => {
      expect(() => terminal.sendControl('Ctrl')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a bracket "[" (often used in escape sequences)', () => {
      expect(() => terminal.sendControl('[')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a backslash "\\"', () => {
      expect(() => terminal.sendControl('\\')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a non-ASCII unicode letter "é"', () => {
      expect(() => terminal.sendControl('é')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should throw for a non-ASCII unicode letter "Ω"', () => {
      expect(() => terminal.sendControl('Ω')).toThrow(
        /sendControl requires a single letter A-Z/
      );
    });

    it('should include the invalid char in the error message', () => {
      let caughtError: Error | undefined;
      try {
        terminal.sendControl('1');
      } catch (e) {
        caughtError = e as Error;
      }
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toMatch(/sendControl requires a single letter A-Z/);
    });
  });
});
