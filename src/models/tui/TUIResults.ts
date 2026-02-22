/**
 * TUI test result types, assertions, and action definitions
 */

import { TUIPosition, TUIStyle, TUIInteraction, TUIState } from './TUISession';

/**
 * Region definition for area-based assertions
 */
export interface TUIRegion {
  /** Top-left corner */
  start: TUIPosition;
  /** Bottom-right corner */
  end: TUIPosition;
}

/**
 * Text assertion types for TUI content verification
 */
export enum TUITextAssertionType {
  EXACT_MATCH = 'EXACT_MATCH',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  REGEX_MATCH = 'REGEX_MATCH',
  NOT_CONTAINS = 'NOT_CONTAINS'
}

/**
 * Position assertion types for TUI element verification
 */
export enum TUIPositionAssertionType {
  AT_POSITION = 'AT_POSITION',
  IN_REGION = 'IN_REGION',
  CURSOR_AT = 'CURSOR_AT',
  RELATIVE_TO = 'RELATIVE_TO'
}

/**
 * Style assertion types for TUI visual verification
 */
export enum TUIStyleAssertionType {
  HAS_STYLE = 'HAS_STYLE',
  HAS_COLOR = 'HAS_COLOR',
  IS_HIGHLIGHTED = 'IS_HIGHLIGHTED',
  IS_BOLD = 'IS_BOLD',
  IS_UNDERLINED = 'IS_UNDERLINED'
}

/**
 * Screen assertion types for TUI state verification
 */
export enum TUIScreenAssertionType {
  SCREEN_SIZE = 'SCREEN_SIZE',
  TITLE_EQUALS = 'TITLE_EQUALS',
  CURSOR_VISIBLE = 'CURSOR_VISIBLE',
  ALT_SCREEN_ACTIVE = 'ALT_SCREEN_ACTIVE',
  PROCESS_RUNNING = 'PROCESS_RUNNING'
}

/**
 * Text content verification assertion
 */
export interface TUITextAssertion {
  type: TUITextAssertionType;
  /** Text content to verify */
  text: string;
  /** Position or region to check */
  target?: TUIPosition | TUIRegion;
  /** Case sensitivity flag */
  caseSensitive?: boolean;
  /** Description of assertion */
  description?: string;
}

/**
 * Position-based verification assertion
 */
export interface TUIPositionAssertion {
  type: TUIPositionAssertionType;
  /** Expected position */
  position: TUIPosition;
  /** Target element or text to locate */
  target?: string;
  /** Tolerance for position matching */
  tolerance?: number;
  /** Description of assertion */
  description?: string;
}

/**
 * Style-based verification assertion
 */
export interface TUIStyleAssertion {
  type: TUIStyleAssertionType;
  /** Expected style attributes */
  style: Partial<TUIStyle>;
  /** Position or region to check */
  target: TUIPosition | TUIRegion;
  /** Description of assertion */
  description?: string;
}

/**
 * Screen state verification assertion
 */
export interface TUIScreenAssertion {
  type: TUIScreenAssertionType;
  /** Expected value */
  expected: any;
  /** Description of assertion */
  description?: string;
}

/**
 * Union type for all TUI assertion types
 */
export type TUIAssertion =
  | TUITextAssertion
  | TUIPositionAssertion
  | TUIStyleAssertion
  | TUIScreenAssertion;

/**
 * TUI test action types
 */
export enum TUIActionType {
  // Input actions
  TYPE = 'TYPE',
  KEY_PRESS = 'KEY_PRESS',
  KEY_COMBINATION = 'KEY_COMBINATION',
  MOUSE_CLICK = 'MOUSE_CLICK',
  MOUSE_DRAG = 'MOUSE_DRAG',
  SCROLL = 'SCROLL',

  // Control actions
  RESIZE = 'RESIZE',
  CLEAR_SCREEN = 'CLEAR_SCREEN',
  SEND_SIGNAL = 'SEND_SIGNAL',

  // Wait actions
  WAIT_FOR_TEXT = 'WAIT_FOR_TEXT',
  WAIT_FOR_CURSOR = 'WAIT_FOR_CURSOR',
  WAIT_FOR_PROCESS = 'WAIT_FOR_PROCESS',
  WAIT_FOR_SCREEN = 'WAIT_FOR_SCREEN',

  // Capture actions
  CAPTURE_SCREEN = 'CAPTURE_SCREEN',
  CAPTURE_REGION = 'CAPTURE_REGION',
  START_RECORDING = 'START_RECORDING',
  STOP_RECORDING = 'STOP_RECORDING',

  // Assertion actions
  ASSERT_TEXT = 'ASSERT_TEXT',
  ASSERT_POSITION = 'ASSERT_POSITION',
  ASSERT_STYLE = 'ASSERT_STYLE',
  ASSERT_SCREEN = 'ASSERT_SCREEN'
}

/**
 * TUI test step definition for YAML scenarios
 */
export interface TUITestStep {
  /** Action type to perform */
  action: TUIActionType;

  /** Target for the action (text, position, etc.) */
  target?: string | TUIPosition | TUIRegion;

  /** Value to input or parameter for action */
  value?: string | number | TUIInteraction;

  /** Timeout for this step in milliseconds */
  timeout?: number;

  /** Wait condition after action */
  waitFor?: {
    type: 'text' | 'cursor' | 'process' | 'screen' | 'time';
    condition: string | TUIPosition | number;
    timeout?: number;
  };

  /** Assertions to verify after action */
  assertions?: TUIAssertion[];

  /** Expected result description */
  expected?: string;

  /** Human-readable description */
  description?: string;

  /** Whether to continue on failure */
  continueOnFailure?: boolean;

  /** Retry configuration for this step */
  retry?: {
    attempts: number;
    delay: number;
  };

  /** Screenshot configuration */
  screenshot?: {
    before?: boolean;
    after?: boolean;
    onFailure?: boolean;
    filename?: string;
  };
}

/**
 * TUI verification types for test results
 */
export enum TUIVerificationType {
  SCREEN_CONTENT = 'SCREEN_CONTENT',
  CURSOR_POSITION = 'CURSOR_POSITION',
  TERMINAL_STATE = 'TERMINAL_STATE',
  PROCESS_STATE = 'PROCESS_STATE',
  OUTPUT_STREAM = 'OUTPUT_STREAM',
  VISUAL_STYLE = 'VISUAL_STYLE',
  INTERACTION_RESPONSE = 'INTERACTION_RESPONSE'
}

/**
 * TUI test result with terminal-specific data
 */
export interface TUITestResult {
  /** Base test result properties */
  scenarioId: string;
  status: import('../TestModels').TestStatus;
  duration: number;
  startTime: Date;
  endTime: Date;
  error?: string;

  /** TUI-specific result data */
  tui: {
    /** Initial terminal state */
    initialState: TUIState;
    /** Final terminal state */
    finalState: TUIState;
    /** All interactions performed */
    interactions: TUIInteraction[];
    /** Screen captures taken */
    screenshots: string[];
    /** Terminal session recording */
    recording?: string;
    /** Verification results */
    verifications: {
      type: TUIVerificationType;
      passed: boolean;
      message: string;
      expected?: any;
      actual?: any;
    }[];
    /** Performance metrics */
    performance: {
      /** Average response time for interactions */
      avgResponseTime: number;
      /** Screen refresh rate achieved */
      refreshRate: number;
      /** Memory usage during test */
      memoryUsage: number;
    };
  };
}
