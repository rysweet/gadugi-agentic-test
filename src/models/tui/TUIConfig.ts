/**
 * TUI testing configuration types
 */

import { TUIKeyEvent } from './TUISession';

/**
 * Terminal screen dimensions
 */
export interface TUIDimensions {
  /** Terminal width in columns */
  width: number;
  /** Terminal height in rows */
  height: number;
}

/**
 * TUI testing configuration options
 */
export interface TUIConfig {
  /** Terminal emulator to use */
  terminal: 'xterm' | 'vt100' | 'ansi' | 'custom';

  /** Default terminal dimensions */
  defaultDimensions: TUIDimensions;

  /** Terminal encoding */
  encoding: 'utf8' | 'ascii' | 'latin1';

  /** Default timeout for TUI operations in milliseconds */
  defaultTimeout: number;

  /** Polling interval for state changes in milliseconds */
  pollingInterval: number;

  /** Whether to capture terminal screenshots */
  captureScreenshots: boolean;

  /** Directory for storing terminal recordings */
  recordingDir?: string;

  /** Whether to record terminal sessions */
  recordSessions: boolean;

  /** Maximum recording duration in milliseconds */
  maxRecordingDuration?: number;

  /** Color mode support */
  colorMode: '1bit' | '4bit' | '8bit' | '24bit';

  /** Whether to interpret ANSI escape sequences */
  interpretAnsi: boolean;

  /** Shell command to launch */
  shell: string;

  /** Shell arguments */
  shellArgs: string[];

  /** Environment variables for terminal session */
  environment: Record<string, string>;

  /** Working directory for terminal session */
  workingDirectory: string;

  /** Locale settings */
  locale?: string;

  /** Custom key mappings */
  keyMappings?: Record<string, TUIKeyEvent>;

  /** Accessibility options */
  accessibility: {
    /** High contrast mode */
    highContrast: boolean;
    /** Large text mode */
    largeText: boolean;
    /** Screen reader support */
    screenReader: boolean;
  };

  /** Performance settings */
  performance: {
    /** Buffer update frequency in Hz */
    refreshRate: number;
    /** Maximum buffer size */
    maxBufferSize: number;
    /** Enable hardware acceleration */
    hardwareAcceleration: boolean;
  };
}
