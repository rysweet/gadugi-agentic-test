# Test Scenarios

This directory contains YAML-based test scenarios for the TypeScript Agentic Testing System. Each scenario defines comprehensive test workflows that can be executed by autonomous testing agents.

## Overview

Test scenarios are defined in YAML format and describe complex testing workflows that involve multiple agents working together. Use these scenarios with the `@gadugi/agentic-test` framework (`gadugi-test` CLI) to orchestrate agents that test Electron apps, CLI tools, and TUI applications.

## Scenario Files

### Core Test Scenarios

1. **cli-tests.yaml** - CLI Command Testing
   - Tests all core CLI commands (`atg --version`, `atg --help`, `atg build`, etc.)
   - Validates error handling for missing parameters
   - Tests command validation and help systems

2. **ui-navigation.yaml** - UI Navigation Testing
   - Tests navigation through all application tabs
   - Verifies UI components load correctly
   - Tests tab switching and state management

3. **ui-workflows.yaml** - Complete UI Workflows
   - End-to-end workflow testing for all major operations
   - Tests Build, Generate Spec, Generate IaC, Configuration workflows
   - Includes WebSocket communication testing

4. **error-handling.yaml** - Error Scenario Testing
   - Tests application behavior under various error conditions
   - Validates error messages and recovery mechanisms
   - Tests network failures, invalid inputs, and timeout scenarios

5. **integration-tests.yaml** - Integration Testing
   - Tests CLI-UI synchronization
   - WebSocket communication validation
   - Neo4j database integration testing
   - Azure API interaction testing

## Scenario File Structure

Each YAML scenario file follows this standard structure:

```yaml
# Scenario metadata
name: "Descriptive Scenario Name"
description: "Detailed description of what this scenario tests"
version: "1.0.0"

# Test configuration
config:
  timeout: 120000      # Maximum time for entire scenario (ms)
  retries: 2           # Number of retries on failure
  parallel: false      # Whether steps can run in parallel

# Environment requirements
environment:
  requires:            # Required environment variables
    - REQUIRED_VAR_1
    - REQUIRED_VAR_2
  optional:            # Optional environment variables
    - OPTIONAL_VAR_1

# Agent definitions
agents:
  - name: "agent-name"
    type: "agent-type"  # ui, cli, system, websocket, database, api, network
    config:
      # Agent-specific configuration

# Test execution steps
steps:
  - name: "Step Description"
    agent: "agent-name"
    action: "action-name"
    params:
      # Action parameters
    expect:
      # Expected outcomes
    timeout: 30000
    wait_for:
      # Conditions to wait for
      
# Validation assertions
assertions:
  - name: "Assertion Description"
    type: "assertion-type"
    agent: "agent-name"
    params:
      # Assertion parameters
      
# Cleanup actions
cleanup:
  - name: "Cleanup Description"
    agent: "agent-name"
    action: "cleanup-action"
    
# Metadata
metadata:
  tags: ["tag1", "tag2"]
  priority: "high"
  author: "author-name"
  created: "ISO-date"
  updated: "ISO-date"
```

## Agent Types

### UI Agent (`type: "ui"`)
Handles Electron application interactions via Playwright.

**Configuration:**
```yaml
config:
  browser: "chromium"     # Browser engine
  headless: false         # Run with or without UI
  viewport:
    width: 1280
    height: 720
  timeout: 30000
  slowMo: 500            # Slow down actions for stability
```

**Common Actions:**
- `launch_electron` - Launch Electron application
- `click` - Click on elements
- `fill` - Fill form inputs
- `wait_for_element` - Wait for element states
- `multi_action` - Execute multiple actions sequentially
- `execute_script` - Run JavaScript in the browser context
- `close_app` - Close the application

### System Agent (`type: "system"`)
Executes command-line operations and system interactions.

**Configuration:**
```yaml
config:
  shell: "bash"           # Shell to use
  workingDirectory: "/path/to/directory"
  cwd: "/path/to/directory"  # Scenario-compatible alias
  timeout: 60000
  capture_output: true    # Capture stdout/stderr
```

