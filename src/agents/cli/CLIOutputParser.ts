/**
 * CLIOutputParser - Output parsing and verification
 *
 * Responsible for validating command output against expected patterns,
 * waiting for output patterns, and capturing buffered output streams.
 */

import { CommandResult } from '../../models/TestModels';
import { deepEqual } from '../../utils/comparison';
import { StreamData } from './types';

export class CLIOutputParser {
  private defaultTimeout: number;

  constructor(defaultTimeout: number) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Validate command output against an expected value or pattern
   */
  async validateOutput(output: string, expected: any): Promise<boolean> {
    if (typeof expected === 'string') {
      if (expected.startsWith('regex:')) {
        const pattern = expected.substring(6);
        const regex = new RegExp(pattern, 'i');
        return regex.test(output);
      } else if (expected.startsWith('contains:')) {
        const searchText = expected.substring(9);
        return output.includes(searchText);
      } else {
        return output.trim() === expected.trim();
      }
    }

    if (typeof expected === 'object' && expected.type) {
      switch (expected.type) {
        case 'json':
          try {
            const parsed = JSON.parse(output);
            return deepEqual(parsed, expected.value);
          } catch {
            return false;
          }

        case 'contains':
          return output.includes(expected.value);

        case 'not_contains':
          return !output.includes(expected.value);

        case 'starts_with':
          return output.startsWith(expected.value);

        case 'ends_with':
          return output.endsWith(expected.value);

        case 'length':
          return output.length === expected.value;

        case 'empty':
          return output.trim().length === 0;

        case 'not_empty':
          return output.trim().length > 0;

        default:
          throw new Error(`Unsupported validation type: ${expected.type}`);
      }
    }

    return false;
  }

  /**
   * Wait for a specific output pattern to appear in the buffer
   */
  async waitForOutput(
    pattern: string,
    getOutput: () => string,
    timeout: number = this.defaultTimeout
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const regex = new RegExp(pattern, 'i');

      const checkOutput = () => {
        const currentOutput = getOutput();
        if (regex.test(currentOutput)) {
          resolve(currentOutput);
          return;
        }
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for output pattern: ${pattern}`));
          return;
        }
        setTimeout(checkOutput, 100);
      };

      checkOutput();
    });
  }

  /**
   * Capture and separate stdout/stderr from an output buffer
   */
  captureOutput(outputBuffer: StreamData[]): { stdout: string; stderr: string; combined: string } {
    const stdoutData = outputBuffer
      .filter(entry => entry.type === 'stdout')
      .map(entry => entry.data)
      .join('');

    const stderrData = outputBuffer
      .filter(entry => entry.type === 'stderr')
      .map(entry => entry.data)
      .join('');

    const combinedData = [...outputBuffer]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(entry => entry.data)
      .join('');

    return { stdout: stdoutData, stderr: stderrData, combined: combinedData };
  }

  /**
   * Get the combined stdout + stderr from the latest command result
   */
  getLatestOutput(commandHistory: CommandResult[], outputBuffer: StreamData[]): string {
    if (commandHistory.length === 0) {
      return this.getAllOutput(outputBuffer);
    }
    const lastCommand = commandHistory[commandHistory.length - 1];
    return `${lastCommand.stdout}\n${lastCommand.stderr}`.trim();
  }

  /**
   * Validate that the exit code of the latest command matches expectation
   */
  validateExitCode(commandHistory: CommandResult[], expectedCode: number): boolean {
    if (commandHistory.length === 0) {
      throw new Error('No command history available for exit code validation');
    }
    const lastCommand = commandHistory[commandHistory.length - 1];
    return lastCommand.exitCode === expectedCode;
  }

  /**
   * Get recent scenario logs from the output buffer (last 5 minutes)
   */
  getScenarioLogs(outputBuffer: StreamData[]): string[] {
    return outputBuffer
      .filter(entry => entry.timestamp.getTime() > Date.now() - 300000)
      .map(entry => `[${entry.type.toUpperCase()}] ${entry.data.trim()}`)
      .filter(log => log.length > 0);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getAllOutput(outputBuffer: StreamData[]): string {
    return [...outputBuffer]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(entry => entry.data)
      .join('');
  }
}
