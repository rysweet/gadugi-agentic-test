"use strict";
/**
 * SystemAgent - Comprehensive system resource monitoring and management agent
 *
 * This agent provides complete system monitoring capabilities including:
 * - CPU usage, memory consumption, disk I/O monitoring
 * - Process tracking and resource usage analysis
 * - Resource leak detection and performance issue identification
 * - Network activity monitoring
 * - System health checks before/after tests
 * - Zombie process cleanup
 * - Temporary file management
 * - Docker container monitoring
 * - File system change tracking
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSystemAgentConfig = exports.SystemAgent = void 0;
exports.createSystemAgent = createSystemAgent;
const os = __importStar(require("os"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const events_1 = require("events");
const util_1 = require("util");
const si = __importStar(require("systeminformation"));
const pidusage_1 = __importDefault(require("pidusage"));
const index_1 = require("./index");
const logger_1 = require("../utils/logger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Default configuration for SystemAgent
 */
const defaultSystemAgentConfig = {
    monitoringInterval: 5000, // 5 seconds
    cpuThreshold: 80,
    memoryThreshold: 85,
    diskThreshold: 90,
    processCountThreshold: 500,
    networkMonitoring: {
        enabled: true,
        interfaces: [],
        bandwidth: true,
    },
    dockerMonitoring: {
        enabled: true,
        containerFilters: [],
    },
    fileSystemMonitoring: {
        enabled: true,
        watchPaths: ['/tmp', './temp', './logs'],
        excludePatterns: [/node_modules/, /\.git/, /\.DS_Store/],
    },
    cleanup: {
        killZombieProcesses: true,
        cleanTempFiles: true,
        tempDirPatterns: ['/tmp/test-*', './temp/*', './logs/*.tmp'],
        processNamePatterns: ['zombie-*', 'test-*'],
    },
    performanceBaseline: {
        captureBaseline: true,
        baselineDuration: 30000, // 30 seconds
        comparisonThreshold: 20, // 20% deviation
    },
};
exports.defaultSystemAgentConfig = defaultSystemAgentConfig;
/**
 * SystemAgent implementation
 */
