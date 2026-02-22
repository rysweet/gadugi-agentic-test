# Gadugi Agentic Test Framework

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Gadugi** (ᎦᏚᎩ) - Cherokee word meaning "cooperative spirit" - perfectly embodies this framework where intelligent agents work together to test complex applications.

## Overview

Gadugi Agentic Test is a testing framework that employs autonomous AI agents to intelligently test Electron applications, web apps, command lines, and text ui applications "outside-in" - ie like a user would. Unlike traditional testing tools, Gadugi agents understand application behavior, adapt to changes, and collaborate to provide comprehensive coverage without brittle test scripts.

The framework combines the power of **multi-agent orchestration**, **intelligent UI understanding**, and **adaptive test generation** to create an autonomous testing experience.

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

## Architecture

The framework uses a **modular brick architecture** where each concern is isolated:

### Agent Layer (`src/agents/`)
Each agent is a thin facade over focused sub-modules:
- `TUIAgent` → `src/agents/tui/` (session, input, output, menu, step dispatch)
- `ElectronUIAgent` → `src/agents/electron/` (launcher, interactor, performance, websocket)
- `WebSocketAgent` → `src/agents/websocket/` (connection, message handler, event recorder)
- `CLIAgent` → `src/agents/cli/` (command runner, output parser)
- `APIAgent` → `src/agents/api/` (request executor, response validator, auth handler)
- `IssueReporter` → `src/agents/issue/` (formatter, submitter, deduplicator)
- `ComprehensionAgent` → `src/agents/comprehension/` (documentation loader, output comprehender, scenario comprehender)
- `PriorityAgent` → `src/agents/priority/` (analyzer, queue, pattern extractor)
- `SystemAgent` → `src/agents/system/` (metrics, docker, filesystem, analyzer)

### Core Layer (`src/core/`)
- `PtyTerminal` - PTY process management
- `AdaptiveWaiter` - Intelligent wait/retry
- `ProcessLifecycleManager` - Process tracking and cleanup
- `ResourceOptimizer` → `src/core/optimizer/` (memory, CPU, concurrency)

### Utilities (`src/utils/`)
- `src/utils/files/` - File operations
- `src/utils/config/` - Configuration management
- `src/utils/yaml/` - YAML parsing
- `src/utils/retry/` - Retry + circuit breaker
- `src/utils/logging/` - Log formatting and transport
- `src/utils/screenshot/` - Screenshot capture and comparison

### Programmatic API
Side-effect-free API for embedding in other tools. Import from `@gadugi/agentic-test` via `src/lib.ts`. See [API Reference](./API_REFERENCE.md).

> Full architecture details: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## 🚀 Installation

### Prerequisites

**Runtime Requirements:**
- Node.js 20+
- Playwright browsers (`npx playwright install`)
- Git CLI (for issue reporting)
- OpenAI API key (for AI-powered features)

**Build Requirements (for native modules):**

This package uses `node-pty` for terminal emulation, which requires native compilation:

**macOS:**
```bash
xcode-select --install  # Command Line Tools
```

**Ubuntu/Debian:**
```bash
sudo apt-get install -y build-essential python3
```

**RHEL/Fedora:**
```bash
sudo dnf install -y gcc-c++ make python3
```

**Windows:**
```powershell
# Option 1: Install Visual Studio Build Tools
npm install -g windows-build-tools

# Option 2: Use Visual Studio Installer
# Select "Desktop development with C++" workload
```

### From NPM (Recommended)
```bash
# Install globally for CLI access
npm install -g @gadugi/agentic-test

# Or install locally in your project
npm install @gadugi/agentic-test
```

### From GitHub (Development)
```bash
# Clone the repository
git clone https://github.com/rysweet/gadugi-agentic-test.git
cd gadugi-agentic-test

# Install dependencies
npm install

# Build the framework
npm run build

# Run tests
npm test
```

## 🎯 Quick Start

### 1. Basic Electron App Testing

