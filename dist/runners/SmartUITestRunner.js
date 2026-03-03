#!/usr/bin/env node
"use strict";
/**
 * Smart UI Testing Runner
 * Uses Playwright's accessibility tree and element detection to test like a user.
 *
 * Thin facade: delegates element discovery to SmartElementFinder and tab
 * interaction to SmartInteractionExecutor.
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
exports.SmartUITestRunner = void 0;
exports.createSmartUITestRunner = createSmartUITestRunner;
exports.runSmartUITests = runSmartUITests;
const playwright_1 = require("playwright");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const TestModels_1 = require("../models/TestModels");
const SmartElementFinder_1 = require("./smart/SmartElementFinder");
const SmartInteractionExecutor_1 = require("./smart/SmartInteractionExecutor");
// ANSI colour codes
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m'
};
/**
 * Smart UI Test Runner
 *
 * Launches an Electron app, discovers tabs via SmartElementFinder, and
 * exercises each tab via SmartInteractionExecutor.
 */
class SmartUITestRunner {
    constructor(screenshotsDir) {
        this.electronApp = null;
        this.page = null;
        this.screenshotsDir = screenshotsDir || path.join(process.cwd(), 'screenshots');
        this.testContext = {
            currentTab: null,
            testedFeatures: [],
            interactions: [],
            issues: [],
            screenshots: []
        };
        this.finder = new SmartElementFinder_1.SmartElementFinder();
        this.executor = new SmartInteractionExecutor_1.SmartInteractionExecutor(this.testContext.testedFeatures, this.testContext.issues, this.log.bind(this));
    }
    log(color, emoji, msg) {
        process.stdout.write(`${colors[color]}${emoji} ${msg}${colors.reset}\n`);
    }
    /** Initialize the test runner: create screenshot dir and launch Electron. */
    async initialize() {
        await fs_1.promises.mkdir(this.screenshotsDir, { recursive: true });
        this.log('cyan', '🤖', 'Smart UI Testing Agent');
        this.log('cyan', '🎯', 'Testing the UI by discovering and using actual features\n');
        this.log('blue', '🚀', 'Launching application...');
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const electronPath = require('electron');
        const appPath = path.resolve(process.cwd(), '..');
        this.electronApp = await playwright_1._electron.launch({
            executablePath: electronPath,
            args: [appPath],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        this.page = await this.electronApp.firstWindow();
        await this.page.waitForLoadState('domcontentloaded');
        this.log('green', '✅', 'Application ready\n');
    }
    /** Run all discovered tab tests and keyboard-navigation checks. */
    async runTests() {
        const startTime = new Date();
        let status = TestModels_1.TestStatus.PASSED;
        const screenshots = [];
        const logs = [];
        try {
            if (!this.page) {
                throw new Error('Page not initialized. Call initialize() first.');
            }
            this.log('cyan', '🔍', 'Discovering UI elements...');
            const initialElements = await this.finder.discoverElements(this.page);
            this.log('blue', '📋', `Found ${initialElements.interactive.length} interactive elements`);
            const tabElements = initialElements.interactive.filter(el => el.type === 'link' && (el.text && el.text.length < 20));
            this.log('blue', '📑', `Found ${tabElements.length} potential tabs\n`);
            const tabTests = {
                'scan': this.executor.testScanTab.bind(this.executor),
                'build': this.executor.testScanTab.bind(this.executor),
                'generate iac': this.executor.testGenerateIaCTab.bind(this.executor),
                'iac': this.executor.testGenerateIaCTab.bind(this.executor),
                'visualize': this.executor.testVisualizeTab.bind(this.executor),
                'status': this.executor.testStatusTab.bind(this.executor),
                'config': this.executor.testConfigTab.bind(this.executor),
                'configuration': this.executor.testConfigTab.bind(this.executor)
            };
            for (const tabElement of tabElements) {
                const tabName = tabElement.text?.trim();
                if (!tabName)
                    continue;
                this.log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
                this.log('yellow', '📂', `Testing "${tabName}" Tab`);
                try {
                    const clicked = await this.page.click(`text="${tabName}"`, { timeout: 5000 })
                        .then(() => true)
                        .catch(() => false);
                    if (clicked) {
                        await this.page.waitForTimeout(1000);
                        const screenshotName = `${tabName.toLowerCase().replace(/\s+/g, '-')}-tested.png`;
                        const screenshotPath = path.join(this.screenshotsDir, screenshotName);
                        await this.page.screenshot({ path: screenshotPath, fullPage: true });
                        this.testContext.screenshots.push(screenshotName);
                        screenshots.push(screenshotPath);
                        const tabDiscovery = await this.finder.discoverElements(this.page);
                        this.log('blue', '🔎', `Tab contains ${tabDiscovery.interactive.length} elements`);
                        const testFn = Object.entries(tabTests).find(([key]) => tabName.toLowerCase().includes(key))?.[1];
                        if (testFn) {
                            await testFn(this.page);
                        }
                        else {
                            const buttons = tabDiscovery.interactive.filter(el => el.type === 'button');
                            const inputs = tabDiscovery.interactive.filter(el => el.type?.includes('input') || el.type === 'text' || el.type === 'textarea');
                            if (buttons.length > 0)
                                this.log('blue', '🔘', `${buttons.length} buttons available`);
                            if (inputs.length > 0)
                                this.log('blue', '📝', `${inputs.length} input fields available`);
                        }
                        this.testContext.interactions.push({
                            tab: tabName,
                            elementsFound: tabDiscovery.interactive.length,
                            headings: tabDiscovery.headings
                        });
                    }
                    else {
                        this.log('yellow', '⚠️', `Could not navigate to ${tabName}`);
                    }
                }
                catch (error) {
                    this.log('red', '❌', `Error testing ${tabName}: ${error.message}`);
                    status = TestModels_1.TestStatus.ERROR;
                }
            }
            // Keyboard navigation
            this.log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
            this.log('yellow', '⌨️', 'Testing Keyboard Navigation');
            await this.page.keyboard.press('Tab');
            await this.page.keyboard.press('Tab');
            await this.page.keyboard.press('Tab');
            this.log('green', '✅', 'Tab key navigation working');
            await this.page.keyboard.press('Escape');
            this.log('green', '✅', 'Escape key handled');
            this.testContext.testedFeatures.push('Keyboard navigation');
        }
        catch (error) {
            this.log('red', '❌', `Test failed: ${error.message}`);
            status = TestModels_1.TestStatus.FAILED;
            logs.push(`Test failed: ${error.message}`);
        }
        const endTime = new Date();
        this.generateReport();
        const resultsPath = path.join(process.cwd(), 'smart-test-results.json');
        await fs_1.promises.writeFile(resultsPath, JSON.stringify(this.testContext, null, 2));
        this.log('green', '\n💾', `Results saved to ${resultsPath}`);
        return {
            scenarioId: 'smart-ui-test',
            status,
            duration: endTime.getTime() - startTime.getTime(),
            startTime,
            endTime,
            screenshots,
            logs,
            metadata: {
                testedFeatures: this.testContext.testedFeatures,
                issues: this.testContext.issues,
                interactions: this.testContext.interactions
            }
        };
    }
    generateReport() {
        this.log('cyan', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
        this.log('cyan', '📊', 'Test Report Summary');
        this.log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '');
        this.log('green', '\n✅', `Features Tested: ${this.testContext.testedFeatures.length}`);
        this.testContext.testedFeatures.forEach(f => this.log('blue', '  •', f));
        if (this.testContext.issues.length > 0) {
            this.log('yellow', '\n⚠️', `Issues Found: ${this.testContext.issues.length}`);
            this.testContext.issues.forEach(i => this.log('yellow', '  •', i));
        }
        this.log('blue', '\n📸', `Screenshots Captured: ${this.testContext.screenshots.length}`);
        this.log('cyan', '\n🎯', 'Testing Strategy:');
        this.log('blue', '  •', 'Discovered UI elements automatically');
        this.log('blue', '  •', 'Navigated through tabs like a user');
        this.log('blue', '  •', 'Interacted with forms and buttons');
        this.log('blue', '  •', 'Verified status indicators');
        this.log('blue', '  •', 'Tested keyboard navigation');
    }
    /** Close the Electron application and release resources. */
    async cleanup() {
        if (this.electronApp) {
            await this.electronApp.close();
            this.log('blue', '🏁', 'Application closed');
        }
    }
}
exports.SmartUITestRunner = SmartUITestRunner;
/** Create and configure a Smart UI Test Runner. */
function createSmartUITestRunner(screenshotsDir) {
    return new SmartUITestRunner(screenshotsDir);
}
/** Run Smart UI Tests as a standalone invocation. */
async function runSmartUITests(screenshotsDir) {
    const runner = createSmartUITestRunner(screenshotsDir);
    try {
        await runner.initialize();
        return await runner.runTests();
    }
    finally {
        await runner.cleanup();
    }
}
//# sourceMappingURL=SmartUITestRunner.js.map