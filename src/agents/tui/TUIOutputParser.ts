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
 * Parse ANSI color codes from terminal text into structured color info
 *
 * @param text - Raw terminal output with ANSI codes
 * @returns Array of ColorInfo objects describing text segments and their formatting
 */
export function parseColors(text: string): ColorInfo[] {
  const colors: ColorInfo[] = [];
  const ansiRegex = /\u001b\[([0-9;]*)m([^\u001b]*)/g;
  let match;
  let position = 0;

  while ((match = ansiRegex.exec(text)) !== null) {
    const codes = match[1].split(';').map(Number);
    const content = match[2];

    if (content) {
      const colorInfo: ColorInfo = {
        text: content,
        styles: [],
        position: { start: position, end: position + content.length }
      };

      for (const code of codes) {
        if (code >= 30 && code <= 37) {
          colorInfo.fg = ANSI_COLOR_MAP[code];
        } else if (code >= 40 && code <= 47) {
          colorInfo.bg = ANSI_COLOR_MAP[code - 10];
        } else if (code === 1) {
          colorInfo.styles.push('bold');
        } else if (code === 3) {
          colorInfo.styles.push('italic');
        } else if (code === 4) {
          colorInfo.styles.push('underline');
        }
      }

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
export function performOutputValidation(output: TerminalOutput, expected: any): boolean {
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

  if (typeof expected === 'object' && expected.type) {
    switch (expected.type) {
      case 'contains':
        return output.text.includes(expected.value);
      case 'not_contains':
        return !output.text.includes(expected.value);
      case 'starts_with':
        return output.text.startsWith(expected.value);
      case 'ends_with':
        return output.text.endsWith(expected.value);
      case 'empty':
        return output.text.trim().length === 0;
      case 'not_empty':
        return output.text.trim().length > 0;
      case 'length':
        return output.text.length === expected.value;
      default:
        throw new Error(`Unsupported validation type: ${expected.type}`);
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
