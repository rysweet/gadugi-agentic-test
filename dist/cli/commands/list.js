"use strict";
/**
 * List command handler - lists available test scenarios with enhanced formatting.
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
exports.registerListCommand = registerListCommand;
const scenarios_1 = require("../../scenarios");
const fs = __importStar(require("fs/promises"));
const chalk_1 = __importDefault(require("chalk"));
const output_1 = require("../output");
function registerListCommand(program) {
    program
        .command('list')
        .description('List available scenarios with enhanced formatting')
        .option('-d, --directory <path>', 'Scenarios directory', './scenarios')
        .option('--json', 'Output as JSON')
        .option('--filter <tag>', 'Filter by tag')
        .action(async (options) => {
        try {
            // Validate directory exists
            try {
                await fs.access(options.directory);
            }
            catch {
                throw new output_1.CLIError(`Directory not found: ${options.directory}`, 'DIRECTORY_NOT_FOUND');
            }
            const scenarios = await scenarios_1.ScenarioLoader.loadFromDirectory(options.directory);
            if (scenarios.length === 0) {
                (0, output_1.logWarning)('No scenarios found');
                return;
            }
            // Filter by tag if specified
            let filteredScenarios = scenarios;
            if (options.filter) {
                filteredScenarios = scenarios.filter((scenario) => scenario.metadata?.tags?.includes(options.filter) || false);
                if (filteredScenarios.length === 0) {
                    (0, output_1.logWarning)(`No scenarios found with tag: ${options.filter}`);
                    return;
                }
            }
            if (options.json) {
                console.log(JSON.stringify(filteredScenarios.map((scenario) => ({
                    name: scenario.name,
                    description: scenario.description,
                    tags: scenario.metadata?.tags || [],
                })), null, 2));
            }
            else {
                console.log('\n' + chalk_1.default.bold('Available Scenarios:'));
                if (options.filter) {
                    console.log(chalk_1.default.gray(`Filtered by tag: ${options.filter}`));
                }
                console.log();
                filteredScenarios.forEach((scenario, index) => {
                    const statusIcon = chalk_1.default.green('●'); // Always enabled for now
                    console.log(`${statusIcon} ${chalk_1.default.bold(`${index + 1}. ${scenario.name}`)}`);
                    if (scenario.description) {
                        console.log(`   ${chalk_1.default.gray('Description:')} ${scenario.description}`);
                    }
                    if (scenario.metadata?.tags && scenario.metadata.tags.length > 0) {
                        const tagStr = scenario.metadata.tags
                            .map((tag) => chalk_1.default.cyan(`#${tag}`))
                            .join(' ');
                        console.log(`   ${chalk_1.default.gray('Tags:')} ${tagStr}`);
                    }
                    console.log();
                });
                // Summary
                const enabled = filteredScenarios.length;
                const disabled = 0; // All enabled for now
                console.log(chalk_1.default.bold('Summary:'));
                console.log(`${chalk_1.default.green('●')} Enabled: ${enabled}`);
                console.log(`${chalk_1.default.red('○')} Disabled: ${disabled}`);
                console.log(`Total: ${filteredScenarios.length}`);
            }
        }
        catch (error) {
            (0, output_1.handleCommandError)(error);
        }
    });
}
//# sourceMappingURL=list.js.map