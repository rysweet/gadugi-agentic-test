/**
 * DockerMonitor unit tests.
 *
 * All child_process.exec calls are mocked so no Docker daemon is required.
 * Tests focus on:
 *   - parseBytes:           byte-string → number conversion for all SI suffixes
 *   - parseDockerNetworkIO: network I/O string parsing
 *   - parseDockerIO:        block I/O string parsing
 *   - getDockerMetrics:     full metrics retrieval, multiple containers, unavailable docker
 *   - validateContainerId:  security — rejects invalid / injection IDs
 *   - checkDockerAvailability: marks docker available/unavailable
 */

// ---------------------------------------------------------------------------
// Mock child_process BEFORE imports so the module-level promisify captures our mock
// ---------------------------------------------------------------------------

const mockExecImpl = jest.fn();

jest.mock('child_process', () => ({
  exec: (...args: unknown[]) => {
    // exec uses a callback: exec(cmd, callback)
    // promisify wraps it, so we simulate callback-style by using the mock
    return mockExecImpl(...args);
  },
}));

// Override promisify so that when DockerMonitor calls promisify(exec),
// it gets a function that delegates to mockExecAsync (our Promise mock).
const mockExecAsync = jest.fn();

jest.mock('util', () => {
  const actual = jest.requireActual<typeof import('util')>('util');
  return {
    ...actual,
    promisify: (_fn: unknown) => mockExecAsync,
  };
});

// ---------------------------------------------------------------------------
// Logger mock
// ---------------------------------------------------------------------------

