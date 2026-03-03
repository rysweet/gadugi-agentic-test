export { ProcessLifecycleManager, processLifecycleManager } from './core/ProcessLifecycleManager';
export { PtyTerminal } from './core/PtyTerminal';
/** @deprecated Use PtyTerminal instead - renamed to resolve naming conflict with agents/TUIAgent. Will be removed in v2.0. */
export { PtyTerminal as CoreTUIAgent } from './core/PtyTerminal';
export { ResourceOptimizer, resourceOptimizer } from './core/ResourceOptimizer';
export { AdaptiveWaiter, adaptiveWaiter, waitFor, waitForOutput, waitForTerminalReady, waitForProcessStart, waitForProcessExit, retryOperation, delay, BackoffStrategy } from './core/AdaptiveWaiter';
export type { ProcessInfo, ProcessEvents } from './core/ProcessLifecycleManager';
export type { TerminalDimensions, PtyTerminalConfig, PtyTerminalEvents } from './core/PtyTerminal';
/** @deprecated Use PtyTerminalConfig instead. Will be removed in v2.0. */
export type { PtyTerminalConfig as CoreTUIAgentConfig } from './core/PtyTerminal';
/** @deprecated Use PtyTerminalEvents instead. Will be removed in v2.0. */
export type { PtyTerminalEvents as CoreTUIAgentEvents } from './core/PtyTerminal';
export type { ResourceOptimizerConfig, ResourcePoolConfig, MemoryConfig, BufferConfig, ResourceMetrics, ResourceOptimizerEvents } from './core/ResourceOptimizer';
export type { WaitCondition, WaitOptions, WaitResult } from './core/AdaptiveWaiter';
export { createDefaultConfig, loadConfiguration, loadTestScenarios, filterScenariosForSuite, saveResults, displayResults, performDryRun, runTests, TEST_SUITES, TestOrchestrator, createTestOrchestrator, TestStatus, TestInterface, LogLevel, setupLogger } from './lib';
export type { CliArguments, ProgrammaticTestOptions, TestConfig, TestSession, TestScenario, OrchestratorScenario, TestResult, TestSuite } from './lib';
export { AgentType, isPipelineAgent, ElectronUIAgent, createElectronUIAgent, CLIAgent, createCLIAgent, TUIAgent, createTUIAgent, IssueReporter, createIssueReporter, defaultIssueReporterConfig, PriorityAgent, createPriorityAgent, defaultPriorityAgentConfig, ComprehensionAgent, createComprehensionAgent, defaultComprehensionAgentConfig, APIAgent, createAPIAgent, WebSocketAgent, createWebSocketAgent, SystemAgent, createSystemAgent, defaultSystemAgentConfig } from './agents';
export type { IAgent, IPipelineAgent, ElectronUIAgentConfig, WebSocketEvent, PerformanceSample, CLIAgentConfig, CLIProcessInfo, ExecutionContext, StreamData, TUIAgentConfig, TerminalSession, TerminalOutput, ColorInfo, TUIPerformanceMetrics, InputSimulation, MenuNavigation, IssueReporterConfig, RateLimitInfo, IssueFingerprint, CreateIssueOptions, UpdateIssueOptions, CreatePullRequestOptions, IssueTemplateVars, SystemInfo, PriorityAgentConfig, PriorityFactors, PriorityRule, AnalysisContext, PriorityAssignment, FailurePattern, FlakyTestResult, PriorityReport, ComprehensionAgentConfig, LLMConfig, LLMProvider, FeatureSpec, FeatureInput, FeatureOutput, DiscoveredFeature, APIAgentConfig, HTTPMethod, AuthConfig, RequestInterceptor, ResponseInterceptor, SchemaValidation, PerformanceMeasurement, RetryConfig, APIRequest, APIResponse, RequestPerformance, WebSocketAgentConfig, ConnectionState, WebSocketMessage, ConnectionMetrics, LatencyMeasurement, EventListener, ReconnectionConfig, WebSocketAuth, ConnectionInfo, SystemAgentConfig, SystemMetrics, DiskUsage, DiskIO, NetworkInterface, ProcessInfo as SystemProcessInfo, DockerInfo, SystemHealthReport, SystemIssue, ResourceLeak, PerformanceIssue, FileSystemChange, PerformanceBaseline } from './agents';
export type { OrchestratorEvents } from './orchestrator';
/**
 * OrchestratorTestSuite: public alias for SuiteFilterConfig.
 *
 * This is the pattern-based suite selector — { name, patterns: string[] }.
 * It is NOT the same as TestModels.TestSuite which contains scenario objects.
 * The alias preserves backward compatibility with consumers importing
 * `OrchestratorTestSuite` from the public API.
 */
export type { SuiteFilterConfig as OrchestratorTestSuite } from './orchestrator';
//# sourceMappingURL=index.d.ts.map