**Common Actions:**
- `execute_command` - Execute shell commands
- `check_process` - Check if processes are running
- `file_operations` - File system operations

### CLI Agent (`type: "cli"`)
Executes command-line test steps and validates stdout, stderr, exit codes, and timeouts.

**Configuration:**
```yaml
config:
  shell: "bash"
  workingDirectory: "/path/to/project"  # Canonical command cwd
  cwd: "/path/to/project"               # Alias for scenario compatibility
  timeout: 60000
  environmentVars:
    NODE_ENV: "test"
```

**Common Actions:**
- `run` - Run a command and validate its output
- `execute` - Execute a command step
- `multi_command` - Execute multiple commands in sequence
- `execute_with_retry` - Retry a command until it succeeds or reaches a limit
- `background_process` - Start a long-running command for later validation or cleanup

### WebSocket Agent (`type: "websocket"`)
Manages WebSocket connections and real-time communication.

**Configuration:**
```yaml
config:
  url: "ws://localhost:3001"
  reconnect: true
  timeout: 10000
```

**Common Actions:**
- `connect` - Establish WebSocket connection
- `listen` - Listen for specific events
- `send_message` - Send messages
- `disconnect` - Close connections

### Database Agent (`type: "database"`)
Handles database operations and testing.

**Configuration:**
```yaml
config:
  type: "neo4j"
  host: "localhost"
  port: "7687"
  auth:
    username: "neo4j"
    password: "${NEO4J_PASSWORD}"
  timeout: 15000
```

**Common Actions:**
- `connect` - Connect to database
- `execute_query` - Run database queries
- `stress_test` - Performance testing
- `disconnect` - Close connections

### API Agent (`type: "api"`)
Tests REST API endpoints and external service integrations.

**Configuration:**
```yaml
config:
  timeout: 30000
  retry_count: 3
```

**Common Actions:**
- `authenticate_azure` - Azure authentication
- `call_api` - HTTP API calls
- `test_endpoints` - Endpoint validation

### Network Agent (`type: "network"`)
Simulates network conditions and failures.

**Configuration:**
```yaml
config:
  can_simulate_failures: true
  timeout: 10000
```

**Common Actions:**
- `block_port` - Block network ports
- `unblock_port` - Restore network access
- `simulate_latency` - Add network delays

## Legacy CLI Scenario Format (`scenarios:` array)

gadugi-test supports a compact "legacy" YAML format used by external projects (e.g. amplihack-rs test suites). This format uses a top-level `scenarios:` array instead of the canonical single-scenario structure. **All scenarios in the array are loaded and executed** — not just the first one.

### Format Structure

```yaml
name: my-test-suite
description: Suite-level description
type: cli                              # suite type: "cli" or "tui"
version: "1.0.0"
tags: [smoke, install]

application:
  timeout: 120                         # seconds — converted to ms internally

scenarios:
  - name: first-test
    description: First test in the suite
    steps:
      - type: command
        command: echo "hello world"
        expected_output: "hello world"

  - name: second-test
    description: Second test in the suite
    steps:
      - type: command
        command: npm --version
        expected_output: ""             # any non-error exit
```

### How Legacy Conversion Works

When `ScenarioLoader.loadFromFile()` detects a `scenarios:` array at the top level, it converts **every** entry into a full `ScenarioDefinition`:

| Legacy field | Canonical equivalent | Notes |
|---|---|---|
| Top-level `type: cli` | `agents: [{ name: 'cli-agent', type: 'cli', config: {} }]` | `type: tui` (or omitted) produces a `tui-agent` instead |
| Top-level `version` | `version` on each scenario | Propagated to all scenarios in the array |
| `application.timeout` (seconds) | `config.timeout` (milliseconds) | Multiplied by 1000; defaults to 120000ms |
| Scenario `name` | `name` | Falls back to suite-level `name` |
| Scenario `description` | `description` | Falls back to suite-level `description` |
| Step `type: command` | `action: 'command'` | The step type determines the action |
| Step `command` | `target` + `params.command` | The command string is set as the direct `target` on the step |
| Step `expected_output` | `expected` | Stored directly on the `TestStep` for validation |
| Step `conditions[0].timeout` | `timeout` (ms) | Per-step timeout, converted from seconds |

