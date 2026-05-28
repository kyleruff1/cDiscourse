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
/* Text-normalization helpers                                          */
/* ------------------------------------------------------------------ */

/**
 * Strip BOM (UTF-8 BOM at start of file) before splitting lines.
 * Node's default UTF-8 file read does NOT strip BOM, so the runner
 * passes raw text through this helper before tokenizing.
 */
function stripBom(text) {
  if (typeof text !== 'string') {
    return '';
  }
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Split text into lines tolerating both LF and CRLF endings.
 */
function splitLines(text) {
  return stripBom(text).split(/\r?\n/);
}

/* ------------------------------------------------------------------ */
/* Audit-type detection                                                */
/* ------------------------------------------------------------------ */

/**
 * Detect the audit type from the title (line 1) and body. AMENDMENT
 * and COMPLETION take precedence over ENABLE-SMOKE / FAMILY-SHIP
 * because amendment/completion docs may reference the predecessor's
 * card code in their title (e.g.
 * "MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT").
 */
function detectAuditType(title, body) {
  const safeTitle = typeof title === 'string' ? title : '';
  const safeBody = typeof body === 'string' ? body : '';

  // Doc-level override has highest priority.
  const override = safeBody.match(/^Audit-type:\s*([\w-]+)/m);
  if (override) {
    return override[1].toLowerCase();
  }

  const hostedCompletionHit = rules.AUDIT_TYPE_PATTERNS.hostedCompletion.some(
    (re) => re.test(safeTitle),
  );
  if (hostedCompletionHit) {
    return 'hosted-completion';
  }

  const amendmentHit = rules.AUDIT_TYPE_PATTERNS.amendment.some((re) =>
    re.test(safeTitle),
  );
  if (amendmentHit) {
    return 'amendment';
  }

  const productionEnableHit = rules.AUDIT_TYPE_PATTERNS.productionEnable.some(
    (re) => re.test(safeTitle),
  );
  if (productionEnableHit) {
    return 'production-enable';
  }

  const familyShipHit = rules.AUDIT_TYPE_PATTERNS.familyShip.some((re) =>
    re.test(safeTitle),
  );
  if (familyShipHit) {
    return 'family-ship';
  }

  const opsHit = rules.AUDIT_TYPE_PATTERNS.ops.some((re) =>
    re.test(safeTitle),
  );
  if (opsHit) {
    return 'ops';
  }

  return 'unknown';
}

/* ------------------------------------------------------------------ */
/* Family detection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Detect the audit's family from title + body declarations. Returns
 * null when no family can be determined.
 */
function detectFamily(title, body) {
  const safeTitle = typeof title === 'string' ? title : '';
  const safeBody = typeof body === 'string' ? body : '';

  // Doc-level declaration has highest priority.
  const decl = safeBody.match(/^Family\s*:\s*([\w-]+)/im);
  if (decl) {
    return decl[1].toLowerCase().replace(/-/g, '_');
  }

  // Look for explicit family-name references in body for Family E
  // (the argument_scheme / slippery_slope axis).
  if (
    /\bargument_scheme\b/.test(safeBody) ||
    /\bslippery_slope\b/.test(safeBody) ||
    /\bslippery\s+slope\b/i.test(safeBody)
  ) {
    return 'argument_scheme';
  }

  // Family letter from title (MCP-SERVER-006-FAMILY-E => family-letter "E").
  const letterMatch = safeTitle.match(/MCP-SERVER-\d+-FAMILY-([A-Z])/i);
  if (letterMatch) {
    return `family_${letterMatch[1].toLowerCase()}`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Phase-id normalization                                              */
/* ------------------------------------------------------------------ */

/**
 * Normalize a phase header line into a kebab-case phase ID.
 *
 * Examples:
 *   "## Phase 3 — Hosted MCP server smoke" -> "phase-3-hosted-mcp-smoke"
 *   "## Phase 4 — Edge admin_validation"   -> "phase-4-edge-admin-validation"
 *   "## Amendment §5 — Read-path readback" -> "amendment-5-read-path-readback"
 *
 * The semantic substring tail is preserved (lower-kebab) for L1's
 * required-phase set lookups.
 */
function normalizePhaseId(rawHeader) {
  if (typeof rawHeader !== 'string') {
    return '';
  }

  // Strip leading `##` markers and surrounding whitespace.
  let header = rawHeader.replace(/^#+\s*/, '').trim();

  // Match `Phase 3 — name` / `Phase 3.5 — name` / `Amendment §5 — name`.
  let kind = null;
  let number = null;
  let suffix = '';

  const phaseMatch = header.match(/^Phase\s+(\d+(?:\.\d+)?(?:[a-z])?)\s*(?:[—\-:]+\s*(.+))?$/i);
  if (phaseMatch) {
    kind = 'phase';
    number = phaseMatch[1];
    suffix = phaseMatch[2] || '';
  }

  const amendmentMatch = header.match(/^Amendment\s+§?\s*(\d+)\s*(?:[—\-:]+\s*(.+))?$/i);
  if (amendmentMatch) {
    kind = 'amendment';
    number = amendmentMatch[1];
    suffix = amendmentMatch[2] || '';
  }

  if (!kind) {
    // Fallback — slugify the full header.
    return header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const slug = suffix
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]+/g, ' ')
    .replace(/_+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Specific known phase identifiers — fold common variants down to
  // the canonical form so the rules-file phase-id sets match cleanly.
  const canonicalSlug = canonicalizePhaseSlug(slug, kind, number);

  if (canonicalSlug) {
    return `${kind}-${number}-${canonicalSlug}`;
  }
  return `${kind}-${number}`;
}

/**
 * Canonicalize the slug portion of a phase id so common header
 * variants map to a single canonical phase id. This is the layer
 * where regex-tolerated header phrasing meets the strict
 * `phase-N-canonical-name` keys in the rules file.
 */
function canonicalizePhaseSlug(slug, kind, _number) {
  if (kind !== 'phase' && kind !== 'amendment') {
    return slug;
  }
  // Hosted MCP smoke variants
  if (/hosted[\s-]*mcp(?:[\s-]*(server|smoke))*/i.test(slug)) {
    return 'hosted-mcp-smoke';
  }
  if (/^hosted-mcp$/.test(slug)) {
    return 'hosted-mcp-smoke';
  }
  // Pre-flight variants
  if (/^pre-?flight$/.test(slug) || /^preflight$/.test(slug)) {
    return 'preflight';
  }
  if (/^pre-flight$/.test(slug)) {
    return 'preflight';
  }
  // Local regression variants
  if (/^local-deno-regression$/.test(slug) || /^local-regression$/.test(slug)) {
    return 'local-regression';
  }
  if (/^local-deno-regression-/.test(slug)) {
    return 'local-regression';
  }
  // Edge admin_validation variants
  if (/^edge-admin-validation$/.test(slug) || /^edge-admin/.test(slug)) {
    return 'edge-admin-validation';
  }
  // Unsupported-family rejection variants
  if (/^unsupported-family-rejection$/.test(slug) || /^unsupported-rejection$/.test(slug)) {
    return 'unsupported-rejection';
  }
  // Targeted regression variants
  if (/^targeted-regression$/.test(slug) || /^targeted-family-/.test(slug)) {
    return 'targeted-regression';
  }
  // Auto-trigger dispatch variants
  if (/^auto-trigger-dispatch$/.test(slug) || /^auto-trigger$/.test(slug)) {
    return 'auto-trigger-dispatch';
  }
  // Targeted-signal variants
  if (/^targeted-signal$/.test(slug) || /^targeted-classifier-signal$/.test(slug)) {
    return 'targeted-signal';
  }
  // Read-path variants
  if (/^read-path$/.test(slug) || /^source-6$/.test(slug) || /^source-6-/.test(slug)) {
    return 'read-path';
  }
  // Regression variants
  if (/^regression$/.test(slug)) {
    return 'regression';
  }
  // OPS observations
  if (/^ops-observations?$/.test(slug)) {
    return 'ops-observations';
  }
  // Doctrine verification
  if (/^doctrine-verification$/.test(slug) || /^slippery-slope-(doctrine|verification)/.test(slug)) {
    return 'doctrine-verification';
  }
  return slug;
}

/* ------------------------------------------------------------------ */
/* parseAuditDoc                                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse an audit doc into a structured representation. Pure function;
 * operates on the doc text only. Returns the full structured shape
 * even when the doc is malformed — downstream rules handle missing
 * fields gracefully.
 */
function parseAuditDoc(text) {
  const lines = splitLines(text);
  const body = lines.join('\n');

  // Title (line 1) — strip leading `#` markers.
  const titleRaw = lines.length > 0 ? lines[0] : '';
  const title = titleRaw.replace(/^#+\s*/, '').trim();

  const auditType = detectAuditType(titleRaw, body);
  const family = detectFamily(titleRaw, body);
  const hasMarker = body.split('\n').some((line) => line.trim() === rules.MARKER_STRING);

  // Phase header detection. Tracks fence-state to skip code blocks.
  const phases = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const phaseHeader = line.match(/^##\s+(Phase\s+\d+(?:\.\d+)?(?:[a-z])?|Amendment\s+§?\s*\d+)\b/i);
    if (phaseHeader) {
      phases.push({
        id: normalizePhaseId(line),
        rawHeader: line,
        headerLineNumber: i + 1,
        status: null,
        statusLineNumber: null,
        justificationText: '',
        explicitlyOptional: /\(optional\)/i.test(line) ||
                            /\(operator-token-gated\)/i.test(line),
      });
    }
  }

  // For each phase, slice the justification text and locate its
  // status line. Use line-index ranges from the previous pass.
  for (let p = 0; p < phases.length; p += 1) {
    const phase = phases[p];
    const startLine = phase.headerLineNumber; // 1-indexed; lines[startLine] is just after header
    const endLine =
      p + 1 < phases.length ? phases[p + 1].headerLineNumber - 1 : lines.length;
    const sliceLines = lines.slice(startLine, endLine);
    phase.justificationText = sliceLines.join('\n');

    // Find the **Status:** line within the phase body, skipping
    // fenced code blocks.
    let phaseFence = false;
    for (let i = 0; i < sliceLines.length; i += 1) {
      const sl = sliceLines[i];
      if (/^```/.test(sl)) {
        phaseFence = !phaseFence;
        continue;
      }
      if (phaseFence) {
        continue;
      }
      const m = sl.match(/^\*{0,2}\s*Status\s*:?\s*\*{0,2}\s*(PASS|PARTIAL|FAIL|NOT-RUN)\b/i);
      if (m) {
        phase.status = m[1].toUpperCase();
        phase.statusLineNumber = startLine + i + 1;
        break;
      }
    }
  }

  // Verdict header detection — match a hierarchy of header forms in
  // priority order. The LAST matching header in the doc wins (amendment
  // / completion docs put their final verdict at end-of-doc).
  const verdictHeaderRegex = /^(##|###)\s+(Final\s+)?(amended\s+|upgraded\s+)?[Vv]erdict\b/;
  let verdictHeaderLineNumber = null;
  inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    if (verdictHeaderRegex.test(line)) {
      verdictHeaderLineNumber = i + 1;
    }
  }

  let verdict = null;
  if (verdictHeaderLineNumber !== null) {
    // Look at the header line itself + the next 5 non-empty lines.
    let scanned = 0;
    let idx = verdictHeaderLineNumber - 1;
    let verdictFence = false;
    while (idx < lines.length && scanned < 6) {
      const line = lines[idx];
      if (/^```/.test(line)) {
        verdictFence = !verdictFence;
        idx += 1;
        continue;
      }
      if (verdictFence) {
        idx += 1;
        continue;
      }
      // Skip empty lines (do not count toward the 6 budget; only
      // count non-empty meaningful lines).
      if (line.trim().length === 0) {
        idx += 1;
        continue;
      }
      // Match `**PASS**`, `**PARTIAL**`, `**FAIL**` with optional
      // surrounding punctuation. Ignore tokens with a trailing `?`
      // in a doc-question form.
      const tagMatch = line.match(/\*\*(PASS|PARTIAL|FAIL)\*\*/);
      if (tagMatch) {
        verdict = tagMatch[1].toUpperCase();
        break;
      }
      idx += 1;
      scanned += 1;
    }
  }

  return {
    title,
    auditType,
    hasMarker,
    family,
    verdict,
    verdictHeaderLineNumber,
    phases,
  };
}

/* ------------------------------------------------------------------ */
/* lintAuditDoc — stub; L1-L6 land in C3                              */
/* ------------------------------------------------------------------ */

/**
 * Apply L1-L6 rules. C2 returns the parsed doc with no findings; C3
 * fills in L1-L6.
 */
function lintAuditDoc(text, _options) {
  const parsed = parseAuditDoc(text);
  if (parsed.verdict === null && parsed.phases.length === 0 && parsed.auditType === 'unknown') {
    // Unparseable doc — surface as exitCode 2 per CLI contract.
    return {
      exitCode: 2,
      parsed,
      findings: [
        {
          rule: 'parse',
          severity: 'error',
          message: 'Could not extract title, audit type, or verdict from doc.',
          details: {},
          line: null,
        },
      ],
    };
  }
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
  stripBom,
  splitLines,
  detectAuditType,
  detectFamily,
  normalizePhaseId,
  parseAuditDoc,
  lintAuditDoc,
  formatFindingsText,
  // Re-export rules for tests + future extensions
  rules,
};
