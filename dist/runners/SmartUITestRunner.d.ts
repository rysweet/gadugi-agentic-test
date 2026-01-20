/**
 * Smart UI Testing Runner
 * Uses Playwright's accessibility tree and element detection to test like a user
 */
import { TestResult } from '../models/TestModels';
/**
 * Smart UI Test Runner class
 */
export declare class SmartUITestRunner {
    private electronApp;
    private page;
    private testContext;
    private screenshotsDir;
    constructor(screenshotsDir?: string);
    private log;
    /**
     * Initialize the test runner
     */
    initialize(): Promise<void>;
    /**
     * Discover all interactive elements on the page
     */
    private discoverElements;
    /**
     * Test Scan/Build functionality
     */
    private testScanTab;
    /**
     * Test Generate IaC functionality
     */
    private testGenerateIaCTab;
    /**
     * Test Visualize functionality
     */
    private testVisualizeTab;
    /**
     * Test Status indicators
     */
    private testStatusTab;
    /**
     * Test Configuration
     */
    private testConfigTab;
    /**
     * Run smart UI tests
     */
    runTests(): Promise<TestResult>;
    /**
     * Generate and display test report
     */
    private generateReport;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
/**
 * Create and configure Smart UI Test Runner
 */
export declare function createSmartUITestRunner(screenshotsDir?: string): SmartUITestRunner;
/**
 * Run Smart UI Tests standalone
 */
export declare function runSmartUITests(screenshotsDir?: string): Promise<TestResult>;
//# sourceMappingURL=SmartUITestRunner.d.ts.map