# API Reference

Complete API documentation for the Gadugi Agentic Test framework. This reference covers all classes, methods, configuration options, and integration patterns.

## Table of Contents

1. [Core Classes](#core-classes)
2. [Agent APIs](#agent-apis)
3. [Configuration Objects](#configuration-objects)
4. [Test Models](#test-models)
5. [Utility Functions](#utility-functions)
6. [Integration APIs](#integration-apis)
7. [Event System](#event-system)
8. [Error Handling](#error-handling)

---

## Core Classes

### TestOrchestrator

The main orchestrator class that coordinates all testing activities across multiple agents.

```typescript
class TestOrchestrator extends EventEmitter
```

#### Constructor

```typescript
constructor(config: TestConfig)
```

**Parameters:**
- `config: TestConfig` - Global configuration object

**Example:**
```typescript
import { TestOrchestrator } from '@gadugi/agentic-test';

const orchestrator = new TestOrchestrator({
  execution: {
    maxParallel: 3,
    maxRetries: 2,
    continueOnFailure: true
  },
  cli: {
    timeout: 30000,
    workingDirectory: process.cwd()
  },
  ui: {
    executablePath: '/path/to/app.exe',
    headless: false
  },
  github: {
    repository: 'owner/repo',
    createIssues: true
  }
});
```

#### Methods

##### `run(suite?: string, scenarioFiles?: string[]): Promise<TestSession>`

Execute a complete testing session.

**Parameters:**
- `suite?: string` - Test suite name (default: 'smoke')
- `scenarioFiles?: string[]` - Specific scenario files to run

**Returns:** `Promise<TestSession>` - Complete session results

**Example:**
```typescript
// Run smoke tests
const session = await orchestrator.run('smoke');

// Run specific files
const session = await orchestrator.run('full', [
  './tests/login.yaml',
  './tests/dashboard.yaml'
]);

// Run all scenarios in directory
const session = await orchestrator.run('regression');
```

##### `abort(): void`

Abort the current test session.

**Example:**
```typescript
// Set up abort on timeout
setTimeout(() => {
  orchestrator.abort();
}, 300000); // 5 minutes

const session = await orchestrator.run();
```

##### `getSession(): TestSession | null`

Get the current test session.

**Returns:** `TestSession | null` - Current session or null if none active

##### `getResults(): TestResult[]`

Get all test results from the current session.

**Returns:** `TestResult[]` - Array of test results

##### `getFailures(): TestFailure[]`

Get all test failures from the current session.

**Returns:** `TestFailure[]` - Array of test failures

#### Events

```typescript
interface OrchestratorEvents {
  'session:start': (session: TestSession) => void;
  'session:end': (session: TestSession) => void;
  'scenario:start': (scenario: TestScenario) => void;
  'scenario:end': (scenario: TestScenario, result: TestResult) => void;
  'phase:start': (phase: string) => void;
  'phase:end': (phase: string) => void;
  'error': (error: Error) => void;
}
```

**Example:**
```typescript
orchestrator.on('scenario:start', (scenario) => {
  console.log(`Starting: ${scenario.name}`);
});

orchestrator.on('scenario:end', (scenario, result) => {
  console.log(`Completed: ${scenario.name} - ${result.status}`);
});
```

---

## Agent APIs

### ElectronUIAgent

Intelligent Electron application testing agent using Playwright.

```typescript
class ElectronUIAgent extends EventEmitter implements IAgent
```

#### Constructor

```typescript
constructor(config: ElectronUIAgentConfig)
```

#### Core Methods

##### `initialize(): Promise<void>`

Initialize the agent and validate configuration.

**Example:**
```typescript
const agent = new ElectronUIAgent({
  executablePath: '/path/to/app.exe',
  defaultTimeout: 10000
});

await agent.initialize();
```

##### `launch(): Promise<void>`

Launch the Electron application.

**Example:**
```typescript
await agent.launch();
```

##### `close(): Promise<void>`

Close the Electron application.

##### `cleanup(): Promise<void>`

Clean up all resources and export final data.

#### UI Interaction Methods

##### `clickTab(tabName: string): Promise<void>`

Navigate to a specific tab using intelligent selector strategies.

**Parameters:**
- `tabName: string` - Display name of the tab

**Example:**
```typescript
await agent.clickTab('Settings');
await agent.clickTab('Build Configuration');
```

##### `fillInput(selector: string, value: string): Promise<void>`

Fill an input field with validation.

**Parameters:**
- `selector: string` - CSS selector or data-testid
- `value: string` - Value to fill

**Example:**
```typescript
await agent.fillInput('[data-testid="username"]', 'testuser');
await agent.fillInput('#email', 'test@example.com');
```

##### `clickButton(selector: string): Promise<void>`

Click a button or clickable element.

**Parameters:**
- `selector: string` - CSS selector for the element

**Example:**
```typescript
await agent.clickButton('[data-testid="submit-btn"]');
await agent.clickButton('button:has-text("Save")');
```

##### `waitForElement(selector: string, options?: WaitOptions): Promise<Locator>`

Wait for an element to appear or reach a specific state.

**Parameters:**
- `selector: string` - CSS selector
- `options?: WaitOptions` - Wait configuration

```typescript
interface WaitOptions {
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  timeout?: number;
}
```

**Example:**
```typescript
// Wait for element to be visible
const element = await agent.waitForElement('[data-testid="success-message"]');

// Wait for element to be hidden
await agent.waitForElement('[data-testid="loading"]', {
  state: 'hidden',
  timeout: 30000
});
```

##### `getElementText(selector: string): Promise<string>`

Get text content from an element.

**Example:**
```typescript
const errorMessage = await agent.getElementText('[data-testid="error"]');
const title = await agent.getElementText('h1');
```

#### State Capture Methods

##### `screenshot(name: string): Promise<ScreenshotMetadata>`

Take a screenshot with metadata.

**Returns:** `ScreenshotMetadata` - Screenshot information

```typescript
interface ScreenshotMetadata {
  fileName: string;
  filePath: string;
  timestamp: Date;
  scenarioId?: string;
  description?: string;
  fileSize: number;
  dimensions: { width: number; height: number };
}
```

**Example:**
```typescript
const screenshot = await agent.screenshot('login_success');
console.log(`Screenshot saved: ${screenshot.filePath}`);
```

##### `captureState(): Promise<AppState>`

Capture comprehensive application state.

**Returns:** `AppState` - Complete application state

```typescript
interface AppState {
  timestamp: Date;
  interface: 'GUI' | 'CLI' | 'API';
  screenshotPath?: string;
  url?: string;
  title?: string;
  processInfo?: ProcessInfo;
  performance?: PerformanceMetrics;
  networkState?: NetworkState;
  customData?: Record<string, any>;
}
```

**Example:**
```typescript
const state = await agent.captureState();
console.log(`Current URL: ${state.url}`);
console.log(`Memory usage: ${state.performance?.memoryUsage}MB`);
```

#### Test Execution

##### `execute(scenario: TestScenario): Promise<TestResult>`

Execute a complete test scenario.

**Example:**
```typescript
const scenario = {
  id: 'login-test',
  name: 'User Login Flow',
  steps: [
    { action: 'launch_electron', target: '', timeout: 20000 },
    { action: 'fill', target: '[data-testid="username"]', value: 'testuser' },
    { action: 'fill', target: '[data-testid="password"]', value: 'password' },
    { action: 'click', target: '[data-testid="login-btn"]' },
    { action: 'wait_for_element', target: '[data-testid="dashboard"]' }
  ]
};

const result = await agent.execute(scenario);
```

##### `executeStep(step: TestStep, stepIndex: number): Promise<StepResult>`

Execute a single test step.

**Example:**
```typescript
const step = {
  action: 'click',
  target: '[data-testid="save-btn"]',
  timeout: 5000
};

const result = await agent.executeStep(step, 0);
```

#### Configuration Interface

```typescript
interface ElectronUIAgentConfig {
  executablePath: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  launchTimeout?: number;
  defaultTimeout?: number;
  headless?: boolean;
  recordVideo?: boolean;
  videoDir?: string;
  slowMo?: number;

  screenshotConfig?: {
    mode: 'off' | 'on' | 'only-on-failure';
    directory: string;
    fullPage: boolean;
  };

  websocketConfig?: {
    url: string;
    events: string[];
    reconnectAttempts: number;
    reconnectDelay: number;
  };

  performanceConfig?: {
    enabled: boolean;
    sampleInterval: number;
    collectLogs: boolean;
  };

  recoveryConfig?: {
    maxRetries: number;
    retryDelay: number;
    restartOnFailure: boolean;
  };
}
```

### CLIAgent

Command-line interface testing and validation agent.

```typescript
class CLIAgent implements IAgent
```

#### Constructor

```typescript
constructor(config: CLIConfig)
```

#### Methods

##### `execute(scenario: TestScenario): Promise<TestResult>`

Execute CLI-based test scenarios.

##### `runCommand(command: string, options?: CommandOptions): Promise<CommandResult>`

Execute a single command with monitoring.

```typescript
interface CommandOptions {
  timeout?: number;
  workingDirectory?: string;
  environmentVars?: Record<string, string>;
  input?: string;
  expectExitCode?: number;
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
}
```

**Example:**
```typescript
const result = await cliAgent.runCommand('npm test', {
  timeout: 60000,
  workingDirectory: './my-project',
  expectExitCode: 0
});

console.log(`Exit code: ${result.exitCode}`);
console.log(`Output: ${result.stdout}`);
```

##### `startInteractiveSession(command: string): Promise<InteractiveSession>`

Start an interactive CLI session.

```typescript
interface InteractiveSession {
  send(input: string): Promise<void>;
  expect(pattern: string | RegExp, timeout?: number): Promise<string>;
  close(): Promise<void>;
}
```

**Example:**
```typescript
const session = await cliAgent.startInteractiveSession('npm run dev');
await session.expect('Server running on port 3000');
await session.send('q'); // Quit
await session.close();
```

### IssueReporter

Automated GitHub issue creation and management agent.

```typescript
class IssueReporter implements IAgent
```

#### Methods

##### `reportFailure(failure: TestFailure): Promise<number | null>`

Create a GitHub issue for a test failure.

**Returns:** Issue number or null if creation failed

**Example:**
```typescript
const issueNumber = await issueReporter.reportFailure({
  scenarioId: 'login-test',
  timestamp: new Date(),
  message: 'Login button not responding',
  category: 'ui',
  logs: ['Error: Timeout waiting for element']
});

console.log(`Created issue #${issueNumber}`);
```

##### `checkForDuplicates(failure: TestFailure): Promise<number | null>`

Check if a similar issue already exists.

**Returns:** Existing issue number or null

### PriorityAgent

Intelligent failure prioritization and classification agent.

```typescript
class PriorityAgent implements IAgent
```

#### Methods

##### `analyzePriority(failure: TestFailure): Promise<PriorityAnalysis>`

Analyze failure priority using AI and historical data.

```typescript
interface PriorityAnalysis {
  priority: Priority;
  impactScore: number;
  reasoning: string;
  confidence: number;
  factors: PriorityFactor[];
}

enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}
```

**Example:**
```typescript
const analysis = await priorityAgent.analyzePriority(failure);
console.log(`Priority: ${analysis.priority} (score: ${analysis.impactScore})`);
console.log(`Reasoning: ${analysis.reasoning}`);
```

##### `generatePriorityReport(failures: TestFailure[], results: TestResult[]): Promise<PriorityReport>`

Generate comprehensive priority analysis report.

---

## Configuration Objects

### TestConfig

Global configuration for the test orchestrator.

```typescript
interface TestConfig {
  execution?: ExecutionConfig;
  cli?: CLIConfig;
  ui?: UIConfig;
  github?: GitHubConfig;
  priority?: PriorityConfig;
}
```

### ExecutionConfig

```typescript
interface ExecutionConfig {
  maxParallel?: number;          // Default: 3
  maxRetries?: number;           // Default: 2
  continueOnFailure?: boolean;   // Default: true
  suites?: Record<string, string[]>;
}
```

### CLIConfig

```typescript
interface CLIConfig {
  timeout?: number;              // Default: 30000
  workingDirectory?: string;     // Default: process.cwd()
  environmentVars?: Record<string, string>;
  shell?: string;                // Default: system shell
}
```

### UIConfig

```typescript
interface UIConfig {
  executablePath?: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewport?: { width: number; height: number };
  timeout?: number;
}
```

### GitHubConfig

```typescript
interface GitHubConfig {
  repository?: string;           // Format: 'owner/repo'
  token?: string;
  createIssues?: boolean;        // Default: false
  labels?: string[];
  assignees?: string[];
  issueTemplate?: string;
}
```

---

## Test Models

### TestScenario

```typescript
interface TestScenario {
  id: string;
  name: string;
  description?: string;
  version?: string;
  tags?: string[];
  interface?: TestInterface;
  steps: TestStep[];
  cleanup?: TestStep[];
  retryOnFailure?: boolean;
  timeout?: number;
}

enum TestInterface {
  GUI = 'gui',
  CLI = 'cli',
  API = 'api',
  MIXED = 'mixed'
}
```

### TestStep

```typescript
interface TestStep {
  name?: string;
  action: string;
  target: string;
  value?: string;
  timeout?: number;
  retries?: number;
  continueOnFailure?: boolean;
  condition?: StepCondition;
}

interface StepCondition {
  when?: 'always' | 'previous_step_passed' | 'previous_step_failed';
  unless?: string;
}
```

### TestResult

```typescript
interface TestResult {
  scenarioId: string;
  status: TestStatus;
  duration: number;
  startTime?: Date;
  endTime?: Date;
  error?: TestError;
  logs?: string[];
  screenshots?: string[];
  performanceSamples?: PerformanceSample[];
  websocketEvents?: WebSocketEvent[];
  stateSnapshots?: StateSnapshot[];
  retryCount?: number;
}

enum TestStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  ERROR = 'error'
}
```

### TestError

```typescript
interface TestError {
  type: string;
  message: string;
  stackTrace?: string;
  timestamp?: Date;
  context?: Record<string, any>;
}
```

### TestSession

```typescript
interface TestSession {
  id: string;
  startTime: Date;
  endTime: Date | null;
  scenariosExecuted: string[];
  results: TestResult[];
  failures: TestFailure[];
  issuesCreated: number[];
  metrics: SessionMetrics;
}

interface SessionMetrics {
  totalScenarios: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}
```

---

## Utility Functions

### Factory Functions

```typescript
// Create agent instances
export function createElectronUIAgent(config: ElectronUIAgentConfig): ElectronUIAgent;
export function createCLIAgent(config: CLIConfig): CLIAgent;
export function createTestOrchestrator(config: TestConfig): TestOrchestrator;

// Quick start utilities
export async function quickStart(scenarioPath: string): Promise<TestSession>;
export async function quickStartMultiple(scenarioPaths: string[]): Promise<TestSession>;
```

**Examples:**
```typescript
// Quick single test
await quickStart('./tests/smoke-test.yaml');

// Quick multiple tests
await quickStartMultiple([
  './tests/login.yaml',
  './tests/dashboard.yaml'
]);

// Manual agent creation
const uiAgent = createElectronUIAgent({
  executablePath: '/path/to/app.exe',
  headless: false
});
```

### Configuration Helpers

```typescript
export function loadConfig(path?: string): TestConfig;
export function validateEnvironment(): EnvironmentCheck;
export function mergeConfigs(base: TestConfig, override: Partial<TestConfig>): TestConfig;

interface EnvironmentCheck {
  valid: boolean;
  missing: string[];
  warnings: string[];
}
```

**Examples:**
```typescript
// Load configuration
const config = loadConfig('./gadugi.config.js');

// Environment validation
const envCheck = validateEnvironment();
if (!envCheck.valid) {
  console.error('Missing environment variables:', envCheck.missing);
}

// Merge configurations
const mergedConfig = mergeConfigs(baseConfig, {
  execution: { maxParallel: 5 }
});
```

### Scenario Loading

```typescript
export class ScenarioLoader {
  static async loadFromFile(path: string): Promise<TestScenario>;
  static async loadFromDirectory(directory: string): Promise<TestScenario[]>;
  static async loadFromPattern(pattern: string): Promise<TestScenario[]>;
  static validate(scenario: TestScenario): ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

**Examples:**
```typescript
// Load single scenario
const scenario = await ScenarioLoader.loadFromFile('./tests/login.yaml');

// Load all scenarios from directory
const scenarios = await ScenarioLoader.loadFromDirectory('./tests/');

// Load with glob pattern
const smokeTests = await ScenarioLoader.loadFromPattern('./tests/**/*smoke*.yaml');

// Validate scenario
const validation = ScenarioLoader.validate(scenario);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### Screenshot Management

```typescript
export class ScreenshotManager {
  async capturePageScreenshot(page: Page, options?: ScreenshotOptions): Promise<ScreenshotMetadata>;
  async compareScreenshots(baseline: string, actual: string, options?: CompareOptions): Promise<ComparisonResult>;
  async createDiff(baseline: string, actual: string, output: string, options?: DiffOptions): Promise<string>;
  async batchCompareScreenshots(comparisons: BatchComparison[]): Promise<ComparisonResult[]>;
}

interface ScreenshotOptions {
  scenarioId?: string;
  description?: string;
  fullPage?: boolean;
}

interface CompareOptions {
  algorithm?: 'pixel-by-pixel' | 'perceptual' | 'structural';
  threshold?: number;
  includeAA?: boolean;
  createDiffImage?: boolean;
  colorOptions?: ColorOptions;
}

interface ComparisonResult {
  matches: boolean;
  similarityPercentage: number;
  differencePercentage: number;
  diffImagePath?: string;
  metadata: ComparisonMetadata;
}
```

**Examples:**
```typescript
const screenshotManager = createScreenshotManager({
  baseDir: './screenshots',
  strategy: 'by-scenario'
});

// Compare screenshots
const comparison = await screenshotManager.compareScreenshots(
  './baseline/login.png',
  './actual/login.png',
  {
    algorithm: 'perceptual',
    threshold: 0.05,
    createDiffImage: true
  }
);

console.log(`Match: ${comparison.matches} (${comparison.similarityPercentage}%)`);
```

---

## Integration APIs

### GitHub Integration

```typescript
export class GitHubIntegration {
  constructor(config: GitHubConfig);

  async createIssue(title: string, body: string, options?: IssueOptions): Promise<number>;
  async updateIssue(issueNumber: number, updates: IssueUpdate): Promise<void>;
  async closeIssue(issueNumber: number, reason?: string): Promise<void>;
  async searchIssues(query: string): Promise<GitHubIssue[]>;
  async uploadArtifact(filePath: string, description?: string): Promise<string>;
}

interface IssueOptions {
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}
```

### WebSocket Integration

```typescript
export class WebSocketAgent implements IAgent {
  constructor(config: WebSocketConfig);

  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async send(event: string, data: any): Promise<void>;
  async waitForEvent(event: string, timeout?: number): Promise<any>;
  async listenForEvents(events: string[], handler: EventHandler): Promise<void>;
}

interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

type EventHandler = (event: string, data: any) => void;
```

### CI/CD Integration

```typescript
export class CIIntegration {
  static detectEnvironment(): CIEnvironment;
  static generateArtifacts(session: TestSession, outputDir: string): Promise<void>;
  static publishResults(session: TestSession, config: PublishConfig): Promise<void>;
}

interface CIEnvironment {
  provider: 'github-actions' | 'jenkins' | 'azure-devops' | 'gitlab-ci' | 'unknown';
  buildNumber?: string;
  commitSha?: string;
  branch?: string;
  pullRequestNumber?: string;
}
```

---

## Event System

All major components emit events for monitoring and integration.

### Orchestrator Events

```typescript
orchestrator.on('session:start', (session: TestSession) => {
  console.log(`Session ${session.id} started`);
});

orchestrator.on('scenario:start', (scenario: TestScenario) => {
  console.log(`Starting ${scenario.name}`);
});

orchestrator.on('scenario:end', (scenario: TestScenario, result: TestResult) => {
  console.log(`${scenario.name}: ${result.status} (${result.duration}ms)`);
});

orchestrator.on('phase:start', (phase: string) => {
  console.log(`Phase started: ${phase}`);
});

orchestrator.on('error', (error: Error) => {
  console.error('Orchestrator error:', error);
});
```

### Agent Events

```typescript
// ElectronUIAgent events
uiAgent.on('initialized', () => console.log('UI Agent ready'));
uiAgent.on('launched', () => console.log('Application launched'));
uiAgent.on('screenshot', (path: string) => console.log(`Screenshot: ${path}`));
uiAgent.on('websocket_connected', () => console.log('WebSocket connected'));
uiAgent.on('websocket_event', (event: WebSocketEvent) => {
  console.log(`WebSocket: ${event.type}`, event.data);
});

// CLIAgent events
cliAgent.on('command_start', (command: string) => console.log(`Running: ${command}`));
cliAgent.on('command_end', (command: string, result: CommandResult) => {
  console.log(`Completed: ${command} (exit: ${result.exitCode})`);
});
```

---

## Error Handling

### Error Types

```typescript
// Base error classes
export class GadugiError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, any>;
}

export class ConfigurationError extends GadugiError {
  constructor(message: string, context?: Record<string, any>);
}

export class ExecutionError extends GadugiError {
  constructor(message: string, context?: Record<string, any>);
}

export class TimeoutError extends GadugiError {
  constructor(operation: string, timeout: number);
}

export class ValidationError extends GadugiError {
  constructor(message: string, errors: string[]);
}
```

### Error Handling Patterns

```typescript
// Graceful error handling with retry
try {
  const result = await agent.execute(scenario);
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Operation timed out, retrying...');
    // Retry logic
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
    // Handle validation errors
  } else {
    console.error('Unexpected error:', error);
    throw error;
  }
}

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
```

### Recovery Strategies

```typescript
// Configure automatic recovery
const agent = new ElectronUIAgent({
  executablePath: '/path/to/app.exe',
  recoveryConfig: {
    maxRetries: 3,
    retryDelay: 2000,
    restartOnFailure: true
  }
});

// Manual recovery
async function withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) break;

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

---

## Advanced Usage Examples

### Custom Agent Creation

```typescript
import { IAgent, AgentType, TestScenario, TestResult } from '@gadugi/agentic-test';

class CustomDatabaseAgent implements IAgent {
  public readonly name = 'CustomDatabaseAgent';
  public readonly type = AgentType.API;

  async initialize(): Promise<void> {
    // Initialize database connection
  }

  async execute(scenario: TestScenario): Promise<TestResult> {
    // Execute database-specific test scenarios
    return {
      scenarioId: scenario.id,
      status: TestStatus.PASSED,
      duration: 1000
    };
  }

  async cleanup(): Promise<void> {
    // Close database connections
  }
}

// Register custom agent
const orchestrator = new TestOrchestrator(config);
orchestrator.registerAgent(new CustomDatabaseAgent());
```

### Advanced Scenario Composition

```typescript
// Programmatic scenario creation
const dynamicScenario: TestScenario = {
  id: 'dynamic-test',
  name: 'Dynamic User Test',
  steps: [
    {
      action: 'launch_electron',
      target: ''
    },
    ...users.map(user => ({
      action: 'test_user_flow',
      target: user.id,
      value: JSON.stringify(user)
    }))
  ]
};

// Scenario composition
function createLoginScenario(username: string, password: string): TestScenario {
  return {
    id: `login-${username}`,
    name: `Login Test for ${username}`,
    steps: [
      { action: 'launch_electron', target: '' },
      { action: 'fill', target: '[data-testid="username"]', value: username },
      { action: 'fill', target: '[data-testid="password"]', value: password },
      { action: 'click', target: '[data-testid="login-btn"]' },
      { action: 'wait_for_element', target: '[data-testid="dashboard"]' }
    ]
  };
}
```

### Plugin System

```typescript
// Plugin interface
interface GadugiPlugin {
  name: string;
  version: string;
  install(orchestrator: TestOrchestrator): Promise<void>;
  uninstall(orchestrator: TestOrchestrator): Promise<void>;
}

// Example plugin
class ReportingPlugin implements GadugiPlugin {
  name = 'ReportingPlugin';
  version = '1.0.0';

  async install(orchestrator: TestOrchestrator): Promise<void> {
    orchestrator.on('session:end', this.generateReport);
  }

  async uninstall(orchestrator: TestOrchestrator): Promise<void> {
    orchestrator.off('session:end', this.generateReport);
  }

  private generateReport = (session: TestSession) => {
    // Generate custom reports
  };
}

// Use plugin
const plugin = new ReportingPlugin();
await plugin.install(orchestrator);
```

---

This API reference provides comprehensive documentation for all public interfaces in the Gadugi Agentic Test framework. For additional examples and advanced usage patterns, see the [examples directory](./examples/) and [scenario samples](./scenarios/).

For questions or clarifications about any API, please [open an issue](https://github.com/rysweet/gadugi-agentic-test/issues) on GitHub.