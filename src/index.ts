// Core exports
export { ProcessLifecycleManager, processLifecycleManager } from './core/ProcessLifecycleManager';
export { TUIAgent } from './core/TUIAgent';
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
  TUIAgentConfig,
  TUIAgentEvents
} from './core/TUIAgent';

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