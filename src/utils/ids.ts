/**
 * ID generation utilities shared across agents and sub-modules.
 *
 * Centralises the `Date.now() + random` pattern that previously existed
 * verbatim in TUISessionManager, WebSocketConnection, WebSocketMessageHandler,
 * APIRequestExecutor, CLICommandRunner, and ElectronPageInteractor.
 */

/**
 * Generate a unique identifier optionally prefixed with a label.
 *
 * @param prefix - Optional prefix (e.g. 'conn', 'msg', 'tui').  When omitted
 *                 the returned id contains only the timestamp + random segment.
 *
 * @example
 *   generateId()        // "1714000000000_k3j8f9d2x"
 *   generateId('conn')  // "conn_1714000000000_k3j8f9d2x"
 *   generateId('tui')   // "tui_1714000000000_k3j8f9d2x"
 */
export function generateId(prefix = ''): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substr(2, 9);
  return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
}
