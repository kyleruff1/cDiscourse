#!/usr/bin/env node
// HOST-001 — Cross-platform Node entrypoint for the web build.
//
// Usage:
//   node scripts/build/build-web.mjs               # real build
//   node scripts/build/build-web.mjs --dry         # plan only, no expo invocation
//   node scripts/build/build-web.mjs --output-dir=custom-dist
//
// Default platform is web (Expo Web). Output goes to ./dist by default.
//
// Doctrine:
//   - Does NOT read .env* files.
//   - Does NOT call Anthropic / xAI / X / Supabase / Resend.
//   - Does NOT deploy. Only produces ./dist.
//   - Does NOT install dependencies.
//   - Refuses if output-dir path tries to escape the repo root.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..', '..');

function parseArgs(argv) {
  const out = { dry: false, outputDir: 'dist' };
  for (const arg of argv) {
    if (arg === '--dry' || arg === '--dry-run') out.dry = true;
    else if (arg.startsWith('--output-dir=')) out.outputDir = arg.slice('--output-dir='.length);
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  // Plain text, no emojis, no verdict tokens.
  // Intentionally uses process.stdout, not console.log, to avoid the lint rule.
  process.stdout.write(
    [
      'build-web.mjs — produce the Expo Web static bundle.',
      '',
      'Flags:',
      '  --dry / --dry-run        Plan only. Prints what would run, exits 0.',
      '  --output-dir=<path>      Output directory (default: dist). Must stay inside the repo.',
      '  --help / -h              Show this help.',
      '',
      'Doctrine: no env-file reads, no network calls, no AI providers.',
      '',
    ].join('\n'),
  );
}

function refuseEscape(repoRoot, target) {
  const absolute = resolve(repoRoot, target);
  if (!absolute.startsWith(repoRoot + sep) && absolute !== repoRoot) {
    process.stderr.write(`refused: output-dir resolves outside repo root: ${absolute}\n`);
    process.exit(2);
  }
  return absolute;
}

function summariseDist(distPath) {
  if (!existsSync(distPath)) return { fileCount: 0, sizeBytes: 0 };
  let fileCount = 0;
  let sizeBytes = 0;
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) {
        fileCount += 1;
        sizeBytes += statSync(p).size;
      }
    }
  }
  walk(distPath);
  return { fileCount, sizeBytes };
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputAbs = refuseEscape(REPO_ROOT, args.outputDir);

  process.stdout.write(`[build-web] repo root: ${REPO_ROOT}\n`);
  process.stdout.write(`[build-web] output dir: ${outputAbs}\n`);
  process.stdout.write(`[build-web] mode: ${args.dry ? 'dry-run (plan only)' : 'apply'}\n`);

  if (args.dry) {
    process.stdout.write(
      [
        '[build-web] would run: npx expo export --platform web --output-dir ' + args.outputDir,
        '[build-web] dry-run complete. No build executed.',
      ].join('\n') + '\n',
    );
    return 0;
  }

  // Real build path. Operator-facing local dev or CI uses this.
  mkdirSync(outputAbs, { recursive: true });

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    npx,
    ['expo', 'export', '--platform', 'web', '--output-dir', args.outputDir],
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    process.stderr.write(`[build-web] expo export exited with status ${result.status ?? 'null'}\n`);
    return result.status ?? 1;
  }

  const summary = summariseDist(outputAbs);
  process.stdout.write(
    `[build-web] dist summary: ${summary.fileCount} files, ${formatBytes(summary.sizeBytes)}\n`,
  );
  if (summary.fileCount === 0) {
    process.stderr.write('[build-web] refused: dist is empty after build.\n');
    return 3;
  }
  return 0;
}

process.exit(main());
