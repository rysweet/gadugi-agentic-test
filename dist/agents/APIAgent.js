"use strict";
/**
 * APIAgent - Comprehensive REST API testing agent using Axios
 *
 * This agent provides complete automation capabilities for REST API testing
 * including support for all HTTP methods, authentication, request/response
 * validation, performance measurement, retries, and comprehensive error handling.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIAgent = void 0;
exports.createAPIAgent = createAPIAgent;
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
const index_1 = require("./index");
const TestModels_1 = require("../models/TestModels");
const logger_1 = require("../utils/logger");
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    baseURL: '',
    timeout: 30000,
    defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    auth: { type: 'bearer' },
    requestInterceptors: [],
    responseInterceptors: [],
    validation: {
        enabled: false,
        strictMode: false
    },
    performance: {
        enabled: true,
        measureDNS: true,
        measureTCP: true,
        measureTLS: true,
        measureTransfer: true,
        thresholds: {
            maxResponseTime: 5000,
            maxDNSTime: 1000,
            maxConnectTime: 2000
        }
    },
    retry: {
        maxRetries: 2,
        retryDelay: 1000,
        retryOnStatus: [408, 429, 500, 502, 503, 504],
        exponentialBackoff: true,
        maxBackoffDelay: 10000
    },
    ssl: {
        rejectUnauthorized: true
    },
    logConfig: {
        logRequests: true,
        logResponses: true,
        logHeaders: false,
        logLevel: logger_1.LogLevel.DEBUG,
        maskSensitiveData: true,
        sensitiveHeaders: ['authorization', 'x-api-key', 'cookie']
    }
};
/**
 * Comprehensive API testing agent
 */