class SystemAgent extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.name = 'SystemAgent';
        this.type = index_1.AgentType.SYSTEM;
        this.isMonitoring = false;
        this.metricsHistory = [];
        this.fsWatchers = new Map();
        this.fileSystemChanges = [];
        this.dockerAvailable = false;
        this.maxHistorySize = 1000;
        this.config = { ...defaultSystemAgentConfig, ...config };
        this.logger = (0, logger_1.createLogger)({ level: logger_1.LogLevel.INFO });
    }
    /**
     * Initialize the SystemAgent
     */
    async initialize() {
        this.logger.info('Initializing SystemAgent...');
        try {
            // Check if Docker is available
            await this.checkDockerAvailability();
            // Capture initial system state
            this.initialMetrics = await this.captureMetrics();
            this.logger.info('Initial system metrics captured');
            // Set up file system monitoring
            if (this.config.fileSystemMonitoring?.enabled) {
                await this.setupFileSystemMonitoring();
            }
            // Capture performance baseline if configured
            if (this.config.performanceBaseline?.captureBaseline) {
                await this.capturePerformanceBaseline();
            }
            this.logger.info('SystemAgent initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize SystemAgent', { error });
            throw error;
        }
    }
    /**
     * Execute system monitoring for a scenario
     */
    async execute(scenario) {
        this.logger.info('Starting system monitoring for scenario', { scenario: scenario?.name });
        try {
            // Start continuous monitoring
            await this.startMonitoring();
            // Wait for scenario completion or timeout
            const scenarioDuration = scenario?.timeout || 60000;
            await new Promise(resolve => setTimeout(resolve, scenarioDuration));
            // Generate health report
            const healthReport = await this.generateHealthReport();
            this.logger.info('System monitoring completed', {
                overall: healthReport.overall,
                issues: healthReport.issues.length,
                leaks: healthReport.resourceLeaks.length
            });
            return healthReport;
        }
        catch (error) {
            this.logger.error('System monitoring execution failed', { error });
            throw error;
        }
    }
    /**
     * Cleanup resources and stop monitoring
     */
    async cleanup() {
        this.logger.info('Cleaning up SystemAgent...');
        try {
            // Stop monitoring
            await this.stopMonitoring();
            // Clean up file system watchers
            this.fsWatchers.forEach(watcher => {
                if (watcher.close) {
                    watcher.close();
                }
            });
            this.fsWatchers.clear();
            // Perform system cleanup if configured
            if (this.config.cleanup?.killZombieProcesses) {
                await this.killZombieProcesses();
            }
            if (this.config.cleanup?.cleanTempFiles) {
                await this.cleanTempFiles();
            }
            this.logger.info('SystemAgent cleanup completed');
        }
        catch (error) {
            this.logger.error('SystemAgent cleanup failed', { error });
            throw error;
        }
    }
    /**
     * Start continuous system monitoring
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            this.logger.warn('Monitoring is already active');
            return;
        }
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(async () => {
            try {
                const metrics = await this.captureMetrics();
                this.metricsHistory.push(metrics);
                // Keep history size manageable
                if (this.metricsHistory.length > this.maxHistorySize) {
                    this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
                }
                // Emit metrics event
                this.emit('metrics', metrics);
                // Check for issues
                const issues = await this.analyzeMetrics(metrics);
                if (issues.length > 0) {
                    this.emit('issues', issues);
                }
            }
            catch (error) {
                this.logger.error('Error during monitoring cycle', { error });
            }
        }, this.config.monitoringInterval);
        this.logger.info('System monitoring started');
    }
    /**
     * Stop continuous monitoring
     */
    async stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        this.isMonitoring = false;
        this.logger.info('System monitoring stopped');
    }
    /**
     * Capture comprehensive system metrics
     */
    async captureMetrics() {
        const timestamp = new Date();
        try {
            const [cpuData, memData, diskData, networkData, processData, systemData] = await Promise.all([
                this.getCPUMetrics(),
                this.getMemoryMetrics(),
                this.getDiskMetrics(),
                this.getNetworkMetrics(),
                this.getProcessMetrics(),
                this.getSystemInfo()
            ]);
            const dockerData = this.dockerAvailable ? await this.getDockerMetrics() : undefined;
            const metrics = {
                timestamp,
                cpu: cpuData,
                memory: memData,
                disk: diskData,
                network: networkData,
                processes: processData,
                docker: dockerData,
                system: systemData
            };
            return metrics;
        }
        catch (error) {
            this.logger.error('Failed to capture system metrics', { error });
            throw error;
        }
    }
    /**
     * Get CPU metrics
     */
    async getCPUMetrics() {
        try {
            const currentLoad = await si.currentLoad();
            const cpuTemperature = await si.cpuTemperature().catch(() => ({ main: undefined }));
            return {
                usage: currentLoad.currentLoad,
                loadAverage: os.loadavg(),
                cores: os.cpus().length,
                temperature: cpuTemperature.main
            };
        }
        catch (error) {
            this.logger.error('Failed to get CPU metrics', { error });
            return {
                usage: 0,
                loadAverage: [0, 0, 0],
                cores: os.cpus().length
            };
        }
    }
    /**
     * Get memory metrics
     */
    async getMemoryMetrics() {
        try {
            const mem = await si.mem();
            return {
                total: mem.total,
                free: mem.free,
                used: mem.used,
                percentage: (mem.used / mem.total) * 100,
                available: mem.available
            };
        }
        catch (error) {
            this.logger.error('Failed to get memory metrics', { error });
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            return {
                total: totalMem,
                free: freeMem,
                used: usedMem,
                percentage: (usedMem / totalMem) * 100,
                available: freeMem
            };
        }
    }
    /**
     * Get disk metrics
     */
    async getDiskMetrics() {
        try {
            const [fsSize, diskIO] = await Promise.all([
                si.fsSize(),
                si.disksIO().catch(() => undefined)
            ]);
            const usage = fsSize.map(fs => ({
                filesystem: fs.fs,
                size: fs.size,
                used: fs.used,
                available: fs.available,
                percentage: fs.use,
                mountpoint: fs.mount
            }));
            const io = diskIO ? {
                reads: diskIO.rIO,
                writes: diskIO.wIO,
                readBytes: (diskIO.rIO_sec || 0) * 512, // Approximate
                writeBytes: (diskIO.wIO_sec || 0) * 512 // Approximate
            } : undefined;
            return { usage, io };
        }
        catch (error) {
            this.logger.error('Failed to get disk metrics', { error });
            return { usage: [] };
        }
    }
    /**
     * Get network metrics
     */
    async getNetworkMetrics() {
        try {
            const [networkStats, networkConnections] = await Promise.all([
                si.networkStats(),
                si.networkConnections().catch(() => [])
            ]);
            const interfaces = networkStats.map(stat => ({
                name: stat.iface,
                rx: stat.rx_sec,
                tx: stat.tx_sec,
                rxBytes: stat.rx_bytes,
                txBytes: stat.tx_bytes,
                speed: undefined
            }));
            return {
                interfaces,
                connections: networkConnections.length
            };
        }
        catch (error) {
            this.logger.error('Failed to get network metrics', { error });
            return { interfaces: [] };
        }
    }
    /**
     * Get process metrics
     */
    async getProcessMetrics() {
        try {
            const processes = await si.processes();
            const processInfos = [];
            for (const proc of processes.list) {
                try {
                    const stats = await (0, pidusage_1.default)(proc.pid).catch(() => null);
                    processInfos.push({
                        pid: proc.pid,
                        name: proc.name,
                        command: proc.command,
                        cpu: stats ? stats.cpu : proc.cpu,
                        memory: stats ? stats.memory : proc.memRss || 0,
                        state: proc.state,
                        ppid: proc.parentPid,
                        uid: undefined,
                        gid: undefined,
                        priority: proc.priority,
                        nice: proc.nice,
                        threads: undefined,
                        startTime: proc.started ? new Date(proc.started) : undefined,
                        zombie: proc.state === 'zombie' || proc.state === 'Z'
                    });
                }
                catch (procError) {
                    // Skip processes we can't access
                    continue;
                }
            }
            return processInfos;
        }
        catch (error) {
            this.logger.error('Failed to get process metrics', { error });
            return [];
        }
    }
    /**
     * Get system information
     */
    async getSystemInfo() {
        try {
            const systemInfo = await si.system();
            return {
                uptime: os.uptime(),
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname()
            };
        }
        catch (error) {
            this.logger.error('Failed to get system info', { error });
            return {
                uptime: os.uptime(),
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname()
            };
        }
    }
    /**
     * Get Docker container metrics
     */
    async getDockerMetrics() {
        if (!this.dockerAvailable) {
            return [];
        }
        try {
            const { stdout } = await execAsync('docker ps --format "table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.State}}\\t{{.Status}}\\t{{.Ports}}"');
            const lines = stdout.trim().split('\n').slice(1); // Skip header
            const containers = [];
            for (const line of lines) {
                const [id, name, image, state, status, ports] = line.split('\t');
                try {
                    // Get container stats
                    const { stdout: statsOutput } = await execAsync(`docker stats ${id} --no-stream --format "{{.CPUPerc}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}"`);
                    const [cpuPerc, memPerc, netIO, blockIO] = statsOutput.trim().split(',');
                    containers.push({
                        id: id.substring(0, 12),
                        name,
                        image,
                        state,
                        status,
                        ports: ports ? ports.split(',') : [],
                        cpu: parseFloat(cpuPerc.replace('%', '')) || 0,
                        memory: parseFloat(memPerc.replace('%', '')) || 0,
                        networkIO: this.parseDockerNetworkIO(netIO),
                        blockIO: this.parseDockerIO(blockIO)
                    });
                }
                catch (statsError) {
                    // Add container without stats
                    containers.push({
                        id: id.substring(0, 12),
                        name,
                        image,
                        state,
                        status,
                        ports: ports ? ports.split(',') : [],
                        cpu: 0,
                        memory: 0
                    });
                }
            }
            return containers;
        }
        catch (error) {
            this.logger.error('Failed to get Docker metrics', { error });
            return [];
        }
    }
    /**
     * Parse Docker network I/O stats
     */
    parseDockerNetworkIO(ioString) {
        if (!ioString || ioString === '--') {
            return { rx: 0, tx: 0 };
        }
        try {
            const [input, output] = ioString.split(' / ');
            const inputBytes = this.parseBytes(input);
            const outputBytes = this.parseBytes(output);
            return { rx: inputBytes, tx: outputBytes };
        }
        catch (error) {
            return { rx: 0, tx: 0 };
        }
    }
    /**
     * Parse Docker I/O stats
     */
    parseDockerIO(ioString) {
        if (!ioString || ioString === '--') {
            return { read: 0, write: 0 };
        }
        try {
            const [input, output] = ioString.split(' / ');
            const inputBytes = this.parseBytes(input);
            const outputBytes = this.parseBytes(output);
            return { read: inputBytes, write: outputBytes };
        }
        catch (error) {
            return { read: 0, write: 0 };
        }
    }
    /**
     * Parse byte string to number
     */
    parseBytes(byteString) {
        if (!byteString)
            return 0;
        const match = byteString.match(/^([\d.]+)\s*([KMGT]?B?)$/i);
        if (!match)
            return 0;
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        const multipliers = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
            'TB': 1024 * 1024 * 1024 * 1024
        };
        return value * (multipliers[unit] || 1);
    }
    /**
     * Check Docker availability
     */
    async checkDockerAvailability() {
        try {
            await execAsync('docker --version');
            this.dockerAvailable = true;
            this.logger.info('Docker is available for monitoring');
        }
        catch (error) {
            this.dockerAvailable = false;
            this.logger.info('Docker is not available');
        }
    }
    /**
     * Set up file system monitoring
     */
    async setupFileSystemMonitoring() {
        if (!this.config.fileSystemMonitoring?.enabled) {
            return;
        }
        const { watchPaths, excludePatterns } = this.config.fileSystemMonitoring;
        for (const watchPath of watchPaths) {
            try {
                const absolutePath = path.resolve(watchPath);
                // Check if path exists
                await fs.access(absolutePath).catch(() => {
                    // Create directory if it doesn't exist
                    return fs.mkdir(absolutePath, { recursive: true });
                });
                // Set up watcher
                const chokidar = require('chokidar');
                const watcher = chokidar.watch(absolutePath, {
                    ignored: (filePath) => excludePatterns?.some(pattern => pattern.test(filePath)) || false,
                    persistent: true,
                    ignoreInitial: true
                });
                watcher
                    .on('add', (filePath, stats) => {
                    this.fileSystemChanges.push({
                        path: filePath,
                        type: 'created',
                        timestamp: new Date(),
                        size: stats?.size
                    });
                    this.emit('fileSystemChange', { path: filePath, type: 'created' });
                })
                    .on('change', (filePath, stats) => {
                    this.fileSystemChanges.push({
                        path: filePath,
                        type: 'modified',
                        timestamp: new Date(),
                        size: stats?.size
                    });
                    this.emit('fileSystemChange', { path: filePath, type: 'modified' });
                })
                    .on('unlink', (filePath) => {
                    this.fileSystemChanges.push({
                        path: filePath,
                        type: 'deleted',
                        timestamp: new Date()
                    });
                    this.emit('fileSystemChange', { path: filePath, type: 'deleted' });
                });
                this.fsWatchers.set(absolutePath, watcher);
                this.logger.info(`File system monitoring set up for: ${absolutePath}`);
            }
            catch (error) {
                this.logger.error(`Failed to set up monitoring for ${watchPath}`, { error });
            }
        }
    }
    /**
     * Capture performance baseline
     */
    async capturePerformanceBaseline() {
        const startTime = Date.now();
        const duration = this.config.performanceBaseline?.baselineDuration || 30000;
        const samples = [];
        this.logger.info(`Capturing performance baseline for ${duration}ms...`);
        const interval = setInterval(async () => {
            try {
                const metrics = await this.captureMetrics();
                samples.push(metrics);
            }
            catch (error) {
                this.logger.error('Error capturing baseline sample', { error });
            }
        }, 1000);
        setTimeout(() => {
            clearInterval(interval);
            if (samples.length > 0) {
                const avgCPU = samples.reduce((sum, s) => sum + s.cpu.usage, 0) / samples.length;
                const avgMemory = samples.reduce((sum, s) => sum + s.memory.percentage, 0) / samples.length;
                const avgDiskIO = samples.reduce((sum, s) => sum + (s.disk.io?.reads || 0), 0) / samples.length;
                const avgNetworkIO = samples.reduce((sum, s) => sum + s.network.interfaces.reduce((netSum, iface) => netSum + iface.rx + iface.tx, 0), 0) / samples.length;
                const avgProcessCount = samples.reduce((sum, s) => sum + s.processes.length, 0) / samples.length;
                this.performanceBaseline = {
                    timestamp: new Date(),
                    duration,
                    metrics: {
                        avgCPU,
                        avgMemory,
                        avgDiskIO,
                        avgNetworkIO,
                        processCount: avgProcessCount
                    }
                };
                this.logger.info('Performance baseline captured', { baseline: this.performanceBaseline.metrics });
            }
        }, duration);
    }
    /**
     * Analyze metrics for issues
     */
    async analyzeMetrics(metrics) {
        const issues = [];
        // CPU usage check
        if (metrics.cpu.usage > (this.config.cpuThreshold || 80)) {
            issues.push({
                type: 'cpu',
                severity: metrics.cpu.usage > 95 ? 'critical' : 'high',
                message: `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
                details: { usage: metrics.cpu.usage, loadAverage: metrics.cpu.loadAverage },
                timestamp: metrics.timestamp
            });
        }
        // Memory usage check
        if (metrics.memory.percentage > (this.config.memoryThreshold || 85)) {
            issues.push({
                type: 'memory',
                severity: metrics.memory.percentage > 95 ? 'critical' : 'high',
                message: `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
                details: {
                    percentage: metrics.memory.percentage,
                    used: metrics.memory.used,
                    total: metrics.memory.total
                },
                timestamp: metrics.timestamp
            });
        }
        // Disk usage check
        for (const disk of metrics.disk.usage) {
            if (disk.percentage > (this.config.diskThreshold || 90)) {
                issues.push({
                    type: 'disk',
                    severity: disk.percentage > 98 ? 'critical' : 'high',
                    message: `High disk usage on ${disk.filesystem}: ${disk.percentage.toFixed(1)}%`,
                    details: disk,
                    timestamp: metrics.timestamp
                });
            }
        }
        // Process count check
        if (metrics.processes.length > (this.config.processCountThreshold || 500)) {
            issues.push({
                type: 'process',
                severity: 'medium',
                message: `High process count: ${metrics.processes.length}`,
                details: { count: metrics.processes.length },
                timestamp: metrics.timestamp
            });
        }
        // Zombie process check
        const zombieProcesses = metrics.processes.filter(p => p.zombie);
        if (zombieProcesses.length > 0) {
            issues.push({
                type: 'process',
                severity: 'medium',
                message: `Found ${zombieProcesses.length} zombie processes`,
                details: { zombies: zombieProcesses.map(p => ({ pid: p.pid, name: p.name })) },
                timestamp: metrics.timestamp
            });
        }
        return issues;
    }
    /**
     * Generate comprehensive health report
     */
    async generateHealthReport() {
        const currentMetrics = await this.captureMetrics();
        const issues = await this.analyzeMetrics(currentMetrics);
        const resourceLeaks = await this.detectResourceLeaks();
        const performanceIssues = await this.detectPerformanceIssues();
        // Determine overall health
        let overall = 'healthy';
        if (issues.some(i => i.severity === 'critical') || resourceLeaks.some(l => l.severity === 'high')) {
            overall = 'critical';
        }
        else if (issues.length > 0 || resourceLeaks.length > 0 || performanceIssues.length > 0) {
            overall = 'warning';
        }
        // Generate recommendations
        const recommendations = this.generateRecommendations(issues, resourceLeaks, performanceIssues);
        return {
            timestamp: new Date(),
            overall,
            issues,
            metrics: currentMetrics,
            recommendations,
            resourceLeaks,
            performanceIssues
        };
    }
    /**
     * Detect resource leaks
     */
    async detectResourceLeaks() {
        const leaks = [];
        if (this.metricsHistory.length < 10) {
            return leaks; // Need more data
        }
        const recentMetrics = this.metricsHistory.slice(-10);
        // Memory leak detection
        const memoryTrend = recentMetrics.map(m => m.memory.percentage);
        if (this.isIncreasingTrend(memoryTrend, 5)) {
            leaks.push({
                type: 'memory',
                source: 'system',
                severity: 'medium',
                trend: memoryTrend,
                recommendation: 'Investigate processes with increasing memory usage'
            });
        }
        // Process leak detection
        const processCounts = recentMetrics.map(m => m.processes.length);
        if (this.isIncreasingTrend(processCounts, 10)) {
            leaks.push({
                type: 'process',
                source: 'system',
                severity: 'medium',
                trend: processCounts,
                recommendation: 'Check for processes that are not being properly terminated'
            });
        }
        return leaks;
    }
    /**
     * Detect performance issues
     */
    async detectPerformanceIssues() {
        const issues = [];
        if (this.metricsHistory.length < 5) {
            return issues;
        }
        const recentMetrics = this.metricsHistory.slice(-5);
        // CPU spike detection
        const avgCPU = recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length;
        if (avgCPU > 90) {
            issues.push({
                type: 'cpu-spike',
                component: 'system',
                impact: 'high',
                duration: recentMetrics.length * (this.config.monitoringInterval || 5000),
                details: { averageUsage: avgCPU, samples: recentMetrics.map(m => m.cpu.usage) }
            });
        }
        // Disk thrashing detection
        const diskIOSamples = recentMetrics
            .map(m => m.disk.io?.reads || 0)
            .filter(io => io > 0);
        if (diskIOSamples.length > 0) {
            const avgDiskIO = diskIOSamples.reduce((sum, io) => sum + io, 0) / diskIOSamples.length;
            if (avgDiskIO > 1000) { // Threshold for high disk activity
                issues.push({
                    type: 'disk-thrashing',
                    component: 'storage',
                    impact: 'medium',
                    duration: recentMetrics.length * (this.config.monitoringInterval || 5000),
                    details: { averageReads: avgDiskIO, samples: diskIOSamples }
                });
            }
        }
        return issues;
    }
    /**
     * Check if array shows increasing trend
     */
    isIncreasingTrend(values, threshold) {
        if (values.length < 3)
            return false;
        let increases = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i] > values[i - 1]) {
                increases++;
            }
        }
        return (increases / (values.length - 1)) * 100 > threshold;
    }
    /**
     * Generate recommendations based on issues
     */
    generateRecommendations(issues, leaks, performanceIssues) {
        const recommendations = [];
        // CPU recommendations
        if (issues.some(i => i.type === 'cpu')) {
            recommendations.push('Consider optimizing CPU-intensive operations or reducing concurrent processes');
        }
        // Memory recommendations
        if (issues.some(i => i.type === 'memory') || leaks.some(l => l.type === 'memory')) {
            recommendations.push('Monitor application memory usage and implement garbage collection optimizations');
        }
        // Disk recommendations
        if (issues.some(i => i.type === 'disk')) {
            recommendations.push('Clean up temporary files and consider increasing available disk space');
        }
        // Process recommendations
        if (issues.some(i => i.type === 'process' && i.message.includes('zombie'))) {
            recommendations.push('Implement proper process cleanup to prevent zombie processes');
        }
        // Performance recommendations
        if (performanceIssues.some(p => p.type === 'cpu-spike')) {
            recommendations.push('Investigate and optimize high CPU usage patterns during test execution');
        }
        if (performanceIssues.some(p => p.type === 'disk-thrashing')) {
            recommendations.push('Reduce disk I/O operations or implement caching mechanisms');
        }
        return recommendations;
    }
    /**
     * Kill zombie processes
     */
    async killZombieProcesses() {
        try {
            const currentMetrics = await this.captureMetrics();
            const zombies = currentMetrics.processes.filter(p => p.zombie);
            for (const zombie of zombies) {
                try {
                    process.kill(zombie.pid, 'SIGKILL');
                    this.logger.info(`Killed zombie process: ${zombie.name} (PID: ${zombie.pid})`);
                }
                catch (error) {
                    this.logger.warn(`Failed to kill zombie process ${zombie.pid}`, { error });
                }
            }
            // Also kill processes matching name patterns
            const { processNamePatterns } = this.config.cleanup || {};
            if (processNamePatterns) {
                const processesToKill = currentMetrics.processes.filter(p => processNamePatterns.some(pattern => p.name.match(pattern)));
                for (const proc of processesToKill) {
                    try {
                        process.kill(proc.pid, 'SIGTERM');
                        this.logger.info(`Terminated process: ${proc.name} (PID: ${proc.pid})`);
                    }
                    catch (error) {
                        this.logger.warn(`Failed to terminate process ${proc.pid}`, { error });
                    }
                }
            }
        }
        catch (error) {
            this.logger.error('Failed to kill zombie processes', { error });
        }
    }
    /**
     * Clean temporary files
     */
    async cleanTempFiles() {
        try {
            const { tempDirPatterns } = this.config.cleanup || {};
            if (!tempDirPatterns) {
                return;
            }
            for (const pattern of tempDirPatterns) {
                try {
                    // Use glob to find matching files/directories
                    const glob = require('glob');
                    const matches = glob.sync(pattern);
                    for (const match of matches) {
                        try {
                            const stat = await fs.stat(match);
                            if (stat.isDirectory()) {
                                await fs.rmdir(match, { recursive: true });
                                this.logger.info(`Removed temporary directory: ${match}`);
                            }
                            else {
                                await fs.unlink(match);
                                this.logger.info(`Removed temporary file: ${match}`);
                            }
                        }
                        catch (error) {
                            this.logger.warn(`Failed to remove ${match}`, { error });
                        }
                    }
                }
                catch (error) {
                    this.logger.warn(`Failed to process pattern ${pattern}`, { error });
                }
            }
        }
        catch (error) {
            this.logger.error('Failed to clean temporary files', { error });
        }
    }
    /**
     * Get current system health status
     */
    async getSystemHealth() {
        const metrics = await this.captureMetrics();
        const issues = await this.analyzeMetrics(metrics);
        if (issues.some(i => i.severity === 'critical')) {
            return 'critical';
        }
        else if (issues.length > 0) {
            return 'warning';
        }
        else {
            return 'healthy';
        }
    }
    /**
     * Get metrics history
     */
    getMetricsHistory() {
        return [...this.metricsHistory];
    }
    /**
     * Get file system changes
     */
    getFileSystemChanges() {
        return [...this.fileSystemChanges];
    }
    /**
     * Get performance baseline
     */
    getPerformanceBaseline() {
        return this.performanceBaseline;
    }
}
exports.SystemAgent = SystemAgent;
/**
 * Factory function to create a SystemAgent
 */
function createSystemAgent(config) {
    return new SystemAgent(config);
}
//# sourceMappingURL=SystemAgent.js.map