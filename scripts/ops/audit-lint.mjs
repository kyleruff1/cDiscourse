#!/usr/bin/env node
/**
 * OPS-MCP-SMOKE-DOCTRINE-HARDENING — Audit-lint runner.
 *
 * Read-only operator entry script. Parses a single MCP smoke audit
 * doc and applies L1-L6 rules from `audit-lint-rules.cjs` via pure
 * helpers in `audit-lint-lib.cjs`. Mirrors the
 * `mcp-observability-report.mjs` runner pattern: ESM entry resolves
 * the repo root via `import.meta.url`, then `createRequire` loads the
 * CommonJS rules + lib modules.
 *
 * Source-of-truth: docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING.md
 * Intent brief:    docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING-intent.md
 *
 * Doctrine:
 *   - READ-ONLY over the audit corpus. The linter never writes to a
 *     doc it lints.
 *   - No network calls. No spawn. No env-variable reads.
 *   - Deterministic output: findings sorted by rule id then by line.
 *
 * CLI surface — see docs/ops/AUDIT-LINT.md.
 */

import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const require = createRequire(import.meta.url);
const lib = require('./audit-lint-lib.cjs');
const rules = require('./audit-lint-rules.cjs');

const {
  parseCliArgs,
  helpText,
  lintAuditDoc,
  isTemplateFilename,
  formatFindingsText,
  classifyChangedFiles,
} = lib;

async function main(argv) {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    process.stderr.write(`Argument error: ${parsed.error}\n`);
    process.stderr.write(helpText() + '\n');
    process.exit(5);
  }
  const options = parsed.options;

  if (options.help) {
    process.stdout.write(helpText() + '\n');
    process.exit(0);
  }

  // OPS-MCP-SMOKE-LINT-CI-WIRING — classify-changed mode dispatch.
  if (options.classifyChanged) {
    await runClassifyChanged(options);
    return;
  }

  if (!options.docPath) {
    process.stderr.write('Argument error: missing required <doc-path>\n');
    process.stderr.write(helpText() + '\n');
    process.exit(5);
  }

  const absolutePath = resolve(options.docPath);
  if (!existsSync(absolutePath)) {
    process.stderr.write(`File not found: ${absolutePath}\n`);
    process.exit(3);
  }

  // Refuse to lint templates — they contain placeholder verdicts like
  // "☐ PASS ☐ PARTIAL ☐ FAIL" which would trip the parser.
  if (isTemplateFilename(absolutePath)) {
    process.stdout.write(`[skip] template doc: ${basename(absolutePath)}\n`);
    process.exit(0);
  }

  let text;
  try {
    text = readFileSync(absolutePath, 'utf8');
  } catch (err) {
    process.stderr.write(`Read error: ${String(err && err.message ? err.message : err)}\n`);
    process.exit(3);
  }

  const result = lintAuditDoc(text, { reportOnly: options.reportOnly });

  process.stdout.write(formatFindingsText(result, { docPath: absolutePath }));

  if (options.reportOnly) {
    process.exit(0);
  }
  process.exit(result.exitCode);
}

/* ------------------------------------------------------------------ */
/* OPS-MCP-SMOKE-LINT-CI-WIRING — classify-changed mode                 */
/* ------------------------------------------------------------------ */

/**
 * Parse `git diff --name-status` text output into structured
 * { status, path } entries. The git rename-detection R{score} status
 * is folded to a plain `R`; copy `C{score}` is folded to `C`. The
 * classifier ignores R/C/D, so the fold is purely for shape parity.
 */
function parseNameStatusLines(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return [];
  }
  const entries = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    if (raw.length === 0) {
      continue;
    }
    // git --name-status uses TAB as separator; rename/copy produces
    // R100\told\tnew (or C100\told\tnew). We only need status + path;
    // for renames the NEW path is the third token, which is the one
    // we want for marker-at-HEAD lookups.
    const parts = raw.split('\t');
    if (parts.length < 2) {
      continue;
    }
    let rawStatus = parts[0];
    // Fold R{score} / C{score} to plain R / C.
    if (/^R\d+/.test(rawStatus)) {
      rawStatus = 'R';
    } else if (/^C\d+/.test(rawStatus)) {
      rawStatus = 'C';
    }
    // For R/C, the path of interest at HEAD is the new path (last token).
    const filePath = parts[parts.length - 1];
    entries.push({ status: rawStatus, path: filePath });
  }
  return entries;
}

/**
 * Resolve changed-file entries from git diff (or stdin in test mode).
 * In stdin mode reads `<status>\t<path>` lines from process.stdin.
 */
async function resolveChangedEntries(options) {
  if (options.changedListStdin) {
    const buf = await readAllStdin();
    return parseNameStatusLines(buf);
  }
  const result = spawnSync(
    'git',
    ['diff', '--name-status', options.baseSha, options.headSha],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    const stderr = result.stderr || '';
    process.stderr.write(
      `git diff failed (status ${result.status}): ${stderr.trim()}\n`,
    );
    return null;
  }
  return parseNameStatusLines(result.stdout || '');
}

/**
 * Read all of process.stdin as utf-8 text. Returns empty string when
 * stdin is closed without data (operator dry-run with no piped input).
 */
function readAllStdin() {
  return new Promise((resolveFn, reject) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolveFn(chunks.join('')));
    process.stdin.on('error', (err) => reject(err));
  });
}

/**
 * Marker reader closure. The PR-checkout state has the HEAD-revision
 * working tree on disk, so the working-tree contents ARE the HEAD
 * contents. We read each path lazily and check for the marker line.
 *
 * `rules.MARKER_STRING` is the single source of truth; this closure
 * does not duplicate the literal.
 */
function makeMarkerReader() {
  const cache = new Map();
  return function readMarkerAtHead(relPath) {
    if (cache.has(relPath)) {
      return cache.get(relPath);
    }
    const abs = resolve(REPO_ROOT, relPath);
    let has = false;
    if (existsSync(abs)) {
      try {
        const text = readFileSync(abs, 'utf8');
        has = text
          .split(/\r?\n/)
          .some((line) => line.trim() === rules.MARKER_STRING);
      } catch (_err) {
        has = false;
      }
    }
    cache.set(relPath, has);
    return has;
  };
}

/**
 * Run the --classify-changed mode. Resolves the entries, classifies,
 * and prints one in-scope path per line on stdout. Always exits 0
 * (per design §A.2 / brief §A.2). Empty stdout when no in-scope
 * paths. Diagnostics go to stderr only.
 */
async function runClassifyChanged(options) {
  const entries = await resolveChangedEntries(options);
  if (entries === null) {
    // git diff failed; surface to stderr and exit 5 (CLI / environment).
    process.exit(5);
  }
  const reader = makeMarkerReader();
  const inScope = classifyChangedFiles(entries, reader);
  if (inScope.length > 0) {
    process.stdout.write(inScope.join('\n') + '\n');
  }
  process.stderr.write(
    `[classify-changed] entries=${entries.length} in_scope=${inScope.length}\n`,
  );
  process.exit(0);
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isMain) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(
      `Unhandled error: ${String(err && err.stack ? err.stack : err)}\n`,
    );
    process.exit(1);
  });
}

// Silence unused-import warnings while keeping REPO_ROOT exported for
// future extensions (e.g., resolving relative doc paths against repo
// root rather than cwd). Currently the runner uses `resolve(docPath)`
// which is cwd-relative, matching how operators run the script.
export { REPO_ROOT };
