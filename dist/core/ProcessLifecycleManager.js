"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processLifecycleManager = exports.ProcessLifecycleManager = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
/**
 * ProcessLifecycleManager
 *
 * Comprehensive process lifecycle management to prevent zombie processes
 * and ensure proper cleanup of all child processes and their process groups.
 */
class ProcessLifecycleManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.processes = new Map();
        this.childProcesses = new Map();
        this.isShuttingDown = false;
        this.cleanupTimeout = 5000; // 5 seconds for graceful shutdown
        this.signalHandlersRegistered = false;
        this.registerSignalHandlers();
        this.registerExitHandlers();
    }
    /**
     * Start a new process with lifecycle management
     */
    startProcess(command, args = [], options = {}) {
        if (this.isShuttingDown) {
            throw new Error('Cannot start new processes during shutdown');
        }
        // Force detached mode for proper process group management
        const processOptions = {
            ...options,
            detached: true,
            // Create new process group to prevent inheriting parent's signals
            stdio: 'pipe',
        };
        let childProcess;
        try {
            childProcess = (0, child_process_1.spawn)(command, args, processOptions);
            // Add error handler immediately to prevent unhandled errors from crashing
            childProcess.on('error', (error) => {
                // Create a temporary process info for the error
                const tempProcessInfo = {
                    pid: childProcess.pid || -1,
                    command,
                    args,
                    startTime: new Date(),
                    status: 'terminated'
                };
                try {
                    this.emit('error', error, tempProcessInfo);
                }
                catch (emitError) {
                    console.error('Error emitting process error:', emitError);
                }
            });
        }
        catch (error) {
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
        const processInfo = {
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
    setupProcessHandlers(childProcess, processInfo) {
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
            }
            catch (emitError) {
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
    async killProcess(pid, signal = 'SIGTERM') {
        const processInfo = this.processes.get(pid);
        const childProcess = this.childProcesses.get(pid);
        if (!processInfo || !childProcess) {
            return false;
        }
        try {
            // Kill the entire process group to catch all child processes
            if (processInfo.pgid) {
                process.kill(-processInfo.pgid, signal);
            }
            else {
                childProcess.kill(signal);
            }
            processInfo.status = 'killed';
            this.processes.set(pid, processInfo);
            this.emit('processKilled', processInfo);
            return true;
        }
        catch (error) {
            this.emit('error', error, processInfo);
            return false;
        }
    }
    /**
     * Kill all managed processes
     */
    async killAllProcesses(signal = 'SIGTERM') {
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
    getProcesses() {
        return Array.from(this.processes.values());
    }
    /**
     * Get information about running processes
     */
    getRunningProcesses() {
        return this.getProcesses().filter(p => p.status === 'running');
    }
    /**
     * Check if a process is still running
     */
    isProcessRunning(pid) {
        const processInfo = this.processes.get(pid);
        return processInfo?.status === 'running' && this.childProcesses.has(pid);
    }
    /**
     * Wait for a process to exit
     */
    async waitForProcess(pid, timeout) {
        const processInfo = this.processes.get(pid);
        const childProcess = this.childProcesses.get(pid);
        if (!processInfo || !childProcess) {
            return null;
        }
        if (processInfo.status !== 'running') {
            return processInfo;
        }
        return new Promise((resolve, reject) => {
            let timeoutHandle;
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
    async shutdown(timeout = this.cleanupTimeout) {
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
        }
        catch (error) {
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
    destroy() {
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
    async waitForAllProcessesToExit(timeout) {
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
    registerSignalHandlers() {
        if (this.signalHandlersRegistered || ProcessLifecycleManager.globalHandlersRegistered) {
            return;
        }
        const signals = ['SIGTERM', 'SIGINT'];
        // Create a single global signal handler that all instances can use
        if (!ProcessLifecycleManager.globalSignalHandler) {
            ProcessLifecycleManager.globalSignalHandler = async (signal) => {
                console.log(`ProcessLifecycleManager: Received ${signal}, cleaning up processes...`);
                try {
                    // Use the global singleton for cleanup in production
                    if (_globalProcessManager) {
                        await _globalProcessManager.shutdown();
                    }
                    console.log('ProcessLifecycleManager: Cleanup complete');
                    process.exit(0);
                }
                catch (error) {
                    console.error('ProcessLifecycleManager: Error during cleanup:', error);
                    process.exit(1);
                }
            };
            signals.forEach(signal => {
                process.on(signal, ProcessLifecycleManager.globalSignalHandler);
            });
        }
        this.signalHandlersRegistered = true;
        ProcessLifecycleManager.globalHandlersRegistered = true;
    }
    /**
     * Register exit handlers for cleanup
     */
    registerExitHandlers() {
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
                    }
                    catch (error) {
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
            }
            catch (cleanupError) {
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
            }
            catch (cleanupError) {
                console.error('ProcessLifecycleManager: Error during rejection cleanup:', cleanupError);
            }
            process.exit(1);
        });
        ProcessLifecycleManager.globalExitHandlersRegistered = true;
    }
}
exports.ProcessLifecycleManager = ProcessLifecycleManager;
ProcessLifecycleManager.globalHandlersRegistered = false;
ProcessLifecycleManager.globalSignalHandler = null;
ProcessLifecycleManager.globalExitHandlersRegistered = false;
/**
 * Singleton instance for global process management
 */
let _globalProcessManager = null;
exports.processLifecycleManager = (() => {
    if (!_globalProcessManager) {
        _globalProcessManager = new ProcessLifecycleManager();
    }
    return _globalProcessManager;
})();
//# sourceMappingURL=ProcessLifecycleManager.js.map