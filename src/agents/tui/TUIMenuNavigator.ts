/**
 * TUIMenuNavigator - Menu detection and navigation logic
 *
 * Responsible for:
 * - Parsing menu items from terminal text output
 * - Navigating to a target menu item via arrow key presses
 * - Managing menu navigation context across a session
 * - Emitting menuNavigated events
 */

import { MenuNavigation, TerminalOutput } from './types';
import { TestLogger } from '../../utils/logger';

/**
 * Callback types used by TUIMenuNavigator to interact with session state
 */
export interface MenuNavigatorDeps {
  /** Send input to the terminal session */
  sendInput: (sessionId: string, input: string) => Promise<void>;
  /** Wait for the output to stabilize */
  waitForStabilization: (sessionId: string) => Promise<void>;
  /** Get the latest output from the session */
  getLatestOutput: (sessionId: string) => TerminalOutput | null;
  /** Get the key escape sequence for a named key */
  getKeyMapping: (key: string) => string;
  /** Emit an event on the parent agent */
  emit: (event: string, ...args: any[]) => void;
}

/**
 * Manages menu detection and navigation within TUI terminal sessions
 */
export class TUIMenuNavigator {
  private readonly logger: TestLogger;
  private menuContext: MenuNavigation | undefined;

  constructor(logger: TestLogger) {
    this.logger = logger;
  }

  /**
   * Navigate through a hierarchical menu path
   *
   * For each item in the path array:
   * 1. Wait for output to stabilize
   * 2. Parse visible menu items
   * 3. Find the target item by name (case-insensitive)
   * 4. Move selection with arrow keys
   * 5. Press Enter to select
   *
   * @param sessionId - ID of the session to navigate
   * @param path - Array of menu item names to navigate in order
   * @param deps - Callbacks for interacting with the session
   * @returns The final MenuNavigation context after all navigations
   * @throws Error if a menu item is not found in the visible output
   */
  async navigateMenu(
    sessionId: string,
    path: string[],
    deps: MenuNavigatorDeps
  ): Promise<MenuNavigation> {
    this.logger.info(`Navigating menu path: ${path.join(' > ')}`, { sessionId });

    try {
      if (!this.menuContext) {
        this.menuContext = {
          level: 0,
          items: [],
          selectedIndex: 0,
          history: []
        };
      }

      for (const menuItem of path) {
        await deps.waitForStabilization(sessionId);

        const currentOutput = deps.getLatestOutput(sessionId);
        const menuItems = this.parseMenuItems(currentOutput?.text || '');

        this.menuContext.items = menuItems;

        const targetIndex = menuItems.findIndex(item =>
          item.toLowerCase().includes(menuItem.toLowerCase())
        );

        if (targetIndex === -1) {
          throw new Error(
            `Menu item not found: ${menuItem}. Available: ${menuItems.join(', ')}`
          );
        }

        await this.navigateToMenuItem(sessionId, targetIndex, deps);

        await deps.sendInput(sessionId, deps.getKeyMapping('Enter'));

        this.menuContext.level++;
        this.menuContext.history.push(menuItem);
        this.menuContext.selectedIndex = targetIndex;

        this.logger.debug(`Navigated to menu item: ${menuItem}`, {
          level: this.menuContext.level,
          index: targetIndex
        });
      }

      deps.emit('menuNavigated', { sessionId, path, context: this.menuContext });
      return { ...this.menuContext };
    } catch (error: unknown) {
      this.logger.error('Menu navigation failed', { sessionId, path, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Reset the internal menu navigation context
   *
   * Call this when starting a new navigation sequence from scratch.
   */
  resetContext(): void {
    this.menuContext = undefined;
  }

  // -- Private helpers --

  /**
   * Parse menu items from terminal text output
   *
   * Matches lines formatted as:
   *   "1. Item", "* Item", "- Item", "[1] Item"
   */
  private parseMenuItems(text: string): string[] {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const menuItems: string[] = [];

    for (const line of lines) {
      const match = line.match(/^(?:\d+\.|\*|-|\[\d+\])\s*(.+)$/);
      if (match) {
        menuItems.push(match[1].trim());
      }
    }

    return menuItems;
  }

  /**
   * Move the terminal cursor to a target menu index using arrow keys
   */
  private async navigateToMenuItem(
    sessionId: string,
    targetIndex: number,
    deps: MenuNavigatorDeps
  ): Promise<void> {
    if (!this.menuContext) {
      throw new Error('Menu context not initialized');
    }

    const currentIndex = this.menuContext.selectedIndex;
    const steps = targetIndex - currentIndex;

    if (steps === 0) return;

    const key = steps > 0 ? 'ArrowDown' : 'ArrowUp';
    const count = Math.abs(steps);

    for (let i = 0; i < count; i++) {
      await deps.sendInput(sessionId, deps.getKeyMapping(key));
    }

    this.menuContext.selectedIndex = targetIndex;
  }
}
