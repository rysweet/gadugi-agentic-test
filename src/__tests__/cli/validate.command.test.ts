/**
 * Tests for src/cli/commands/validate.ts
 * Covers: registerValidateCommand, single-file validation, directory validation,
 *         error reporting, exit code on failures.
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

jest.mock('cli-progress', () => ({
  SingleBar: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
  })),
  Presets: { rect: {} },
}));

jest.mock('fs/promises');

const mockValidateYamlFile = jest.fn();
jest.mock('../../utils', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  createYamlParser: jest.fn().mockImplementation(() => ({
    validateYamlFile: mockValidateYamlFile,
  })),
}));

const mockLoadFromFile = jest.fn();
jest.mock('../../scenarios', () => ({
  ScenarioLoader: {
    loadFromFile: (...args: unknown[]) => mockLoadFromFile(...args),
    loadFromDirectory: jest.fn(),
  },
}));

import { Command } from 'commander';
import * as fs from 'fs/promises';
import { registerValidateCommand } from '../../cli/commands/validate';

const mockFs = jest.mocked(fs);

async function invokeValidate(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerValidateCommand(program);
  await program.parseAsync(['validate', ...args], { from: 'user' });
}

describe('registerValidateCommand', () => {
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

  it('registers a "validate" command on the Commander program', () => {
    const program = new Command();
    registerValidateCommand(program);
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('validate');
  });

  describe('single file mode (--file)', () => {
    it('validates single file and reports it as valid', async () => {
      mockValidateYamlFile.mockResolvedValue({ valid: true, errors: [] });
      mockLoadFromFile.mockResolvedValue({ name: 'MyScenario', steps: [], assertions: [] });

      await invokeValidate(['--file', './scenarios/test.yaml']);

      expect(mockValidateYamlFile).toHaveBeenCalledWith('./scenarios/test.yaml');
      // Should report valid count = 1 (printed somewhere in output)
      const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const hasValidCount = allCalls.some((c) => c.includes('1'));
      expect(hasValidCount).toBe(true);
    });

    it('reports scenario name when single file is valid', async () => {
      mockValidateYamlFile.mockResolvedValue({ valid: true, errors: [] });
      mockLoadFromFile.mockResolvedValue({ name: 'LoginTest', steps: [], assertions: [] });

      await invokeValidate(['--file', './scenarios/login.yaml']);

      const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const hasName = allCalls.some((c) => c.includes('LoginTest'));
      expect(hasName).toBe(true);
    });

    it('exits 1 when single file is invalid', async () => {
      mockValidateYamlFile.mockResolvedValue({ valid: false, errors: ['missing name field'] });

      await expect(invokeValidate(['--file', './scenarios/bad.yaml'])).rejects.toThrow(
        'process.exit(1)'
      );
    });

    it('reports validation errors for invalid file', async () => {
      mockValidateYamlFile.mockResolvedValue({
        valid: false,
        errors: ['field "name" is required'],
      });

      await expect(invokeValidate(['--file', './scenarios/bad.yaml'])).rejects.toThrow(
        'process.exit(1)'
      );

      const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const hasError = allCalls.some((c) => c.includes('field "name" is required'));
      expect(hasError).toBe(true);
    });

    it('handles file access error by treating file as invalid', async () => {
      // When fs.access fails for --file, the error is caught and results in invalid entry
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      // Should exit 1 because validation result is invalid
      await expect(invokeValidate(['--file', './scenarios/missing.yaml'])).rejects.toThrow(
        'process.exit(1)'
      );
    });
  });

  describe('directory mode', () => {
    it('validates all YAML files in the directory (filters by extension)', async () => {
      mockFs.readdir.mockResolvedValue(['a.yaml', 'b.yml', 'c.txt'] as unknown as fs.Dirent[]);
      mockValidateYamlFile.mockResolvedValue({ valid: true, errors: [] });
      mockLoadFromFile.mockResolvedValue({ name: 'Scen', steps: [], assertions: [] });

      await invokeValidate(['--directory', './scenarios']);

      // Only .yaml and .yml files (2 of 3)
      expect(mockValidateYamlFile).toHaveBeenCalledTimes(2);
    });

    it('throws CLIError when directory does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(invokeValidate(['--directory', './missing'])).rejects.toThrow(
        'process.exit(1)'
      );

      const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const hasDirError = allCalls.some(
        (c) => c.includes('missing') || c.includes('not found') || c.includes('Directory')
      );
      expect(hasDirError).toBe(true);
    });

    it('warns when no YAML files found in directory', async () => {
      mockFs.readdir.mockResolvedValue([] as unknown as fs.Dirent[]);

      await invokeValidate(['--directory', './scenarios']);

      const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const hasWarning = allCalls.some((c) => c.includes('No YAML') || c.includes('no YAML'));
      expect(hasWarning).toBe(true);
    });

    it('reports errors for invalid YAML files', async () => {
      mockFs.readdir.mockResolvedValue(['bad.yaml'] as unknown as fs.Dirent[]);
      mockValidateYamlFile.mockResolvedValue({
        valid: false,
        errors: ['field "name" is required'],
      });

      await expect(invokeValidate(['--directory', './scenarios'])).rejects.toThrow(
        'process.exit(1)'
      );

      const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const hasError = allCalls.some((c) => c.includes('field "name" is required'));
      expect(hasError).toBe(true);
    });

    it('exits 1 when any files are invalid', async () => {
      mockFs.readdir.mockResolvedValue(['bad.yaml'] as unknown as fs.Dirent[]);
      mockValidateYamlFile.mockResolvedValue({ valid: false, errors: ['error'] });

      await expect(invokeValidate(['--directory', './scenarios'])).rejects.toThrow(
        'process.exit(1)'
      );
    });

    it('reports all files valid and does not exit when no errors found', async () => {
      mockFs.readdir.mockResolvedValue(['good.yaml'] as unknown as fs.Dirent[]);
      mockValidateYamlFile.mockResolvedValue({ valid: true, errors: [] });
      mockLoadFromFile.mockResolvedValue({ name: 'GoodScenario', steps: [], assertions: [] });

      await invokeValidate(['--directory', './scenarios']);

      const allCalls = consoleLogSpy.mock.calls.map((c) => c.join(' '));
      const hasAllValid = allCalls.some((c) => c.includes('valid') || c.includes('Valid'));
      expect(hasAllValid).toBe(true);
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });
});
