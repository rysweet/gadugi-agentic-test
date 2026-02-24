/**
 * DockerMonitor - Docker-specific monitoring using child_process
 *
 * Handles Docker container discovery, stats collection, and I/O parsing.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { TestLogger } from '../../utils/logger';
import { DockerInfo } from './types';

const execAsync = promisify(exec);

export class DockerMonitor {
  private dockerAvailable = false;

  constructor(private readonly logger: TestLogger) {}

  /**
   * Validate a Docker container ID before using it in a shell command.
   *
   * Docker container IDs are lowercase hexadecimal strings: 12 characters
   * (short form) or 64 characters (full SHA-256 digest). Any value that does
   * not match this pattern is rejected to prevent shell injection via
   * maliciously named containers.
   *
   * Security: Issue #98 (M-11) - shell injection via unvalidated container IDs.
   */
  validateContainerId(id: string): void {
    if (!/^[a-f0-9]{12,64}$/.test(id)) {
      throw new Error(`Invalid Docker container ID: ${id}`);
    }
  }

  /**
   * Whether Docker is currently available on the system
   */
  get isAvailable(): boolean {
    return this.dockerAvailable;
  }

  /**
   * Check Docker availability
   */
  async checkDockerAvailability(): Promise<void> {
    try {
      await execAsync('docker --version');
      this.dockerAvailable = true;
      this.logger.info('Docker is available for monitoring');
    } catch (_error) {
      this.dockerAvailable = false;
      this.logger.info('Docker is not available');
    }
  }

  /**
   * Get Docker container metrics
   */
  async getDockerMetrics(): Promise<DockerInfo[]> {
    if (!this.dockerAvailable) {
      return [];
    }

    try {
      const { stdout } = await execAsync(
        'docker ps --format "table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.State}}\\t{{.Status}}\\t{{.Ports}}"'
      );

      const lines = stdout.trim().split('\n').slice(1); // Skip header
      const containers: DockerInfo[] = [];

      for (const line of lines) {
        const [id, name, image, state, status, ports] = line.split('\t');

        try {
          // Validate container ID before interpolating into shell command.
          // Rejects any value that is not a 12-64 char lowercase hex string,
          // preventing shell injection via maliciously named containers (issue #98).
          this.validateContainerId(id);

          // Get container stats
          const { stdout: statsOutput } = await execAsync(
            `docker stats ${id} --no-stream --format "{{.CPUPerc}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}"`
          );

          const [cpuPerc, memPerc, netIO, blockIO] = statsOutput
            .trim()
            .split(',');

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
            blockIO: this.parseDockerIO(blockIO),
          });
        } catch (statsError) {
          // Add container without stats
          this.logger.debug(
            `Failed to get stats for container ${id.substring(0, 12)}`,
            { error: statsError }
          );
          containers.push({
            id: id.substring(0, 12),
            name,
            image,
            state,
            status,
            ports: ports ? ports.split(',') : [],
            cpu: 0,
            memory: 0,
          });
        }
      }

      return containers;
    } catch (error) {
      this.logger.error('Failed to get Docker metrics', { error });
      return [];
    }
  }

  /**
   * Parse Docker network I/O stats
   */
  parseDockerNetworkIO(ioString: string): { rx: number; tx: number } {
    if (!ioString || ioString === '--') {
      return { rx: 0, tx: 0 };
    }

    try {
      const [input, output] = ioString.split(' / ');
      const inputBytes = this.parseBytes(input);
      const outputBytes = this.parseBytes(output);

      return { rx: inputBytes, tx: outputBytes };
    } catch (error) {
      this.logger.warn('Failed to parse Docker network I/O', {
        error,
        raw: ioString,
      });
      return { rx: 0, tx: 0 };
    }
  }

  /**
   * Parse Docker I/O stats
   */
  parseDockerIO(ioString: string): { read: number; write: number } {
    if (!ioString || ioString === '--') {
      return { read: 0, write: 0 };
    }

    try {
      const [input, output] = ioString.split(' / ');
      const inputBytes = this.parseBytes(input);
      const outputBytes = this.parseBytes(output);

      return { read: inputBytes, write: outputBytes };
    } catch (error) {
      this.logger.warn('Failed to parse Docker block I/O', {
        error,
        raw: ioString,
      });
      return { read: 0, write: 0 };
    }
  }

  /**
   * Parse byte string to number
   */
  parseBytes(byteString: string): number {
    if (!byteString) return 0;

    const match = byteString.match(/^([\d.]+)\s*([KMGT]?B?)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
  }
}
