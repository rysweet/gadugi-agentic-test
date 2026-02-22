# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Added
- `docs/ARCHITECTURE.md` — comprehensive architecture reference

---

## [1.0.0] - 2026-02-22

### Added
- Initial release of `@gadugi/agentic-test`, a TypeScript multi-agent testing
  framework for Electron and TUI applications
- Nine specialised test agents: `TUIAgent`, `CLIAgent`, `APIAgent`,
  `WebSocketAgent`, `ElectronUIAgent`, `ComprehensionAgent`, `IssueReporter`,
  `PriorityAgent`, `SystemAgent`
- `BaseAgent` abstract base class (template-method pattern) that provides a
  shared `execute()` loop, eliminating ~200 lines of duplicated boilerplate
  across all test-executing agents (#117, #118, PR #125)
- `TestOrchestrator` with `ScenarioRouter`, `SessionManager`, and
  `ResultAggregator` sub-modules for parallel scenario dispatch and result
  collection (#50, PR #65)
- `PtyTerminal` (renamed from `core/TUIAgent`) — PTY-based terminal manager
  wrapping `node-pty-prebuilt-multiarch` with zombie-process prevention (#14,
  #25, PR #73)
- `ProcessLifecycleManager` — tracks and terminates spawned child processes on
  test completion
- `AdaptiveWaiter` — condition-based waiting with configurable backoff
  strategies (`LINEAR`, `EXPONENTIAL`, `FIXED`), replacing hard-coded
  `setTimeout` calls
- `ResourceOptimizer` with `ConcurrencyOptimizer`, `CpuOptimizer`, and
  `MemoryOptimizer` sub-modules (#50, PR #65)
- `SmartUITestRunner` and `ComprehensiveUITestRunner` with sub-modules for
  adaptive and exhaustive Playwright-based UI testing (#52, PR #72)
- `src/lib.ts` — programmatic API (`runTests()`) with no process-level side
  effects; signal handlers remain in `src/cli.ts` only (#26, PR #58)
- `src/cli.ts` — single Commander entry point; all command logic extracted to
  `src/cli/commands/` (#44, #26, PRs #58, #64)
- `src/cli-path-utils.ts` — path traversal guard for CLI `--directory`,
  `--file`, `--config`, and `--env` flags (#93, PR #94)
- `ScenarioDefinition` type in `src/scenarios/` as the canonical YAML-facing
  schema; `OrchestratorScenario` in `src/models/` as the internal execution
  type (#14, #25, PR #73)
- `src/adapters/scenarioAdapter.ts` — converts `ScenarioDefinition` to
  `OrchestratorScenario` with corrected priority mapping (medium→MEDIUM,
  low→LOW) (#22)
- `src/utils/async.ts` with `delay()` — single canonical async sleep,
  eliminating duplicate implementations across agents (#118)
- `src/utils/comparison.ts` with `deepEqual()` — single canonical deep
  equality, eliminating duplicate implementations (#118)
- `src/utils/agentUtils.ts` — shared agent utility functions extracted from
  agents during BaseAgent consolidation (#117, #118)
- 249 unit tests across the codebase; 145 new tests covering
  `AdaptiveWaiter`, `ProcessLifecycleManager`, `ResourceOptimizer`,
  `PtyTerminal`, `SystemAgent`, `ComprehensionAgent`, `yamlParser`, `config`,
  `scenarioLoader`, `scenarioAdapter`, and `retry` (#27, PR #270578e)
- `docs/quality-audit-2026-02.md` — full quality audit report (15 issues,
  all resolved)
- `docs/ResourceOptimizer.md` — ResourceOptimizer reference
- `docs/screenshot-diff-guide.md` — screenshot comparison guide

### Changed
- Split all oversized agent files (894–1,325 LOC) into focused sub-modules
  under `agents/<type>/`. Files affected: `TUIAgent` (1,311 LOC → 5
  sub-modules), `ElectronUIAgent` (1,101 LOC → 4), `PriorityAgent` (1,129
  LOC → 3), `WebSocketAgent` (1,094 LOC → 4), `CLIAgent` (939 LOC → 2),
  `APIAgent` (937 LOC → 3), `IssueReporter` (924 LOC → 3),
  `ComprehensionAgent` (894 LOC → 3) (#47, #48, #51–#53, #62–#69, PRs
  #61–#68, #121)
- Split `TestOrchestrator` (887 LOC) into `ScenarioRouter`, `SessionManager`,
  and `ResultAggregator` (#50, PR #65)
- Split `ResourceOptimizer` (817 LOC) into `ConcurrencyOptimizer`,
  `CpuOptimizer`, and `MemoryOptimizer` (#50, PR #65)
- Split `cli.ts` (1,141 LOC) into seven focused command modules in
  `src/cli/commands/` (#44, PR #64)
- Split `fileUtils.ts` (772 LOC) and `config.ts` (648 LOC) into sub-module
  directories (#51, PR #63)
- Split `TUIModels`, `retry`, `yamlParser`, and `logger` into sub-module
  directories (#53, PR #68)
- Split `SystemAgent` and `screenshot.ts` into sub-module directories (#28,
  PR #f3434f1)
- `ElectronWebSocketMonitor` now delegates to `WebSocketAgent` instead of
  duplicating Socket.IO client logic (#115, PR #123)
- `DocumentationLoader` extracted from `ComprehensionAgent`; hardcoded
  application regexes removed (#119, PR #121)
- `archiveRun` renamed to `exportManifest`; scenario IDs are now deterministic
  (no random UUIDs on re-load) (#108, PR #110)
- Removed dead code: `PTYManager.ts` was never imported and has been deleted
  (#42, PR #58)
- Removed global `uncaughtException`/`unhandledRejection` handlers from
  library module (`src/lib.ts`); handlers belong in CLI entry points only
  (#77, PR #92)
- `isolatedModules` removed from Jest ts-jest config (deprecated flag); test
  coverage thresholds raised (#54, PR #74)
- Reduced `any` type usages from 175 to 140 in `src/` (#55, PR #71)
- `src/index.ts` now exports all agents, orchestrator, and library functions
  as the full public API (#29, PR #d911700)

### Fixed
- `reportFailures()` in `TestOrchestrator` now calls `IssueReporter.createIssue()`
  for each failure; previous implementation was a no-op stub (#76, PR #87)
- `IssueReporter.execute()` now implements the `IAgent` contract and returns a
  real result; previous implementation always threw (#95, PR #101)
- `PriorityAgent` stub methods replaced with real implementations (#97, PR #103)
- `runTests()` TypeError and `parseYamlScenarios` alias bug resolved (#105, PR #113)
- Watch command now uses `TestOrchestrator.runWithScenarios()` with pre-loaded
  scenarios instead of re-running full discovery (#21, PR #87)
- `executeParallel()` semaphore now correctly enforces `maxParallel` concurrency
  limit (#23, PR #87)
- `setupLogger()` now swaps the `_activeLogger` reference rather than mutating
  the existing instance (#24, PR #87)
- Real CPU monitoring implemented in `TUIAgent.collectPerformanceMetrics()`
  (#41, PR #60)
- Test isolation for `SystemAgent` (silences EACCES from chokidar) and
  `ZombieProcessPrevention` (no longer affects system-wide processes) (#39,
  #40, PRs #59, #70)
- `exec` added to child_process mock in `TUIAgent.test.ts` (#37, PR #57)
- Octal escape sequences (`\033`) replaced with hex (`\x1b`) in terminal
  integration tests (#38, PR #56)
- `dynamic require(zlib)` replaced with static import; `Function` type
  replaced with proper signatures (#78, PR #82)
- Non-alert Electron dialogs now dismissed correctly; dialog events emitted
  (#116, PR #122)
- LLM errors now propagate from `ComprehensionAgent` instead of returning a
  silent "Unknown Feature" fallback (#96, PR #100)
- API key validation added; `apiVersion` added to default config (#96, PR #100)
- Test failures caused by module-split merges resolved (PR #ccaaf30)
- Medium/low quality issues bundled from audit resolved (#109, #120, PRs #114,
  #124)
- `process.env` mutation removed from `TUIAgent` and `CLIAgent`; environment
  variables are now stored in local config only (#30, PR #d911700)

### Security
- YAML deserialization: all `yaml.load()` calls now use `yaml.JSON_SCHEMA`,
  blocking `!!js/function` and other code-execution tags (#83, PR #90)
- Path traversal in YAML `processIncludes()` blocked (#83, PR #90)
- Credential exposure: `process.env` snapshot no longer written to disk
  via `exportToFile()`; `getSafeEnvironment()` allowlist applied when
  embedding environment data in GitHub issue bodies (#84, #19, PRs #91,
  #d911700)
- CLI path traversal: `--directory`, `--file`, `--config`, and `--env` flags
  validated through `safeResolvePath()` (#93, PR #94)
- CLI error output sanitised; timeout bounds validated to prevent
  integer-overflow denial of service (#85, #86, PR #88)
- Shell injection in `DockerMonitor` blocked; public GitHub Gist screenshot
  upload removed (#98, PR #104)
- `sendControl()` injection attack surface closed; config prototype pollution
  prevented (#107, PR #111)
- ReDoS in `filterByPatterns()` fixed; path traversal in `cleanup()` blocked
  (#106, PR #112)

---

[Unreleased]: https://github.com/rysweet/gadugi-agentic-test/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rysweet/gadugi-agentic-test/releases/tag/v1.0.0
