/**
 * Template generators for the `init` command.
 * Separated to keep init.ts under 300 LOC.
 */

import * as path from 'path';
import { packageMetadata } from '../../packageMetadata';

export function getConfigTemplate(template: string): string {
  return `# Agentic Testing System Configuration
# Template: ${template}

execution:
  maxParallel: ${template === 'advanced' ? 5 : 3}
  defaultTimeout: 30000
  continueOnFailure: true
  maxRetries: 2
  retryDelay: 1000

cli:
  executablePath: ${template === 'electron' ? 'npm run electron' : 'atg'}
  workingDirectory: ./
  defaultTimeout: 30000
  environment: {}
  captureOutput: true

ui:
  browser: chromium
  headless: false
  viewport:
    width: 1280
    height: 720
  baseUrl: ${template === 'electron' ? 'http://localhost:3000' : 'http://localhost:8080'}
  defaultTimeout: 30000
  screenshotDir: ./screenshots

logging:
  level: info
  console: true
  format: structured

reporting:
  outputDir: ./reports
  formats:
    - html
    - json
  includeScreenshots: true
  includeLogs: true
`;
}

export function getEnvTemplate(): string {
  return `# Environment Variables for Agentic Testing

# Azure Configuration
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Application Configuration
ELECTRON_APP_PATH=./dist/main.js
WEBSOCKET_URL=ws://localhost:3001
TEST_DATA_DIR=./test-data

# GitHub Integration (optional)
GITHUB_TOKEN=your-github-token
GITHUB_OWNER=your-username
GITHUB_REPO=your-repository

# Logging
LOG_LEVEL=info

# Agentic CLI Environment Variables
AGENTIC_LOG_LEVEL=info
AGENTIC_MAX_PARALLEL=3
AGENTIC_TIMEOUT=30000
AGENTIC_HEADLESS=false
AGENTIC_BROWSER=chromium
AGENTIC_BASE_URL=http://localhost:3000
AGENTIC_CLI_PATH=atg
AGENTIC_WORKING_DIR=.
AGENTIC_SCREENSHOT_DIR=./screenshots
AGENTIC_REPORT_DIR=./reports
`;
}

export function getScenarioTemplates(template: string): Record<string, string> {
  const templates: Record<string, string> = {};

  templates['example-basic.yaml'] = `name: "Basic Example Test"
description: "A simple cross-platform command test"
version: "1.0.0"
config:
  timeout: 30000
  retries: 0
  parallel: false
agents:
  - name: "system-agent"
    type: "system"
    config:
      workingDirectory: "."
      timeout: 10000
steps:
  - name: "Check Node.js version"
    agent: "system-agent"
    action: "execute_command"
    params:
      command: "node --version"
    expect:
      exit_code: 0
metadata:
  tags: ["example", "basic"]
  priority: "medium"
`;

  if (template === 'electron' || template === 'advanced') {
    templates['example-ui.yaml'] = `name: "UI Interaction Test"
description: "Demonstrates UI interaction syntax"
version: "1.0.0"
config:
  timeout: 60000
  retries: 1
  parallel: false
agents:
  - name: "ui-agent"
    type: "ui"
    config:
      browser: "chromium"
      headless: false
      viewport:
        width: 1280
        height: 720
      timeout: 30000
steps:
  - name: "Click the start button"
    agent: "ui-agent"
    action: "click"
    params:
      selector: "#start-button"
    wait_for:
      selector: "#input-field"
      state: "visible"
  - name: "Enter test data"
    agent: "ui-agent"
    action: "fill"
    params:
      selector: "#input-field"
      value: "test input"
  - name: "Submit the form"
    agent: "ui-agent"
    action: "click"
    params:
      selector: "#submit-button"
metadata:
  tags: ["ui", "interaction", "${template}"]
  priority: "high"
`;
  }

  if (template === 'advanced') {
    templates['example-integration.yaml'] = `name: "Integration Test Suite"
description: "Demonstrates a multi-step integration scenario"
version: "1.0.0"
config:
  timeout: 60000
  retries: 1
  parallel: false
agents:
  - name: "system-agent"
    type: "system"
    config:
      workingDirectory: "."
      timeout: 30000
steps:
  - name: "Inspect the runtime"
    agent: "system-agent"
    action: "execute_command"
    params:
      command: "node --version"
    timeout: 10000
  - name: "Inspect the package manager"
    agent: "system-agent"
    action: "execute_command"
    params:
      command: "npm --version"
    timeout: 10000
metadata:
  tags: ["integration", "advanced"]
  priority: "high"
`;
  }

  return templates;
}

