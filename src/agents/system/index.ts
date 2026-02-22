/**
 * System sub-module barrel export
 *
 * Re-exports all sub-module classes and shared types so they can be
 * consumed by the main SystemAgent orchestrator.
 */

export { MetricsCollector } from './MetricsCollector';
export { DockerMonitor } from './DockerMonitor';
export { FileSystemWatcher } from './FileSystemWatcher';
export { SystemAnalyzer } from './SystemAnalyzer';

// Re-export all shared types and the default config
export type {
  SystemAgentConfig,
  SystemMetrics,
  DiskUsage,
  DiskIO,
  NetworkInterface,
  ProcessInfo,
  DockerInfo,
  SystemHealthReport,
  SystemIssue,
  ResourceLeak,
  PerformanceIssue,
  FileSystemChange,
  PerformanceBaseline,
} from './types';
export { defaultSystemAgentConfig } from './types';
