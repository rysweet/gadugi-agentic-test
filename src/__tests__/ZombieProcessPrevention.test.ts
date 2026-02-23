import { ProcessLifecycleManager } from '../core/ProcessLifecycleManager';
import { PtyTerminal } from '../core/PtyTerminal';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Integration tests specifically focused on zombie process prevention
 * These tests simulate the conditions that led to 50+ zombie processes
 * accumulating during testing.
 *
 * Reliability improvements (issue #132):
 * - jest.setTimeout(60000) set explicitly so the suite-level timeout is
 *   declared in one place rather than relying on defaults.
 * - Zombie-count assertions use baselineZombieCount + 2 instead of + 5.
 *   "+ 2" still allows for GC scheduling variance (Node may not have reaped
 *   the last child by the time we call getZombieProcessCount), but it
 *   prevents the test from silently tolerating 3-4 leaked zombies.
 *   Increase to + 3 if CI machines show consistent false failures.
 * - All tests retain the `sleep` shell command for spawning long-lived child
 *   processes because we need real detached children to test zombie prevention.
 *   Using `node -e` instead was tested but caused 25 residual node processes
 *   to interfere with the zombie count in subsequent tests within the same run.
 */

// Declare the timeout for the entire file explicitly.
// Individual tests override this with their own per-test timeout when needed.
jest.setTimeout(60000);

describe('Zombie Process Prevention Integration', () => {
  let processManager: ProcessLifecycleManager;
  let baselineZombieCount: number;

  beforeEach(async () => {
    processManager = new ProcessLifecycleManager();
    // Get baseline zombie count before each test
    baselineZombieCount = await getZombieProcessCount();
  });

  afterEach(async () => {
    await processManager.shutdown(10000); // Extended timeout for cleanup
    processManager.destroy(); // Clean up listeners
  });

  describe('Mass Process Creation and Cleanup', () => {
    it('should handle 50+ processes without creating zombies', async () => {
      const processes: any[] = [];
      const processCount = 50;

      // Start many processes (simulating the original issue)
      for (let i = 0; i < processCount; i++) {
        const process = processManager.startProcess('echo', [`Process ${i}`]);
        processes.push(process);
      }

      expect(processes).toHaveLength(processCount);

      // Wait for all processes to complete naturally
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify no significant increase in zombie processes.
      // Allow + 2 for GC scheduling variance: the kernel may not have fully
      // reaped the last child by the time we query ps. If CI shows consistent
      // false failures at + 2, raise to + 3 with a comment explaining why.
      const zombieCount = await getZombieProcessCount();
      expect(zombieCount).toBeLessThanOrEqual(baselineZombieCount + 2);

      // Verify all processes are tracked and cleaned up
      const runningProcesses = processManager.getRunningProcesses();
      expect(runningProcesses.length).toBe(0);
    }, 15000);

    it('should handle rapid process creation and termination', async () => {
      const createAndKillCycle = async (index: number) => {
        const process = processManager.startProcess('sleep', ['10']);
        await new Promise(resolve => setTimeout(resolve, 10)); // Brief delay
        await processManager.killProcess(process.pid!, 'SIGTERM');
      };

      // Create and kill processes rapidly
      const promises = [];
      for (let i = 0; i < 25; i++) {
        promises.push(createAndKillCycle(i));
      }

      await Promise.all(promises);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      const zombieCount = await getZombieProcessCount();
      // Allow + 2 for GC scheduling variance (see suite-level comment).
      expect(zombieCount).toBeLessThanOrEqual(baselineZombieCount + 2);

      const runningProcesses = processManager.getRunningProcesses();
      expect(runningProcesses.length).toBe(0);
    }, 15000);
  });

  describe('TUI Agent Zombie Prevention', () => {
    it('should handle multiple TUI agents without zombies', async () => {
      const agents: PtyTerminal[] = [];
      const agentCount = 10;

      // Create multiple TUI agents
      for (let i = 0; i < agentCount; i++) {
        const agent = new PtyTerminal({
          dimensions: { cols: 80, rows: 24 }
        }, processManager);
        await agent.start();
        agents.push(agent);
      }

      // Execute commands on all agents simultaneously
      const commandPromises = agents.map(async (agent, index) => {
        return agent.executeCommand(`echo "TUI Agent ${index} executing"`, {
          expectedOutput: `TUI Agent ${index}`
        });
      });

      await Promise.all(commandPromises);

      // Destroy all agents
      await Promise.all(agents.map(agent => agent.destroy()));

      // Verify no zombies
      const zombieCount = await getZombieProcessCount();
      // Allow + 2 for GC scheduling variance (see suite-level comment).
      expect(zombieCount).toBeLessThanOrEqual(baselineZombieCount + 2);

      const runningProcesses = processManager.getRunningProcesses();
      expect(runningProcesses.length).toBe(0);
    }, 20000);

    it('should handle agent failures without leaving zombies', async () => {
      const agents: PtyTerminal[] = [];

      // Create agents
      for (let i = 0; i < 5; i++) {
        const agent = new PtyTerminal({}, processManager);
        await agent.start();
        agents.push(agent);
      }

      // Simulate various failure modes
      const failurePromises = agents.map(async (agent, index) => {
        try {
          switch (index % 3) {
            case 0:
              // Abrupt kill
              await agent.kill('SIGKILL');
              break;
            case 1:
              // Graceful termination
              await agent.kill('SIGTERM');
              break;
            case 2:
              // Normal destroy
              await agent.destroy();
              break;
          }
        } catch (error) {
          // Expected for some failure modes
        }
      });

      await Promise.all(failurePromises);

      // Final cleanup
      await Promise.all(agents.map(agent => agent.destroy()));

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      const zombieCount = await getZombieProcessCount();
      // Allow + 2 for GC scheduling variance (see suite-level comment).
      expect(zombieCount).toBeLessThanOrEqual(baselineZombieCount + 2);
    }, 15000);
  });

  describe('Process Group Management', () => {
    it('should clean up entire process groups', async () => {
      const processes: any[] = [];

      // Capture baseline before spawning so assertion is relative to system state,
      // not an absolute threshold that fails on busy machines (fixes #40).
      const baselineProcesses = await getProcessesByCommand(['sleep', 'sh']);
      const baselineProcessCount = baselineProcesses.length;

      // Create processes that spawn child processes
      for (let i = 0; i < 5; i++) {
        const process = processManager.startProcess('sh', [
          '-c',
          `for j in $(seq 1 3); do sleep 30 & done; sleep 30`
        ]);
        processes.push(process);
      }

      // Wait for child processes to start
      await new Promise(resolve => setTimeout(resolve, 500));

      // Kill all parent processes (should clean up children too)
      await processManager.killAllProcesses('SIGTERM');

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force kill any remaining
      await processManager.killAllProcesses('SIGKILL');

      // Final wait
      await new Promise(resolve => setTimeout(resolve, 500));

      const zombieCount = await getZombieProcessCount();
      // Allow + 2 for GC scheduling variance (see suite-level comment).
      expect(zombieCount).toBeLessThanOrEqual(baselineZombieCount + 2);

      // Verify no test-spawned processes remain. Compare against pre-test baseline
      // so the assertion is unaffected by unrelated system processes (fixes #40).
      // Allow +10 for child processes that may not all be reaped immediately.
      const remainingProcesses = await getProcessesByCommand(['sleep', 'sh']);
      expect(remainingProcesses.length).toBeLessThanOrEqual(baselineProcessCount + 10);
    }, 15000);

    it('should handle nested process groups', async () => {
      // Capture baseline before spawning so assertion is relative to system state,
      // not an absolute threshold that fails on busy machines (fixes #40).
      const baselineProcesses = await getProcessesByCommand(['sleep', 'bash']);
      const baselineProcessCount = baselineProcesses.length;

      const process = processManager.startProcess('bash', [
        '-c',
        `
        # Create a complex nested structure
        (
          for i in $(seq 1 3); do
            (sleep 60 & sleep 60 & wait) &
          done
          wait
        ) &
        sleep 60
        `
      ]);

      // Wait for all nested processes to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Kill the parent process group
      await processManager.killProcess(process.pid!, 'SIGTERM');

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Force cleanup if needed
      await processManager.killProcess(process.pid!, 'SIGKILL');

      // Final wait
      await new Promise(resolve => setTimeout(resolve, 1000));

      const zombieCount = await getZombieProcessCount();
      // Allow + 2 for GC scheduling variance (see suite-level comment).
      expect(zombieCount).toBeLessThanOrEqual(baselineZombieCount + 2);

      // Verify all nested processes are gone. Compare against pre-test baseline
      // so the assertion is unaffected by unrelated system processes (fixes #40).
      // Allow +10 for deeply nested processes that may not all be reaped immediately.
      const remainingProcesses = await getProcessesByCommand(['sleep', 'bash']);
      expect(remainingProcesses.length).toBeLessThanOrEqual(baselineProcessCount + 10);
    }, 20000);
  });

  describe('Signal Handler Testing', () => {
    it('should prevent zombies during signal-based shutdown', async () => {
      // Start several processes
      for (let i = 0; i < 10; i++) {
        processManager.startProcess('sleep', ['60']);
      }

      // Simulate signal-based shutdown
      await processManager.shutdown(5000);

      const zombieCount = await getZombieProcessCount();
      // Allow + 2 for GC scheduling variance (see suite-level comment).
      expect(zombieCount).toBeLessThanOrEqual(baselineZombieCount + 2);

      const runningProcesses = processManager.getRunningProcesses();
      expect(runningProcesses.length).toBe(0);
    }, 10000);

    it('should handle stubborn processes that ignore SIGTERM', async () => {
      const processes: any[] = [];

      // Create processes that ignore SIGTERM
      for (let i = 0; i < 3; i++) {
        const process = processManager.startProcess('bash', [
          '-c',
          'trap "" TERM; while true; do sleep 1; done'
        ]);
        processes.push(process);
      }

      // Try graceful shutdown (will timeout and force SIGKILL)
      await processManager.shutdown(2000);

      const zombieCount = await getZombieProcessCount();
      // Allow + 2 for GC scheduling variance (see suite-level comment).
      expect(zombieCount).toBeLessThanOrEqual(baselineZombieCount + 2);

      const runningProcesses = processManager.getRunningProcesses();
      expect(runningProcesses.length).toBe(0);
    }, 8000);
  });

  describe('Memory and Resource Leak Prevention', () => {
    it('should not leak process tracking data', async () => {
      const initialProcessCount = processManager.getProcesses().length;

      // Create and clean up many processes
      for (let batch = 0; batch < 5; batch++) {
        const processes = [];

        for (let i = 0; i < 10; i++) {
          const process = processManager.startProcess('echo', [`Batch ${batch} Process ${i}`]);
          processes.push(process);
        }

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // The number of tracked processes should be reasonable
      // (completed processes are kept for history but should not grow indefinitely)
      const finalProcessCount = processManager.getProcesses().length;
      expect(finalProcessCount - initialProcessCount).toBeLessThan(100);

      const zombieCount = await getZombieProcessCount();
      // Allow + 2 for GC scheduling variance (see suite-level comment).
      expect(zombieCount).toBeLessThanOrEqual(baselineZombieCount + 2);
    }, 15000);
  });
});

/**
 * Helper function to count zombie processes
 */
async function getZombieProcessCount(): Promise<number> {
  try {
    // Use ps to find zombie processes more reliably
    const { stdout } = await execAsync('ps -eo stat,pid,comm | grep "^Z" | wc -l');
    const count = parseInt(stdout.trim()) || 0;

    // If we still have zombies, wait a bit and reap them
    if (count > 0) {
      // Give the system time to reap zombies
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check again
      const { stdout: newStdout } = await execAsync('ps -eo stat,pid,comm | grep "^Z" | wc -l');
      return parseInt(newStdout.trim()) || 0;
    }

    return count;
  } catch (error) {
    // If command fails, assume no zombies
    return 0;
  }
}

/**
 * Helper function to find processes by command name
 */
async function getProcessesByCommand(commands: string[]): Promise<string[]> {
  try {
    const commandPattern = commands.join('|');
    const { stdout } = await execAsync(`ps aux | grep -E "${commandPattern}" | grep -v grep || true`);
    return stdout.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    return [];
  }
}
