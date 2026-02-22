/**
 * Tests for validateDirectory() in src/utils/fileUtils.ts (issue #118)
 */

import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateDirectory } from '../utils/fileUtils';

describe('validateDirectory', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validate-dir-test-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('resolves for an existing directory', async () => {
    await expect(validateDirectory(tmpDir)).resolves.toBeUndefined();
  });

  it('throws a descriptive error when the path does not exist', async () => {
    const missing = path.join(tmpDir, 'does-not-exist');
    await expect(validateDirectory(missing)).rejects.toThrow('does not exist');
  });

  it('throws a descriptive error when the path is a file, not a directory', async () => {
    const filePath = path.join(tmpDir, 'test-file.txt');
    await fs.writeFile(filePath, 'hello');
    await expect(validateDirectory(filePath)).rejects.toThrow('not a directory');
  });
});
