/**
 * SystemAnalyzer - Analysis, leak detection, and health reporting
 *
 * Provides analyzeMetrics(), detectResourceLeaks(), detectPerformanceIssues(),
 * and generateRecommendations().
 */

import { TestLogger } from '../../utils/logger';
import {
  SystemAgentConfig,
  SystemMetrics,
  SystemIssue,
  ResourceLeak,
  PerformanceIssue,
} from './types';

export class SystemAnalyzer {
  constructor(private readonly logger: TestLogger) {}

  /**
   * Analyze metrics for threshold-based issues
   */
  async analyzeMetrics(
    metrics: SystemMetrics,
    config: SystemAgentConfig
  ): Promise<SystemIssue[]> {
    const issues: SystemIssue[] = [];

    // CPU usage check
    if (metrics.cpu.usage > (config.cpuThreshold || 80)) {
      issues.push({
        type: 'cpu',
        severity: metrics.cpu.usage > 95 ? 'critical' : 'high',
        message: `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        details: {
          usage: metrics.cpu.usage,
          loadAverage: metrics.cpu.loadAverage,
        },
        timestamp: metrics.timestamp,
      });
    }

    // Memory usage check
    if (metrics.memory.percentage > (config.memoryThreshold || 85)) {
      issues.push({
        type: 'memory',
        severity: metrics.memory.percentage > 95 ? 'critical' : 'high',
        message: `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
        details: {
          percentage: metrics.memory.percentage,
          used: metrics.memory.used,
          total: metrics.memory.total,
        },
        timestamp: metrics.timestamp,
      });
    }

    // Disk usage check
    for (const disk of metrics.disk.usage) {
      if (disk.percentage > (config.diskThreshold || 90)) {
        issues.push({
          type: 'disk',
          severity: disk.percentage > 98 ? 'critical' : 'high',
          message: `High disk usage on ${disk.filesystem}: ${disk.percentage.toFixed(1)}%`,
          details: disk,
          timestamp: metrics.timestamp,
        });
      }
    }

    // Process count check
    if (
      metrics.processes.length > (config.processCountThreshold || 500)
    ) {
      issues.push({
        type: 'process',
        severity: 'medium',
        message: `High process count: ${metrics.processes.length}`,
        details: { count: metrics.processes.length },
        timestamp: metrics.timestamp,
      });
    }

    // Zombie process check
    const zombieProcesses = metrics.processes.filter((p) => p.zombie);
    if (zombieProcesses.length > 0) {
      issues.push({
        type: 'process',
        severity: 'medium',
        message: `Found ${zombieProcesses.length} zombie processes`,
        details: {
          zombies: zombieProcesses.map((p) => ({ pid: p.pid, name: p.name })),
        },
        timestamp: metrics.timestamp,
      });
    }

    return issues;
  }

  /**
   * Detect resource leaks from historical metrics
   */
  async detectResourceLeaks(
    metricsHistory: SystemMetrics[]
  ): Promise<ResourceLeak[]> {
    const leaks: ResourceLeak[] = [];

    if (metricsHistory.length < 10) {
      return leaks; // Need more data
    }

    const recentMetrics = metricsHistory.slice(-10);

    // Memory leak detection
    const memoryTrend = recentMetrics.map((m) => m.memory.percentage);
    if (this.isIncreasingTrend(memoryTrend, 5)) {
      leaks.push({
        type: 'memory',
        source: 'system',
        severity: 'medium',
        trend: memoryTrend,
        recommendation:
          'Investigate processes with increasing memory usage',
      });
    }

    // Process leak detection
    const processCounts = recentMetrics.map((m) => m.processes.length);
    if (this.isIncreasingTrend(processCounts, 10)) {
      leaks.push({
        type: 'process',
        source: 'system',
        severity: 'medium',
        trend: processCounts,
        recommendation:
          'Check for processes that are not being properly terminated',
      });
    }

    return leaks;
  }

  /**
   * Detect performance issues from historical metrics
   */
  async detectPerformanceIssues(
    metricsHistory: SystemMetrics[],
    config: SystemAgentConfig
  ): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    if (metricsHistory.length < 5) {
      return issues;
    }

    const recentMetrics = metricsHistory.slice(-5);

    // CPU spike detection
    const avgCPU =
      recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) /
      recentMetrics.length;
    if (avgCPU > 90) {
      issues.push({
        type: 'cpu-spike',
        component: 'system',
        impact: 'high',
        duration:
          recentMetrics.length * (config.monitoringInterval || 5000),
        details: {
          averageUsage: avgCPU,
          samples: recentMetrics.map((m) => m.cpu.usage),
        },
      });
    }

    // Disk thrashing detection
    const diskIOSamples = recentMetrics
      .map((m) => m.disk.io?.reads || 0)
      .filter((io) => io > 0);

    if (diskIOSamples.length > 0) {
      const avgDiskIO =
        diskIOSamples.reduce((sum, io) => sum + io, 0) /
        diskIOSamples.length;
      if (avgDiskIO > 1000) {
        // Threshold for high disk activity
        issues.push({
          type: 'disk-thrashing',
          component: 'storage',
          impact: 'medium',
          duration:
            recentMetrics.length * (config.monitoringInterval || 5000),
          details: { averageReads: avgDiskIO, samples: diskIOSamples },
        });
      }
    }

    return issues;
  }

  /**
   * Generate recommendations based on detected issues
   */
  generateRecommendations(
    issues: SystemIssue[],
    leaks: ResourceLeak[],
    performanceIssues: PerformanceIssue[]
  ): string[] {
    const recommendations: string[] = [];

    // CPU recommendations
    if (issues.some((i) => i.type === 'cpu')) {
      recommendations.push(
        'Consider optimizing CPU-intensive operations or reducing concurrent processes'
      );
    }

    // Memory recommendations
    if (
      issues.some((i) => i.type === 'memory') ||
      leaks.some((l) => l.type === 'memory')
    ) {
      recommendations.push(
        'Monitor application memory usage and implement garbage collection optimizations'
      );
    }

    // Disk recommendations
    if (issues.some((i) => i.type === 'disk')) {
      recommendations.push(
        'Clean up temporary files and consider increasing available disk space'
      );
    }

    // Process recommendations
    if (
      issues.some(
        (i) => i.type === 'process' && i.message.includes('zombie')
      )
    ) {
      recommendations.push(
        'Implement proper process cleanup to prevent zombie processes'
      );
    }

    // Performance recommendations
    if (performanceIssues.some((p) => p.type === 'cpu-spike')) {
      recommendations.push(
        'Investigate and optimize high CPU usage patterns during test execution'
      );
    }

    if (performanceIssues.some((p) => p.type === 'disk-thrashing')) {
      recommendations.push(
        'Reduce disk I/O operations or implement caching mechanisms'
      );
    }

    return recommendations;
  }

  /**
   * Check if array shows an increasing trend
   */
  private isIncreasingTrend(values: number[], threshold: number): boolean {
    if (values.length < 3) return false;

    let increases = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) {
        increases++;
      }
    }

    return ((increases / (values.length - 1)) * 100) > threshold;
  }
}
