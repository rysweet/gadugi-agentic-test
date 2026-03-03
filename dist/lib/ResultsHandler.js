"use strict";
/**
 * ResultsHandler
 * Result persistence and display logic extracted from lib.ts.
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
exports.saveResults = saveResults;
exports.displayResults = displayResults;
exports.performDryRun = performDryRun;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const TestModels_1 = require("../models/TestModels");
const logger_1 = require("../utils/logger");
const ScenarioLoader_1 = require("./ScenarioLoader");
/**
 * Persist a TestSession to a JSON file at `outputPath`.
 * Creates intermediate directories as needed.
 */
async function saveResults(session, outputPath) {
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    const resultsData = {
        sessionId: session.id,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime?.toISOString() || null,
        summary: session.summary,
        results: session.results
    };
    await fs.writeFile(outputPath, JSON.stringify(resultsData, null, 2));
    logger_1.logger.info(`Results saved to: ${outputPath}`);
}
/**
 * Log a formatted summary of a TestSession via the structured logger.
 * Uses logger.info instead of console.log so that library consumers can
 * control log output (suppression, redirection, structured sinks).
 */
function displayResults(session) {
    const duration = session.endTime && session.startTime
        ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
        : 0;
    const passRate = session.summary.total > 0
        ? (session.summary.passed / session.summary.total) * 100
        : 0;
    logger_1.logger.info('TEST SESSION RESULTS', {
        sessionId: session.id,
        duration: `${duration.toFixed(2)} seconds`,
        total: session.summary.total,
        passed: session.summary.passed,
        failed: session.summary.failed,
        skipped: session.summary.skipped,
        passRate: `${passRate.toFixed(1)}%`,
    });
}
/**
 * Perform a dry run: log what would be executed without running anything.
 */
async function performDryRun(scenarios, suite) {
    const filteredScenarios = (0, ScenarioLoader_1.filterScenariosForSuite)(scenarios, suite);
    logger_1.logger.info('DRY RUN MODE - Not executing tests', {
        suite,
        scenarioCount: filteredScenarios.length,
    });
    for (const scenario of filteredScenarios) {
        const meta = {
            interface: scenario.interface || TestModels_1.TestInterface.CLI,
            id: scenario.id,
            name: scenario.name,
        };
        if (scenario.description) {
            meta.description = scenario.description;
        }
        if (scenario.tags && scenario.tags.length > 0) {
            meta.tags = scenario.tags;
        }
        logger_1.logger.info('  scenario', meta);
    }
}
//# sourceMappingURL=ResultsHandler.js.map