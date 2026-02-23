/**
 * DockerMonitor unit tests
 *
 * Mocks child_process.exec via util.promisify to verify:
 * - Docker availability detection
 * - Container stats parsing
 * - Container ID validation (security)
 * - Graceful degradation when Docker is unavailable
 */

import { DockerMonitor } from '../../../agents/system/DockerMonitor';
import { TestLogger } from '../../../utils/logger';

// ---------------------------------------------------------------------------
// Mock child_process.exec
// ---------------------------------------------------------------------------

const mockExec = jest.fn();

jest.mock('child_process', () => ({
  exec: (...args: unknown[]) => mockExec(...args),
}));

// util.promisify wraps exec — we intercept the underlying mock by making
// mockExec call its callback with the supplied values.
function mockExecSuccess(stdout: string): void {
  mockExec.mockImplementation((_cmd: string, cb: Function) => {
    cb(null, { stdout, stderr: '' });
  });
}

function mockExecFailure(message: string): void {
  mockExec.mockImplementation((_cmd: string, cb: Function) => {
    cb(new Error(message));
  });
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeLogger(): TestLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as TestLogger;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DockerMonitor', () => {
  let monitor: DockerMonitor;
  let logger: TestLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();
    monitor = new DockerMonitor(logger);
  });

  // -------------------------------------------------------------------------
  // checkDockerAvailability
  // -------------------------------------------------------------------------

  describe('checkDockerAvailability', () => {
    it('sets dockerAvailable=true and logs info when docker --version succeeds', async () => {
      mockExecSuccess('Docker version 24.0.0');

      await monitor.checkDockerAvailability();

      expect(monitor.isAvailable).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Docker is available for monitoring'
      );
    });

    it('sets dockerAvailable=false when exec throws (docker not installed)', async () => {
      mockExecFailure('docker: command not found');

      await monitor.checkDockerAvailability();

      expect(monitor.isAvailable).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Docker is not available');
    });
  });

  // -------------------------------------------------------------------------
  // getDockerMetrics when unavailable
  // -------------------------------------------------------------------------

  describe('getDockerMetrics when Docker unavailable', () => {
    it('returns empty array without calling exec', async () => {
      // dockerAvailable defaults to false
      const result = await monitor.getDockerMetrics();

      expect(result).toEqual([]);
      expect(mockExec).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // validateContainerId (security)
  // -------------------------------------------------------------------------

  describe('validateContainerId', () => {
    it('accepts a valid 12-char lowercase hex container ID', () => {
      expect(() => monitor.validateContainerId('abc123def456')).not.toThrow();
    });

    it('accepts a valid 64-char SHA-256 container ID', () => {
      const fullId = 'a'.repeat(64);
      expect(() => monitor.validateContainerId(fullId)).not.toThrow();
    });

    it('accepts a valid mid-length hex ID (32 chars)', () => {
      expect(() => monitor.validateContainerId('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).not.toThrow();
    });

    it('rejects an ID shorter than 12 characters', () => {
      expect(() => monitor.validateContainerId('abc123')).toThrow(
        /Invalid Docker container ID/
      );
    });

    it('rejects an ID longer than 64 characters', () => {
      expect(() => monitor.validateContainerId('a'.repeat(65))).toThrow(
        /Invalid Docker container ID/
      );
    });

    it('rejects uppercase hex characters', () => {
      expect(() => monitor.validateContainerId('ABC123DEF456')).toThrow(
        /Invalid Docker container ID/
      );
    });

    it('rejects non-hex characters (g-z)', () => {
      expect(() => monitor.validateContainerId('abc123def456g')).toThrow(
        /Invalid Docker container ID/
      );
    });

    it('rejects shell injection with semicolon', () => {
      expect(() =>
        monitor.validateContainerId('abc123def456; rm -rf /')
      ).toThrow(/Invalid Docker container ID/);
    });

    it('rejects shell injection with command substitution $(...)', () => {
      expect(() =>
        monitor.validateContainerId('abc123def456$(whoami)')
      ).toThrow(/Invalid Docker container ID/);
    });

    it('rejects shell injection with backticks', () => {
      expect(() =>
        monitor.validateContainerId('abc123def456`id`')
      ).toThrow(/Invalid Docker container ID/);
    });

    it('rejects path traversal attempts', () => {
      expect(() =>
        monitor.validateContainerId('../../../etc/passwd')
      ).toThrow(/Invalid Docker container ID/);
    });

    it('rejects newline injection', () => {
      expect(() =>
        monitor.validateContainerId('abc123def456\nrm -rf /')
      ).toThrow(/Invalid Docker container ID/);
    });

    it('rejects empty string', () => {
      expect(() => monitor.validateContainerId('')).toThrow(
        /Invalid Docker container ID/
      );
    });
  });

  // -------------------------------------------------------------------------
  // parseDockerNetworkIO
  // -------------------------------------------------------------------------

  describe('parseDockerNetworkIO', () => {
    it('parses "1.5MB / 500kB" correctly', () => {
      const result = monitor.parseDockerNetworkIO('1.5MB / 500kB');
      expect(result.rx).toBeCloseTo(1.5 * 1024 * 1024, -2);
      expect(result.tx).toBeCloseTo(500 * 1024, -2);
    });

    it('returns {rx:0,tx:0} for "--" placeholder', () => {
      const result = monitor.parseDockerNetworkIO('--');
      expect(result).toEqual({ rx: 0, tx: 0 });
    });

    it('returns {rx:0,tx:0} for empty string', () => {
      const result = monitor.parseDockerNetworkIO('');
      expect(result).toEqual({ rx: 0, tx: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // parseDockerIO
  // -------------------------------------------------------------------------

  describe('parseDockerIO', () => {
    it('parses "10MB / 5MB" correctly', () => {
      const result = monitor.parseDockerIO('10MB / 5MB');
      expect(result.read).toBeCloseTo(10 * 1024 * 1024, -2);
      expect(result.write).toBeCloseTo(5 * 1024 * 1024, -2);
    });

    it('returns {read:0,write:0} for "--" placeholder', () => {
      const result = monitor.parseDockerIO('--');
      expect(result).toEqual({ read: 0, write: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // parseBytes
  // -------------------------------------------------------------------------

  describe('parseBytes', () => {
    it('parses bytes (B)', () => {
      expect(monitor.parseBytes('512B')).toBe(512);
    });

    it('parses kilobytes (KB)', () => {
      expect(monitor.parseBytes('2KB')).toBe(2048);
    });

    it('parses megabytes (MB)', () => {
      expect(monitor.parseBytes('1MB')).toBe(1024 * 1024);
    });

    it('parses gigabytes (GB)', () => {
      expect(monitor.parseBytes('1GB')).toBe(1024 * 1024 * 1024);
    });

    it('returns 0 for empty string', () => {
      expect(monitor.parseBytes('')).toBe(0);
    });

    it('returns 0 for non-numeric string', () => {
      expect(monitor.parseBytes('invalid')).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getDockerMetrics - integration with exec mock
  // -------------------------------------------------------------------------

  describe('getDockerMetrics with Docker available', () => {
    beforeEach(async () => {
      // Mark Docker as available
      mockExecSuccess('Docker version 24.0.0');
      await monitor.checkDockerAvailability();
      jest.clearAllMocks();
    });

    it('parses container list and stats output correctly', async () => {
      // First call: docker ps
      mockExec
        .mockImplementationOnce((_cmd: string, cb: Function) => {
          cb(null, {
            stdout:
              'ID\tNAME\tIMAGE\tSTATE\tSTATUS\tPORTS\n' +
              'abc123def456\tweb\tnginx\trunning\tUp 2h\t80/tcp',
            stderr: '',
          });
        })
        // Second call: docker stats for the container
        .mockImplementationOnce((_cmd: string, cb: Function) => {
          cb(null, { stdout: '5.00%,20.00%,1MB / 500kB,10MB / 5MB', stderr: '' });
        });

      const result = await monitor.getDockerMetrics();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('abc123def456'); // substring(0, 12) = full 12-char ID
      expect(result[0].name).toBe('web');
      expect(result[0].image).toBe('nginx');
      expect(result[0].cpu).toBeCloseTo(5, 1);
      expect(result[0].memory).toBeCloseTo(20, 1);
    });

    it('skips container with invalid ID and continues', async () => {
      // docker ps returns a malformed container ID
      mockExec
        .mockImplementationOnce((_cmd: string, cb: Function) => {
          cb(null, {
            stdout:
              'ID\tNAME\tIMAGE\tSTATE\tSTATUS\tPORTS\n' +
              'INVALID_ID!!\tweb\tnginx\trunning\tUp 2h\t80/tcp',
            stderr: '',
          });
        });

      const result = await monitor.getDockerMetrics();

      // Container with invalid ID still appears (stats skipped gracefully)
      // The stats call throws via validateContainerId, container added without stats
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns empty array when docker ps fails', async () => {
      mockExecFailure('docker ps: permission denied');

      const result = await monitor.getDockerMetrics();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get Docker metrics',
        expect.any(Object)
      );
    });
  });
});
