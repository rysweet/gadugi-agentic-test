"use strict";
/**
 * Init command handler - initializes a new testing project with templates and configuration.
 * Template content is in init-templates.ts to keep this file under 300 LOC.
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
exports.registerInitCommand = registerInitCommand;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const chalk_1 = __importDefault(require("chalk"));
const output_1 = require("../output");
const init_templates_1 = require("./init-templates");
function registerInitCommand(program) {
    program
        .command('init')
        .description('Initialize a new testing project with templates and configuration')
        .option('-d, --directory <path>', 'Target directory', './agentic-testing')
        .option('--force', 'Overwrite existing files')
        .option('--template <type>', 'Project template (basic, advanced, electron)', 'basic')
        .action(async (options) => {
        try {
            (0, output_1.logInfo)(`Initializing new testing project in: ${chalk_1.default.cyan(options.directory)}`);
            // Check if directory exists
            let directoryExists = false;
            try {
                await fs.access(options.directory);
                directoryExists = true;
            }
            catch {
                // Directory doesn't exist, we'll create it
            }
            if (directoryExists && !options.force) {
                // Check if directory is empty
                const files = await fs.readdir(options.directory);
                if (files.length > 0) {
                    throw new output_1.CLIError(`Directory ${options.directory} is not empty. Use --force to overwrite existing files.`, 'DIRECTORY_NOT_EMPTY');
                }
            }
            // Create directory if it doesn't exist
            if (!directoryExists) {
                await fs.mkdir(options.directory, { recursive: true });
                (0, output_1.logSuccess)(`Created directory: ${options.directory}`);
            }
            // Create subdirectories
            const subdirs = ['scenarios', 'scripts', 'reports', 'screenshots', 'temp'];
            for (const subdir of subdirs) {
                const dirPath = path.join(options.directory, subdir);
                await fs.mkdir(dirPath, { recursive: true });
                (0, output_1.logSuccess)(`Created directory: ${subdir}/`);
            }
            // Create configuration file
            const configPath = path.join(options.directory, 'agentic-test.config.yaml');
            await fs.writeFile(configPath, (0, init_templates_1.getConfigTemplate)(options.template), 'utf-8');
            (0, output_1.logSuccess)('Created configuration file: agentic-test.config.yaml');
            // Create .env template
            const envPath = path.join(options.directory, '.env.example');
            await fs.writeFile(envPath, (0, init_templates_1.getEnvTemplate)(), 'utf-8');
            (0, output_1.logSuccess)('Created environment template: .env.example');
            // Create scenario templates
            const scenarioTemplates = (0, init_templates_1.getScenarioTemplates)(options.template);
            for (const [filename, content] of Object.entries(scenarioTemplates)) {
                const scenarioPath = path.join(options.directory, 'scenarios', filename);
                await fs.writeFile(scenarioPath, content, 'utf-8');
                (0, output_1.logSuccess)(`Created scenario template: scenarios/${filename}`);
            }
            // Create package.json for project
            const packagePath = path.join(options.directory, 'package.json');
            await fs.writeFile(packagePath, (0, init_templates_1.getPackageJsonTemplate)(path.basename(options.directory)), 'utf-8');
            (0, output_1.logSuccess)('Created package.json');
            // Create README.md
            const readmePath = path.join(options.directory, 'README.md');
            await fs.writeFile(readmePath, (0, init_templates_1.getReadmeTemplate)(options.template), 'utf-8');
            (0, output_1.logSuccess)('Created README.md');
            // Create .gitignore
            const gitignorePath = path.join(options.directory, '.gitignore');
            await fs.writeFile(gitignorePath, (0, init_templates_1.getGitignoreTemplate)(), 'utf-8');
            (0, output_1.logSuccess)('Created .gitignore');
            console.log();
            (0, output_1.logSuccess)('Project initialization completed!');
            console.log();
            console.log(chalk_1.default.bold('Next steps:'));
            console.log(chalk_1.default.gray('1.'), `cd ${options.directory}`);
            console.log(chalk_1.default.gray('2.'), 'cp .env.example .env');
            console.log(chalk_1.default.gray('3.'), 'npm install');
            console.log(chalk_1.default.gray('4.'), 'Edit scenarios in the scenarios/ directory');
            console.log(chalk_1.default.gray('5.'), 'Run tests with: agentic-test run');
            console.log();
        }
        catch (error) {
            (0, output_1.handleCommandError)(error);
        }
    });
}
//# sourceMappingURL=init.js.map