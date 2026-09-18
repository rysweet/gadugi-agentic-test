import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installRoot = await mkdtemp(path.join(tmpdir(), 'gadugi-package-smoke-'));
const npmCliPath = process.env.npm_execpath;
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

function runNpm(args, options = {}) {
  if (!npmCliPath) {
    throw new Error('npm_execpath is unavailable; run this check through npm run test:package');
  }
  return run(process.execPath, [npmCliPath, ...args], options);
}

try {
  const packOutput = runNpm(
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

  runNpm(
    ['install', '--ignore-scripts', '--omit=optional', '--no-audit', '--no-fund', tarballPath],
    { cwd: installRoot }
  );
  const cliVersion = runNpm(
    ['exec', '--offline', '--', 'gadugi-test', '--version'],
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

  const generatedProjects = new Map();
  for (const template of ['basic', 'electron', 'advanced']) {
    const generatedRoot = path.join(installRoot, `generated-${template}`);
    runNpm(
      [
        'exec', '--offline', '--', 'gadugi-test', 'init',
        '--directory', generatedRoot,
        '--template', template,
      ],
      { cwd: installRoot }
    );
    runNpm(
      [
        'exec', '--offline', '--', 'gadugi-test', 'validate',
        '--directory', path.join(generatedRoot, 'scenarios'),
      ],
      { cwd: installRoot }
    );
    generatedProjects.set(template, generatedRoot);
  }

  const generatedRoot = generatedProjects.get('basic');
  const generatedPackagePath = path.join(generatedRoot, 'package.json');
  const generatedPackage = JSON.parse(await readFile(generatedPackagePath, 'utf8'));
  if (generatedPackage.devDependencies?.['@gadugi/agentic-test'] !== version) {
    throw new Error('Generated project does not pin the installed Gadugi version');
  }
  const generatedReadme = await readFile(path.join(generatedRoot, 'README.md'), 'utf8');
  if (!generatedReadme.includes('Node.js (>= 20.0.0)')) {
    throw new Error('Generated project documents an unsupported Node.js version');
  }

  generatedPackage.devDependencies['@gadugi/agentic-test'] = pathToFileURL(tarballPath).href;
  await writeFile(generatedPackagePath, JSON.stringify(generatedPackage, null, 2));
  await rm(path.join(installRoot, 'node_modules'), { recursive: true, force: true });
  runNpm(
    ['install', '--ignore-scripts', '--omit=optional', '--no-audit', '--no-fund'],
    { cwd: generatedRoot }
  );
  runNpm(['run', 'test:validate'], { cwd: generatedRoot });

  console.log(
    'Packaged CLI, library import, optional PTY fallback, and generated project verified.'
  );
} finally {
  await rm(installRoot, { recursive: true, force: true });
  if (tarballPath) {
    await rm(tarballPath, { force: true });
  }
}