### CLI Step Mapping Details

Steps with `type: command` in the legacy format are mapped to the `'command'` action, which the `CLIAgent` recognizes as a command-execution action (alongside `'execute'`, `'run'`, and `'execute_command'`).

The `target` field carries the command string directly on the `TestStep`, so the scenario adapter can pass it to the orchestrator without extracting it from `params`. The `expected` field carries the expected output for post-execution validation.

```yaml
# Legacy format step:
- type: command
  command: cargo test --lib 2>&1 | tail -1
  expected_output: "test result: ok"

# Converts to TestStep:
# {
#   name: "cargo test --lib 2>&1 | tail -1",
#   agent: "cli-agent",
#   action: "command",
#   target: "cargo test --lib 2>&1 | tail -1",
#   expected: "test result: ok",
#   params: { command: "cargo test --lib 2>&1 | tail -1" },
#   timeout: 30000
# }
```

### Agent Selection

The agent type is determined by the **suite-level** `type` field (per-scenario `type` can override, but is rarely used):

| Suite `type` | Agent name | Agent type |
|---|---|---|
| `cli` | `cli-agent` | `cli` |
| `tui` (or omitted) | `tui-agent` | `tui` |

### Return Type

`ScenarioLoader.loadFromFile()` always returns `Promise<ScenarioDefinition[]>`:

- **Canonical format** (top-level `name` + `steps`): returns `[scenario]`
- **Wrapped format** (`scenario: { ... }`): returns `[scenario]`
- **Legacy format** (`scenarios: [...]`): returns all scenarios from the array

`loadFromDirectory()` flattens all results into a single `ScenarioDefinition[]`.

### Validation

The `gadugi-test validate` command runs two-phase validation on legacy scenario files:

1. **YAML structure** — `parser.validateYamlFile()` checks that the file parses as valid YAML and contains an object (not a scalar or array at root).
2. **Scenario loading** — `ScenarioLoader.loadFromFile()` processes the legacy format, converting all scenarios. Missing `name` or `steps` on the canonical path will throw, but legacy `convertLegacyFormat` is lenient — a step with `type: command` but no `command` field will produce a step with an empty `target` and no `params.command`, which fails at execution time (CLIAgent receives no command to run) rather than at load time.

> **Tip:** Always include a `command:` field on every `type: command` step. The converter does not reject missing commands — it silently produces empty targets.

### Running Legacy Scenarios

```bash
# Run all scenarios from a directory (each file may contain multiple scenarios)
gadugi-test run -d tests/scenarios/

# Run a single file containing multiple scenarios
gadugi-test run tests/scenarios/my-test-suite.yaml

# The validate command also handles multi-scenario files
gadugi-test validate tests/scenarios/my-test-suite.yaml
```

### Example: amplihack-rs Test Scenario

A real-world example testing CLI tool behavior:

```yaml
name: issue-679-node-version-and-config
description: |
  Verifies amplihack install validates Node.js version requirements and
  repairs malformed Copilot CLI config.json.
type: cli
tags: [install, prerequisites, copilot, node, config]

scenarios:
  - name: parse-node-major-version-unit-tests-pass
    description: All parse_node_major_version unit tests pass
    steps:
      - type: command
        command: cargo test -p amplihack-utils --lib -- parse_node_major_version 2>&1 | tail -1
        expected_output: "test result: ok"

  - name: empty-config-json-is-recovered
    description: Empty config.json triggers recovery instead of parse error
    steps:
      - type: command
        command: cargo test -p amplihack-cli --lib -- empty_config_json_is_recovered 2>&1 | tail -1
        expected_output: "test result: ok"
```

This file produces **two** `ScenarioDefinition` objects, each with a `cli-agent` and a single step with `action: 'command'`.

## Writing New Scenarios

### 1. Define the Scenario Purpose
Start by clearly defining what your scenario will test:
- What functionality or workflow?
- What success criteria?
- What failure modes to test?

