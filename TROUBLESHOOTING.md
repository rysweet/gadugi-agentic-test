# Troubleshooting Guide

This guide covers common issues you might encounter when using Gadugi Agentic Test and their solutions. The troubleshooting sections are organized by category with practical solutions and prevention tips.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Configuration Problems](#configuration-problems)
4. [Agent-Specific Issues](#agent-specific-issues)
5. [Test Execution Problems](#test-execution-problems)
6. [Performance Issues](#performance-issues)
7. [Integration Issues](#integration-issues)
8. [Environment-Specific Problems](#environment-specific-problems)
9. [Advanced Debugging](#advanced-debugging)
10. [Getting Help](#getting-help)

---

## Quick Diagnostics

Before diving into specific issues, run these quick diagnostic commands:

### System Check
```bash
# Check Node.js version (requires 18+)
node --version

# Check npm version
npm --version

# Verify Gadugi installation
npx gadugi-test --version

# Environment validation
npx gadugi-test --check-env
```

### Health Check
```bash
# Run basic health check
npx gadugi-test health-check

# Validate configuration
npx gadugi-test validate-config ./gadugi.config.js

# Test agent connectivity
npx gadugi-test test-agents --dry-run
```

### Log Analysis
```bash
# Check recent logs
tail -f ./logs/gadugi.log

# View specific session logs
npx gadugi-test logs --session <session-id>

# Debug mode execution
npx gadugi-test run --log-level debug ./tests/simple.yaml
```

---

## Installation Issues

### Issue: NPM Install Fails

**Symptoms:**
- Permission errors during `npm install`
- Missing dependencies
- Node-gyp compilation failures

**Solutions:**

```bash
# Fix permission issues (Unix/Mac)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Clear npm cache
npm cache clean --force

# Install with legacy peer deps
npm install --legacy-peer-deps

# Use yarn as alternative
yarn install
```

**Prevention:**
- Use Node Version Manager (nvm/fnm)
- Avoid global npm installations with sudo
- Keep npm updated: `npm install -g npm@latest`

### Issue: Playwright Browser Installation Fails

**Symptoms:**
- Browser download timeouts
- "Executable doesn't exist" errors
- Headless browser crashes

**Solutions:**

```bash
# Manual browser installation
npx playwright install

# Install specific browsers only
npx playwright install chromium

# Force reinstall
npx playwright install --force

# Check browser status
npx playwright install --dry-run

# Alternative: Use system browsers
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npx playwright install-deps
```

**For Corporate Networks:**
```bash
# Set proxy for downloads
export HTTPS_PROXY=http://your-proxy:port
export HTTP_PROXY=http://your-proxy:port
npx playwright install
```

### Issue: Python Dependencies Missing

**Symptoms:**
- "Python 3.11+ required" errors
- pexpect import failures
- CLI agent initialization errors

**Solutions:**

```bash
# Install Python dependencies
pip install pexpect psutil

# For virtual environments
python -m venv gadugi-env
source gadugi-env/bin/activate  # Unix/Mac
# gadugi-env\Scripts\activate   # Windows
pip install -r requirements.txt

# Verify Python path
which python3
python3 --version
```

---

## Configuration Problems

### Issue: Environment Variables Not Found

**Symptoms:**
- "ELECTRON_APP_PATH not set" errors
- Missing configuration values
- Agent initialization failures

**Solutions:**

1. **Check .env file location:**
```bash
# Ensure .env is in project root
ls -la .env

# Check .env content
cat .env
```

2. **Verify environment loading:**
```bash
# Test environment
node -e "require('dotenv').config(); console.log(process.env.ELECTRON_APP_PATH)"

# Check all Gadugi env vars
env | grep GADUGI
```

3. **Common .env template:**
```bash
# Required
ELECTRON_APP_PATH=/path/to/your/app.exe

# Optional but recommended
GITHUB_TOKEN=your_token_here
GADUGI_LOG_LEVEL=info
GADUGI_HEADLESS=false

# AI Integration (optional)
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_KEY=your_key_here
```

**Windows-specific paths:**
```bash
# Use forward slashes or double backslashes
ELECTRON_APP_PATH=C:/Program Files/YourApp/app.exe
# OR
ELECTRON_APP_PATH=C:\\Program Files\\YourApp\\app.exe
```

### Issue: Invalid Configuration File

**Symptoms:**
- "Configuration validation failed" errors
- Type errors in gadugi.config.js
- Unknown configuration options

**Solutions:**

1. **Validate configuration syntax:**
```javascript
// gadugi.config.js - Valid example
export default {
  execution: {
    maxConcurrentAgents: 3,
    retryAttempts: 2,
    timeoutMultiplier: 1.0
  },

  // Avoid common mistakes:
  // ❌ maxParallel: "3"        (string instead of number)
  // ❌ undefined: values       (undefined properties)
  // ❌ typos: 'maxParralel'    (typos in property names)

  logLevel: 'info', // ✅ Valid: 'error', 'warn', 'info', 'debug'

  ui: {
    executablePath: process.env.ELECTRON_APP_PATH, // ✅ Dynamic values OK
    headless: process.env.CI === 'true'
  }
};
```

2. **Test configuration:**
```bash
# Validate config file
npx gadugi-test validate-config

# Show resolved configuration
npx gadugi-test show-config
```

### Issue: Path Resolution Problems

**Symptoms:**
- "File not found" errors
- Scenario loading failures
- Screenshot directory creation errors

**Solutions:**

```bash
# Use absolute paths in configuration
export ELECTRON_APP_PATH="$(pwd)/dist/app.exe"

# Verify file exists
ls -la "$ELECTRON_APP_PATH"

# Check directory permissions
ls -ld ./scenarios/
chmod 755 ./scenarios/

# Create missing directories
mkdir -p ./screenshots ./logs ./reports
```

---

## Agent-Specific Issues

### ElectronUIAgent Issues

#### Issue: Electron App Won't Launch

**Symptoms:**
- Timeout during app launch
- "Failed to launch Electron application" errors
- Process starts but no UI appears

**Solutions:**

1. **Check executable path:**
```bash
# Verify file exists and is executable
ls -la "/path/to/your/app.exe"
file "/path/to/your/app.exe"

# Test manual launch
"/path/to/your/app.exe" --no-sandbox --disable-dev-shm-usage
```

2. **Common launch arguments:**
```yaml
# In your scenario YAML
agents:
  - name: "ui-agent"
    type: "ui"
    config:
      executablePath: "${ELECTRON_APP_PATH}"
      args:
        - "--no-sandbox"
        - "--disable-dev-shm-usage"
        - "--disable-gpu"
        - "--disable-web-security"  # Only for testing
      launchTimeout: 30000
```

3. **Debug launch issues:**
```javascript
// Enable Playwright debug logs
process.env.DEBUG = 'pw:*';

// Capture launch errors
const agent = new ElectronUIAgent({
  executablePath: process.env.ELECTRON_APP_PATH,
  args: ['--enable-logging', '--log-level=1']
});

try {
  await agent.launch();
} catch (error) {
  console.error('Launch failed:', error);
  // Check error.message for specific failure reasons
}
```

#### Issue: Element Selectors Not Working

**Symptoms:**
- "Element not found" errors
- Selectors work manually but fail in tests
- Intermittent selector failures

**Solutions:**

1. **Use multiple selector strategies:**
```yaml
# Instead of relying on one selector:
# ❌ selector: "#submit-btn"

# Use data-testid (recommended):
# ✅ selector: "[data-testid='submit-btn']"

# Or use text-based selectors:
# ✅ selector: "button:has-text('Submit')"

# Or use multiple fallback strategies in code:
```

```javascript
async function robustClick(page, selectors) {
  for (const selector of selectors) {
    try {
      await page.click(selector, { timeout: 2000 });
      return; // Success
    } catch (error) {
      continue; // Try next selector
    }
  }
  throw new Error(`None of the selectors worked: ${selectors.join(', ')}`);
}

// Usage
await robustClick(page, [
  '[data-testid="submit-btn"]',
  '#submit-btn',
  'button:has-text("Submit")',
  '.submit-button'
]);
```

2. **Add explicit waits:**
```yaml
- name: "Wait for Element to Load"
  agent: "ui-agent"
  action: "wait_for_element"
  params:
    selector: "[data-testid='submit-btn']"
    state: "visible"
    timeout: 10000

- name: "Click Submit"
  agent: "ui-agent"
  action: "click"
  params:
    selector: "[data-testid='submit-btn']"
```

3. **Debug selectors:**
```javascript
// Add to your test scenarios
- name: "Debug Available Elements"
  agent: "ui-agent"
  action: "evaluate"
  params:
    expression: |
      Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent,
        id: btn.id,
        classes: btn.className,
        testId: btn.getAttribute('data-testid')
      }))
```

#### Issue: Screenshot Capture Failures

**Symptoms:**
- Screenshot files not created
- Empty or corrupted screenshots
- Permission errors writing screenshots

**Solutions:**

1. **Check directory permissions:**
```bash
mkdir -p ./screenshots
chmod 755 ./screenshots

# Check disk space
df -h .
```

2. **Configure screenshot settings:**
```yaml
agents:
  - name: "ui-agent"
    type: "ui"
    config:
      screenshotConfig:
        mode: "on"  # or "only-on-failure", "off"
        directory: "./screenshots"
        fullPage: true
```

3. **Debug screenshot capture:**
```javascript
try {
  const screenshot = await agent.screenshot('debug-capture');
  console.log('Screenshot saved:', screenshot.filePath);

  // Verify file exists
  const fs = require('fs');
  const stats = fs.statSync(screenshot.filePath);
  console.log('File size:', stats.size, 'bytes');
} catch (error) {
  console.error('Screenshot failed:', error);
}
```

### CLIAgent Issues

#### Issue: Command Execution Timeouts

**Symptoms:**
- Commands hang indefinitely
- Timeout errors on long-running processes
- Interactive prompts not handled

**Solutions:**

1. **Adjust timeouts:**
```yaml
- name: "Long Running Command"
  agent: "cli-agent"
  action: "execute"
  params:
    command: "npm run build"
    timeout: 300000  # 5 minutes
```

2. **Handle interactive prompts:**
```javascript
// For interactive commands
const session = await cliAgent.startInteractiveSession('npm init');
await session.expect('package name:');
await session.send('my-package');
await session.expect('version:');
await session.send('1.0.0');
await session.close();
```

3. **Use non-interactive modes:**
```bash
# Add non-interactive flags
npm install --silent
git clone --quiet
kubectl apply --wait=false
```

#### Issue: Environment Variable Problems

**Symptoms:**
- Commands work manually but fail in tests
- PATH not found errors
- Permission denied errors

**Solutions:**

1. **Explicit environment setup:**
```yaml
- name: "Command with Environment"
  agent: "cli-agent"
  action: "execute"
  params:
    command: "node --version"
    environment:
      PATH: "${PATH}:/usr/local/bin"
      NODE_ENV: "test"
    workingDirectory: "./my-project"
```

2. **Debug environment:**
```bash
# Check current environment
npx gadugi-test run --log-level debug

# Compare with manual execution
echo $PATH
which node
```

---

## Test Execution Problems

### Issue: Tests Pass Locally but Fail in CI

**Symptoms:**
- Green tests locally, red in CI
- Timing-related failures
- Resource availability issues

**Solutions:**

1. **CI-specific configuration:**
```yaml
# .github/workflows/test.yml
env:
  GADUGI_HEADLESS: "true"
  GADUGI_TIMEOUT_MULTIPLIER: "2.0"
  GADUGI_PARALLEL_AGENTS: "2"  # Reduce for CI
```

2. **Robust wait strategies:**
```yaml
# Instead of fixed waits:
# ❌ action: "wait"
#    params: { duration: 1000 }

# Use condition-based waits:
# ✅ action: "wait_for_element"
#    params:
#      selector: "[data-testid='loaded']"
#      timeout: 30000
```

3. **CI-specific timeouts:**
```javascript
// gadugi.config.js
export default {
  timeoutMultiplier: process.env.CI ? 2.0 : 1.0,
  execution: {
    maxParallel: process.env.CI ? 2 : 4
  }
};
```

### Issue: Flaky Tests

**Symptoms:**
- Tests sometimes pass, sometimes fail
- Timing-dependent failures
- Race conditions

**Solutions:**

1. **Add stability checks:**
```yaml
- name: "Wait for Stability"
  agent: "ui-agent"
  action: "wait_for_element"
  params:
    selector: "[data-testid='content']"
    state: "visible"

- name: "Verify Content Loaded"
  agent: "ui-agent"
  action: "wait_for_function"
  params:
    expression: "document.querySelectorAll('[data-loading]').length === 0"
    timeout: 10000
```

2. **Retry failed steps:**
```yaml
steps:
  - name: "Flaky Operation"
    agent: "ui-agent"
    action: "click"
    params:
      selector: "[data-testid='submit']"
    retries: 3
    continueOnFailure: false
```

3. **Debug flaky tests:**
```bash
# Run test multiple times
for i in {1..10}; do
  echo "Run $i"
  npx gadugi-test run flaky-test.yaml
done

# Capture more screenshots
# Set mode to "on" for flaky tests
```

### Issue: Memory Leaks During Long Test Runs

**Symptoms:**
- Memory usage keeps growing
- Tests slow down over time
- Out of memory errors

**Solutions:**

1. **Enable cleanup:**
```yaml
cleanup:
  - name: "Close Application"
    agent: "ui-agent"
    action: "close_app"

  - name: "Clear Cache"
    agent: "ui-agent"
    action: "evaluate"
    params:
      expression: "window.gc && window.gc()"
```

2. **Limit concurrent agents:**
```javascript
// gadugi.config.js
export default {
  execution: {
    maxConcurrentAgents: 2, // Reduce if memory constrained
  }
};
```

3. **Monitor memory usage:**
```bash
# Monitor during test execution
watch -n 1 'ps aux | grep gadugi'

# Or use built-in monitoring
npx gadugi-test run --monitor-memory ./tests/
```

---

## Performance Issues

### Issue: Slow Test Execution

**Symptoms:**
- Tests take much longer than expected
- UI operations are sluggish
- High CPU usage

**Solutions:**

1. **Optimize selectors:**
```yaml
# Fast selectors (use these):
selector: "[data-testid='element']"    # ✅ Fast
selector: "#unique-id"                 # ✅ Fast

# Slow selectors (avoid these):
selector: "div > span:nth-child(3)"    # ❌ Slow
selector: "//div[contains(@class,'x')]" # ❌ Very slow XPath
```

2. **Reduce screenshot frequency:**
```yaml
screenshotConfig:
  mode: "only-on-failure"  # Instead of "on"
```

3. **Optimize wait strategies:**
```yaml
# Don't use fixed delays
# ❌ action: "wait"
#    params: { duration: 5000 }

# Use smart waits
# ✅ action: "wait_for_element"
#    params:
#      selector: "[data-loaded='true']"
#      timeout: 5000
```

4. **Parallel execution:**
```bash
# Run independent tests in parallel
npx gadugi-test run --parallel 4 ./tests/independent/
```

### Issue: High Memory Usage

**Symptoms:**
- System becomes unresponsive
- Out of memory errors
- Swap usage increases

**Solutions:**

1. **Limit browser instances:**
```javascript
// gadugi.config.js
export default {
  ui: {
    maxInstances: 2, // Limit concurrent browsers
  },
  execution: {
    maxConcurrentAgents: 2
  }
};
```

2. **Enable headless mode:**
```bash
export GADUGI_HEADLESS=true
npx gadugi-test run ./tests/
```

3. **Clear artifacts regularly:**
```bash
# Clean old screenshots and logs
find ./screenshots -mtime +7 -delete
find ./logs -mtime +3 -delete
```

---

## Integration Issues

### Issue: GitHub Integration Not Working

**Symptoms:**
- Issues not created automatically
- Authentication errors
- API rate limiting

**Solutions:**

1. **Verify token permissions:**
```bash
# Test GitHub token
curl -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/user

# Check required scopes: repo, issues
```

2. **Configure properly:**
```javascript
// gadugi.config.js
export default {
  github: {
    repository: 'owner/repo',  // ✅ Correct format
    // repository: 'https://github.com/owner/repo', // ❌ Wrong
    createIssues: true,
    token: process.env.GITHUB_TOKEN
  }
};
```

3. **Handle rate limiting:**
```javascript
// Reduce issue creation frequency
github: {
  createIssues: process.env.NODE_ENV === 'production',
  rateLimit: {
    requestsPerHour: 100
  }
}
```

### Issue: WebSocket Connection Problems

**Symptoms:**
- WebSocket timeouts
- Connection refused errors
- Events not received

**Solutions:**

1. **Verify WebSocket server:**
```bash
# Test WebSocket manually
npx wscat -c ws://localhost:3001

# Check if server is running
netstat -an | grep 3001
```

2. **Configure connection properly:**
```yaml
agents:
  - name: "websocket-agent"
    type: "websocket"
    config:
      url: "ws://localhost:3001"
      reconnectAttempts: 5
      reconnectDelay: 2000
      timeout: 10000
```

3. **Debug connection issues:**
```javascript
// Enable WebSocket debugging
process.env.DEBUG = 'socket.io-client:*';

// Test connection programmatically
const io = require('socket.io-client');
const socket = io('ws://localhost:3001');

socket.on('connect', () => console.log('Connected'));
socket.on('connect_error', (error) => console.error('Connection error:', error));
```

---

## Environment-Specific Problems

### Windows-Specific Issues

#### Issue: Path Separator Problems

**Solutions:**
```javascript
// Use path.join() for cross-platform paths
const path = require('path');
const configPath = path.join(__dirname, 'config', 'gadugi.config.js');

// Or use forward slashes (works on Windows)
ELECTRON_APP_PATH=C:/Program Files/MyApp/app.exe
```

#### Issue: PowerShell Execution Policy

**Solutions:**
```powershell
# Allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run specific command
powershell -ExecutionPolicy Bypass -File script.ps1
```

### macOS-Specific Issues

#### Issue: Gatekeeper Blocking Electron App

**Solutions:**
```bash
# Allow unsigned app to run
sudo spctl --master-disable

# Or add specific exception
sudo spctl --add /path/to/your/app.app
```

#### Issue: Permission Denied Errors

**Solutions:**
```bash
# Fix permissions
chmod +x /path/to/your/app
sudo chown -R $(whoami) /path/to/project

# Add to PATH if needed
export PATH="/usr/local/bin:$PATH"
```

### Linux-Specific Issues

#### Issue: Missing Display Server

**Solutions:**
```bash
# Install Xvfb for headless
sudo apt-get install xvfb

# Run with virtual display
xvfb-run -a npx gadugi-test run ./tests/

# Or set headless mode
export GADUGI_HEADLESS=true
```

#### Issue: Browser Dependencies Missing

**Solutions:**
```bash
# Install browser dependencies
npx playwright install-deps

# For Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libxss1 \
  libasound2
```

### Docker-Specific Issues

#### Issue: Container Crashes

**Solutions:**
```dockerfile
# Add necessary capabilities
FROM node:18-alpine

# Install browser dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Chrome path
ENV CHROME_BIN="/usr/bin/chromium-browser"
ENV CHROME_PATH="/usr/bin/chromium-browser"

# Disable Chrome sandbox
ENV GADUGI_HEADLESS=true
ENV CHROME_ARGS="--no-sandbox --disable-dev-shm-usage"
```

---

## Advanced Debugging

### Enable Debug Logging

```bash
# Maximum verbosity
export DEBUG=gadugi:*,pw:*
export GADUGI_LOG_LEVEL=debug

# Run with debug output
npx gadugi-test run --log-level debug ./tests/
```

### Capture Debug Information

```bash
# Generate debug report
npx gadugi-test debug-report --output ./debug-info.json

# Include system information
npx gadugi-test debug-report --include-system --output ./debug-full.json
```

### Manual Agent Testing

```javascript
// test-agent.js - Manual agent testing
const { ElectronUIAgent } = require('@gadugi/agentic-test');

async function testAgent() {
  const agent = new ElectronUIAgent({
    executablePath: process.env.ELECTRON_APP_PATH,
    headless: false
  });

  try {
    console.log('Initializing agent...');
    await agent.initialize();

    console.log('Launching application...');
    await agent.launch();

    console.log('Taking screenshot...');
    await agent.screenshot('manual-test');

    console.log('Success!');

  } catch (error) {
    console.error('Agent test failed:', error);
  } finally {
    await agent.cleanup();
  }
}

testAgent();
```

### Performance Profiling

```bash
# Profile test execution
node --prof $(which gadugi-test) run ./tests/

# Analyze profile
node --prof-process isolate-*.log > profile.txt

# Memory usage profiling
node --inspect $(which gadugi-test) run ./tests/
```

### Network Debugging

```bash
# Capture network traffic
export DEBUG=axios:*

# Monitor WebSocket connections
npx wscat -l 3001  # Listen mode
```

---

## Getting Help

### Self-Help Resources

1. **Documentation:**
   - [Getting Started Guide](./GETTING_STARTED.md)
   - [API Reference](./API_REFERENCE.md)
   - [Example Scenarios](./scenarios/)

2. **Debug Tools:**
   ```bash
   # Built-in help
   npx gadugi-test --help
   npx gadugi-test run --help

   # Health check
   npx gadugi-test health-check

   # Configuration validation
   npx gadugi-test validate-config
   ```

3. **Community Resources:**
   - [GitHub Discussions](https://github.com/rysweet/gadugi-agentic-test/discussions)
   - [Issue Tracker](https://github.com/rysweet/gadugi-agentic-test/issues)

### Creating Effective Bug Reports

When creating an issue, include:

1. **Environment Information:**
   ```bash
   npx gadugi-test --version
   node --version
   npm --version
   uname -a  # Linux/Mac
   ```

2. **Configuration:**
   ```bash
   # Share your configuration (remove sensitive data)
   npx gadugi-test show-config --sanitized
   ```

3. **Logs:**
   ```bash
   # Recent logs
   tail -n 100 ./logs/gadugi.log

   # Debug run
   npx gadugi-test run --log-level debug ./failing-test.yaml
   ```

4. **Minimal Reproduction:**
   - Simplest scenario that reproduces the issue
   - Steps to reproduce
   - Expected vs actual behavior

### Template Bug Report

```markdown
## Bug Description
Brief description of the issue

## Environment
- Gadugi version: X.X.X
- Node.js version: X.X.X
- OS: [Windows/macOS/Linux]
- Browser: [if UI testing]

## Configuration
```yaml
# Your gadugi config (sanitized)
```

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What you expected to happen

## Actual Behavior
What actually happened

## Logs
```
Relevant log output
```

## Additional Context
Any other relevant information
```

---

## Preventive Measures

### Best Practices for Stability

1. **Use stable selectors:**
   ```html
   <button data-testid="submit-btn">Submit</button>
   ```

2. **Implement proper waits:**
   ```yaml
   - action: "wait_for_element"
     params:
       selector: "[data-loaded='true']"
   ```

3. **Add cleanup steps:**
   ```yaml
   cleanup:
     - action: "close_app"
   ```

4. **Monitor resource usage:**
   ```bash
   # Regular cleanup
   find ./logs -mtime +7 -delete
   find ./screenshots -mtime +14 -delete
   ```

5. **Version control configuration:**
   ```bash
   # Track config changes
   git add gadugi.config.js .env.example
   ```

---

This troubleshooting guide covers the most common issues encountered when using Gadugi Agentic Test. If you encounter an issue not covered here, please [open an issue](https://github.com/rysweet/gadugi-agentic-test/issues) on GitHub with detailed information, and we'll help you resolve it and update this guide.

Remember: Most issues are configuration-related and can be resolved quickly with the right diagnostics. When in doubt, start with the [Quick Diagnostics](#quick-diagnostics) section!