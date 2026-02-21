/**
 * agentAdapters
 *
 * Config adaptation helpers that convert TestConfig sub-configs into
 * agent-specific config shapes. Extracted from TestOrchestrator to reduce
 * its LOC.
 */

import { UIConfig, PriorityConfig } from '../models/Config';
import { TUIConfig } from '../models/TUIModels';
import { TUIAgentConfig } from '../agents/TUIAgent';
import { ElectronUIAgentConfig } from '../agents/ElectronUIAgent';
import { PriorityAgentConfig } from '../agents/PriorityAgent';

export function adaptTUIConfig(config: TUIConfig): TUIAgentConfig {
  return {
    terminalType: config.terminal || 'xterm',
    terminalSize: {
      cols: config.defaultDimensions?.width || 80,
      rows: config.defaultDimensions?.height || 24
    },
    defaultTimeout: config.defaultTimeout || 30000,
    inputTiming: { keystrokeDelay: 10, responseDelay: 100, stabilizationTimeout: 1000 },
    outputCapture: { preserveColors: true, bufferSize: 10000, captureTiming: true }
  };
}

export function adaptPriorityConfig(_config: PriorityConfig): PriorityAgentConfig {
  return {
    historyRetentionDays: 30,
    flakyThreshold: 0.3,
    patternSensitivity: 0.7,
    minSamplesForTrends: 5
  };
}

export function adaptUIConfig(config: UIConfig): ElectronUIAgentConfig {
  return {
    executablePath: process.env.ELECTRON_APP_PATH || 'electron',
    launchTimeout: config.defaultTimeout || 30000,
    defaultTimeout: config.defaultTimeout || 30000,
    headless: config.headless || false,
    recordVideo: config.recordVideo || false,
    videoDir: config.videoDir,
    slowMo: config.slowMo,
    screenshotConfig: {
      mode: 'on',
      directory: config.screenshotDir || './screenshots',
      fullPage: true
    }
  };
}
