/**
 * Tests for src/utils/ids.ts (issue #118)
 */

import { generateId } from '../utils/ids';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('includes the prefix when provided', () => {
    expect(generateId('conn').startsWith('conn_')).toBe(true);
    expect(generateId('tui').startsWith('tui_')).toBe(true);
    expect(generateId('msg').startsWith('msg_')).toBe(true);
  });

  it('omits the prefix separator when prefix is empty', () => {
    const id = generateId();
    expect(id.startsWith('_')).toBe(false);
    // Should be "timestamp_rand" with no leading underscore
    expect(/^\d+_[a-z0-9]+$/.test(id)).toBe(true);
  });

  it('returns unique values on repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('unique values with the same prefix', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId('conn')));
    expect(ids.size).toBe(50);
  });

  it('includes a timestamp component', () => {
    const before = Date.now();
    const id = generateId();
    const after = Date.now();
    // The first segment is a timestamp
    const ts = parseInt(id.split('_')[0], 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('includes a timestamp component when prefix is set', () => {
    const before = Date.now();
    const id = generateId('pfx');
    const after = Date.now();
    const ts = parseInt(id.split('_')[1], 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
