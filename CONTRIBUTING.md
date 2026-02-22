# Contributing to @gadugi/agentic-test

Thank you for contributing to the Gadugi Agentic Test Framework. This guide covers everything you need to get started.

## Contents

- [Quick Start for Contributors](#quick-start-for-contributors)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Running Tests](#running-tests)
- [Adding a New Agent](#adding-a-new-agent)
- [Code Standards](#code-standards)
- [Making a PR](#making-a-pr)
- [Security](#security)

---

## Quick Start for Contributors

```bash
git clone https://github.com/rysweet/gadugi-agentic-test.git
cd gadugi-agentic-test
npm install
npm test  # Verify baseline passes
```

All 249+ tests should pass before you start work. If any fail, check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) before proceeding.

---

## Development Setup

### Requirements

- **Node.js 20+** (CI runs on 20.x and 22.x)
- **npm 9+**
- **Native build tools** — required for `node-pty`
  - macOS: `xcode-select --install`
  - Ubuntu/Debian: `sudo apt-get install -y build-essential`
  - Windows: `npm install --global windows-build-tools`

### Environment Variables

```bash
# Required for AI-powered agents (ComprehensionAgent, PriorityAgent)
export OPENAI_API_KEY=sk-...

# Required only for integration tests that create GitHub issues
export GITHUB_TOKEN=ghp_...
```

Copy `.env.example` to `.env` and fill in values. The `.env` file is git-ignored; never commit credentials.

### IDE Recommendations

- **VS Code** with the [TypeScript + JavaScript](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-next) extension
- Enable strict mode checking: the project uses `"strict": true` in `tsconfig.json`
- Install the [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) — linting runs in CI

---

## Project Structure

The project follows a split-module architecture where each agent and utility is decomposed into single-responsibility sub-modules. See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full breakdown.

High-level layout:

```
src/
├── agents/         # 9 agent implementations, each with a sub-module directory
├── core/           # PtyTerminal, AdaptiveWaiter, ProcessLifecycleManager, ResourceOptimizer
├── orchestrator/   # TestOrchestrator
├── runners/        # SmartUITestRunner, ComprehensiveUITestRunner
├── utils/          # Logging, config, retry, file ops, screenshot — all split into sub-modules
├── models/         # Shared TypeScript interfaces
├── adapters/       # scenarioAdapter
├── scenarios/      # ScenarioDefinition type and ScenarioLoader
├── cli.ts          # Single CLI entry point (Commander)
├── lib.ts          # Programmatic API (no side effects)
└── index.ts        # Full public API
```

---

## Running Tests

```bash
# Full suite
npm test

# One specific agent
npm test -- --testPathPattern=TUIAgent

# With coverage report
npm run test:coverage

# Sequential (avoids timing interference between tests)
npx jest --runInBand
```

Tests live in `src/**/__tests__/` alongside the source they cover. The Jest config is in `jest.config.js`.

---

## Adding a New Agent

All agents follow the same decomposed structure. Use `WebSocketAgent` as a reference — it has the clearest split.

### Step 1: Create the sub-module directory

```bash
mkdir src/agents/myagent
```

### Step 2: Create `types.ts`

Define the config interface and any agent-specific types:

```typescript
// src/agents/myagent/types.ts
export interface MyAgentConfig {
  targetUrl: string;
  timeout?: number;
}
```

### Step 3: Implement focused sub-modules

Each file should do exactly one thing and stay under 300 lines:

```
src/agents/myagent/
├── types.ts            # Config interfaces and enums
├── MyAgentConnector.ts # Handles connection setup
├── MyAgentExecutor.ts  # Runs individual steps
├── MyAgentParser.ts    # Parses responses
└── index.ts            # Re-exports everything
```

### Step 4: Create the thin facade

The main agent file extends `BaseAgent` and delegates to sub-modules:

```typescript
// src/agents/MyAgent.ts
import { BaseAgent } from './BaseAgent';
import { AgentType, IAgent } from './index';
import { MyAgentConfig } from './myagent/types';
import { MyAgentConnector } from './myagent/MyAgentConnector';
import { MyAgentExecutor } from './myagent/MyAgentExecutor';
import { ExecutionContext } from './BaseAgent';
import { OrchestratorScenario, StepResult } from '../models/TestModels';

export class MyAgent extends BaseAgent implements IAgent {
  readonly name = 'MyAgent';
  readonly type = AgentType.CUSTOM;

  private connector: MyAgentConnector;
  private executor: MyAgentExecutor;

  constructor(private config: MyAgentConfig) {
    super();
    this.connector = new MyAgentConnector(config);
    this.executor = new MyAgentExecutor(config);
  }

  async initialize(): Promise<void> {
    await this.connector.connect();
    this.isInitialized = true;
  }

  async cleanup(): Promise<void> {
    await this.connector.disconnect();
  }

  async executeStep(step: any, index: number): Promise<StepResult> {
    return this.executor.run(step, index);
  }

  buildResult(scenario: OrchestratorScenario, ctx: ExecutionContext) {
    return { scenarioId: scenario.id, ...ctx };
  }
}
```

### Step 5: Export from agents index

Add your agent to `src/agents/index.ts`:

```typescript
export { MyAgent } from './MyAgent';
export type { MyAgentConfig } from './myagent/types';
```

### Step 6: Write tests

Create `src/agents/__tests__/MyAgent.test.ts`. The test file for `TUIAgent` is a good reference for structure.

---

## Code Standards

### Module size limit

**300 lines maximum per file.** If a module exceeds this, decompose it into sub-modules following the existing pattern (see `src/agents/system/` or `src/utils/screenshot/`).

### Single responsibility (brick philosophy)

Each file does one thing. `WebSocketConnection.ts` manages the connection. `WebSocketMessageHandler.ts` handles messages. They do not overlap.

### Zero stubs

No placeholder comments, no `// TODO: implement`, no empty function bodies. If a feature is not ready, do not merge it. If you are writing ahead of implementation (document-driven development), mark it clearly with `[PLANNED]` and open a tracking issue.

### Tests required

All new code needs tests. No PR merges without test coverage for new public methods. Run `npm run test:coverage` and confirm your additions are covered.

### TypeScript strict mode

The project uses `"strict": true`. No `any` escapes unless absolutely necessary and explicitly justified in a comment. No `@ts-ignore` without an explanation.

### Shared utilities

Before adding a new utility, check `src/utils/`. Common patterns are already extracted:

- Delays: `delay()` from `src/utils/async.ts`
- Deep equality: `deepEqual()` from `src/utils/comparison.ts`
- ID generation: `generateId()` from `src/utils/ids.ts`
- Config sanitization: `sanitizeConfigWithEnv()` from `src/utils/agentUtils.ts`
- ANSI colors: `src/utils/colors.ts`

---

## Making a PR

### Branch naming

```
fix/issue-N-short-description
refactor/what-is-changing
feat/new-feature-name
docs/what-is-documented
chore/housekeeping-task
```

### Commit message format

Use the imperative mood and reference the issue number:

```
fix: remove stub from TUIAgent.executeStep (#117)
refactor: split SystemAgent into four sub-modules (#28)
feat: add CircuitBreaker to retry utilities (#31)
docs: add CONTRIBUTING guide
```

### PR description template

```markdown
## What this changes
<!-- One paragraph: what problem does this solve? -->

## How it works
<!-- Brief explanation of the approach -->

## Testing
<!-- How did you verify this? -->

## Checklist
- [ ] All existing tests pass (`npm test`)
- [ ] New code has tests
- [ ] No module exceeds 300 lines
- [ ] No stubs or placeholder code
- [ ] CI passes on Node 20.x and 22.x
```

### CI requirements

Both Node 20.x and Node 22.x matrix jobs must pass. Do not merge if either is red. The CI runs `npm test` and `npm run build`.

---

## Security

**Never commit credentials.** The `.env` file is git-ignored. Verify with `git status` before committing.

If you discover a security vulnerability, create a GitHub issue and label it `security`. Do not include exploit details in the public issue — link to a private disclosure if needed.
