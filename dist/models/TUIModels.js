"use strict";
/**
 * TUI (Terminal User Interface) testing models and interfaces for the Agentic Testing System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TUIVerificationType = exports.TUIActionType = exports.TUIScreenAssertionType = exports.TUIStyleAssertionType = exports.TUIPositionAssertionType = exports.TUITextAssertionType = exports.TUIMouseButton = exports.TUIMouseEventType = exports.TUISpecialKey = exports.TUIKeyType = void 0;
/**
 * Keyboard event types
 */
var TUIKeyType;
(function (TUIKeyType) {
    TUIKeyType["PRINTABLE"] = "PRINTABLE";
    TUIKeyType["SPECIAL"] = "SPECIAL";
    TUIKeyType["FUNCTION"] = "FUNCTION";
    TUIKeyType["MODIFIER"] = "MODIFIER";
    TUIKeyType["COMBINATION"] = "COMBINATION";
})(TUIKeyType || (exports.TUIKeyType = TUIKeyType = {}));
/**
 * Special key identifiers
 */
var TUISpecialKey;
(function (TUISpecialKey) {
    TUISpecialKey["ENTER"] = "ENTER";
    TUISpecialKey["TAB"] = "TAB";
    TUISpecialKey["ESCAPE"] = "ESCAPE";
    TUISpecialKey["BACKSPACE"] = "BACKSPACE";
    TUISpecialKey["DELETE"] = "DELETE";
    TUISpecialKey["INSERT"] = "INSERT";
    TUISpecialKey["HOME"] = "HOME";
    TUISpecialKey["END"] = "END";
    TUISpecialKey["PAGE_UP"] = "PAGE_UP";
    TUISpecialKey["PAGE_DOWN"] = "PAGE_DOWN";
    TUISpecialKey["ARROW_UP"] = "ARROW_UP";
    TUISpecialKey["ARROW_DOWN"] = "ARROW_DOWN";
    TUISpecialKey["ARROW_LEFT"] = "ARROW_LEFT";
    TUISpecialKey["ARROW_RIGHT"] = "ARROW_RIGHT";
})(TUISpecialKey || (exports.TUISpecialKey = TUISpecialKey = {}));
/**
 * Mouse event types
 */
var TUIMouseEventType;
(function (TUIMouseEventType) {
    TUIMouseEventType["CLICK"] = "CLICK";
    TUIMouseEventType["DOUBLE_CLICK"] = "DOUBLE_CLICK";
    TUIMouseEventType["RIGHT_CLICK"] = "RIGHT_CLICK";
    TUIMouseEventType["SCROLL"] = "SCROLL";
    TUIMouseEventType["DRAG"] = "DRAG";
    TUIMouseEventType["MOVE"] = "MOVE";
})(TUIMouseEventType || (exports.TUIMouseEventType = TUIMouseEventType = {}));
/**
 * Mouse button identifiers
 */
var TUIMouseButton;
(function (TUIMouseButton) {
    TUIMouseButton["LEFT"] = "LEFT";
    TUIMouseButton["RIGHT"] = "RIGHT";
    TUIMouseButton["MIDDLE"] = "MIDDLE";
    TUIMouseButton["WHEEL_UP"] = "WHEEL_UP";
    TUIMouseButton["WHEEL_DOWN"] = "WHEEL_DOWN";
})(TUIMouseButton || (exports.TUIMouseButton = TUIMouseButton = {}));
/**
 * Text assertion types for TUI content verification
 */
var TUITextAssertionType;
(function (TUITextAssertionType) {
    TUITextAssertionType["EXACT_MATCH"] = "EXACT_MATCH";
    TUITextAssertionType["CONTAINS"] = "CONTAINS";
    TUITextAssertionType["STARTS_WITH"] = "STARTS_WITH";
    TUITextAssertionType["ENDS_WITH"] = "ENDS_WITH";
    TUITextAssertionType["REGEX_MATCH"] = "REGEX_MATCH";
    TUITextAssertionType["NOT_CONTAINS"] = "NOT_CONTAINS";
})(TUITextAssertionType || (exports.TUITextAssertionType = TUITextAssertionType = {}));
/**
 * Position assertion types for TUI element verification
 */
var TUIPositionAssertionType;
(function (TUIPositionAssertionType) {
    TUIPositionAssertionType["AT_POSITION"] = "AT_POSITION";
    TUIPositionAssertionType["IN_REGION"] = "IN_REGION";
    TUIPositionAssertionType["CURSOR_AT"] = "CURSOR_AT";
    TUIPositionAssertionType["RELATIVE_TO"] = "RELATIVE_TO";
})(TUIPositionAssertionType || (exports.TUIPositionAssertionType = TUIPositionAssertionType = {}));
/**
 * Style assertion types for TUI visual verification
 */
