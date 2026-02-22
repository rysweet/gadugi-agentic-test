/**
 * Shared ANSI colour codes for terminal output.
 * Import this instead of duplicating the object in each file.
 */
export const colors = {
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  reset:   '\x1b[0m'
} as const;

export type ColorKey = keyof typeof colors;
