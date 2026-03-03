"use strict";
/**
 * APIAgent - Thin facade over focused API sub-modules
 *
 * Delegates HTTP execution to APIRequestExecutor, authentication to
 * APIAuthHandler, and validation to APIResponseValidator. Preserves the full
 * public API of the original 937-LOC implementation.
 *
 * Extends BaseAgent (issue #117) to eliminate the duplicated execute() loop.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIAgent = void 0;
exports.createAPIAgent = createAPIAgent;
const index_1 = require("./index");
const TestModels_1 = require("../models/TestModels");
const logger_1 = require("../utils/logger");
const async_1 = require("../utils/async");
const BaseAgent_1 = require("./BaseAgent");
const types_1 = require("./api/types");
const APIRequestExecutor_1 = require("./api/APIRequestExecutor");
const APIAuthHandler_1 = require("./api/APIAuthHandler");
const APIResponseValidator_1 = require("./api/APIResponseValidator");
class APIAgent extends BaseAgent_1.BaseAgent {
    constructor(config = {}) {
        super();
        this.name = 'APIAgent';
        this.type = index_1.AgentType.API;
        this.config = { ...types_1.DEFAULT_API_CONFIG, ...config };
        const logger = (0, logger_1.createLogger)({ level: this.config.logConfig.logLevel, logDir: './logs/api-agent' });
        this.executor = new APIRequestExecutor_1.APIRequestExecutor(this.config, logger);
        this.authHandler = new APIAuthHandler_1.APIAuthHandler(this.executor.axiosInstance, logger);
        this.validator = new APIResponseValidator_1.APIResponseValidator(this.config.validation);
        this.on('error', (_e) => { });
    }
    async initialize() {
        try {
            if (this.config.baseURL)
                await this.executor.testConnectivity();
            this.executor.setupInterceptors(this.config.requestInterceptors, this.config.responseInterceptors);
            this.authHandler.applyAuth(this.config.auth);
            this.isInitialized = true;
            this.emit('initialized');
        }
        catch (error) {
            throw new Error(`Failed to initialize APIAgent: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // -- BaseAgent template-method hooks --
    applyEnvironment(scenario) {
        if (scenario.environment) {
            this.applyEnvironmentConfig(scenario.environment);
        }
    }
    buildResult(ctx) {
        return {
            ...ctx,
            logs: ['No scenario-specific logs available'],
            requestHistory: this.executor.getRequestHistory(),
            responseHistory: this.executor.getResponseHistory(),
            performanceMetrics: this.executor.getPerformanceMetrics(),
        };
    }
    // -- Public API-specific API --
    async makeRequest(method, url, data, headers, options) {
        return this.executor.makeRequest(method, url, data, headers, options);
    }
    async executeStep(step, stepIndex) {
        const startTime = Date.now();
        try {
            let result;
            const action = step.action.toLowerCase();
            const getPayload = () => this.validator.parseRequestData(step.value);
            const getHeaders = () => this.validator.parseHeaders(step.value);
            const timeoutOpts = step.timeout !== undefined ? { timeout: step.timeout } : {};
            if (action === 'get') {
                result = await this.executor.makeRequest('GET', step.target, undefined, getHeaders(), timeoutOpts);
            }
            else if (action === 'post') {
                const { data, headers } = getPayload();
                result = await this.executor.makeRequest('POST', step.target, data, headers, timeoutOpts);
            }
            else if (action === 'put') {
                const { data, headers } = getPayload();
                result = await this.executor.makeRequest('PUT', step.target, data, headers, timeoutOpts);
            }
            else if (action === 'delete') {
                result = await this.executor.makeRequest('DELETE', step.target, undefined, getHeaders(), timeoutOpts);
            }
            else if (action === 'patch') {
                const { data, headers } = getPayload();
                result = await this.executor.makeRequest('PATCH', step.target, data, headers, timeoutOpts);
            }
            else if (action === 'head') {
                result = await this.executor.makeRequest('HEAD', step.target, undefined, getHeaders(), timeoutOpts);
            }
            else if (action === 'options') {
                result = await this.executor.makeRequest('OPTIONS', step.target, undefined, getHeaders(), timeoutOpts);
            }
            else if (action === 'validate_response') {
                result = this.validator.validateResponse(this.executor.getLatestResponse(), step.expected || step.value || '');
            }
            else if (action === 'validate_status') {
                result = this.validator.validateStatus(this.executor.getLatestResponse(), parseInt(step.expected || step.value || '200'));
            }
            else if (action === 'validate_headers') {
                result = this.validator.validateHeaders(this.executor.getLatestResponse(), step.expected || step.value || '');
            }
            else if (action === 'validate_schema') {
                result = this.validator.validateResponseSchema(step.expected || step.value || '');
            }
            else if (action === 'set_header') {
                this.setDefaultHeader(step.target, step.value || '');
                result = true;
            }
            else if (action === 'set_auth') {
                this.setAuthentication(step.target, step.value);
                result = true;
            }
            else if (action === 'wait') {
                await (0, async_1.delay)(parseInt(step.value || '1000'));
                result = true;
            }
            else if (action === 'clear_cookies') {
                result = true;
            }
            else {
                throw new Error(`Unsupported API action: ${step.action}`);
            }
            return { stepIndex, status: TestModels_1.TestStatus.PASSED, duration: Date.now() - startTime,
                actualResult: typeof result === 'string' ? result : JSON.stringify(result) };
        }
        catch (error) {
            return { stepIndex, status: TestModels_1.TestStatus.FAILED, duration: Date.now() - startTime, error: error instanceof Error ? error.message : String(error) };
        }
    }
    setAuthentication(type, value) {
        this.config.auth = this.authHandler.setAuthentication(type, value);
    }
    setDefaultHeader(name, value) {
        this.config.defaultHeaders[name] = value;
        this.executor.setDefaultHeader(name, value);
    }
    getLatestResponse() { return this.executor.getLatestResponse(); }
    getLatestPerformanceMetrics() { return this.executor.getLatestPerformanceMetrics(); }
    async cleanup() {
        try {
            this.executor.reset();
            this.emit('cleanup');
        }
        catch (_e) { /* best-effort */ }
    }
    applyEnvironmentConfig(environment) {
        for (const [key, value] of Object.entries(environment)) {
            if (key === 'API_BASE_URL')
                this.executor.axiosInstance.defaults.baseURL = value;
            else if (key === 'API_TIMEOUT')
                this.executor.axiosInstance.defaults.timeout = parseInt(value);
            else if (key === 'API_AUTH_TOKEN')
                this.setAuthentication('bearer', value);
        }
    }
}
exports.APIAgent = APIAgent;
function createAPIAgent(config) {
    return new APIAgent(config);
}
//# sourceMappingURL=APIAgent.js.map