```typescript
import { ElectronUIAgent } from '@gadugi/agentic-test';

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

## 🖥️ Terminal UI (TUI) Testing Revolution

Gadugi's **TUI Testing** capabilities represent a paradigm shift in how we test terminal applications, command-line tools, and text-based interfaces. Unlike traditional approaches that rely on brittle scripts and fixed expectations, Gadugi's intelligent agents understand terminal behavior, adapt to dynamic output, and provide human-like interaction with TUI applications.

### Why TUI Testing Matters

Terminal User Interfaces are everywhere:
- **CLI Tools**: Git, npm, kubectl, terraform
- **Interactive Applications**: Database CLIs, monitoring tools, setup wizards
- **Development Tools**: REPL environments, build systems, deployment scripts
- **System Administration**: System configuration, log analysis, service management

Traditional TUI testing faces unique challenges:
- **Dynamic Output**: Progress bars, timestamps, varying data
- **Interactive Prompts**: User input required at runtime
- **Color/Formatting**: ANSI codes, complex terminal formatting
- **Timing Dependencies**: Network calls, file operations, async processes

### Gadugi's Intelligent TUI Testing

Our CLIAgent provides revolutionary capabilities for testing terminal applications:

#### 🧠 **Smart Output Parsing**
Gadugi understands terminal output context, not just text matching:

```yaml
name: "Intelligent Git Status Parsing"
steps:
  - name: "Check Repository Status"
    agent: "cli-agent"
    action: "execute"
    params:
      command: "git status"
    expect:
      type: "smart_parse"
      conditions:
        - branch_info: "present"
        - uncommitted_changes: "any"  # Flexible expectation
        - output_format: "git_status" # Understands git output structure
```

#### ⚡ **Interactive Session Management**
Handle complex interactive scenarios with ease:

```yaml
name: "Interactive Database Setup"
steps:
  - name: "MySQL Configuration Wizard"
    agent: "cli-agent"
    action: "interactive_session"
    params:
      command: "mysql_secure_installation"
      interactions:
        - expect: "Enter current password"
          send: "${CURRENT_MYSQL_PASSWORD}"
        - expect: "Set root password"
          send: "y"
        - expect: "New password"
          send: "${NEW_MYSQL_PASSWORD}"
        - expect: "Remove anonymous users"
          send: "y"
        - expect: "Disallow root login remotely"
          send: "y"
        - expect: "Remove test database"
          send: "y"
        - expect: "Reload privilege tables"
          send: "y"
      timeout: 120000
```

#### 🎨 **Visual Progress Monitoring**
Track progress bars, spinners, and dynamic output:

```yaml
name: "Package Installation with Progress Tracking"
steps:
  - name: "Install Large Package"
    agent: "cli-agent"
    action: "execute_with_monitoring"
    params:
      command: "npm install @tensorflow/tfjs"
      monitor:
        progress_indicators: true
        expected_patterns:
          - "downloading"
          - "extracting"
          - "building"
          - "completed"
        failure_patterns:
          - "ENOSPC"
          - "permission denied"
          - "network error"
      timeout: 600000  # 10 minutes for large installs
```

### Real-World TUI Testing Examples

#### Example 1: Kubernetes Deployment Testing

Test complex kubectl operations with intelligent validation:

```yaml
name: "Kubernetes Deployment Validation"
description: "Test complete K8s deployment workflow with intelligent monitoring"

agents:
  - name: "k8s-agent"
    type: "cli"
    config:
      workingDirectory: "./k8s-manifests"
      environmentVars:
        KUBECONFIG: "${KUBECONFIG_PATH}"

