import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Process tracking information
 */
export interface ProcessInfo {
  pid: number;
  command: string;
  args: string[];
  startTime: Date;
  pgid?: number;
  status: 'running' | 'terminated' | 'killed' | 'exited';
  exitCode?: number;
}

/**
 * Process lifecycle events
 */
export interface ProcessEvents {
  processStarted: (processInfo: ProcessInfo) => void;
  processExited: (processInfo: ProcessInfo, code: number | null, signal: string | null) => void;
  processKilled: (processInfo: ProcessInfo) => void;
  cleanupComplete: (processCount: number) => void;
  error: (error: Error, processInfo?: ProcessInfo) => void;
}

/**
 * ProcessLifecycleManager
 *
 * Comprehensive process lifecycle management to prevent zombie processes
 * and ensure proper cleanup of all child processes and their process groups.
 */
export class ProcessLifecycleManager extends EventEmitter {
  private processes = new Map<number, ProcessInfo>();
  private childProcesses = new Map<number, ChildProcess>();
  private isShuttingDown = false;
  private cleanupTimeout = 5000; // 5 seconds for graceful shutdown
  private signalHandlersRegistered = false;
  private static globalHandlersRegistered = false;
  private static globalSignalHandler: ((signal: NodeJS.Signals) => void) | null = null;
  private static globalExitHandlersRegistered = false;

  constructor() {
    super();
    this.registerSignalHandlers();
    this.registerExitHandlers();
  }

