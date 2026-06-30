#!/usr/bin/env node
// Supply-chain audit gate.
//
// Runs `npm audit --json` and fails (exit 1) ONLY when a high/critical
// advisory appears that is not present in .github/audit-baseline.json.
// Pre-existing advisories recorded in the baseline are tolerated so the
// gate stays green today while still blocking any NEWLY-introduced
// high/critical vulnerability. Prune the baseline as upstream fixes land.
//
// No external dependencies: Node built-ins only.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BLOCKING = new Set(['high', 'critical']);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repoRoot, '.github', 'audit-baseline.json');

function runAudit() {
  // npm audit exits non-zero when vulnerabilities exist; capture stdout regardless.
  try {
    return execFileSync('npm', ['audit', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    if (err.stdout) return err.stdout;
    throw err;
  }
}

function collectHighCritical(audit) {
  const found = new Map();
  for (const vuln of Object.values(audit.vulnerabilities || {})) {
    for (const via of vuln.via || []) {
      if (typeof via === 'object' && BLOCKING.has(via.severity)) {
        found.set(via.source, { id: via.source, name: via.name, severity: via.severity, title: via.title });
      }
    }
  }
  return found;
}

function main() {
  const audit = JSON.parse(runAudit());
  const current = collectHighCritical(audit);

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const baselineIds = new Set((baseline.advisories || []).map((a) => a.id));

  const introduced = [...current.values()].filter((a) => !baselineIds.has(a.id));
  const stillPresent = [...current.keys()].filter((id) => baselineIds.has(id)).length;
  const resolved = [...baselineIds].filter((id) => !current.has(id));

  console.log('Supply-chain audit gate');
  console.log(`  baseline advisories:        ${baselineIds.size}`);
  console.log(`  current high/critical:      ${current.size}`);
  console.log(`  acknowledged (in baseline): ${stillPresent}`);
  console.log(`  newly introduced:           ${introduced.length}`);
  if (resolved.length) {
    console.log(`  baseline entries no longer present (safe to prune): ${resolved.length}`);
  }

  if (introduced.length > 0) {
    console.error('\nNEW high/critical advisories not in .github/audit-baseline.json:');
    for (const a of introduced) {
      console.error(`  - [${a.severity}] ${a.name} (advisory ${a.id}): ${a.title}`);
    }
    console.error('\nResolve the vulnerability (preferred) or, after review, add the advisory');
    console.error('to .github/audit-baseline.json. The gate will not pass with new high/critical findings.');
    process.exit(1);
  }

  console.log('\nNo newly-introduced high/critical advisories. Gate passed.');
}

main();
