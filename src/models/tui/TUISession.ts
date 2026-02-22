/**
 * TUI session, state, and interaction types
 */

/**
 * Terminal screen position coordinates
 */
export interface TUIPosition {
  /** Row position (0-based) */
  row: number;
  /** Column position (0-based) */
  column: number;
}

/**
 * Terminal color and style attributes
 */
export interface TUIStyle {
  /** Foreground color (ANSI color code or hex) */
  foreground?: string;
  /** Background color (ANSI color code or hex) */
  background?: string;
  /** Text decoration flags */
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  /** Brightness/intensity */
  bright?: boolean;
  /** Inverted colors */
  inverse?: boolean;
}

/**
 * Terminal screen cell representing a single character position
 */
export interface TUICell {
  /** Character content */
  character: string;
  /** Style attributes */
  style: TUIStyle;
  /** Position in terminal */
  position: TUIPosition;
}

/**
 * Terminal screen state representation
 */
export interface TUIState {
  /** Terminal dimensions */
  dimensions: import('./TUIConfig').TUIDimensions;
  /** Cursor position */
  cursor: TUIPosition;
  /** All terminal cells */
  cells: TUICell[][];
  /** Raw terminal buffer content */
  buffer: string;
  /** Terminal title */
  title?: string;
  /** Cursor visibility */
  cursorVisible: boolean;
  /** Alternative screen buffer active */
  altScreenActive?: boolean;
  /** Scrollback buffer content */
  scrollback?: string[];
  /** Current working directory */
  workingDirectory?: string;
  /** Active process information */
  activeProcess?: {
    pid: number;
    command: string;
    args: string[];
  };
}

/**
 * Keyboard event types
 */
export enum TUIKeyType {
  PRINTABLE = 'PRINTABLE',
  SPECIAL = 'SPECIAL',
  FUNCTION = 'FUNCTION',
  MODIFIER = 'MODIFIER',
  COMBINATION = 'COMBINATION'
}

/**
 * Special key identifiers
 */
export enum TUISpecialKey {
  ENTER = 'ENTER',
  TAB = 'TAB',
  ESCAPE = 'ESCAPE',
  BACKSPACE = 'BACKSPACE',
  DELETE = 'DELETE',
  INSERT = 'INSERT',
  HOME = 'HOME',
  END = 'END',
  PAGE_UP = 'PAGE_UP',
  PAGE_DOWN = 'PAGE_DOWN',
  ARROW_UP = 'ARROW_UP',
  ARROW_DOWN = 'ARROW_DOWN',
  ARROW_LEFT = 'ARROW_LEFT',
  ARROW_RIGHT = 'ARROW_RIGHT'
}

/**
 * Modifier key flags
 */
export interface TUIModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Keyboard input event
 */
export interface TUIKeyEvent {
  /** Key type */
  type: TUIKeyType;
  /** Key identifier */
  key: string | TUISpecialKey;
  /** Modifier keys pressed */
  modifiers: TUIModifiers;
  /** Raw key code */
  keyCode?: number;
  /** Unicode code point */
  unicode?: number;
  /** Human-readable description */
  description?: string;
}

/**
 * Mouse event types
 */
export enum TUIMouseEventType {
  CLICK = 'CLICK',
  DOUBLE_CLICK = 'DOUBLE_CLICK',
  RIGHT_CLICK = 'RIGHT_CLICK',
  SCROLL = 'SCROLL',
  DRAG = 'DRAG',
  MOVE = 'MOVE'
}

/**
 * Mouse button identifiers
 */
export enum TUIMouseButton {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  MIDDLE = 'MIDDLE',
  WHEEL_UP = 'WHEEL_UP',
  WHEEL_DOWN = 'WHEEL_DOWN'
}

/**
 * Mouse input event
 */
export interface TUIMouseEvent {
  /** Event type */
  type: TUIMouseEventType;
  /** Mouse button involved */
  button: TUIMouseButton;
  /** Position where event occurred */
  position: TUIPosition;
  /** Modifier keys pressed */
  modifiers: TUIModifiers;
  /** Number of clicks (for click events) */
  clickCount?: number;
  /** Scroll delta (for scroll events) */
  scrollDelta?: {
    x: number;
    y: number;
  };
}

/**
 * Terminal resize event
 */
export interface TUIResizeEvent {
  /** New terminal dimensions */
  dimensions: import('./TUIConfig').TUIDimensions;
  /** Previous dimensions */
  previousDimensions: import('./TUIConfig').TUIDimensions;
}

/**
 * Union type for all TUI interaction events
 */
export type TUIInteraction = TUIKeyEvent | TUIMouseEvent | TUIResizeEvent;

/**
 * TUI session management
 */
export interface TUISession {
  /** Unique session identifier */
  id: string;
  /** Session start time */
  startTime: Date;
  /** Session end time */
  endTime?: Date;
  /** Terminal configuration used */
  config: import('./TUIConfig').TUIConfig;
  /** Current terminal state */
  currentState: TUIState;
  /** Session history */
  history: TUIInteraction[];
  /** Active processes */
  processes: Array<{
    pid: number;
    command: string;
    startTime: Date;
    status: 'running' | 'completed' | 'failed';
  }>;
  /** Session recordings */
  recordings: string[];
  /** Session screenshots */
  screenshots: string[];
}
