"use strict";
/**
 * Validate command handler - validates scenario YAML files with detailed error reporting.
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
exports.registerValidateCommand = registerValidateCommand;
const scenarios_1 = require("../../scenarios");
const utils_1 = require("../../utils");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const chalk_1 = __importDefault(require("chalk"));
const output_1 = require("../output");
function registerValidateCommand(program) {
    program
        .command('validate')
        .description('Validate scenario files with detailed error reporting')
        .option('-d, --directory <path>', 'Scenarios directory', './scenarios')
        .option('-f, --file <path>', 'Single scenario file to validate')
        .option('--strict', 'Enable strict validation mode')
        .action(async (options) => {
        try {
            (0, output_1.logInfo)('Validating scenarios...');
            const parser = (0, utils_1.createYamlParser)({
                strictValidation: options.strict || false,
            });
            let validationResults = [];
            if (options.file) {
                try {
                    await fs.access(options.file);
                    const result = await parser.validateYamlFile(options.file);
                    validationResults.push({
                        file: options.file,
                        valid: result.valid,
                        errors: result.errors,
                    });
                    if (result.valid) {
                        const scenario = await scenarios_1.ScenarioLoader.loadFromFile(options.file);
                        (0, output_1.logSuccess)(`Scenario "${scenario.name}" is valid`);
                    }
                }
                catch (error) {
                    validationResults.push({
                        file: options.file,
                        valid: false,
                        errors: [error.message],
                    });
                }
            }
            else {
                try {
                    await fs.access(options.directory);
                }
                catch {
                    throw new output_1.CLIError(`Directory not found: ${options.directory}`, 'DIRECTORY_NOT_FOUND');
                }
                // Get all YAML files in directory
                const files = await fs.readdir(options.directory);
                const yamlFiles = files.filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
                if (yamlFiles.length === 0) {
                    (0, output_1.logWarning)('No YAML files found to validate');
                    return;
                }
                const progressBar = (0, output_1.createProgressBar)(yamlFiles.length, 'Validating files');
                progressBar.start(yamlFiles.length, 0);
                for (let index = 0; index < yamlFiles.length; index++) {
                    const file = yamlFiles[index];
                    const filePath = path.join(options.directory, file);
                    try {
                        const result = await parser.validateYamlFile(filePath);
                        validationResults.push({
                            file: filePath,
                            valid: result.valid,
                            errors: result.errors,
                        });
                        if (result.valid) {
                            await scenarios_1.ScenarioLoader.loadFromFile(filePath); // Additional validation
                        }
                    }
                    catch (error) {
                        validationResults.push({
                            file: filePath,
                            valid: false,
                            errors: [error.message],
                        });
                    }
                    progressBar.update(index + 1);
                }
                progressBar.stop();
            }
            // Report validation results
            const validFiles = validationResults.filter((r) => r.valid);
            const invalidFiles = validationResults.filter((r) => !r.valid);
            console.log('\n' + chalk_1.default.bold('Validation Results:'));
            console.log(chalk_1.default.green(`✓ Valid files: ${validFiles.length}`));
            console.log(chalk_1.default.red(`✗ Invalid files: ${invalidFiles.length}`));
            if (invalidFiles.length > 0) {
                console.log('\n' + chalk_1.default.red('Validation Errors:'));
                invalidFiles.forEach((result) => {
                    console.log(chalk_1.default.red(`\n✗ ${result.file}:`));
                    result.errors.forEach((error) => {
                        console.log(chalk_1.default.red(`  - ${error}`));
                    });
                });
                process.exit(1);
            }
            else {
                (0, output_1.logSuccess)(`All ${validationResults.length} file(s) are valid`);
            }
        }
        catch (error) {
            (0, output_1.handleCommandError)(error);
        }
    });
}
//# sourceMappingURL=validate.js.map