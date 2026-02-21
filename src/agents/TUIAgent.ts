/**
 * TUIAgent - Terminal User Interface testing agent
 *
 * This agent provides comprehensive TUI testing capabilities including:
 * - Terminal spawn and cleanup
 * - Input simulation with timing control
 * - Output parsing and color/formatting verification
 * - Cross-platform terminal behavior testing
 * - Interactive menu navigation
 * - Error handling and recovery
 * - Performance benchmarks
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IAgent, AgentType } from './index';
import {
  TestStep,
  TestStatus,
  StepResult,
  CommandResult
} from '../models/TestModels';
import { TestLogger, createLogger, LogLevel } from '../utils/logger';

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
  process: ChildProcess;
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
 * Default configuration
 */
const DEFAULT_CONFIG: Required<TUIAgentConfig> = {
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

/**
 * Comprehensive TUI testing agent
 */
export class TUIAgent extends EventEmitter implements IAgent {
  public readonly name = 'TUIAgent';
  public readonly type = AgentType.SYSTEM;

  private config: Required<TUIAgentConfig>;
  private logger: TestLogger;
  private isInitialized = false;
  private currentScenarioId?: string;
  private sessions: Map<string, TerminalSession> = new Map();
  private performanceMonitor?: NodeJS.Timeout;
  private menuContext?: MenuNavigation;

  constructor(config: TUIAgentConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = createLogger({
      level: this.config.logConfig.logLevel,
      logDir: './logs/tui-agent'
    });

    this.setupEventListeners();
  }

  /**
   * Initialize the TUI agent
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing TUIAgent', { config: this.sanitizeConfig() });

    try {
      // Validate working directory
      await this.validateWorkingDirectory();

      // Setup platform-specific configurations
      this.setupPlatformConfig();

      // Start performance monitoring if enabled
      if (this.config.performance.enabled) {
        this.startPerformanceMonitoring();
      }

      this.isInitialized = true;
      this.logger.info('TUIAgent initialized successfully');
      this.emit('initialized');

    } catch (error: any) {
      this.logger.error('Failed to initialize TUIAgent', { error: error?.message });
      throw new Error(`Failed to initialize TUIAgent: ${error?.message}`);
    }
  }

  /**
   * Execute a test scenario
   */
  async execute(scenario: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    this.currentScenarioId = scenario.id;
    this.logger.setContext({ scenarioId: scenario.id, component: 'TUIAgent' });
    this.logger.scenarioStart(scenario.id, scenario.name);

    const startTime = Date.now();
    let status = TestStatus.PASSED;
    let error: string | undefined;

    try {
      // Set environment variables if specified in scenario
      if (scenario.environment) {
        this.setEnvironmentVariables(scenario.environment);
      }

      // Execute scenario steps
      const stepResults: StepResult[] = [];

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        const stepResult = await this.executeStep(step, i);
        stepResults.push(stepResult);

        if (stepResult.status === TestStatus.FAILED || stepResult.status === TestStatus.ERROR) {
          status = stepResult.status;
          error = stepResult.error;
          break;
        }
      }

      return {
        scenarioId: scenario.id,
        status,
        duration: Date.now() - startTime,
        startTime: new Date(startTime),
        endTime: new Date(),
        error,
        stepResults,
        logs: this.getScenarioLogs(),
        sessions: this.getSessionInfo(),
        performanceMetrics: this.getPerformanceMetrics()
      };

    } catch (executeError: any) {
      this.logger.error('Scenario execution failed', { error: executeError?.message });
      status = TestStatus.ERROR;
      error = executeError?.message;
      throw executeError;

    } finally {
      // Clean up all sessions
      await this.killAllSessions();
      this.logger.scenarioEnd(scenario.id, status, Date.now() - startTime);
      this.currentScenarioId = undefined;
    }
  }

  /**
   * Spawn a TUI application
   */
  async spawnTUI(command: string, args: string[] = [], options: Partial<SpawnOptions> = {}): Promise<string> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    const spawnOptions: SpawnOptions = {
      cwd: this.config.workingDirectory,
      env: {
        ...process.env,  // Inherit parent PATH and other environment
        ...this.config.environment,  // Override with TUI-specific vars
        ...options.env  // Override with call-specific vars
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      ...options
    };

    this.logger.info(`Spawning TUI application: ${command}`, { args, sessionId });

    try {
      const process = spawn(command, args, spawnOptions);

      if (!process.pid) {
        throw new Error('Failed to spawn process');
      }

      const session: TerminalSession = {
        id: sessionId,
        pid: process.pid,
        command,
        args,
        startTime: new Date(startTime),
        status: 'running',
        process,
        size: this.config.terminalSize,
        outputBuffer: []
      };

      this.sessions.set(sessionId, session);
      this.setupSessionHandlers(session);

      // Set terminal size
      if (process.stdout && (process.stdout as any).setRawMode) {
        (process.stdout as any).setRawMode(true);
      }

      this.logger.info(`TUI application spawned successfully`, { sessionId, pid: process.pid });
      this.emit('sessionStarted', session);

      return sessionId;

    } catch (error: any) {
      this.logger.error(`Failed to spawn TUI application: ${command}`, { error: error?.message });
      throw new Error(`Failed to spawn TUI application: ${error?.message}`);
    }
  }

  /**
   * Send input to a TUI session
   */
  async sendInput(sessionId: string, input: string | InputSimulation): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      throw new Error(`Session not found or not running: ${sessionId}`);
    }

    let inputData: string;
    let timing: number;
    let waitForStabilization: boolean;
    let waitForPattern: string | undefined;
    let timeout: number;

    if (typeof input === 'string') {
      inputData = input;
      timing = this.config.inputTiming.keystrokeDelay;
      waitForStabilization = false;
      timeout = this.config.defaultTimeout;
    } else {
      inputData = input.keys;
      timing = input.timing || this.config.inputTiming.keystrokeDelay;
      waitForStabilization = input.waitForStabilization || false;
      waitForPattern = input.waitForPattern;
      timeout = input.timeout || this.config.defaultTimeout;
    }

    // Convert special keys
    const processedInput = this.processSpecialKeys(inputData);

    this.logger.debug(`Sending input to session ${sessionId}`, {
      input: this.config.logConfig.logInputs ? processedInput : '[HIDDEN]',
      timing
    });

    try {
      // Send input character by character with timing
      for (const char of processedInput) {
        if (session.process.stdin) {
          session.process.stdin.write(char);
          if (timing > 0) {
            await this.delay(timing);
          }
        }
      }

      // Wait for response delay
      await this.delay(this.config.inputTiming.responseDelay);

      // Wait for output stabilization if requested
      if (waitForStabilization) {
        await this.waitForOutputStabilization(sessionId);
      }

      // Wait for specific pattern if requested
      if (waitForPattern) {
        await this.waitForOutputPattern(sessionId, waitForPattern, timeout);
      }

      this.emit('inputSent', { sessionId, input: inputData });

    } catch (error: any) {
      this.logger.error(`Failed to send input to session ${sessionId}`, { error: error?.message });
      throw error;
    }
  }

  /**
   * Navigate through a menu interface
   */
  async navigateMenu(sessionId: string, path: string[]): Promise<MenuNavigation> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      throw new Error(`Session not found or not running: ${sessionId}`);
    }

    this.logger.info(`Navigating menu path: ${path.join(' > ')}`, { sessionId });

    try {
      // Initialize menu context if not exists
      if (!this.menuContext) {
        this.menuContext = {
          level: 0,
          items: [],
          selectedIndex: 0,
          history: []
        };
      }

      for (const menuItem of path) {
        // Wait for menu to load
        await this.waitForOutputStabilization(sessionId);

        // Parse current menu items
        const currentOutput = this.getLatestOutput(sessionId);
        const menuItems = this.parseMenuItems(currentOutput?.text || '');

        this.menuContext.items = menuItems;

        // Find the target menu item
        const targetIndex = menuItems.findIndex(item =>
          item.toLowerCase().includes(menuItem.toLowerCase())
        );

        if (targetIndex === -1) {
          throw new Error(`Menu item not found: ${menuItem}. Available: ${menuItems.join(', ')}`);
        }

        // Navigate to the item
        await this.navigateToMenuItem(sessionId, targetIndex);

        // Select the item
        await this.sendInput(sessionId, this.getKeyMapping('Enter'));

        this.menuContext.level++;
        this.menuContext.history.push(menuItem);
        this.menuContext.selectedIndex = targetIndex;

        this.logger.debug(`Navigated to menu item: ${menuItem}`, {
          level: this.menuContext.level,
          index: targetIndex
        });
      }

      this.emit('menuNavigated', { sessionId, path, context: this.menuContext });
      return { ...this.menuContext };

    } catch (error: any) {
      this.logger.error(`Menu navigation failed`, { sessionId, path, error: error?.message });
      throw error;
    }
  }

  /**
   * Capture and parse current terminal output
   */
  captureOutput(sessionId: string): TerminalOutput | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const latest = session.outputBuffer[session.outputBuffer.length - 1];
    return latest || null;
  }

  /**
   * Get all output from a session
   */
  getAllOutput(sessionId: string): TerminalOutput[] {
    const session = this.sessions.get(sessionId);
    return session ? [...session.outputBuffer] : [];
  }

  /**
   * Validate output against expected patterns
   */
  async validateOutput(sessionId: string, expected: any): Promise<boolean> {
    const output = this.getLatestOutput(sessionId);
    if (!output) {
      return false;
    }

    return this.performOutputValidation(output, expected);
  }

  /**
   * Validate colors and formatting
   */
  async validateFormatting(sessionId: string, expectedColors: ColorInfo[]): Promise<boolean> {
    const output = this.getLatestOutput(sessionId);
    if (!output || !output.colors) {
      return false;
    }

    try {
      for (const expectedColor of expectedColors) {
        const found = output.colors.find(color =>
          color.text === expectedColor.text &&
          color.fg === expectedColor.fg &&
          color.bg === expectedColor.bg &&
          this.arraysEqual(color.styles, expectedColor.styles)
        );

        if (!found) {
          this.logger.debug(`Expected color not found`, { expectedColor, availableColors: output.colors });
          return false;
        }
      }

      return true;

    } catch (error: any) {
      this.logger.error(`Color validation failed`, { error: error?.message });
      return false;
    }
  }

  /**
   * Kill a specific session
   */
  async killSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    try {
      this.logger.info(`Killing session: ${sessionId} (PID: ${session.pid})`);

      if (session.process && !session.process.killed) {
        session.process.kill('SIGTERM');

        // Wait for graceful shutdown
        await this.delay(1000);

        // Force kill if still running
        if (!session.process.killed) {
          session.process.kill('SIGKILL');
        }
      }

      session.status = 'killed';
      this.sessions.delete(sessionId);
      this.emit('sessionKilled', { sessionId });

    } catch (error: any) {
      this.logger.error(`Failed to kill session ${sessionId}`, { error: error?.message });
      throw error;
    }
  }

  /**
   * Clean up all sessions and resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up TUIAgent resources');

    try {
      // Stop performance monitoring
      if (this.performanceMonitor) {
        clearInterval(this.performanceMonitor);
        this.performanceMonitor = undefined;
      }

      // Kill all sessions
      await this.killAllSessions();

      // Clear menu context
      this.menuContext = undefined;

      this.logger.info('TUIAgent cleanup completed');
      this.emit('cleanup');

    } catch (error: any) {
      this.logger.error('Error during cleanup', { error: error?.message });
    }
  }

  /**
   * Execute a test step
   */
  async executeStep(step: TestStep, stepIndex: number): Promise<StepResult> {
    const startTime = Date.now();
    this.logger.stepExecution(stepIndex, step.action, step.target);

    try {
      let result: any;

      switch (step.action.toLowerCase()) {
        case 'spawn':
        case 'spawn_tui':
          result = await this.handleSpawnAction(step);
          break;

        case 'send_input':
        case 'input':
          await this.handleInputAction(step);
          result = 'Input sent successfully';
          break;

        case 'navigate_menu':
          result = await this.handleMenuNavigationAction(step);
          break;

        case 'validate_output':
          result = await this.handleOutputValidationAction(step);
          break;

        case 'validate_colors':
        case 'validate_formatting':
          result = await this.handleColorValidationAction(step);
          break;

        case 'capture_output':
          result = this.handleCaptureOutputAction(step);
          break;

        case 'wait_for_output':
          result = await this.handleWaitForOutputAction(step);
          break;

        case 'resize_terminal':
          await this.handleResizeTerminalAction(step);
          result = 'Terminal resized successfully';
          break;

        case 'kill_session':
          await this.handleKillSessionAction(step);
          result = 'Session killed successfully';
          break;

        case 'wait':
          const waitTime = parseInt(step.value || '1000');
          await this.delay(waitTime);
          result = `Waited ${waitTime}ms`;
          break;

        default:
          throw new Error(`Unsupported TUI action: ${step.action}`);
      }

      const duration = Date.now() - startTime;
      this.logger.stepComplete(stepIndex, TestStatus.PASSED, duration);

      return {
        stepIndex,
        status: TestStatus.PASSED,
        duration,
        actualResult: typeof result === 'string' ? result : JSON.stringify(result)
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.stepComplete(stepIndex, TestStatus.FAILED, duration);

      return {
        stepIndex,
        status: TestStatus.FAILED,
        duration,
        error: error?.message
      };
    }
  }

  // Private helper methods

  private setupSessionHandlers(session: TerminalSession): void {
    const { process } = session;

    // Handle stdout
    process.stdout?.on('data', (data: Buffer) => {
      const raw = data.toString();
      const output: TerminalOutput = {
        type: 'stdout',
        raw,
        text: this.stripAnsiCodes(raw),
        colors: this.parseColors(raw),
        timestamp: new Date()
      };

      session.outputBuffer.push(output);

      if (this.config.logConfig.logOutputs) {
        this.logger.debug(`[STDOUT ${session.id}] ${output.text.trim()}`);
      }

      this.emit('output', { sessionId: session.id, output });
    });

    // Handle stderr
    process.stderr?.on('data', (data: Buffer) => {
      const raw = data.toString();
      const output: TerminalOutput = {
        type: 'stderr',
        raw,
        text: this.stripAnsiCodes(raw),
        colors: this.parseColors(raw),
        timestamp: new Date()
      };

      session.outputBuffer.push(output);

      if (this.config.logConfig.logOutputs) {
        this.logger.debug(`[STDERR ${session.id}] ${output.text.trim()}`);
      }

      this.emit('output', { sessionId: session.id, output });
    });

    // Handle process exit
    process.on('close', (code: number | null) => {
      session.status = code === 0 ? 'completed' : 'failed';
      this.logger.info(`Session ${session.id} closed with code ${code}`);
      this.emit('sessionClosed', { sessionId: session.id, exitCode: code });
    });

    // Handle process errors
    process.on('error', (error: Error) => {
      session.status = 'failed';
      this.logger.error(`Session ${session.id} error`, { error: error.message });
      this.emit('sessionError', { sessionId: session.id, error });
    });
  }

  private async validateWorkingDirectory(): Promise<void> {
    try {
      await fs.access(this.config.workingDirectory);
      const stats = await fs.stat(this.config.workingDirectory);

      if (!stats.isDirectory()) {
        throw new Error(`Working directory is not a directory: ${this.config.workingDirectory}`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Working directory does not exist: ${this.config.workingDirectory}`);
      }
      throw error;
    }
  }

  private setupPlatformConfig(): void {
    const platform = process.platform;

    // Update environment for platform-specific terminal behavior
    if (platform === 'win32') {
      this.config.environment.TERM = 'cmd';
    } else {
      this.config.environment.TERM = this.config.terminalType;
    }

    this.logger.debug(`Platform configuration set for ${platform}`);
  }

  private setupEventListeners(): void {
    this.on('error', (error) => {
      this.logger.error('TUIAgent error', { error: error.message });
    });
  }

  private generateSessionId(): string {
    return `tui_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private processSpecialKeys(input: string): string {
    const platform = process.platform;
    const keyMappings = this.config.crossPlatform.keyMappings?.[platform] ||
                       this.config.crossPlatform.keyMappings?.['linux'] ||
                       {};

    let processed = input;

    for (const [key, code] of Object.entries(keyMappings)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processed = processed.replace(regex, code);
    }

    return processed;
  }

  private getKeyMapping(key: string): string {
    const platform = process.platform;
    const keyMappings = this.config.crossPlatform.keyMappings?.[platform] ||
                       this.config.crossPlatform.keyMappings?.['linux'] ||
                       {};

    return keyMappings[key] || key;
  }

  private stripAnsiCodes(text: string): string {
    // Remove ANSI escape codes
    return text.replace(/\u001b\[[0-9;]*m/g, '');
  }

  private parseColors(text: string): ColorInfo[] {
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

        // Parse ANSI codes
        for (const code of codes) {
          if (code >= 30 && code <= 37) {
            colorInfo.fg = this.ansiColorMap[code];
          } else if (code >= 40 && code <= 47) {
            colorInfo.bg = this.ansiColorMap[code - 10];
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

  private readonly ansiColorMap: Record<number, string> = {
    30: 'black',
    31: 'red',
    32: 'green',
    33: 'yellow',
    34: 'blue',
    35: 'magenta',
    36: 'cyan',
    37: 'white'
  };

  private parseMenuItems(text: string): string[] {
    // Simple menu item detection - look for numbered or bulleted lists
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const menuItems: string[] = [];

    for (const line of lines) {
      // Match patterns like "1. Item", "* Item", "- Item", "[1] Item"
      const match = line.match(/^(?:\d+\.|\*|-|\[\d+\])\s*(.+)$/);
      if (match) {
        menuItems.push(match[1].trim());
      }
    }

    return menuItems;
  }

  private async navigateToMenuItem(sessionId: string, targetIndex: number): Promise<void> {
    if (!this.menuContext) {
      throw new Error('Menu context not initialized');
    }

    const currentIndex = this.menuContext.selectedIndex;
    const steps = targetIndex - currentIndex;

    if (steps === 0) {
      return; // Already at target
    }

    const key = steps > 0 ? 'ArrowDown' : 'ArrowUp';
    const count = Math.abs(steps);

    for (let i = 0; i < count; i++) {
      await this.sendInput(sessionId, this.getKeyMapping(key));
      await this.delay(this.config.inputTiming.keystrokeDelay);
    }

    this.menuContext.selectedIndex = targetIndex;
  }

  private async waitForOutputStabilization(sessionId: string): Promise<void> {
    const timeout = this.config.inputTiming.stabilizationTimeout;
    const checkInterval = 100;
    let lastOutputLength = 0;
    let stableCount = 0;
    const requiredStableChecks = 5;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const session = this.sessions.get(sessionId);
        if (!session) {
          reject(new Error(`Session not found: ${sessionId}`));
          return;
        }

        const currentOutputLength = session.outputBuffer.length;

        if (currentOutputLength === lastOutputLength) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            resolve();
            return;
          }
        } else {
          stableCount = 0;
          lastOutputLength = currentOutputLength;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Output stabilization timeout after ${timeout}ms`));
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  private async waitForOutputPattern(sessionId: string, pattern: string, timeout: number): Promise<void> {
    const regex = new RegExp(pattern, 'i');
    const checkInterval = 100;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const output = this.getLatestOutput(sessionId);

        if (output && regex.test(output.text)) {
          resolve();
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for pattern: ${pattern}`));
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  private getLatestOutput(sessionId: string): TerminalOutput | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.outputBuffer.length === 0) {
      return null;
    }

    return session.outputBuffer[session.outputBuffer.length - 1];
  }

  private performOutputValidation(output: TerminalOutput, expected: any): boolean {
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
        default:
          throw new Error(`Unsupported validation type: ${expected.type}`);
      }
    }

    return false;
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  private async killAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());

    if (sessionIds.length === 0) {
      return;
    }

    this.logger.info(`Killing ${sessionIds.length} sessions`);

    const killPromises = sessionIds.map(sessionId =>
      this.killSession(sessionId).catch(error =>
        this.logger.warn(`Failed to kill session ${sessionId}`, { error: error?.message })
      )
    );

    await Promise.all(killPromises);
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitor = setInterval(() => {
      this.collectPerformanceMetrics();
    }, this.config.performance.sampleRate);
  }

  private collectPerformanceMetrics(): void {
    // Implementation would collect actual performance metrics
    // This is a placeholder for the real implementation
    this.emit('performanceMetrics', {
      timestamp: new Date(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: 0, // Would need actual CPU monitoring
      activeSessions: this.sessions.size
    });
  }

  private getPerformanceMetrics(): PerformanceMetrics[] {
    // Return collected performance metrics
    return []; // Placeholder
  }

  private getSessionInfo(): Record<string, any> {
    const info: Record<string, any> = {};

    for (const [sessionId, session] of this.sessions.entries()) {
      info[sessionId] = {
        pid: session.pid,
        command: session.command,
        args: session.args,
        status: session.status,
        startTime: session.startTime,
        outputBufferSize: session.outputBuffer.length
      };
    }

    return info;
  }

  private getScenarioLogs(): string[] {
    const logs: string[] = [];

    for (const session of this.sessions.values()) {
      for (const output of session.outputBuffer) {
        logs.push(`[${session.id}:${output.type.toUpperCase()}] ${output.text.trim()}`);
      }
    }

    return logs.filter(log => log.length > 0);
  }

  private setEnvironmentVariables(variables: Record<string, string>): void {
    for (const [name, value] of Object.entries(variables)) {
      // Update local config only — do NOT mutate process.env as it contaminates
      // all subsequent tests and other agents running in the same process.
      this.config.environment[name] = value;
      this.logger.debug(`Set environment variable: ${name}=${value}`);
    }
  }

  private sanitizeConfig(): Record<string, any> {
    const { environment, ...safeConfig } = this.config;
    return {
      ...safeConfig,
      environment: environment ? Object.keys(environment) : undefined
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Step action handlers

  private async handleSpawnAction(step: TestStep): Promise<string> {
    const parts = step.target.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    return this.spawnTUI(command, args);
  }

  private async handleInputAction(step: TestStep): Promise<void> {
    const sessionId = step.target || this.getMostRecentSessionId();
    const input = step.value || '';

    const inputSim: InputSimulation = {
      keys: input,
      waitForStabilization: true
    };

    if (step.timeout) {
      inputSim.timeout = step.timeout;
    }

    await this.sendInput(sessionId, inputSim);
  }

  private async handleMenuNavigationAction(step: TestStep): Promise<MenuNavigation> {
    const sessionId = step.target || this.getMostRecentSessionId();
    const path = step.value ? step.value.split(',').map((s: string) => s.trim()) : [];

    return this.navigateMenu(sessionId, path);
  }

  private async handleOutputValidationAction(step: TestStep): Promise<boolean> {
    const sessionId = step.target || this.getMostRecentSessionId();
    const expected = step.expected || step.value;

    return this.validateOutput(sessionId, expected);
  }

  private async handleColorValidationAction(step: TestStep): Promise<boolean> {
    const sessionId = step.target || this.getMostRecentSessionId();
    let expectedColors: ColorInfo[];

    try {
      expectedColors = JSON.parse(step.value || '[]');
    } catch {
      throw new Error('Invalid color validation format. Expected JSON array of ColorInfo objects.');
    }

    return this.validateFormatting(sessionId, expectedColors);
  }

  private handleCaptureOutputAction(step: TestStep): TerminalOutput | null {
    const sessionId = step.target || this.getMostRecentSessionId();
    return this.captureOutput(sessionId);
  }

  private async handleWaitForOutputAction(step: TestStep): Promise<void> {
    const sessionId = step.target || this.getMostRecentSessionId();
    const pattern = step.value || '';
    const timeout = step.timeout || this.config.defaultTimeout;

    await this.waitForOutputPattern(sessionId, pattern, timeout);
  }

  private async handleResizeTerminalAction(step: TestStep): Promise<void> {
    const sessionId = step.target || this.getMostRecentSessionId();
    const [cols, rows] = (step.value || '80,24').split(',').map(Number);

    const session = this.sessions.get(sessionId);
    if (session) {
      session.size = { cols, rows };
      // In a real implementation, you would resize the actual terminal
      this.logger.debug(`Terminal resized`, { sessionId, cols, rows });
    }
  }

  private async handleKillSessionAction(step: TestStep): Promise<void> {
    const sessionId = step.target || this.getMostRecentSessionId();
    await this.killSession(sessionId);
  }

  /**
   * Get the most recently created session ID when no explicit session specified
   */
  private getMostRecentSessionId(): string {
    if (this.sessions.size === 0) {
      throw new Error('No active TUI sessions');
    }
    const sessions = Array.from(this.sessions.values());
    const sorted = sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return sorted[0].id;
  }
}

export function createTUIAgent(config?: TUIAgentConfig): TUIAgent {
  return new TUIAgent(config);
}