var TUIStyleAssertionType;
(function (TUIStyleAssertionType) {
    TUIStyleAssertionType["HAS_STYLE"] = "HAS_STYLE";
    TUIStyleAssertionType["HAS_COLOR"] = "HAS_COLOR";
    TUIStyleAssertionType["IS_HIGHLIGHTED"] = "IS_HIGHLIGHTED";
    TUIStyleAssertionType["IS_BOLD"] = "IS_BOLD";
    TUIStyleAssertionType["IS_UNDERLINED"] = "IS_UNDERLINED";
})(TUIStyleAssertionType || (exports.TUIStyleAssertionType = TUIStyleAssertionType = {}));
/**
 * Screen assertion types for TUI state verification
 */
var TUIScreenAssertionType;
(function (TUIScreenAssertionType) {
    TUIScreenAssertionType["SCREEN_SIZE"] = "SCREEN_SIZE";
    TUIScreenAssertionType["TITLE_EQUALS"] = "TITLE_EQUALS";
    TUIScreenAssertionType["CURSOR_VISIBLE"] = "CURSOR_VISIBLE";
    TUIScreenAssertionType["ALT_SCREEN_ACTIVE"] = "ALT_SCREEN_ACTIVE";
    TUIScreenAssertionType["PROCESS_RUNNING"] = "PROCESS_RUNNING";
})(TUIScreenAssertionType || (exports.TUIScreenAssertionType = TUIScreenAssertionType = {}));
/**
 * TUI test action types
 */
var TUIActionType;
(function (TUIActionType) {
    // Input actions
    TUIActionType["TYPE"] = "TYPE";
    TUIActionType["KEY_PRESS"] = "KEY_PRESS";
    TUIActionType["KEY_COMBINATION"] = "KEY_COMBINATION";
    TUIActionType["MOUSE_CLICK"] = "MOUSE_CLICK";
    TUIActionType["MOUSE_DRAG"] = "MOUSE_DRAG";
    TUIActionType["SCROLL"] = "SCROLL";
    // Control actions
    TUIActionType["RESIZE"] = "RESIZE";
    TUIActionType["CLEAR_SCREEN"] = "CLEAR_SCREEN";
    TUIActionType["SEND_SIGNAL"] = "SEND_SIGNAL";
    // Wait actions
    TUIActionType["WAIT_FOR_TEXT"] = "WAIT_FOR_TEXT";
    TUIActionType["WAIT_FOR_CURSOR"] = "WAIT_FOR_CURSOR";
    TUIActionType["WAIT_FOR_PROCESS"] = "WAIT_FOR_PROCESS";
    TUIActionType["WAIT_FOR_SCREEN"] = "WAIT_FOR_SCREEN";
    // Capture actions
    TUIActionType["CAPTURE_SCREEN"] = "CAPTURE_SCREEN";
    TUIActionType["CAPTURE_REGION"] = "CAPTURE_REGION";
    TUIActionType["START_RECORDING"] = "START_RECORDING";
    TUIActionType["STOP_RECORDING"] = "STOP_RECORDING";
    // Assertion actions
    TUIActionType["ASSERT_TEXT"] = "ASSERT_TEXT";
    TUIActionType["ASSERT_POSITION"] = "ASSERT_POSITION";
    TUIActionType["ASSERT_STYLE"] = "ASSERT_STYLE";
    TUIActionType["ASSERT_SCREEN"] = "ASSERT_SCREEN";
})(TUIActionType || (exports.TUIActionType = TUIActionType = {}));
/**
 * TUI verification types for test results
 */
var TUIVerificationType;
(function (TUIVerificationType) {
    TUIVerificationType["SCREEN_CONTENT"] = "SCREEN_CONTENT";
    TUIVerificationType["CURSOR_POSITION"] = "CURSOR_POSITION";
    TUIVerificationType["TERMINAL_STATE"] = "TERMINAL_STATE";
    TUIVerificationType["PROCESS_STATE"] = "PROCESS_STATE";
    TUIVerificationType["OUTPUT_STREAM"] = "OUTPUT_STREAM";
    TUIVerificationType["VISUAL_STYLE"] = "VISUAL_STYLE";
    TUIVerificationType["INTERACTION_RESPONSE"] = "INTERACTION_RESPONSE";
})(TUIVerificationType || (exports.TUIVerificationType = TUIVerificationType = {}));
//# sourceMappingURL=TUIModels.js.map