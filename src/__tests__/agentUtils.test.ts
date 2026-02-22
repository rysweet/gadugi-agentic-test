/**
 * Tests for src/utils/agentUtils.ts (issue #118)
 */

import { sanitizeConfigWithEnv } from '../utils/agentUtils';

describe('sanitizeConfigWithEnv', () => {
  it('replaces the env field value with its key list', () => {
    const config = {
      timeout: 5000,
      environment: { FOO: 'bar', BAZ: 'qux' },
    };
    const result = sanitizeConfigWithEnv(config, 'environment');
    expect(result.environment).toEqual(expect.arrayContaining(['FOO', 'BAZ']));
    expect(result.environment).toHaveLength(2);
  });

  it('preserves all other fields unchanged', () => {
    const config = {
      timeout: 3000,
      name: 'test-agent',
      logLevel: 'debug',
      environment: { TOKEN: 'secret' },
    };
    const result = sanitizeConfigWithEnv(config, 'environment');
    expect(result.timeout).toBe(3000);
    expect(result.name).toBe('test-agent');
    expect(result.logLevel).toBe('debug');
  });

  it('returns undefined for the env field when the value is undefined', () => {
    const config = { timeout: 1000, env: undefined } as any;
    const result = sanitizeConfigWithEnv(config, 'env');
    expect(result.env).toBeUndefined();
  });

  it('returns undefined for the env field when the value is null', () => {
    const config = { timeout: 1000, env: null } as any;
    const result = sanitizeConfigWithEnv(config, 'env');
    expect(result.env).toBeUndefined();
  });

  it('works with the "env" field name (ElectronUIAgent pattern)', () => {
    const config = {
      executablePath: '/usr/bin/app',
      env: { NODE_ENV: 'test', HOME: '/tmp' },
    };
    const result = sanitizeConfigWithEnv(config, 'env');
    expect(result.env).toEqual(expect.arrayContaining(['NODE_ENV', 'HOME']));
    expect(result.executablePath).toBe('/usr/bin/app');
  });

  it('works with an empty environment object', () => {
    const config = { timeout: 100, environment: {} };
    const result = sanitizeConfigWithEnv(config, 'environment');
    expect(result.environment).toEqual([]);
  });

  it('does not mutate the original config', () => {
    const original = { environment: { A: '1', B: '2' }, timeout: 500 };
    sanitizeConfigWithEnv(original, 'environment');
    expect(original.environment).toEqual({ A: '1', B: '2' });
  });
});
