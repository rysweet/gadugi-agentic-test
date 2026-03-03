"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAPIAgent = exports.APIAgent = exports.defaultComprehensionAgentConfig = exports.createComprehensionAgent = exports.ComprehensionAgent = exports.defaultPriorityAgentConfig = exports.createPriorityAgent = exports.PriorityAgent = exports.defaultIssueReporterConfig = exports.createIssueReporter = exports.IssueReporter = exports.createTUIAgent = exports.TUIAgent = exports.createCLIAgent = exports.CLIAgent = exports.createElectronUIAgent = exports.ElectronUIAgent = exports.isPipelineAgent = exports.AgentType = exports.setupLogger = exports.LogLevel = exports.TestInterface = exports.TestStatus = exports.createTestOrchestrator = exports.TestOrchestrator = exports.TEST_SUITES = exports.runTests = exports.performDryRun = exports.displayResults = exports.saveResults = exports.filterScenariosForSuite = exports.loadTestScenarios = exports.loadConfiguration = exports.createDefaultConfig = exports.BackoffStrategy = exports.delay = exports.retryOperation = exports.waitForProcessExit = exports.waitForProcessStart = exports.waitForTerminalReady = exports.waitForOutput = exports.waitFor = exports.adaptiveWaiter = exports.AdaptiveWaiter = exports.resourceOptimizer = exports.ResourceOptimizer = exports.CoreTUIAgent = exports.PtyTerminal = exports.processLifecycleManager = exports.ProcessLifecycleManager = void 0;
exports.defaultSystemAgentConfig = exports.createSystemAgent = exports.SystemAgent = exports.createWebSocketAgent = exports.WebSocketAgent = void 0;
// Core exports
var ProcessLifecycleManager_1 = require("./core/ProcessLifecycleManager");
Object.defineProperty(exports, "ProcessLifecycleManager", { enumerable: true, get: function () { return ProcessLifecycleManager_1.ProcessLifecycleManager; } });
Object.defineProperty(exports, "processLifecycleManager", { enumerable: true, get: function () { return ProcessLifecycleManager_1.processLifecycleManager; } });
var PtyTerminal_1 = require("./core/PtyTerminal");
Object.defineProperty(exports, "PtyTerminal", { enumerable: true, get: function () { return PtyTerminal_1.PtyTerminal; } });
/** @deprecated Use PtyTerminal instead - renamed to resolve naming conflict with agents/TUIAgent. Will be removed in v2.0. */
var PtyTerminal_2 = require("./core/PtyTerminal");
Object.defineProperty(exports, "CoreTUIAgent", { enumerable: true, get: function () { return PtyTerminal_2.PtyTerminal; } });
var ResourceOptimizer_1 = require("./core/ResourceOptimizer");
Object.defineProperty(exports, "ResourceOptimizer", { enumerable: true, get: function () { return ResourceOptimizer_1.ResourceOptimizer; } });
Object.defineProperty(exports, "resourceOptimizer", { enumerable: true, get: function () { return ResourceOptimizer_1.resourceOptimizer; } });
var AdaptiveWaiter_1 = require("./core/AdaptiveWaiter");
Object.defineProperty(exports, "AdaptiveWaiter", { enumerable: true, get: function () { return AdaptiveWaiter_1.AdaptiveWaiter; } });
Object.defineProperty(exports, "adaptiveWaiter", { enumerable: true, get: function () { return AdaptiveWaiter_1.adaptiveWaiter; } });
Object.defineProperty(exports, "waitFor", { enumerable: true, get: function () { return AdaptiveWaiter_1.waitFor; } });
Object.defineProperty(exports, "waitForOutput", { enumerable: true, get: function () { return AdaptiveWaiter_1.waitForOutput; } });
Object.defineProperty(exports, "waitForTerminalReady", { enumerable: true, get: function () { return AdaptiveWaiter_1.waitForTerminalReady; } });
Object.defineProperty(exports, "waitForProcessStart", { enumerable: true, get: function () { return AdaptiveWaiter_1.waitForProcessStart; } });
Object.defineProperty(exports, "waitForProcessExit", { enumerable: true, get: function () { return AdaptiveWaiter_1.waitForProcessExit; } });
Object.defineProperty(exports, "retryOperation", { enumerable: true, get: function () { return AdaptiveWaiter_1.retryOperation; } });
Object.defineProperty(exports, "delay", { enumerable: true, get: function () { return AdaptiveWaiter_1.delay; } });
Object.defineProperty(exports, "BackoffStrategy", { enumerable: true, get: function () { return AdaptiveWaiter_1.BackoffStrategy; } });
// Programmatic library API (config, scenario loading, runTests, etc.)
// NOTE: setupGracefulShutdown is intentionally NOT exported here.
// It installs global process signal handlers and belongs only in CLI
// entry points. Import it from './cli/setup' if you need it.
var lib_1 = require("./lib");
Object.defineProperty(exports, "createDefaultConfig", { enumerable: true, get: function () { return lib_1.createDefaultConfig; } });
Object.defineProperty(exports, "loadConfiguration", { enumerable: true, get: function () { return lib_1.loadConfiguration; } });
Object.defineProperty(exports, "loadTestScenarios", { enumerable: true, get: function () { return lib_1.loadTestScenarios; } });
Object.defineProperty(exports, "filterScenariosForSuite", { enumerable: true, get: function () { return lib_1.filterScenariosForSuite; } });
Object.defineProperty(exports, "saveResults", { enumerable: true, get: function () { return lib_1.saveResults; } });
Object.defineProperty(exports, "displayResults", { enumerable: true, get: function () { return lib_1.displayResults; } });
Object.defineProperty(exports, "performDryRun", { enumerable: true, get: function () { return lib_1.performDryRun; } });
Object.defineProperty(exports, "runTests", { enumerable: true, get: function () { return lib_1.runTests; } });
Object.defineProperty(exports, "TEST_SUITES", { enumerable: true, get: function () { return lib_1.TEST_SUITES; } });
Object.defineProperty(exports, "TestOrchestrator", { enumerable: true, get: function () { return lib_1.TestOrchestrator; } });
Object.defineProperty(exports, "createTestOrchestrator", { enumerable: true, get: function () { return lib_1.createTestOrchestrator; } });
Object.defineProperty(exports, "TestStatus", { enumerable: true, get: function () { return lib_1.TestStatus; } });
Object.defineProperty(exports, "TestInterface", { enumerable: true, get: function () { return lib_1.TestInterface; } });
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return lib_1.LogLevel; } });
Object.defineProperty(exports, "setupLogger", { enumerable: true, get: function () { return lib_1.setupLogger; } });
// Agent exports
var agents_1 = require("./agents");
// Base interfaces and enums
Object.defineProperty(exports, "AgentType", { enumerable: true, get: function () { return agents_1.AgentType; } });
Object.defineProperty(exports, "isPipelineAgent", { enumerable: true, get: function () { return agents_1.isPipelineAgent; } });
// Agent implementations
Object.defineProperty(exports, "ElectronUIAgent", { enumerable: true, get: function () { return agents_1.ElectronUIAgent; } });
Object.defineProperty(exports, "createElectronUIAgent", { enumerable: true, get: function () { return agents_1.createElectronUIAgent; } });
Object.defineProperty(exports, "CLIAgent", { enumerable: true, get: function () { return agents_1.CLIAgent; } });
Object.defineProperty(exports, "createCLIAgent", { enumerable: true, get: function () { return agents_1.createCLIAgent; } });
Object.defineProperty(exports, "TUIAgent", { enumerable: true, get: function () { return agents_1.TUIAgent; } });
Object.defineProperty(exports, "createTUIAgent", { enumerable: true, get: function () { return agents_1.createTUIAgent; } });
Object.defineProperty(exports, "IssueReporter", { enumerable: true, get: function () { return agents_1.IssueReporter; } });
Object.defineProperty(exports, "createIssueReporter", { enumerable: true, get: function () { return agents_1.createIssueReporter; } });
Object.defineProperty(exports, "defaultIssueReporterConfig", { enumerable: true, get: function () { return agents_1.defaultIssueReporterConfig; } });
Object.defineProperty(exports, "PriorityAgent", { enumerable: true, get: function () { return agents_1.PriorityAgent; } });
Object.defineProperty(exports, "createPriorityAgent", { enumerable: true, get: function () { return agents_1.createPriorityAgent; } });
Object.defineProperty(exports, "defaultPriorityAgentConfig", { enumerable: true, get: function () { return agents_1.defaultPriorityAgentConfig; } });
Object.defineProperty(exports, "ComprehensionAgent", { enumerable: true, get: function () { return agents_1.ComprehensionAgent; } });
Object.defineProperty(exports, "createComprehensionAgent", { enumerable: true, get: function () { return agents_1.createComprehensionAgent; } });
Object.defineProperty(exports, "defaultComprehensionAgentConfig", { enumerable: true, get: function () { return agents_1.defaultComprehensionAgentConfig; } });
Object.defineProperty(exports, "APIAgent", { enumerable: true, get: function () { return agents_1.APIAgent; } });
Object.defineProperty(exports, "createAPIAgent", { enumerable: true, get: function () { return agents_1.createAPIAgent; } });
Object.defineProperty(exports, "WebSocketAgent", { enumerable: true, get: function () { return agents_1.WebSocketAgent; } });
Object.defineProperty(exports, "createWebSocketAgent", { enumerable: true, get: function () { return agents_1.createWebSocketAgent; } });
Object.defineProperty(exports, "SystemAgent", { enumerable: true, get: function () { return agents_1.SystemAgent; } });
Object.defineProperty(exports, "createSystemAgent", { enumerable: true, get: function () { return agents_1.createSystemAgent; } });
Object.defineProperty(exports, "defaultSystemAgentConfig", { enumerable: true, get: function () { return agents_1.defaultSystemAgentConfig; } });
//# sourceMappingURL=index.js.map