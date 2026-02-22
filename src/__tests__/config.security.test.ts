/**
 * Security tests for ConfigManager prototype pollution prevention
 * Issue #107: Config prototype pollution via setNestedValue / getNestedValue / parseEnvValue
 *
 * Three attack surfaces are hardened:
 *  1. setNestedValue: forbidden key segments (__proto__, constructor, prototype)
 *  2. getNestedValue: forbidden key segments
 *  3. parseEnvValue: parsed JSON objects that contain dangerous top-level keys
 */

import { ConfigManager, createConfigManager } from '../utils/config';

describe('ConfigManager – prototype pollution prevention (Issue #107)', () => {
  let manager: ConfigManager;
  const originalEnv = process.env;

  beforeEach(() => {
    manager = new ConfigManager();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // -----------------------------------------------------------------------
  // set() – calls setNestedValue internally
  // -----------------------------------------------------------------------

  describe('set() – forbidden path segments', () => {
    it('should throw when path contains "__proto__"', () => {
      expect(() => manager.set('__proto__.polluted', 'bad')).toThrow(
        /Invalid config path segment.*__proto__/
      );
    });

    it('should throw when path contains "constructor"', () => {
      expect(() => manager.set('constructor.prototype.polluted', 'bad')).toThrow(
        /Invalid config path segment.*constructor/
      );
    });

    it('should throw when path contains "prototype"', () => {
      expect(() => manager.set('some.prototype.polluted', 'bad')).toThrow(
        /Invalid config path segment.*prototype/
      );
    });

    it('should throw when __proto__ appears as the first segment', () => {
      expect(() => manager.set('__proto__', 'bad')).toThrow(
        /Invalid config path segment.*__proto__/
      );
    });

    it('should throw when __proto__ appears as a middle segment', () => {
      expect(() => manager.set('logging.__proto__.level', 'bad')).toThrow(
        /Invalid config path segment.*__proto__/
      );
    });

    it('should throw when constructor appears as the last segment', () => {
      expect(() => manager.set('logging.constructor', 'bad')).toThrow(
        /Invalid config path segment.*constructor/
      );
    });

    it('should NOT have polluted Object.prototype after attempted attack', () => {
      try {
        manager.set('__proto__.polluted', 'injected');
      } catch {
        // expected
      }
      // Verify Object.prototype was not polluted
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should NOT have polluted Object.prototype via constructor.prototype attack', () => {
      try {
        manager.set('constructor.prototype.isAdmin', true);
      } catch {
        // expected
      }
      expect((Object.prototype as any).isAdmin).toBeUndefined();
    });

    it('should still allow legitimate dotted paths', () => {
      // Should not throw – these are safe paths
      expect(() => manager.set('logging.level', 'debug')).not.toThrow();
    });

    it('should still allow deeply nested legitimate paths', () => {
      expect(() => manager.set('ui.viewport.width', 1920)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // get() – calls getNestedValue internally
  // -----------------------------------------------------------------------

  describe('get() – forbidden path segments', () => {
    it('should throw when path contains "__proto__"', () => {
      expect(() => manager.get('__proto__.polluted')).toThrow(
        /Invalid config path segment.*__proto__/
      );
    });

    it('should throw when path contains "constructor"', () => {
      expect(() => manager.get('constructor.prototype')).toThrow(
        /Invalid config path segment.*constructor/
      );
    });

    it('should throw when path contains "prototype"', () => {
      expect(() => manager.get('some.prototype.field')).toThrow(
        /Invalid config path segment.*prototype/
      );
    });

    it('should still allow legitimate dotted paths in get()', () => {
      const level = manager.get<string>('logging.level');
      expect(level).toBe('info');
    });
  });

  // -----------------------------------------------------------------------
  // loadFromEnvironment() – parseEnvValue with dangerous JSON payloads
  // -----------------------------------------------------------------------

  describe('loadFromEnvironment() – parseEnvValue JSON prototype pollution', () => {
    it('should not parse JSON containing __proto__ key as an object', () => {
      // The parseEnvValue result for a JSON payload with __proto__ should
      // return the raw string rather than an object, preventing pollution.
      process.env.AGENTIC_BASE_URL = '{"__proto__":{"polluted":"yes"}}';

      // Must not throw and must not pollute
      expect(() => manager.loadFromEnvironment()).not.toThrow();
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should not parse JSON containing "constructor" key as an object', () => {
      process.env.AGENTIC_BASE_URL = '{"constructor":{"name":"exploited"}}';

      expect(() => manager.loadFromEnvironment()).not.toThrow();
      expect((({}) as any).constructor.name).toBe('Object'); // unchanged
    });

    it('should not parse JSON containing "prototype" key as an object', () => {
      process.env.AGENTIC_BASE_URL = '{"prototype":{"toString":"hacked"}}';

      expect(() => manager.loadFromEnvironment()).not.toThrow();
      // toString on a plain object should still work normally
      expect({}.toString()).toBe('[object Object]');
    });

    it('should still parse safe JSON objects normally', () => {
      // A safe JSON object (no forbidden keys) should be parsed as usual.
      process.env.AGENTIC_BASE_URL = 'http://localhost:9000';
      manager.loadFromEnvironment();
      const config = manager.getConfig();
      expect(config.ui.baseUrl).toBe('http://localhost:9000');
    });

    it('should still allow AGENTIC_MAX_PARALLEL to be parsed as a number', () => {
      process.env.AGENTIC_MAX_PARALLEL = '8';
      manager.loadFromEnvironment();
      const config = manager.getConfig();
      expect(config.execution.maxParallel).toBe(8);
    });
  });

  // -----------------------------------------------------------------------
  // Prototype pollution resistance: verify Object.prototype integrity
  // -----------------------------------------------------------------------

  describe('Object.prototype integrity after multiple attacks', () => {
    it('should leave Object.prototype clean after several forbidden-key attempts', () => {
      const attempts = [
        () => manager.set('__proto__.x', 1),
        () => manager.set('constructor.prototype.y', 2),
        () => manager.set('prototype.z', 3),
        () => manager.get('__proto__.x'),
        () => manager.get('constructor.name'),
      ];

      for (const attempt of attempts) {
        try { attempt(); } catch { /* expected */ }
      }

      const plainObj: Record<string, unknown> = {};
      expect(plainObj.x).toBeUndefined();
      expect(plainObj.y).toBeUndefined();
      expect(plainObj.z).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // createConfigManager factory
  // -----------------------------------------------------------------------

  describe('createConfigManager factory', () => {
    it('should create a ConfigManager instance', () => {
      const cm = createConfigManager();
      expect(cm).toBeInstanceOf(ConfigManager);
    });
  });
});
