# Agents

The `src/agents/` directory contains all test-execution agents. Each agent is responsible for one interaction surface (Electron UI, CLI, WebSocket, etc.). Every agent extends `BaseAgent` and delegates to focused sub-modules.

## Contents

- [Architecture](#architecture)
- [BaseAgent](#baseagent)
- [Available Agents](#available-agents)
  - [ElectronUIAgent](#electronuiagent)
  - [CLIAgent](#cliagent)
  - [TUIAgent](#tuiagent)
  - [WebSocketAgent](#websocketagent)
  - [APIAgent](#apiagent)
  - [ComprehensionAgent](#comprehensionagent)
  - [PriorityAgent](#priorityagent)
  - [IssueReporter](#issuereporter)
  - [SystemAgent](#systemagent)
- [Creating Custom Agents](#creating-custom-agents)

---

## Architecture

Each agent follows the same decomposed structure:

```
src/agents/
├── BaseAgent.ts          # Abstract base — template-method pattern
├── index.ts              # IAgent interface, AgentType enum, all exports
├── <AgentName>.ts        # Thin facade that extends BaseAgent
└── <agentname>/          # Sub-module directory
    ├── types.ts          # Config interfaces and enums
    ├── <SubModule>.ts    # One class per file, one responsibility per class
    └── index.ts          # Re-exports from sub-modules
```

The facade delegates all logic to sub-modules. The sub-modules each do exactly one thing. No sub-module exceeds 300 lines.

---

## BaseAgent

`BaseAgent` is an abstract class that implements the shared execution loop so that individual agents only need to implement their step dispatch and result assembly.

```typescript
import { BaseAgent, ExecutionContext } from '@gadugi/agentic-test';
import { OrchestratorScenario, StepResult } from '@gadugi/agentic-test';

export class MyAgent extends BaseAgent {
  readonly name = 'MyAgent';
  readonly type = AgentType.CUSTOM;

  async initialize(): Promise<void> { /* setup */ }
  async cleanup(): Promise<void>    { /* teardown */ }

  async executeStep(step: any, index: number): Promise<StepResult> {
    // dispatch to sub-modules
  }

  buildResult(scenario: OrchestratorScenario, ctx: ExecutionContext) {
    return { scenarioId: scenario.id, ...ctx };
  }
}
```

`BaseAgent` provides:

| Method | Purpose |
|--------|---------|
| `execute(scenario)` | Shared loop — runs all steps, collects results |
| `executeStep(step, index)` | Abstract — subclass dispatches per action |
| `buildResult(scenario, ctx)` | Abstract — subclass assembles final result shape |
| `applyEnvironment()` | Optional hook — per-agent env setup before loop |
| `onBeforeExecute()` | Optional lifecycle hook |
| `onAfterExecute()` | Optional lifecycle hook |

---

## Available Agents

### ElectronUIAgent

Tests Electron desktop applications using Playwright's Electron support.

**Sub-modules** (`src/agents/electron/`):

| File | Responsibility |
|------|---------------|
| `ElectronLauncher.ts` | Launch and close the Electron process |
| `ElectronPageInteractor.ts` | Click, fill, wait-for-element operations |
| `ElectronPerformanceMonitor.ts` | CPU/memory sampling |
| `ElectronWebSocketMonitor.ts` | Socket.IO event capture |

```typescript
import { ElectronUIAgent } from '@gadugi/agentic-test';

const agent = new ElectronUIAgent({
  executablePath: '/path/to/my-app',
  screenshotConfig: { mode: 'only-on-failure', directory: './screenshots', fullPage: true }
});

await agent.initialize();
await agent.clickTab('Build');
await agent.fillInput('[data-testid="tenant-id"]', 'acme-corp');
await agent.clickButton('[data-testid="start-build"]');
await agent.waitForElement('[data-testid="build-complete"]');
await agent.cleanup();
```

---

### CLIAgent

Tests command-line interfaces by running commands and parsing their output.

**Sub-modules** (`src/agents/cli/`):

| File | Responsibility |
|------|---------------|
| `CLICommandRunner.ts` | Spawn processes, capture stdout/stderr |
| `CLIOutputParser.ts` | Pattern matching against command output |

```typescript
import { CLIAgent } from '@gadugi/agentic-test';

const agent = new CLIAgent({ cwd: '/path/to/project', shell: '/bin/bash' });

await agent.initialize();
const result = await agent.execute({
  id: 'cli-smoke',
  name: 'CLI smoke test',
  steps: [
    { action: 'run', target: 'npm --version', expectedOutput: /\d+\.\d+\.\d+/ }
  ]
});
await agent.cleanup();
```

---

### TUIAgent

Tests text-based user interfaces (ncurses, Ink, etc.) using a PTY session via `PtyTerminal`.

**Sub-modules** (`src/agents/tui/`):

| File | Responsibility |
|------|---------------|
| `TUISessionManager.ts` | PTY lifecycle — open, close, resize |
| `TUIInputSimulator.ts` | Keystroke injection |
| `TUIMenuNavigator.ts` | Arrow-key menu traversal |
| `TUIOutputParser.ts` | ANSI-stripped output matching |
| `TUIStepDispatcher.ts` | Maps step actions to the above modules |

```typescript
import { TUIAgent } from '@gadugi/agentic-test';

const agent = new TUIAgent({ command: 'npx my-tui-app', cols: 80, rows: 24 });

await agent.initialize();
const result = await agent.execute({
  id: 'tui-navigation',
  name: 'Navigate main menu',
  steps: [
    { action: 'wait_for_text', target: 'Main Menu' },
    { action: 'key', target: 'ArrowDown' },
    { action: 'key', target: 'Enter' },
    { action: 'wait_for_text', target: 'Sub Menu' }
  ]
});
await agent.cleanup();
```

---

### WebSocketAgent

Tests WebSocket servers by sending messages and asserting received events.

**Sub-modules** (`src/agents/websocket/`):

| File | Responsibility |
|------|---------------|
| `WebSocketConnection.ts` | Connect, disconnect, reconnect |
| `WebSocketMessageHandler.ts` | Send/receive message dispatch |
| `WebSocketEventRecorder.ts` | Record all received events |
| `WebSocketStepExecutor.ts` | Map step actions to the above modules |

```typescript
import { WebSocketAgent } from '@gadugi/agentic-test';

const agent = new WebSocketAgent({ url: 'ws://localhost:8080' });

await agent.initialize();
const result = await agent.execute({
  id: 'ws-echo',
  name: 'WebSocket echo test',
  steps: [
    { action: 'send', target: JSON.stringify({ type: 'ping' }) },
    { action: 'wait_for_message', target: '{"type":"pong"}' }
  ]
});
await agent.cleanup();
```

---

### APIAgent

Tests HTTP REST APIs by executing requests and validating responses.

**Sub-modules** (`src/agents/api/`):

| File | Responsibility |
|------|---------------|
| `APIAuthHandler.ts` | Bearer token, basic auth, API key injection |
| `APIRequestExecutor.ts` | HTTP request dispatch |
| `APIResponseValidator.ts` | Status code, body, header assertions |

```typescript
import { APIAgent } from '@gadugi/agentic-test';

const agent = new APIAgent({ baseUrl: 'http://localhost:3000', authToken: process.env.API_KEY });

await agent.initialize();
const result = await agent.execute({
  id: 'api-health',
  name: 'Health endpoint check',
  steps: [
    { action: 'GET', target: '/health', expectedStatus: 200 },
    { action: 'GET', target: '/api/users', expectedStatus: 200, expectedBodyContains: '"id"' }
  ]
});
await agent.cleanup();
```

---

### ComprehensionAgent

Reads documentation and generates test scenarios using an LLM.

See [ComprehensionAgent.README.md](./ComprehensionAgent.README.md) for full documentation.

**Sub-modules** (`src/agents/comprehension/`):

| File | Responsibility |
|------|---------------|
| `DocumentationLoader.ts` | Read markdown and source files |
| `ScenarioComprehender.ts` | Call LLM to generate test scenarios |
| `OutputComprehender.ts` | Parse and validate LLM responses |

```typescript
import { ComprehensionAgent } from '@gadugi/agentic-test';

const agent = new ComprehensionAgent({ openAiApiKey: process.env.OPENAI_API_KEY });
await agent.initialize();

const scenarios = await agent.generateScenarios('./docs/features/auth.md');
console.log(`Generated ${scenarios.length} test scenarios`);

await agent.cleanup();
```

---

### PriorityAgent

Classifies and prioritizes test failures and GitHub issues by severity.

See [PriorityAgent.README.md](./PriorityAgent.README.md) for full documentation.

**Sub-modules** (`src/agents/priority/`):

| File | Responsibility |
|------|---------------|
| `PriorityAnalyzer.ts` | Score issues by impact and urgency |
| `PriorityPatternExtractor.ts` | Extract signal from error messages and stack traces |
| `PriorityQueue.ts` | Order and return sorted issue list |

```typescript
import { PriorityAgent } from '@gadugi/agentic-test';

const agent = new PriorityAgent({ openAiApiKey: process.env.OPENAI_API_KEY });
await agent.initialize();

const ranked = await agent.prioritize(failedScenarios);
ranked.forEach((item, i) => console.log(`${i + 1}. [${item.priority}] ${item.title}`));

await agent.cleanup();
```

---

### IssueReporter

Creates GitHub issues for test failures with full context attached.

**Sub-modules** (`src/agents/issue/`):

| File | Responsibility |
|------|---------------|
| `IssueFormatter.ts` | Build issue title and markdown body |
| `IssueDeduplicator.ts` | Search for existing issues before creating |
| `IssueSubmitter.ts` | Call GitHub API to create the issue |

```typescript
import { IssueReporter } from '@gadugi/agentic-test';

const reporter = new IssueReporter({
  githubToken: process.env.GITHUB_TOKEN,
  repo: 'rysweet/my-app'
});

await reporter.initialize();
await reporter.reportFailure(failedScenario, { screenshots: ['./screenshots/step-5.png'] });
await reporter.cleanup();
```

---

### SystemAgent

Monitors host system resources during test runs. Composed from four focused sub-modules.

See [README.SystemAgent.md](./README.SystemAgent.md) for full documentation.

**Sub-modules** (`src/agents/system/`):

| File | Responsibility |
|------|---------------|
| `MetricsCollector.ts` | CPU, memory, disk sampling |
| `DockerMonitor.ts` | Container health and resource usage |
| `FileSystemWatcher.ts` | File change events during test run |
| `SystemAnalyzer.ts` | Aggregate metrics into test-run snapshots |

```typescript
import { SystemAgent } from '@gadugi/agentic-test';

const agent = new SystemAgent({ sampleIntervalMs: 1000, watchPaths: ['/tmp/test-output'] });

await agent.initialize();
// ... run your test suite ...
const report = await agent.getSummary();
console.log(`Peak memory: ${report.peakMemoryMb} MB`);
await agent.cleanup();
```

---

## Creating Custom Agents

1. Create `src/agents/myagent/` with `types.ts`, your sub-modules, and `index.ts`.
2. Create `src/agents/MyAgent.ts` extending `BaseAgent`.
3. Export from `src/agents/index.ts`.
4. Write tests in `src/agents/__tests__/MyAgent.test.ts`.

The full step-by-step guide with code templates is in [CONTRIBUTING.md](../../CONTRIBUTING.md#adding-a-new-agent).
