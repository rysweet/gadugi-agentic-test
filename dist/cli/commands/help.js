"use strict";
/**
 * Help command handler - displays extended usage examples.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHelpCommand = registerHelpCommand;
const chalk_1 = __importDefault(require("chalk"));
function registerHelpCommand(program) {
    program
        .command('help [command]')
        .description('Display help for a specific command')
        .action((command) => {
        if (command) {
            program.help({ error: false });
        }
        else {
            console.log();
            console.log(chalk_1.default.bold('Agentic Testing System - Examples:'));
            console.log();
            console.log(chalk_1.default.gray('# Run all scenarios'));
            console.log('agentic-test run');
            console.log();
            console.log(chalk_1.default.gray('# Run specific scenario'));
            console.log('agentic-test run --scenario my-test');
            console.log();
            console.log(chalk_1.default.gray('# Run with custom configuration'));
            console.log('agentic-test run --config my-config.yaml');
            console.log();
            console.log(chalk_1.default.gray('# Watch for file changes'));
            console.log('agentic-test watch --directory ./my-scenarios');
            console.log();
            console.log(chalk_1.default.gray('# Initialize new project'));
            console.log('agentic-test init --template electron --directory my-project');
            console.log();
            console.log(chalk_1.default.gray('# Validate scenarios'));
            console.log('agentic-test validate --strict');
            console.log();
            console.log(chalk_1.default.gray('# List scenarios with filtering'));
            console.log('agentic-test list --filter integration');
            console.log();
        }
    });
}
//# sourceMappingURL=help.js.map