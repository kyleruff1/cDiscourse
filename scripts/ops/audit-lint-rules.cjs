/**
 * OPS-MCP-SMOKE-DOCTRINE-HARDENING — Audit-lint rules (pure DATA).
 *
 * CommonJS so the Jest default loader can `require()` this without an
 * additional transform. Pure data only: regex bundles, sets, audit-type
 * detection patterns, per-audit-type required/optional phase lists, and
 * the marker string. NO fs, spawn, or network references.
 *
 * Source-of-truth: docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING.md
 * Intent brief:    docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING-intent.md
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Marker                                                              */
/* ------------------------------------------------------------------ */

/**
 * Marker line that gates whether MODIFIED audit docs are linted in CI.
 * ADDED audit docs are linted unconditionally (closes the evasion
 * loophole). The marker is exact-match (case sensitive, single line,
 * no surrounding whitespace beyond end-of-line).
 */
const MARKER_STRING = 'Audit-Lint: v1';

/* ------------------------------------------------------------------ */
/* Audit-type detection                                                */
/* ------------------------------------------------------------------ */

/**
 * Audit-type detection regex bundles. Patterns are tested against the
 * doc's title (line 1). Title containing AMENDMENT or COMPLETION takes
 * precedence over the family-ship / production-enable patterns when
 * both could match. The runner resolves precedence per the
 * `detectAuditType` function in the library.
 */
