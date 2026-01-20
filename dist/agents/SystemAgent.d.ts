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
import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
/**
 * System monitoring configuration
 */
export interface SystemAgentConfig {
    /** Monitoring interval in milliseconds */
    monitoringInterval?: number;
    /** CPU usage threshold for alerts (percentage) */
    cpuThreshold?: number;
    /** Memory usage threshold for alerts (percentage) */
    memoryThreshold?: number;
    /** Disk usage threshold for alerts (percentage) */
    diskThreshold?: number;
    /** Maximum process count threshold */
    processCountThreshold?: number;
    /** Network monitoring configuration */
    networkMonitoring?: {
        enabled: boolean;
        interfaces: string[];
        bandwidth: boolean;
    };
    /** Docker monitoring configuration */
    dockerMonitoring?: {
        enabled: boolean;
        containerFilters: string[];
    };
    /** File system monitoring */
    fileSystemMonitoring?: {
        enabled: boolean;
        watchPaths: string[];
        excludePatterns: RegExp[];
    };
    /** Cleanup configuration */
    cleanup?: {
        killZombieProcesses: boolean;
        cleanTempFiles: boolean;
        tempDirPatterns: string[];
        processNamePatterns: string[];
    };
    /** Performance baseline configuration */
    performanceBaseline?: {
        captureBaseline: boolean;
        baselineDuration: number;
        comparisonThreshold: number;
    };
}
/**
 * System metrics data structure
 */
export interface SystemMetrics {
    timestamp: Date;
    cpu: {
        usage: number;
        loadAverage: number[];
        cores: number;
        temperature?: number;
    };
    memory: {
        total: number;
        free: number;
        used: number;
        percentage: number;
        available: number;
    };
    disk: {
        usage: DiskUsage[];
        io?: DiskIO;
    };
    network: {
        interfaces: NetworkInterface[];
        connections?: number;
    };
    processes: ProcessInfo[];
    docker?: DockerInfo[];
    system: {
        uptime: number;
        platform: string;
        arch: string;
        hostname: string;
    };
}
/**
 * Disk usage information
 */
export interface DiskUsage {
    filesystem: string;
    size: number;
    used: number;
    available: number;
    percentage: number;
    mountpoint: string;
}
/**
 * Disk I/O information
 */
export interface DiskIO {
    reads: number;
    writes: number;
    readBytes: number;
    writeBytes: number;
}
/**
 * Network interface information
 */
export interface NetworkInterface {
    name: string;
    rx: number;
    tx: number;
    rxBytes: number;
    txBytes: number;
    speed?: number;
}
/**
 * Process information
 */
export interface ProcessInfo {
    pid: number;
    name: string;
    command: string;
    cpu: number;
    memory: number;
    state: string;
    ppid?: number;
    uid?: number;
    gid?: number;
    priority?: number;
    nice?: number;
    threads?: number;
    startTime?: Date;
    zombie?: boolean;
}
/**
 * Docker container information
 */
export interface DockerInfo {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    ports: string[];
    cpu: number;
    memory: number;
    networkIO?: {
        rx: number;
        tx: number;
    };
    blockIO?: {
        read: number;
        write: number;
    };
}
/**
 * System health report
 */
export interface SystemHealthReport {
    timestamp: Date;
    overall: 'healthy' | 'warning' | 'critical';
    issues: SystemIssue[];
    metrics: SystemMetrics;
    recommendations: string[];
    resourceLeaks: ResourceLeak[];
    performanceIssues: PerformanceIssue[];
}
/**
 * System issue information
 */
export interface SystemIssue {
    type: 'cpu' | 'memory' | 'disk' | 'process' | 'network' | 'docker';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details: any;
    timestamp: Date;
}
/**
 * Resource leak information
 */
export interface ResourceLeak {
    type: 'memory' | 'file-descriptor' | 'process' | 'network';
    source: string;
    severity: 'low' | 'medium' | 'high';
    trend: number[];
    recommendation: string;
}
/**
 * Performance issue information
 */
export interface PerformanceIssue {
    type: 'cpu-spike' | 'memory-leak' | 'disk-thrashing' | 'network-congestion';
    component: string;
    impact: 'low' | 'medium' | 'high';
    duration: number;
    details: any;
}
/**
 * File system change information
 */