  /**
   * Start a new process with lifecycle management
   */
  public startProcess(
    command: string,
    args: string[] = [],
    options: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      shell?: boolean;
      detached?: boolean;
    } = {}
  ): ChildProcess {
    if (this.isShuttingDown) {
      throw new Error('Cannot start new processes during shutdown');
    }

    // Force detached mode for proper process group management
    const processOptions = {
      ...options,
      detached: true,
      // Create new process group to prevent inheriting parent's signals
      stdio: 'pipe' as const,
    };

    let childProcess: ChildProcess;
    try {
      childProcess = spawn(command, args, processOptions);

      // Add error handler immediately to prevent unhandled errors from crashing
      childProcess.on('error', (error) => {
        // Create a temporary process info for the error
        const tempProcessInfo: ProcessInfo = {
          pid: childProcess.pid || -1,
          command,
          args,
          startTime: new Date(),
          status: 'terminated'
        };
        try {
          this.emit('error', error, tempProcessInfo);
        } catch (emitError) {
          console.error('Error emitting process error:', emitError);
        }
      });
    } catch (error) {
      const wrappedError = new Error(`Failed to spawn process: ${command} ${args.join(' ')} - ${error}`);
      this.emit('error', wrappedError);
      throw wrappedError;
    }

    if (!childProcess.pid) {
      const error = new Error(`Failed to start process: ${command} ${args.join(' ')}`);
      this.emit('error', error);
      throw error;
    }

    // Track process information
    const processInfo: ProcessInfo = {
      pid: childProcess.pid,
      command,
      args,
      startTime: new Date(),
      pgid: childProcess.pid, // In detached mode, pid === pgid
      status: 'running'
    };

    this.processes.set(childProcess.pid, processInfo);
    this.childProcesses.set(childProcess.pid, childProcess);

    // Set up process event handlers
    this.setupProcessHandlers(childProcess, processInfo);

    this.emit('processStarted', processInfo);

    return childProcess;
  }

  /**
   * Set up event handlers for a child process
   */
  private setupProcessHandlers(childProcess: ChildProcess, processInfo: ProcessInfo): void {
    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      processInfo.status = 'exited';
      processInfo.exitCode = code || undefined;

      this.processes.set(processInfo.pid, processInfo);
      this.emit('processExited', processInfo, code, signal);

      // Clean up tracking
      this.childProcesses.delete(processInfo.pid);
    });

    // Handle process errors
    childProcess.on('error', (error) => {
      processInfo.status = 'terminated';
      this.processes.set(processInfo.pid, processInfo);

      // Always emit the error, but also ensure it doesn't crash the process
      try {
        this.emit('error', error, processInfo);
      } catch (emitError) {
        console.error('Error emitting process error:', emitError);
      }
    });

    // Handle when process is closed (all stdio streams closed)
    childProcess.on('close', (code, signal) => {
      // Final cleanup if not already done
      if (this.childProcesses.has(processInfo.pid)) {
        this.childProcesses.delete(processInfo.pid);
      }
    });
  }

  /**
   * Kill a specific process and its process group
   */
  public async killProcess(pid: number, signal: NodeJS.Signals = 'SIGTERM'): Promise<boolean> {
    const processInfo = this.processes.get(pid);
    const childProcess = this.childProcesses.get(pid);

    if (!processInfo || !childProcess) {
      return false;
    }

    try {
      // Kill the entire process group to catch all child processes
      if (processInfo.pgid) {
        process.kill(-processInfo.pgid, signal);
      } else {
        childProcess.kill(signal);
      }

      processInfo.status = 'killed';
      this.processes.set(pid, processInfo);
      this.emit('processKilled', processInfo);

      return true;
    } catch (error) {
      this.emit('error', error as Error, processInfo);
      return false;
    }
  }

  /**
   * Kill all managed processes
   */
  public async killAllProcesses(signal: NodeJS.Signals = 'SIGTERM'): Promise<number> {
    const pids = Array.from(this.childProcesses.keys());
    let killedCount = 0;

    for (const pid of pids) {
      if (await this.killProcess(pid, signal)) {
        killedCount++;
      }
    }

    return killedCount;
  }

  /**
   * Get information about all managed processes
   */
  public getProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get information about running processes
   */
  public getRunningProcesses(): ProcessInfo[] {
    return this.getProcesses().filter(p => p.status === 'running');
  }

  /**
   * Check if a process is still running
   */
  public isProcessRunning(pid: number): boolean {
    const processInfo = this.processes.get(pid);
    return processInfo?.status === 'running' && this.childProcesses.has(pid);
  }

  /**
   * Wait for a process to exit
   */
  public async waitForProcess(pid: number, timeout?: number): Promise<ProcessInfo | null> {
    const processInfo = this.processes.get(pid);
    const childProcess = this.childProcesses.get(pid);

    if (!processInfo || !childProcess) {
      return null;
    }

    if (processInfo.status !== 'running') {
      return processInfo;
    }

    return new Promise((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | undefined;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      };

      // Set up timeout if specified
      if (timeout && timeout > 0) {
        timeoutHandle = setTimeout(() => {
          cleanup();
          reject(new Error(`Process ${pid} did not exit within ${timeout}ms`));
        }, timeout);
      }

      // Wait for exit
      const onExit = () => {
        cleanup();
        resolve(this.processes.get(pid) || null);
      };

      childProcess.once('exit', onExit);
      childProcess.once('error', (error) => {
        cleanup();
        reject(error);
      });
    });
  }

  /**
   * Graceful shutdown of all processes
   */
  public async shutdown(timeout: number = this.cleanupTimeout): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    const runningProcesses = this.getRunningProcesses();
    if (runningProcesses.length === 0) {
      this.emit('cleanupComplete', 0);
      return;
    }

    // First, try graceful shutdown with SIGTERM
    await this.killAllProcesses('SIGTERM');

    // Wait for processes to exit gracefully
    const gracefulShutdownPromise = this.waitForAllProcessesToExit(timeout / 2);

    try {
      await gracefulShutdownPromise;
    } catch (error) {
      // If graceful shutdown fails, force kill with SIGKILL
      await this.killAllProcesses('SIGKILL');

      // Wait a bit more for SIGKILL to take effect
      await this.waitForAllProcessesToExit(timeout / 2);
    }

    const remainingProcesses = this.getRunningProcesses().length;
    this.emit('cleanupComplete', runningProcesses.length - remainingProcesses);
  }

  /**
   * Clean up resources and remove listeners
   */
  public destroy(): void {
    // Remove all listeners from this instance
    this.removeAllListeners();

    // Clear process tracking
    this.processes.clear();
    this.childProcesses.clear();

    this.isShuttingDown = true;
  }

  /**
   * Wait for all processes to exit
   */
  private async waitForAllProcessesToExit(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkProcesses = () => {
        const runningProcesses = this.getRunningProcesses();

        if (runningProcesses.length === 0) {
          resolve();
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          reject(new Error(`Timeout waiting for processes to exit: ${runningProcesses.length} still running`));
          return;
        }

        // Check again in 100ms
        setTimeout(checkProcesses, 100);
      };

      checkProcesses();
    });
  }

  /**
   * Register signal handlers for cleanup
   */
  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered || ProcessLifecycleManager.globalHandlersRegistered) {
      return;
    }

    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    // Create a single global signal handler that all instances can use
    if (!ProcessLifecycleManager.globalSignalHandler) {
      ProcessLifecycleManager.globalSignalHandler = async (signal: NodeJS.Signals) => {
        console.log(`ProcessLifecycleManager: Received ${signal}, cleaning up processes...`);

        try {
          // Use the global singleton for cleanup in production
          if (_globalProcessManager) {
            await _globalProcessManager.shutdown();
          }
          console.log('ProcessLifecycleManager: Cleanup complete');
          process.exit(0);
        } catch (error) {
          console.error('ProcessLifecycleManager: Error during cleanup:', error);
          process.exit(1);
        }
      };

      signals.forEach(signal => {
        process.on(signal, ProcessLifecycleManager.globalSignalHandler!);
      });
    }

    this.signalHandlersRegistered = true;
    ProcessLifecycleManager.globalHandlersRegistered = true;
  }

  /**
   * Register exit handlers for cleanup
   */
  private registerExitHandlers(): void {
    if (ProcessLifecycleManager.globalExitHandlersRegistered) {
      return;
    }

    // Handle process exit
    process.on('exit', () => {
      // Synchronous cleanup only - clean up all instances
      if (_globalProcessManager) {
        const runningProcesses = _globalProcessManager.getRunningProcesses();
        runningProcesses.forEach(processInfo => {
          try {
            if (processInfo.pgid) {
              process.kill(-processInfo.pgid, 'SIGKILL');
            }
          } catch (error) {
            // Ignore errors during exit cleanup
          }
        });
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('ProcessLifecycleManager: Uncaught exception, cleaning up:', error);

      try {
        if (_globalProcessManager) {
          await _globalProcessManager.shutdown(1000); // Quick shutdown
        }
      } catch (cleanupError) {
        console.error('ProcessLifecycleManager: Error during exception cleanup:', cleanupError);
      }

      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
      console.error('ProcessLifecycleManager: Unhandled rejection, cleaning up:', reason);

      try {
        if (_globalProcessManager) {
          await _globalProcessManager.shutdown(1000); // Quick shutdown
        }
      } catch (cleanupError) {
        console.error('ProcessLifecycleManager: Error during rejection cleanup:', cleanupError);
      }

      process.exit(1);
    });

    ProcessLifecycleManager.globalExitHandlersRegistered = true;
  }
}

/**
 * Singleton instance for global process management
 */
let _globalProcessManager: ProcessLifecycleManager | null = null;

export const processLifecycleManager = (() => {
  if (!_globalProcessManager) {
    _globalProcessManager = new ProcessLifecycleManager();
  }
  return _globalProcessManager;
})();