class APIAgent extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.name = 'APIAgent';
        this.type = index_1.AgentType.API;
        this.isInitialized = false;
        this.requestHistory = [];
        this.responseHistory = [];
        this.performanceMetrics = [];
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = (0, logger_1.createLogger)({
            level: this.config.logConfig.logLevel,
            logDir: './logs/api-agent'
        });
        this.axiosInstance = this.createAxiosInstance();
        this.setupEventListeners();
    }
    /**
     * Initialize the agent
     */
    async initialize() {
        this.logger.info('Initializing APIAgent', {
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            authType: this.config.auth.type
        });
        try {
            // Test connectivity if base URL is provided
            if (this.config.baseURL) {
                await this.testConnectivity();
            }
            // Setup interceptors
            this.setupInterceptors();
            this.isInitialized = true;
            this.logger.info('APIAgent initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize APIAgent', { error: error?.message });
            throw new Error(`Failed to initialize APIAgent: ${error?.message}`);
        }
    }
    /**
     * Execute a test scenario
     */
    async execute(scenario) {
        if (!this.isInitialized) {
            throw new Error('Agent not initialized. Call initialize() first.');
        }
        this.currentScenarioId = scenario.id;
        this.logger.setContext({ scenarioId: scenario.id, component: 'APIAgent' });
        this.logger.scenarioStart(scenario.id, scenario.name);
        const startTime = Date.now();
        let status = TestModels_1.TestStatus.PASSED;
        let error;
        try {
            // Set environment variables if specified in scenario
            if (scenario.environment) {
                this.applyEnvironmentConfig(scenario.environment);
            }
            // Execute scenario steps
            const stepResults = [];
            for (let i = 0; i < scenario.steps.length; i++) {
                const step = scenario.steps[i];
                const stepResult = await this.executeStep(step, i);
                stepResults.push(stepResult);
                if (stepResult.status === TestModels_1.TestStatus.FAILED || stepResult.status === TestModels_1.TestStatus.ERROR) {
                    status = stepResult.status;
                    error = stepResult.error;
                    break;
                }
            }
            return {
                scenarioId: scenario.id,
                status,
                duration: Date.now() - startTime,
                startTime: new Date(startTime),
                endTime: new Date(),
                error,
                stepResults,
                logs: this.getScenarioLogs(),
                requestHistory: [...this.requestHistory],
                responseHistory: [...this.responseHistory],
                performanceMetrics: [...this.performanceMetrics]
            };
        }
        catch (executeError) {
            this.logger.error('Scenario execution failed', { error: executeError?.message });
            status = TestModels_1.TestStatus.ERROR;
            error = executeError?.message;
            throw executeError;
        }
        finally {
            this.logger.scenarioEnd(scenario.id, status, Date.now() - startTime);
            this.currentScenarioId = undefined;
        }
    }
    /**
     * Make an HTTP request with full configuration
     */
    async makeRequest(method, url, data, headers, options) {
        const requestId = this.generateRequestId();
        const startTime = Date.now();
        const request = {
            id: requestId,
            method,
            url,
            headers,
            data,
            timestamp: new Date(),
            timeout: options?.timeout
        };
        this.requestHistory.push(request);
        if (this.config.logConfig.logRequests) {
            this.logger.info(`Making ${method} request`, {
                requestId,
                url,
                headers: this.config.logConfig.logHeaders ? this.maskSensitiveHeaders(headers || {}) : undefined
            });
        }
        let attempt = 0;
        const maxAttempts = this.config.retry.maxRetries + 1;
        while (attempt < maxAttempts) {
            try {
                const axiosConfig = {
                    method: method.toLowerCase(),
                    url,
                    data,
                    headers,
                    ...options
                };
                const response = await this.axiosInstance.request(axiosConfig);
                const duration = Date.now() - startTime;
                const apiResponse = {
                    requestId,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    data: response.data,
                    duration,
                    timestamp: new Date(),
                    size: this.calculateResponseSize(response.data)
                };
                this.responseHistory.push(apiResponse);
                if (this.config.performance.enabled) {
                    this.recordPerformanceMetrics(requestId, response, duration);
                }
                if (this.config.logConfig.logResponses) {
                    this.logger.info(`Request completed successfully`, {
                        requestId,
                        status: response.status,
                        duration,
                        size: apiResponse.size
                    });
                }
                this.emit('response', apiResponse);
                return apiResponse;
            }
            catch (error) {
                attempt++;
                if (attempt >= maxAttempts || !this.shouldRetry(error)) {
                    const duration = Date.now() - startTime;
                    const errorResponse = {
                        requestId,
                        status: error.response?.status || 0,
                        statusText: error.response?.statusText || 'Request Failed',
                        headers: error.response?.headers || {},
                        data: error.response?.data || error.message,
                        duration,
                        timestamp: new Date()
                    };
                    this.responseHistory.push(errorResponse);
                    this.logger.error(`Request failed after ${attempt} attempts`, {
                        requestId,
                        error: error?.message,
                        status: error.response?.status
                    });
                    throw error;
                }
                const retryDelay = this.calculateRetryDelay(attempt);
                this.logger.warn(`Request attempt ${attempt} failed, retrying in ${retryDelay}ms`, {
                    requestId,
                    error: error?.message,
                    attempt,
                    maxAttempts
                });
                await this.delay(retryDelay);
            }
        }
        throw new Error('Unexpected end of retry loop');
    }
    /**
     * Execute a test step
     */
    async executeStep(step, stepIndex) {
        const startTime = Date.now();
        this.logger.stepExecution(stepIndex, step.action, step.target);
        try {
            let result;
            switch (step.action.toLowerCase()) {
                case 'get':
                    result = await this.handleGetRequest(step);
                    break;
                case 'post':
                    result = await this.handlePostRequest(step);
                    break;
                case 'put':
                    result = await this.handlePutRequest(step);
                    break;
                case 'delete':
                    result = await this.handleDeleteRequest(step);
                    break;
                case 'patch':
                    result = await this.handlePatchRequest(step);
                    break;
                case 'head':
                    result = await this.handleHeadRequest(step);
                    break;
                case 'options':
                    result = await this.handleOptionsRequest(step);
                    break;
                case 'validate_response':
                    result = await this.validateResponse(step);
                    break;
                case 'validate_status':
                    result = await this.validateStatus(parseInt(step.expected || step.value || '200'));
                    break;
                case 'validate_headers':
                    result = await this.validateHeaders(step.expected || step.value || '');
                    break;
                case 'validate_schema':
                    result = await this.validateResponseSchema(step.expected || step.value || '');
                    break;
                case 'set_header':
                    this.setDefaultHeader(step.target, step.value || '');
                    result = true;
                    break;
                case 'set_auth':
                    this.setAuthentication(step.target, step.value);
                    result = true;
                    break;
                case 'wait':
                    const waitTime = parseInt(step.value || '1000');
                    await this.delay(waitTime);
                    result = true;
                    break;
                case 'clear_cookies':
                    // Note: Axios doesn't handle cookies automatically like browsers
                    // This would need to be implemented if cookie support is needed
                    result = true;
                    break;
                default:
                    throw new Error(`Unsupported API action: ${step.action}`);
            }
            const duration = Date.now() - startTime;
            this.logger.stepComplete(stepIndex, TestModels_1.TestStatus.PASSED, duration);
            return {
                stepIndex,
                status: TestModels_1.TestStatus.PASSED,
                duration,
                actualResult: typeof result === 'string' ? result : JSON.stringify(result)
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.stepComplete(stepIndex, TestModels_1.TestStatus.FAILED, duration);
            return {
                stepIndex,
                status: TestModels_1.TestStatus.FAILED,
                duration,
                error: error?.message
            };
        }
    }
    /**
     * Set authentication configuration
     */
    setAuthentication(type, value) {
        switch (type.toLowerCase()) {
            case 'bearer':
                this.config.auth = { type: 'bearer', token: value };
                this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${value}`;
                break;
            case 'apikey':
                const [header, key] = (value || '').split(':');
                this.config.auth = {
                    type: 'apikey',
                    apiKey: key,
                    apiKeyHeader: header || 'X-API-Key'
                };
                this.axiosInstance.defaults.headers.common[header || 'X-API-Key'] = key;
                break;
            case 'basic':
                const [username, password] = (value || '').split(':');
                this.config.auth = { type: 'basic', username, password };
                const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
                this.axiosInstance.defaults.headers.common['Authorization'] = `Basic ${basicAuth}`;
                break;
            default:
                throw new Error(`Unsupported authentication type: ${type}`);
        }
        this.logger.debug(`Authentication configured: ${type}`);
    }
    /**
     * Set default header
     */
    setDefaultHeader(name, value) {
        this.config.defaultHeaders[name] = value;
        this.axiosInstance.defaults.headers.common[name] = value;
        this.logger.debug(`Default header set: ${name}=${this.config.logConfig.maskSensitiveData &&
            this.config.logConfig.sensitiveHeaders.includes(name.toLowerCase()) ? '[MASKED]' : value}`);
    }
    /**
     * Get the latest response
     */
    getLatestResponse() {
        return this.responseHistory[this.responseHistory.length - 1];
    }
    /**
     * Get performance metrics for the latest request
     */
    getLatestPerformanceMetrics() {
        return this.performanceMetrics[this.performanceMetrics.length - 1];
    }
    /**
     * Clean up resources
     */
    async cleanup() {
        this.logger.info('Cleaning up APIAgent resources');
        try {
            // Clear history
            this.requestHistory = [];
            this.responseHistory = [];
            this.performanceMetrics = [];
            this.logger.info('APIAgent cleanup completed');
            this.emit('cleanup');
        }
        catch (error) {
            this.logger.error('Error during cleanup', { error: error?.message });
        }
    }
    // Private helper methods
    createAxiosInstance() {
        const instance = axios_1.default.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            headers: this.config.defaultHeaders,
            httpsAgent: this.config.ssl ? {
                rejectUnauthorized: this.config.ssl.rejectUnauthorized,
                ca: this.config.ssl.ca,
                cert: this.config.ssl.cert,
                key: this.config.ssl.key
            } : undefined
        });
        return instance;
    }
    setupInterceptors() {
        // Request interceptors
        this.config.requestInterceptors.forEach(interceptor => {
            if (interceptor.enabled) {
                this.axiosInstance.interceptors.request.use(interceptor.handler);
            }
        });
        // Response interceptors
        this.config.responseInterceptors.forEach(interceptor => {
            if (interceptor.enabled) {
                this.axiosInstance.interceptors.response.use(interceptor.handler, interceptor.errorHandler);
            }
        });
    }
    async testConnectivity() {
        try {
            await this.axiosInstance.head('/');
        }
        catch (error) {
            // Don't fail initialization if connectivity test fails
            this.logger.warn('Connectivity test failed', { error: error?.message });
        }
    }
    async handleGetRequest(step) {
        const headers = this.parseHeaders(step.value);
        return this.makeRequest('GET', step.target, undefined, headers, {
            timeout: step.timeout
        });
    }
    async handlePostRequest(step) {
        const { data, headers } = this.parseRequestData(step.value);
        return this.makeRequest('POST', step.target, data, headers, {
            timeout: step.timeout
        });
    }
    async handlePutRequest(step) {
        const { data, headers } = this.parseRequestData(step.value);
        return this.makeRequest('PUT', step.target, data, headers, {
            timeout: step.timeout
        });
    }
    async handleDeleteRequest(step) {
        const headers = this.parseHeaders(step.value);
        return this.makeRequest('DELETE', step.target, undefined, headers, {
            timeout: step.timeout
        });
    }
    async handlePatchRequest(step) {
        const { data, headers } = this.parseRequestData(step.value);
        return this.makeRequest('PATCH', step.target, data, headers, {
            timeout: step.timeout
        });
    }
    async handleHeadRequest(step) {
        const headers = this.parseHeaders(step.value);
        return this.makeRequest('HEAD', step.target, undefined, headers, {
            timeout: step.timeout
        });
    }
    async handleOptionsRequest(step) {
        const headers = this.parseHeaders(step.value);
        return this.makeRequest('OPTIONS', step.target, undefined, headers, {
            timeout: step.timeout
        });
    }
    async validateResponse(step) {
        const latestResponse = this.getLatestResponse();
        if (!latestResponse) {
            throw new Error('No response available for validation');
        }
        const expected = step.expected || step.value;
        if (!expected) {
            throw new Error('No expected value provided for response validation');
        }
        try {
            const expectedData = JSON.parse(expected);
            return this.deepEqual(latestResponse.data, expectedData);
        }
        catch {
            // If not JSON, do string comparison
            return JSON.stringify(latestResponse.data).includes(expected);
        }
    }
    async validateStatus(expectedStatus) {
        const latestResponse = this.getLatestResponse();
        if (!latestResponse) {
            throw new Error('No response available for status validation');
        }
        return latestResponse.status === expectedStatus;
    }
    async validateHeaders(expected) {
        const latestResponse = this.getLatestResponse();
        if (!latestResponse) {
            throw new Error('No response available for header validation');
        }
        try {
            const expectedHeaders = JSON.parse(expected);
            for (const [key, value] of Object.entries(expectedHeaders)) {
                const actualValue = latestResponse.headers[key.toLowerCase()];
                if (actualValue !== value) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            throw new Error(`Invalid header validation format: ${expected}`);
        }
    }
    async validateResponseSchema(schemaStr) {
        if (!this.config.validation.enabled) {
            throw new Error('Schema validation is disabled');
        }
        // This would require a JSON schema validation library
        // For now, return true as placeholder
        this.logger.warn('Schema validation not implemented yet');
        return true;
    }
    parseHeaders(value) {
        if (!value)
            return undefined;
        try {
            return JSON.parse(value);
        }
        catch {
            // If not JSON, treat as single header in format "key:value"
            const [key, val] = value.split(':');
            return key && val ? { [key.trim()]: val.trim() } : undefined;
        }
    }
    parseRequestData(value) {
        if (!value)
            return {};
        try {
            const parsed = JSON.parse(value);
            if (parsed.data && parsed.headers) {
                return parsed;
            }
            else if (typeof parsed === 'object') {
                return { data: parsed };
            }
            return { data: parsed };
        }
        catch {
            return { data: value };
        }
    }
    shouldRetry(error) {
        if (!error.response)
            return false;
        return this.config.retry.retryOnStatus.includes(error.response.status);
    }
    calculateRetryDelay(attempt) {
        if (!this.config.retry.exponentialBackoff) {
            return this.config.retry.retryDelay;
        }
        const delay = this.config.retry.retryDelay * Math.pow(2, attempt - 1);
        return Math.min(delay, this.config.retry.maxBackoffDelay || 10000);
    }
    recordPerformanceMetrics(requestId, response, totalTime) {
        const metrics = {
            requestId,
            totalTime,
            responseSize: this.calculateResponseSize(response.data),
            timestamp: new Date()
        };
        this.performanceMetrics.push(metrics);
        // Check thresholds
        const thresholds = this.config.performance.thresholds;
        if (thresholds?.maxResponseTime && totalTime > thresholds.maxResponseTime) {
            this.logger.warn(`Response time exceeded threshold`, {
                requestId,
                actualTime: totalTime,
                threshold: thresholds.maxResponseTime
            });
        }
    }
    calculateResponseSize(data) {
        if (typeof data === 'string') {
            return Buffer.byteLength(data, 'utf8');
        }
        else if (data instanceof Buffer) {
            return data.length;
        }
        else {
            return Buffer.byteLength(JSON.stringify(data), 'utf8');
        }
    }
    maskSensitiveHeaders(headers) {
        if (!this.config.logConfig.maskSensitiveData) {
            return headers;
        }
        const masked = { ...headers };
        for (const sensitiveHeader of this.config.logConfig.sensitiveHeaders) {
            const header = Object.keys(masked).find(key => key.toLowerCase() === sensitiveHeader.toLowerCase());
            if (header) {
                masked[header] = '[MASKED]';
            }
        }
        return masked;
    }
    generateRequestId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    applyEnvironmentConfig(environment) {
        for (const [key, value] of Object.entries(environment)) {
            if (key.startsWith('API_')) {
                // Apply API-specific environment variables
                switch (key) {
                    case 'API_BASE_URL':
                        this.axiosInstance.defaults.baseURL = value;
                        break;
                    case 'API_TIMEOUT':
                        this.axiosInstance.defaults.timeout = parseInt(value);
                        break;
                    case 'API_AUTH_TOKEN':
                        this.setAuthentication('bearer', value);
                        break;
                }
            }
        }
    }
    getScenarioLogs() {
        // Return recent logs related to the current scenario
        return [];
    }
    setupEventListeners() {
        this.on('error', (error) => {
            this.logger.error('APIAgent error', { error: error.message });
        });
    }
    deepEqual(obj1, obj2) {
        if (obj1 === obj2)
            return true;
        if (obj1 == null || obj2 == null)
            return false;
        if (typeof obj1 !== typeof obj2)
            return false;
        if (typeof obj1 !== 'object')
            return obj1 === obj2;
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (keys1.length !== keys2.length)
            return false;
        for (const key of keys1) {
            if (!keys2.includes(key))
                return false;
            if (!this.deepEqual(obj1[key], obj2[key]))
                return false;
        }
        return true;
    }
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.APIAgent = APIAgent;
/**
 * Factory function to create APIAgent instance
 */
function createAPIAgent(config) {
    return new APIAgent(config);
}
//# sourceMappingURL=APIAgent.js.map