const mockLogger = {
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../utils/logger', () => ({
  logger: mockLogger,
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { DockerMonitor } from '../../agents/system/DockerMonitor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMonitor(available = false): DockerMonitor {
  const monitor = new DockerMonitor(mockLogger as any);
  (monitor as any).dockerAvailable = available;
  return monitor;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// parseBytes
// ===========================================================================
describe('DockerMonitor.parseBytes', () => {
  let monitor: DockerMonitor;
  beforeEach(() => { monitor = makeMonitor(); });

  it('parses bytes (B suffix)', () => {
    expect(monitor.parseBytes('512B')).toBe(512);
  });

  it('parses kilobytes (kB)', () => {
    expect(monitor.parseBytes('1kB')).toBe(1024);
  });

  it('parses kilobytes (KB)', () => {
    expect(monitor.parseBytes('2KB')).toBe(2 * 1024);
  });

  it('parses megabytes (MB)', () => {
    expect(monitor.parseBytes('1MB')).toBe(1024 * 1024);
  });

  it('parses gigabytes (GB)', () => {
    expect(monitor.parseBytes('1GB')).toBe(1024 * 1024 * 1024);
  });

  it('parses terabytes (TB)', () => {
    expect(monitor.parseBytes('1TB')).toBe(1024 * 1024 * 1024 * 1024);
  });

  it('parses decimal values (1.5 MB)', () => {
    expect(monitor.parseBytes('1.5MB')).toBeCloseTo(1.5 * 1024 * 1024);
  });

  it('returns 0 for empty string', () => {
    expect(monitor.parseBytes('')).toBe(0);
  });

  it('returns 0 for unrecognisable format', () => {
    expect(monitor.parseBytes('not-a-size')).toBe(0);
  });

  it('handles lowercase suffixes (mb)', () => {
    expect(monitor.parseBytes('2mb')).toBeCloseTo(2 * 1024 * 1024);
  });
});

// ===========================================================================
// parseDockerNetworkIO
// ===========================================================================
describe('DockerMonitor.parseDockerNetworkIO', () => {
  let monitor: DockerMonitor;
  beforeEach(() => { monitor = makeMonitor(); });

  it('parses "1kB / 2kB" into rx and tx bytes', () => {
    const result = monitor.parseDockerNetworkIO('1kB / 2kB');
    expect(result.rx).toBe(1024);
    expect(result.tx).toBe(2048);
  });

  it('parses MB values', () => {
    const result = monitor.parseDockerNetworkIO('10MB / 5MB');
    expect(result.rx).toBe(10 * 1024 * 1024);
    expect(result.tx).toBe(5 * 1024 * 1024);
  });

  it('parses GB values', () => {
    const result = monitor.parseDockerNetworkIO('1GB / 512MB');
    expect(result.rx).toBe(1024 * 1024 * 1024);
    expect(result.tx).toBe(512 * 1024 * 1024);
  });

  it('returns { rx: 0, tx: 0 } for "--"', () => {
    expect(monitor.parseDockerNetworkIO('--')).toEqual({ rx: 0, tx: 0 });
  });

  it('returns { rx: 0, tx: 0 } for empty string', () => {
    expect(monitor.parseDockerNetworkIO('')).toEqual({ rx: 0, tx: 0 });
  });

  it('returns { rx: 0, tx: 0 } for undefined-like value', () => {
    expect(monitor.parseDockerNetworkIO(undefined as any)).toEqual({ rx: 0, tx: 0 });
  });
});

// ===========================================================================
// parseDockerIO (block I/O)
// ===========================================================================
describe('DockerMonitor.parseDockerIO', () => {
  let monitor: DockerMonitor;
  beforeEach(() => { monitor = makeMonitor(); });

  it('parses block I/O with kB suffixes', () => {
    const result = monitor.parseDockerIO('4kB / 8kB');
    expect(result.read).toBe(4 * 1024);
    expect(result.write).toBe(8 * 1024);
  });

  it('parses block I/O with MB suffixes', () => {
    const result = monitor.parseDockerIO('100MB / 200MB');
    expect(result.read).toBe(100 * 1024 * 1024);
    expect(result.write).toBe(200 * 1024 * 1024);
  });

  it('parses block I/O with GB suffixes', () => {
    const result = monitor.parseDockerIO('2GB / 1GB');
    expect(result.read).toBe(2 * 1024 * 1024 * 1024);
    expect(result.write).toBe(1 * 1024 * 1024 * 1024);
  });

  it('returns { read: 0, write: 0 } for "--"', () => {
    expect(monitor.parseDockerIO('--')).toEqual({ read: 0, write: 0 });
  });

  it('returns { read: 0, write: 0 } for empty string', () => {
    expect(monitor.parseDockerIO('')).toEqual({ read: 0, write: 0 });
  });
});

// ===========================================================================
// validateContainerId — security
// ===========================================================================
describe('DockerMonitor.validateContainerId', () => {
  let monitor: DockerMonitor;
  beforeEach(() => { monitor = makeMonitor(); });

  it('accepts a valid 12-character hex short ID', () => {
    expect(() => monitor.validateContainerId('abc123def456')).not.toThrow();
  });

  it('accepts a valid 64-character hex full digest', () => {
    const fullId = 'a'.repeat(64);
    expect(() => monitor.validateContainerId(fullId)).not.toThrow();
  });

  it('rejects an ID shorter than 12 characters', () => {
    expect(() => monitor.validateContainerId('abc123')).toThrow('Invalid Docker container ID');
  });

  it('rejects an ID longer than 64 characters', () => {
    expect(() => monitor.validateContainerId('a'.repeat(65))).toThrow('Invalid Docker container ID');
  });

  it('rejects an ID with uppercase letters', () => {
    expect(() => monitor.validateContainerId('ABC123DEF456')).toThrow('Invalid Docker container ID');
  });

  it('rejects an ID with shell metacharacters (injection attempt)', () => {
    expect(() => monitor.validateContainerId('abc123; rm -rf /')).toThrow('Invalid Docker container ID');
  });

  it('rejects an ID with backtick (injection attempt)', () => {
    expect(() => monitor.validateContainerId('abc123`id`abc')).toThrow('Invalid Docker container ID');
  });
});

// ===========================================================================
// checkDockerAvailability
// ===========================================================================
describe('DockerMonitor.checkDockerAvailability', () => {
  it('sets dockerAvailable=true when "docker --version" succeeds', async () => {
    mockExecAsync.mockResolvedValue({ stdout: 'Docker version 24.0.0', stderr: '' });

    const monitor = makeMonitor(false);
    await monitor.checkDockerAvailability();

    expect(monitor.isAvailable).toBe(true);
  });

  it('sets dockerAvailable=false when "docker --version" throws', async () => {
    mockExecAsync.mockRejectedValue(new Error('docker: not found'));

    const monitor = makeMonitor(false);
    await monitor.checkDockerAvailability();

    expect(monitor.isAvailable).toBe(false);
  });
});

// ===========================================================================
// getDockerMetrics — docker unavailable
// ===========================================================================
describe('DockerMonitor.getDockerMetrics when Docker is unavailable', () => {
  it('returns an empty array without throwing', async () => {
    const monitor = makeMonitor(false);
    const metrics = await monitor.getDockerMetrics();

    expect(Array.isArray(metrics)).toBe(true);
    expect(metrics).toHaveLength(0);
    expect(mockExecAsync).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// getDockerMetrics — docker available
// ===========================================================================
describe('DockerMonitor.getDockerMetrics with running containers', () => {
  const containerLine = (id: string, name: string) =>
    `${id}\t${name}\tnginx:latest\trunning\tUp 2 hours\t80/tcp`;

  it('returns stats for a single container with kB I/O', async () => {
    const id = 'abc123def4561'; // 13 valid hex chars
    const header = 'ID\tNAMES\tIMAGE\tSTATE\tSTATUS\tPORTS';
    mockExecAsync
      .mockResolvedValueOnce({ stdout: `${header}\n${containerLine(id, 'web')}`, stderr: '' })
      .mockResolvedValueOnce({ stdout: '10.5%,25.3%,512kB / 1MB,4kB / 8kB', stderr: '' });

    const monitor = makeMonitor(true);
    const metrics = await monitor.getDockerMetrics();

    expect(metrics).toHaveLength(1);
    expect(metrics[0].id).toBe(id.substring(0, 12));
    expect(metrics[0].name).toBe('web');
    expect(metrics[0].cpu).toBeCloseTo(10.5);
    expect(metrics[0].memory).toBeCloseTo(25.3);
    expect(metrics[0].networkIO?.rx).toBe(512 * 1024);
    expect(metrics[0].blockIO?.read).toBe(4 * 1024);
  });

  it('returns stats for multiple containers', async () => {
    const id1 = 'aabbccddeeff'; // 12 hex chars
    const id2 = 'bbccddeeff00'; // 12 hex chars
    const header = 'ID\tNAMES\tIMAGE\tSTATE\tSTATUS\tPORTS';
    const psOutput = `${header}\n${containerLine(id1, 'web')}\n${containerLine(id2, 'db')}`;

    mockExecAsync
      .mockResolvedValueOnce({ stdout: psOutput, stderr: '' })
      .mockResolvedValueOnce({ stdout: '5%,10%,1MB / 2MB,100kB / 200kB', stderr: '' })
      .mockResolvedValueOnce({ stdout: '2%,5%,512kB / 1MB,50kB / 100kB', stderr: '' });

    const monitor = makeMonitor(true);
    const metrics = await monitor.getDockerMetrics();

    expect(metrics).toHaveLength(2);
    expect(metrics[0].name).toBe('web');
    expect(metrics[1].name).toBe('db');
  });

  it('includes container with zero stats when docker stats fails for that container', async () => {
    const id = 'abc123def456'; // 12 hex chars — valid
    const header = 'ID\tNAMES\tIMAGE\tSTATE\tSTATUS\tPORTS';
    mockExecAsync
      .mockResolvedValueOnce({ stdout: `${header}\n${containerLine(id, 'web')}`, stderr: '' })
      .mockRejectedValueOnce(new Error('stats failed'));

    const monitor = makeMonitor(true);
    const metrics = await monitor.getDockerMetrics();

    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('web');
    expect(metrics[0].cpu).toBe(0);
    expect(metrics[0].memory).toBe(0);
  });

  it('returns empty array (no throw) when docker ps itself fails', async () => {
    mockExecAsync.mockRejectedValue(new Error('docker ps: daemon not running'));

    const monitor = makeMonitor(true);
    const metrics = await monitor.getDockerMetrics();

    expect(metrics).toHaveLength(0);
  });

  it('returns empty array when docker ps returns only the header line', async () => {
    const header = 'ID\tNAMES\tIMAGE\tSTATE\tSTATUS\tPORTS\n';
    mockExecAsync.mockResolvedValueOnce({ stdout: header, stderr: '' });

    const monitor = makeMonitor(true);
    const metrics = await monitor.getDockerMetrics();

    expect(metrics).toHaveLength(0);
  });
});
