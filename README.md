# Gadugi Agentic Test Framework

[![Build Status](https://github.com/Azure/azure-tenant-grapher/actions/workflows/ci.yml/badge.svg)](https://github.com/Azure/azure-tenant-grapher/actions)
[![npm version](https://badge.fury.io/js/%40azure-tenant-grapher%2Fagentic-testing.svg)](https://www.npmjs.com/package/@azure-tenant-grapher/agentic-testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Gadugi** (ᎦᏚᎩ) - Cherokee word meaning "cooperative spirit" - perfectly embodies this framework where intelligent agents work together to test complex applications.

## Overview

Gadugi Agentic Test is a revolutionary testing framework that employs autonomous AI agents to intelligently test Electron applications and complex software systems. Unlike traditional testing tools, Gadugi agents understand application behavior, adapt to changes, and collaborate to provide comprehensive coverage without brittle test scripts.

The framework combines the power of **multi-agent orchestration**, **intelligent UI understanding**, and **adaptive test generation** to create a truly autonomous testing experience.

## ✨ Key Features

### 🤖 **Multi-Agent Architecture**
- **ElectronUIAgent**: Intelligent Electron app testing with Playwright
- **CLIAgent**: Command-line interface testing and validation  
- **ComprehensionAgent**: AI-powered feature understanding and test generation
- **IssueReporter**: Automated GitHub issue creation with context
- **PriorityAgent**: Smart issue prioritization and classification

### 🧠 **Intelligent Testing**
- **Adaptive Selectors**: Automatically finds elements using multiple strategies
- **Visual Regression**: Screenshot comparison and visual validation
- **Performance Monitoring**: Real-time CPU, memory, and response time tracking
- **WebSocket Monitoring**: Live event tracking and communication validation
- **Error Recovery**: Automatic retry mechanisms with contextual recovery

### 🎯 **Scenario-Driven**
- **YAML Test Scenarios**: Human-readable test definitions
- **Dynamic Test Generation**: AI creates tests from documentation
- **Parallel Execution**: Run multiple test scenarios simultaneously
- **State Management**: Intelligent checkpointing and restoration

### 📊 **Rich Reporting**
- **Comprehensive Logs**: Structured logging with multiple levels
- **Screenshot Gallery**: Automatic capture on failures and state changes
- **Performance Metrics**: Detailed execution analytics
- **GitHub Integration**: Automated issue reporting with full context

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- Python 3.11+ (for orchestration)
- Playwright browsers
- Git CLI (for issue reporting)

### From GitHub (Current)
```bash
# Clone the repository
git clone https://github.com/Azure/azure-tenant-grapher.git
cd azure-tenant-grapher/spa/agentic-testing

# Install dependencies
npm install

# Build the framework
npm run build

# Run tests
npm test
```

### From NPM (Coming Soon)
```bash
# NPM package publishing is planned for v1.1.0
npm install -g @gadugi/agentic-test
```

## 🎯 Quick Start

### 1. Basic Electron App Testing

```typescript
import { ElectronUIAgent, quickStart } from '@azure-tenant-grapher/agentic-testing';

// Quick one-liner for running a test scenario
await quickStart('./scenarios/my-app-test.yaml');

// Or create an agent manually for fine control
const agent = new ElectronUIAgent({
  executablePath: '/path/to/your/electron/app',
  defaultTimeout: 10000,
  screenshotConfig: {
    mode: 'only-on-failure',
    directory: './screenshots',
    fullPage: true
  }
});

await agent.initialize();
await agent.launch();

// Intelligent UI interactions
await agent.clickTab('Settings');
await agent.fillInput('email', 'test@example.com');
await agent.clickButton('Save');

// Verify results
await agent.waitForElement('[data-success="true"]');
const state = await agent.captureState();

await agent.cleanup();
```

### 2. YAML Scenario Definition

```yaml
# test-scenario.yaml
name: "User Registration Flow"
description: "Test complete user registration with validation"
version: "1.0.0"

agents:
  - name: "ui-agent"
    type: "ui"
    config:
      executablePath: "${ELECTRON_APP_PATH}"
      screenshotConfig:
        mode: "only-on-failure"

steps:
  - name: "Launch Application"
    agent: "ui-agent"
    action: "launch_electron"
    timeout: 20000

  - name: "Navigate to Registration"
    agent: "ui-agent"
    action: "click_tab"
    params:
      target: "Register"

  - name: "Fill Registration Form"
    agent: "ui-agent"
    action: "multi_action"
    params:
      actions:
        - action: "fill"
          target: "[data-testid='username']"
          value: "testuser123"
        - action: "fill" 
          target: "[data-testid='email']"
          value: "test@example.com"
        - action: "fill"
          target: "[data-testid='password']"
          value: "SecurePass123!"

  - name: "Submit Registration"
    agent: "ui-agent"
    action: "click"
    params:
      target: "[data-testid='register-btn']"

  - name: "Verify Success"
    agent: "ui-agent"
    action: "wait_for_element"
    params:
      target: "[data-testid='success-message']"
      state: "visible"
    timeout: 30000

cleanup:
  - name: "Close Application"
    agent: "ui-agent"
    action: "close_app"
```

### 3. Running Tests

```bash
# Run specific scenario
npx agentic-test run ./scenarios/user-registration.yaml

# Run all scenarios in a directory
npx agentic-test run ./scenarios/

# Run with custom configuration
npx agentic-test run --config ./config/test-config.json ./scenarios/

# Run in CI mode (headless, artifact generation)
npx agentic-test run --ci --artifacts ./reports/ ./scenarios/
```

## 🤝 Available Agents

### ElectronUIAgent
**Purpose**: Intelligent Electron application testing via Playwright integration

**Capabilities**:
- Multi-strategy element location (data-testid, text content, CSS selectors)
- Automatic screenshot capture on failures
- WebSocket event monitoring
- Performance metrics collection
- Multi-window support
- Dialog handling

**Configuration**:
```typescript
{
  executablePath: string;        // Path to Electron app
  defaultTimeout: number;        // Default operation timeout
  screenshotConfig: {
    mode: 'off' | 'on' | 'only-on-failure';
    directory: string;
    fullPage: boolean;
  };
  performanceConfig: {
    enabled: boolean;
    sampleInterval: number;       // ms
    collectLogs: boolean;
  };
}
```

### CLIAgent  
**Purpose**: Command-line interface testing and validation

**Capabilities**:
- Interactive CLI sessions with pexpect
- Command output validation
- Environment variable management
- Process monitoring
- Timeout handling

**Configuration**:
```typescript
{
  baseCommand: string[];         // Base command array
  timeout: number;               // Command timeout
  workingDirectory: string;      // Execution directory
  environmentVars: object;       // Environment variables
}
```

### ComprehensionAgent
**Purpose**: AI-powered understanding and test generation

**Capabilities**:
- Documentation analysis
- Feature specification extraction
- Automatic test scenario generation
- Edge case identification
- Natural language processing

**Configuration**:
```typescript
{
  llmConfig: {
    provider: 'azure-openai' | 'openai';
    deployment: string;
    temperature: number;
  };
  analysisDepth: 'shallow' | 'deep';
  generateEdgeCases: boolean;
}
```

### IssueReporter
**Purpose**: Automated GitHub issue creation and management

**Capabilities**:
- Duplicate issue detection
- Rich issue formatting with screenshots
- Smart labeling and prioritization
- GitHub API integration
- Artifact attachment

**Configuration**:
```typescript
{
  repository: string;            // GitHub repo
  labels: string[];              // Default labels
  assignees: string[];           // Default assignees
  issueTemplate: string;         // Issue template
}
```

### PriorityAgent
**Purpose**: Intelligent issue prioritization and classification  

**Capabilities**:
- Impact assessment
- Severity classification
- Historical analysis
- Machine learning-based scoring
- Custom priority rules

## ⚙️ Configuration Options

### Global Configuration

```typescript
// gadugi.config.ts
export default {
  // Execution settings
  maxConcurrentAgents: 3,
  retryAttempts: 2,
  timeoutMultiplier: 1.0,
  
  // Logging configuration
  logLevel: 'info',
  logFile: './logs/gadugi.log',
  consoleOutput: true,
  
  // Artifact management
  artifactDirectory: './artifacts',
  screenshotDirectory: './screenshots',
  retainArtifacts: 7, // days
  
  // AI integration
  llmProvider: 'azure-openai',
  llmDeployment: 'gpt-4',
  
  // GitHub integration
  createIssues: true,
  repository: 'your-org/your-repo',
  
  // Performance monitoring
  collectMetrics: true,
  metricsInterval: 5000,
};
```

### Environment Variables

```bash
# Required
ELECTRON_APP_PATH=/path/to/app              # Electron executable
AZURE_OPENAI_ENDPOINT=https://...           # AI service endpoint
AZURE_OPENAI_KEY=your-key                   # AI service key
GITHUB_TOKEN=your-token                     # GitHub integration

# Optional  
GADUGI_LOG_LEVEL=debug                      # Logging level
GADUGI_HEADLESS=false                       # UI visibility
GADUGI_TIMEOUT_MULTIPLIER=1.5               # Global timeout scaling
GADUGI_PARALLEL_AGENTS=5                    # Max concurrent agents
```

## 📋 Example Test Scenarios

### Comprehensive UI Workflow

```yaml
name: "Build and Generate Infrastructure"
description: "Complete workflow testing from data discovery to IaC generation"

agents:
  - name: "ui-agent"
    type: "ui"
  - name: "websocket-agent" 
    type: "websocket"
    config:
      url: "ws://localhost:3001"

steps:
  # Phase 1: Discovery
  - name: "Start Azure Discovery"
    agent: "ui-agent"
    action: "multi_action"
    params:
      actions:
        - action: "click_tab"
          target: "Build"
        - action: "fill"
          target: "[data-testid='tenant-id']"
          value: "${TEST_TENANT_ID}"
        - action: "click"
          target: "[data-testid='start-discovery']"
          
  - name: "Monitor Discovery Progress"
    agent: "websocket-agent"
    action: "listen"
    params:
      events: ["discovery-progress", "discovery-complete"]
    timeout: 300000 # 5 minutes
    
  # Phase 2: Validation
  - name: "Verify Discovery Results"
    agent: "ui-agent"
    action: "wait_for_element"
    params:
      target: "[data-testid='discovery-complete']"
      state: "visible"
      
  # Phase 3: IaC Generation  
  - name: "Generate Terraform"
    agent: "ui-agent"
    action: "multi_action"
    params:
      actions:
        - action: "click_tab"
          target: "Generate IaC"
        - action: "select"
          target: "[data-testid='format-select']"
          value: "terraform"
        - action: "click"
          target: "[data-testid='generate-btn']"

assertions:
  - name: "Terraform Files Generated"
    type: "file_exists"
    agent: "system-agent"
    params:
      path: "./output/*.tf"

  - name: "No Error Messages"
    type: "element_not_visible"
    agent: "ui-agent"
    params:
      selector: "[data-testid='error-message']"
```

### Error Handling Scenario

```yaml
name: "Network Failure Recovery"
description: "Test application behavior during network disruptions"

agents:
  - name: "ui-agent"
    type: "ui"
  - name: "network-agent"
    type: "network"

steps:
  - name: "Start Normal Operation"
    agent: "ui-agent"
    action: "click_tab"
    params:
      target: "Build"

  - name: "Simulate Network Failure"
    agent: "network-agent" 
    action: "block_port"
    params:
      port: 443
      duration: 30000

  - name: "Verify Error Handling"
    agent: "ui-agent"
    action: "wait_for_element"
    params:
      target: "[data-testid='network-error']"
      state: "visible"

  - name: "Restore Network"
    agent: "network-agent"
    action: "unblock_port"
    params:
      port: 443

  - name: "Verify Recovery"
    agent: "ui-agent"
    action: "wait_for_element"
    params:
      target: "[data-testid='connection-restored']"
      state: "visible"
```

## 📚 API Documentation

### Core Classes

#### `AgenticOrchestrator`

Main coordination class that manages test execution across multiple agents.

```typescript
class AgenticOrchestrator {
  constructor(config: OrchestratorConfig);
  
  async executeScenarios(scenarios: TestScenario[]): Promise<TestSuite>;
  async executeScenario(scenario: TestScenario): Promise<TestResult>;
  
  // Agent management
  registerAgent(agent: IAgent): void;
  getAgent(name: string): IAgent;
  
  // State management
  checkpoint(name: string): Promise<void>;
  restore(checkpointName: string): Promise<void>;
}
```

#### `ElectronUIAgent`

Intelligent Electron application testing agent.

```typescript
class ElectronUIAgent implements IAgent {
  constructor(config: ElectronUIAgentConfig);
  
  // Lifecycle
  async initialize(): Promise<void>;
  async launch(): Promise<void>;
  async close(): Promise<void>;
  async cleanup(): Promise<void>;
  
  // Interactions  
  async clickTab(tabName: string): Promise<void>;
  async fillInput(selector: string, value: string): Promise<void>;
  async clickButton(selector: string): Promise<void>;
  async waitForElement(selector: string, options?: WaitOptions): Promise<Locator>;
  
  // State capture
  async captureState(): Promise<AppState>;
  async screenshot(name: string): Promise<ScreenshotMetadata>;
  
  // Test execution
  async executeStep(step: TestStep, stepIndex: number): Promise<StepResult>;
  async execute(scenario: TestScenario): Promise<TestResult>;
}
```

#### `ScenarioLoader`

YAML scenario parsing and validation.

```typescript
class ScenarioLoader {
  static async loadFromFile(path: string): Promise<TestScenario>;
  static async loadFromDirectory(directory: string): Promise<TestScenario[]>;
  static validate(scenario: TestScenario): ValidationResult;
}
```

### Utility Functions

```typescript
// Quick start for common patterns
export async function quickStart(scenarioPath: string): Promise<void>;

// Agent factory functions
export function createElectronUIAgent(config: ElectronUIAgentConfig): ElectronUIAgent;
export function createCLIAgent(config: CLIAgentConfig): CLIAgent;

// Configuration helpers
export function loadConfig(path?: string): GadugiConfig;
export function validateEnvironment(): EnvironmentCheck;
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/Azure/azure-tenant-grapher.git
cd azure-tenant-grapher/spa/agentic-testing

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint:fix

# Build for production
npm run build
```

### Code Standards

- **TypeScript**: Strict mode with comprehensive typing
- **Testing**: Jest for unit tests, full integration test suite
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier with consistent configuration
- **Documentation**: JSDoc for all public APIs

### Pull Request Process

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with tests and documentation
4. Run full test suite (`npm test`)
5. Submit pull request with detailed description

## 🗺️ Roadmap

### v1.1.0 - NPM Publishing (Q1 2024)
- [ ] Standalone NPM package publication
- [ ] CLI binary distribution
- [ ] Enhanced documentation site
- [ ] Plugin architecture for custom agents

### v1.2.0 - Advanced AI Integration (Q2 2024)  
- [ ] Visual element recognition with computer vision
- [ ] Natural language test generation
- [ ] Automatic test maintenance and adaptation
- [ ] Smart element selector evolution

### v1.3.0 - Enterprise Features (Q3 2024)
- [ ] Test result database integration
- [ ] Advanced reporting dashboards  
- [ ] Team collaboration features
- [ ] Enterprise security compliance

### v2.0.0 - Multi-Platform Support (Q4 2024)
- [ ] Web application testing support
- [ ] Mobile application testing (React Native)
- [ ] Cross-platform test scenario sharing
- [ ] Cloud execution environment

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **Cherokee Nation** - For inspiration behind the "Gadugi" name representing cooperative spirit
- **Playwright Team** - For excellent browser automation capabilities
- **AutoGen/Magentic-One** - For multi-agent orchestration patterns
- **Azure Tenant Grapher Team** - For the original use case and testing requirements

---

*Built with ❤️ by the Azure Tenant Grapher team. Ready to revolutionize your testing workflow with intelligent agents working in harmony.*