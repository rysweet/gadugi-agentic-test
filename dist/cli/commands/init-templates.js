"use strict";
/**
 * Template generators for the `init` command.
 * Separated to keep init.ts under 300 LOC.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigTemplate = getConfigTemplate;
exports.getEnvTemplate = getEnvTemplate;
exports.getScenarioTemplates = getScenarioTemplates;
exports.getPackageJsonTemplate = getPackageJsonTemplate;
exports.getReadmeTemplate = getReadmeTemplate;
exports.getGitignoreTemplate = getGitignoreTemplate;
const path = __importStar(require("path"));
function getConfigTemplate(template) {
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
  workingDirectory: ${process.cwd()}
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
function getEnvTemplate() {
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
function getScenarioTemplates(template) {
    const templates = {};
    templates['example-basic.yaml'] = `id: example-basic
name: Basic Example Test
description: A simple test scenario to demonstrate basic functionality
priority: MEDIUM
interface: CLI
prerequisites: []
tags: [example, basic]
steps:
  - action: run
    target: version
    description: Check version
    expected: success
verifications:
  - type: output
    target: stdout
    expected: "version"
    operator: contains
    description: Version output should contain version info
estimatedDuration: 30
enabled: true
`;
    if (template === 'electron' || template === 'advanced') {
        templates['example-ui.yaml'] = `id: example-ui
name: UI Interaction Test
description: Test user interface interactions
priority: HIGH
interface: UI
prerequisites: []
tags: [ui, interaction, ${template}]
steps:
  - action: click
    target: "#start-button"
    description: Click the start button
    waitFor: 1000
  - action: type
    target: "#input-field"
    value: "test input"
    description: Enter test data
  - action: click
    target: "#submit-button"
    description: Submit the form
    waitFor: 2000
verifications:
  - type: element
    target: "#result-message"
    expected: "Success"
    operator: contains
    description: Success message should appear
estimatedDuration: 60
enabled: true
`;
    }
    if (template === 'advanced') {
        templates['example-integration.yaml'] = `id: example-integration
name: Integration Test Suite
description: Complex integration test with multiple steps
priority: CRITICAL
interface: CLI
prerequisites: ["database-setup", "api-server"]
tags: [integration, api, database, advanced]
environment:
  TEST_MODE: integration
  API_URL: http://localhost:3000/api
steps:
  - action: run
    target: "setup"
    description: Setup test environment
    timeout: 10000
  - action: run
    target: "test-api"
    description: Test API endpoints
    timeout: 30000
  - action: run
    target: "test-database"
    description: Test database operations
    timeout: 15000
verifications:
  - type: output
    target: stdout
    expected: "All tests passed"
    operator: contains
    description: All integration tests should pass
  - type: file
    target: "./reports/integration-results.json"
    expected: true
    operator: exists
    description: Integration report should be generated
cleanup:
  - action: run
    target: "cleanup"
    description: Clean up test environment
estimatedDuration: 180
enabled: true
`;
    }
    return templates;
}
function getPackageJsonTemplate(projectName) {
    return JSON.stringify({
        name: projectName,
        version: '1.0.0',
        description: 'Agentic testing project',
        scripts: {
            test: 'agentic-test run',
            'test:watch': 'agentic-test watch',
            'test:validate': 'agentic-test validate',
            'test:list': 'agentic-test list',
            lint: 'echo "Add your linting command here"',
            start: 'echo "Add your start command here"',
        },
        dependencies: {
            '@azure-tenant-grapher/agentic-testing': '^1.0.0',
        },
        devDependencies: {},
        keywords: ['testing', 'agentic', 'automation'],
        author: '',
        license: 'MIT',
    }, null, 2);
}
function getReadmeTemplate(template) {
    const projectName = path.basename(process.cwd());
    return `# ${projectName} - Agentic Testing Project

This project was initialized with the Agentic Testing System using the **${template}** template.

## Getting Started

### Prerequisites

- Node.js (>= 18.0.0)
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
agentic-test run --scenario example-basic

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
- Enable debug logging: \`agentic-test run --debug\`
- Validate scenario syntax: \`agentic-test validate --strict\`

For more information, see the [Agentic Testing System documentation](https://github.com/Azure/azure-tenant-grapher).
`;
}
function getGitignoreTemplate() {
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
//# sourceMappingURL=init-templates.js.map