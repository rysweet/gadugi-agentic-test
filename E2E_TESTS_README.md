# End-to-End Test Suite for Gadugi Agentic Test Framework

## Overview

This directory contains comprehensive end-to-end tests that validate the Gadugi framework's own functionality using AI-driven agents. These tests are specifically designed to:

1. **Test the testers** - Validate that the testing framework itself works correctly
2. **Catch regressions** - Verify recent bug fixes remain fixed
3. **Exercise real workflows** - Test realistic usage scenarios
4. **Validate multi-agent coordination** - Ensure agents work together properly

## Test Scenarios

### 1. TUIAgent Session Management & PATH Inheritance
**File:** `e2e-tui-session-management.yaml`

**Purpose:** Tests the TUIAgent's ability to manage multiple terminal sessions, inherit environment variables (especially PATH), and auto-detect the most recent session.

**Tests Recent Fixes:**
- ✅ `16d1d3a` - TUIAgent inherit PATH from parent process
- ✅ `4176911` - TUIAgent auto-detect current session for implicit references  
- ✅ `c5d89b3` - Complete getMostRecentSessionId method

**Key Test Cases:**
- Spawning multiple terminal sessions
- Verifying PATH inheritance allows finding executables
- Testing implicit session references (auto-detection)
- Validating explicit session targeting
- Confirming proper session cleanup
- Environment variable preservation

**Expected Outcomes:**
- All commands can find executables in PATH
- Multiple sessions can be tracked independently
- Most recent session is correctly identified
- Sessions clean up without leaving zombies

---

### 2. ScenarioAdapter Defensive Checks & YAML Parsing
**File:** `e2e-scenario-adapter-validation.yaml`

**Purpose:** Validates that the scenario adapter handles malformed, incomplete, and edge-case scenario definitions gracefully without crashing.

**Tests Recent Fixes:**
- ✅ `b6d3901` - Add defensive checks for all scenario fields in adapter
- ✅ `554a511` - Handle undefined steps in adapter
- ✅ `fdd995e` - Use ScenarioLoader format and fix YAML parsing bugs

**Key Test Cases:**
- Valid minimal scenarios
- Scenarios with missing fields (undefined steps, null values)
- Malformed YAML syntax
- Empty collections ([], null arrays)
- Steps with missing required fields
- Adapter defensive programming verification

**Expected Outcomes:**
- Valid scenarios load successfully
- Invalid scenarios are rejected with meaningful errors
- Undefined/null fields are handled gracefully
- No type errors or crashes occur
- Defensive checks provide safety

---

### 3. TestOrchestrator Multi-Agent Coordination
**File:** `e2e-orchestrator-coordination.yaml`

**Purpose:** Tests the orchestrator's ability to coordinate multiple agents, execute scenarios, and handle errors without type casts.

**Tests Recent Fixes:**
- ✅ `69c8de6` - Add runWithScenarios to use pre-loaded scenarios
- ✅ `ab2b5cf` - Production quality improvements - remove all type casts and fix error handling
- ✅ `9844af6` - Replace simulated test execution with actual TestOrchestrator.run()

**Key Test Cases:**
- Loading and pre-validating scenarios
- Running scenarios with runWithScenarios method
- Multi-agent coordination (2+ agents)
- Error handling without type casts
- Proper result collection
- Session management

**Expected Outcomes:**
- Scenarios load and execute successfully
- Multiple agents coordinate properly
- Results are captured accurately
- Errors are handled gracefully
- No type cast errors occur

---

### 4. CLIAgent Interactive Session Handling
**File:** `e2e-cli-interactive-sessions.yaml`

**Purpose:** Comprehensive test of CLIAgent's ability to handle interactive CLI applications, stdin/stdout communication, and process lifecycle.

**Key Test Cases:**
- Simple command execution
- Stdin input handling
- Interactive sessions (bc calculator)
- Environment variable propagation
- Working directory changes
- Timeout detection and handling
- Exit code validation
- Sequential command execution
- Long-running process monitoring
- stderr capture
- Piped commands
- Large output handling
- Process cleanup
- Retry mechanisms

**Expected Outcomes:**
- All command types execute correctly
- Interactive sessions work properly
- Timeouts are detected
- Exit codes are captured
- Streams (stdout/stderr) are properly separated
- No zombie processes remain

---

### 5. TUI Color Parsing & Output Validation
**File:** `e2e-tui-color-parsing.yaml`

**Purpose:** Validates TUIAgent's ability to parse ANSI color codes, handle terminal formatting, and extract structured information from terminal output.

