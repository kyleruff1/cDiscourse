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

  // Precedence: AMENDMENT before COMPLETION because an amendment doc
  // may name its goal ("smoke-completion") in a parenthetical without
  // being a hosted-completion audit. The hosted-completion type is
  // reserved for docs whose primary subject IS the completion (no
  // AMENDMENT marker in the title).
  const amendmentHit = rules.AUDIT_TYPE_PATTERNS.amendment.some((re) =>
    re.test(safeTitle),
  );
  if (amendmentHit) {
    return 'amendment';
  }

  const hostedCompletionHit = rules.AUDIT_TYPE_PATTERNS.hostedCompletion.some(
    (re) => re.test(safeTitle),
  );
  if (hostedCompletionHit) {
    return 'hosted-completion';
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
 *
 * Precedence:
 *   1. Doc-level `Family:` declaration in the body (highest authority).
 *   2. Title pattern `MCP-SERVER-NNN-FAMILY-X` mapped to a family name
 *      via the family-letter table (so a Family D audit that mentions
 *      argument_scheme in passing is still classified as Family D).
 *   3. Title pattern `EDGE-FAMILY-X-ENABLE` for production-enable
 *      audits.
 *   4. Body mention of argument_scheme / slippery_slope ONLY when no
 *      title family-letter pattern matched. This is the fallback for
 *      OPS docs or amendment docs whose title omits the family letter.
 */
function detectFamily(title, body) {
  const safeTitle = typeof title === 'string' ? title : '';
  const safeBody = typeof body === 'string' ? body : '';

  // 1. Doc-level declaration has highest priority.
  const decl = safeBody.match(/^Family\s*:\s*([\w-]+)/im);
  if (decl) {
    return decl[1].toLowerCase().replace(/-/g, '_');
  }

  // 2. Family letter from MCP-SERVER-NNN-FAMILY-X title pattern.
  let letterMatch = safeTitle.match(/MCP-SERVER-\d+-FAMILY-([A-Z])/i);
  if (letterMatch) {
    return mapFamilyLetterToName(letterMatch[1]);
  }

  // 3. Family letter from EDGE-FAMILY-X-ENABLE title pattern.
  letterMatch = safeTitle.match(/EDGE-FAMILY-([A-Z])-ENABLE/i);
  if (letterMatch) {
    return mapFamilyLetterToName(letterMatch[1]);
  }

  // 4. Body mention fallback — only when title gave nothing.
  if (
    /\bargument_scheme\b/.test(safeBody) ||
    /\bslippery_slope\b/.test(safeBody) ||
    /\bslippery\s+slope\b/i.test(safeBody)
  ) {
    return 'argument_scheme';
  }

  return null;
}

/**
 * Map the family-letter code (A-J) to the canonical family name used
 * by the rules-file DOCTRINE_RISK_FAMILIES set. Unmapped letters fall
 * back to `family_<letter>` so the linter is conservative.
 */
function mapFamilyLetterToName(letter) {
  const upper = String(letter).toUpperCase();
  switch (upper) {
    case 'A':
      return 'parent_relation';
    case 'B':
      return 'disagreement_axis';
    case 'C':
      return 'misunderstanding_repair';
    case 'D':
      return 'evidence_source_chain';
    case 'E':
      return 'argument_scheme';
    default:
      return `family_${upper.toLowerCase()}`;
  }
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
 * `phase-N-canonical-name` keys in the rules file. Uses SUBSTRING
 * matching (not anchored) because real audit headers carry extra
 * trailing context like "(15 checks)" or "F/G/H/I/J rejection
 * regression".
 */
function canonicalizePhaseSlug(slug, kind, _number) {
  if (kind !== 'phase' && kind !== 'amendment') {
    return slug;
  }
  // Hosted MCP smoke variants
  if (/hosted[-\s]*mcp/.test(slug)) {
    return 'hosted-mcp-smoke';
  }
  // Pre-flight variants
  if (/pre-?flight/.test(slug) || /^preflight$/.test(slug)) {
    return 'preflight';
  }
  // Local regression variants — must check BEFORE generic 'regression'
  if (/local[-\s]*(deno[-\s]*)?regression/.test(slug)) {
    return 'local-regression';
  }
  // Edge admin_validation variants
  if (/edge[-\s]*admin/.test(slug)) {
    return 'edge-admin-validation';
  }
  // Unsupported-family rejection variants — match any `unsupported`+`rejection`
  if (/unsupported.*rejection/.test(slug)) {
    return 'unsupported-rejection';
  }
  // Doctrine verification variants — match `slippery_slope` + `doctrine` or `verification`
  if (
    /slippery[-_]?slope/.test(slug) &&
    /(doctrine|verification)/.test(slug)
  ) {
    return 'doctrine-verification';
  }
  if (/doctrine[-\s]*verification/.test(slug)) {
    return 'doctrine-verification';
  }
  // Auto-trigger dispatch variants
  if (/auto[-\s]*trigger/.test(slug)) {
    return 'auto-trigger-dispatch';
  }
  // Targeted-signal variants — must check BEFORE generic 'targeted-regression'
  if (/targeted[-\s]*(classifier[-\s]*)?signal/.test(slug)) {
    return 'targeted-signal';
  }
  // Targeted regression variants
  if (/targeted[-\s]*(family[-\s]*)?(regression|family)/.test(slug)) {
    return 'targeted-regression';
  }
  // Read-path variants
  if (/read[-\s]*path/.test(slug) || /source[-\s]*6/.test(slug)) {
    return 'read-path';
  }
  // OPS observations
  if (/ops[-\s]*observations?/.test(slug)) {
    return 'ops-observations';
  }
  // Generic regression (catches just "Regression" alone)
  if (/^regression$/.test(slug) || /^regression[-\s]/.test(slug)) {
    return 'regression';
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

  // Title: first non-empty line that is not an HTML comment. Fixtures
  // prepend an `<!-- AUDIT-LINT-FIXTURE ... -->` marker; the parser
  // skips leading HTML comments + blank lines to find the title.
  let titleLineIdx = 0;
  while (titleLineIdx < lines.length) {
    const l = lines[titleLineIdx].trim();
    if (l.length === 0) {
      titleLineIdx += 1;
      continue;
    }
    if (l.startsWith('<!--') && l.endsWith('-->')) {
      titleLineIdx += 1;
      continue;
    }
    if (l.startsWith('<!--') && !l.endsWith('-->')) {
      // Multi-line HTML comment — advance past `-->` close.
      titleLineIdx += 1;
      while (titleLineIdx < lines.length && !lines[titleLineIdx].includes('-->')) {
        titleLineIdx += 1;
      }
      titleLineIdx += 1;
      continue;
    }
    break;
  }
  const titleRaw = titleLineIdx < lines.length ? lines[titleLineIdx] : '';
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
/* L1-L6 rule implementations                                          */
/* ------------------------------------------------------------------ */

/**
 * Sort findings deterministically — by rule id (ASCII), then by
 * line number ascending. Used by `lintAuditDoc` to ensure stable
 * output across runs (HALT trigger 11).
 */
function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    if (a.rule !== b.rule) {
      return a.rule < b.rule ? -1 : 1;
    }
    const al = typeof a.line === 'number' ? a.line : Number.MAX_SAFE_INTEGER;
    const bl = typeof b.line === 'number' ? b.line : Number.MAX_SAFE_INTEGER;
    return al - bl;
  });
}

/**
 * L1 — Required phase NOT-RUN + verdict PASS fails (R1/R2).
 */
function applyL1(parsed) {
  const required = rules.REQUIRED_PHASES_BY_AUDIT_TYPE[parsed.auditType];
  if (!required || required.size === 0) {
    return [];
  }
  if (parsed.verdict !== 'PASS') {
    return [];
  }
  const optional = rules.OPTIONAL_PHASES_BY_AUDIT_TYPE[parsed.auditType] || new Set();
  const findings = [];
  const notRunRequired = [];
  for (const phase of parsed.phases) {
    if (phase.explicitlyOptional) {
      continue;
    }
    if (phase.status !== 'NOT-RUN') {
      continue;
    }
    if (!required.has(phase.id)) {
      continue;
    }
    if (optional.has(phase.id)) {
      continue;
    }
    notRunRequired.push({ id: phase.id, line: phase.headerLineNumber });
  }
  if (notRunRequired.length > 0) {
    findings.push({
      rule: 'L1',
      severity: 'error',
      message:
        'Required phase(s) NOT-RUN but verdict is PASS — under R1/R2 the verdict CANNOT exceed PARTIAL.',
      details: {
        verdict: parsed.verdict,
        notRunRequiredPhases: notRunRequired.map((p) => p.id),
        remedy:
          'Either run the phase to PASS, OR downgrade verdict to PARTIAL, OR explicitly mark the phase optional with rationale.',
      },
      line: notRunRequired[0].line,
    });
  }
  return findings;
}

/**
 * L2 — Indirect-proof phrase in a NOT-RUN direct-proof phase's
 * justification with verdict PASS fails (R2/R4).
 */
function applyL2(parsed) {
  const directRequired =
    rules.DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE[parsed.auditType];
  if (!directRequired || directRequired.size === 0) {
    return [];
  }
  if (parsed.verdict !== 'PASS') {
    return [];
  }
  const findings = [];
  for (const phase of parsed.phases) {
    if (phase.status !== 'NOT-RUN') {
      continue;
    }
    if (!directRequired.has(phase.id)) {
      continue;
    }
    for (const phraseRegex of rules.L2_INDIRECT_PHRASES) {
      const m = phase.justificationText.match(phraseRegex);
      if (m) {
        const snippet = extractSnippet(phase.justificationText, m.index, m[0]);
        findings.push({
          rule: 'L2',
          severity: 'error',
          message:
            "Direct-proof-required phase justified by indirect-proof phrase — R4 forbids substitution.",
          details: {
            phaseId: phase.id,
            phrase: m[0],
            snippet,
            remedy:
              'Either run the direct proof (e.g., hosted MCP 17/17), OR downgrade verdict to PARTIAL.',
          },
          line: phase.headerLineNumber,
        });
        // One finding per phase is enough — break after first phrase match.
        break;
      }
    }
  }
  return findings;
}

/**
 * Extract a short context snippet around a regex match for the
 * finding detail. Caps at 120 characters.
 */
function extractSnippet(text, matchIndex, matchText) {
  if (typeof matchIndex !== 'number' || matchIndex < 0) {
    return matchText || '';
  }
  const before = Math.max(0, matchIndex - 30);
  const after = Math.min(text.length, matchIndex + matchText.length + 30);
  return text.slice(before, after).replace(/\s+/g, ' ').trim();
}

/**
 * L3 — Production-enable audits must have all three assertion levels
 * (dispatch, targetedSignal, readPath).
 */
function applyL3(parsed, fullDocText) {
  if (parsed.auditType !== 'production-enable') {
    return [];
  }
  const found = { dispatch: false, targetedSignal: false, readPath: false };
  for (const key of Object.keys(found)) {
    const patterns = rules.PRODUCTION_ENABLE_REQUIRED_ASSERTIONS[key] || [];
    found[key] = patterns.some((re) => re.test(fullDocText));
  }
  const missing = Object.keys(found).filter((k) => !found[k]);
  if (missing.length === 0) {
    return [];
  }
  return [
    {
      rule: 'L3',
      severity: 'error',
      message:
        'Production-enable audit missing assertion(s) for: ' + missing.join(', '),
      details: {
        missingLevels: missing,
        presentLevels: Object.keys(found).filter((k) => found[k]),
        remedy:
          'Add a section demonstrating each missing level (dispatch, targetedSignal, readPath).',
      },
      line: null,
    },
  ];
}

/**
 * L4 — Production-enable targeted-signal must include at least one
 * positive result-row, not just a successful run-row.
 */
function applyL4(parsed, fullDocText) {
  if (parsed.auditType !== 'production-enable') {
    return [];
  }
  const signalText = extractTargetedSignalSection(parsed, fullDocText);
  if (!signalText) {
    return [];
  }
  const hasResultRow = rules.L4_RESULT_ROW_EVIDENCE.some((re) =>
    re.test(signalText),
  );
  const hasRunRowOnly = rules.L4_RUN_ROW_ONLY_LANGUAGE.some((re) =>
    re.test(signalText),
  );
  if (hasResultRow) {
    return [];
  }
  if (hasRunRowOnly || !hasResultRow) {
    return [
      {
        rule: 'L4',
        severity: 'error',
        message:
          'Production-enable targeted-signal claim is run-row-only; no positive result row evidence found.',
        details: {
          remedy:
            'Cite at least 1 positive result row with raw_key + confidence + evidence_span_len, on text deliberately targeted to fire a classifier signal.',
        },
        line: null,
      },
    ];
  }
  return [];
}

/**
 * Locate the targeted-signal section of a production-enable audit.
 * Looks for any phase whose canonical id is `phase-N-targeted-signal`;
 * falls back to scanning the full text for the assertion bundle.
 */
function extractTargetedSignalSection(parsed, fullDocText) {
  for (const phase of parsed.phases) {
    if (/-targeted-signal$/.test(phase.id)) {
      return phase.justificationText;
    }
  }
  return fullDocText;
}

/**
 * L5 — Doctrine-risk audits must inspect persisted direct output.
 */
function applyL5(parsed, fullDocText) {
  const bodyOverride = fullDocText.match(/^Doctrine-risk:\s*(true|false)\b/im);
  let isDoctrineRisk = false;
  if (bodyOverride) {
    isDoctrineRisk = bodyOverride[1].toLowerCase() === 'true';
  } else {
    isDoctrineRisk = !!parsed.family && rules.DOCTRINE_RISK_FAMILIES.has(parsed.family);
  }
  if (!isDoctrineRisk) {
    return [];
  }
  const hasInspection = rules.L5_PERSISTED_INSPECTION_PATTERNS.some((re) =>
    re.test(fullDocText),
  );
  if (hasInspection) {
    return [];
  }
  return [
    {
      rule: 'L5',
      severity: 'error',
      message:
        'Doctrine-risk audit does not inspect persisted direct output (evidence_span or equivalent).',
      details: {
        family: parsed.family,
        remedy:
          'Add a SQL readback section that queries argument_machine_observation_results.evidence_span for the test runs and inspects rows for doctrine compliance.',
      },
      line: null,
    },
  ];
}

/**
 * L6 — Verdict upgrades carry provenance: prior verdict, missing
 * proof, newly-supplied proof.
 */
function applyL6(parsed, fullDocText) {
  const isAmendment =
    parsed.auditType === 'amendment' ||
    parsed.auditType === 'hosted-completion' ||
    /AMENDMENT|COMPLETION|upgrade/i.test(parsed.title) ||
    /^Prior\s+verdict\s*:/im.test(fullDocText) ||
    /^Predecessor\s+audit\s*:/im.test(fullDocText);
  if (!isAmendment) {
    return [];
  }
  const hasPriorVerdict = rules.L6_PRIOR_VERDICT_PATTERNS.some((re) =>
    re.test(fullDocText),
  );
  const hasMissingProof = rules.L6_MISSING_PROOF_PATTERNS.some((re) =>
    re.test(fullDocText),
  );
  const hasNewlySupplied = rules.L6_NEWLY_SUPPLIED_PROOF_PATTERNS.some((re) =>
    re.test(fullDocText),
  );
  const present = [];
  const missing = [];
  if (hasPriorVerdict) {
    present.push('priorVerdict');
  } else {
    missing.push('priorVerdict');
  }
  if (hasMissingProof) {
    present.push('missingProof');
  } else {
    missing.push('missingProof');
  }
  if (hasNewlySupplied) {
    present.push('newlySuppliedProof');
  } else {
    missing.push('newlySuppliedProof');
  }
  if (missing.length === 0) {
    return [];
  }
  return [
    {
      rule: 'L6',
      severity: 'error',
      message:
        'Verdict upgrade missing provenance for: ' + missing.join(', '),
      details: {
        missingComponents: missing,
        presentComponents: present,
        remedy:
          'Name the specific newly-supplied proof that lifts the prior cap (e.g., "operator-supplied hosted smoke 17/17 PASS").',
      },
      line: null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* lintAuditDoc                                                        */
/* ------------------------------------------------------------------ */

/**
 * Apply L1-L6 rules to a parsed audit doc. Returns deterministic
 * findings sorted by rule id then line number. Exit code 0 when no
 * findings; 1 when one or more findings; 2 on parse failure.
 */
function lintAuditDoc(text, _options) {
  const parsed = parseAuditDoc(text);
  if (parsed.verdict === null && parsed.phases.length === 0 && parsed.auditType === 'unknown') {
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

  const fullText = stripBom(text || '');
  const findings = [];
  findings.push(...applyL1(parsed));
  findings.push(...applyL2(parsed));
  findings.push(...applyL3(parsed, fullText));
  findings.push(...applyL4(parsed, fullText));
  findings.push(...applyL5(parsed, fullText));
  findings.push(...applyL6(parsed, fullText));
  const sorted = sortFindings(findings);
  return {
    exitCode: sorted.length === 0 ? 0 : 1,
    parsed,
    findings: sorted,
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
  mapFamilyLetterToName,
  normalizePhaseId,
  parseAuditDoc,
  lintAuditDoc,
  formatFindingsText,
  sortFindings,
  applyL1,
  applyL2,
  applyL3,
  applyL4,
  applyL5,
  applyL6,
  // Re-export rules for tests + future extensions
  rules,
};
