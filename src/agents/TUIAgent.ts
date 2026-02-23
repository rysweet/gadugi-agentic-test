/**
 * TUIAgent - Thin facade composing TUI testing sub-modules
 *
 * Delegates all operations to:
 * - TUISessionManager    : session lifecycle (spawn, kill, cleanup)
 * - TUIInputSimulator    : keyboard input simulation
 * - TUIMenuNavigator     : interactive menu navigation
 * - TUIOutputParser      : ANSI parsing, color extraction, validation
 * - TUIStepDispatcher    : test step action routing
 *
 * Public API is identical to the original monolithic TUIAgent — all
 * existing imports and tests continue to work without modification.
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 * Uses shared validateDirectory() (issue #118) instead of a private copy.
 * Uses shared sanitizeConfigWithEnv() (issue #118) instead of a private copy.
 */

import pidusage from 'pidusage';
import { SpawnOptions } from 'child_process';
import { AgentType } from './index';
import { OrchestratorScenario, TestStep, TestStatus, StepResult } from '../models/TestModels';
import { TestLogger, createLogger } from '../utils/logger';
import { validateDirectory } from '../utils/fileUtils';
import { sanitizeConfigWithEnv } from '../utils/agentUtils';
import {
  TUISessionManager, TUIInputSimulator, TUIMenuNavigator,
  dispatchStep, getLatestOutput, performOutputValidation, arraysEqual,
} from './tui';
import {
  TUIAgentConfig, TerminalOutput, ColorInfo, InputSimulation,
  MenuNavigation, PerformanceMetrics, DEFAULT_CONFIG,
} from './tui/types';
import { BaseAgent, ExecutionContext } from './BaseAgent';

// Re-export all public types so existing imports from './TUIAgent' still work
export type {
  TUIAgentConfig, TerminalSession, TerminalOutput, ColorInfo,
  PerformanceMetrics, InputSimulation, MenuNavigation,
} from './tui/types';

/** Comprehensive TUI testing agent (thin facade) */
export class TUIAgent extends BaseAgent {
  public readonly name = 'TUIAgent';
  public readonly type = AgentType.TUI;

  private config: Required<TUIAgentConfig>;
  private logger: TestLogger;
  private currentScenarioId?: string;
  private performanceMonitor?: NodeJS.Timeout;
  private performanceMetricsHistory: PerformanceMetrics[] = [];
  private sessionManager: TUISessionManager;
  private inputSimulator: TUIInputSimulator;
  private menuNavigator: TUIMenuNavigator;
  private errorHandler: (error: Error) => void;

  constructor(config: TUIAgentConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = createLogger({ level: this.config.logConfig.logLevel, logDir: './logs/tui-agent' });
    this.sessionManager = new TUISessionManager(this.config, this.logger, this);
    this.inputSimulator = new TUIInputSimulator(this.config, this.logger);
    this.menuNavigator = new TUIMenuNavigator(this.logger);
    // Store the handler reference so it can be removed in cleanup()
    this.errorHandler = (error: Error) => this.logger.error('TUIAgent error', { error: error.message });
    this.on('error', this.errorHandler);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing TUIAgent', { config: this.sanitizeConfig() });
    try {
      await validateDirectory(this.config.workingDirectory);
      this.setupPlatformConfig();
      if (this.config.performance.enabled) this.startPerformanceMonitoring();
      this.isInitialized = true;
      this.logger.info('TUIAgent initialized successfully');
      this.emit('initialized');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to initialize TUIAgent', { error: message });
      throw new Error(`Failed to initialize TUIAgent: ${message}`);
    }
  }

  // -- BaseAgent template-method hooks --

  protected applyEnvironment(scenario: OrchestratorScenario): void {
    this.currentScenarioId = scenario.id;
    this.logger.setContext({ scenarioId: scenario.id, component: 'TUIAgent' });
    this.logger.scenarioStart(scenario.id, scenario.name);
    if (scenario.environment) {
      for (const [name, value] of Object.entries(scenario.environment)) {
        // Update local config only — do NOT mutate process.env as it contaminates
        // all subsequent tests and other agents running in the same process.
        this.config.environment[name] = value;
      }
    }
  }

  protected buildResult(ctx: ExecutionContext): unknown {
    return {
      ...ctx,
      logs: this.getScenarioLogs(),
      sessions: this.sessionManager.getSessionInfo(),
      performanceMetrics: this.getPerformanceMetrics(),
    };
  }

  protected async onAfterExecute(scenario: OrchestratorScenario, status: TestStatus): Promise<void> {
    await this.sessionManager.cleanupSessions();
    this.logger.scenarioEnd(scenario.id, status, 0 /* duration tracked inside BaseAgent */);
    this.currentScenarioId = undefined;
  }

  // -- Public TUI-specific API --

  async spawnTUI(command: string, args: string[] = [], options: Partial<SpawnOptions> = {}): Promise<string> {
    return this.sessionManager.createSession(command, args, options);
  }

