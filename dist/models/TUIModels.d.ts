/**
 * TUI (Terminal User Interface) testing models and interfaces for the Agentic Testing System
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
 * Terminal screen dimensions
 */
export interface TUIDimensions {
    /** Terminal width in columns */
    width: number;
    /** Terminal height in rows */
    height: number;
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
    dimensions: TUIDimensions;
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
export declare enum TUIKeyType {
    PRINTABLE = "PRINTABLE",
    SPECIAL = "SPECIAL",
    FUNCTION = "FUNCTION",
    MODIFIER = "MODIFIER",
    COMBINATION = "COMBINATION"
}
/**
 * Special key identifiers
 */
export declare enum TUISpecialKey {
    ENTER = "ENTER",
    TAB = "TAB",
    ESCAPE = "ESCAPE",
    BACKSPACE = "BACKSPACE",
    DELETE = "DELETE",
    INSERT = "INSERT",
    HOME = "HOME",
    END = "END",
    PAGE_UP = "PAGE_UP",
    PAGE_DOWN = "PAGE_DOWN",
    ARROW_UP = "ARROW_UP",
    ARROW_DOWN = "ARROW_DOWN",
    ARROW_LEFT = "ARROW_LEFT",
    ARROW_RIGHT = "ARROW_RIGHT"
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
export declare enum TUIMouseEventType {
    CLICK = "CLICK",
    DOUBLE_CLICK = "DOUBLE_CLICK",
    RIGHT_CLICK = "RIGHT_CLICK",
    SCROLL = "SCROLL",
    DRAG = "DRAG",
    MOVE = "MOVE"
}
/**
 * Mouse button identifiers
 */
export declare enum TUIMouseButton {
    LEFT = "LEFT",
    RIGHT = "RIGHT",
    MIDDLE = "MIDDLE",
    WHEEL_UP = "WHEEL_UP",
    WHEEL_DOWN = "WHEEL_DOWN"
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
    dimensions: TUIDimensions;
    /** Previous dimensions */
    previousDimensions: TUIDimensions;
}
/**
 * Union type for all TUI interaction events
 */
export type TUIInteraction = TUIKeyEvent | TUIMouseEvent | TUIResizeEvent;
/**
 * Text assertion types for TUI content verification
 */
export declare enum TUITextAssertionType {
    EXACT_MATCH = "EXACT_MATCH",
    CONTAINS = "CONTAINS",
    STARTS_WITH = "STARTS_WITH",
    ENDS_WITH = "ENDS_WITH",
    REGEX_MATCH = "REGEX_MATCH",
    NOT_CONTAINS = "NOT_CONTAINS"
}
/**
 * Position assertion types for TUI element verification
 */
export declare enum TUIPositionAssertionType {
    AT_POSITION = "AT_POSITION",
    IN_REGION = "IN_REGION",
    CURSOR_AT = "CURSOR_AT",
    RELATIVE_TO = "RELATIVE_TO"
}
/**
 * Style assertion types for TUI visual verification
 */
export declare enum TUIStyleAssertionType {
    HAS_STYLE = "HAS_STYLE",
    HAS_COLOR = "HAS_COLOR",
    IS_HIGHLIGHTED = "IS_HIGHLIGHTED",
    IS_BOLD = "IS_BOLD",
    IS_UNDERLINED = "IS_UNDERLINED"
}
/**
 * Screen assertion types for TUI state verification
 */
export declare enum TUIScreenAssertionType {
    SCREEN_SIZE = "SCREEN_SIZE",
    TITLE_EQUALS = "TITLE_EQUALS",
    CURSOR_VISIBLE = "CURSOR_VISIBLE",
    ALT_SCREEN_ACTIVE = "ALT_SCREEN_ACTIVE",
    PROCESS_RUNNING = "PROCESS_RUNNING"
}
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
export type TUIAssertion = TUITextAssertion | TUIPositionAssertion | TUIStyleAssertion | TUIScreenAssertion;
/**
 * TUI testing configuration options
 */
export interface TUIConfig {
    /** Terminal emulator to use */
    terminal: 'xterm' | 'vt100' | 'ansi' | 'custom';
    /** Default terminal dimensions */
    defaultDimensions: TUIDimensions;
    /** Terminal encoding */
    encoding: 'utf8' | 'ascii' | 'latin1';
    /** Default timeout for TUI operations in milliseconds */
    defaultTimeout: number;
    /** Polling interval for state changes in milliseconds */
    pollingInterval: number;
    /** Whether to capture terminal screenshots */
    captureScreenshots: boolean;
    /** Directory for storing terminal recordings */
    recordingDir?: string;
    /** Whether to record terminal sessions */
    recordSessions: boolean;
    /** Maximum recording duration in milliseconds */
    maxRecordingDuration?: number;
    /** Color mode support */
    colorMode: '1bit' | '4bit' | '8bit' | '24bit';
    /** Whether to interpret ANSI escape sequences */
    interpretAnsi: boolean;
    /** Shell command to launch */
    shell: string;
    /** Shell arguments */
    shellArgs: string[];
    /** Environment variables for terminal session */
    environment: Record<string, string>;
    /** Working directory for terminal session */
    workingDirectory: string;
    /** Locale settings */
    locale?: string;
    /** Custom key mappings */
    keyMappings?: Record<string, TUIKeyEvent>;
    /** Accessibility options */
    accessibility: {
        /** High contrast mode */
        highContrast: boolean;
        /** Large text mode */
        largeText: boolean;
        /** Screen reader support */
        screenReader: boolean;
    };
    /** Performance settings */
    performance: {
        /** Buffer update frequency in Hz */
        refreshRate: number;
        /** Maximum buffer size */
        maxBufferSize: number;
        /** Enable hardware acceleration */
        hardwareAcceleration: boolean;
    };
}
/**
 * TUI test action types
 */
export declare enum TUIActionType {
    TYPE = "TYPE",
    KEY_PRESS = "KEY_PRESS",
    KEY_COMBINATION = "KEY_COMBINATION",
    MOUSE_CLICK = "MOUSE_CLICK",
    MOUSE_DRAG = "MOUSE_DRAG",
    SCROLL = "SCROLL",
    RESIZE = "RESIZE",
    CLEAR_SCREEN = "CLEAR_SCREEN",
    SEND_SIGNAL = "SEND_SIGNAL",
    WAIT_FOR_TEXT = "WAIT_FOR_TEXT",
    WAIT_FOR_CURSOR = "WAIT_FOR_CURSOR",
    WAIT_FOR_PROCESS = "WAIT_FOR_PROCESS",
    WAIT_FOR_SCREEN = "WAIT_FOR_SCREEN",
    CAPTURE_SCREEN = "CAPTURE_SCREEN",
    CAPTURE_REGION = "CAPTURE_REGION",
    START_RECORDING = "START_RECORDING",
    STOP_RECORDING = "STOP_RECORDING",
    ASSERT_TEXT = "ASSERT_TEXT",
    ASSERT_POSITION = "ASSERT_POSITION",
    ASSERT_STYLE = "ASSERT_STYLE",
    ASSERT_SCREEN = "ASSERT_SCREEN"
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
export declare enum TUIVerificationType {
    SCREEN_CONTENT = "SCREEN_CONTENT",
    CURSOR_POSITION = "CURSOR_POSITION",
    TERMINAL_STATE = "TERMINAL_STATE",
    PROCESS_STATE = "PROCESS_STATE",
    OUTPUT_STREAM = "OUTPUT_STREAM",
    VISUAL_STYLE = "VISUAL_STYLE",
    INTERACTION_RESPONSE = "INTERACTION_RESPONSE"
}
/**
 * TUI test result with terminal-specific data
 */
export interface TUITestResult {
    /** Base test result properties */
    scenarioId: string;
    status: import('./TestModels').TestStatus;
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
    config: TUIConfig;
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
//# sourceMappingURL=TUIModels.d.ts.map