steps:
  # Apply deployment
  - name: "Deploy Application"
    agent: "k8s-agent"
    action: "execute"
    params:
      command: "kubectl apply -f deployment.yaml"
    expect:
      type: "contains"
      patterns:
        - "deployment.apps/myapp created"
        - "service/myapp created"

  # Monitor rollout with intelligent waiting
  - name: "Wait for Deployment Ready"
    agent: "k8s-agent"
    action: "execute_with_retry"
    params:
      command: "kubectl rollout status deployment/myapp"
      retry_until:
        success_pattern: "deployment \"myapp\" successfully rolled out"
        failure_patterns:
          - "failed"
          - "timeout"
        max_attempts: 20
        retry_delay: 15000

  # Validate with smart output parsing
  - name: "Verify Pod Status"
    agent: "k8s-agent"
    action: "execute"
    params:
      command: "kubectl get pods -l app=myapp -o wide"
    validate:
      type: "smart_parse"
      expected_state:
        pod_count: 3
        all_ready: true
        status: "Running"
        restarts: "≤ 2"  # Allow some restarts

  # Test application endpoint
  - name: "Port Forward and Test"
    agent: "k8s-agent"
    action: "background_process"
    params:
      command: "kubectl port-forward svc/myapp 8080:80"
      run_in_background: true

  - name: "Test Application Response"
    agent: "k8s-agent"
    action: "execute"
    params:
      command: "curl -f http://localhost:8080/health"
      timeout: 30000
    expect:
      type: "json_response"
      expected:
        status: "healthy"
        service: "myapp"

cleanup:
  - name: "Cleanup Deployment"
    agent: "k8s-agent"
    action: "execute"
    params:
      command: "kubectl delete -f deployment.yaml"
```

#### Example 2: Git Workflow Testing

Test complex Git operations with branching, merging, and conflict resolution:

```yaml
name: "Git Workflow Integration Test"
description: "Test complete Git workflow including merge conflicts"

agents:
  - name: "git-agent"
    type: "cli"
    config:
      workingDirectory: "./test-repo"

steps:
  # Setup test repository
  - name: "Initialize Test Repository"
    agent: "git-agent"
    action: "multi_command"
    params:
      commands:
        - "git init ."
        - "git config user.email 'test@example.com'"
        - "git config user.name 'Test User'"
        - "echo 'Initial content' > README.md"
        - "git add README.md"
        - "git commit -m 'Initial commit'"

  # Create feature branch
  - name: "Create Feature Branch"
    agent: "git-agent"
    action: "execute"
    params:
      command: "git checkout -b feature/new-feature"

  # Make changes
  - name: "Add Feature Code"
    agent: "git-agent"
    action: "multi_command"
    params:
      commands:
        - "echo 'Feature code here' >> feature.txt"
        - "git add feature.txt"
        - "git commit -m 'Add new feature'"

  # Simulate conflict scenario
  - name: "Create Conflicting Changes on Main"
    agent: "git-agent"
    action: "multi_command"
    params:
      commands:
        - "git checkout main"
        - "echo 'Different content' >> README.md"
        - "git add README.md"
        - "git commit -m 'Update README on main'"

  # Test merge with conflict resolution
  - name: "Attempt Merge with Conflict"
    agent: "git-agent"
    action: "execute"
    params:
      command: "git merge feature/new-feature"
    expect:
      type: "contains"
      patterns:
        - "CONFLICT"
        - "Automatic merge failed"

  # Intelligent conflict resolution
  - name: "Resolve Conflict"
    agent: "git-agent"
    action: "interactive_session"
    params:
      command: "git mergetool"
      interactions:
        - expect: "Use merge tool"
          send: "y"
        - expect: "Continue merging"
          send: "y"
      timeout: 30000

  - name: "Complete Merge"
    agent: "git-agent"
    action: "execute"
    params:
      command: "git commit --no-edit"

  # Validate final state
  - name: "Verify Repository State"
    agent: "git-agent"
    action: "execute"
    params:
      command: "git log --oneline --graph"
    validate:
      type: "smart_parse"
      expected_structure:
        merge_commit: true
        feature_branch_merged: true
        commit_count: "≥ 3"
```

#### Example 3: Database CLI Testing

Test database operations with dynamic data and transaction handling:

```yaml
name: "Database CLI Operations Test"
description: "Test PostgreSQL CLI operations with data validation"

agents:
  - name: "psql-agent"
    type: "cli"
    config:
      environmentVars:
        PGPASSWORD: "${TEST_DB_PASSWORD}"