export function getPackageJsonTemplate(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName,
      version: '1.0.0',
      description: 'Agentic testing project',
      scripts: {
        test: 'gadugi-test run',
        'test:watch': 'gadugi-test watch',
        'test:validate': 'gadugi-test validate',
        'test:list': 'gadugi-test list',
        lint: 'echo "Add your linting command here"',
        start: 'echo "Add your start command here"',
      },
      devDependencies: {
        '@gadugi/agentic-test': packageMetadata.version,
      },
      keywords: ['testing', 'agentic', 'automation'],
      author: '',
      license: 'MIT',
    },
    null,
    2
  );
}

export function getReadmeTemplate(template: string): string {
  const projectName = path.basename(process.cwd());
  return `# ${projectName} - Agentic Testing Project

This project was initialized with the Agentic Testing System using the **${template}** template.

## Getting Started

### Prerequisites

- Node.js (>= 20.0.0)
- npm or yarn

### Installation

\`\`\`bash
npm install
\`\`\`

### Configuration

1. Copy the environment template:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

2. Edit the \`.env\` file with your configuration values.

3. Modify \`agentic-test.config.yaml\` as needed for your project.

### Running Tests

\`\`\`bash
# Run all scenarios
npm test

# Run specific scenario
gadugi-test run --scenario example-basic

# Run in watch mode
npm run test:watch

# Validate scenarios
npm run test:validate

# List available scenarios
npm run test:list
\`\`\`

## Project Structure

- \`scenarios/\` - Test scenario definitions (YAML files)
- \`reports/\` - Generated test reports
- \`screenshots/\` - Screenshots captured during UI tests
- \`scripts/\` - Custom scripts and utilities
- \`temp/\` - Temporary files (auto-cleaned)

## Writing Scenarios

Scenarios are defined in YAML files in the \`scenarios/\` directory. See the example files for reference.

### Scenario Structure

\`\`\`yaml
id: unique-scenario-id
name: Human Readable Name
description: What this scenario tests
priority: CRITICAL | HIGH | MEDIUM | LOW
interface: CLI | UI
prerequisites: []
tags: [tag1, tag2]
steps:
  - action: action-type
    target: action-target
    value: optional-value
    description: What this step does
verifications:
  - type: verification-type
    target: what-to-check
    expected: expected-value
    operator: comparison-operator
    description: What this verifies
estimatedDuration: 60  # seconds
enabled: true
\`\`\`

## Contributing

1. Add new scenarios to the \`scenarios/\` directory
2. Validate your scenarios: \`npm run test:validate\`
3. Run your tests: \`npm test\`
4. Commit your changes

## Troubleshooting

- Check the \`reports/\` directory for detailed test results
- Enable debug logging: \`gadugi-test run --debug\`
- Validate scenario syntax: \`gadugi-test validate --strict\`

For more information, see the [Gadugi Agentic Test documentation](https://github.com/rysweet/gadugi-agentic-test).
`;
}

export function getGitignoreTemplate(): string {
  return `# Dependency directories
node_modules/

# Test outputs
reports/
screenshots/
temp/

# Logs
*.log
logs/

# Environment variables
.env
.env.local
.env.*.local

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
.nyc_output/

# Build outputs
dist/
build/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# TypeScript cache
*.tsbuildinfo

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity
`;
}
