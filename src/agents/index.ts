/**
 * Agents module - Autonomous testing agents
 */

// Base agent interface
export interface IAgent<TScenario = unknown, TResult = unknown> {
  name: string;
  type: string;
  initialize(): Promise<void>;
  execute(scenario: TScenario): Promise<TResult>;
  cleanup(): Promise<void>;
}

/**
 * Interface for pipeline agents that generate or transform data rather than
 * executing test scenarios.
 *
 * Pipeline agents (ComprehensionAgent, PriorityAgent, IssueReporter) have
 * specialized methods for their particular role (e.g. analyzeFeature(),
 * analyzePriority(), createIssue()) and should NOT be invoked through the
 * generic IAgent.execute() path.
 *
 * These agents also implement IAgent for backward compatibility, but callers
 * should prefer the specialized methods.
 *
 * Use the \`isPipelineAgent()\` type guard to distinguish pipeline agents from
 * execution agents at runtime.
 */
export interface IPipelineAgent {
  /** Human-readable agent name */
  readonly name: string;
  /** Agent type classification */
  readonly type: string;
  /** Initialize the agent (e.g. connect to external services) */
  initialize(): Promise<void>;
  /** Release all resources held by the agent */
  cleanup(): Promise<void>;
  /**
   * Marker property that distinguishes pipeline agents from execution agents.
   * Always true for pipeline agents; absent or false on execution agents.
   * @internal used by isPipelineAgent() type guard
   */
  readonly isPipelineAgent: true;
}

/**
 * Type guard: returns true when \`candidate\` satisfies the IPipelineAgent
 * interface (i.e. has an \`isPipelineAgent: true\` marker).
 *
 * @example
 * if (isPipelineAgent(agent)) {
 *   // agent is IPipelineAgent — use its specialized methods
 * }
 */
export function isPipelineAgent(candidate: unknown): candidate is IPipelineAgent {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    (candidate as any).isPipelineAgent === true
  );
}

// Agent types
export enum AgentType {
  UI = 'ui',
  CLI = 'cli',
  TUI = 'tui',
  API = 'api',
  WEBSOCKET = 'websocket',
  GITHUB = 'github',
  SYSTEM = 'system',
  COMPREHENSION = 'comprehension',
  PRIORITY = 'priority'
}

// BaseAgent - shared execute() boilerplate (issue #117)
export { BaseAgent } from './BaseAgent';
export type { ExecutionContext as AgentExecutionContext } from './BaseAgent';

// Re-export all agent implementations
export { ElectronUIAgent, createElectronUIAgent } from './ElectronUIAgent';
export type { ElectronUIAgentConfig, WebSocketEvent, PerformanceSample } from './ElectronUIAgent';
export { CLIAgent, createCLIAgent } from './CLIAgent';
export type { CLIAgentConfig, CLIProcessInfo, ExecutionContext, StreamData } from './CLIAgent';
export { TUIAgent, createTUIAgent } from './TUIAgent';
export type {
  TUIAgentConfig,
  TerminalSession,
  TerminalOutput,
  ColorInfo,
  PerformanceMetrics as TUIPerformanceMetrics,
  InputSimulation,
  MenuNavigation
} from './TUIAgent';
export { IssueReporter, createIssueReporter, defaultIssueReporterConfig } from './IssueReporter';
export type { 
  IssueReporterConfig, 
  RateLimitInfo, 
  IssueFingerprint, 
  CreateIssueOptions, 
  UpdateIssueOptions, 
  CreatePullRequestOptions,
  IssueTemplateVars,
  SystemInfo
} from './IssueReporter';
export { PriorityAgent, createPriorityAgent, defaultPriorityAgentConfig } from './PriorityAgent';
export type {
  PriorityAgentConfig,
  PriorityFactors,
  PriorityRule,
  AnalysisContext,
  PriorityAssignment,
  FailurePattern,
  FlakyTestResult,
  PriorityReport
} from './PriorityAgent';
export { ComprehensionAgent, createComprehensionAgent, defaultComprehensionAgentConfig } from './ComprehensionAgent';
export type {
  ComprehensionAgentConfig,
  LLMConfig,
  LLMProvider,
  FeatureSpec,
  FeatureInput,
  FeatureOutput,
  DiscoveredFeature
} from './ComprehensionAgent';
export { APIAgent, createAPIAgent } from './APIAgent';
export type {
  APIAgentConfig,
  HTTPMethod,
  AuthConfig,
  RequestInterceptor,
  ResponseInterceptor,
  SchemaValidation,
  PerformanceMeasurement,
  RetryConfig,
  APIRequest,
  APIResponse,
  RequestPerformance
} from './APIAgent';
export { WebSocketAgent, createWebSocketAgent, ConnectionState } from './WebSocketAgent';
export type {
  WebSocketAgentConfig,
  WebSocketMessage,
  ConnectionMetrics,
  LatencyMeasurement,
  EventListener,
  ReconnectionConfig,
  WebSocketAuth,
  ConnectionInfo
} from './WebSocketAgent';
export { SystemAgent, createSystemAgent, defaultSystemAgentConfig } from './SystemAgent';
export type {
  SystemAgentConfig,
  SystemMetrics,
  DiskUsage,
  DiskIO,
  NetworkInterface,
  ProcessInfo,
  DockerInfo,
  SystemHealthReport,
  SystemIssue,
  ResourceLeak,
  PerformanceIssue,
  FileSystemChange,
  PerformanceBaseline
} from './SystemAgent';