steps:
  # Connect and create test database
  - name: "Create Test Database"
    agent: "psql-agent"
    action: "execute"
    params:
      command: "createdb -h localhost -U testuser testdb"

  # Interactive SQL session
  - name: "Run SQL Commands"
    agent: "psql-agent"
    action: "interactive_session"
    params:
      command: "psql -h localhost -U testuser testdb"
      interactions:
        - expect: "testdb=#"
          send: "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100));"
        - expect: "CREATE TABLE"
          send: "INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie');"
        - expect: "INSERT 0 3"
          send: "SELECT COUNT(*) FROM users;"
        - expect: "3"
          send: "\\q"

  # Validate data with smart parsing
  - name: "Verify Data"
    agent: "psql-agent"
    action: "execute"
    params:
      command: "psql -h localhost -U testuser testdb -c 'SELECT * FROM users;'"
    validate:
      type: "table_output"
      expected:
        row_count: 3
        columns: ["id", "name"]
        contains_data:
          - name: "Alice"
          - name: "Bob"
          - name: "Charlie"

  # Test transaction handling
  - name: "Test Transaction Rollback"
    agent: "psql-agent"
    action: "interactive_session"
    params:
      command: "psql -h localhost -U testuser testdb"
      interactions:
        - expect: "testdb=#"
          send: "BEGIN;"
        - expect: "BEGIN"
          send: "INSERT INTO users (name) VALUES ('David');"
        - expect: "INSERT 0 1"
          send: "ROLLBACK;"
        - expect: "ROLLBACK"
          send: "SELECT COUNT(*) FROM users;"
        - expect: "3"  # Should still be 3, not 4
          send: "\\q"

cleanup:
  - name: "Drop Test Database"
    agent: "psql-agent"
    action: "execute"
    params:
      command: "dropdb -h localhost -U testuser testdb"
```

### Advanced TUI Testing Features

#### Smart Retry Mechanisms

Gadugi's CLIAgent includes intelligent retry logic for unreliable operations:

```yaml
- name: "Flaky Network Operation"
  agent: "cli-agent"
  action: "execute_with_retry"
  params:
    command: "curl -f https://api.example.com/status"
    retry_strategy:
      max_attempts: 5
      backoff: "exponential"  # 1s, 2s, 4s, 8s, 16s
      retry_on:
        - exit_code: [6, 7, 28]  # Network errors
        - output_contains: ["timeout", "connection refused"]
      success_criteria:
        - exit_code: 0
        - output_contains: ["status", "ok"]
```

#### Environment Variable Management

Dynamic environment handling for different test contexts:

```yaml
- name: "Context-Aware Testing"
  agent: "cli-agent"
  action: "execute"
  params:
    command: "kubectl get pods"
    environment:
      KUBECONFIG: "${TEST_KUBECONFIG}"
      KUBECTL_NAMESPACE: "test-namespace"
    context_validation:
      pre_check:
        - command: "kubectl config current-context"
          expected: "test-cluster"
      post_check:
        - command: "kubectl config view --minify"
          validate: "context_is_test"
```

#### Output Stream Management

Handle complex output patterns and real-time monitoring:

```yaml
- name: "Monitor Build Process"
  agent: "cli-agent"
  action: "stream_monitor"
  params:
    command: "docker build -t myapp ."
    stream_handling:
      stdout_patterns:
        success: ["Successfully built", "Successfully tagged"]
        progress: ["Step \\d+/\\d+", "\\d+%\\|"]
        warnings: ["WARNING:", "DEPRECATED"]
        errors: ["ERROR:", "failed", "permission denied"]
      realtime_callbacks:
        - pattern: "Step \\d+"
          action: "log_progress"
        - pattern: "ERROR"
          action: "capture_context"
          context_lines: 10
```

### TUI Testing Best Practices

#### 1. **Use Semantic Expectations**
Instead of exact text matching, use semantic understanding:

```yaml
# ❌ Brittle: Exact match
expect:
  type: "exact"
  text: "Files: 123, Errors: 0, Duration: 45.2s"

# ✅ Robust: Semantic match
expect:
  type: "semantic"
  meaning: "test_completion_success"
  contains:
    - file_count: "> 0"
    - error_count: "0"
    - duration: "< 60s"
