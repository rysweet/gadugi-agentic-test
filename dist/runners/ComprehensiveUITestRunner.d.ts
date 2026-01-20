/**
 * Comprehensive UI Test Runner
 * Exercises all tabs and features systematically
 */
import { TestResult } from '../models/TestModels';
interface TestResults {
    passed: number;
    failed: number;
    errors: Array<{
        test: string;
        error: string;
    }>;
}
/**
 * Comprehensive UI Test Runner class
 */
export declare class ComprehensiveUITestRunner {
    private electronApp;
    private page;
    private results;
    private screenshotsDir;
    constructor(screenshotsDir?: string);
    private logSuccess;
    private logError;
    private logInfo;
    private logSection;
    /**
     * Initialize the test runner
     */
    initialize(): Promise<void>;
    /**
     * Test a specific tab with its test functions
     */
    private testTab;
    /**
     * Build Tab Tests
     */
    private testTenantIdInput;
    private testBuildButton;
    /**
     * Generate Spec Tab Tests
     */
    private testSpecGeneration;
    /**
     * Generate IaC Tab Tests
     */
    private testFormatSelector;
    /**
     * Create Tenant Tab Tests
     */
    private testSpecUpload;
    /**
     * Visualize Tab Tests
     */
    private testGraphVisualization;
    /**
     * Agent Mode Tab Tests
     */
    private testAgentInterface;
    /**
     * Threat Model Tab Tests
     */
    private testThreatModelGeneration;
    /**
     * Config Tab Tests
     */
    private testConfigFields;
    private testSaveConfig;
    /**
     * Status Tab Tests
     */
    private testSystemStatus;
    private testNeo4jStatus;
    /**
     * Help Tab Tests
     */
    private testHelpContent;
    /**
     * Run comprehensive UI tests
     */
    runTests(): Promise<TestResult>;
    /**
     * Generate and display final test report
     */
    private generateFinalReport;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Get test results
     */
    getResults(): TestResults;
}
/**
 * Create and configure Comprehensive UI Test Runner
 */
export declare function createComprehensiveUITestRunner(screenshotsDir?: string): ComprehensiveUITestRunner;
/**
 * Run Comprehensive UI Tests standalone
 */
export declare function runComprehensiveUITests(screenshotsDir?: string): Promise<TestResult>;
export {};
//# sourceMappingURL=ComprehensiveUITestRunner.d.ts.map