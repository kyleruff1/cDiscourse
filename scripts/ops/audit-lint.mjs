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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const require = createRequire(import.meta.url);
const lib = require('./audit-lint-lib.cjs');

const {
  parseCliArgs,
  helpText,
  lintAuditDoc,
  isTemplateFilename,
  formatFindingsText,
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