### 2. Choose Appropriate Agents
Select the agents needed for your test:
- UI testing: `ui-agent`
- CLI operations: `cli-agent` (or `system-agent` for broader system tasks)
- Real-time updates: `websocket-agent`
- Database operations: `database-agent`
- API testing: `api-agent`
- Network conditions: `network-agent`

### 3. Plan the Test Steps
Break down your test into logical steps:
1. Setup/initialization
2. Main test actions
3. Verification/validation
4. Cleanup

### 4. Define Environment Requirements
List all environment variables needed:
- Required: Variables that must be present
- Optional: Variables that enhance testing but aren't mandatory

### 5. Write Comprehensive Assertions
Include assertions that validate:
- Expected outcomes occurred
- No unexpected errors happened
- System remains in valid state
- Performance criteria met

### 6. Include Proper Cleanup
Always include cleanup steps to:
- Close applications and connections
- Remove test data
- Restore system state
- Clean up temporary files

## Best Practices

### Naming Conventions
- Scenario files: `kebab-case.yaml`
- Step names: "Descriptive Action Description"
- Agent names: "purpose-agent" (e.g., "ui-agent", "cli-agent")

### Timeout Management
- Set appropriate timeouts for each step
- Consider network latency and system performance
- Use longer timeouts for integration tests
- Use shorter timeouts for unit-style tests

### Error Handling
- Include `expect_failure: true` for negative tests
- Use `optional: true` for steps that may not apply
- Include `ignore_errors: true` in cleanup steps
- Test both success and failure scenarios

### Environment Variables
- Use `${VAR_NAME}` syntax for variable substitution
- Provide defaults where appropriate: `${VAR_NAME:-default_value}`
- Document all required variables in the environment section

### Test Data Management
- Use unique identifiers: `test-${TIMESTAMP}`
- Clean up test data in cleanup section
- Don't rely on persistent state between tests

### Documentation
- Use descriptive names and descriptions
- Include comments for complex steps
- Tag scenarios appropriately for filtering
- Update metadata when modifying scenarios

## Example Minimal Scenario

```yaml
name: "Simple UI Test"
description: "Basic UI interaction test"
version: "1.0.0"

config:
  timeout: 60000
  retries: 1
  parallel: false

environment:
  requires:
    - ELECTRON_APP_PATH

agents:
  - name: "ui-agent"
    type: "ui"
    config:
      browser: "chromium"
      headless: false
      timeout: 30000

steps:
  - name: "Launch App"
    agent: "ui-agent"
    action: "launch_electron"
    params:
      executablePath: "${ELECTRON_APP_PATH}"
    timeout: 20000
    
  - name: "Click Button"
    agent: "ui-agent"
    action: "click"
    params:
      selector: "[data-testid='test-button']"
    wait_for:
      selector: "[data-testid='result']"
      state: "visible"

assertions:
  - name: "Result Displayed"
    type: "element_visible"
    agent: "ui-agent"
    params:
      selector: "[data-testid='result']"

cleanup:
  - name: "Close App"
    agent: "ui-agent"
    action: "close_app"

metadata:
  tags: ["ui", "simple"]
  priority: "medium"
  author: "developer"
  created: "2024-09-03T00:00:00Z"
```

## Running Scenarios

Scenarios are executed by the TypeScript Agentic Testing System orchestrator. The system will:

1. Parse the YAML scenario
2. Validate environment requirements
3. Initialize specified agents
4. Execute steps in sequence
5. Run assertions to validate outcomes
6. Execute cleanup procedures
7. Generate comprehensive reports

For more information on running scenarios, see the [Getting Started guide](GETTING_STARTED.md).

## Schema Notes

### Command Working Directories

Scenario command steps use one deterministic scenario-level working directory. During scenario execution, the CLI agent selects the first command-capable `type: "cli"` or `type: "system"` agent that defines a configured cwd; if none exists, it falls back to the first scenario agent of any type with cwd configuration. The selected cwd applies consistently to command steps executed through the scenario.

Use `config.workingDirectory` for new scenarios. `config.cwd` is also supported as a scenario-compatible alias:

