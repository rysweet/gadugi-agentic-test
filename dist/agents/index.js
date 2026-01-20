"use strict";
/**
 * Agents module - Autonomous testing agents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSystemAgentConfig = exports.createSystemAgent = exports.SystemAgent = exports.createWebSocketAgent = exports.WebSocketAgent = exports.createAPIAgent = exports.APIAgent = exports.defaultComprehensionAgentConfig = exports.createComprehensionAgent = exports.ComprehensionAgent = exports.defaultPriorityAgentConfig = exports.createPriorityAgent = exports.PriorityAgent = exports.defaultIssueReporterConfig = exports.createIssueReporter = exports.IssueReporter = exports.createTUIAgent = exports.TUIAgent = exports.createCLIAgent = exports.CLIAgent = exports.createElectronUIAgent = exports.ElectronUIAgent = exports.AgentType = void 0;
// Agent types
var AgentType;
(function (AgentType) {
    AgentType["UI"] = "ui";
    AgentType["CLI"] = "cli";
    AgentType["TUI"] = "tui";
    AgentType["API"] = "api";
    AgentType["WEBSOCKET"] = "websocket";
    AgentType["GITHUB"] = "github";
    AgentType["SYSTEM"] = "system";
    AgentType["COMPREHENSION"] = "comprehension";
})(AgentType || (exports.AgentType = AgentType = {}));
// Re-export all agent implementations
var ElectronUIAgent_1 = require("./ElectronUIAgent");
Object.defineProperty(exports, "ElectronUIAgent", { enumerable: true, get: function () { return ElectronUIAgent_1.ElectronUIAgent; } });
Object.defineProperty(exports, "createElectronUIAgent", { enumerable: true, get: function () { return ElectronUIAgent_1.createElectronUIAgent; } });
var CLIAgent_1 = require("./CLIAgent");
Object.defineProperty(exports, "CLIAgent", { enumerable: true, get: function () { return CLIAgent_1.CLIAgent; } });
Object.defineProperty(exports, "createCLIAgent", { enumerable: true, get: function () { return CLIAgent_1.createCLIAgent; } });
var TUIAgent_1 = require("./TUIAgent");
Object.defineProperty(exports, "TUIAgent", { enumerable: true, get: function () { return TUIAgent_1.TUIAgent; } });
Object.defineProperty(exports, "createTUIAgent", { enumerable: true, get: function () { return TUIAgent_1.createTUIAgent; } });
var IssueReporter_1 = require("./IssueReporter");
Object.defineProperty(exports, "IssueReporter", { enumerable: true, get: function () { return IssueReporter_1.IssueReporter; } });
Object.defineProperty(exports, "createIssueReporter", { enumerable: true, get: function () { return IssueReporter_1.createIssueReporter; } });
Object.defineProperty(exports, "defaultIssueReporterConfig", { enumerable: true, get: function () { return IssueReporter_1.defaultIssueReporterConfig; } });
var PriorityAgent_1 = require("./PriorityAgent");
Object.defineProperty(exports, "PriorityAgent", { enumerable: true, get: function () { return PriorityAgent_1.PriorityAgent; } });
Object.defineProperty(exports, "createPriorityAgent", { enumerable: true, get: function () { return PriorityAgent_1.createPriorityAgent; } });
Object.defineProperty(exports, "defaultPriorityAgentConfig", { enumerable: true, get: function () { return PriorityAgent_1.defaultPriorityAgentConfig; } });
var ComprehensionAgent_1 = require("./ComprehensionAgent");
Object.defineProperty(exports, "ComprehensionAgent", { enumerable: true, get: function () { return ComprehensionAgent_1.ComprehensionAgent; } });
Object.defineProperty(exports, "createComprehensionAgent", { enumerable: true, get: function () { return ComprehensionAgent_1.createComprehensionAgent; } });
Object.defineProperty(exports, "defaultComprehensionAgentConfig", { enumerable: true, get: function () { return ComprehensionAgent_1.defaultComprehensionAgentConfig; } });
var APIAgent_1 = require("./APIAgent");
Object.defineProperty(exports, "APIAgent", { enumerable: true, get: function () { return APIAgent_1.APIAgent; } });
Object.defineProperty(exports, "createAPIAgent", { enumerable: true, get: function () { return APIAgent_1.createAPIAgent; } });
var WebSocketAgent_1 = require("./WebSocketAgent");
Object.defineProperty(exports, "WebSocketAgent", { enumerable: true, get: function () { return WebSocketAgent_1.WebSocketAgent; } });
Object.defineProperty(exports, "createWebSocketAgent", { enumerable: true, get: function () { return WebSocketAgent_1.createWebSocketAgent; } });
var SystemAgent_1 = require("./SystemAgent");
Object.defineProperty(exports, "SystemAgent", { enumerable: true, get: function () { return SystemAgent_1.SystemAgent; } });
Object.defineProperty(exports, "createSystemAgent", { enumerable: true, get: function () { return SystemAgent_1.createSystemAgent; } });
Object.defineProperty(exports, "defaultSystemAgentConfig", { enumerable: true, get: function () { return SystemAgent_1.defaultSystemAgentConfig; } });
//# sourceMappingURL=index.js.map