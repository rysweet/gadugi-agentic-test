"use strict";
/**
 * ScenarioLoader
 * Scenario discovery, loading, and suite-filtering logic extracted from lib.ts.
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
exports.TEST_SUITES = void 0;
exports.loadTestScenarios = loadTestScenarios;
exports.filterScenariosForSuite = filterScenariosForSuite;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fs_extra_1 = require("fs-extra");
const logger_1 = require("../utils/logger");
const yamlParser_1 = require("../utils/yamlParser");
/**
 * Built-in suite definitions.
 * 'smoke' and 'regression'/'full' differ only in pattern coverage.
 */
exports.TEST_SUITES = {
    smoke: {
        name: 'smoke',
        description: 'Quick smoke tests for critical functionality',
        patterns: ['smoke:', 'critical:', 'auth:'],
        tags: ['smoke', 'critical', 'auth']
    },
    regression: {
        name: 'regression',
        description: 'Full regression test suite',
        patterns: ['*'],
        tags: []
    },
    full: {
        name: 'full',
        description: 'Complete test suite including all scenarios',
        patterns: ['*'],
        tags: []
    }
};
/**
 * Discover and load OrchestratorScenario objects.
 *
 * If `scenarioFiles` is provided those files are loaded; otherwise every
 * `.yaml` / `.yml` in `<cwd>/scenarios/` is loaded.
 */
async function loadTestScenarios(scenarioFiles) {
    const scenarios = [];
    const scenarioDir = path.join(process.cwd(), 'scenarios');
    if (scenarioFiles && scenarioFiles.length > 0) {
        for (const file of scenarioFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const fileScenarios = await (0, yamlParser_1.parseScenariosFromString)(content);
                scenarios.push(...fileScenarios);
                logger_1.logger.debug(`Loaded ${fileScenarios.length} scenarios from ${file}`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to load scenarios from ${file}:`, error);
            }
        }
    }
    else {
        try {
            if (await (0, fs_extra_1.pathExists)(scenarioDir)) {
                const files = await fs.readdir(scenarioDir);
                const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
                for (const file of yamlFiles) {
                    const filePath = path.join(scenarioDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const fileScenarios = await (0, yamlParser_1.parseScenariosFromString)(content);
                    scenarios.push(...fileScenarios);
                    logger_1.logger.debug(`Loaded ${fileScenarios.length} scenarios from ${file}`);
                }
            }
            else {
                logger_1.logger.warn(`Scenario directory not found: ${scenarioDir}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to load scenarios from directory:', error);
        }
    }
    logger_1.logger.info(`Loaded ${scenarios.length} total test scenarios`);
    return scenarios;
}
/**
 * Filter scenarios according to the named suite's pattern rules.
 *
 * Patterns ending in `:` are prefix matches; patterns containing `*` are
 * treated as simple globs; all others require an exact id or tag match.
 */
function filterScenariosForSuite(scenarios, suite) {
    const suiteConfig = exports.TEST_SUITES[suite];
    if (!suiteConfig) {
        logger_1.logger.warn(`Unknown test suite: ${suite}, using all scenarios`);
        return scenarios;
    }
    const patterns = suiteConfig.patterns;
    if (patterns.includes('*'))
        return scenarios;
    const filtered = [];
    for (const scenario of scenarios) {
        for (const pattern of patterns) {
            if (pattern.endsWith(':')) {
                const prefix = pattern.slice(0, -1);
                if (scenario.id.startsWith(prefix) ||
                    scenario.tags?.some(tag => tag.startsWith(prefix))) {
                    filtered.push(scenario);
                    break;
                }
            }
            else if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace('*', '.*'));
                if (regex.test(scenario.id) ||
                    scenario.tags?.some(tag => regex.test(tag))) {
                    filtered.push(scenario);
                    break;
                }
            }
            else {
                if (scenario.id === pattern ||
                    scenario.tags?.includes(pattern)) {
                    filtered.push(scenario);
                    break;
                }
            }
        }
    }
    return filtered;
}
//# sourceMappingURL=ScenarioLoader.js.map