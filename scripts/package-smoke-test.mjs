import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installRoot = await mkdtemp(path.join(tmpdir(), 'gadugi-package-smoke-'));
const { version } = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
let tarballPath;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status}`
      + (result.stderr ? `\n${result.stderr}` : '')
    );
  }

  return result.stdout;
}

try {
  const packOutput = run(
    'npm',
    ['pack', '--json', '--ignore-scripts'],
    { capture: true }
  );
  const [{ filename, files }] = JSON.parse(packOutput);
  const packagedPaths = new Set(files.map((file) => file.path.toLowerCase()));
  for (const requiredPath of ['dist/cli.js', 'readme.md', 'license']) {
    if (!packagedPaths.has(requiredPath)) {
      throw new Error(`Package is missing required file: ${requiredPath}`);
    }
  }
  tarballPath = path.join(repositoryRoot, filename);

  await writeFile(
    path.join(installRoot, 'package.json'),
    JSON.stringify({ name: 'gadugi-package-smoke', private: true })
  );

  run(
    'npm',
    ['install', '--ignore-scripts', '--omit=optional', '--no-audit', '--no-fund', tarballPath],
    { cwd: installRoot }
  );
  const cliVersion = run(
    process.execPath,
    [path.join(installRoot, 'node_modules', '@gadugi', 'agentic-test', 'dist', 'cli.js'), '--version'],
    { cwd: installRoot, capture: true }
  );
  if (cliVersion.trim() !== version) {
    throw new Error(`Packaged CLI reported ${cliVersion.trim()}, expected ${version}`);
  }
  run(
    process.execPath,
    ['-e', "require('@gadugi/agentic-test')"],
    { cwd: installRoot }
  );
  run(
    process.execPath,
    [
      '-e',
      [
        "const { PtyTerminal } = require('@gadugi/agentic-test');",
        'const terminal = new PtyTerminal();',
        "terminal.on('error', () => {});",
        'terminal.start().then(',
        "  () => { console.error('PTY unexpectedly started without its optional dependency'); process.exit(1); },",
        '  error => {',
        "    if (!error.message.includes('PTY support requires the optional')) throw error;",
        "    console.log('Optional PTY failure is actionable.');",
        '  }',
        ');',
      ].join(' '),
    ],
    { cwd: installRoot }
  );

  console.log('Packaged CLI, library import, and optional PTY fallback verified.');
} finally {
  await rm(installRoot, { recursive: true, force: true });
  if (tarballPath) {
    await rm(tarballPath, { force: true });
  }
}
