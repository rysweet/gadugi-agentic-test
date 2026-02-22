/**
 * TUIInputSimulator - Keyboard input simulation for TUI applications
 *
 * Responsible for:
 * - Sending raw string input to a terminal session
 * - Processing special key sequences ({Enter}, {Tab}, {ArrowUp}, etc.)
 * - Respecting per-keystroke timing delays
 * - Waiting for output stabilization or expected patterns
 */

import { TUIAgentConfig, InputSimulation, TerminalOutput } from './types';
import { TestLogger } from '../../utils/logger';
import { delay } from '../../utils/async';

/**
 * Handles keyboard input simulation for TUI testing sessions
 */
export class TUIInputSimulator {
  private readonly config: Required<TUIAgentConfig>;
  private readonly logger: TestLogger;

  constructor(config: Required<TUIAgentConfig>, logger: TestLogger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Send input to a terminal session stdin
   *
   * Accepts either a plain string (sent character-by-character) or a full
   * InputSimulation object for advanced control over timing and waiting.
   *
   * @param stdin - The writable stdin stream of the target session
   * @param sessionId - Session ID (used for logging and error messages)
   * @param input - Input string or InputSimulation options
   * @param getLatestOutput - Callback to retrieve the latest output for pattern waiting
   * @param getOutputBufferLength - Callback to get buffer length for stabilization
   * @param onInputSent - Callback to emit the inputSent event
   * @throws Error if stdin write fails
   */
  async sendInput(
    stdin: NodeJS.WritableStream,
    sessionId: string,
    input: string | InputSimulation,
    getLatestOutput: () => TerminalOutput | null,
    getOutputBufferLength: () => number,
    onInputSent: (sessionId: string, inputData: string) => void
  ): Promise<void> {
    let inputData: string;
    let timing: number;
    let waitForStabilization: boolean;
    let waitForPattern: string | undefined;
    let timeout: number;

    if (typeof input === 'string') {
      inputData = input;
      timing = this.config.inputTiming.keystrokeDelay;
      waitForStabilization = false;
      timeout = this.config.defaultTimeout;
    } else {
      inputData = input.keys;
      timing = input.timing ?? this.config.inputTiming.keystrokeDelay;
      waitForStabilization = input.waitForStabilization ?? false;
      waitForPattern = input.waitForPattern;
      timeout = input.timeout ?? this.config.defaultTimeout;
    }

    const processedInput = this.processSpecialKeys(inputData);

    this.logger.debug(`Sending input to session ${sessionId}`, {
      input: this.config.logConfig.logInputs ? processedInput : '[HIDDEN]',
      timing
    });

    try {
      for (const char of processedInput) {
        stdin.write(char);
        if (timing > 0) {
          await delay(timing);
        }
      }

      await delay(this.config.inputTiming.responseDelay);

      if (waitForStabilization) {
        await this.waitForOutputStabilization(getOutputBufferLength);
      }

      if (waitForPattern) {
        await this.waitForOutputPattern(getLatestOutput, waitForPattern, timeout);
      }

      onInputSent(sessionId, inputData);
    } catch (error: any) {
      this.logger.error(`Failed to send input to session ${sessionId}`, { error: error?.message });
      throw error;
    }
  }

  /**
   * Get the platform-specific key sequence for a named key
   *
   * @param key - Key name (e.g., 'Enter', 'Tab', 'ArrowUp')
   * @returns The escape sequence for the key on the current platform
   */
  getKeyMapping(key: string): string {
    const platform = process.platform;
    const keyMappings = this.config.crossPlatform.keyMappings?.[platform] ||
                       this.config.crossPlatform.keyMappings?.['linux'] ||
                       {};
    return keyMappings[key] || key;
  }

  /**
   * Wait until the output buffer stops growing (stabilizes)
   *
   * @param getOutputBufferLength - Callback returning the current buffer size
   */
  async waitForStabilization(getOutputBufferLength: () => number): Promise<void> {
    return this.waitForOutputStabilization(getOutputBufferLength);
  }

  /**
   * Wait until the latest output matches a regex pattern
   *
   * @param getLatestOutput - Callback returning the latest output
   * @param pattern - Regex pattern string
   * @param timeout - Timeout in milliseconds
   */
  async waitForPattern(
    getLatestOutput: () => TerminalOutput | null,
    pattern: string,
    timeout: number
  ): Promise<void> {
    return this.waitForOutputPattern(getLatestOutput, pattern, timeout);
  }

  // -- Private helpers --

  /**
   * Replace named key tokens like {Enter} with their escape sequences
   */
  private processSpecialKeys(input: string): string {
    const platform = process.platform;
    const keyMappings = this.config.crossPlatform.keyMappings?.[platform] ||
                       this.config.crossPlatform.keyMappings?.['linux'] ||
                       {};

    let processed = input;

    for (const [key, code] of Object.entries(keyMappings)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processed = processed.replace(regex, code);
    }

    return processed;
  }

  /**
   * Wait until the output buffer stops growing (stabilizes)
   */
  private async waitForOutputStabilization(
    getOutputBufferLength: () => number
  ): Promise<void> {
    const timeout = this.config.inputTiming.stabilizationTimeout;
    const checkInterval = 100;
    let lastOutputLength = 0;
    let stableCount = 0;
    const requiredStableChecks = 5;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const currentOutputLength = getOutputBufferLength();

        if (currentOutputLength === lastOutputLength) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            resolve();
            return;
          }
        } else {
          stableCount = 0;
          lastOutputLength = currentOutputLength;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Output stabilization timeout after ${timeout}ms`));
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  /**
   * Wait until the latest output matches a regex pattern
   */
  private async waitForOutputPattern(
    getLatestOutput: () => TerminalOutput | null,
    pattern: string,
    timeout: number
  ): Promise<void> {
    const regex = new RegExp(pattern, 'i');
    const checkInterval = 100;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const output = getLatestOutput();

        if (output && regex.test(output.text)) {
          resolve();
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for pattern: ${pattern}`));
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }
}