```

#### 2. **Handle Dynamic Content**
Account for timestamps, IDs, and varying output:

```yaml
validate:
  type: "pattern_match"
  patterns:
    - "Container ID: [a-f0-9]{12}"  # Docker container ID
    - "Timestamp: \\d{4}-\\d{2}-\\d{2}"  # ISO date
    - "Memory: \\d+\\.\\d+MB"  # Dynamic memory usage
```

#### 3. **Test Error Conditions**
Validate error handling and recovery:

```yaml
- name: "Test Network Failure Handling"
  agent: "cli-agent"
  action: "execute"
  params:
    command: "npm install --registry=http://invalid-url"
  expect:
    type: "error_handling"
    error_patterns:
      - "network error"
      - "ENOTFOUND"
    recovery_behavior:
      - "retry attempted"
      - "fallback to cache"
```

#### 4. **Performance Validation**
Monitor command execution performance:

```yaml
- name: "Performance-Critical Operation"
  agent: "cli-agent"
  action: "execute"
  params:
    command: "large-data-processing-command"
  performance:
    max_duration: 30000  # 30 seconds
    memory_limit: "512MB"
    cpu_threshold: 80  # 80% CPU usage
```

### Integration with Popular Tools

Gadugi provides built-in support for common CLI tools:

#### **Docker/Kubernetes**
```yaml
# Specialized Docker agent configuration
agents:
  - name: "docker-agent"
    type: "cli"
    specialization: "docker"
    config:
      docker_host: "unix:///var/run/docker.sock"
      registry: "private-registry.com"
```

#### **Git Operations**
```yaml
# Git-aware testing with intelligent parsing
agents:
  - name: "git-agent"
    type: "cli"
    specialization: "git"
    config:
      author: "Test Suite <test@example.com>"
      gpg_signing: false
```

#### **Package Managers**
```yaml
# NPM/Yarn specialized handling
agents:
  - name: "npm-agent"
    type: "cli"
    specialization: "npm"
    config:
      registry: "https://registry.npmjs.org/"
      cache_dir: "./npm-cache"
```

### Why Choose Gadugi for TUI Testing?

#### **Traditional Approach:**
```bash
# Brittle, exact matching
expect "Database connection established"
send "SELECT * FROM users;\r"
expect "3 rows returned"
```

#### **Gadugi Approach:**
```yaml
# Intelligent, adaptive
- action: "database_query"
  params:
    query: "SELECT * FROM users"
  expect:
    type: "tabular_data"
    validation:
      row_count: 3
      schema_valid: true
      data_quality: "high"
```

**Key Advantages:**
- 🎯 **Semantic Understanding**: Tests understand intent, not just text
- 🔄 **Self-Healing**: Adapts to minor output changes
- 📊 **Rich Validation**: Goes beyond text matching to validate data structure
- 🚀 **Performance Aware**: Monitors execution characteristics
- 🔍 **Context Aware**: Understands the environment and tool being tested

Start testing your terminal applications intelligently with Gadugi's revolutionary TUI testing capabilities!

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
git clone https://github.com/rysweet/gadugi-agentic-test.git
cd gadugi-agentic-test

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

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](./GETTING_STARTED.md) | Installation and first test |
| [API Reference](./API_REFERENCE.md) | Complete API documentation |
| [Architecture](./docs/ARCHITECTURE.md) | System design and module structure |
| [Contributing](./CONTRIBUTING.md) | Development setup and contribution guide |
| [Changelog](./CHANGELOG.md) | Version history |
| [Troubleshooting](./TROUBLESHOOTING.md) | Common issues and solutions |
| [Screenshot Diffing](./docs/screenshot-diff-guide.md) | Visual regression guide |
| [Scenarios](./scenarios/README.md) | Writing test scenarios |

## 🙏 Acknowledgments

- **Cherokee Nation** - For inspiration behind the "Gadugi" name representing cooperative spirit
- **Playwright Team** - For excellent browser automation capabilities
- **AutoGen/Magentic-One** - For multi-agent orchestration patterns
- **Open Source Community** - For the original use case and testing requirements

---

*Built with the Gadugi cooperative spirit. Ready to revolutionize your testing workflow with intelligent agents working in harmony.*
