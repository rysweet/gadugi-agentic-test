// Core exports
export { ProcessLifecycleManager, processLifecycleManager } from './core/ProcessLifecycleManager';
export { PtyTerminal } from './core/PtyTerminal';
/** @deprecated Use PtyTerminal instead - renamed to resolve naming conflict with agents/TUIAgent */
export { PtyTerminal as CoreTUIAgent } from './core/PtyTerminal';
export { ResourceOptimizer, resourceOptimizer } from './core/ResourceOptimizer';
export {
  AdaptiveWaiter,
  adaptiveWaiter,
  waitFor,
  waitForOutput,
  waitForTerminalReady,
  waitForProcessStart,
  waitForProcessExit,
  retryOperation,
  delay,
  BackoffStrategy
} from './core/AdaptiveWaiter';

// Core type exports
export type {
  ProcessInfo,
  ProcessEvents
} from './core/ProcessLifecycleManager';

export type {
  TerminalDimensions,
  PtyTerminalConfig,
  PtyTerminalEvents
} from './core/PtyTerminal';

/** @deprecated Use PtyTerminalConfig instead */
export type { PtyTerminalConfig as CoreTUIAgentConfig } from './core/PtyTerminal';
/** @deprecated Use PtyTerminalEvents instead */
export type { PtyTerminalEvents as CoreTUIAgentEvents } from './core/PtyTerminal';

export type {
  ResourceOptimizerConfig,
  ResourcePoolConfig,
  MemoryConfig,
  BufferConfig,
  ResourceMetrics,
  ResourceOptimizerEvents
} from './core/ResourceOptimizer';

export type {
  WaitCondition,
  WaitOptions,
  WaitResult
} from './core/AdaptiveWaiter';

// Programmatic library API (config, scenario loading, runTests, etc.)
export {
  createDefaultConfig,
  loadConfiguration,
  loadTestScenarios,
  filterScenariosForSuite,
  saveResults,
  displayResults,
  performDryRun,
  setupGracefulShutdown,
  runTests,
  TEST_SUITES,
  TestOrchestrator,
  createTestOrchestrator,
  TestStatus,
  TestInterface,
  LogLevel,
  setupLogger
} from './lib';

export type {
  CliArguments,
  ProgrammaticTestOptions,
  TestConfig,
  TestSession,
  TestScenario,
  OrchestratorScenario,
  TestResult,
  TestSuite
} from './lib';

// Agent exports
export {
  // Base interfaces and enums
  AgentType,
  // Agent implementations
  ElectronUIAgent, createElectronUIAgent,
  CLIAgent, createCLIAgent,
  TUIAgent, createTUIAgent,
  IssueReporter, createIssueReporter, defaultIssueReporterConfig,
  PriorityAgent, createPriorityAgent, defaultPriorityAgentConfig,
  ComprehensionAgent, createComprehensionAgent, defaultComprehensionAgentConfig,
  APIAgent, createAPIAgent,
  WebSocketAgent, createWebSocketAgent,
  SystemAgent, createSystemAgent, defaultSystemAgentConfig
} from './agents';

export type {
  IAgent,
  // ElectronUIAgent types
  ElectronUIAgentConfig, WebSocketEvent, PerformanceSample,
  // CLIAgent types
  CLIAgentConfig, CLIProcessInfo, ExecutionContext, StreamData,
  // TUIAgent types (from agents, not core)
  TUIAgentConfig, TerminalSession, TerminalOutput, ColorInfo,
  TUIPerformanceMetrics, InputSimulation, MenuNavigation,
  // IssueReporter types
  IssueReporterConfig, RateLimitInfo, IssueFingerprint,
  CreateIssueOptions, UpdateIssueOptions, CreatePullRequestOptions,
  IssueTemplateVars, SystemInfo,
  // PriorityAgent types
  PriorityAgentConfig, PriorityFactors, PriorityRule,
  AnalysisContext, PriorityAssignment, FailurePattern,
  FlakyTestResult, PriorityReport,
  // ComprehensionAgent types
  ComprehensionAgentConfig, LLMConfig, LLMProvider,
  FeatureSpec, FeatureInput, FeatureOutput, DiscoveredFeature,
  // APIAgent types
  APIAgentConfig, HTTPMethod, AuthConfig,
  RequestInterceptor, ResponseInterceptor, SchemaValidation,
  PerformanceMeasurement, RetryConfig, APIRequest, APIResponse,
  RequestPerformance,
  // WebSocketAgent types
  WebSocketAgentConfig, ConnectionState, WebSocketMessage,
  ConnectionMetrics, LatencyMeasurement, EventListener,
  ReconnectionConfig, WebSocketAuth, ConnectionInfo,
  // SystemAgent types (ProcessInfo renamed to avoid core clash)
  SystemAgentConfig, SystemMetrics, DiskUsage, DiskIO,
  NetworkInterface,
  ProcessInfo as SystemProcessInfo,
  DockerInfo, SystemHealthReport, SystemIssue,
  ResourceLeak, PerformanceIssue, FileSystemChange,
  PerformanceBaseline
} from './agents';

// Orchestrator exports (TestOrchestrator & createTestOrchestrator already
// re-exported via ./lib above)
export { OrchestratorEvents } from './orchestrator';
export { TestSuite as OrchestratorTestSuite } from './orchestrator';
