"use strict";
/**
 * Cross-platform PTY (Pseudo Terminal) management using node-pty
 * Provides a unified interface for creating and managing terminal processes
 */
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
exports.PTYCreators = exports.PTYManager = void 0;
exports.createPTY = createPTY;
exports.createShellPTY = createShellPTY;
const pty = __importStar(require("node-pty"));
const events_1 = require("events");
const os_1 = require("os");
/**
 * Cross-platform PTY manager for terminal process management
 */
class PTYManager extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.pty = null;
        this.isActive = false;
        this.dataBuffer = [];
        this.maxBufferSize = 10000; // Maximum lines to keep in buffer
        // Set platform-specific defaults
        const defaultShell = this.getDefaultShell();
        this.config = {
            shell: config.shell || defaultShell,
            args: config.args || [],
            cwd: config.cwd || process.cwd(),
            env: { ...process.env, ...config.env },
            cols: config.cols || 80,
            rows: config.rows || 24,
            encoding: config.encoding || 'utf8',
            useConpty: config.useConpty ?? true,
            experimentalUseConpty: config.experimentalUseConpty ?? false,
        };
    }
    /**
     * Get the default shell for the current platform
     */
    getDefaultShell() {
        const currentPlatform = (0, os_1.platform)();
        switch (currentPlatform) {
            case 'win32':
                return process.env.COMSPEC || 'cmd.exe';
            case 'darwin':
                return process.env.SHELL || '/bin/zsh';
            default: // Linux and others
                return process.env.SHELL || '/bin/bash';
        }
    }
    /**
     * Spawn a new PTY process
     */
    spawn() {
        return new Promise((resolve, reject) => {
            try {
                if (this.pty) {
                    this.kill();
                }
                // Platform-specific options
                const options = {
                    cwd: this.config.cwd,
                    env: this.config.env,
                    cols: this.config.cols,
                    rows: this.config.rows,
                    encoding: this.config.encoding,
                };
                // Windows-specific options
                if ((0, os_1.platform)() === 'win32') {
                    options.useConpty = this.config.useConpty;
                    options.experimentalUseConpty = this.config.experimentalUseConpty;
                }
                this.pty = pty.spawn(this.config.shell, this.config.args, options);
                this.isActive = true;
                // Set up event handlers
                this.pty.onData((data) => {
                    this.addToBuffer(data);
                    this.emit('data', data);
                });
                this.pty.onExit((event) => {
                    this.isActive = false;
                    this.emit('exit', event.exitCode, event.signal);
                });
                // Emit spawn event
                this.emit('spawn');
                resolve();
            }
            catch (error) {
                this.emit('error', error);
                reject(error);
            }
        });
    }
    /**
     * Write data to the PTY
     */
    write(data) {
        if (!this.pty || !this.isActive) {
            throw new Error('PTY is not active');
        }
        try {
            this.pty.write(data);
            return true;
        }
        catch (error) {
            this.emit('error', error);
            return false;
        }
    }
    /**
     * Write a line to the PTY (appends newline)
     */
    writeLine(data) {
        return this.write(data + '\r');
    }
    /**
     * Send a control sequence (e.g., Ctrl+C)
     */
    sendControl(char) {
        if (!this.pty || !this.isActive) {
            throw new Error('PTY is not active');
        }
        const controlCode = char.toUpperCase().charCodeAt(0) - 64; // Convert to control code
        return this.write(String.fromCharCode(controlCode));
    }
    /**
     * Resize the PTY
     */
    resize(cols, rows) {
        if (!this.pty || !this.isActive) {
            throw new Error('PTY is not active');
        }
        try {
            this.pty.resize(cols, rows);
            this.config.cols = cols;
            this.config.rows = rows;
            this.emit('resize', { cols, rows });
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    /**
     * Get current PTY process information
     */
    getProcess() {
        if (!this.pty) {
            return null;
        }
        return {
            pid: this.pty.pid,
            process: this.pty.process,
            exitCode: this.isActive ? undefined : 0,
        };
    }
    /**
     * Get PTY dimensions
     */
    getDimensions() {
        return {
            cols: this.config.cols,
            rows: this.config.rows,
        };
    }
    /**
     * Check if PTY is active
     */
    isRunning() {
        return this.isActive && this.pty !== null;
    }
    /**
     * Get buffered output
     */
    getBuffer(lines) {
        if (lines && lines > 0) {
            return this.dataBuffer.slice(-lines);
        }
        return [...this.dataBuffer];
    }
    /**
     * Clear the data buffer
     */
    clearBuffer() {
        this.dataBuffer = [];
    }
    /**
     * Kill the PTY process
     */
    kill(signal) {
        if (this.pty) {
            try {
                this.pty.kill(signal);
            }
            catch (error) {
                // Process might already be dead
            }
            this.pty = null;
            this.isActive = false;
        }
    }
    /**
     * Add data to the buffer with size management
     */
    addToBuffer(data) {
        // Split data into lines for better buffer management
        const lines = data.split('\n');
        for (const line of lines) {
            this.dataBuffer.push(line);
            // Manage buffer size
            if (this.dataBuffer.length > this.maxBufferSize) {
                this.dataBuffer.shift();
            }
        }
    }
    /**
     * Set maximum buffer size
     */
    setMaxBufferSize(size) {
        this.maxBufferSize = size;
        // Trim current buffer if needed
        while (this.dataBuffer.length > this.maxBufferSize) {
            this.dataBuffer.shift();
        }
    }
    /**
     * Get the shell path being used
     */
    getShell() {
        return this.config.shell;
    }
    /**
     * Get the working directory
     */
    getCwd() {
        return this.config.cwd;
    }
    /**
     * Cleanup and dispose of resources
     */
    dispose() {
        this.kill();
        this.removeAllListeners();
        this.clearBuffer();
    }
}
exports.PTYManager = PTYManager;
/**
 * Utility function to create a PTY manager with common configurations
 */
function createPTY(config) {
    return new PTYManager(config);
}
/**
 * Utility function to create a PTY with a specific shell
 */
function createShellPTY(shell, config) {
    return new PTYManager({ ...config, shell });
}
/**
 * Platform-specific PTY creators
 */
exports.PTYCreators = {
    /**
     * Create a bash PTY (Unix/Linux/macOS)
     */
    bash: (config) => createShellPTY('/bin/bash', config),
    /**
     * Create a zsh PTY (macOS default)
     */
    zsh: (config) => createShellPTY('/bin/zsh', config),
    /**
     * Create a PowerShell PTY (Windows/Cross-platform)
     */
    powershell: (config) => {
        const shell = (0, os_1.platform)() === 'win32' ? 'powershell.exe' : 'pwsh';
        return createShellPTY(shell, config);
    },
    /**
     * Create a Command Prompt PTY (Windows)
     */
    cmd: (config) => createShellPTY('cmd.exe', config),
    /**
     * Create a fish PTY
     */
    fish: (config) => createShellPTY('/usr/bin/fish', config),
};
//# sourceMappingURL=PTYManager.js.map