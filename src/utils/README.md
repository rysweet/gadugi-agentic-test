# Utilities

The `src/utils/` directory provides shared infrastructure used across all agents and the orchestrator. Each utility family is decomposed into focused sub-modules following the same pattern as the agents.

## Contents

- [Architecture](#architecture)
- [Sub-module directories](#sub-module-directories)
  - [files/](#files)
  - [config/](#config)
  - [yaml/](#yaml)
  - [retry/](#retry)
  - [logging/](#logging)
  - [screenshot/](#screenshot)
- [Standalone utilities](#standalone-utilities)
  - [ids.ts](#idsts)
  - [agentUtils.ts](#agentutilsts)
  - [colors.ts](#colorsts)
  - [async.ts](#asyncts)
  - [comparison.ts](#comparisonts)
- [Integration example](#integration-example)

---

## Architecture

```
src/utils/
├── files/          # FileReader, FileWriter, FileSearch, FileArchiver
├── config/         # ConfigLoader, ConfigValidator, ConfigManager
├── yaml/           # YamlLoader, YamlValidator, YamlVariableSubstitution
├── retry/          # RetryExecutor, CircuitBreaker
├── logging/        # LogFormatter, LogTransport
├── screenshot/     # ScreenshotCapture, ImageComparator, DiffRenderer, ScreenshotReporter
├── ids.ts          # generateId()
├── agentUtils.ts   # sanitizeConfigWithEnv(), validateDirectory()
├── colors.ts       # ANSI color constants
├── async.ts        # delay()
├── comparison.ts   # deepEqual()
├── index.ts        # Re-exports all of the above
│
│   # Legacy entry points (preserved for backward compatibility)
├── config.ts       # re-exports from config/
├── fileUtils.ts    # re-exports from files/
├── logger.ts       # re-exports from logging/
├── retry.ts        # re-exports from retry/
└── yamlParser.ts   # re-exports from yaml/
```

Import from the sub-module for tree-shaking, or from `index.ts` / the legacy entry points when you need the full family.

---

## Sub-module directories

### files/

File system operations for test artifact management.

| Module | Responsibility |
|--------|---------------|
| `FileReader.ts` | Read files and directories, stream large files |
| `FileWriter.ts` | Write and append files, ensure parent dirs exist |
| `FileSearch.ts` | Glob-based file discovery, recursive search |
| `FileArchiver.ts` | Compress and extract test artifact bundles |

```typescript
import { FileReader, FileWriter, FileSearch } from '@gadugi/agentic-test/utils/files';

// Find all screenshots from the last run
const pngs = await FileSearch.glob('**/*.png', { cwd: './screenshots' });

// Read a test-data fixture
const fixture = await FileReader.readJson<LoginFixture>('./fixtures/login.json');

// Write the results summary
await FileWriter.writeJson('./results/run-summary.json', { passed: 12, failed: 1 });
```

---

### config/

Load, validate, and manage runtime configuration.

| Module | Responsibility |
|--------|---------------|
| `ConfigLoader.ts` | Read config from YAML files and environment |
| `ConfigValidator.ts` | Schema validation with actionable error messages |
| `ConfigManager.ts` | Merge sources, watch for changes, typed `get()` |

```typescript
import { ConfigManager, ConfigLoader } from '@gadugi/agentic-test/utils/config';

const raw = await ConfigLoader.fromFile('./test.config.yaml');
const manager = new ConfigManager(raw);
manager.mergeEnvironment();

const parallelism = manager.get<number>('execution.maxParallel', 3);
const logLevel   = manager.get<string>('logging.level', 'info');
```

---

### yaml/

Parse YAML scenario files with variable substitution.

| Module | Responsibility |
|--------|---------------|
| `YamlLoader.ts` | Read YAML files and inline YAML strings |
| `YamlValidator.ts` | Validate parsed documents against the scenario schema |
| `YamlVariableSubstitution.ts` | Expand `${env.VAR}` and `${global.KEY}` references |

```typescript
import { YamlLoader, YamlVariableSubstitution } from '@gadugi/agentic-test/utils/yaml';

const raw = await YamlLoader.fromFile('./scenarios/login.yaml');
const resolved = YamlVariableSubstitution.apply(raw, {
  env: process.env,
  global: { baseUrl: 'http://localhost:3000' }
});
// steps can now use ${global.baseUrl} and ${env.TEST_USER}
```

---

### retry/

Retry failed operations with configurable back-off and circuit breaking.

| Module | Responsibility |
|--------|---------------|
| `RetryExecutor.ts` | Exponential back-off, per-error retry predicate |
| `CircuitBreaker.ts` | Open/half-open/closed state machine |

```typescript
import { RetryExecutor, CircuitBreaker } from '@gadugi/agentic-test/utils/retry';

// Retry a flaky network call up to 4 times with exponential back-off
const data = await RetryExecutor.run(
  () => fetch('http://localhost:3000/api/status').then(r => r.json()),
  { maxAttempts: 4, initialDelayMs: 500, shouldRetry: (e) => e.code === 'ECONNREFUSED' }
);

// Protect a downstream service with a circuit breaker
const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 });
const result  = await breaker.execute(() => callExternalService());
```

---

### logging/

Structured logging pipeline used by all agents.

| Module | Responsibility |
|--------|---------------|
| `LogFormatter.ts` | Format log entries as JSON or human-readable text |
| `LogTransport.ts` | Route log entries to console, file, or both |

```typescript
import { LogTransport, LogFormatter } from '@gadugi/agentic-test/utils/logging';
import { createLogger } from '@gadugi/agentic-test';

// Use the high-level factory (recommended)
const logger = createLogger({ level: 'debug', logDir: './logs', enableFile: true });

logger.info('Scenario started', { scenarioId: 'login-001' });
logger.error('Step failed',     { step: 3, reason: 'element not found' });
```

---

### screenshot/

Capture, compare, and report on screenshots. `ScreenshotManager` (the facade used by agents) delegates to these four sub-modules.

| Module | Responsibility |
|--------|---------------|
| `ScreenshotCapture.ts` | Capture full-page and element screenshots via Playwright |
| `ImageComparator.ts` | Pixel-level diff between two PNG files |
| `DiffRenderer.ts` | Render a highlighted diff image for failure reports |
| `ScreenshotReporter.ts` | Aggregate metadata and write the screenshot index |

```typescript
import { ScreenshotCapture, ImageComparator } from '@gadugi/agentic-test/utils/screenshot';
import type { Page } from 'playwright';

// Capture during a test step
const meta = await ScreenshotCapture.capturePage(page, {
  outputDir: './screenshots',
  scenarioId: 'build-flow',
  stepIndex: 4,
  label: 'after-submit'
});
// Saved to: ./screenshots/build-flow/step-004-after-submit.png

// Compare baseline to current
const diff = await ImageComparator.compare('./baseline/step-004.png', meta.filePath);
if (!diff.matches) {
  console.log(`Visual regression: ${diff.differencePercentage.toFixed(2)}% changed`);
}
```

See [docs/screenshot-diff-guide.md](../../docs/screenshot-diff-guide.md) for the visual-regression workflow.

---

## Standalone utilities

### ids.ts

Generates unique IDs for scenarios, steps, and runs.

```typescript
import { generateId } from '@gadugi/agentic-test/utils/ids';

const scenarioRunId = generateId('run');
// e.g. "run-1708612345678-a3f2"
```

---

### agentUtils.ts

Shared helpers used by BaseAgent and sub-modules.

```typescript
import { sanitizeConfigWithEnv, validateDirectory } from '@gadugi/agentic-test/utils/agentUtils';

// Replace ${env.SECRET} tokens in config objects without leaking values to logs
const safeConfig = sanitizeConfigWithEnv(rawConfig);

// Assert a directory exists and is writable before a test run starts
await validateDirectory('./screenshots');
```

---

### colors.ts

Shared ANSI color constants used by CLI output and log formatters. Import from here instead of repeating escape codes.

```typescript
import { colors } from '@gadugi/agentic-test/utils/colors';

console.log(`${colors.green}PASS${colors.reset} login-001`);
console.log(`${colors.red}FAIL${colors.reset} build-flow`);
```

---

### async.ts

Provides `delay()` — the single approved way to sleep in this codebase. Do not use `setTimeout` directly.

```typescript
import { delay } from '@gadugi/agentic-test/utils/async';

await delay(500); // wait 500 ms before retrying
```

---

### comparison.ts

Provides `deepEqual()` for structural equality checks in step assertions.

```typescript
import { deepEqual } from '@gadugi/agentic-test/utils/comparison';

const expected = { status: 'ok', count: 3 };
const actual   = JSON.parse(responseBody);

if (!deepEqual(expected, actual)) {
  throw new Error(`Response mismatch: ${JSON.stringify(actual)}`);
}
```

---

## Integration example

A typical agent initialization uses several utilities together:

```typescript
import { createLogger }         from '@gadugi/agentic-test';
import { ConfigManager }        from '@gadugi/agentic-test/utils/config';
import { YamlLoader }           from '@gadugi/agentic-test/utils/yaml';
import { RetryExecutor }        from '@gadugi/agentic-test/utils/retry';
import { ScreenshotCapture }    from '@gadugi/agentic-test/utils/screenshot';
import { validateDirectory }    from '@gadugi/agentic-test/utils/agentUtils';

const logger  = createLogger({ level: 'info', logDir: './logs' });
const config  = new ConfigManager(await ConfigLoader.fromFile('./test.config.yaml'));
const outDir  = config.get<string>('screenshots.dir', './screenshots');

await validateDirectory(outDir);

const scenarios = await YamlLoader.fromFile('./scenarios/smoke.yaml');

for (const scenario of scenarios) {
  logger.info('Running scenario', { id: scenario.id });

  await RetryExecutor.run(async () => {
    // ... execute steps ...
    await ScreenshotCapture.capturePage(page, { outputDir: outDir, scenarioId: scenario.id, stepIndex: 0, label: 'done' });
  }, { maxAttempts: 3 });
}
```
