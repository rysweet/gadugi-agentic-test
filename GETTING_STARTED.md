# Getting Started with Gadugi Agentic Test

> **Gadugi** (ᎦᏚᎩ) - Cherokee word meaning "cooperative spirit" - perfectly embodies this framework where intelligent agents work together to test complex applications.

Welcome to Gadugi Agentic Test! This guide will walk you through setting up and running your first intelligent test scenarios. Whether you're testing Electron applications, CLI tools, or complex web interfaces, our multi-agent system will revolutionize your testing approach.

## Table of Contents

1. [Quick Start (5 minutes)](#quick-start-5-minutes)
2. [Installation](#installation)
3. [First Test Scenario](#first-test-scenario)
4. [Understanding Agents](#understanding-agents)
5. [YAML Test Scenarios](#yaml-test-scenarios)
6. [Running Tests](#running-tests)
7. [Next Steps](#next-steps)

---

## Quick Start (5 minutes)

Get up and running with a simple test in under 5 minutes:

```bash
# 1. Clone and setup
git clone https://github.com/rysweet/gadugi-agentic-test.git
cd gadugi-agentic-test
npm install

# 2. Set environment variables
export ELECTRON_APP_PATH="/path/to/your/electron/app"
export GITHUB_TOKEN="your_github_token_optional"

# 3. Run a sample test
npm run build
npm start -- run scenarios/sample-ui-workflow.yaml
```

**That's it!** Your first intelligent test is running. Watch as multiple AI agents coordinate to test your application.

---

## Installation

### Prerequisites

Before installing Gadugi, ensure you have:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Python 3.11+** - For orchestration components
- **Git CLI** - For issue reporting features
- **An Electron application** - To test (or use our demo app)

### Step 1: Install Gadugi

#### Option A: From Source (Recommended)
```bash
# Clone the repository
git clone https://github.com/rysweet/gadugi-agentic-test.git
cd gadugi-agentic-test

# Install dependencies
npm install

# Build the framework
npm run build

# Verify installation
npm test
```

#### Option B: Global Installation (Coming Soon)
```bash
# NPM package publishing planned for v1.1.0
npm install -g @gadugi/agentic-test
```

### Step 2: Install Playwright Browsers

Gadugi uses Playwright for Electron testing:

```bash
# Install browser dependencies
npx playwright install
```

### Step 3: Environment Setup

Create a `.env` file in your project root:

```bash
# Required
ELECTRON_APP_PATH=/path/to/your/electron/app.exe

# Optional - Enhanced Features
GITHUB_TOKEN=ghp_your_github_token_here
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_KEY=your_azure_openai_key
OPENAI_API_KEY=your_openai_key_alternative

# Optional - Configuration
GADUGI_LOG_LEVEL=info
GADUGI_HEADLESS=false
GADUGI_TIMEOUT_MULTIPLIER=1.0
GADUGI_PARALLEL_AGENTS=3
```

### Step 4: Verify Installation

```bash
# Check that everything is working
npx gadugi-test --version
npx gadugi-test --help

# Test with a sample scenario
npx gadugi-test run scenarios/sample-ui-workflow.yaml --dry-run
```

---

## First Test Scenario

Let's create your first test scenario step by step.

### Step 1: Create a Simple YAML Test

Create a file called `my-first-test.yaml`:

```yaml
name: "My First Gadugi Test"
description: "A simple test to verify the application launches"
version: "1.0.0"

# Define the agents we'll use
agents:
  - name: "ui-agent"
    type: "ui"
    config:
      executablePath: "${ELECTRON_APP_PATH}"
      headless: false
      screenshotConfig:
        mode: "only-on-failure"
        directory: "./screenshots"

# Test steps
steps:
  - name: "Launch Application"
    agent: "ui-agent"
    action: "launch_electron"
    timeout: 20000

  - name: "Take Initial Screenshot"
    agent: "ui-agent"
    action: "screenshot"
    params:
      name: "app_launched"

  - name: "Wait and Verify App is Responsive"
    agent: "ui-agent"
    action: "wait"
    params:
      duration: 2000

# Clean up
cleanup:
  - name: "Close Application"
    agent: "ui-agent"
    action: "close_app"

# Test metadata
metadata:
  tags: ["smoke", "basic", "launch"]
  priority: "high"
```

### Step 2: Run Your First Test

```bash
# Run the test
npx gadugi-test run my-first-test.yaml

# Run with verbose logging
npx gadugi-test run my-first-test.yaml --log-level debug

# Run and generate detailed reports
npx gadugi-test run my-first-test.yaml --reports ./test-reports/
```

### Step 3: View Results

After the test runs, you'll see:

```
🚀 Gadugi Agentic Test v1.0.0
📋 Session ID: abc123-def456-ghi789

Phase 1: Discovery ✅
  └── Loaded 1 test scenario

Phase 2: Execution ✅
  └── My First Gadugi Test: PASSED (5.2s)

Phase 3: Analysis ✅
  └── No failures to analyze

Phase 4: Reporting ✅
  └── No issues to report

📊 Session Summary:
  ✅ Total: 1 | ✅ Passed: 1 | ❌ Failed: 0 | ⏭️ Skipped: 0
  ⏱️ Duration: 5.2 seconds
  📸 Screenshots: 1 captured
  📁 Reports: ./test-reports/session_abc123.json
```

---

## Understanding Agents

Gadugi uses specialized AI agents that work together. Think of them as expert team members, each with unique skills:

### 🤖 ElectronUIAgent
**What it does:** Controls your Electron application like a human user would
**Capabilities:**
- Clicks buttons, fills forms, navigates UI
- Takes screenshots and monitors performance
- Handles dialogs and multi-window scenarios
- Real-time WebSocket monitoring

**Example:**
```yaml
- name: "Click Login Button"
  agent: "ui-agent"
  action: "click"
  params:
    selector: "[data-testid='login-btn']"
```

### ⌨️ CLIAgent
**What it does:** Executes and monitors command-line operations
**Capabilities:**
- Runs shell commands and scripts
- Monitors process output and exit codes
- Handles interactive CLI sessions
- Environment variable management

**Example:**
```yaml
- name: "Run Build Command"
  agent: "cli-agent"
  action: "execute"
  params:
    command: "npm run build"
    timeout: 60000
```

### 🧠 ComprehensionAgent
**What it does:** Uses AI to understand and generate tests
**Capabilities:**
- Analyzes application documentation
- Generates test scenarios automatically
- Identifies edge cases and potential issues
- Natural language test generation

### 🐛 IssueReporter
**What it does:** Automatically creates GitHub issues for failures
**Capabilities:**
- Detects duplicate issues
- Rich formatting with screenshots
- Automatic labeling and assignment
- Context-aware issue descriptions

### 📊 PriorityAgent
**What it does:** Intelligently prioritizes test failures
**Capabilities:**
- Impact assessment based on historical data
- Machine learning-based severity scoring
- Custom priority rules
- Trend analysis

---

## YAML Test Scenarios

YAML scenarios are the heart of Gadugi. They're human-readable, version-controllable, and powerful.

### Basic Structure

```yaml
name: "Test Name"
description: "What this test does"
version: "1.0.0"

# Configuration
config:
  timeout: 60000      # Global timeout
  retries: 2          # Retry failed steps
  parallel: false     # Run steps in sequence

# Environment setup
environment:
  requires:           # Required env vars
    - ELECTRON_APP_PATH
  optional:           # Optional env vars
    - GITHUB_TOKEN

# Agents to use
agents:
  - name: "agent-name"
    type: "ui"         # or "cli", "websocket", etc.
    config:
      # Agent-specific config

# Test steps
steps:
  - name: "Step Name"
    agent: "agent-name"
    action: "action_type"
    params:
      # Action parameters
    timeout: 30000     # Step timeout

# Cleanup actions
cleanup:
  - name: "Cleanup Action"
    agent: "agent-name"
    action: "close_app"

# Test metadata
metadata:
  tags: ["tag1", "tag2"]
  priority: "high"
```

### Advanced Features

#### Conditional Steps
```yaml
- name: "Check Login State"
  agent: "ui-agent"
  action: "wait_for_element"
  params:
    selector: "[data-testid='user-menu']"
    state: "visible"
  on_failure: "continue"  # Don't fail the whole test

- name: "Login if Needed"
  agent: "ui-agent"
  action: "click"
  params:
    selector: "[data-testid='login-btn']"
  condition:
    when: "previous_step_failed"
```

#### Multi-Agent Coordination
```yaml
- name: "Start Background Process"
  agent: "cli-agent"
  action: "execute"
  params:
    command: "npm run server"
    background: true

- name: "Test UI While Server Runs"
  agent: "ui-agent"
  action: "navigate"
  params:
    url: "http://localhost:3000"
  depends_on: "Start Background Process"
```

#### Data-Driven Tests
```yaml
- name: "Test Multiple Users"
  agent: "ui-agent"
  action: "loop"
  params:
    data:
      - username: "admin"
        password: "admin123"
      - username: "user1"
        password: "user123"
    steps:
      - action: "fill"
        params:
          selector: "[data-testid='username']"
          value: "${item.username}"
      - action: "fill"
        params:
          selector: "[data-testid='password']"
          value: "${item.password}"
      - action: "click"
        params:
          selector: "[data-testid='login']"
```

---

## Running Tests

Gadugi provides flexible ways to run your tests:

### Basic Execution

```bash
# Run a single test file
npx gadugi-test run my-test.yaml

# Run all tests in a directory
npx gadugi-test run ./tests/

# Run tests matching a pattern
npx gadugi-test run "./tests/**/*smoke*.yaml"
```

### Test Suites

```bash
# Run predefined test suites
npx gadugi-test run --suite smoke      # Quick smoke tests
npx gadugi-test run --suite regression # Full regression suite
npx gadugi-test run --suite full       # All tests

# Custom suites
npx gadugi-test run --suite my-suite --config gadugi.config.js
```

### Advanced Options

```bash
# Parallel execution
npx gadugi-test run --parallel 5 ./tests/

# Retry failed tests
npx gadugi-test run --retries 3 ./tests/

# Headless mode
npx gadugi-test run --headless ./tests/

# Custom timeout multiplier
npx gadugi-test run --timeout-multiplier 2.0 ./tests/

# Generate comprehensive reports
npx gadugi-test run --reports ./reports/ --format json,html ./tests/

# CI/CD mode (optimized for CI environments)
npx gadugi-test run --ci --artifacts ./artifacts/ ./tests/
```

### Configuration Files

Create `gadugi.config.js` for project-wide settings:

```javascript
export default {
  // Execution settings
  maxConcurrentAgents: 3,
  retryAttempts: 2,
  timeoutMultiplier: 1.0,

  // Logging
  logLevel: 'info',
  logFile: './logs/gadugi.log',

  // Artifacts
  artifactDirectory: './artifacts',
  screenshotDirectory: './screenshots',
  retainArtifacts: 7, // days

  // AI Integration
  llmProvider: 'azure-openai',
  llmDeployment: 'gpt-4',

  // GitHub Integration
  createIssues: true,
  repository: 'your-org/your-repo',

  // Test Suites
  suites: {
    'my-suite': ['smoke:', 'critical:'],
    'api-tests': ['api:*'],
    'ui-tests': ['ui:*']
  }
};
```

### CI/CD Integration

#### GitHub Actions
```yaml
name: Gadugi Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Install Playwright
        run: npx playwright install

      - name: Run Gadugi Tests
        run: npx gadugi-test run --ci --suite smoke ./tests/
        env:
          ELECTRON_APP_PATH: ./dist/app.exe
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: gadugi-reports
          path: ./reports/
```

#### Docker Support
```dockerfile
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Install your app
COPY . /app
WORKDIR /app
RUN npm install && npm run build

# Install Gadugi
RUN npm install -g @gadugi/agentic-test
RUN npx playwright install

# Run tests
CMD ["gadugi-test", "run", "--ci", "./tests/"]
```

---

## Next Steps

Congratulations! You've set up Gadugi and run your first intelligent test. Here's what to explore next:

### 📚 Learn More
- **[API Reference](./API_REFERENCE.md)** - Complete API documentation
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[Example Scenarios](./scenarios/)** - Ready-to-use test scenarios

### 🔧 Advanced Features
1. **Custom Agents** - Create specialized agents for your domain
2. **AI Test Generation** - Let ComprehensionAgent generate tests from docs
3. **Visual Regression** - Advanced screenshot comparison
4. **Performance Monitoring** - Real-time performance tracking
5. **WebSocket Testing** - Real-time event validation

### 🚀 Best Practices
1. **Start Small** - Begin with simple smoke tests
2. **Use Tags** - Organize tests with meaningful tags
3. **Environment Isolation** - Use separate environments for testing
4. **Monitor Trends** - Track test results over time
5. **Collaborate** - Share scenarios with your team

### 🤝 Get Help
- **GitHub Issues** - [Report bugs or request features](https://github.com/rysweet/gadugi-agentic-test/issues)
- **Discussions** - [Ask questions and share tips](https://github.com/rysweet/gadugi-agentic-test/discussions)
- **Documentation** - [Full documentation](./README.md)

### 💡 Pro Tips

1. **Use Data-Testid Attributes**
   ```html
   <!-- Good: Stable selector -->
   <button data-testid="login-btn">Login</button>

   <!-- Avoid: Fragile selectors -->
   <button class="btn btn-primary">Login</button>
   ```

2. **Leverage Environment Variables**
   ```yaml
   params:
     value: "${USER_EMAIL}" # Use env vars for test data
   ```

3. **Screenshot Everything Important**
   ```yaml
   - name: "Document Success State"
     agent: "ui-agent"
     action: "screenshot"
     params:
       name: "success_${timestamp}"
   ```

4. **Use Meaningful Test Names**
   ```yaml
   # Good
   name: "User can log in with valid credentials and access dashboard"

   # Avoid
   name: "Test 1"
   ```

5. **Tag for Organization**
   ```yaml
   metadata:
     tags: ["auth", "smoke", "critical", "api-v2"]
   ```

---

## Ready to Test Intelligently?

You now have everything you need to start testing with Gadugi's intelligent agents. The framework will learn and adapt as you use it, becoming more effective over time.

**What makes Gadugi special:**
- ✨ **Intelligent Agents** that understand your application
- 🔄 **Self-Healing Tests** that adapt to UI changes
- 📊 **Smart Prioritization** of failures
- 🤖 **Automated Issue Creation** with full context
- 🔍 **Advanced Visual Comparison** with multiple algorithms

Happy testing! 🎉

---

*Built with ❤️ by the Gadugi team. Ready to revolutionize your testing workflow with intelligent agents working in harmony.*