```yaml
agents:
  - name: "repo-cli"
    type: "cli"
    config:
      workingDirectory: "./packages/app"
      timeout: 60000

steps:
  - name: "Run package tests"
    agent: "repo-cli"
    action: "execute"
    params:
      command: "npm test"
```

The command above executes as if it were started from `./packages/app` because `repo-cli` is the first command-capable agent with cwd configuration.

`workingDirectory` takes precedence when both spellings are present:

```yaml
agents:
  - name: "repo-cli"
    type: "cli"
    config:
      cwd: "./ignored"
      workingDirectory: "./packages/app"
```

In this example, commands run from `./packages/app`.

If neither `workingDirectory` nor `cwd` is configured, command execution uses the CLI agent's default working-directory behavior, which is normally the process working directory or the working directory supplied by the programmatic CLI agent configuration. Empty strings and non-string values are not treated as configured working directories; invalid paths are passed to command execution and fail explicitly instead of silently falling back.

Per-command working-directory options, when supplied by the programmatic API, remain more specific than scenario-level configuration. Scenario-level `workingDirectory` and `cwd` provide the default cwd for command steps in that scenario.

#### Tutorial: run a scenario inside a project subdirectory

Use a `cli` agent when the scenario is primarily validating a command-line workflow:

```yaml
name: "Package Build"
description: "Build the app package from its workspace directory"
version: "1.0.0"

agents:
  - name: "app-cli"
    type: "cli"
    config:
      workingDirectory: "./packages/app"
      timeout: 120000

steps:
  - name: "Install dependencies"
    agent: "app-cli"
    action: "execute"
    params:
      command: "npm ci"

  - name: "Build package"
    agent: "app-cli"
    action: "execute"
    params:
      command: "npm run build"
    expect:
      type: "exit_code"
      code: 0
```

Use a `system` agent when command execution is part of a broader system-interaction scenario:

```yaml
name: "Repository Health Check"
description: "Check generated files from the repository root"
version: "1.0.0"

agents:
  - name: "system-agent"
    type: "system"
    config:
      cwd: "./fixtures/generated-repo"
      timeout: 30000

steps:
  - name: "List generated files"
    agent: "system-agent"
    action: "execute_command"
    params:
      command: "find . -maxdepth 2 -type f | sort"
    expect:
      type: "contains"
      patterns:
        - "./README.md"
```

### Stable Scenario IDs

The `id` field in a scenario definition is now a deterministic slug derived from the scenario `name`. You do not need to set `id` manually — the framework generates a stable identifier from the name, so scenario IDs remain consistent across runs and across team members:

```yaml
name: "CLI Smoke Test"
# id is automatically: "cli-smoke-test"
```

Previously, each load generated a new UUID, which made cross-run comparisons unreliable.

### Agents Array Validation

The `agents` array is now validated on load. A scenario with an empty or missing `agents` field is rejected with a clear error message:

```yaml
# Valid — at least one agent required
agents:
  - name: "cli-agent"
    type: "system"
    config:
      shell: "bash"
```

Running a scenario with no agents defined will produce an error like:

```
ScenarioValidationError: scenario "My Test" must define at least one agent
```

### Package Name

All programmatic usage should import from `@gadugi/agentic-test`:

```typescript
import { runScenario, loadScenarios } from "@gadugi/agentic-test";

const scenarios = await loadScenarios("./scenarios");
await runScenario(scenarios[0]);
```

The CLI binary is `gadugi-test`:

```bash
gadugi-test run scenarios/my-test.yaml
```

## Contributing

When adding new scenarios:

1. Follow the established naming conventions
2. Include comprehensive test coverage
3. Add appropriate metadata and tags
4. Test your scenario thoroughly
5. Update this README if introducing new patterns
6. Consider both positive and negative test cases

## Troubleshooting

Common issues when writing scenarios:

- **Timeouts**: Increase timeout values for slow operations
- **Element selectors**: Use `data-testid` attributes for reliable selection
- **Environment variables**: Ensure all required variables are documented
- **Agent configuration**: Verify agent types and configurations are valid
- **Step dependencies**: Ensure steps execute in logical order
- **Cleanup failures**: Use `ignore_errors: true` for non-critical cleanup steps
