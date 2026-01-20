"use strict";
/**
 * ElectronUIAgent - Comprehensive Electron UI testing agent using Playwright
 *
 * This agent provides complete automation capabilities for Electron applications
 * including Playwright's Electron support, WebSocket monitoring, performance tracking,
 * and comprehensive error handling with automatic recovery.
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
exports.ElectronUIAgent = void 0;
exports.createElectronUIAgent = createElectronUIAgent;
const playwright_1 = require("playwright");
const events_1 = require("events");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const socket_io_client_1 = require("socket.io-client");
const index_1 = require("./index");
const TestModels_1 = require("../models/TestModels");
const screenshot_1 = require("../utils/screenshot");
const logger_1 = require("../utils/logger");
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    launchTimeout: 30000,
    defaultTimeout: 10000,
    headless: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    screenshotConfig: {
        mode: 'only-on-failure',
        directory: './screenshots/electron',
        fullPage: true
    },
    performanceConfig: {
        enabled: true,
        sampleInterval: 1000,
        collectLogs: true
    },
    recoveryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        restartOnFailure: false
    }
};
/**
 * Comprehensive Electron UI testing agent
 */
class ElectronUIAgent extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.name = 'ElectronUIAgent';
        this.type = index_1.AgentType.UI;
        this.app = null;
        this.page = null;
        this.context = null;
        this.websocket = null;
        this.websocketEvents = [];
        this.performanceSamples = [];
        this.performanceInterval = null;
        this.isInitialized = false;
        this.stateSnapshots = [];
        this.consoleMessages = [];
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = (0, logger_1.createLogger)({
            level: logger_1.LogLevel.DEBUG,
            logDir: './logs/electron-agent'
        });
        this.screenshotManager = (0, screenshot_1.createScreenshotManager)({
            baseDir: this.config.screenshotConfig.directory,
            strategy: 'by-scenario'
        });
        this.setupEventListeners();
    }
    /**
     * Initialize the agent
     */
    async initialize() {
        this.logger.info('Initializing ElectronUIAgent', { config: this.sanitizeConfig() });
        try {
            // Validate executable path
            await this.validateExecutablePath();
            this.isInitialized = true;
            this.logger.info('ElectronUIAgent initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize ElectronUIAgent', { error: error?.message });
            throw new TestError({
                type: 'InitializationError',
                message: `Failed to initialize ElectronUIAgent: ${error?.message}`,
                stackTrace: error?.stack,
                timestamp: new Date(),
                context: { config: this.sanitizeConfig() }
            });
        }
    }
    /**
     * Execute a test scenario
     */
    async execute(scenario) {
        if (!this.isInitialized) {
            throw new Error('Agent not initialized. Call initialize() first.');
        }
        this.currentScenarioId = scenario.id;
        this.logger.setContext({ scenarioId: scenario.id, component: 'ElectronUIAgent' });
        this.logger.scenarioStart(scenario.id, scenario.name);
        const startTime = Date.now();
        let status = TestModels_1.TestStatus.PASSED;
        let error;
        try {
            // Execute scenario steps
            const stepResults = [];
            for (let i = 0; i < scenario.steps.length; i++) {
                const step = scenario.steps[i];
                const stepResult = await this.executeStep(step, i);
                stepResults.push(stepResult);
                if (stepResult.status === TestModels_1.TestStatus.FAILED || stepResult.status === TestModels_1.TestStatus.ERROR) {
                    status = stepResult.status;
                    error = stepResult.error;
                    break;
                }
            }
            return {
                scenarioId: scenario.id,
                status,
                duration: Date.now() - startTime,
                startTime: new Date(startTime),
                endTime: new Date(),
                error,
                stepResults,
                screenshots: await this.getScenarioScreenshots(),
                logs: this.getScenarioLogs(),
                performanceSamples: [...this.performanceSamples],
                websocketEvents: [...this.websocketEvents],
                stateSnapshots: [...this.stateSnapshots]
            };
        }
        catch (executeError) {
            this.logger.error('Scenario execution failed', { error: executeError?.message });
            status = TestModels_1.TestStatus.ERROR;
            error = executeError?.message;
            // Capture failure screenshot
            await this.captureFailureScreenshot();
            throw executeError;
        }
        finally {
            this.logger.scenarioEnd(scenario.id, status, Date.now() - startTime);
            this.currentScenarioId = undefined;
        }
    }
    /**
     * Launch the Electron application
     */
    async launch() {
        this.logger.info('Launching Electron application', {
            executablePath: this.config.executablePath,
            args: this.config.args
        });
        try {
            // Launch Electron app
            this.app = await playwright_1._electron.launch({
                executablePath: this.config.executablePath,
                args: this.config.args,
                cwd: this.config.cwd,
                env: {
                    ...process.env,
                    ...this.config.env
                },
                timeout: this.config.launchTimeout,
                recordVideo: this.config.recordVideo ? {
                    dir: this.config.videoDir || './videos'
                } : undefined
            });
            // Get the main window
            this.page = await this.app.firstWindow({
                timeout: this.config.launchTimeout
            });
            if (!this.page) {
                throw new Error('No main window found');
            }
            this.context = this.page.context();
            // Configure page timeouts
            this.page.setDefaultTimeout(this.config.defaultTimeout);
            // Setup page event listeners
            this.setupPageEventListeners();
            // Connect to WebSocket if configured
            if (this.config.websocketConfig) {
                await this.connectWebSocket();
            }
            // Start performance monitoring
            if (this.config.performanceConfig?.enabled) {
                this.startPerformanceMonitoring();
            }
            this.logger.info('Electron application launched successfully');
            this.emit('launched');
        }
        catch (error) {
            this.logger.error('Failed to launch Electron application', { error: error?.message });
            await this.cleanup();
            throw error;
        }
    }
    /**
     * Close the Electron application
     */
    async close() {
        this.logger.info('Closing Electron application');
        try {
            // Stop performance monitoring
            this.stopPerformanceMonitoring();
            // Disconnect Socket.IO
            if (this.websocket) {
                this.websocket.disconnect();
                this.websocket = null;
            }
            // Close the application
            if (this.app) {
                await this.app.close();
                this.app = null;
            }
            this.page = null;
            this.context = null;
            this.logger.info('Electron application closed successfully');
            this.emit('closed');
        }
        catch (error) {
            this.logger.error('Error closing Electron application', { error: error?.message });
            throw error;
        }
    }
    /**
     * Navigate to a specific tab
     */
    async clickTab(tabName) {
        if (!this.page) {
            throw new Error('Application not launched');
        }
        this.logger.debug(`Clicking tab: ${tabName}`);
        try {
            // Try multiple selector strategies for tabs
            const selectors = [
                `[data-testid="tab-${tabName.toLowerCase()}"]`,
                `[data-testid="tab-${tabName}"]`,
                `button:has-text("${tabName}")`,
                `.tab:has-text("${tabName}")`,
                `[role="tab"]:has-text("${tabName}")`
            ];
            let clicked = false;
            for (const selector of selectors) {
                try {
                    await this.page.click(selector, { timeout: 2000 });
                    clicked = true;
                    break;
                }
                catch (e) {
                    // Try next selector
                }
            }
            if (!clicked) {
                throw new Error(`Tab "${tabName}" not found with any selector strategy`);
            }
            // Wait for tab to be active
            await this.page.waitForTimeout(500);
            // Capture state after navigation
            await this.captureCurrentState(`tab_${tabName.toLowerCase()}`);
            this.logger.debug(`Successfully clicked tab: ${tabName}`);
        }
        catch (error) {
            await this.captureFailureScreenshot(`tab_click_failure_${tabName}`);
            throw new Error(`Failed to click tab "${tabName}": ${error?.message}`);
        }
    }
    /**
     * Fill an input field
     */
    async fillInput(selector, value) {
        if (!this.page) {
            throw new Error('Application not launched');
        }
        this.logger.debug(`Filling input: ${selector} with value: ${value}`);
        try {
            const element = this.page.locator(selector);
            // Wait for element to be available
            await element.waitFor({ state: 'attached', timeout: this.config.defaultTimeout });
            await element.waitFor({ state: 'visible', timeout: this.config.defaultTimeout });
            // Clear existing content and fill
            await element.clear();
            await element.fill(value);
            // Verify the value was set correctly
            const actualValue = await element.inputValue();
            if (actualValue !== value) {
                this.logger.warn(`Input value mismatch. Expected: "${value}", Actual: "${actualValue}"`);
            }
            this.logger.debug(`Successfully filled input: ${selector}`);
        }
        catch (error) {
            await this.captureFailureScreenshot(`fill_input_failure`);
            throw new Error(`Failed to fill input "${selector}": ${error?.message}`);
        }
    }
    /**
     * Click a button or element
     */
    async clickButton(selector) {
        if (!this.page) {
            throw new Error('Application not launched');
        }
        this.logger.debug(`Clicking button: ${selector}`);
        try {
            const element = this.page.locator(selector);
            // Wait for element to be clickable
            await element.waitFor({ state: 'attached', timeout: this.config.defaultTimeout });
            await element.waitFor({ state: 'visible', timeout: this.config.defaultTimeout });
            // Scroll element into view if needed
            await element.scrollIntoViewIfNeeded();
            // Click the element
            await element.click();
            this.logger.debug(`Successfully clicked button: ${selector}`);
        }
        catch (error) {
            await this.captureFailureScreenshot(`click_button_failure`);
            throw new Error(`Failed to click button "${selector}": ${error?.message}`);
        }
    }
    /**
     * Wait for an element to appear
     */
    async waitForElement(selector, options = {}) {
        if (!this.page) {
            throw new Error('Application not launched');
        }
        const { state = 'visible', timeout = this.config.defaultTimeout } = options;
        this.logger.debug(`Waiting for element: ${selector} (state: ${state})`);
        try {
            const element = this.page.locator(selector);
            await element.waitFor({ state, timeout });
            this.logger.debug(`Element found: ${selector}`);
            return element;
        }
        catch (error) {
            await this.captureFailureScreenshot(`wait_for_element_failure`);
            throw new Error(`Element "${selector}" not found: ${error?.message}`);
        }
    }
    /**
     * Get text content of an element
     */
    async getElementText(selector) {
        if (!this.page) {
            throw new Error('Application not launched');
        }
        this.logger.debug(`Getting text from element: ${selector}`);
        try {
            const element = this.page.locator(selector);
            await element.waitFor({ state: 'visible', timeout: this.config.defaultTimeout });
            const text = await element.textContent() || '';
            this.logger.debug(`Element text: ${text}`);
            return text;
        }
        catch (error) {
            await this.captureFailureScreenshot(`get_element_text_failure`);
            throw new Error(`Failed to get text from element "${selector}": ${error?.message}`);
        }
    }
    /**
     * Take a screenshot
     */
    async screenshot(name) {
        if (!this.page) {
            throw new Error('Application not launched');
        }
        this.logger.debug(`Taking screenshot: ${name}`);
        try {
            const metadata = await this.screenshotManager.capturePageScreenshot(this.page, {
                scenarioId: this.currentScenarioId,
                description: name,
                fullPage: this.config.screenshotConfig?.fullPage
            });
            this.logger.screenshot(metadata.fileName);
            return metadata;
        }
        catch (error) {
            this.logger.error(`Failed to take screenshot "${name}"`, { error: error?.message });
            throw error;
        }
    }
    /**
     * Execute a single test step
     */
    async executeStep(step, stepIndex) {
        const startTime = Date.now();
        this.logger.stepExecution(stepIndex, step.action, step.target);
        try {
            let result;
            switch (step.action.toLowerCase()) {
                case 'launch':
                case 'launch_electron':
                    await this.launch();
                    break;
                case 'close':
                case 'close_app':
                    await this.close();
                    break;
                case 'click_tab':
                    await this.clickTab(step.target);
                    break;
                case 'click':
                case 'click_button':
                    await this.clickButton(step.target);
                    break;
                case 'fill':
                case 'type':
                    if (!step.value) {
                        throw new Error('Fill action requires a value');
                    }
                    await this.fillInput(step.target, step.value);
                    break;
                case 'wait_for_element':
                case 'wait_for':
                    const timeout = step.timeout || this.config.defaultTimeout;
                    await this.waitForElement(step.target, { timeout });
                    break;
                case 'get_text':
                    result = await this.getElementText(step.target);
                    break;
                case 'screenshot':
                    result = await this.screenshot(step.target);
                    break;
                case 'wait':
                    const waitTime = parseInt(step.value || '1000');
                    await this.page?.waitForTimeout(waitTime);
                    break;
                case 'navigate':
                    if (this.page) {
                        await this.page.goto(step.target);
                    }
                    break;
                default:
                    throw new Error(`Unsupported action: ${step.action}`);
            }
            const duration = Date.now() - startTime;
            this.logger.stepComplete(stepIndex, TestModels_1.TestStatus.PASSED, duration);
            return {
                stepIndex,
                status: TestModels_1.TestStatus.PASSED,
                duration,
                actualResult: typeof result === 'string' ? result : undefined
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.stepComplete(stepIndex, TestModels_1.TestStatus.FAILED, duration);
            // Capture failure screenshot
            await this.captureFailureScreenshot(`step_${stepIndex}_failure`);
            return {
                stepIndex,
                status: TestModels_1.TestStatus.FAILED,
                duration,
                error: error?.message,
                screenshot: await this.getLastScreenshotPath()
            };
        }
    }
    /**
     * Capture the current application state
     */
    async captureState() {
        if (!this.page) {
            throw new Error('Application not launched');
        }
        const timestamp = new Date();
        try {
            // Capture screenshot for state
            const screenshot = await this.screenshotManager.capturePageScreenshot(this.page, {
                scenarioId: this.currentScenarioId,
                description: 'State capture'
            });
            // Get page information
            const url = this.page.url();
            const title = await this.page.title();
            // Get process information if available
            const processInfo = await this.getProcessInfo();
            // Get performance metrics
            const performance = this.getLatestPerformanceMetrics();
            // Get network state
            const networkState = this.getNetworkState();
            const state = {
                timestamp,
                interface: 'GUI',
                screenshotPath: screenshot.filePath,
                url,
                title,
                processInfo,
                performance,
                networkState,
                customData: {
                    consoleMessageCount: this.consoleMessages.length,
                    websocketEventCount: this.websocketEvents.length,
                    performanceSampleCount: this.performanceSamples.length
                }
            };
            // Store state snapshot
            const snapshot = {
                id: `${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp,
                state,
                scenarioId: this.currentScenarioId
            };
            this.stateSnapshots.push(snapshot);
            return state;
        }
        catch (error) {
            this.logger.error('Failed to capture application state', { error: error?.message });
            throw error;
        }
    }
    /**
     * Clean up resources
     */
    async cleanup() {
        this.logger.info('Cleaning up ElectronUIAgent resources');
        try {
            // Stop performance monitoring
            this.stopPerformanceMonitoring();
            // Close Socket.IO connection
            if (this.websocket) {
                this.websocket.disconnect();
                this.websocket = null;
            }
            // Close Electron application
            if (this.app) {
                try {
                    await this.app.close();
                }
                catch (error) {
                    this.logger.warn('Error closing Electron app during cleanup', { error: error?.message });
                }
                this.app = null;
            }
            // Clear references
            this.page = null;
            this.context = null;
            // Export final data
            await this.exportFinalData();
            this.logger.info('ElectronUIAgent cleanup completed');
            this.emit('cleanup');
        }
        catch (error) {
            this.logger.error('Error during cleanup', { error: error?.message });
        }
    }
    // Private helper methods
    setupEventListeners() {
        this.on('error', (error) => {
            this.logger.error('ElectronUIAgent error', { error: error.message });
        });
    }
    setupPageEventListeners() {
        if (!this.page)
            return;
        // Console message handling
        this.page.on('console', (msg) => {
            const logMessage = {
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date(),
                args: msg.args()
            };
            this.consoleMessages.push(msg);
            // Log based on console message type
            switch (msg.type()) {
                case 'error':
                    this.logger.error(`Console error: ${msg.text()}`);
                    break;
                case 'warning':
                    this.logger.warn(`Console warning: ${msg.text()}`);
                    break;
                default:
                    this.logger.debug(`Console ${msg.type()}: ${msg.text()}`);
            }
        });
        // Dialog handling
        this.page.on('dialog', async (dialog) => {
            this.logger.info(`Dialog appeared: ${dialog.type()} - ${dialog.message()}`);
            await dialog.accept(); // Auto-accept dialogs
        });
        // Page error handling
        this.page.on('pageerror', (error) => {
            this.logger.error('Page error', { error: error.message, stack: error.stack });
        });
        // Request monitoring (optional)
        this.page.on('request', (request) => {
            this.logger.debug(`Request: ${request.method()} ${request.url()}`);
        });
    }
    async connectWebSocket() {
        if (!this.config.websocketConfig)
            return;
        const config = this.config.websocketConfig;
        try {
            this.websocket = (0, socket_io_client_1.io)(config.url, {
                reconnection: true,
                reconnectionAttempts: config.reconnectAttempts,
                reconnectionDelay: config.reconnectDelay,
                timeout: 10000
            });
            this.websocket.on('connect', () => {
                this.logger.info('Socket.IO connected', { url: config.url });
                this.emit('websocket_connected');
            });
            // Listen for configured events
            config.events.forEach(eventType => {
                this.websocket.on(eventType, (data) => {
                    const event = {
                        type: eventType,
                        timestamp: new Date(),
                        data,
                        source: 'socket.io'
                    };
                    this.websocketEvents.push(event);
                    this.emit('websocket_event', event);
                });
            });
            // Generic message handler for any other events
            this.websocket.onAny((eventType, ...args) => {
                if (!config.events.includes(eventType)) {
                    const event = {
                        type: eventType,
                        timestamp: new Date(),
                        data: args.length === 1 ? args[0] : args,
                        source: 'socket.io'
                    };
                    this.websocketEvents.push(event);
                    this.emit('websocket_event', event);
                }
            });
            this.websocket.on('connect_error', (error) => {
                this.logger.error('Socket.IO connection error', { error: error.message });
            });
            this.websocket.on('disconnect', (reason) => {
                this.logger.info('Socket.IO disconnected', { reason });
                this.emit('websocket_disconnected');
            });
        }
        catch (error) {
            this.logger.error('Failed to connect Socket.IO', { error: error?.message });
        }
    }
    startPerformanceMonitoring() {
        if (!this.config.performanceConfig?.enabled || !this.page)
            return;
        const interval = this.config.performanceConfig.sampleInterval || 1000;
        this.performanceInterval = setInterval(async () => {
            try {
                const sample = await this.collectPerformanceSample();
                this.performanceSamples.push(sample);
                // Limit stored samples to prevent memory issues
                if (this.performanceSamples.length > 1000) {
                    this.performanceSamples.splice(0, 100);
                }
            }
            catch (error) {
                this.logger.debug('Failed to collect performance sample', { error: error?.message });
            }
        }, interval);
    }
    stopPerformanceMonitoring() {
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
            this.performanceInterval = null;
        }
    }
    async collectPerformanceSample() {
        const timestamp = new Date();
        const sample = { timestamp };
        if (this.page) {
            try {
                // Collect browser performance metrics
                const metrics = await this.page.evaluate(() => {
                    const nav = performance.navigation;
                    const timing = performance.timing;
                    const memory = performance.memory;
                    return {
                        responseTime: timing.loadEventEnd - timing.navigationStart,
                        memoryUsage: memory ? memory.usedJSHeapSize : undefined,
                        // Add more metrics as needed
                    };
                });
                Object.assign(sample, metrics);
            }
            catch (error) {
                this.logger.debug('Failed to collect browser metrics', { error: error?.message });
            }
        }
        return sample;
    }
    async getProcessInfo() {
        if (!this.app)
            return undefined;
        try {
            // Get process information from Electron
            const pid = await this.app.evaluate(async ({ app }) => {
                return process.pid;
            });
            return {
                pid,
                name: 'electron',
                status: 'running',
                startTime: new Date()
            };
        }
        catch (error) {
            this.logger.debug('Failed to get process info', { error: error?.message });
            return undefined;
        }
    }
    getLatestPerformanceMetrics() {
        if (this.performanceSamples.length === 0)
            return undefined;
        const latest = this.performanceSamples[this.performanceSamples.length - 1];
        return {
            cpuUsage: latest.cpuUsage || 0,
            memoryUsage: latest.memoryUsage || 0,
            availableMemory: 0, // Would need system-level access
            responseTime: latest.responseTime,
            frameRate: latest.frameRate
        };
    }
    getNetworkState() {
        return {
            isOnline: true, // Simplified - could be enhanced with real network detection
            connectionType: 'ethernet',
            activeConnections: []
        };
    }
    async captureFailureScreenshot(name) {
        try {
            if (this.page && this.config.screenshotConfig?.mode !== 'off') {
                const screenshotName = name || `failure_${Date.now()}`;
                await this.screenshot(screenshotName);
            }
        }
        catch (error) {
            this.logger.warn('Failed to capture failure screenshot', { error: error?.message });
        }
    }
    async captureCurrentState(label) {
        try {
            await this.captureState();
        }
        catch (error) {
            this.logger.debug('Failed to capture current state', { error: error?.message });
        }
    }
    async getScenarioScreenshots() {
        if (!this.currentScenarioId)
            return [];
        const screenshots = this.screenshotManager.getScreenshotsByScenario(this.currentScenarioId);
        return screenshots.map(s => s.filePath);
    }
    getScenarioLogs() {
        return this.consoleMessages
            .filter(msg => msg.type() === 'error' || msg.type() === 'warning')
            .map(msg => `[${msg.type()}] ${msg.text()}`);
    }
    async getLastScreenshotPath() {
        if (!this.currentScenarioId)
            return undefined;
        const screenshots = this.screenshotManager.getScreenshotsByScenario(this.currentScenarioId);
        return screenshots.length > 0 ? screenshots[screenshots.length - 1].filePath : undefined;
    }
    async validateExecutablePath() {
        try {
            await fs.access(this.config.executablePath);
        }
        catch (error) {
            throw new Error(`Electron executable not found: ${this.config.executablePath}`);
        }
    }
    sanitizeConfig() {
        const { env, ...safeConfig } = this.config;
        return {
            ...safeConfig,
            env: env ? Object.keys(env) : undefined
        };
    }
    async exportFinalData() {
        try {
            const exportDir = './logs/electron-agent-exports';
            await fs.mkdir(exportDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            // Export performance data
            if (this.performanceSamples.length > 0) {
                await fs.writeFile(path.join(exportDir, `performance_${timestamp}.json`), JSON.stringify(this.performanceSamples, null, 2));
            }
            // Export WebSocket events
            if (this.websocketEvents.length > 0) {
                await fs.writeFile(path.join(exportDir, `websocket_events_${timestamp}.json`), JSON.stringify(this.websocketEvents, null, 2));
            }
            // Export state snapshots
            if (this.stateSnapshots.length > 0) {
                await fs.writeFile(path.join(exportDir, `state_snapshots_${timestamp}.json`), JSON.stringify(this.stateSnapshots, null, 2));
            }
            // Export screenshot metadata
            await this.screenshotManager.exportMetadata(path.join(exportDir, `screenshots_${timestamp}.json`));
        }
        catch (error) {
            this.logger.warn('Failed to export final data', { error: error?.message });
        }
    }
}
exports.ElectronUIAgent = ElectronUIAgent;
/**
 * Factory function to create ElectronUIAgent instance
 */
function createElectronUIAgent(config) {
    return new ElectronUIAgent(config);
}
/**
 * Helper class for TestError creation
 */
class TestError extends Error {
    constructor(options) {
        super(options.message);
        this.type = options.type;
        this.timestamp = options.timestamp;
        this.context = options.context;
        this.name = 'TestError';
        if (options.stackTrace) {
            this.stack = options.stackTrace;
        }
    }
}
//# sourceMappingURL=ElectronUIAgent.js.map