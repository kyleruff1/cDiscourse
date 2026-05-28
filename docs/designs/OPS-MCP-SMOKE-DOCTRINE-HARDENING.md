# OPS-MCP-SMOKE-DOCTRINE-HARDENING — Audit-Lint Enforcement for Direct-Proof Obligations

**Status:** Design draft (designer Stage 1 output)
**Epic:** OPS — process / audit-integrity tooling
**Release:** N/A (operator process tooling)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/339
**Intent brief:** `docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING-intent.md` (commit `15b65c6`)
**Branch:** `feat/OPS-MCP-SMOKE-DOCTRINE-HARDENING` (from `main` at `15b65c6`)

---

## Goal (one paragraph)

Encode the operator's audit-integrity rules **R1-R4** into a mechanical, read-only audit linter (`L1-L6`) that catches at authoring time the class of defect that produced the `29f30b0` Family E **improper-PASS** audit (Phase 3 hosted MCP marked "NOT-RUN, covered indirectly via Phase 4 success"; verdict PASS). Doctrine that drives this card: **§1 score-is-not-truth** and **§4 AI moderator limits** do not apply (this card touches no scoring or AI surface), but the operator's binding doctrine on **proof obligations** (direct proof is not substitutable by indirect evidence; NOT-RUN caps verdict at PARTIAL; verdict upgrades carry provenance) is what L1-L6 mechanize. The linter is **READ-ONLY** over the audit corpus — it never edits an audit doc. The linter is **self-validating** against 4 historical-doc fixtures (3 from the Family E arc + 1 from the Family D strengthened amendment). **CI wiring is expected to defer to PARTIAL** because `.github/workflows/` does not exist in this repo (trigger 9 fires).

---

## Phase A audits (mandatory)

### Phase A.1 — Audit-format parse model (Scope reality)

**Real audit doc corpus surveyed (8 docs):**

| Doc | Type | Header style | Verdict style | Phase-status style |
| --- | --- | --- | --- | --- |
| `MCP-SERVER-006-FAMILY-E-SMOKE-2026-05-27.md` (29f30b0) | family-ship original | `## Verdict` (section); `### Final verdict` | `**PASS** — ...` (after `## Verdict`) | `**Status:** PASS / NOT-RUN` per `## Phase N` |
| `MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT-2026-05-28.md` (b1829f5) | amendment | `## Verdict (amended)` | `**PARTIAL** — Per R2 ...` | `**Status:** PASS / NOT-RUN` per `## Phase N` |
| `MCP-SERVER-006-FAMILY-E-SMOKE-COMPLETION-HOSTED-2026-05-28.md` (bccb0c2) | hosted-completion / upgrade | `## Final upgraded verdict` + provenance table | `**PASS** — both gaps now closed ...` | `**Status:** PASS` per `## Phase 1` |
| `MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-AMENDMENT-2026-05-27.md` (b324dae) | amendment / strengthened | `## Verdict (amended)`; `## Final amended verdict` | `**PASS** — all 9 strengthened criteria ...` | `**Status:** PASS / NOT-RUN` per `## Amendment §N` (variant: §, not Phase) |
| `MCP-SERVER-005-FAMILY-D-SMOKE-2026-05-27.md` | family-ship original | `## Verdict` | `**PASS** — Family D admin_validation ...` | `**Status:** PASS / NOT-RUN` per `## Phase N` |
| `MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md` | family-ship original | `## Verdict` | `**PASS.** Family B is operational ...` | `**Status:** PASS` per `## Phase N` |
| `MCP-SERVER-004-FAMILY-C-SMOKE-2026-05-27.md` | family-ship original | `## Verdict` | `**PASS.** All 8 phases ...` | `**Status:** PASS` per `## Phase N` |
| `MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-2026-05-27.md` | production-enable | `## Verdict` | `**PASS** — 4-family ...` | `**Status:** PASS` per `## Phase N` |

**Consistent structure the linter parses:**

1. **Top-level title** `# <CARD>-<KIND> — <subtitle>` at line 1 — used for audit-type detection (`-ENABLE`, `-AMENDMENT`, `-COMPLETION`, `-template`).
2. **Audit doctrine** declaration in body: `**Audit doctrine:** Verifies <family> works end-to-end ...` — currently advisory only; not parsed.
3. **Verdict header** — one of (priority order): `## Final upgraded verdict`, `## Final amended verdict`, `### Final verdict`, `## Verdict (amended)`, `## Verdict`. The linter accepts ALL FIVE forms.
4. **Verdict tag** — the first all-caps token in `\b(PASS|PARTIAL|FAIL)\b` appearing after the verdict header on the SAME line OR within the next 5 non-empty lines (tolerates both `**PASS** — ...` on a new line AND `## Verdict\n\n**PASS** ...` patterns). NOT-RUN never appears as the verdict; it is a phase-status only.
5. **Phase headers** — `## Phase N — <name>` OR `## Phase N.M — <name>` OR `## Amendment §N — <name>` (Family D amendment variant). The linter parses ALL THREE forms; "Amendment §N" is normalized to a phase.
6. **Phase status** — `**Status:** PASS|PARTIAL|FAIL|NOT-RUN` on a single line within the phase body (≥1 status line per phase header). Tolerance: `**Status:**\s*(PASS|PARTIAL|FAIL|NOT-RUN)` regex; case-insensitive on the status; bold or unbold tolerated.
7. **Phase justification text** — the prose body between the `## Phase N` header and the next `## Phase` (or end-of-doc). This is the search corpus for L2 indirect-proof phrase detection.
8. **Amendment markers** — title contains `AMENDMENT`, `COMPLETION`, `upgrade` (case-insensitive); OR the doc body has a "Predecessor audit:" line declaring a prior audit; OR a verdict-upgrade provenance table.
9. **Marker line** — `Audit-Lint: v1` on its own line within the first 50 lines of the doc. NEW docs going forward will carry this; historical docs do not.

**Format variance the linter MUST tolerate:**

| Variance | Example | Linter accommodation |
| --- | --- | --- |
| `## Verdict` vs `### Final verdict` vs `## Final amended verdict` | All 5 forms observed | Regex matches any of `^(##|###)\s+(Final\s+)?(amended\s+)?(upgraded\s+)?[Vv]erdict\b` |
| `**PASS** — ...` vs `**PASS.** ...` vs `**PASS**\n\n...` | Family B uses `**PASS.**`; Family E uses `**PASS** —` | Verdict-tag regex `\*\*(PASS|PARTIAL|FAIL)\*\*` ignores trailing punctuation |
| `## Phase N` vs `## Phase N.M` vs `## Amendment §N` | Family D amendment uses `## Amendment §N` | Normalize all three to a "phase" entity with `id` + `status` + `justificationText` |
| `**Status:** PASS` vs `**Status:**\n\nPASS` vs `Status: PASS` | All observed | Accept `^\*?\*?\s*Status\s*:?\*?\*?\s*(PASS\|PARTIAL\|FAIL\|NOT-RUN)\b` case-insensitive |
| Verdict appears on header line OR within next 5 non-empty lines | Both observed | Two-pass scan: header line first, then next 5 lines |
| Provenance table (hosted-completion docs) | `\| Original ... \| 29f30b0 \| PASS (improperly) \|` | Markdown table parser keyed off pipe characters; used by L6 only |

