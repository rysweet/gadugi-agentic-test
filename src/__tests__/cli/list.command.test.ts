/**
 * Tests for src/cli/commands/list.ts
 * Covers: registerListCommand, JSON output, table output, tag filtering
 */

// Mock chalk BEFORE any imports that use it (chalk v5 is ESM-only)
jest.mock('chalk', () => {
  const identity = (s: string) => s;
  const proxy: Record<string, unknown> = {};
  ['green', 'red', 'yellow', 'blue', 'gray', 'cyan', 'bold'].forEach((c) => {
    proxy[c] = identity;
  });
  proxy.level = 0;
  return { default: Object.assign(identity, proxy), __esModule: true };
});

jest.mock('fs/promises');

const mockLoadFromDirectory = jest.fn();
jest.mock('../../scenarios', () => ({
  ScenarioLoader: {
    loadFromFile: jest.fn(),
    loadFromDirectory: (...args: unknown[]) => mockLoadFromDirectory(...args),
  },
}));

import { Command } from 'commander';
import * as fs from 'fs/promises';
import { registerListCommand } from '../../cli/commands/list';

const mockFs = jest.mocked(fs);

async function invokeList(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerListCommand(program);
  await program.parseAsync(['list', ...args], { from: 'user' });
}

const sampleScenarios = [
  {
    name: 'Login Test',
    description: 'Tests login flow',
    metadata: { tags: ['smoke', 'auth'] },
    steps: [],
    assertions: [],
  },
  {
    name: 'Checkout Test',
    description: 'Tests checkout',
    metadata: { tags: ['regression'] },
    steps: [],
    assertions: [],
  },
];

describe('registerListCommand', () => {
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`);
    }) as unknown as jest.SpyInstance;

    mockFs.access.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('registers a "list" command on the Commander program', () => {
    const program = new Command();
    registerListCommand(program);
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('list');
  });

  describe('--json output', () => {
    it('outputs valid JSON to stdout', async () => {
      mockLoadFromDirectory.mockResolvedValue(sampleScenarios);

      await invokeList(['--json']);

      const jsonCall = consoleLogSpy.mock.calls.find((args) => {
        try {
          JSON.parse(args[0]);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
    });

    it('JSON output includes name and description fields', async () => {
      mockLoadFromDirectory.mockResolvedValue(sampleScenarios);

      await invokeList(['--json']);

      const jsonCall = consoleLogSpy.mock.calls.find((args) => {
        try {
          JSON.parse(args[0]);
          return true;
        } catch {
          return false;
        }
      });
      const parsed = JSON.parse(jsonCall![0]);
      expect(parsed).toBeInstanceOf(Array);
      expect(parsed[0]).toHaveProperty('name', 'Login Test');
      expect(parsed[0]).toHaveProperty('description', 'Tests login flow');
    });

    it('JSON output includes tags array', async () => {
      mockLoadFromDirectory.mockResolvedValue(sampleScenarios);

      await invokeList(['--json']);

      const jsonCall = consoleLogSpy.mock.calls.find((args) => {
        try {
          JSON.parse(args[0]);
          return true;
        } catch {
          return false;
        }
      });
      const parsed = JSON.parse(jsonCall![0]);
      expect(parsed[0].tags).toEqual(['smoke', 'auth']);
    });
  });

  describe('default table format', () => {
    it('prints scenario names to stdout', async () => {
      mockLoadFromDirectory.mockResolvedValue(sampleScenarios);

      await invokeList([]);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(allOutput).toContain('Login Test');
      expect(allOutput).toContain('Checkout Test');
    });

    it('prints a summary line with scenario count', async () => {
      mockLoadFromDirectory.mockResolvedValue(sampleScenarios);

      await invokeList([]);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      // Should show "Scenarios: 2"
      expect(allOutput).toContain('2');
    });
  });

  describe('--filter tag', () => {
    it('filters scenarios by tag and shows only matching ones', async () => {
      mockLoadFromDirectory.mockResolvedValue(sampleScenarios);

      await invokeList(['--filter', 'smoke']);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(allOutput).toContain('Login Test');
      expect(allOutput).not.toContain('Checkout Test');
    });

    it('warns when no scenarios match the filter tag', async () => {
      mockLoadFromDirectory.mockResolvedValue(sampleScenarios);

      await invokeList(['--filter', 'nonexistent-tag']);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(allOutput).toContain('nonexistent-tag');
    });

    it('table format notes the active filter', async () => {
      mockLoadFromDirectory.mockResolvedValue(sampleScenarios);

      await invokeList(['--filter', 'auth']);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(allOutput).toContain('auth');
    });
  });

  describe('edge cases', () => {
    it('throws CLIError when directory does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(invokeList(['--directory', './missing'])).rejects.toThrow('process.exit(1)');
    });

    it('warns when no scenarios found in directory', async () => {
      mockLoadFromDirectory.mockResolvedValue([]);

      await invokeList([]);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(allOutput).toContain('No scenarios');
    });

    it('handles scenario with no metadata gracefully in JSON output', async () => {
      mockLoadFromDirectory.mockResolvedValue([
        { name: 'NoMeta', description: '', steps: [], assertions: [] },
      ]);

      await invokeList(['--json']);

      const jsonCall = consoleLogSpy.mock.calls.find((args) => {
        try {
          JSON.parse(args[0]);
          return true;
        } catch {
          return false;
        }
      });
      const parsed = JSON.parse(jsonCall![0]);
      // Scenarios without metadata should produce empty tags array
      expect(parsed[0].tags).toEqual([]);
    });
  });
});
