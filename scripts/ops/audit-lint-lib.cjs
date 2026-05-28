/**
 * OPS-MCP-SMOKE-DOCTRINE-HARDENING — Audit-lint pure helpers (CommonJS).
 *
 * Pure, side-effect-free helpers used by both the `.mjs` entry script
 * and the Jest test suites. CommonJS so the Jest default loader can
 * `require()` without an additional transform.
 *
 * Source-of-truth: docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING.md
 *
 * Doctrine:
 *   - No fs reads from this lib (the runner reads the doc; the lib
 *     operates on the text string).
 *   - No spawn. No network. No env reads.
 *   - Deterministic output: findings sorted by rule id then line.
 *
 * This C1 skeleton defines the CLI parser and stubs for parseAuditDoc
 * + lintAuditDoc. Full L1-L6 implementation lands in C2-C3.
 */

'use strict';

const rules = require('./audit-lint-rules.cjs');

/* ------------------------------------------------------------------ */
/* CLI parsing                                                         */
/* ------------------------------------------------------------------ */

const DEFAULTS = Object.freeze({
  docPath: null,
  reportOnly: false,
  help: false,
});

function parseCliArgs(argv) {
  if (!Array.isArray(argv)) {
    return { ok: false, error: 'argv must be an array' };
  }
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      options.help = true;
      continue;
    }
    if (a === '--report-only') {
      options.reportOnly = true;
      continue;
    }
    if (a.startsWith('--')) {
      return { ok: false, error: `Unknown flag: ${a}` };
    }
    if (options.docPath !== null) {
      return {
        ok: false,
        error: `Unexpected positional argument: ${a} (already have ${options.docPath})`,
      };
    }
    options.docPath = a;
  }
  return { ok: true, options };
}

function helpText() {
  return [
    'OPS-MCP-SMOKE-DOCTRINE-HARDENING — Audit-lint runner',
    '',
    'USAGE:',
    '  node scripts/ops/audit-lint.mjs <doc-path> [--report-only]',
    '  node scripts/ops/audit-lint.mjs --help',
    '',
    'FLAGS:',
    '  --report-only   Print findings + counts; exit 0 even if findings present.',
    '                  Used for corpus census without blocking.',
    '  --help, -h      Show this help.',
    '',
    'EXIT CODES:',
    '  0  No findings (or --report-only flag set)',
    '  1  At least one rule violation',
    '  2  Parse error (verdict not extractable; malformed doc)',
    '  3  File not found or unreadable',
    '  5  CLI argument error',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Template-doc refusal                                                */
/* ------------------------------------------------------------------ */

/**
 * Templates have placeholder verdicts like "☐ PASS ☐ PARTIAL ☐ FAIL"
 * and should never be linted. Filename match: ends with `-template.md`.
 */
function isTemplateFilename(filePath) {
  if (typeof filePath !== 'string') {
    return false;
  }
  return /-template\.md$/i.test(filePath);
}

/* ------------------------------------------------------------------ */
/* parseAuditDoc + lintAuditDoc — stubbed in C1; filled in C2-C3      */
/* ------------------------------------------------------------------ */

/**
 * Parse an audit doc into a structured representation. C1 stub
 * returns a minimal shape; the full parser lands in C2.
 */
function parseAuditDoc(_text) {
  // Stub for C1. Real implementation lands in C2.
  return {
    title: '',
    auditType: 'unknown',
    hasMarker: false,
    family: null,
    verdict: null,
    verdictHeaderLineNumber: null,
    phases: [],
  };
}

/**
 * Apply L1-L6 rules. C1 stub returns a non-error result; L1-L6 land
 * in C3.
 */
function lintAuditDoc(text, _options) {
  const parsed = parseAuditDoc(text);
  return {
    exitCode: 0,
    parsed,
    findings: [],
  };
}

/**
 * Render a deterministic human-readable summary of the lint result.
 * Used by the CLI entry; also useful for the report-only census mode.
 */
function formatFindingsText(result, options) {
  const lines = [];
  const docLabel =
    options && typeof options.docPath === 'string'
      ? options.docPath
      : '<input>';
  lines.push(`[audit-lint] ${docLabel}`);
  if (result.parsed && result.parsed.title) {
    lines.push(`  title:       ${result.parsed.title}`);
  }
  if (result.parsed && result.parsed.auditType) {
    lines.push(`  audit-type:  ${result.parsed.auditType}`);
  }
  if (result.parsed && result.parsed.verdict !== undefined) {
    lines.push(`  verdict:     ${result.parsed.verdict || '<none>'}`);
  }
  if (Array.isArray(result.findings) && result.findings.length === 0) {
    lines.push('  findings:    0 (PASS)');
  } else if (Array.isArray(result.findings)) {
    lines.push(`  findings:    ${result.findings.length}`);
    for (const f of result.findings) {
      lines.push(`    [${f.rule}] ${f.message}`);
    }
  }
  return lines.join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* Exports                                                              */
/* ------------------------------------------------------------------ */

module.exports = {
  DEFAULTS,
  parseCliArgs,
  helpText,
  isTemplateFilename,
  parseAuditDoc,
  lintAuditDoc,
  formatFindingsText,
  // Re-export rules for tests + future extensions
  rules,
};
