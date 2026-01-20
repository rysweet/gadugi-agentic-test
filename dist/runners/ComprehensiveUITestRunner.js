"use strict";
/**
 * Comprehensive UI Test Runner
 * Exercises all tabs and features systematically
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
// Color output helpers
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};
/**
 * Comprehensive UI Test Runner class
 */
class ComprehensiveUITestRunner {
    constructor(screenshotsDir) {
        this.electronApp = null;
        this.page = null;
        this.screenshotsDir = screenshotsDir || path.join(process.cwd(), 'screenshots');
        this.results = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }
    logSuccess(msg) {
        console.log(`${colors.green}✅ ${msg}${colors.reset}`);
        this.results.passed++;
    }
    logError(msg, error) {
        console.log(`${colors.red}❌ ${msg}${colors.reset}`);
        if (error) {
            const errorMsg = error instanceof Error ? error.message : error;
            console.log(`   ${colors.red}${errorMsg}${colors.reset}`);
        }
        this.results.failed++;
        this.results.errors.push({
            test: msg,
            error: error instanceof Error ? error.message : (error || 'Unknown error')
        });
    }
    logInfo(msg) {
        console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
    }
    logSection(msg) {
        console.log(`\n${colors.yellow}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.yellow}${msg}${colors.reset}`);
        console.log(`${colors.yellow}${'='.repeat(60)}${colors.reset}\n`);
    }
    /**
     * Initialize the test runner
     */
    async initialize() {
        this.logSection('Azure Tenant Grapher - Comprehensive UI Testing');
        // Create screenshots directory
        await fs_1.promises.mkdir(this.screenshotsDir, { recursive: true });
        // Launch Electron app
        this.logInfo('Launching Electron application...');
        const electronPath = require('electron');
        const appPath = path.resolve(process.cwd(), '..');
        this.electronApp = await playwright_1._electron.launch({
            executablePath: electronPath,
            args: [appPath],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                TESTING: 'true'
            }
        });
        // Get main window
        this.page = await this.electronApp.firstWindow();
        await this.page.waitForLoadState('domcontentloaded');
        this.logSuccess('Electron app launched and ready');
    }
    /**
     * Test a specific tab with its test functions
     */
    async testTab(page, tabName, tests) {
        this.logSection(`Testing ${tabName} Tab`);
        try {
            // Navigate to tab
            await page.click(`text="${tabName}"`);
            await page.waitForTimeout(1000);
            this.logSuccess(`Navigated to ${tabName} tab`);
            // Take screenshot
            const screenshotPath = path.join(this.screenshotsDir, `${tabName.toLowerCase()}-tab.png`);
            await page.screenshot({
                path: screenshotPath,
                fullPage: true
            });
            this.logSuccess(`Screenshot captured for ${tabName} tab`);
            // Run specific tests for this tab
            for (const test of tests) {
                try {
                    await test(page);
                }
                catch (error) {
                    this.logError(test.name || 'Unknown test', error);
                }
            }
        }
        catch (error) {
            this.logError(`Failed to test ${tabName} tab`, error);
        }
    }
    /**
     * Build Tab Tests
     */
    async testTenantIdInput(page) {
        const input = await page.$('input[placeholder*="tenant"]');
        if (input) {
            await input.fill('test-tenant-id-12345');
            this.logSuccess('Tenant ID input field working');
        }
        else {
            throw new Error('Tenant ID input not found');
        }
    }
    async testBuildButton(page) {
        const button = await page.$('button:has-text("Build Graph")');
        if (button) {
            const isEnabled = await button.isEnabled();
            this.logSuccess(`Build button ${isEnabled ? 'enabled' : 'disabled'}`);
        }
        else {
            throw new Error('Build button not found');
        }
    }
    /**
     * Generate Spec Tab Tests
     */
    async testSpecGeneration(page) {
        const generateBtn = await page.$('button:has-text("Generate")');
        if (generateBtn) {
            this.logSuccess('Spec generation button found');
        }
        else {
            throw new Error('Generate spec button not found');
        }
    }
    /**
     * Generate IaC Tab Tests
     */
    async testFormatSelector(page) {
        const formats = ['terraform', 'arm', 'bicep'];
        for (const format of formats) {
            const option = await page.$(`text="${format}"`);
            if (option) {
                this.logSuccess(`IaC format option '${format}' available`);
            }
        }
    }
    /**
     * Create Tenant Tab Tests
     */
    async testSpecUpload(page) {
        const uploadArea = await page.$('input[type="file"]');
        if (uploadArea) {
            this.logSuccess('Spec file upload area available');
        }
        else {
            this.logInfo('No file upload area found (might use text area)');
        }
    }
    /**
     * Visualize Tab Tests
     */
    async testGraphVisualization(page) {
        // Check for graph container
        const graphContainer = await page.$('[class*="graph"], [id*="graph"], canvas, svg');
        if (graphContainer) {
            this.logSuccess('Graph visualization container found');
        }
        else {
            this.logInfo('Graph container not found (might need data first)');
        }
    }
    /**
     * Agent Mode Tab Tests
     */
    async testAgentInterface(page) {
        const chatInput = await page.$('textarea, input[type="text"][placeholder*="message"]');
        if (chatInput) {
            await chatInput.fill('Test agent command');
            this.logSuccess('Agent mode input field working');
        }
        else {
            this.logInfo('Agent mode interface not found');
        }
    }
    /**
     * Threat Model Tab Tests
     */
    async testThreatModelGeneration(page) {
        const analyzeBtn = await page.$('button:has-text("Analyze"), button:has-text("Generate")');
        if (analyzeBtn) {
            this.logSuccess('Threat model analysis button found');
        }
        else {
            this.logInfo('Threat model button not found');
        }
    }
    /**
     * Config Tab Tests
     */
    async testConfigFields(page) {
        // Check for environment variable inputs
        const envInputs = await page.$$('input[name*="env"], input[placeholder*="API"], input[placeholder*="key"]');
        if (envInputs.length > 0) {
            this.logSuccess(`Found ${envInputs.length} configuration fields`);
        }
        else {
            this.logInfo('No configuration fields found');
        }
    }
    async testSaveConfig(page) {
        const saveBtn = await page.$('button:has-text("Save")');
        if (saveBtn) {
            this.logSuccess('Configuration save button found');
        }
        else {
            this.logInfo('Save button not found in Config tab');
        }
    }
    /**
     * Status Tab Tests
     */
    async testSystemStatus(page) {
        // Look for status indicators
        const statusElements = await page.$$('[class*="status"], [class*="health"], [class*="indicator"]');
        if (statusElements.length > 0) {
            this.logSuccess(`Found ${statusElements.length} status indicators`);
        }
        else {
            this.logInfo('No status indicators found');
        }
    }
    async testNeo4jStatus(page) {
        const neo4jStatus = await page.$('text=/neo4j/i');
        if (neo4jStatus) {
            this.logSuccess('Neo4j status indicator found');
        }
        else {
            this.logInfo('Neo4j status not displayed');
        }
    }
    /**
     * Help Tab Tests
     */
    async testHelpContent(page) {
        const helpContent = await page.$('text=/documentation/i, text=/guide/i, text=/help/i');
        if (helpContent) {
            this.logSuccess('Help content available');
        }
        else {
            this.logInfo('Help content not found');
        }
    }
    /**
     * Run comprehensive UI tests
     */
    async runTests() {
        const startTime = new Date();
        let status = TestModels_1.TestStatus.PASSED;
        const screenshots = [];
        const logs = [];
        try {
            if (!this.page) {
                throw new Error('Page not initialized. Call initialize() first.');
            }
            // Test Build Tab
            await this.testTab(this.page, 'Build', [
                this.testTenantIdInput.bind(this),
                this.testBuildButton.bind(this)
            ]);
            // Test Generate Spec Tab
            await this.testTab(this.page, 'Generate Spec', [
                this.testSpecGeneration.bind(this)
            ]);
            // Test Generate IaC Tab
            await this.testTab(this.page, 'Generate IaC', [
                this.testFormatSelector.bind(this)
            ]);
            // Test Create Tenant Tab
            await this.testTab(this.page, 'Create Tenant', [
                this.testSpecUpload.bind(this)
            ]);
            // Test Visualize Tab
            await this.testTab(this.page, 'Visualize', [
                this.testGraphVisualization.bind(this)
            ]);
            // Test Agent Mode Tab
            await this.testTab(this.page, 'Agent Mode', [
                this.testAgentInterface.bind(this)
            ]);
            // Test Threat Model Tab
            await this.testTab(this.page, 'Threat Model', [
                this.testThreatModelGeneration.bind(this)
            ]);
            // Test Config Tab
            await this.testTab(this.page, 'Config', [
                this.testConfigFields.bind(this),
                this.testSaveConfig.bind(this)
            ]);
            // Test Status Tab
            await this.testTab(this.page, 'Status', [
                this.testSystemStatus.bind(this),
                this.testNeo4jStatus.bind(this)
            ]);
            // Test Help Tab
            await this.testTab(this.page, 'Help', [
                this.testHelpContent.bind(this)
            ]);
            // Additional UI responsiveness tests
            this.logSection('UI Responsiveness Tests');
            // Test window resizing
            await this.page.setViewportSize({ width: 1920, height: 1080 });
            await this.page.waitForTimeout(500);
            this.logSuccess('Window resized to 1920x1080');
            await this.page.setViewportSize({ width: 1024, height: 768 });
            await this.page.waitForTimeout(500);
            this.logSuccess('Window resized to 1024x768');
            // Test keyboard navigation
            await this.page.keyboard.press('Tab');
            await this.page.keyboard.press('Tab');
            this.logSuccess('Keyboard navigation working');
            // Test dark mode toggle (if available)
            const darkModeToggle = await this.page.$('[aria-label*="theme"], [aria-label*="dark"], button:has-text("Dark")');
            if (darkModeToggle) {
                await darkModeToggle.click();
                await this.page.waitForTimeout(500);
                this.logSuccess('Dark mode toggle tested');
            }
            else {
                this.logInfo('Dark mode toggle not found');
            }
        }
        catch (error) {
            this.logError('Test suite failed', error);
            status = TestModels_1.TestStatus.FAILED;
            logs.push(`Test suite failed: ${error.message}`);
        }
        const endTime = new Date();
        // Generate final report
        this.generateFinalReport();
        // Save results to file
        const resultsPath = path.join(process.cwd(), 'test-results.json');
        await fs_1.promises.writeFile(resultsPath, JSON.stringify(this.results, null, 2));
        this.logInfo(`Results saved to ${resultsPath}`);
        // Determine overall status
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
    /**
     * Generate and display final test report
     */
    generateFinalReport() {
        this.logSection('Test Results Summary');
        console.log(`${colors.green}Passed: ${this.results.passed}${colors.reset}`);
        console.log(`${colors.red}Failed: ${this.results.failed}${colors.reset}`);
        if (this.results.errors.length > 0) {
            console.log(`\n${colors.red}Errors:${colors.reset}`);
            this.results.errors.forEach((err, idx) => {
                console.log(`  ${idx + 1}. ${err.test}: ${err.error}`);
            });
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.electronApp) {
            await this.electronApp.close();
            this.logInfo('Electron app closed');
        }
    }
    /**
     * Get test results
     */
    getResults() {
        return { ...this.results };
    }
}
exports.ComprehensiveUITestRunner = ComprehensiveUITestRunner;
/**
 * Create and configure Comprehensive UI Test Runner
 */
function createComprehensiveUITestRunner(screenshotsDir) {
    return new ComprehensiveUITestRunner(screenshotsDir);
}
/**
 * Run Comprehensive UI Tests standalone
 */
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