const AUDIT_TYPE_PATTERNS = Object.freeze({
  productionEnable: [/-ENABLE-SMOKE\b/i],
  familyShip: [/MCP-SERVER-\d+-FAMILY-[A-Z]-SMOKE\b/i],
  amendment: [/AMENDMENT\b/i],
  hostedCompletion: [/COMPLETION\b/i, /\bupgrade\b/i],
  ops: [/^#\s*OPS-/im],
});

/* ------------------------------------------------------------------ */
/* Doctrine-risk families                                              */
/* ------------------------------------------------------------------ */

/**
 * Families that require persisted direct-output inspection (L5).
 * `slippery_slope` is an alias for the doctrinal axis inside Family E
 * (argument_scheme); both names trip the rule.
 */
const DOCTRINE_RISK_FAMILIES = new Set([
  'argument_scheme',
  'slippery_slope',
]);

/* ------------------------------------------------------------------ */
/* Phase mapping per audit type                                        */
/* ------------------------------------------------------------------ */

/**
 * Required phases per audit type, normalized to lower-kebab IDs.
 * Phase IDs are matched substring-style by `normalizePhaseId` against
 * the phase headers in the doc.
 */
const REQUIRED_PHASES_BY_AUDIT_TYPE = Object.freeze({
  'production-enable': new Set([
    'phase-1-preflight',
    'phase-2-auto-trigger-dispatch',
    'phase-3-targeted-signal',
    'phase-4-read-path',
    'phase-5-regression',
  ]),
  'family-ship': new Set([
    'phase-1-preflight',
    'phase-2-local-regression',
    'phase-3-hosted-mcp-smoke',
    'phase-4-edge-admin-validation',
    'phase-5-unsupported-rejection',
    'phase-6-targeted-regression',
  ]),
  amendment: new Set(),
  'hosted-completion': new Set(['phase-1-hosted-mcp-smoke']),
  ops: new Set(['phase-1-preflight']),
});

/**
 * Phases that are explicitly optional per audit type. The runner also
 * accepts a per-doc `(optional)` parenthetical on the phase header to
 * mark a phase as optional ad-hoc.
 */
const OPTIONAL_PHASES_BY_AUDIT_TYPE = Object.freeze({
  'family-ship': new Set([
    'phase-7-ops-observations',
    'phase-4b-doctrine-verification',
  ]),
  'production-enable': new Set([
    'phase-7-ops-observations',
  ]),
  amendment: new Set(),
  'hosted-completion': new Set(),
  ops: new Set(),
});

/**
 * Phases that demand direct-proof evidence (L2). For a phase in this
 * set with status NOT-RUN and verdict PASS, an indirect-proof phrase
 * appearing in the phase's justification text trips L2.
 */
const DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE = Object.freeze({
  'family-ship': new Set([
    'phase-3-hosted-mcp-smoke',
    'phase-4-edge-admin-validation',
  ]),
  'production-enable': new Set([
    'phase-2-auto-trigger-dispatch',
    'phase-3-targeted-signal',
    'phase-4-read-path',
  ]),
  amendment: new Set(),
  'hosted-completion': new Set(),
  ops: new Set(),
});

/* ------------------------------------------------------------------ */
/* L2 — indirect-proof phrase list                                     */
/* ------------------------------------------------------------------ */

/**
 * Phrases that, in a NOT-RUN direct-proof phase's justification, FAIL
 * the audit when verdict is PASS. The `verified via unit tests` regex
 * has a negative-lookahead for `(plus|and|as a supplement)` so unit
 * tests as a supplement to direct proof are allowed.
 */
const L2_INDIRECT_PHRASES = [
  /covered\s+indirectly/i,
  /indirect\s+evidence/i,
  /verified\s+via\s+unit\s+tests?(?!\s+(plus|and|as\s+a\s+supplement))/i,
  /would\s+pass/i,
  /will\s+pass/i,
  /implied\s+by/i,
  /inferred\s+from/i,
  /covered\s+by\s+phase\s+\d+/i,
];

/* ------------------------------------------------------------------ */
/* L3 — production-enable required assertions                          */
/* ------------------------------------------------------------------ */

/**
 * Three required assertion bundles for production-enable audits.
 * Missing any of dispatch / targetedSignal / readPath trips L3.
 */
const PRODUCTION_ENABLE_REQUIRED_ASSERTIONS = Object.freeze({
  dispatch: [
    /auto[-\s]?trigger\s+fires/i,
    /run\s+row\s+status\s*=\s*['"]?success/i,
    /\d+\s+production\s+runs?\s+(created|fired|observed)/i,
    /run_mode\s*=\s*['"]?production['"]?/i,
  ],
  targetedSignal: [
    /≥\s*1\s+positive/i,
    /\bat\s+least\s+1\s+positive/i,
    /positive\s+raw[_\s]?keys?/i,
    /\d+\s+production\s+positives?/i,
    /\bfired\s+\d+\s+(time|positive)/i,
    /targeted\s+(text|signal)/i,
  ],
  readPath: [
    /Source\s+6/i,
    /machineObservationPersistenceQuery/i,
    /read[-\s]path/i,
    /production[-\s]only\s+filter/i,
  ],
});

/* ------------------------------------------------------------------ */
/* L4 — result-row vs run-row-only evidence                            */
/* ------------------------------------------------------------------ */

/**
 * Patterns that constitute valid result-row evidence (at least one
 * positive raw_key on a targeted text). L4 requires at least one of
 * these to be present in the targeted-signal section.
 */
const L4_RESULT_ROW_EVIDENCE = [
  /\d+\s+positive\s+raw\s+keys?/i,
  /raw_key\s*\|\s*confidence\s*\|\s*evidence_span/i,
  /\bfired\s+\d+\s+positive/i,
  /result\s+rows?\s+observed/i,
  /\bat\s+least\s+1\s+positive\s+result\s+row/i,
];

/**
 * Patterns that, when present WITHOUT accompanying result-row
 * evidence, indicate run-row-only language unfit as sole signal proof.
 */
const L4_RUN_ROW_ONLY_LANGUAGE = [
  /run\s+row\s+(success|status=success)(?![^.]*positive)/i,
  /0\s+positives\s+across\s+all/i,
];

/* ------------------------------------------------------------------ */
/* L5 — persisted-output inspection patterns                           */
/* ------------------------------------------------------------------ */

/**
 * Patterns indicating the audit inspected persisted direct output
 * (typically the `evidence_span` column of
 * argument_machine_observation_results). At least one of these is
 * required for doctrine-risk audits.
 */
const L5_PERSISTED_INSPECTION_PATTERNS = [
  /\bevidence_span\b/i,
  /SELECT[\s\S]{0,200}evidence_span/i,
  /\|\s*evidence_span\s*\|/i,
  /persisted\s+evidence/i,
  /direct[-\s]output\s+inspection/i,
];

/* ------------------------------------------------------------------ */
/* L6 — verdict-upgrade provenance patterns                            */
/* ------------------------------------------------------------------ */

/**
 * Patterns indicating the prior verdict is named in the doc.
 */
const L6_PRIOR_VERDICT_PATTERNS = [
  /prior\s+verdict\s*:\s*\b(PASS|PARTIAL|FAIL)\b/i,
  /previously\s+\b(PASS|PARTIAL|FAIL)\b/i,
  /\bPredecessor\s+audit\s*:/i,
  /\(improperly\)/i,
  /Verdict\s*\(amended\)/i,
  /verdict[-\s]upgrade\s+provenance/i,
];

/**
 * Patterns indicating the specific missing proof that capped the
 * prior verdict is named.
 */
const L6_MISSING_PROOF_PATTERNS = [
  /\bGap\s+\d+\b/i,
  /Phase\s+\d+\s+NOT[-\s]?RUN/i,
  /missing\s+proof/i,
  /\bcapped\s+(at|by)\b/i,
];

/**
 * Patterns indicating the newly-supplied proof that lifts the cap is
 * named.
 */
const L6_NEWLY_SUPPLIED_PROOF_PATTERNS = [
  /now\s+supplied/i,
  /operator[-\s]supplied/i,
  /closed\s+(live|by\s+direct)/i,
  /newly\s+(added|supplied)/i,
  /\bGap\s+\d+\s+closed/i,
  /direct\s+proof/i,
];

/* ------------------------------------------------------------------ */
/* Exports                                                              */
/* ------------------------------------------------------------------ */

module.exports = {
  MARKER_STRING,
  AUDIT_TYPE_PATTERNS,
  DOCTRINE_RISK_FAMILIES,
  REQUIRED_PHASES_BY_AUDIT_TYPE,
  OPTIONAL_PHASES_BY_AUDIT_TYPE,
  DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE,
  L2_INDIRECT_PHRASES,
  PRODUCTION_ENABLE_REQUIRED_ASSERTIONS,
  L4_RESULT_ROW_EVIDENCE,
  L4_RUN_ROW_ONLY_LANGUAGE,
  L5_PERSISTED_INSPECTION_PATTERNS,
  L6_PRIOR_VERDICT_PATTERNS,
  L6_MISSING_PROOF_PATTERNS,
  L6_NEWLY_SUPPLIED_PROOF_PATTERNS,
};
