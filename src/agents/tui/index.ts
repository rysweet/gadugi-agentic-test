/**
 * TUI sub-module barrel export
 *
 * Re-exports all sub-module classes, functions, and shared types
 * so they can be consumed by the main TUIAgent facade.
 */

export { TUISessionManager } from './TUISessionManager';
export { TUIInputSimulator } from './TUIInputSimulator';
export { TUIMenuNavigator } from './TUIMenuNavigator';
export type { MenuNavigatorDeps } from './TUIMenuNavigator';
export { dispatchStep } from './TUIStepDispatcher';
export type { StepDispatcherDeps } from './TUIStepDispatcher';

export {
  stripAnsiCodes,
  parseColors,
  getLatestOutput,
  performOutputValidation,
  arraysEqual
} from './TUIOutputParser';

export type {
  TUIAgentConfig,
  TerminalSession,
  TerminalOutput,
  ColorInfo,
  PerformanceMetrics,
  InputSimulation,
  MenuNavigation,
} from './types';

export { DEFAULT_CONFIG } from './types';
