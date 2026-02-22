/**
 * Comparison utility functions shared across agents
 */

export function deepEqual(a: unknown, b: unknown, maxDepth = 20): boolean {
  if (maxDepth <= 0) return false; // prevent stack overflow
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false; // array vs object
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i], maxDepth - 1));
  }
  if (typeof a !== 'object') return false;
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(key => deepEqual(aObj[key], bObj[key], maxDepth - 1));
}
