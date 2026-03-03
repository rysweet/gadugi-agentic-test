/**
 * SystemAgent - Thin orchestrator composing system monitoring sub-modules
 */
import { EventEmitter } from 'events';
import { IAgent, AgentType } from './index';
import { SystemAgentConfig, SystemMetrics, SystemHealthReport, PerformanceBaseline, FileSystemChange } from './system/types';
export type { SystemAgentConfig, SystemMetrics, DiskUsage, DiskIO, NetworkInterface, ProcessInfo, DockerInfo, SystemHealthReport, SystemIssue, ResourceLeak, PerformanceIssue, FileSystemChange, PerformanceBaseline, } from './system/types';
export { defaultSystemAgentConfig } from './system/types';
export declare class SystemAgent extends EventEmitter implements IAgent {
    readonly name = "SystemAgent";
    readonly type = AgentType.SYSTEM;
    private config;
    private logger;
    private monitoringInterval;
    private baselineCaptureInterval;
    private isMonitoring;
    private metricsHistory;
    private performanceBaseline;
    private readonly maxHistorySize;
    private metricsCollector;
    private dockerMonitor;
    private fsWatcher;
    private analyzer;
    constructor(config?: Partial<SystemAgentConfig>);
    initialize(): Promise<void>;
    execute(scenario: {
        name?: string;
        timeout?: number;
    } | null): Promise<SystemHealthReport>;
    cleanup(): Promise<void>;
    startMonitoring(): Promise<void>;
    stopMonitoring(): Promise<void>;
    captureMetrics(): Promise<SystemMetrics>;
    generateHealthReport(): Promise<SystemHealthReport>;
    getSystemHealth(): Promise<'healthy' | 'warning' | 'critical'>;
    getMetricsHistory(): SystemMetrics[];
    getFileSystemChanges(): FileSystemChange[];
    getPerformanceBaseline(): PerformanceBaseline | undefined;
    private startBaselineCapture;
    private killZombieProcesses;
    private cleanTempFiles;
}
/** Factory function to create a SystemAgent */
export declare function createSystemAgent(config?: Partial<SystemAgentConfig>): SystemAgent;
//# sourceMappingURL=SystemAgent.d.ts.map