**Key Test Cases:**
- Basic ANSI color codes (red, green, blue, yellow)
- Background colors
- Text styles (bold, underline, reverse)
- 256-color support
- Real CLI tools (ls, git) with colors
- Progress bars and animations
- Table formatting detection
- Multi-line colored output
- Cursor positioning codes
- Clean text extraction (ANSI stripping)
- Spinner/animation detection
- Color intensity variations
- Rapid output updates
- Color reset handling

**Expected Outcomes:**
- All color types are parsed correctly
- ANSI codes are preserved when needed
- Clean text can be extracted
- Animations are detected
- Table formats are recognized
- Colors are properly reset between segments

---

## Running the Tests

### Quick Start

```bash
# Run all E2E tests
npm run test:e2e

# Or directly with the runner
node e2e-test-runner.ts
```

### Selective Execution

```bash
# Run specific test scenario
node e2e-test-runner.ts tui-session

# Run with specific options
node e2e-test-runner.ts --parallel      # Run in parallel
node e2e-test-runner.ts --fail-fast     # Stop on first failure
node e2e-test-runner.ts --quiet         # Minimal output
```

### Using the Framework CLI

```bash
# Run individual scenario
npm start -- run scenarios/e2e-tui-session-management.yaml

# Run all E2E scenarios
npm start -- run scenarios/e2e-*.yaml

# Run with verbose logging
npm start -- run scenarios/e2e-tui-session-management.yaml --log-level debug
```

---

## Test Results and Reports

### Output Directory Structure

```
test-results/e2e/
├── e2e-test-report.json          # Comprehensive test report
├── test-execution.log            # Detailed execution log
├── screenshots/                  # Captured screenshots (if any)
└── artifacts/                    # Test artifacts
```

### Report Format

```json
{
  "timestamp": "2024-02-11T12:00:00.000Z",
  "totalScenarios": 5,
  "passed": 5,
  "failed": 0,
  "skipped": 0,
  "duration": 120000,
  "scenarios": [
    {
      "name": "TUIAgent Session Management & PATH Inheritance",
      "status": "PASSED",
      "duration": 25000,
      "steps": 11
    }
  ]
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Dependencies
        run: npm install
      
      - name: Build Framework
        run: npm run build
      
      - name: Run E2E Tests
        run: npm run test:e2e
      
      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: e2e-test-results
          path: test-results/e2e/
```

---

## Troubleshooting

### Common Issues

**1. Terminal not found**
```bash
# Ensure bash is available
which bash

# Or use alternative shell
export SHELL=/bin/sh
```

**2. PATH inheritance not working**
```bash
# Verify PATH is set
echo $PATH

# Check test environment
node -e "console.log(process.env.PATH)"
```

**3. ANSI color codes not captured**
```bash
# Ensure terminal type supports colors
export TERM=xterm-256color

# Or use in test config
terminalType: "xterm-256color"
```

**4. Tests timing out**
```bash
# Increase global timeout
npm start -- run scenarios/test.yaml --timeout 60000

# Or in scenario config
config:
  timeout: 120000
```

---

## Development

### Adding New E2E Tests

1. Create a new YAML scenario in `scenarios/`
2. Follow the naming convention: `e2e-<feature>-<aspect>.yaml`
3. Add comprehensive test cases
4. Include assertions and cleanup steps
5. Add to the runner's scenario list
6. Document in this README

### Test Design Principles

1. **Isolation** - Each test should be independent
2. **Cleanup** - Always clean up resources
3. **Assertions** - Include explicit assertions
4. **Coverage** - Test both happy and error paths
5. **Documentation** - Document what each test validates
6. **Recent Fixes** - Link to git commits being tested

---

## Maintenance

### Regular Tasks

- [ ] Review and update tests after major changes
- [ ] Add tests for new features
- [ ] Check for flaky tests
- [ ] Update documentation
- [ ] Verify CI/CD integration
- [ ] Review test coverage

### Deprecation Policy

Tests should be maintained for at least 3 minor versions after the features they test are deprecated.

---

## Related Documentation

- [Main README](index.md) - Framework overview
- [API Reference](API_REFERENCE.md) - API documentation
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
- [Contributing](CONTRIBUTING.md) - Contribution guidelines

---

## Contact

For questions or issues related to E2E tests:
- GitHub Issues: https://github.com/rysweet/gadugi-agentic-test/issues
- Tag: `e2e-tests`, `testing`, `regression`

---

**Last Updated:** 2026-02-22
**Test Suite Version:** 1.0.0
**Framework Version:** 1.0.0
