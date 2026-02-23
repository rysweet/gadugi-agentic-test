/**
 * Tests for src/orchestrator/agentAdapters.ts
 *
 * These are pure config-transformation functions with no side effects.
 * Tests verify the mapping logic and default fallbacks.
 */

import { adaptTUIConfig, adaptPriorityConfig, adaptUIConfig } from '../orchestrator/agentAdapters';
import { UIConfig, PriorityConfig } from '../models/Config';

describe('agentAdapters', () => {
  describe('adaptTUIConfig()', () => {
    it('maps terminal, dimensions, and timeout correctly', () => {
      const result = adaptTUIConfig({
        terminal: 'xterm',
        defaultDimensions: { width: 120, height: 40 },
        defaultTimeout: 10000,
      } as any);

      expect(result.terminalType).toBe('xterm');
      expect(result.terminalSize).toEqual({ cols: 120, rows: 40 });
      expect(result.defaultTimeout).toBe(10000);
    });

    it('falls back to defaults when config values are absent', () => {
      const result = adaptTUIConfig({} as any);

      expect(result.terminalType).toBe('xterm');
      expect(result.terminalSize).toEqual({ cols: 80, rows: 24 });
      expect(result.defaultTimeout).toBe(30000);
    });
  });

  describe('adaptPriorityConfig()', () => {
    it('returns standard priority agent defaults regardless of input', () => {
      const result = adaptPriorityConfig({} as PriorityConfig);

      expect(result.historyRetentionDays).toBe(30);
      expect(result.flakyThreshold).toBe(0.3);
    });
  });

  describe('adaptUIConfig()', () => {
    it('maps UI config to ElectronUIAgentConfig', () => {
      const ui: UIConfig = {
        browser: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
        baseUrl: 'http://localhost',
        defaultTimeout: 5000,
        screenshotDir: '/tmp/shots',
        recordVideo: false,
      } as UIConfig;

      const result = adaptUIConfig(ui);

      expect(result.headless).toBe(true);
      expect(result.defaultTimeout).toBe(5000);
      expect(result.screenshotConfig!.directory).toBe('/tmp/shots');
    });

    it('falls back to defaults when optional fields are absent', () => {
      const result = adaptUIConfig({} as UIConfig);

      expect(result.defaultTimeout).toBe(30000);
      expect(result.screenshotConfig!.directory).toBe('./screenshots');
    });
  });
});
