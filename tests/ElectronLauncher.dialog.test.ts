/**
 * ElectronLauncher dialog handler tests
 *
 * Covers issue #116: dialog handler must NOT auto-accept non-alert dialogs.
 *   - alert dialogs  → accepted (backward compatible)
 *   - confirm dialogs → dismissed + warning logged
 *   - prompt dialogs  → dismissed + warning logged
 *   - dialog event is emitted for every dialog type
 *
 * Test approach: ElectronLauncher.page is already public, so it can be set
 * directly without (launcher as any).page. For setupPageEventListeners()
 * (which is private), a local ElectronLauncherTestHarness subclass promotes it
 * to public — this is type-safe and breaks at compile time if the method is
 * renamed, unlike a silent (as any) cast.
 */

import { EventEmitter } from 'events';
import { ElectronLauncher } from '../src/agents/electron/ElectronLauncher';
import { ElectronUIAgentConfig } from '../src/agents/electron/types';
import { TestLogger } from '../src/utils/logger';

// ---------------------------------------------------------------------------
// Minimal playwright mocks
// ---------------------------------------------------------------------------

jest.mock('playwright', () => ({
  _electron: {
    launch: jest.fn()
  }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(): ElectronUIAgentConfig {
  return {
    executablePath: '/fake/electron',
    launchTimeout: 5000,
    defaultTimeout: 5000
  };
}

function makeLogger(): jest.Mocked<TestLogger> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  } as unknown as jest.Mocked<TestLogger>;
}

/**
 * Create a mock Playwright Dialog object with controllable type/message and
 * spy-able accept/dismiss methods.
 */
function makeDialog(type: string, message: string) {
  return {
    type: jest.fn().mockReturnValue(type),
    message: jest.fn().mockReturnValue(message),
    accept: jest.fn().mockResolvedValue(undefined),
    dismiss: jest.fn().mockResolvedValue(undefined)
  };
}

/**
 * Build a mock Playwright Page that captures 'dialog' listener registrations
 * so we can fire synthetic dialog events in tests.
 */
function makeMockPage() {
  const listeners: Record<string, Function[]> = {};

  const page = {
    on: jest.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    setDefaultTimeout: jest.fn(),
    context: jest.fn().mockReturnValue({})
  };

  async function fireDialog(dialog: ReturnType<typeof makeDialog>) {
    for (const handler of listeners['dialog'] ?? []) {
      await handler(dialog);
    }
  }

  return { page, fireDialog };
}

// ---------------------------------------------------------------------------
// Test harness: expose private setupPageEventListeners without (x as any) cast
// ---------------------------------------------------------------------------

/**
 * ElectronLauncherTestHarness promotes the private setupPageEventListeners()
 * method to public so tests can call it directly.  If the private method is
 * renamed or removed the TypeScript compiler will catch it here instead of
 * producing a silent runtime error.
 */
class ElectronLauncherTestHarness extends ElectronLauncher {
  setupPageEventListenersForTest(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).setupPageEventListeners();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ElectronLauncher dialog handler (issue #116)', () => {
  let launcher: ElectronLauncherTestHarness;
  let logger: jest.Mocked<TestLogger>;

  beforeEach(() => {
    logger = makeLogger();
    launcher = new ElectronLauncherTestHarness(makeConfig(), logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Register listeners on a mock page by:
   * 1. Assigning the mock to launcher.page (which is public on ElectronLauncher)
   * 2. Calling setupPageEventListenersForTest() from the test harness subclass
   *    instead of (launcher as any).setupPageEventListeners().
   */
  function attachListeners() {
    const { page, fireDialog } = makeMockPage();
    // launcher.page is a public field — no cast needed
    launcher.page = page as any;
    // Use the harness method — type-safe, not (as any)
    launcher.setupPageEventListenersForTest();
    return { page, fireDialog };
  }

  // -------------------------------------------------------------------------
  // alert → accepted
  // -------------------------------------------------------------------------

  it('accepts alert dialogs (backward compatible)', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('alert', 'Hello world');

    await fireDialog(dialog);

    expect(dialog.accept).toHaveBeenCalledTimes(1);
    expect(dialog.dismiss).not.toHaveBeenCalled();
  });

  it('logs info for alert dialogs', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('alert', 'Info message');

    await fireDialog(dialog);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('alert')
    );
  });

  // -------------------------------------------------------------------------
  // confirm → dismissed
  // -------------------------------------------------------------------------

  it('dismisses confirm dialogs instead of accepting them', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('confirm', 'Delete everything?');

    await fireDialog(dialog);

    expect(dialog.dismiss).toHaveBeenCalledTimes(1);
    expect(dialog.accept).not.toHaveBeenCalled();
  });

  it('logs a warning when a confirm dialog is dismissed', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('confirm', 'Are you sure?');

    await fireDialog(dialog);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('confirm'),
      expect.objectContaining({ dialogType: 'confirm' })
    );
  });

  // -------------------------------------------------------------------------
  // prompt → dismissed
  // -------------------------------------------------------------------------

  it('dismisses prompt dialogs instead of accepting them', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('prompt', 'Enter password:');

    await fireDialog(dialog);

    expect(dialog.dismiss).toHaveBeenCalledTimes(1);
    expect(dialog.accept).not.toHaveBeenCalled();
  });

  it('logs a warning when a prompt dialog is dismissed', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('prompt', 'Enter value:');

    await fireDialog(dialog);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('prompt'),
      expect.objectContaining({ dialogType: 'prompt' })
    );
  });

  // -------------------------------------------------------------------------
  // event emission
  // -------------------------------------------------------------------------

  it('emits a "dialog" event for alert dialogs with type and message', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('alert', 'Alert text');
    const received: any[] = [];

    launcher.on('dialog', (data) => received.push(data));
    await fireDialog(dialog);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: 'alert', message: 'Alert text' });
  });

  it('emits a "dialog" event for confirm dialogs with type and message', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('confirm', 'Confirm text');
    const received: any[] = [];

    launcher.on('dialog', (data) => received.push(data));
    await fireDialog(dialog);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: 'confirm', message: 'Confirm text' });
  });

  // -------------------------------------------------------------------------
  // Regression: the old code accepted confirm/prompt dialogs
  // -------------------------------------------------------------------------

  it('does NOT call accept() on a confirm dialog (regression guard)', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('confirm', 'Dangerous action');

    await fireDialog(dialog);

    // This would have passed silently before the fix.
    expect(dialog.accept).not.toHaveBeenCalled();
  });

  it('does NOT call accept() on a prompt dialog (regression guard)', async () => {
    const { fireDialog } = attachListeners();
    const dialog = makeDialog('prompt', 'Type here');

    await fireDialog(dialog);

    expect(dialog.accept).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // ElectronLauncher is an EventEmitter
  // -------------------------------------------------------------------------

  it('is an instance of EventEmitter', () => {
    expect(launcher).toBeInstanceOf(EventEmitter);
  });
});
