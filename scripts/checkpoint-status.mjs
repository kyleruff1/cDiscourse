#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

process.stdout.write('=== CDiscourse Checkpoint ===\n\n');

// Git status
const isGit = existsSync(join(root, '.git'));
if (isGit) {
  const branch = run('git rev-parse --abbrev-ref HEAD');
  const commit = run('git rev-parse --short HEAD');
  const dirty = run('git status --porcelain');
  const changedCount = dirty ? dirty.split('\n').filter(Boolean).length : 0;
  process.stdout.write('Git:\n');
  process.stdout.write(`  Branch : ${branch ?? 'unknown'}\n`);
  process.stdout.write(`  Commit : ${commit ?? 'unknown'}\n`);
  process.stdout.write(
    `  Tree   : ${changedCount > 0 ? `dirty (${changedCount} changed file${changedCount !== 1 ? 's' : ''})` : 'clean'}\n`,
  );
} else {
  process.stdout.write('Git: not initialized\n');
}

process.stdout.write('\n');

// Package info
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
process.stdout.write(`Package: ${pkg.name}@${pkg.version}\n\n`);

// Current stage from CLAUDE.md
const claudePath = join(root, 'CLAUDE.md');
const claudeMd = readFileSync(claudePath, 'utf8');
const stageMatch = claudeMd.match(/Current stage:\s*\*\*(.+?)\*\*/);
const stage = stageMatch ? stageMatch[1] : 'unknown (check CLAUDE.md)';
process.stdout.write(`Stage: ${stage}\n\n`);

// Environment checks (no secrets revealed)
process.stdout.write('Environment:\n');
process.stdout.write(`  .env exists              : ${existsSync(join(root, '.env'))}\n`);
process.stdout.write(
  `  supabase/config.toml    : ${existsSync(join(root, 'supabase', 'config.toml'))}\n`,
);
process.stdout.write(
  `  supabase/functions/     : ${existsSync(join(root, 'supabase', 'functions'))}\n`,
);
process.stdout.write(
  `  supabase/migrations/    : ${existsSync(join(root, 'supabase', 'migrations'))}\n`,
);
process.stdout.write('\n');

// Secret scan — warn if secrets appear in committed files
const secretScan = run(
  'git grep -l "ANTHROPIC_API_KEY\\|SERVICE_ROLE_KEY" -- src/ app/ 2>/dev/null',
);
if (secretScan) {
  process.stderr.write(
    `WARNING: potential secret found in source files:\n${secretScan}\n`,
  );
} else if (isGit) {
  process.stdout.write('Secret scan: clean (no ANTHROPIC_API_KEY or SERVICE_ROLE_KEY in src/app/)\n\n');
}

process.stdout.write('Done.\n');