**Out-of-scope for parsing (intentional; deferred to OPS-MCP-AUDIT-SCHEMA-V2):**
- YAML front-matter
- Structured run-id / sha references in the body
- Per-test test counts (linter does not validate test counts; that's a regression-gate concern)

---

### Phase A.2 — Rule formalization (L1-L6 each: parse → predicate → finding)

#### L1 (R1/R2) — NOT-RUN caps the verdict

**Parse:**
- All `## Phase N` (or `## Phase N.M` or `## Amendment §N`) headers in the doc.
- For each phase, the `**Status:**` line within its body.
- The audit's resolved Verdict tag (from the Verdict header + next 5 lines).
- The audit type (production-enable / family-ship / amendment / hosted-completion / OPS) detected per A.2 audit-type rules below.
- The required phases list for the detected audit type (from `audit-lint-rules.cjs` per audit-type required/optional map).
- Phases explicitly tagged optional in the doc body via `(optional)` or `(operator-token-gated)` parenthetical adjacent to the phase header → those count as optional (override the rules-file required list for this doc).

**Predicate:**
```
LET requiredPhases = REQUIRED_PHASES_BY_AUDIT_TYPE[auditType] (Set)
LET optionalPhases = OPTIONAL_PHASES_BY_AUDIT_TYPE[auditType] (Set)
                  ∪ doc-level (optional)-tagged phases
LET notRunRequired = phases.filter(p => p.status === 'NOT-RUN'
                                    && requiredPhases.has(p.id)
                                    && !optionalPhases.has(p.id))
IF notRunRequired.length > 0 AND verdict === 'PASS' THEN FAIL
```

**Finding:**
```json
{
  "rule": "L1",
  "severity": "error",
  "message": "Required phase(s) NOT-RUN but verdict is PASS — under R1/R2 the verdict CANNOT exceed PARTIAL.",
  "details": {
    "verdict": "PASS",
    "notRunRequiredPhases": ["phase-3-hosted-mcp-smoke"],
    "remedy": "Either run the phase to PASS, OR downgrade verdict to PARTIAL, OR explicitly mark the phase optional with rationale."
  },
  "exitCode": 1
}
```

---

#### L2 (R2/R4) — Indirect proof cannot satisfy a direct-proof obligation

**Parse:**
- For each phase: its `justificationText` (prose body between the phase header and the next phase / end-of-doc).
- The phase's `status` (only NOT-RUN justifications are scrutinized; PASS justifications are not penalized for using indirect phrases as auxiliary support).
- Direct-proof-required phase set per audit type (from `audit-lint-rules.cjs` `DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE`).

**Predicate:**
```
LET indirectPhrases = L2_INDIRECT_PHRASES  // array of regex/string from rules file
FOR EACH phase p WHERE p.status === 'NOT-RUN'
                  AND DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE[auditType].has(p.id):
  LET hit = indirectPhrases.find(phrase => p.justificationText.match(phrase))
  IF hit AND verdict === 'PASS' THEN FAIL
```

The combined L1-L2 trip on the original Family E audit specifically: Phase 3 NOT-RUN, Phase 3 IS required for family-ship audits per the rules file, justification contains "covered indirectly via Phase 4 success" — both L1 and L2 emit findings.

**`L2_INDIRECT_PHRASES` (initial set; defined in `audit-lint-rules.cjs`):**
```js
const L2_INDIRECT_PHRASES = [
  /covered\s+indirectly/i,
  /indirect\s+evidence/i,
  /verified\s+via\s+unit\s+tests?(?!\s+(plus|and|as\s+a\s+supplement))/i,  // "verified via unit tests" alone, not as a supplement
  /would\s+pass/i,
  /will\s+pass/i,
  /implied\s+by/i,
  /inferred\s+from/i,
  /covered\s+by\s+phase\s+\d+/i,  // catches "covered by Phase 4"
];
```

**Finding:**
```json
{
  "rule": "L2",
  "severity": "error",
  "message": "Direct-proof-required phase justified by indirect proof phrase '<phrase>' — R4 forbids substitution.",
  "details": {
    "phaseId": "phase-3-hosted-mcp-smoke",
    "phrase": "covered indirectly",
    "snippet": "...Phase 3 covered indirectly via Phase 4 success...",
    "remedy": "Either run the direct proof (e.g., hosted MCP 17/17), OR downgrade verdict to PARTIAL."
  },
  "exitCode": 1
}
```

---

#### L3 — Production-enable audits distinguish three success levels

**Parse:**
- Audit type detection — if title matches `-ENABLE` OR body declares `card-type: production-enable` → production-enable.
- For production-enable audits: scan all phase headers AND prose for three required assertions:
  - (a) **dispatch success** — phrases like "auto-trigger fires", "run row status=success", "production run created"
  - (b) **targeted classifier-signal success** — phrases like "produced ≥1 positive", "positive raw_keys", "signal observed on targeted text"
  - (c) **read-path / Source 6 success** — phrases like "Source 6 query", "production-only filter", "machineObservationPersistenceQuery", "read-path verified"

The three assertion-types are defined as regex bundles in `audit-lint-rules.cjs` `PRODUCTION_ENABLE_REQUIRED_ASSERTIONS`.

**Predicate:**
```
IF auditType === 'production-enable':
  LET found = {dispatch: false, targetedSignal: false, readPath: false}
  FOR EACH bundleKey IN [dispatch, targetedSignal, readPath]:
    found[bundleKey] = PRODUCTION_ENABLE_REQUIRED_ASSERTIONS[bundleKey]
                       .some(regex => fullDocText.match(regex))
  LET missing = Object.keys(found).filter(k => !found[k])
  IF missing.length > 0 THEN FAIL
```

**Finding:**
```json
{
  "rule": "L3",
  "severity": "error",
  "message": "Production-enable audit missing assertion(s) for: <levels>",
  "details": {
    "missingLevels": ["readPath"],
    "presentLevels": ["dispatch", "targetedSignal"],
    "remedy": "Add a section demonstrating Source 6 (or equivalent read-path) production filter holds end-to-end."
  },
  "exitCode": 1
}
```

---

#### L4 — Targeted-signal requires a positive RESULT ROW on targeted text

**Parse:**
- For production-enable audits only.
- Locate the targeted-signal section (the one L3 matched).
- Scan its prose for phrases that distinguish RUN-ROW success from RESULT-ROW success:
  - **Result-row evidence (required):** "≥N positives", "positive raw_keys", "result rows", "fired N times", explicit table with `raw_key | confidence | evidence_span_len`
  - **Run-row-only language (forbidden as SOLE evidence):** "run status=success" with NO accompanying result-row reference; "0 positives across all N args" stated as a success (Decision 9 PARTIAL exemption notwithstanding — for production-enable, 0 positives is NOT a PASS).

**Predicate:**
```
IF auditType === 'production-enable':
  LET signalText = extractTargetedSignalSection(fullDocText)
  LET hasResultRow = L4_RESULT_ROW_EVIDENCE.some(re => signalText.match(re))
  LET hasRunRowOnly = L4_RUN_ROW_ONLY_LANGUAGE.some(re => signalText.match(re))
  IF !hasResultRow OR (hasRunRowOnly AND !hasResultRow) THEN FAIL
```

**Finding:**
```json
{
  "rule": "L4",
  "severity": "error",
  "message": "Production-enable targeted-signal claim is run-row-only; no positive result row evidence found.",
  "details": {
    "remedy": "Cite ≥1 positive result row with raw_key + confidence + evidence_span_len, on text deliberately targeted to fire a classifier signal."
  },
  "exitCode": 1
}
```

---

#### L5 — Doctrine-risk audits inspect persisted direct output

**Parse:**
- Audit's family — extracted from title pattern `FAMILY-[A-Z]` OR body declarations.
- Check against `DOCTRINE_RISK_FAMILIES` set in rules file (initial: `['argument_scheme']`; alias `slippery_slope`).
- Doctrine-risk flag can also be set directly via doc-level `Doctrine-risk: true` line.
- For doctrine-risk audits: scan for evidence of persisted-row inspection:
  - "evidence_span" prose reference
  - SQL block containing `evidence_span` column reference (`SELECT ... evidence_span ...`)
  - A markdown table with `evidence_span` column header

**Predicate:**
```
LET isDoctrineRisk = (
  DOCTRINE_RISK_FAMILIES.has(detectedFamily)
  || docBody.match(/^Doctrine-risk:\s*true\b/im)
)
IF isDoctrineRisk:
  LET hasPersistedInspection = L5_PERSISTED_INSPECTION_PATTERNS
                                  .some(re => fullDocText.match(re))
  IF !hasPersistedInspection THEN FAIL
```

**`L5_PERSISTED_INSPECTION_PATTERNS`:**
```js
const L5_PERSISTED_INSPECTION_PATTERNS = [
  /\bevidence_span\b/i,
  /SELECT[\s\S]{0,200}evidence_span/i,    // SQL block (multiline tolerant)
  /\|\s*evidence_span\s*\|/i,             // markdown table column header
  /persisted\s+evidence/i,
  /direct[-\s]output\s+inspection/i,
];
```

**Finding:**
```json
{
  "rule": "L5",
  "severity": "error",
  "message": "Doctrine-risk audit (family=<family>) does not inspect persisted direct output (evidence_span or equivalent).",
  "details": {
    "remedy": "Add a SQL readback section that queries argument_machine_observation_results.evidence_span for the test runs and inspects rows for doctrine compliance."
  },
  "exitCode": 1
}
```

---

#### L6 — Verdict upgrades carry provenance

**Parse:**
- Amendment / upgrade detection — title contains `AMENDMENT|COMPLETION|upgrade` (case-insensitive) OR body declares `Prior verdict: <X>` OR `Predecessor audit:` line.
- For amendments: search for three required provenance components:
  - (a) **prior verdict** — explicit reference like "previously PARTIAL", "prior verdict: PARTIAL", a provenance table row with `(improperly)` annotation, `Verdict (amended)` header
  - (b) **specific missing proof** — phrases naming what was missing: "Gap 1", "Gap 2", "Phase N NOT-RUN", "hosted 17/17 missing", "adversarial fixture absent"
  - (c) **specific newly-supplied proof** — phrases naming what's new: "now supplied", "operator-supplied", "closed live", "newly added", "Gap N closed"

**Predicate:**
```
IF isAmendment:
  LET hasPriorVerdict = L6_PRIOR_VERDICT_PATTERNS.some(re => fullDocText.match(re))
  LET hasMissingProof = L6_MISSING_PROOF_PATTERNS.some(re => fullDocText.match(re))
  LET hasNewlySuppliedProof = L6_NEWLY_SUPPLIED_PROOF_PATTERNS.some(re => fullDocText.match(re))
  IF !(hasPriorVerdict && hasMissingProof && hasNewlySuppliedProof) THEN FAIL
```

**Finding:**
```json
{
  "rule": "L6",
  "severity": "error",
  "message": "Verdict upgrade missing provenance for: <missing>",
  "details": {
    "missingComponents": ["newlySuppliedProof"],
    "presentComponents": ["priorVerdict", "missingProof"],
    "remedy": "Name the specific newly-supplied proof that lifts the prior cap (e.g., 'operator-supplied hosted smoke 17/17 PASS')."
  },
  "exitCode": 1
}
```

---

#### Audit-type detection (used by L1, L3, L4)

```js
function detectAuditType(title, body) {
  const t = title.toUpperCase();
  if (t.includes('COMPLETION')) return 'hosted-completion';   // L6
  if (t.includes('AMENDMENT'))  return 'amendment';           // L6
  if (t.match(/-ENABLE-SMOKE/)) return 'production-enable';   // L3 + L4
  if (t.match(/MCP-SERVER-\d+-FAMILY-[A-Z]-SMOKE/)) return 'family-ship';  // L1 + L5
  if (t.startsWith('# OPS-'))    return 'ops';                // L1 only (relaxed)
  // doc-level override
  const m = body.match(/^Audit-type:\s*([\w-]+)/m);
  if (m) return m[1].toLowerCase();
  return 'unknown';
}
```

---

### Phase A.2 — Rules file data shape (`audit-lint-rules.cjs`)

CommonJS for Jest default-loader compatibility (mirroring `mcp-observability-report-lib.cjs`).

```js
'use strict';

// Marker line that gates whether MODIFIED audit docs are linted.
const MARKER_STRING = 'Audit-Lint: v1';

// L2 — phrases that, in a NOT-RUN direct-proof phase's justification,
// FAIL the audit when verdict is PASS.
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

// Audit-type detection regex bundles.
const AUDIT_TYPE_PATTERNS = {
  productionEnable: [/-ENABLE-SMOKE\b/i],
  familyShip:       [/MCP-SERVER-\d+-FAMILY-[A-Z]-SMOKE\b/i],
  amendment:        [/AMENDMENT\b/i],
  hostedCompletion: [/COMPLETION\b/i, /upgrade\b/i],
  ops:              [/^OPS-/i],
};

// Doctrine-risk families. Aliased: slippery_slope is the doctrinal axis
// inside Family E (argument_scheme); both names trip the rule.
const DOCTRINE_RISK_FAMILIES = new Set([
  'argument_scheme',
  'slippery_slope',  // alias
]);

// Required phases per audit type.
// Phase IDs are NORMALIZED forms (lower-kebab; numeric phases keep their
// number; "Amendment §N" maps to "amendment-N").
const REQUIRED_PHASES_BY_AUDIT_TYPE = {
  'production-enable': new Set([
    'phase-1-preflight',
    'phase-2-auto-trigger-dispatch',
    'phase-3-targeted-signal',
    'phase-4-read-path',           // Source 6 / read-path
    'phase-5-regression',
  ]),
  'family-ship': new Set([
    'phase-1-preflight',
    'phase-2-local-regression',
    'phase-3-hosted-mcp-smoke',     // <-- This is the rule that catches `29f30b0`
    'phase-4-edge-admin-validation',
    'phase-5-unsupported-rejection',
    'phase-6-targeted-regression',
  ]),
  'amendment':         new Set(),    // no required phases (amendments are scoped)
  'hosted-completion': new Set(['phase-1-hosted-mcp-smoke']),
  'ops':               new Set(['phase-1-preflight']),
};

// Phases that are explicitly optional per audit type (e.g., Phase 7 OPS observations is informational).
const OPTIONAL_PHASES_BY_AUDIT_TYPE = {
  'family-ship': new Set([
    'phase-7-ops-observations',
    'phase-4b-doctrine-verification',  // optional unless doctrine-risk
  ]),
  'production-enable': new Set([
    'phase-7-ops-observations',
  ]),
};

// Direct-proof-required phases per audit type (used by L2).
const DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE = {
  'family-ship': new Set([
    'phase-3-hosted-mcp-smoke',
    'phase-4-edge-admin-validation',
  ]),
  'production-enable': new Set([
    'phase-2-auto-trigger-dispatch',
    'phase-3-targeted-signal',
    'phase-4-read-path',
  ]),
};

// L3 — production-enable required assertion bundles.
const PRODUCTION_ENABLE_REQUIRED_ASSERTIONS = {
  dispatch: [
    /auto[-\s]?trigger\s+fires/i,
    /run\s+row\s+status\s*=\s*['"]?success/i,
    /\d+\s+production\s+runs?\s+(created|fired|observed)/i,
    /run_mode\s*=\s*['"]?production['"]?/i,
  ],
  targetedSignal: [
    /≥\s*1\s+positive/i,
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
};

// L4 — distinguishing result-row vs run-row-only evidence.
const L4_RESULT_ROW_EVIDENCE = [
  /\d+\s+positive\s+raw\s+keys?/i,
  /raw_key\s*\|\s*confidence\s*\|\s*evidence_span/i,
  /\bfired\s+\d+\s+positive/i,
  /result\s+rows?\s+observed/i,
];

const L4_RUN_ROW_ONLY_LANGUAGE = [
  /run\s+row\s+(success|status=success)(?![^.]*positive)/i,  // success without a positive nearby
  /0\s+positives\s+across\s+all/i,                            // 0 positives is not signal proof
];

// L5 — persisted-output inspection patterns.
const L5_PERSISTED_INSPECTION_PATTERNS = [
  /\bevidence_span\b/i,
  /SELECT[\s\S]{0,200}evidence_span/i,
  /\|\s*evidence_span\s*\|/i,
  /persisted\s+evidence/i,
  /direct[-\s]output\s+inspection/i,
];

// L6 — provenance patterns.
const L6_PRIOR_VERDICT_PATTERNS = [
  /prior\s+verdict\s*:\s*\b(PASS|PARTIAL|FAIL)\b/i,
  /previously\s+\b(PASS|PARTIAL|FAIL)\b/i,
  /\bPredecessor\s+audit\s*:/i,
  /\(improperly\)/i,
  /Verdict\s*\(amended\)/i,
  /verdict[-\s]upgrade\s+provenance/i,
];

const L6_MISSING_PROOF_PATTERNS = [
  /\bGap\s+\d+\b/i,
  /Phase\s+\d+\s+NOT[-\s]?RUN/i,
  /missing\s+proof/i,
  /\bcapped\s+(at|by)\b/i,
];

const L6_NEWLY_SUPPLIED_PROOF_PATTERNS = [
  /now\s+supplied/i,
  /operator[-\s]supplied/i,
  /closed\s+(live|by\s+direct)/i,
  /newly\s+(added|supplied)/i,
  /\bGap\s+\d+\s+closed/i,
  /direct\s+proof/i,
];

module.exports = {
  MARKER_STRING,
  L2_INDIRECT_PHRASES,
  AUDIT_TYPE_PATTERNS,
  DOCTRINE_RISK_FAMILIES,
  REQUIRED_PHASES_BY_AUDIT_TYPE,
  OPTIONAL_PHASES_BY_AUDIT_TYPE,
  DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE,
  PRODUCTION_ENABLE_REQUIRED_ASSERTIONS,
  L4_RESULT_ROW_EVIDENCE,
  L4_RUN_ROW_ONLY_LANGUAGE,
  L5_PERSISTED_INSPECTION_PATTERNS,
  L6_PRIOR_VERDICT_PATTERNS,
  L6_MISSING_PROOF_PATTERNS,
  L6_NEWLY_SUPPLIED_PROOF_PATTERNS,
};
```

Pure DATA only. No spawn, no fs, no network. Jest-loadable via `require()`.

---

### Phase A.3 — CI scope + marker mechanism

#### Marker format

```
Audit-Lint: v1
```

Exact match (case-sensitive, single line, no surrounding whitespace beyond
end-of-line). Constant lives in `audit-lint-rules.cjs` as `MARKER_STRING`.

The smoke-template update (Decision 6) ADDS this marker line near the top of:
- `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-template.md`
- `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-template.md`
- `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-template.md`

Future smoke audits (Family F+) inherit the marker by copying the template.

#### Added-vs-modified scoping logic

```
GIVEN a git diff against main:
FOR EACH file in diff:
  IF file matches glob "docs/audits/*SMOKE*.md":
    IF file is ADDED (git status A or ??):
      → LINT (always; even without marker)
    ELIF file is MODIFIED (git status M):
      LET content = readFile(file)
      IF content contains MARKER_STRING:
        → LINT
      ELSE:
        → SKIP (pre-hardening doc; historical edits exempt)
    ELIF file is DELETED:
      → SKIP (no linter applies to deleted files)
```

**Evasion-loophole proof:** A bad actor cannot evade the linter by submitting a new audit doc without the marker — added files are ALWAYS linted regardless of marker. The marker only governs whether MODIFIED historical docs are scoped in.

#### `.github/workflows/` confirmed absent → trigger 9 FIRES

```
$ ls .github/workflows
ls: cannot access '.github/workflows': No such file or directory
$ ls .github
ls: cannot access '.github': No such file or directory
```

Per intent brief §7 operator addendum:

> If trigger 9 fires (likely per Phase 0 — no GitHub Actions infrastructure),
> land the linter + rules + fixtures + tests + docs + smoke-template update
> and mark only CI wiring as PARTIAL/deferred.

**Decision:** CI wiring is DEFERRED. The card ships with PARTIAL verdict on the basis that:
- L1-L6 linter is operational
- 4-fixture self-validation is operational
- Smoke template carries the marker + required final-step
- Operator can run `node scripts/ops/audit-lint.mjs <doc>` manually on every new audit

**v1 enforcement vector:** the smoke-template update adds a required final step:

```
Run `node scripts/ops/audit-lint.mjs <this-doc>`; it MUST exit 0
before the Verdict line is valid.
```

This makes the linter operator-required-by-template. CI is the delivery mechanism for AUTOMATED enforcement; the linter itself is the enforcement.

#### Recommended follow-on card

`OPS-MCP-SMOKE-LINT-CI-WIRING` — a future card to wire the linter into automated enforcement when `.github/workflows/` is introduced (or via Netlify deploy preview, pre-commit hook, or alternate mechanism). Out of scope for this card.

---

### Phase A.4 — Self-validation design + per-fixture extraction

#### Fixture extraction commands

The fixtures are STATIC COPIES (trigger 7 prohibits live references). Extracted via `git show` at the motivating SHAs:

```bash
mkdir -p __tests__/fixtures/audit-lint

# Fixture 1: original Family E improper-PASS (centerpiece)
git show 29f30b0:docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-2026-05-27.md \
  > __tests__/fixtures/audit-lint/original-family-e-IMPROPER-PASS.md

# Fixture 2: Family E amendment PARTIAL (graded consistent-PARTIAL)
git show b1829f5:docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT-2026-05-28.md \
  > __tests__/fixtures/audit-lint/family-e-amendment-PARTIAL.md

# Fixture 3: Family E hosted-completion PASS
git show bccb0c2:docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-COMPLETION-HOSTED-2026-05-28.md \
  > __tests__/fixtures/audit-lint/family-e-hosted-completion-PASS.md

# Fixture 4: Family D strengthened amendment PASS (model audit)
cp docs/audits/MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-AMENDMENT-2026-05-27.md \
   __tests__/fixtures/audit-lint/family-d-strengthened-amendment-PASS.md
```

(The Family D fixture is copied from current main since the predecessor commit `b324dae` IS the current main version of that file.)

#### Per-fixture expected linter outcome

| Fixture filename | Audit type detected | Verdict in fixture | Linter outcome | Rule triggered | Why |
| --- | --- | --- | --- | --- | --- |
| `original-family-e-IMPROPER-PASS.md` | `family-ship` | `PASS` | **FAILS** (exit 1) | **L1** + **L2** | Phase 3 hosted MCP NOT-RUN + verdict PASS (L1 trips). Justification "covered indirectly via Phase 4 success" is an indirect-proof phrase for a direct-proof-required phase (L2 trips). Centerpiece: linter catches the exact defect that motivated this card. |
| `family-e-amendment-PARTIAL.md` | `amendment` | `PARTIAL` | **PASSES** (exit 0) | (none) | Phase 1 NOT-RUN + verdict PARTIAL is CONSISTENT (R2 satisfied). Amendment phase list is empty (amendments scoped); L1 does not require Phase 1. L6 provenance present ("Predecessor audit:", "Gap 1", "Gap 2 closed live"). |
| `family-e-hosted-completion-PASS.md` | `hosted-completion` | `PASS` | **PASSES** (exit 0) | (none) | Phase 1 hosted smoke 17/17 PASS (L1 satisfied). L6 provenance present (provenance table with `(improperly)`, "Gap 1 closed by direct operator-run hosted MCP smoke evidence", "newly-supplied"). |
| `family-d-strengthened-amendment-PASS.md` | `amendment` (production-enable subordinate) | `PASS` | **PASSES** (exit 0) | (none) | Model audit. Amendment phase list is empty. L6 provenance present ("Predecessor audit:", "Amendment §1-§9 satisfied", "9/9 strengthened criteria"). Doctrine-risk does not apply (Family D is not in `DOCTRINE_RISK_FAMILIES`). |

#### Jest test assertions

Tests live in `__tests__/opsAuditLint.test.ts`:

```ts
import { lintAuditDoc } from '../scripts/ops/audit-lint-lib.cjs';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'audit-lint');

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — 4-fixture self-validation', () => {
  it('original Family E improper-PASS FAILS (L1 + L2 trip)', () => {
    const doc = fs.readFileSync(path.join(FIXTURE_DIR, 'original-family-e-IMPROPER-PASS.md'), 'utf8');
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(1);
    const ruleIds = result.findings.map(f => f.rule);
    expect(ruleIds).toContain('L1');
    expect(ruleIds).toContain('L2');
  });

  it('Family E amendment PARTIAL PASSES (consistent-PARTIAL)', () => {
    const doc = fs.readFileSync(path.join(FIXTURE_DIR, 'family-e-amendment-PARTIAL.md'), 'utf8');
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('Family E hosted-completion PASS PASSES', () => {
    const doc = fs.readFileSync(path.join(FIXTURE_DIR, 'family-e-hosted-completion-PASS.md'), 'utf8');
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('Family D strengthened amendment PASS PASSES (model audit)', () => {
    const doc = fs.readFileSync(path.join(FIXTURE_DIR, 'family-d-strengthened-amendment-PASS.md'), 'utf8');
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });
});
```

#### CRITICAL — Fixture doctrine-scan protection (operator addendum)

The 4 fixtures contain historical defect language by design:
- `original-family-e-IMPROPER-PASS.md`: "covered indirectly", "fallacy" (in adversarial Phase 4b)
- `family-e-amendment-PARTIAL.md`: "covered indirectly" (quoted as historical defect)
- `family-d-strengthened-amendment-PASS.md`: contains "Indirect evidence Phase 8 would PASS" (Amendment §8 historical language)

These phrases must NOT cause:
1. The Jest test suite to false-fail via broad ban-list/doctrine scanners
2. A future CI ban-list scanner to false-fail
3. The audit-lint linter applied to OTHER docs to false-fail (this is naturally prevented — the linter is doc-scoped)

**Design choices to prevent false-flags:**

A. **File-level header marker in each fixture file.** Each fixture file has a prepended HTML comment marker (first 5 lines):

```markdown
<!-- AUDIT-LINT-FIXTURE: intentional negative case. This file is a static
     copy of a historical audit doc and contains historical defect language
     ("covered indirectly", etc.) by design. Doctrine ban-list scanners
     MUST exclude this directory from scope. Source: __tests__/fixtures/audit-lint/README.md -->
```

The fixture extraction script writes this header BEFORE the `git show` content. This is the safest mechanism — the marker travels with the file.

B. **Directory-level test-suite exclusion.** Any doctrine ban-list test in `__tests__/` that scans the repo for verdict tokens or banned phrases MUST add `__tests__/fixtures/audit-lint/**` to its exclusion list. The card MUST audit existing ban-list tests and confirm none of them scope `__tests__/fixtures/audit-lint/` without an exclusion clause.

C. **README.md in the fixture directory** explaining the design decision:

```
__tests__/fixtures/audit-lint/README.md
```

Contents:
```markdown
# Audit-lint fixture directory

These files are INTENTIONAL NEGATIVE FIXTURES — static copies of historical
audit docs at the SHAs that motivated OPS-MCP-SMOKE-DOCTRINE-HARDENING.
They contain historical defect language ("covered indirectly", "verified
via unit tests" as sole justification, etc.) by design. Their purpose is
to assert that the audit-lint linter would have caught the original
`29f30b0` improper-PASS audit at authoring time.

Doctrine ban-list scanners and verdict-token scanners MUST EXCLUDE this
directory. Each file carries an HTML comment marker at the top declaring
its intent.

DO NOT edit these files to remove the defect language — that would defeat
the self-validation contract.

DO NOT live-reference the source audit docs (trigger 7) — these files are
static copies extracted via `git show <sha>:<path>`.
```

D. **Implementer mandate in design §6 Test plan:** the implementer adds a test that explicitly asserts the fixture-directory has the README.md present, and that each fixture file starts with the `<!-- AUDIT-LINT-FIXTURE` marker comment.

---

## File changes

### NEW files

| Path | Purpose | Est. lines |
| --- | --- | --- |
| `scripts/ops/audit-lint.mjs` | CLI runner; mirrors `mcp-observability-report.mjs` pattern (ESM entry; calls into CJS lib; exits with non-zero on findings) | ~180 |
| `scripts/ops/audit-lint-lib.cjs` | Pure helpers (parser, rule engine, audit-type detector, finding builders). CommonJS for Jest default loader. | ~520 |
| `scripts/ops/audit-lint-rules.cjs` | Pure DATA (regex bundles, sets, audit-type maps, marker string). No fs/spawn. | ~180 |
| `__tests__/opsAuditLint.test.ts` | Unit tests for parser + rules + 4-fixture self-validation. | ~450 |
| `__tests__/fixtures/audit-lint/README.md` | Explains fixture purpose + doctrine-scan exclusion. | ~25 |
| `__tests__/fixtures/audit-lint/original-family-e-IMPROPER-PASS.md` | Static copy via `git show 29f30b0:...` with HTML comment marker prepended. | ~250 (copy + marker) |
| `__tests__/fixtures/audit-lint/family-e-amendment-PARTIAL.md` | Static copy via `git show b1829f5:...` with HTML comment marker prepended. | ~280 (copy + marker) |
| `__tests__/fixtures/audit-lint/family-e-hosted-completion-PASS.md` | Static copy via `git show bccb0c2:...` with HTML comment marker prepended. | ~110 (copy + marker) |
| `__tests__/fixtures/audit-lint/family-d-strengthened-amendment-PASS.md` | Static copy via cp from current main, with HTML comment marker prepended. | ~200 (copy + marker) |
| `docs/ops/AUDIT-LINT.md` | Operator doc: rules, how to run, how to add a doctrine-risk family, marker mechanics, fixture-directory exclusion contract. | ~150 |

### MODIFIED files (additive only — trigger 14)

| Path | What changes | What stays |
| --- | --- | --- |
| `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-template.md` | Prepend `Audit-Lint: v1` marker after the front matter. Add a required final step at end-of-template: "Run `node scripts/ops/audit-lint.mjs <this-doc>`; it MUST exit 0 before the Verdict line is valid." | All existing 8-phase substance unchanged. |
| `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-template.md` | Same as above. | Same as above. |
| `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-template.md` | Same as above, PLUS (for production-enable-style templates only) an explicit three-level section (dispatch / targeted classifier-signal / read-path) — BUT this template is not production-enable, so only the marker + final step. | Same as above. |
| `package.json` | Add npm script `"audit-lint": "node scripts/ops/audit-lint.mjs"` for operator ergonomic invocation. | All existing scripts unchanged. |
| `docs/core/current-status.md` | Add a one-line entry under the "Stage 6.4 follow-up" line noting OPS-MCP-SMOKE-DOCTRINE-HARDENING ship + test-count bump. | All existing content unchanged. |

### DELETED files

None. The linter is READ-ONLY over the audit corpus (trigger 3).

---

## API / interface contracts

### `audit-lint-lib.cjs` public API

```ts
// All functions are PURE — no fs, no spawn, no network.

/**
 * Parse an audit doc into a structured representation.
 */
function parseAuditDoc(text: string): {
  title: string;               // line 1 of the doc
  auditType: 'production-enable' | 'family-ship' | 'amendment' | 'hosted-completion' | 'ops' | 'unknown';
  hasMarker: boolean;          // contains 'Audit-Lint: v1'
  family: string | null;       // e.g., 'argument_scheme' or null
  verdict: 'PASS' | 'PARTIAL' | 'FAIL' | null;
  verdictHeaderLineNumber: number | null;
  phases: Array<{
    id: string;                // normalized e.g., 'phase-3-hosted-mcp-smoke'
    rawHeader: string;         // e.g., '## Phase 3 — Hosted MCP smoke'
    headerLineNumber: number;
    status: 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT-RUN' | null;
    statusLineNumber: number | null;
    justificationText: string; // prose between header and next header
    explicitlyOptional: boolean;
  }>;
};

/**
 * Apply L1-L6 rules to a parsed doc. Returns findings + exit code.
 */
function lintAuditDoc(text: string, options?: { reportOnly?: boolean }): {
  exitCode: 0 | 1;
  parsed: ReturnType<typeof parseAuditDoc>;
  findings: Array<{
    rule: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
    severity: 'error' | 'warn';
    message: string;
    details: Record<string, unknown>;
  }>;
};

/**
 * Phase-id normalization (Phase 3 → phase-3-hosted-mcp-smoke when the
 * header includes "hosted MCP", etc.).
 */
function normalizePhaseId(rawHeader: string): string;

/**
 * Audit-type detector.
 */
function detectAuditType(title: string, body: string): string;

/**
 * Family detector (parses title pattern + body declarations).
 */
function detectFamily(title: string, body: string): string | null;

module.exports = {
  parseAuditDoc,
  lintAuditDoc,
  normalizePhaseId,
  detectAuditType,
  detectFamily,
};
```

### `audit-lint.mjs` CLI surface

```
USAGE:
  node scripts/ops/audit-lint.mjs <doc-path> [--report-only]
  node scripts/ops/audit-lint.mjs --help

FLAGS:
  --report-only       Print findings + counts; exit 0 even if findings present.
                      Used for Phase 2 corpus census without blocking.
  --help, -h          Print this help.

EXIT CODES:
  0  No findings (or --report-only flag set).
  1  ≥1 finding (rule violation) in normal mode.
  2  Parse error (could not extract verdict; malformed doc).
  3  File not found / unreadable.
  5  CLI argument error.
```

The CLI accepts a SINGLE doc path. Batch invocation is a shell loop — the linter does NOT default to running over a directory (trigger 4 prevents this).

---

## Edge cases

| Case | How the design handles it |
| --- | --- |
| Audit doc without any `## Phase` header | `phases: []`. L1 vacuously passes. L3-L4 may still trip on missing assertions. |
| Doc with two `## Verdict` headers (rare; observed in some upgrade docs) | The last one wins (linter takes the last verdict tag). Justified by: amendments and completions place their final verdict at end-of-doc. |
| `## Verdict (amended)` AND `## Final amended verdict` both present | Both match the regex. Last one wins (consistent with above). |
| Phase status missing (`## Phase 3` header but no `**Status:**`) | `status: null`. L1 treats null as ABSENT (does not count as NOT-RUN, does not satisfy required-phase). L3 / L4 may still find assertion text in prose. Linter emits a warning (not error) noting status absence. |
| Verdict tag not found | exitCode=2; "could not extract verdict". |
| Doc IS a template (`-template.md`) | Audit-type detection should NOT lint the template itself (templates have placeholder verdicts like `☐ PASS ☐ PARTIAL ☐ FAIL`). The runner should refuse to lint a file matching `*-template.md` and exit 0 with `[skip] template doc`. Operator should never run the linter against a template. |
| Doc carries marker AND is on a non-audit path (e.g., a doc that happens to have `Audit-Lint: v1`) | The runner accepts any path. The MARKER mechanism is a CI-scoping concern, not a runner concern. Runner lints whatever path it is given. |
| Doc has BOTH "covered indirectly" AND "(supplement: also verified live)" | L2 phrase `verified via unit tests` regex has a negative-lookahead for `(plus\|and\|as a supplement)`. The "covered indirectly" regex does NOT have this guard — that phrase is taken at face value. **Design choice**: any "covered indirectly" with PASS verdict trips L2, even if later prose claims direct evidence elsewhere. This is conservative; the implementer should consider whether to add a per-phase supplement-tolerance heuristic. **For v1: keep it strict.** |
| Phase status in a status-line variant: `**Status: PASS**` (status bold-inside) | Tolerated by the regex `^\*?\*?\s*Status\s*:?\*?\*?\s*(PASS\|PARTIAL\|FAIL\|NOT-RUN)\b`. |
| Doctrine-risk audit where the family is not detectable from title (e.g., a generic OPS doc that does doctrine review) | Body-level `Doctrine-risk: true` override triggers L5. Without it, L5 does not apply. |
| Provenance components present but for the WRONG predecessor | L6 does not validate that the provenance NAMES the correct predecessor. It validates STRUCTURAL presence of (prior verdict, missing proof, newly-supplied proof). Operator review catches semantic errors. Design constraint: the linter is a typo-trap, not a semantic-correctness checker. |
| L2 phrase appears OUTSIDE the NOT-RUN phase justification (e.g., in OPS observations or in a parenthetical aside) | L2 only scans `phase.justificationText` for NOT-RUN required phases. False positives bounded. |
| Doc declares `(optional)` adjacent to a required phase | Phase is treated as optional for L1 only. L2 does not exempt. Rationale: optional means "we don't require this phase to be run", but if you DO claim it was covered, you cannot claim it was covered by indirect proof and call the verdict PASS. |
| Fixture file's HTML comment marker is missing (extraction bug) | Test in `opsAuditLint.test.ts` explicitly asserts every fixture starts with `<!-- AUDIT-LINT-FIXTURE`. Catches at CI/test time. |
| Doc has Unicode em-dash `—` vs ASCII `--` in headers | Both tolerated (regex `[—-]` or simply ignored — we match on `Phase \d+` and `Status:` patterns that do not depend on dashes). |
| Doc body has BOM (UTF-8 BOM at start) | `fs.readFileSync(file, 'utf8')` does NOT strip BOM. The parser must strip a leading BOM `﻿` before line splitting. |
| Doc with CRLF line endings | The parser must accept `\r\n` and `\n`. Use `text.split(/\r?\n/)`. |

---

## Test plan

### Test files

| File | Purpose | Approx test count |
| --- | --- | --- |
| `__tests__/opsAuditLint.test.ts` | Single test file housing all suites. Mirrors `opsMcpObservabilityCliArgParsing.test.ts` patterns. | +30 to +55 |

### Test suites within `opsAuditLint.test.ts`

1. **CLI arg parsing** (~5 tests) — defaults, `--help`, `--report-only`, unknown flag, missing arg.
2. **Parser** (~8 tests) — title extraction, audit-type detection (5 types), verdict tag extraction (5 verdict-header forms), phase extraction (`Phase N` + `Phase N.M` + `Amendment §N`), phase-status extraction (3 variants), BOM tolerance, CRLF tolerance.
3. **L1 rule** (~5 tests) — fires on required NOT-RUN + PASS; does NOT fire when verdict is PARTIAL; does NOT fire when phase is optional; does NOT fire when audit type has no required phases; vacuously passes on no-phase doc.
4. **L2 rule** (~5 tests) — fires on `covered indirectly` in direct-proof phase with PASS verdict; fires on `would pass`; does NOT fire on `verified via unit tests plus direct hosted smoke`; does NOT fire when verdict is PARTIAL; does NOT fire on phases not in direct-proof set.
5. **L3 rule** (~4 tests) — fires on production-enable missing readPath; fires on missing dispatch; fires on missing targetedSignal; does NOT fire on family-ship audit.
6. **L4 rule** (~3 tests) — fires on run-row-only language without result-row evidence; does NOT fire when result-row evidence present; does NOT fire on family-ship audit.
7. **L5 rule** (~3 tests) — fires on doctrine-risk family without persisted-row inspection; does NOT fire on non-doctrine-risk family; fires on `Doctrine-risk: true` body override.
8. **L6 rule** (~4 tests) — fires on amendment missing prior-verdict; fires on amendment missing newly-supplied-proof; does NOT fire when all three components present; does NOT fire on non-amendment doc.
9. **4-fixture self-validation** (~4 tests; THE CENTERPIECE) — see Phase A.4 above. THIS IS THE EXISTENTIAL CARD CONTRACT. Trigger 8 fires if any fixture's actual outcome ≠ expected.
10. **Fixture-directory invariants** (~3 tests) — README.md exists with required content; each fixture starts with the `<!-- AUDIT-LINT-FIXTURE` marker comment; fixture count is exactly 4.
11. **Template-doc refusal** (~2 tests) — runner refuses templates by filename pattern.
12. **Determinism** (~1 test) — same input → same finding order (sorted by rule id + line number).
13. **No-network / no-fs side-effects** (~2 tests) — source scan of `audit-lint-lib.cjs` asserts no `spawnSync` and no network imports; only `fs` is permitted in the entry runner not the lib.

**Total forecast: ~45 tests** (within +25 to +60 brief band; well under +100 HALT).

### Gates

```bash
npm run typecheck                                                    # exit 0
npm run lint                                                         # exit 0
npx jest --testPathPattern="opsAuditLint" --no-coverage              # exit 0
cd mcp-server && deno test --allow-net --allow-env --allow-read      # exit 0 (unchanged)
```

---

## Dependencies (cards / docs / files)

- **Predecessors (must be at main):** `15b65c6` (operator intent brief) — already at branch head.
- **Doctrine layer:** all of CLAUDE.md "AI Moderation Hard Rules" + "Security" + "Supabase Conventions"; this card touches NONE of them.
- **Source-of-truth files this design reads (and the linter source code will reuse):**
  - `scripts/ops/mcp-observability-report.mjs` — runner ESM pattern (entry + dispatcher + exit codes)
  - `scripts/ops/mcp-observability-report-lib.cjs` — pure CJS helpers pattern (Jest-loadable via `require()`)
  - `__tests__/opsMcpObservabilityCliArgParsing.test.ts` — CLI test pattern (DEFAULTS, parseCliArgs)
  - `__tests__/opsMcpObservabilityNoLiveDb.test.ts` — pure-helper assertion pattern (source-scan for spawnSync)
- **Cards this design BLOCKS:**
  - `MCP-SERVER-007-FAMILY-F` — its smoke audit must carry the marker + must pass the linter from Phase 1.
  - `MCP-021C-EDGE-FAMILY-E-ENABLE` — its production-enable audit must satisfy L3 + L4 from authoring.
  - `OPS-MCP-SMOKE-LINT-CI-WIRING` — follow-on card to wire CI when `.github/workflows/` is introduced.
- **Cards this design DOES NOT block:** any non-MCP card; any UI / UX card; any roadmap card outside the audit pipeline.

---

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| L1 phase-id normalization fails on a not-yet-seen phase header variant | Medium | Conservative regex; runner emits a warning on unparseable phase header; test coverage on all 8-doc corpus variants. |
| L2 phrase list is incomplete (a new evasion phrase emerges) | Medium | Phrase list is in `audit-lint-rules.cjs` DATA file; adding a phrase is a one-line PR. Document the process in `docs/ops/AUDIT-LINT.md`. |
| L5 falsely fails a doctrine-risk audit that does inspect persisted output but uses different wording | Low | Pattern list is permissive (5 patterns including substring `evidence_span`); operator can override with `Doctrine-risk: false` body declaration. |
| L6 falsely passes an amendment with surface-level provenance keywords but no real provenance | Low | Acknowledged design limitation: L6 is a typo-trap, not a semantic-correctness checker. Operator review catches semantic errors. |
| Fixture extraction breaks if a SHA is force-pushed or rewritten | Low | The SHAs `29f30b0`, `b1829f5`, `bccb0c2` are on `main` history. `git show <sha>:<path>` is deterministic absent history rewrite. Document the extraction command in fixture README so re-extraction is trivial. |
| Doctrine ban-list test in another suite false-fails on fixture content | **HIGH** (operator addendum names this) | THREE mitigations: (a) HTML comment marker in each fixture; (b) directory-level exclusion in any broad scanner; (c) explicit Jest test asserting marker presence in each fixture. Implementer MUST audit existing ban-list scanners. |
| The linter is run against an audit that pre-dates the marker → linter trips on legitimate "covered indirectly" historical language | N/A | The CI-scoping rule exempts pre-marker historical edits. Operator-run invocation against a historical doc is INFORMATIONAL — `--report-only` is the correct flag for census of historical docs. Documented in `docs/ops/AUDIT-LINT.md`. |
| Template doc accidentally linted | Low | Runner refuses `*-template.md` filename pattern; test asserts this. |
| Verdict-tag two-pass scan picks up a "PASS" or "FAIL" inside a code block | Medium | Verdict-tag regex requires bold markup `\*\*(PASS|PARTIAL|FAIL)\*\*` which is rare inside code blocks (which use backticks). Backup mitigation: skip lines that are inside fenced code blocks (tracked via 3-backtick state machine in the parser). |

---

## Out of scope

- ANY runtime code change to MCP server, Edge Functions, src/, or any production path
- ANY registry / prompt / taxonomy change (the linter does not enforce taxonomy correctness)
- ANY existing audit doc under `docs/audits/` modified or deleted (the linter is READ-ONLY over the corpus; fixtures are COPIES under `__tests__/fixtures/audit-lint/`)
- Linting the FULL historical audit corpus by default in CI (trigger 4)
- Structured front-matter audit schema (deferred to v2; `OPS-MCP-AUDIT-SCHEMA-V2`)
- Globally enforcing L1-L6 on pre-hardening docs (out of scope by design — marker exempts historical edits)
- New family registration or family behavior change
- Schema migration
- AI-call from the linter (the linter is pure regex / text parsing; no LLM analysis)
- Test-count validation (separate regression-gate concern; the linter does NOT parse "1805 tests" claims)
- Verdict-token doctrine scan inside audit docs (the linter does NOT scan for "winner / loser / liar" etc.; that's a separate cdiscourse-doctrine concern handled by `mcp-observability-report.mjs`'s `scanMarkdownForBannedTokens` and is orthogonal to L1-L6)
- CI wiring per operator addendum trigger 9 — deferred to follow-on `OPS-MCP-SMOKE-LINT-CI-WIRING`

---

## Doctrine self-check

### cdiscourse-doctrine

| Rule | How the design respects it |
| --- | --- |
| §1 score is not truth | N/A — this card does not touch scoring or argument analysis. |
| §2 heat is activity, not truth | N/A. |
| §3 popularity is not evidence | N/A. |
| §4 AI moderator limits | N/A — the linter is pure text parsing; no LLM call. |
| §5 rules engine sacred | N/A — does not touch `src/lib/constitution/engine.ts`. |
| §6 secrets policy | The linter reads docs from the local filesystem; never reads env vars; never touches secrets. The runner has NO network calls. |
| §7 no AI calls from prod app | N/A — script is `scripts/ops/`, not prod app; and it makes no AI calls. |
| §8 Supabase conventions | N/A — no DB, no migration, no RLS. |
| §9 plain language for users | N/A — operator-facing tool, not user-facing. |
| §10 v1 scope guards | The linter is process tooling, not a user feature. Does not introduce voting, search, OAuth, etc. |

### test-discipline

| Rule | How the design respects it |
| --- | --- |
| Tests are part of done | ~45-test forecast bundled in this card. |
| Test file location | `__tests__/opsAuditLint.test.ts` (top-level). Fixtures under `__tests__/fixtures/audit-lint/`. |
| Pure-model tests | All linter helpers are pure (no fs in lib; no network). Tests import via `require()` from CJS lib. |
| Doctrine ban-list test | The card adds NO new ban-list scanner. It ADDS an INPUT FIXTURE DIRECTORY that must be EXCLUDED from existing ban-list scanners. Mitigation triple-layered. |
| Test count goes UP | +25 to +60 forecast; baseline 18,016 → ~18,041 to 18,076. |
| Gate timeouts | Jest pattern restricted to `opsAuditLint` for the targeted gate; full suite gate uses `npm run test`. |

### Operator addendum (binding)

| Operator stipulation | How the design respects it |
| --- | --- |
| Fixture files contain historical defect language | HTML comment marker in each fixture + directory-level exclusion contract + README documenting intent. |
| CI fallback if trigger 9 fires | Design declares CI DEFERRED to follow-on card. Linter ships and is operator-run via the template's required-final-step. |

---

## HALT trigger evaluation

| # | Trigger | Status |
| --- | --- | --- |
| 1 | Any runtime code change | **NOT FIRED.** Design touches only `scripts/ops/`, `__tests__/`, `docs/`, `package.json` script entry. |
| 2 | Any registry / prompt / taxonomy change | **NOT FIRED.** No registry, prompt, or taxonomy touched. |
| 3 | Any existing audit doc under `docs/audits/` modified or deleted | **NOT FIRED.** Templates are updated (additive only per trigger 14); no historical audit doc edited. |
| 4 | Linter wired to run over full historical corpus by default | **NOT FIRED.** Runner takes a single doc path; `--report-only` is opt-in for census. CI scoping is added-vs-modified, with marker gate for modified. |
| 5 | New family registration or family behavior change | **NOT FIRED.** |
| 6 | Schema migration | **NOT FIRED.** |
| 7 | Fixtures live-referenced (not static copies) | **NOT FIRED.** Fixtures extracted via `git show <sha>:<path>` and stored as static copies; HTML comment marker indicates "static copy of <source-sha>:<source-path>". |
| 8 | Any of the 4 fixtures does NOT produce its expected verdict | **EXISTENTIAL — to be verified by implementer.** Designer specifies expected outcomes; implementer tunes the linter until fixtures match. If a fixture cannot be made to match, HALT and surface. |
| 9 | CI integration requires touching shared CI config beyond a clean additive | **EXPECTED TO FIRE per Phase 0.** `.github/workflows/` does not exist. Per operator addendum: defer CI to PARTIAL and follow-on card. Land everything else. |
| 10 | Marker / added-file scoping creates evasion loophole | **NOT FIRED.** Added files are ALWAYS linted regardless of marker. Modified-without-marker is the only exempt case (intentional — pre-hardening doc exemption). |
| 11 | Linter produces non-deterministic output | **NOT FIRED by design.** Findings sorted deterministically (by rule id ASC, then by line number ASC). Test asserts determinism. |
| 12 | Linter false-FAILs a legitimate PARTIAL audit | **EXISTENTIAL — `b1829f5` fixture must PASS.** Designer specifies this fixture expects exit 0. Implementer tunes until this holds. |
| 13 | Test forecast exceeds +100 | **NOT FIRED.** Forecast ~45 tests; well under +100. |
| 14 | Smoke-template update changes existing required-phase substance | **NOT FIRED.** Update is ADDITIVE only: prepend marker line + append required-final-step instruction. No phase substance changed. |
| 15 | Verdict tokens / doctrine ban-list violations in any shipped string (excluding fixture files per operator addendum) | **NOT FIRED.** No new verdict tokens introduced in linter source, rules file, test file, operator doc, or template updates. Fixtures explicitly exempted per operator addendum mitigations. |
| 16 | Unclassified untracked files at PR creation | **NOT FIRED at design stage.** The 10 known operator-territory files remain present (`docs/testing-runs/2026-05-25-*`, `mcp021c-edge-smoke-*`, `netlify-prod.git`, `phase5-mcpserver002-*`). Implementer must NOT add unclassified files. |

**Trigger 9 fires by design** — handled per operator addendum (CI deferred to follow-on card). All other triggers either do not fire or are existential card contracts the implementer must satisfy.

---

## Brief ledger (orchestrator-authored brief sections)

Per POSTRUN-UX001 multi-card ledger discipline:

| Section in intent brief | Source of authority |
| --- | --- |
| §1 motivating arc (3 + 1 docs) | Operator-validated from prior smoke run history |
| §2 L1-L6 rules | Operator-stated audit-integrity rules R1-R4 (encoded mechanically) |
| §3 Decision 1 artifacts (file list) | Operator-stated; binding |
| §4 4 fixtures + expected verdicts | Operator-stated; existential per trigger 8 |
| §5 CI scope + marker mechanism | Operator-stated; addendum allows CI defer per trigger 9 |
| §6 Smoke-template additive update | Operator-stated; trigger 14 guards substance preservation |
| §7 Operator addendum | Operator-stated; binding |
| §8 Out of scope | Operator-stated |
| §9 16 HALT triggers | Operator-stated |
| §10 Phase A audits | Designer must execute the 4 Phase A audits (this document) |
| §11 Test forecast band +25 to +60 | Operator-stated |
| §12 5-phase smoke plan | Operator-stated |
| §13 Authorizations on PASS or PARTIAL | Operator-stated |

**Designer interpretive judgments where the brief left freedom:**

1. **Phase normalization scheme** — the brief did not specify how `Phase 3 — Hosted MCP smoke (15 checks)` becomes a phase-id. Designer chose lower-kebab normalization with semantic substring: `phase-3-hosted-mcp-smoke`. Implementer may adjust if a more robust scheme emerges.
2. **Verdict-tag two-pass extraction** — the brief did not specify how to extract the verdict tag when it appears under the header on the next line. Designer chose: header line + next 5 non-empty lines.
3. **L4 distinction "≥1 positive result row" detection patterns** — the brief named the rule but not the detection bundle. Designer drafted `L4_RESULT_ROW_EVIDENCE` and `L4_RUN_ROW_ONLY_LANGUAGE`. Implementer may extend.
4. **L5 doctrine-risk family list** — currently `['argument_scheme', 'slippery_slope']`. Aliasing rationale: slippery_slope is the doctrinal axis inside Family E. Operator can add more families post-ship via PR to `audit-lint-rules.cjs`.
5. **L6 provenance pattern bundles** — designer drafted 3 bundles. Implementer may extend; operator can tune.
6. **HTML-comment-marker mechanism for fixture protection** — the brief required EITHER exclusion OR negative-fixture classification. Designer chose BOTH (defense-in-depth): marker comment in each file + directory README + directory exclusion contract.
7. **Template scoping** — the brief did not specify which templates to update. Designer chose all three existing smoke templates (`C/D/E`); the OPS templates may be added in a future card if they grow proof obligations.
8. **npm script ergonomic** — the brief did not mandate `package.json` entry. Designer added `audit-lint` script for operator convenience.

Open questions for operator (should be ZERO given the brief comprehensiveness):

- **None.** The brief is sufficiently detailed that the designer can fully specify the implementation. Items 1-8 above are designer judgments well-within the brief's freedom envelope.

---

## Recommended follow-on cards

### `OPS-MCP-SMOKE-LINT-CI-WIRING` (authorized to file)

Wires the audit-lint into automated enforcement when `.github/workflows/` is introduced. Likely contents:

- New `.github/workflows/audit-lint.yml` (or equivalent: Netlify deploy preview hook, pre-commit hook via husky, GitLab CI yaml — depending on operator chosen mechanism).
- The CI job runs the linter against ADDED `docs/audits/*SMOKE*.md` files AND MODIFIED `docs/audits/*SMOKE*.md` files that carry the marker.
- The job fails the PR check if any file produces ≥1 finding.
- Documentation update to `docs/ops/AUDIT-LINT.md` describing the automated enforcement.

### `OPS-MCP-AUDIT-SCHEMA-V2` (deferred; file only if linter heuristics accumulate too many special cases)

Replaces regex-based parsing with a structured YAML front-matter schema for audit docs. Migrates the linter to a schema validator. Heavier-weight; deferred unless implementer experience shows the regex approach is brittle.

---

## Operator steps (after implementer commits)

| Step | Command | When |
| --- | --- | --- |
| 1. Extract fixtures | Run the `git show` commands in Phase A.4 above | Implementer commit 1 |
| 2. Run targeted Jest gate | `npx jest --testPathPattern="opsAuditLint" --no-coverage` | After each commit |
| 3. Run typecheck | `npm run typecheck` | Before PR |
| 4. Run lint | `npm run lint` | Before PR |
| 5. Run full test suite | `npm run test` | Before PR |
| 6. Run Deno regression (unchanged) | `cd mcp-server && deno test --allow-net --allow-env --allow-read` | Before PR |
| 7. Manual smoke (after PR merges) | `node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/<each>.md` for all 4 fixtures | Post-merge |
| 8. Manual corpus census (informational; non-blocking) | `for f in docs/audits/*SMOKE*.md; do node scripts/ops/audit-lint.mjs "$f" --report-only; done` | Post-merge Phase 2 |
| 9. Dogfood the smoke audit itself | `node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-SMOKE-DOCTRINE-HARDENING-SMOKE-<date>.md` | Post-merge Phase 5 |

**None require Supabase deploy.** This card touches no Edge Function, no DB, no migration.
