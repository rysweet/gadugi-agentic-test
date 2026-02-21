"use strict";
/**
 * Shared output helpers for CLI commands.
 * Provides colored console output functions used across all commands.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = void 0;
exports.logSuccess = logSuccess;
exports.logError = logError;
exports.logWarning = logWarning;
exports.logInfo = logInfo;
exports.createProgressBar = createProgressBar;
exports.handleCommandError = handleCommandError;
const chalk_1 = __importDefault(require("chalk"));
const cli_progress_1 = require("cli-progress");
function logSuccess(message) {
    console.log(chalk_1.default.green('✓'), message);
}
function logError(message) {
    console.log(chalk_1.default.red('✗'), message);
}
function logWarning(message) {
    console.log(chalk_1.default.yellow('⚠'), message);
}
function logInfo(message) {
    console.log(chalk_1.default.blue('ℹ'), message);
}
function createProgressBar(total, description) {
    return new cli_progress_1.SingleBar({
        format: chalk_1.default.blue(description) + ' |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    }, cli_progress_1.Presets.rect);
}
/**
 * Enhanced error class for CLI-specific errors with optional error codes.
 */
class CLIError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'CLIError';
    }
}
exports.CLIError = CLIError;
/**
 * Handle a CLIError or unknown error uniformly, logging and exiting.
 */
function handleCommandError(error) {
    if (error instanceof CLIError) {
        logError(error.message);
        if (error.code) {
            logInfo(`Error code: ${error.code}`);
        }
    }
    else {
        logError('Command failed:');
        console.error(error);
    }
    process.exit(1);
}
//# sourceMappingURL=output.js.map