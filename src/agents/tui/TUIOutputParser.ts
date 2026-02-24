/**
 * TUIOutputParser - Output parsing and color/formatting utilities
 *
 * Responsible for:
 * - Stripping ANSI escape codes from terminal output
 * - Extracting color and formatting information
 * - Validating output against expected patterns
 * - Providing access to session output buffers
 */

import { TerminalOutput, ColorInfo } from './types';

/** ANSI color code to color name mapping */
const ANSI_COLOR_MAP: Record<number, string> = {
  30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'white'
};

/**
 * Strip ANSI escape codes from terminal text
 *
 * @param text - Raw terminal output with ANSI codes
 * @returns Clean text without escape sequences
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Parse ANSI color codes from terminal text into structured color info.
 *
 * Accumulates formatting state across consecutive ANSI escape sequences before
 * each text segment so that a sequence like ESC[31mESC[1mBold Red ESC[0m is
 * parsed as a single ColorInfo with fg='red' AND styles=['bold'].
 *
 * @param text - Raw terminal output with ANSI codes
 * @returns Array of ColorInfo objects describing text segments and their formatting
 */
export function parseColors(text: string): ColorInfo[] {
  const colors: ColorInfo[] = [];
  // Tokenise the string into alternating escape sequences and plain text.
  // Each token is either an ANSI CSI sequence or a run of printable characters.
  const tokenRegex = /\u001b\[([0-9;]*)m|([^\u001b]+)/g;
  let match;
  let position = 0;

  // Current accumulated state (reset on ESC[0m or ESC[m)
  let currentFg: string | undefined;
  let currentBg: string | undefined;
  let currentStyles: string[] = [];

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match[1] !== undefined) {
      // This is an ANSI escape sequence — update accumulated state
      const codes = match[1] === '' ? [0] : match[1].split(';').map(Number);

      for (const code of codes) {
        if (code === 0) {
          // Reset all attributes
          currentFg = undefined;
          currentBg = undefined;
          currentStyles = [];
        } else if (code >= 30 && code <= 37) {
          currentFg = ANSI_COLOR_MAP[code];
        } else if (code >= 40 && code <= 47) {
          currentBg = ANSI_COLOR_MAP[code - 10];
        } else if (code === 1) {
          if (!currentStyles.includes('bold')) currentStyles.push('bold');
        } else if (code === 3) {
          if (!currentStyles.includes('italic')) currentStyles.push('italic');
        } else if (code === 4) {
          if (!currentStyles.includes('underline')) currentStyles.push('underline');
        }
      }
    } else if (match[2]) {
      // Plain text segment — emit a ColorInfo with current accumulated state
      const content = match[2];
      const colorInfo: ColorInfo = {
        text: content,
        styles: [...currentStyles],
        position: { start: position, end: position + content.length }
      };

      if (currentFg !== undefined) colorInfo.fg = currentFg;
      if (currentBg !== undefined) colorInfo.bg = currentBg;

      colors.push(colorInfo);
      position += content.length;
    }
  }

  return colors;
}

/**
 * Get the latest (most recent) output from a session's output buffer
 *
 * @param outputBuffer - The session's output buffer array
 * @returns The most recent TerminalOutput or null if buffer is empty
 */
export function getLatestOutput(outputBuffer: TerminalOutput[]): TerminalOutput | null {
  if (outputBuffer.length === 0) return null;
  return outputBuffer[outputBuffer.length - 1];
}

/**
 * Validate terminal output against an expected value or pattern
 *
 * Supported formats:
 * - String: exact match
 * - String "regex:<pattern>": regex test
 * - String "contains:<text>": substring check
 * - Object { type, value }: typed validation
 *
 * @param output - The TerminalOutput to validate
 * @param expected - The expected value or pattern
 * @returns true if validation passes
 * @throws Error for unsupported validation types
 */
export function performOutputValidation(
  output: TerminalOutput,
  expected: unknown,
  allOutput?: TerminalOutput[]
): boolean {
  if (typeof expected === 'string') {
    if (expected.startsWith('regex:')) {
      const pattern = expected.substring(6);
      const regex = new RegExp(pattern, 'i');
      return regex.test(output.text);
    } else if (expected.startsWith('contains:')) {
      const searchText = expected.substring(9);
      return output.text.includes(searchText);
    } else {
      return output.text.trim() === expected.trim();
    }
  }

  if (typeof expected === 'object' && expected !== null) {
    const exp = expected as Record<string, unknown>;
    if (exp['type']) {
      switch (exp['type']) {
        case 'contains':
          return output.text.includes(String(exp['value'] ?? ''));
        case 'not_contains':
          return !output.text.includes(String(exp['value'] ?? ''));
        case 'starts_with':
          return output.text.startsWith(String(exp['value'] ?? ''));
        case 'ends_with':
          return output.text.endsWith(String(exp['value'] ?? ''));
        case 'empty':
          return output.text.trim().length === 0;
        case 'not_empty': {
          // Check the current output; if it is empty, fall back to the most
          // recent non-empty output from the session buffer (if provided).
          if (output.text.trim().length > 0) return true;
          if (allOutput) {
            for (let i = allOutput.length - 1; i >= 0; i--) {
              if (allOutput[i].text.trim().length > 0) return true;
            }
          }
          return false;
        }
        case 'length': {
          // Accept if text length is within the stated bound (<=).
          const bound = typeof exp['value'] === 'number' ? exp['value'] : Number(exp['value']);
          return output.text.length <= bound;
        }
        default:
          throw new Error(`Unsupported validation type: ${exp['type']}`);
      }
    }
  }

  return false;
}

/**
 * Compare two string arrays for equality (order-sensitive)
 *
 * @param a - First array
 * @param b - Second array
 * @returns true if arrays are equal
 */
export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}
