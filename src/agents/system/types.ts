/**
 * Shared types for SystemAgent sub-modules
 *
 * All interfaces that were previously defined in SystemAgent.ts are
 * re-exported from here so each sub-module can import them without
 * circular dependencies.
 */

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
export const defaultSystemAgentConfig: SystemAgentConfig = {
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
