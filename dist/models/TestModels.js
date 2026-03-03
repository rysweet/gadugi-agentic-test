"use strict";
/**
 * Core test models and interfaces for the Agentic Testing System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssertionType = exports.TestInterface = exports.Priority = exports.TestStatus = void 0;
/**
 * Test execution status enumeration
 */
var TestStatus;
(function (TestStatus) {
    TestStatus["PASSED"] = "PASSED";
    TestStatus["FAILED"] = "FAILED";
    TestStatus["SKIPPED"] = "SKIPPED";
    TestStatus["ERROR"] = "ERROR";
    TestStatus["RUNNING"] = "RUNNING";
    TestStatus["PENDING"] = "PENDING";
})(TestStatus || (exports.TestStatus = TestStatus = {}));
/**
 * Test priority levels
 */
var Priority;
(function (Priority) {
    Priority["CRITICAL"] = "CRITICAL";
    Priority["HIGH"] = "HIGH";
    Priority["MEDIUM"] = "MEDIUM";
    Priority["LOW"] = "LOW";
})(Priority || (exports.Priority = Priority = {}));
/**
 * Test interface types
 */
var TestInterface;
(function (TestInterface) {
    TestInterface["CLI"] = "CLI";
    TestInterface["GUI"] = "GUI";
    TestInterface["TUI"] = "TUI";
    TestInterface["MIXED"] = "MIXED";
    TestInterface["API"] = "API";
})(TestInterface || (exports.TestInterface = TestInterface = {}));
var AssertionType;
(function (AssertionType) {
    AssertionType["EXISTS"] = "EXISTS";
    AssertionType["EQUALS"] = "EQUALS";
    AssertionType["CONTAINS"] = "CONTAINS";
    AssertionType["MATCHES"] = "MATCHES";
    AssertionType["GREATER_THAN"] = "GREATER_THAN";
    AssertionType["LESS_THAN"] = "LESS_THAN";
})(AssertionType || (exports.AssertionType = AssertionType = {}));
/** @deprecated Use OrchestratorScenario directly - this alias is removed to resolve naming conflict with scenarios/ScenarioDefinition. Will be removed in v2.0. */
// export type TestScenario = OrchestratorScenario; // REMOVED: caused naming conflict with scenarios/index.ts TestScenario
//# sourceMappingURL=TestModels.js.map