#!/usr/bin/env node
/**
 * Smart UI Testing Runner
 * Uses Playwright's accessibility tree and element detection to test like a user.
 *
 * Thin facade: delegates element discovery to SmartElementFinder and tab
 * interaction to SmartInteractionExecutor.
 */
import { TestResult } from '../models/TestModels';
/**
 * Smart UI Test Runner
 *
 * Launches an Electron app, discovers tabs via SmartElementFinder, and
 * exercises each tab via SmartInteractionExecutor.
 */
export declare class SmartUITestRunner {
    private electronApp;
    private page;
    private testContext;
    private screenshotsDir;
    private finder;
    private executor;
    constructor(screenshotsDir?: string);
    private log;
    /** Initialize the test runner: create screenshot dir and launch Electron. */
    initialize(): Promise<void>;
    /** Run all discovered tab tests and keyboard-navigation checks. */
    runTests(): Promise<TestResult>;
    private generateReport;
    /** Close the Electron application and release resources. */
    cleanup(): Promise<void>;
}
/** Create and configure a Smart UI Test Runner. */
export declare function createSmartUITestRunner(screenshotsDir?: string): SmartUITestRunner;
/** Run Smart UI Tests as a standalone invocation. */
export declare function runSmartUITests(screenshotsDir?: string): Promise<TestResult>;
//# sourceMappingURL=SmartUITestRunner.d.ts.map