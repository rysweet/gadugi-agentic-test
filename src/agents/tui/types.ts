/**
 * TUI sub-module shared types and interfaces
 *
 * All TypeScript interfaces, types, and the default configuration
 * used across the TUI agent sub-modules.
 */

import { LogLevel } from '../../utils/logger';

/**
 * TUI Agent configuration options
 */
export interface TUIAgentConfig {
  /** Terminal type (xterm, ansi, etc.) */
  terminalType?: string;
  /** Terminal size */
  terminalSize?: { cols: number; rows: number };
  /** Working directory for TUI applications */
  workingDirectory?: string;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Default timeout for operations in milliseconds */
  defaultTimeout?: number;
  /** Input timing configuration */
  inputTiming?: {
    /** Delay between keystrokes in milliseconds */
    keystrokeDelay: number;
    /** Delay after sending input before reading output */
    responseDelay: number;
    /** Maximum time to wait for output changes */
    stabilizationTimeout: number;
  };
  /** Output capture configuration */
  outputCapture?: {
    /** Whether to preserve ANSI escape codes */
    preserveColors: boolean;
    /** Buffer size for output capture */
    bufferSize: number;
    /** Whether to capture timing information */
    captureTiming: boolean;
  };
  /** Cross-platform settings */
  crossPlatform?: {
    /** Windows-specific command prefix */
    windowsPrefix?: string;
    /** Unix shell to use */
    unixShell?: string;
    /** Platform-specific key mappings */
    keyMappings?: Record<string, Record<string, string>>;
  };
  /** Performance monitoring */
  performance?: {
    /** Enable performance monitoring */
    enabled: boolean;
    /** Sample rate for metrics collection */
    sampleRate: number;
    /** Memory usage threshold in MB */
    memoryThreshold: number;
    /** CPU usage threshold in percentage */
    cpuThreshold: number;
  };
  /** Logging configuration */
  logConfig?: {
    logInputs: boolean;
    logOutputs: boolean;
    logColors: boolean;
    logLevel: LogLevel;
  };
}

/**
 * Terminal session information
 */
export interface TerminalSession {
  /** Session ID */
  id: string;
  /** Process ID */
  pid: number;
  /** Command being executed */
  command: string;
  /** Arguments */
  args: string[];
  /** Start time */
  startTime: Date;
  /** Status */
  status: 'running' | 'completed' | 'failed' | 'killed';
  /** Child process reference */
  process: import('child_process').ChildProcess;
  /** Terminal size */
  size: { cols: number; rows: number };
  /** Output buffer */
  outputBuffer: TerminalOutput[];
  /** Performance metrics */
  metrics?: PerformanceMetrics;
}

/**
 * Terminal output with metadata
 */
export interface TerminalOutput {
  /** Output type */
  type: 'stdout' | 'stderr';
  /** Raw data with ANSI codes */
  raw: string;
  /** Cleaned text without ANSI codes */
  text: string;
  /** Extracted color information */
  colors?: ColorInfo[];
  /** Timestamp */
  timestamp: Date;
  /** Cursor position if available */
  cursor?: { x: number; y: number };
}

/**
 * Color and formatting information
 */
export interface ColorInfo {
  /** Text content */
  text: string;
  /** Foreground color */
  fg?: string;
  /** Background color */
  bg?: string;
  /** Text styles (bold, italic, underline, etc.) */
  styles: string[];
  /** Position in the output */
  position: { start: number; end: number };
}

/**
 * Performance metrics for TUI operations
 */
export interface PerformanceMetrics {
  /** Memory usage in MB */
  memoryUsage: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Render time in milliseconds */
  renderTime: number;
  /** Frame rate (for animated TUIs) */
  frameRate?: number;
}

/**
 * Input simulation options
 */
export interface InputSimulation {
  /** Key sequence to send */
  keys: string;
  /** Timing between keys */
  timing?: number;
  /** Whether to wait for output to stabilize */
  waitForStabilization?: boolean;
  /** Expected output pattern to wait for */
  waitForPattern?: string;
  /** Timeout for the operation */
  timeout?: number;
}

/**
 * Menu navigation context
 */
export interface MenuNavigation {
  /** Current menu level */
  level: number;
  /** Menu items detected */
  items: string[];
  /** Currently selected item */
  selectedIndex: number;
  /** Navigation history */
  history: string[];
}

/**
 * Default configuration for TUIAgent
 */
export const DEFAULT_CONFIG: Required<TUIAgentConfig> = {
  terminalType: 'xterm-256color',
  terminalSize: { cols: 80, rows: 24 },
  workingDirectory: process.cwd(),
  environment: {
    TERM: 'xterm-256color',
    COLUMNS: '80',
    LINES: '24'
  },
  defaultTimeout: 30000,
  inputTiming: {
    keystrokeDelay: 50,
    responseDelay: 100,
    stabilizationTimeout: 2000
  },
  outputCapture: {
    preserveColors: true,
    bufferSize: 1024 * 1024, // 1MB
    captureTiming: true
  },
  crossPlatform: {
    windowsPrefix: 'cmd /c',
    unixShell: '/bin/bash',
    keyMappings: {
      'win32': {
        'Enter': '\r\n',
        'Tab': '\t',
        'Escape': '\u001b',
        'ArrowUp': '\u001b[A',
        'ArrowDown': '\u001b[B',
        'ArrowLeft': '\u001b[D',
        'ArrowRight': '\u001b[C'
      },
      'darwin': {
        'Enter': '\n',
        'Tab': '\t',
        'Escape': '\u001b',
        'ArrowUp': '\u001b[A',
        'ArrowDown': '\u001b[B',
        'ArrowLeft': '\u001b[D',
        'ArrowRight': '\u001b[C'
      },
      'linux': {
        'Enter': '\n',
        'Tab': '\t',
        'Escape': '\u001b',
        'ArrowUp': '\u001b[A',
        'ArrowDown': '\u001b[B',
        'ArrowLeft': '\u001b[D',
        'ArrowRight': '\u001b[C'
      }
    }
  },
  performance: {
    enabled: true,
    sampleRate: 1000, // Every second
    memoryThreshold: 100, // 100MB
    cpuThreshold: 80 // 80%
  },
  logConfig: {
    logInputs: true,
    logOutputs: true,
    logColors: true,
    logLevel: LogLevel.DEBUG
  }
};
