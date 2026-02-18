"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TUIAgent = void 0;
const events_1 = require("events");
const pty = __importStar(require("node-pty-prebuilt-multiarch"));
const ProcessLifecycleManager_1 = require("./ProcessLifecycleManager");
const AdaptiveWaiter_1 = require("./AdaptiveWaiter");
/**
 * TUIAgent
 *
 * Terminal User Interface Agent that manages terminal processes
 * with integrated ProcessLifecycleManager to prevent zombie processes.
 */
class TUIAgent extends events_1.EventEmitter {
    constructor(config = {}, processManager) {
        super();
        this.ptyProcess = null;
        this.processInfo = null;
        this.isDestroyed = false;
        this.outputBuffer = '';
        this.inputHistory = [];
        this.processManager = processManager || new ProcessLifecycleManager_1.ProcessLifecycleManager();
        // Set default configuration
        this.config = {
            shell: config.shell || this.detectShell(),
            env: config.env || process.env,
            cwd: config.cwd || process.cwd(),
            dimensions: config.dimensions || { cols: 80, rows: 24 },
            timeout: config.timeout || 30000,
        };
        this.setupProcessManagerEvents();
    }
    /**
     * Detect the default shell for the current platform
     */
    detectShell() {
        if (process.platform === 'win32') {
            return process.env.COMSPEC || 'cmd.exe';
        }
        return process.env.SHELL || '/bin/bash';
    }
    /**
     * Set up event handlers for the process manager
     */
    setupProcessManagerEvents() {
        this.processManager.on('processExited', (processInfo, code, signal) => {
            if (processInfo.pid === this.processInfo?.pid) {
                this.emit('exit', code, signal);
            }
        });
        this.processManager.on('error', (error, processInfo) => {
            if (processInfo?.pid === this.processInfo?.pid) {
                this.emit('error', error);
            }
        });
    }
    /**
     * Start the terminal process
     */
    async start() {
        if (this.isDestroyed) {
            throw new Error('Cannot start a destroyed TUIAgent');
        }
        if (this.ptyProcess) {
            throw new Error('TUIAgent is already started');
        }
        try {
            // Create PTY process
            this.ptyProcess = pty.spawn(this.config.shell, [], {
                name: 'xterm-color',
                cols: this.config.dimensions.cols,
                rows: this.config.dimensions.rows,
                cwd: this.config.cwd,
                env: this.config.env,
            });
            // Track the process with our lifecycle manager
            // Note: node-pty doesn't expose the underlying child process directly,
            // so we create a custom process info for tracking
            this.processInfo = {
                pid: this.ptyProcess.pid,
                command: this.config.shell,
                args: [],
                startTime: new Date(),
                status: 'running',
            };
            // Set up PTY event handlers
            this.setupPtyHandlers();
            this.emit('ready');
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Set up PTY event handlers
     */
    setupPtyHandlers() {
        if (!this.ptyProcess) {
            return;
        }
        // Handle data output
        this.ptyProcess.onData((data) => {
            this.outputBuffer += data;
            this.emit('data', data);
        });
        // Handle process exit
        this.ptyProcess.onExit(({ exitCode, signal }) => {
            if (this.processInfo) {
                this.processInfo.status = 'exited';
                this.processInfo.exitCode = exitCode || undefined;
            }
            this.emit('exit', exitCode, signal?.toString() || null);
        });
    }
    /**
     * Write input to the terminal
     */
    write(data) {
        if (!this.ptyProcess || this.isDestroyed) {
            throw new Error('TUIAgent is not started or is destroyed');
        }
        this.ptyProcess.write(data);
        this.inputHistory.push(data);
    }
    /**
     * Write a line to the terminal (adds newline)
     */
    writeLine(data) {
        this.write(data + '\r\n');
    }
    /**
     * Execute a command and wait for completion using AdaptiveWaiter
     */
    async executeCommand(command, options = {}) {
        if (!this.ptyProcess || this.isDestroyed) {
            throw new Error('TUIAgent is not started or is destroyed');
        }
        const timeout = options.timeout || this.config.timeout;
        const initialBufferLength = this.outputBuffer.length;
        // Execute the command
        this.writeLine(command);
        // Use AdaptiveWaiter for intelligent output detection
        const result = options.expectedOutput
            ? await (0, AdaptiveWaiter_1.waitForOutput)(() => this.outputBuffer.substring(initialBufferLength), options.expectedOutput, { timeout, initialDelay: 50, maxDelay: 500 })
            : await (0, AdaptiveWaiter_1.waitForTerminalReady)(() => this.outputBuffer.substring(initialBufferLength), /\$\s*$/, { timeout, initialDelay: 100, maxDelay: 1000 });
        if (!result.success) {
            if (result.lastError) {
                throw result.lastError;
            }
            throw new Error(`Command execution timeout after ${timeout}ms: ${command}`);
        }
        return result.result || this.outputBuffer.substring(initialBufferLength);
    }
    /**
     * Clear the output buffer
     */
    clearOutput() {
        this.outputBuffer = '';
    }
    /**
     * Get the current output buffer
     */
    getOutput() {
        return this.outputBuffer;
    }
    /**
     * Get the input history
     */
    getInputHistory() {
        return [...this.inputHistory];
    }
    /**
     * Get the process information
     */
    getProcessInfo() {
        return this.processInfo ? { ...this.processInfo } : null;
    }
    /**
     * Check if the agent is running
     */
    isRunning() {
        return this.ptyProcess !== null && !this.isDestroyed && this.processInfo?.status === 'running';
    }
    /**
     * Resize the terminal
     */
    resize(dimensions) {
        if (!this.ptyProcess || this.isDestroyed) {
            throw new Error('TUIAgent is not started or is destroyed');
        }
        this.ptyProcess.resize(dimensions.cols, dimensions.rows);
        this.config.dimensions = dimensions;
    }
    /**
     * Kill the terminal process
     */
    async kill(signal = 'SIGTERM') {
        if (!this.ptyProcess || this.isDestroyed) {
            return;
        }
        try {
            // Use the process manager to kill if we have process info
            if (this.processInfo && this.processManager) {
                await this.processManager.killProcess(this.processInfo.pid, signal);
            }
            else {
                // Fallback to direct PTY kill
                this.ptyProcess.kill(signal);
            }
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    /**
     * Destroy the TUI agent and clean up all resources
     */
    async destroy() {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        try {
            // Kill the process if it's running
            if (this.isRunning()) {
                await this.kill('SIGTERM');
                // Use AdaptiveWaiter to wait for graceful termination
                const result = await AdaptiveWaiter_1.adaptiveWaiter.waitForCondition(() => !this.isRunning(), {
                    initialDelay: 100,
                    maxDelay: 500,
                    timeout: 2000,
                    jitter: 0.1
                });
                // Force kill if still running after timeout
                if (!result.success && this.isRunning()) {
                    await this.kill('SIGKILL');
                }
            }
            // Clean up PTY
            if (this.ptyProcess) {
                try {
                    this.ptyProcess.kill();
                }
                catch (error) {
                    // Ignore errors during cleanup
                }
                this.ptyProcess = null;
            }
            // Clear tracking info
            this.processInfo = null;
            this.outputBuffer = '';
            this.inputHistory = [];
            this.emit('destroyed');
        }
        catch (error) {
            this.emit('error', error);
        }
    }
}
exports.TUIAgent = TUIAgent;
//# sourceMappingURL=TUIAgent.js.map