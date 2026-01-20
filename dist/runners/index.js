"use strict";
/**
 * Test Runners Module
 *
 * This module exports all test runners for the Agentic Testing System.
 * These runners are TypeScript implementations that replace the original JavaScript test runners.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunners = exports.runComprehensiveUITests = exports.createComprehensiveUITestRunner = exports.ComprehensiveUITestRunner = exports.runSmartUITests = exports.createSmartUITestRunner = exports.SmartUITestRunner = void 0;
exports.createTestRunner = createTestRunner;
exports.runTestRunner = runTestRunner;
// Smart UI Test Runner - Uses Playwright's accessibility tree and element detection
var SmartUITestRunner_1 = require("./SmartUITestRunner");
Object.defineProperty(exports, "SmartUITestRunner", { enumerable: true, get: function () { return SmartUITestRunner_1.SmartUITestRunner; } });
Object.defineProperty(exports, "createSmartUITestRunner", { enumerable: true, get: function () { return SmartUITestRunner_1.createSmartUITestRunner; } });
Object.defineProperty(exports, "runSmartUITests", { enumerable: true, get: function () { return SmartUITestRunner_1.runSmartUITests; } });
// Comprehensive UI Test Runner - Systematically exercises all tabs and features
var ComprehensiveUITestRunner_1 = require("./ComprehensiveUITestRunner");
Object.defineProperty(exports, "ComprehensiveUITestRunner", { enumerable: true, get: function () { return ComprehensiveUITestRunner_1.ComprehensiveUITestRunner; } });
Object.defineProperty(exports, "createComprehensiveUITestRunner", { enumerable: true, get: function () { return ComprehensiveUITestRunner_1.createComprehensiveUITestRunner; } });
Object.defineProperty(exports, "runComprehensiveUITests", { enumerable: true, get: function () { return ComprehensiveUITestRunner_1.runComprehensiveUITests; } });
/**
 * Available test runners
 */
exports.TestRunners = {
    Smart: 'SmartUITestRunner',
    Comprehensive: 'ComprehensiveUITestRunner'
};
/**
 * Factory function to create any test runner by type
 */
function createTestRunner(type, config) {
    // Dynamic imports to avoid circular dependencies
    switch (type) {
        case exports.TestRunners.Smart: {
            const { createSmartUITestRunner } = require('./SmartUITestRunner');
            return createSmartUITestRunner(config?.screenshotsDir);
        }
        case exports.TestRunners.Comprehensive: {
            const { createComprehensiveUITestRunner } = require('./ComprehensiveUITestRunner');
            return createComprehensiveUITestRunner(config?.screenshotsDir);
        }
        default:
            throw new Error(`Unknown test runner type: ${type}`);
    }
}
/**
 * Run any test runner by type
 */
async function runTestRunner(type, config) {
    // Dynamic imports to avoid circular dependencies
    switch (type) {
        case exports.TestRunners.Smart: {
            const { runSmartUITests } = require('./SmartUITestRunner');
            return await runSmartUITests(config?.screenshotsDir);
        }
        case exports.TestRunners.Comprehensive: {
            const { runComprehensiveUITests } = require('./ComprehensiveUITestRunner');
            return await runComprehensiveUITests(config?.screenshotsDir);
        }
        default:
            throw new Error(`Unknown test runner type: ${type}`);
    }
}
//# sourceMappingURL=index.js.map