export interface FileSystemChange {
    path: string;
    type: 'created' | 'modified' | 'deleted';
    timestamp: Date;
    size?: number;
}
/**
 * Performance baseline data
 */
export interface PerformanceBaseline {
    timestamp: Date;
    duration: number;
    metrics: {
        avgCPU: number;
        avgMemory: number;
        avgDiskIO: number;
        avgNetworkIO: number;
        processCount: number;
    };
}
/**
 * Default configuration for SystemAgent
 */
declare const defaultSystemAgentConfig: SystemAgentConfig;
/**
 * SystemAgent implementation
 */
export declare class SystemAgent extends EventEmitter implements IAgent {
    readonly name = "SystemAgent";
    readonly type = AgentType.SYSTEM;
    private config;
    private logger;
    private monitoringInterval?;
    private isMonitoring;
    private metricsHistory;
    private fsWatchers;
    private fileSystemChanges;
    private performanceBaseline?;
    private initialMetrics?;
    private dockerAvailable;
    private readonly maxHistorySize;
    constructor(config?: Partial<SystemAgentConfig>);
    /**
     * Initialize the SystemAgent
     */
    initialize(): Promise<void>;
    /**
     * Execute system monitoring for a scenario
     */
    execute(scenario: any): Promise<SystemHealthReport>;
    /**
     * Cleanup resources and stop monitoring
     */
    cleanup(): Promise<void>;
    /**
     * Start continuous system monitoring
     */
    startMonitoring(): Promise<void>;
    /**
     * Stop continuous monitoring
     */
    stopMonitoring(): Promise<void>;
    /**
     * Capture comprehensive system metrics
     */
    captureMetrics(): Promise<SystemMetrics>;
    /**
     * Get CPU metrics
     */
    private getCPUMetrics;
    /**
     * Get memory metrics
     */
    private getMemoryMetrics;
    /**
     * Get disk metrics
     */
    private getDiskMetrics;
    /**
     * Get network metrics
     */
    private getNetworkMetrics;
    /**
     * Get process metrics
     */
    private getProcessMetrics;
    /**
     * Get system information
     */
    private getSystemInfo;
    /**
     * Get Docker container metrics
     */
    private getDockerMetrics;
    /**
     * Parse Docker network I/O stats
     */
    private parseDockerNetworkIO;
    /**
     * Parse Docker I/O stats
     */
    private parseDockerIO;
    /**
     * Parse byte string to number
     */
    private parseBytes;
    /**
     * Check Docker availability
     */
    private checkDockerAvailability;
    /**
     * Set up file system monitoring
     */
    private setupFileSystemMonitoring;
    /**
     * Capture performance baseline
     */
    private capturePerformanceBaseline;
    /**
     * Analyze metrics for issues
     */
    private analyzeMetrics;
    /**
     * Generate comprehensive health report
     */
    generateHealthReport(): Promise<SystemHealthReport>;
    /**
     * Detect resource leaks
     */
    private detectResourceLeaks;
    /**
     * Detect performance issues
     */
    private detectPerformanceIssues;
    /**
     * Check if array shows increasing trend
     */
    private isIncreasingTrend;
    /**
     * Generate recommendations based on issues
     */
    private generateRecommendations;
    /**
     * Kill zombie processes
     */
    private killZombieProcesses;
    /**
     * Clean temporary files
     */
    private cleanTempFiles;
    /**
     * Get current system health status
     */
    getSystemHealth(): Promise<'healthy' | 'warning' | 'critical'>;
    /**
     * Get metrics history
     */
    getMetricsHistory(): SystemMetrics[];
    /**
     * Get file system changes
     */
    getFileSystemChanges(): FileSystemChange[];
    /**
     * Get performance baseline
     */
    getPerformanceBaseline(): PerformanceBaseline | undefined;
}
/**
 * Factory function to create a SystemAgent
 */
export declare function createSystemAgent(config?: Partial<SystemAgentConfig>): SystemAgent;
export { defaultSystemAgentConfig };
//# sourceMappingURL=SystemAgent.d.ts.map