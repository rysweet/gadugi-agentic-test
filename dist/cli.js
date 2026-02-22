#!/usr/bin/env node
"use strict";
/**
 * Command Line Interface for the Agentic Testing System
 *
 * This file is the Commander entry point only. All command logic lives in
 * src/cli/commands/. Shared output utilities are in src/cli/output.ts.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const dotenv = __importStar(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const output_1 = require("./cli/output");
const run_1 = require("./cli/commands/run");
const watch_1 = require("./cli/commands/watch");
const validate_1 = require("./cli/commands/validate");
const list_1 = require("./cli/commands/list");
const init_1 = require("./cli/commands/init");
const help_1 = require("./cli/commands/help");
// Load environment variables from .env file if it exists
try {
    dotenv.config();
}
catch (error) {
    // Silently ignore if .env doesn't exist
}
const program = new commander_1.Command();
program
    .name('agentic-test')
    .description('TypeScript Agentic Testing System for Electron applications')
    .version('1.0.0');
// Global options
program
    .option('--verbose', 'Enable verbose logging')
    .option('--debug', 'Enable debug logging')
    .option('--no-color', 'Disable colored output')
    .option('--env <file>', 'Load environment variables from file', '.env')
    .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    // Handle color option
    if (opts.noColor) {
        chalk_1.default.level = 0; // Disable colors
    }
    // Load additional .env file if specified
    if (opts.env && opts.env !== '.env') {
        try {
            dotenv.config({ path: opts.env });
            (0, output_1.logInfo)(`Loaded environment from: ${opts.env}`);
        }
        catch (error) {
            (0, output_1.logWarning)(`Failed to load environment file: ${opts.env}`);
        }
    }
    // Set logging level (simplified for compatibility)
    if (opts.debug) {
        console.log('Debug logging enabled');
    }
    else if (opts.verbose) {
        console.log('Verbose logging enabled');
    }
});
// Register all commands
(0, run_1.registerRunCommand)(program);
(0, watch_1.registerWatchCommand)(program);
(0, validate_1.registerValidateCommand)(program);
(0, list_1.registerListCommand)(program);
(0, init_1.registerInitCommand)(program);
(0, help_1.registerHelpCommand)(program);
// Handle unknown commands
program
    .command('*', { hidden: true })
    .action((cmd) => {
    (0, output_1.logError)(`Unknown command: ${cmd}`);
    console.log();
    console.log('Run', chalk_1.default.cyan('agentic-test help'), 'for usage information.');
    process.exit(1);
});
// Enhanced error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    (0, output_1.logError)('Uncaught exception:');
    console.error(error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    (0, output_1.logError)('Unhandled rejection at:');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    process.exit(1);
});
// Parse command line arguments
if (require.main === module) {
    program.parse();
}
exports.default = program;
//# sourceMappingURL=cli.js.map