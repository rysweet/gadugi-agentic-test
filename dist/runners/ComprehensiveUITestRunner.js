"use strict";
/**
 * Comprehensive UI Test Runner
 * Exercises all tabs and features systematically.
 *
 * Thin facade: delegates tab-interaction logic to UIFlowTester.
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
exports.ComprehensiveUITestRunner = void 0;
exports.createComprehensiveUITestRunner = createComprehensiveUITestRunner;
exports.runComprehensiveUITests = runComprehensiveUITests;
const playwright_1 = require("playwright");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const TestModels_1 = require("../models/TestModels");
const UIFlowTester_1 = require("./comprehensive/UIFlowTester");
// ANSI colour codes (only used for the final summary here)
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    reset: '\x1b[0m'
};
/**
 * Comprehensive UI Test Runner
 *
 * Launches an Electron app and exercises every known tab using UIFlowTester.
 */
class ComprehensiveUITestRunner {
    constructor(screenshotsDir) {
        this.electronApp = null;
        this.page = null;
        this.screenshotsDir = screenshotsDir || path.join(process.cwd(), 'screenshots');
        this.results = { passed: 0, failed: 0, errors: [] };
        this.tester = new UIFlowTester_1.UIFlowTester(this.results, this.screenshotsDir);
    }
    /** Initialize the runner: create screenshot dir and launch Electron. */
    async initialize() {
        this.tester.logSection('Azure Tenant Grapher - Comprehensive UI Testing');
        await fs_1.promises.mkdir(this.screenshotsDir, { recursive: true });
        this.tester.logInfo('Launching Electron application...');
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const electronPath = require('electron');
        const appPath = path.resolve(process.cwd(), '..');
        this.electronApp = await playwright_1._electron.launch({
            executablePath: electronPath,
            args: [appPath],
            env: { ...process.env, NODE_ENV: 'test', TESTING: 'true' }
        });
        this.page = await this.electronApp.firstWindow();
        await this.page.waitForLoadState('domcontentloaded');
    }
    /** Run all tab tests plus responsiveness checks. */
    async runTests() {
        const startTime = new Date();
        let status = TestModels_1.TestStatus.PASSED;
        const screenshots = [];
        const logs = [];
        try {
            if (!this.page) {
                throw new Error('Page not initialized. Call initialize() first.');
            }
            const p = this.page;
            const t = this.tester;
            const addScreenshot = (p) => { if (p)
                screenshots.push(p); };
            addScreenshot(await t.testTab(p, 'Build', [t.testTenantIdInput.bind(t), t.testBuildButton.bind(t)]));
            addScreenshot(await t.testTab(p, 'Generate Spec', [t.testSpecGeneration.bind(t)]));
            addScreenshot(await t.testTab(p, 'Generate IaC', [t.testFormatSelector.bind(t)]));
            addScreenshot(await t.testTab(p, 'Create Tenant', [t.testSpecUpload.bind(t)]));
            addScreenshot(await t.testTab(p, 'Visualize', [t.testGraphVisualization.bind(t)]));
            addScreenshot(await t.testTab(p, 'Agent Mode', [t.testAgentInterface.bind(t)]));
            addScreenshot(await t.testTab(p, 'Threat Model', [t.testThreatModelGeneration.bind(t)]));
            addScreenshot(await t.testTab(p, 'Config', [t.testConfigFields.bind(t), t.testSaveConfig.bind(t)]));
            addScreenshot(await t.testTab(p, 'Status', [t.testSystemStatus.bind(t), t.testNeo4jStatus.bind(t)]));
            addScreenshot(await t.testTab(p, 'Help', [t.testHelpContent.bind(t)]));
            // Responsiveness tests
            t.logSection('UI Responsiveness Tests');
            await p.setViewportSize({ width: 1920, height: 1080 });
            await p.waitForTimeout(500);
            await p.setViewportSize({ width: 1024, height: 768 });
            await p.waitForTimeout(500);
            await p.keyboard.press('Tab');
            await p.keyboard.press('Tab');
            const darkModeToggle = await p.$('[aria-label*="theme"], [aria-label*="dark"], button:has-text("Dark")');
            if (darkModeToggle) {
                await darkModeToggle.click();
                await p.waitForTimeout(500);
            }
            else {
                t.logInfo('Dark mode toggle not found');
            }
        }
        catch (error) {
            this.tester.logInfo(`Test suite failed: ${error.message}`);
            status = TestModels_1.TestStatus.FAILED;
            logs.push(`Test suite failed: ${error.message}`);
        }
        const endTime = new Date();
        this.generateFinalReport();
        const resultsPath = path.join(process.cwd(), 'test-results.json');
        await fs_1.promises.writeFile(resultsPath, JSON.stringify(this.results, null, 2));
        this.tester.logInfo(`Results saved to ${resultsPath}`);
        if (this.results.failed > 0) {
            status = TestModels_1.TestStatus.FAILED;
        }
        else if (this.results.errors.length > 0) {
            status = TestModels_1.TestStatus.ERROR;
        }
        return {
            scenarioId: 'comprehensive-ui-test',
            status,
            duration: endTime.getTime() - startTime.getTime(),
            startTime,
            endTime,
            screenshots,
            logs,
            metadata: {
                totalTests: this.results.passed + this.results.failed,
                passed: this.results.passed,
                failed: this.results.failed,
                errors: this.results.errors
            }
        };
    }
    generateFinalReport() {
        this.tester.logSection('Test Results Summary');
        process.stdout.write(`${colors.green}Passed: ${this.results.passed}${colors.reset}\n`);
        process.stdout.write(`${colors.red}Failed: ${this.results.failed}${colors.reset}\n`);
        if (this.results.errors.length > 0) {
            process.stdout.write(`\n${colors.red}Errors:${colors.reset}\n`);
            this.results.errors.forEach((err, idx) => {
                process.stdout.write(`  ${idx + 1}. ${err.test}: ${err.error}\n`);
            });
        }
    }
    /** Close the Electron application. */
    async cleanup() {
        if (this.electronApp) {
            await this.electronApp.close();
            this.tester.logInfo('Electron app closed');
        }
    }
    /** Return a snapshot of current test results. */
    getResults() {
        return { ...this.results };
    }
}
exports.ComprehensiveUITestRunner = ComprehensiveUITestRunner;
/** Create and configure a Comprehensive UI Test Runner. */
function createComprehensiveUITestRunner(screenshotsDir) {
    return new ComprehensiveUITestRunner(screenshotsDir);
}
/** Run Comprehensive UI Tests as a standalone invocation. */
async function runComprehensiveUITests(screenshotsDir) {
    const runner = createComprehensiveUITestRunner(screenshotsDir);
    try {
        await runner.initialize();
        return await runner.runTests();
    }
    finally {
        await runner.cleanup();
    }
}
//# sourceMappingURL=ComprehensiveUITestRunner.js.map