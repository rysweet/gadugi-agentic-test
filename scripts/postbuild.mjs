import { chmod } from 'node:fs/promises';
import path from 'node:path';

if (process.platform !== 'win32') {
  await Promise.all([
    chmod(path.resolve('dist/cli.js'), 0o755),
    chmod(path.resolve('dist/runners/smart-cli.js'), 0o755),
  ]);
}
