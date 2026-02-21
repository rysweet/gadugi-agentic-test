// Core exports
export { ProcessLifecycleManager, processLifecycleManager } from './core/ProcessLifecycleManager';
export { PtyTerminal } from './core/PtyTerminal';
/** @deprecated Use PtyTerminal instead - renamed to resolve naming conflict with agents/TUIAgent */
export { PtyTerminal as TUIAgent } from './core/PtyTerminal';
export { ResourceOptimizer, resourceOptimizer } from './core/ResourceOptimizer';
export {
  AdaptiveWaiter,
  adaptiveWaiter,
  waitFor,
  waitForOutput,
  waitForTerminalReady,
  waitForProcessStart,
  waitForProcessExit,
  retryOperation,
  delay,
  BackoffStrategy
} from './core/AdaptiveWaiter';

// Type exports
export type {
  ProcessInfo,
  ProcessEvents
} from './core/ProcessLifecycleManager';

export type {
  TerminalDimensions,
  PtyTerminalConfig,
  PtyTerminalEvents
} from './core/PtyTerminal';

/** @deprecated Use PtyTerminalConfig instead */
export type { PtyTerminalConfig as TUIAgentConfig } from './core/PtyTerminal';
/** @deprecated Use PtyTerminalEvents instead */
export type { PtyTerminalEvents as TUIAgentEvents } from './core/PtyTerminal';

export type {
  ResourceOptimizerConfig,
  ResourcePoolConfig,
  MemoryConfig,
  BufferConfig,
  ResourceMetrics,
  ResourceOptimizerEvents
} from './core/ResourceOptimizer';

export type {
  WaitCondition,
  WaitOptions,
  WaitResult
} from './core/AdaptiveWaiter';