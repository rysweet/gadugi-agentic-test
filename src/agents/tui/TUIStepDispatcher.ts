/**
 * TUIStepDispatcher - Test step action routing for TUIAgent
 *
 * Translates TestStep actions into calls on the TUIAgent public API.
 * Keeps the switch-based dispatch logic out of the TUIAgent facade,
 * which would otherwise inflate its line count.
 */

import { TestStep, TestStatus, StepResult } from '../../models/TestModels';
import { TestLogger } from '../../utils/logger';
import { delay } from '../../utils/async';
import { ColorInfo, InputSimulation, MenuNavigation, TerminalOutput } from './types';

/**
 * Callbacks that TUIStepDispatcher uses to interact with the TUIAgent
 */
export interface StepDispatcherDeps {
  spawnTUI(command: string, args: string[]): Promise<string>;
  sendInput(sessionId: string, input: string | InputSimulation): Promise<void>;
  navigateMenu(sessionId: string, path: string[]): Promise<MenuNavigation>;
  validateOutput(sessionId: string, expected: unknown): Promise<boolean>;
  validateFormatting(sessionId: string, expectedColors: ColorInfo[]): Promise<boolean>;
  captureOutput(sessionId: string): TerminalOutput | null;
  waitForOutputPattern(sessionId: string, pattern: string, timeout: number): Promise<void>;
  resizeTerminal(sessionId: string, cols: number, rows: number): void;
  killSession(sessionId: string): Promise<void>;
  getMostRecentSessionId(): string;
  defaultTimeout: number;
}

/**
 * Dispatches a single TestStep action to the appropriate TUIAgent method
 *
 * @param step - The test step to execute
 * @param stepIndex - Index in the scenario (for logging)
 * @param deps - TUIAgent dependency callbacks
 * @param logger - Logger instance
 * @returns StepResult with status, duration, and any result/error
 */
export async function dispatchStep(
  step: TestStep,
  stepIndex: number,
  deps: StepDispatcherDeps,
  logger: TestLogger
): Promise<StepResult> {
  const startTime = Date.now();
  logger.stepExecution(stepIndex, step.action, step.target);

  try {
    const result = await executeAction(step, deps);
    const duration = Date.now() - startTime;
    logger.stepComplete(stepIndex, TestStatus.PASSED, duration);

    return {
      stepIndex,
      status: TestStatus.PASSED,
      duration,
      actualResult: typeof result === 'string' ? result : JSON.stringify(result)
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.stepComplete(stepIndex, TestStatus.FAILED, duration);

    return {
      stepIndex,
      status: TestStatus.FAILED,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function executeAction(step: TestStep, deps: StepDispatcherDeps): Promise<any> {
  const getSessionId = () => step.target || deps.getMostRecentSessionId();

  switch (step.action.toLowerCase()) {
    case 'spawn':
    case 'spawn_tui': {
      const parts = step.target.split(' ');
      return deps.spawnTUI(parts[0], parts.slice(1));
    }
    case 'send_input':
    case 'input': {
      const inputSim: InputSimulation = {
        keys: step.value || '',
        waitForStabilization: true,
        ...(step.timeout ? { timeout: step.timeout } : {})
      };
      await deps.sendInput(getSessionId(), inputSim);
      return 'Input sent successfully';
    }
    case 'navigate_menu': {
      const path = step.value ? step.value.split(',').map((s: string) => s.trim()) : [];
      return deps.navigateMenu(getSessionId(), path);
    }
    case 'validate_output':
      return deps.validateOutput(getSessionId(), step.expected || step.value);
    case 'validate_colors':
    case 'validate_formatting': {
      let expectedColors: ColorInfo[];
      try {
        expectedColors = JSON.parse(step.value || '[]');
      } catch {
        throw new Error('Invalid color validation format. Expected JSON array of ColorInfo objects.');
      }
      return deps.validateFormatting(getSessionId(), expectedColors);
    }
    case 'capture_output':
      return deps.captureOutput(getSessionId());
    case 'wait_for_output':
      await deps.waitForOutputPattern(
        getSessionId(),
        step.value || '',
        step.timeout || deps.defaultTimeout
      );
      return 'Pattern found';
    case 'resize_terminal': {
      const [cols, rows] = (step.value || '80,24').split(',').map(Number);
      deps.resizeTerminal(getSessionId(), cols, rows);
      return 'Terminal resized successfully';
    }
    case 'kill_session':
      await deps.killSession(getSessionId());
      return 'Session killed successfully';
    case 'wait': {
      const waitTime = parseInt(step.value || '1000');
      await delay(waitTime);
      return `Waited ${waitTime}ms`;
    }
    default:
      throw new Error(`Unsupported TUI action: ${step.action}`);
  }
}
