/**
 * Comprehensive UI Test Runner
 * Exercises all tabs and features systematically.
 *
 * Thin facade: delegates tab-interaction logic to UIFlowTester.
 */
import { TestResult } from '../models/TestModels';
import { TestResults } from './comprehensive/UIFlowTester';
/**
 * Comprehensive UI Test Runner
 *
 * Launches an Electron app and exercises every known tab using UIFlowTester.
 */
export declare class ComprehensiveUITestRunner {
    private electronApp;
    private page;
    private results;
    private screenshotsDir;
    private tester;
    constructor(screenshotsDir?: string);
    /** Initialize the runner: create screenshot dir and launch Electron. */
    initialize(): Promise<void>;
    /** Run all tab tests plus responsiveness checks. */
    runTests(): Promise<TestResult>;
    private generateFinalReport;
    /** Close the Electron application. */
    cleanup(): Promise<void>;
    /** Return a snapshot of current test results. */
    getResults(): TestResults;
}
/** Create and configure a Comprehensive UI Test Runner. */
export declare function createComprehensiveUITestRunner(screenshotsDir?: string): ComprehensiveUITestRunner;
/** Run Comprehensive UI Tests as a standalone invocation. */
export declare function runComprehensiveUITests(screenshotsDir?: string): Promise<TestResult>;
//# sourceMappingURL=ComprehensiveUITestRunner.d.ts.map