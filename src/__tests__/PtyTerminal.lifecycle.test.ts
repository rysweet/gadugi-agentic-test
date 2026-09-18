import { adaptiveWaiter } from '../core/AdaptiveWaiter';
import { PtyTerminal } from '../core/PtyTerminal';

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

describe('PtyTerminal lifecycle', () => {
  it('waits for the terminal process to exit during destroy', async () => {
    const terminal = new PtyTerminal();
    await terminal.start();
    const pid = terminal.getProcessInfo()?.pid;

    expect(pid).toBeDefined();
    expect(isProcessAlive(pid!)).toBe(true);

    await terminal.destroy();

    const result = await adaptiveWaiter.waitForCondition(
      () => !isProcessAlive(pid!),
      { initialDelay: 25, maxDelay: 100, timeout: 3000, jitter: 0 }
    );
    expect(result.success).toBe(true);
    expect(terminal.isRunning()).toBe(false);
  }, 10000);
});
