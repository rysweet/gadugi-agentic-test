# Quality Audit Report — February 2026

**Date:** 2026-02-21
**Scope:** Full codebase (21,923 LOC, ~55 TypeScript source files)
**Method:** 4 parallel review agents + direct analysis
**Master Issue:** [#31](https://github.com/rysweet/gadugi-agentic-test/issues/31)

---

## Executive Summary

The audit identified **12 new GitHub issues** across security, bugs, architecture, and quality
categories. Five issues were fixed immediately as part of this audit session. Seven architectural
and quality issues require more substantial refactoring work.

---

## Issues Fixed During Audit

| Fix | File | Issue |
|-----|------|-------|
| `yaml.load()` now uses `JSON_SCHEMA` (prevents `!!js/function` code execution) | `src/utils/yamlParser.ts:120,198` | #20 |
| Path traversal check added to `processIncludes()` | `src/utils/yamlParser.ts:187` | #20 |
| Priority mapping corrected: medium→MEDIUM, low→LOW | `src/adapters/scenarioAdapter.ts:99` | #22 |
| Removed `strict: false` override from Jest ts-jest config | `jest.config.js:15` | — |
| Added coverage thresholds to jest.config.js | `jest.config.js` | #27 |

---

## Open Issues by Priority

### 🔴 Critical Security (Fix Immediately)

| Issue | File | Description |
|-------|------|-------------|
| [#19](https://github.com/rysweet/gadugi-agentic-test/issues/19) | `IssueReporter.ts:675` | Full `process.env` (including all secrets) embedded in GitHub issue bodies |
| [#30](https://github.com/rysweet/gadugi-agentic-test/issues/30) | `TUIAgent.ts:1195`, `CLIAgent.ts:828` | `process.env` global mutation causes cross-test contamination |

Additional security findings not yet tracked as issues:
- `IssueReporter.ts:451` — Screenshots uploaded to public GitHub Gists
- `IssueReporter.ts:648` — MD5 used for fingerprint hashing (use SHA-256)
- `ComprehensionAgent.ts:847` — OpenAI API key silently defaults to empty string
- `config.ts:186` — `GITHUB_TOKEN` written to disk via `exportToFile()`
- `SystemAgent.ts:714` — Shell injection via Docker container IDs

### 🔴 High Priority Bugs

| Issue | File | Description |
|-------|------|-------------|
| [#21](https://github.com/rysweet/gadugi-agentic-test/issues/21) | `cli.ts:361` | Watch command uses `Math.random()` simulation — never runs real tests |
| [#23](https://github.com/rysweet/gadugi-agentic-test/issues/23) | `TestOrchestrator.ts:507` | `executeParallel()` concurrency limit never enforced (splice no-op) |
| [#24](https://github.com/rysweet/gadugi-agentic-test/issues/24) | `logger.ts:440` | `setupLogger()` corrupts singleton via `Object.assign` |
| [#14](https://github.com/rysweet/gadugi-agentic-test/issues/14) | Multiple | Duplicate incompatible type systems (pre-existing) |

Additional bugs not yet tracked as issues:
- `ElectronUIAgent.ts:793` — All dialogs auto-accepted, suppresses real error dialogs
- `ComprehensionAgent.ts:427` — LLM failures silently return fake "Unknown Feature" specs
- `SmartUITestRunner.ts:427` — Hard-coded `waitForTimeout(1000)` (the exact anti-pattern this project fixes)
- `runners/index.ts:52` — Uses `require()` despite ES imports already at top of file
- `cli.ts:629` — List command hardcodes `disabled: 0`
- `orchestrator/index.ts:17` — Re-exports `TestScenario` type that doesn't exist in `TestModels.ts`
- `scenarioAdapter.ts:32` — `adaptScenarioToComplex()` always generates new UUID, losing original scenario ID
- `scenarios/index.ts:45` — `convertLegacyFormat()` silently drops all scenarios after the first
- `IssueReporter.ts:854` — Rate limit wait blocks entire agent for up to 1 hour

### 🟠 Architecture Issues

| Issue | Files | Description |
|-------|-------|-------------|
| [#25](https://github.com/rysweet/gadugi-agentic-test/issues/25) | `core/TUIAgent.ts`, `agents/TUIAgent.ts` | Two incompatible `TUIAgent` classes with the same name |
| [#26](https://github.com/rysweet/gadugi-agentic-test/issues/26) | `cli.ts`, `main.ts` | Dual CLI entry points with divergent defaults; `main.ts` parses argv on import |
| [#29](https://github.com/rysweet/gadugi-agentic-test/issues/29) | Multiple | `IssueReporter.execute()` always throws; 5 other stub methods silently return empty |

Additional architecture findings:
- `ElectronUIAgent.ts:21` — Duplicates entire Socket.IO client (should delegate to WebSocketAgent)
- `ComprehensiveUITestRunner.ts` — Near-duplicate of SmartUITestRunner, needs `BaseUITestRunner`
- `utils/index.ts:13` — `LegacyConfigManager` and `legacyLogger` are dead duplicates that expose secrets at import time
- `scenarios/index.ts:87` — `TestScenario` defined twice with incompatible shapes (see also #14)
- `src/index.ts` — Public library entry point missing agent/orchestrator exports entirely
- `TestOrchestrator.ts:725` — `reportFailures()` is a no-op stub

### 🟡 Quality & Coverage Issues

| Issue | Files | Description |
|-------|-------|-------------|
| [#27](https://github.com/rysweet/gadugi-agentic-test/issues/27) | Multiple | Zero test coverage for 9 major modules (orchestrator, 7 agents, 2 runners) |
| [#28](https://github.com/rysweet/gadugi-agentic-test/issues/28) | `src/agents/` | All 9 agent files exceed 300 LOC (894–1325 LOC); `deepEqual` and `delay` duplicated 3–4× |

---

## Metrics

| Category | Count |
|----------|-------|
| Files audited | ~55 |
| Total LOC | 21,923 |
| Issues created | 12 |
| Issues fixed during audit | 5 |
| Critical security findings | 7 |
| High severity bugs | 10 |
| Architecture issues | 10 |
| Quality / coverage issues | 5 |
| Untested production LOC (approx.) | ~9,455 (43%) |

---

## Recommended Fix Order

**Immediate (security, high impact, low effort):**
1. Fix #19 — remove `process.env` from issue template vars (1 line)
2. Fix #30 — pass env to spawn options instead of mutating `process.env` (2 files)

**Sprint 1 (correctness):**
3. Fix #23 — replace broken `executeParallel()` with `p-limit`
4. Fix #21 — replace `Math.random()` watch simulation with real orchestrator
5. Fix #24 — replace `Object.assign` singleton mutation with proxy pattern

**Sprint 2 (architecture):**
6. Fix #25 — rename one TUIAgent to eliminate naming collision
7. Fix #26 — consolidate to single CLI entry point
8. Fix remaining stubs per #29

**Ongoing:**
9. Add tests per #27, starting with `TestOrchestrator` and `ScenarioLoader`
10. Split modules per #28, starting with duplicate extraction (`delay`, `deepEqual`)
