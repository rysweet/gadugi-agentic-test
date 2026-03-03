"use strict";
/**
 * Legacy entry point for the Agentic Testing System
 *
 * This module exists for backwards compatibility. All library
 * functionality has moved to ./lib.ts, and the CLI lives in
 * ./cli.ts. This file is a thin wrapper that delegates to the
 * CLI when executed directly.
 *
 * IMPORTANT: Importing this module no longer triggers argv
 * parsing or installs signal handlers.
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
exports.TestStatus = exports.setupGracefulShutdown = exports.createTestOrchestrator = exports.TestOrchestrator = exports.runTests = exports.performDryRun = exports.displayResults = exports.saveResults = exports.filterScenariosForSuite = exports.loadTestScenarios = exports.loadConfiguration = exports.createDefaultConfig = exports.TEST_SUITES = void 0;
exports.run = run;
// Re-export the programmatic library API so existing consumers
// that import from './main' continue to work.
var lib_1 = require("./lib");
Object.defineProperty(exports, "TEST_SUITES", { enumerable: true, get: function () { return lib_1.TEST_SUITES; } });
Object.defineProperty(exports, "createDefaultConfig", { enumerable: true, get: function () { return lib_1.createDefaultConfig; } });
Object.defineProperty(exports, "loadConfiguration", { enumerable: true, get: function () { return lib_1.loadConfiguration; } });
Object.defineProperty(exports, "loadTestScenarios", { enumerable: true, get: function () { return lib_1.loadTestScenarios; } });
Object.defineProperty(exports, "filterScenariosForSuite", { enumerable: true, get: function () { return lib_1.filterScenariosForSuite; } });
Object.defineProperty(exports, "saveResults", { enumerable: true, get: function () { return lib_1.saveResults; } });
Object.defineProperty(exports, "displayResults", { enumerable: true, get: function () { return lib_1.displayResults; } });
Object.defineProperty(exports, "performDryRun", { enumerable: true, get: function () { return lib_1.performDryRun; } });
Object.defineProperty(exports, "runTests", { enumerable: true, get: function () { return lib_1.runTests; } });
Object.defineProperty(exports, "TestOrchestrator", { enumerable: true, get: function () { return lib_1.TestOrchestrator; } });
Object.defineProperty(exports, "createTestOrchestrator", { enumerable: true, get: function () { return lib_1.createTestOrchestrator; } });
/**
 * @deprecated setupGracefulShutdown has moved to src/cli/setup.ts.
 * Import from './cli/setup' in CLI entry points only.
 * This re-export will be removed in the next major release.
 */
var setup_1 = require("./cli/setup");
Object.defineProperty(exports, "setupGracefulShutdown", { enumerable: true, get: function () { return setup_1.setupGracefulShutdown; } });
// Re-export TestStatus for backwards compatibility
var TestModels_1 = require("./models/TestModels");
Object.defineProperty(exports, "TestStatus", { enumerable: true, get: function () { return TestModels_1.TestStatus; } });
const logger_1 = require("./utils/logger");
/**
 * Run the CLI when this module is executed directly.
 *
 * Dynamically imports cli.ts to avoid pulling in Commander
 * and its dependencies at library-import time.
 */
function run() {
    Promise.resolve().then(() => __importStar(require('./cli'))).then((cli) => {
        // cli.ts exports `program` as default; parse argv
        cli.default.parse();
    }).catch((error) => {
        logger_1.logger.error('Failed to start CLI:', error);
        process.exit(1);
    });
}
// Execute if called directly
if (require.main === module) {
    run();
}
//# sourceMappingURL=main.js.map