/**
 * Types and configuration interfaces for ElectronUIAgent sub-modules
 */

/**
 * Configuration options for the ElectronUIAgent
 */
export interface ElectronUIAgentConfig {
  /** Path to the Electron application executable */
  executablePath: string;
  /** Command line arguments for the Electron app */
  args?: string[];
  /** Working directory for the app */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Launch timeout in milliseconds */
  launchTimeout?: number;
  /** Default timeout for operations */
  defaultTimeout?: number;
  /** Whether to run in headless mode */
  headless?: boolean;
  /** Recording options */
  recordVideo?: boolean;
  /** Video directory */
  videoDir?: string;
  /** Slow motion delay in milliseconds */
  slowMo?: number;
  /** Screenshot configuration */
  screenshotConfig?: {
    mode: 'off' | 'on' | 'only-on-failure';
    directory: string;
    fullPage: boolean;
  };
  /** Socket.IO monitoring configuration */
  websocketConfig?: {
    url: string;
    events: string[];
    reconnectAttempts: number;
    reconnectDelay: number;
  };
  /** Performance monitoring */
  performanceConfig?: {
    enabled: boolean;
    sampleInterval: number;
    collectLogs: boolean;
  };
  /** Recovery options */
  recoveryConfig?: {
    maxRetries: number;
    retryDelay: number;
    restartOnFailure: boolean;
  };
  /**
   * When true, the browser and WebSocket connection are closed after each
   * scenario execution in onAfterExecute(). Useful when the agent is used
   * outside of ScenarioRouter or in single-scenario mode.
   *
   * Default: false — preserves existing behavior where the router or caller
   * is responsible for closing resources via close() / cleanup().
   */
  closeAfterEachScenario?: boolean;
}

/**
 * WebSocket event data
 */
export interface WebSocketEvent {
  type: string;
  timestamp: Date;
  data: any;
  source?: string;
}

/**
 * Performance sample data
 */
export interface PerformanceSample {
  timestamp: Date;
  cpuUsage?: number;
  memoryUsage?: number;
  responseTime?: number;
  frameRate?: number;
  customMetrics?: Record<string, number>;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Partial<ElectronUIAgentConfig> = {
  launchTimeout: 30000,
  defaultTimeout: 10000,
  headless: false,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  screenshotConfig: {
    mode: 'only-on-failure',
    directory: './screenshots/electron',
    fullPage: true
  },
  performanceConfig: {
    enabled: true,
    sampleInterval: 1000,
    collectLogs: true
  },
  recoveryConfig: {
    maxRetries: 3,
    retryDelay: 1000,
    restartOnFailure: false
  }
};

/**
 * Structured error for agent failures
 */
export class TestError extends Error {
  public readonly type: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(options: {
    type: string;
    message: string;
    stackTrace?: string;
    timestamp: Date;
    context?: Record<string, any>;
  }) {
    super(options.message);
    this.type = options.type;
    this.timestamp = options.timestamp;
    this.context = options.context;
    this.name = 'TestError';

    if (options.stackTrace) {
      this.stack = options.stackTrace;
    }
  }
}