  async sendInput(sessionId: string, input: string | InputSimulation): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || session.status !== 'running') {
      throw new Error(`Session not found or not running: ${sessionId}`);
    }
    await this.inputSimulator.sendInput(
      session.process.stdin!, sessionId, input,
      () => getLatestOutput(session.outputBuffer),
      () => session.outputBuffer.length,
      (sid, inputData) => this.emit('inputSent', { sessionId: sid, input: inputData })
    );
  }

  async navigateMenu(sessionId: string, path: string[]): Promise<MenuNavigation> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || session.status !== 'running') {
      throw new Error(`Session not found or not running: ${sessionId}`);
    }
    return this.menuNavigator.navigateMenu(sessionId, path, {
      sendInput: (sid, input) => this.sendInput(sid, input),
      waitForStabilization: (sid) => this.waitForOutputStabilization(sid),
      getLatestOutput: (sid) => {
        const s = this.sessionManager.getSession(sid);
        return s ? getLatestOutput(s.outputBuffer) : null;
      },
      getKeyMapping: (key) => this.inputSimulator.getKeyMapping(key),
      emit: (event, ...args) => this.emit(event, ...args)
    });
  }

  captureOutput(sessionId: string): TerminalOutput | null {
    const session = this.sessionManager.getSession(sessionId);
    return session ? getLatestOutput(session.outputBuffer) : null;
  }

  getAllOutput(sessionId: string): TerminalOutput[] {
    const session = this.sessionManager.getSession(sessionId);
    return session ? [...session.outputBuffer] : [];
  }

  async validateOutput(sessionId: string, expected: any): Promise<boolean> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return false;
    const output = getLatestOutput(session.outputBuffer);
    return output ? performOutputValidation(output, expected, session.outputBuffer) : false;
  }

  async validateFormatting(sessionId: string, expectedColors: ColorInfo[]): Promise<boolean> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return false;
    const output = getLatestOutput(session.outputBuffer);
    if (!output || !output.colors) return false;
    try {
      for (const expectedColor of expectedColors) {
        const found = output.colors.find(color =>
          color.text === expectedColor.text && color.fg === expectedColor.fg &&
          color.bg === expectedColor.bg && arraysEqual(color.styles, expectedColor.styles)
        );
        if (!found) {
          this.logger.debug('Expected color not found', { expectedColor, availableColors: output.colors });
          return false;
        }
      }
      return true;
    } catch (error: unknown) {
      this.logger.error('Color validation failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async killSession(sessionId: string): Promise<void> {
    return this.sessionManager.destroySession(sessionId);
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up TUIAgent resources');
    try {
      if (this.performanceMonitor) { clearInterval(this.performanceMonitor); this.performanceMonitor = undefined; }
      await this.sessionManager.cleanupSessions();
      this.menuNavigator.resetContext();
      // Remove the error handler registered in the constructor to prevent
      // dangling listener references after cleanup.
      this.removeListener('error', this.errorHandler);
      this.logger.info('TUIAgent cleanup completed');
      this.emit('cleanup');
    } catch (error: unknown) {
      this.logger.error('Error during cleanup', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async executeStep(step: TestStep, stepIndex: number): Promise<StepResult> {
    return dispatchStep(step, stepIndex, {
      spawnTUI: (cmd, args) => this.spawnTUI(cmd, args),
      sendInput: (sid, input) => this.sendInput(sid, input),
      navigateMenu: (sid, path) => this.navigateMenu(sid, path),
      validateOutput: (sid, expected) => this.validateOutput(sid, expected),
      validateFormatting: (sid, colors) => this.validateFormatting(sid, colors),
      captureOutput: (sid) => this.captureOutput(sid),
      waitForOutputPattern: (sid, pat, timeout) => this.waitForOutputPattern(sid, pat, timeout),
      resizeTerminal: (sid, cols, rows) => {
        const session = this.sessionManager.getSession(sid);
        if (session) { session.size = { cols, rows }; this.logger.debug('Terminal resized', { sessionId: sid, cols, rows }); }
      },
      killSession: (sid) => this.killSession(sid),
      getMostRecentSessionId: () => this.sessionManager.getMostRecentSessionId(),
      defaultTimeout: this.config.defaultTimeout,
    }, this.logger);
  }

  // -- Private helpers --

  private setupPlatformConfig(): void {
    const platform = process.platform;
    this.config.environment.TERM = platform === 'win32' ? 'cmd' : this.config.terminalType;
    this.logger.debug(`Platform configuration set for ${platform}`);
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitor = setInterval(() => {
      this.collectPerformanceMetrics().catch((err) => {
        this.logger.warn('Failed to collect performance metrics', { error: err?.message });
      });
    }, this.config.performance.sampleRate);
  }

  private async collectPerformanceMetrics(): Promise<void> {
    const stats = await pidusage(process.pid);
    const metric: PerformanceMetrics = {
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: stats.cpu,
      responseTime: 0,
      renderTime: 0,
    };

    this.performanceMetricsHistory.push(metric);
    if (this.performanceMetricsHistory.length > 100) {
      this.performanceMetricsHistory.shift();
    }

    this.emit('performanceMetrics', {
      ...metric,
      timestamp: new Date(),
      activeSessions: this.sessionManager.getAllSessions().size,
    });
  }

  private getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetricsHistory];
  }

  private getScenarioLogs(): string[] {
    const logs: string[] = [];
    for (const session of this.sessionManager.getAllSessions().values()) {
      for (const output of session.outputBuffer) {
        logs.push(`[${session.id}:${output.type.toUpperCase()}] ${output.text.trim()}`);
      }
    }
    return logs.filter(log => log.length > 0);
  }

  private sanitizeConfig(): Record<string, any> {
    return sanitizeConfigWithEnv(this.config, 'environment');
  }

  private async waitForOutputStabilization(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    await this.inputSimulator.waitForStabilization(() => session.outputBuffer.length);
  }

  private async waitForOutputPattern(sessionId: string, pattern: string, timeout: number): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    await this.inputSimulator.waitForPattern(() => getLatestOutput(session.outputBuffer), pattern, timeout);
  }
}

/** Factory function to create a TUIAgent */
export function createTUIAgent(config?: TUIAgentConfig): TUIAgent {
  return new TUIAgent(config);
}
