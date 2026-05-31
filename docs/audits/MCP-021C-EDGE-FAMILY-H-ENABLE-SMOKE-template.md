# MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-021C-EDGE-FAMILY-H-ENABLE (Family H claim_clarity production-mode flip; 12-key uniform ai_classifier — no subset filter; fourth production-enable card under L3+L4+L5 mechanical CI enforcement; SECOND L5-BINDING card whose L5 is CI-mechanically enforced at ship via DOCTRINE_RISK_FAMILIES; the FIRST production-enable card to ship under bounded-parallel limit=2)
**Chain position:** Card 3 (terminal) of 3 in the FAMILY-H suite (MCP-SERVER-009-FAMILY-H → OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK → EDGE-FAMILY-H-ENABLE)
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)

> Template binding source: design §"Smoke template skeleton" + intent
> brief §6 D6.L5 (Family H CI-mechanical L5 enforcement at ship via Card
> 2 `c5bea3b` adding `claim_clarity` / `family_h` / `claim_specificity_low`
> to `DOCTRINE_RISK_FAMILIES`). Fill each section after merge; commit
> the completed audit to `docs/audits/` as
> `MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-<YYYY-MM-DD>.md`. Local pre-lint
> `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push;
> CI MUST exit 0 on the smoke audit PR.

---

## L5 BINDING — CI-mechanical enforcement at ship (read before starting)

**Family H is doctrine-risk-by-construction.** The 12 ai_classifier
keys are STRUCTURAL clarity / specificity / hedging markers: each is a
measurable property of the text (the claim has unspecified scope; a
quantifier is present; a hedging modal appears; a reference is
unclear), NEVER a verdict on the writer or on the claim's quality.
Card 1 amendment (`3097521` ship; `12ec7eb` smoke PASS) verified the
H classifier ships cleanly under admin_validation. This card extends
that posture to production.

**The L5 BINDING obligation in this audit is CI-mechanically enforced
from Card 2 (`c5bea3b`) onwards.** `DOCTRINE_RISK_FAMILIES` in
`scripts/ops/audit-lint-rules.cjs` now contains `claim_clarity` +
`family_h` + `claim_specificity_low` alongside E's `argument_scheme` /
F's `critical_question` / G's `resolution_progress`. The
`L5_PERSISTED_INSPECTION_PATTERNS` rule mechanically requires the
audit author to include persisted `evidence_span` inspection content
for any Family H smoke; CI will fail the audit PR otherwise.

This card is the SECOND L5-BINDING card whose L5 BINDING is
CI-mechanically enforced at ship (G was the first; F was
operator-binding only at ship). DIV-2 (the L5 mechanical posture) is
the second of three H-specific divergences from the G-ENABLE template.

---

## DIV-1, DIV-2, DIV-3 (read before each phase)

- **DIV-1 — subset filter MUST stay ABSENT.** Family H is uniform
  ai_classifier (12 keys). Unlike mixed-source Family G (which carries
  a `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['resolution_progress'] =
  {'ai_classifier'}` entry filtering production to 18 ai_classifier
  keys), Family H MUST NOT carry an entry. Absence = full passthrough
  = byte-equal to admin_validation. Mirrors F's posture (FFE-15/16,
  14 keys), NOT G's (GGE-16/17). HALT 13 binds any edit that adds an
  H entry to the block at `booleanObservationRequestBuilder.ts:68-78`.

- **DIV-2 — L5 BINDING is CI-mechanical at ship.** See above. SECOND
  L5-BINDING card whose L5 is CI-mechanically enforced at ship.

- **DIV-3 — bounded-parallel latency posture.** 7→8 families under
  bounded-parallel limit=2 (PR #364 `2394aef`
  `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` deployed AFTER the G smoke
  ran). Projection: ~22-26s typical (PASS band <30s) OR ~30-40s upper
  bound (PARTIAL band 30-45s) if a batch lands an outlier. Phase 5
  re-measures live. PARTIAL is acceptable; only ≥45s is FAIL (Phase 8
  verdict rule).

---

## Operator fallback rules (read before Phase 2/3)

1. **Use NEW clarity-targeted text crafted at smoke time** (NOT a Card
   1 admin_validation fixture). The Card 1 fixtures are documented as
   admin-baseline proof, not production proof.
2. **If first targeted H production fixture returns
   `mcp_validation_failed`:** do NOT mark PASS; retry once with a
   stronger, clearer clarity-targeted fixture; if still fails, HALT
   and file a scoped fix card. NOTE: there is a known
   concurrency-class `mcp_validation_failed` under burst per
   `[[mcp-validation-failed-burst-concurrency]]`. A single-arg
   targeted submit is NOT a burst; a single-arg recurrence here would
   be the input-subset class — which for H is impossible because H is
   uniform ai_classifier and no subset entry is needed (HALT 13).
3. **If production H fires with a banned clarity-verdict token in
   `evidence_span`:** IMMEDIATE HALT, mark FAIL, and file a scoped
   fix card (HALT 18 BINDING DOCTRINE FAIL).
4. **Confirm OPDEC-A (operator gate ratification) at PR-creation
   time.** The Family H thaw must be explicitly ratified in the
   operator's most-recent written direction. If unratified, the
   reviewer pauses + flags (HALT 23).

---

## Phase 1 — Pre-flight

- [ ] HEAD at merge SHA; `git status` clean (only the known
      operator-territory untracked files: `.tmp/`, `out/`,
      `.claude/scheduled_tasks.lock`, `phase5-*.log`, `c10-rpm.*`,
      `mcp021c-edge-smoke-*`, `netlify-prod.git/`, smoke / harvest /
      audit artifacts).
- [ ] Edge Functions auto-deployed via GitHub integration:
      `submit-argument` and `classify-argument-boolean-observations`
      reflect post-merge version timestamps (wait ~30-90s post-merge).
- [ ] Verify Edge familyRegistry Family H entry post-merge state:
      `productionEnabled: true, adminValidationEnabled: true` at
      `supabase/functions/_shared/booleanObservations/familyRegistry.ts:106`
      (line 106 flip confirmed live; HALT 12 defense).
- [ ] Verify A/B/C/D/E/F/G entries byte-equal preserved
      (productionEnabled: true). I/J byte-equal preserved
      (productionEnabled: false).
- [ ] Subset filter block at
      `booleanObservationRequestBuilder.ts:68-78` STILL holds only D +
      G entries; NO H entry (DIV-1; HALT 13 defense).
- [ ] Targeted regression: Jest test count >= 18,779 + new tests;
      Deno mcp-server tests byte-equal baseline (no `mcp-server/**`
      change).
- [ ] Operator gate ratification confirmed (OPDEC-A; the Family H
      thaw is explicitly authorized in operator direction at the
      merge timestamp; HALT 23 defense).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Auto-trigger dispatch (L3a) — 8 production runs A+B+C+D+E+F+G+H

**L3a obligation:** auto-trigger fires under bounded-parallel
limit=2; 8 production runs created on a NEW arg via `submit-argument`;
run_mode='production' on every row; A/B/C/D/E/F/G remain unregressed
(allSettled-style runner isolation preserves them through any H
failure).

- [ ] Submit a NEW clarity-targeted argument via `submit-argument`
      Edge Function. **Operator binding (fallback rule 1): the
      targeted body MUST be NEW clarity-targeted text crafted at
      smoke time** (NOT a Card 1 admin_validation fixture). Arg id
      recorded.
- [ ] Wait ~30s for the 8-family bounded-parallel background
      dispatch (limit=2; ~4 batches × ~5-7s per family).
- [ ] Query `argument_machine_observation_runs` for the new arg id:
      verify EXACTLY 8 production runs (run_mode='production',
      provider_key=PROVIDER_KEY) for A+B+C+D+E+F+G+H observed.
- [ ] All 8 runs `status='success'` (or at minimum: clean `'failed'`;
      no missing rows).
- [ ] I/J do NOT have production rows for this arg (registry-derived
      dispatcher correctly excluded them; query asserts zero matches).
- [ ] Capture latency: per-family duration table + total dispatch
      wall-time (feeds Phase 5).

**Result:** ☐ PASS ☐ FAIL — _<arg id; run ids; per-family duration table>_

---

## Phase 3 — Targeted-signal (L3b + L4) — Family H positive result row required

**L3b + L4 obligation:** the targeted arg MUST contain deliberately
clarity-targeted text (a broad claim with no quantifier or temporal
frame; a claim with hedging modals; a claim with an unclear
reference; etc.). At least 1 positive result row from targeted text.
**0 positives on a targeted text is NOT PASS** — use a stronger
targeted fixture before accepting PASS.

**Fallback rules (operator binding from fallback rule 2):**
- If first targeted H production fixture returns
  `mcp_validation_failed`: do NOT mark PASS; retry once with a
  stronger, clearer clarity-targeted fixture; if still fails, HALT
  and file a scoped fix card.

- [ ] Submit a SECOND new argument with body deliberately exercising
      one or more Family H clarity / specificity / hedging patterns
      (recommended starter fixture: a body whose pattern is likely to
      trigger `claim_specificity_low` — the H doctrinal-axis partner
      per the H Card 1 design § "axis-partner" choice — OR
      `hedging_present` / `modal_language_present` /
      `unclear_reference_present` / `quantifier_present` /
      `multiple_claims_present`). Arg id recorded.
- [ ] Wait ~30s for the 8-family bounded-parallel dispatch.
- [ ] Query `argument_machine_observation_results` for the new arg's
      Family H production run:
      `SELECT raw_key, confidence, evidence_span FROM argument_machine_observation_results r JOIN argument_machine_observation_runs runs ON runs.id = r.run_id WHERE r.family = 'claim_clarity' AND runs.run_mode = 'production' AND runs.argument_id = '<arg-id>';`
- [ ] Verify at least 1 positive result row (`raw_key` in the 12-key
      Family H set: `provides_temporal_constraint`, `claim_present`,
      `reason_present`, `conclusion_missing`, `reason_missing`,
      `multiple_claims_present`, `claim_specificity_high`,
      `claim_specificity_low`, `quantifier_present`,
      `modal_language_present`, `hedging_present`,
      `unclear_reference_present`; `confidence` band emitted).
      Record the result-row evidence as a
      `raw_key | confidence | evidence_span` table so the L4 lint
      pattern matches the doc.
- [ ] **If 0 positives:** record the fixture text, design a stronger
      targeted fixture, resubmit, repeat. PASS REQUIRES at least 1
      positive result row from targeted text.
- [ ] **If `mcp_validation_failed`:** apply fallback rule 2 (one
      retry with stronger fixture; HALT if second attempt also
      fails).

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<arg id; positives table; fixture text>_

---

## Phase 4 — Read-path (L3c) — Source 6 production rows visible

**L3c obligation:** Source 6 production-only filter
(`src/features/nodeLabels/machineObservationPersistenceQuery.ts`
`run_mode='production'` filter) returns the Family H production
result rows for the Phase 3 arg.

- [ ] Source 6 query path returns the Family H production result rows
      for the Phase 3 arg.
- [ ] A+B+C+D+E+F+G rows ALSO present in the Source 6 result for the
      same arg (8-family production read-path coverage verified).
- [ ] admin_validation rows for the same arg (if any exist) are NOT
      counted as production proof — they are filtered out by the
      production-only filter (Source 6 separation invariant holds).
- [ ] Defensive: confirm Family H has exactly 12 distinct rawKeys
      reachable in production (uniform ai_classifier; no subset
      filter; DIV-1).

**Result:** ☐ PASS ☐ FAIL — _<query output excerpts>_

---

## Phase 5 — Latency re-measure at 8 families (D8)

**D8 obligation:** re-measure `wall_clock_background` p95 live at 8
families under bounded-parallel limit=2 with N=5 fresh submissions
(canary-first; gated Anthropic spend ≈ 40-45 calls; no JWTs logged;
no `out/` committed). Compare against the codified budget:
`WARN_SECONDS=30`, `FAIL_SECONDS=45` (per
`scripts/ops/mcp-latency-report-lib.cjs`).

- [ ] N=5 fresh submissions (canary-first; each fires 8 production
      runs under bounded-parallel limit=2).
- [ ] Run `scripts/ops/mcp-latency-report.mjs`; compute
      `wall_clock_background` p50/p95 at 8 families.
- [ ] Classify against the 30s/45s budget; compare measured-8-family
      p95 to the bounded-parallel projection (~22-26s typical;
      ~30-40s upper if a batch lands an outlier).
- [ ] State whether the bounded-parallel pre-Family-H latency gate
      (PR #364 `2394aef`) held — i.e., 8-family p95 < 45s.
- [ ] Q9 clean (auto-trigger runs classify as
      `audit_or_smoke_rerun`; no `organic_duplicate_candidate` for
      fresh args).
- [ ] If the report adds ops SQL, it lives in
      `scripts/ops-latency-sql/` (NOT `scripts/ops/sql/` — observability-owned
      16-file count; banked lesson `[[ops-sql-dir-observability-owned]]`).
      This card itself adds no SQL.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<p50/p95 table; projection comparison>_

> PASS at 8 families is the EXPECTED outcome under bounded-parallel
> limit=2 — the pre-Family-H latency gate has been pre-paid. PARTIAL
> is acceptable if a batch lands an outlier. Only ≥45s is FAIL — that
> contradicts the bounded-parallel projection AND the pre-paid gate,
> and is a hard stop.

---

## Phase 6 — Doctrine (L5 BINDING; CI-mechanically enforced for Family H)

**L5 BINDING obligation (CI-mechanical via DOCTRINE_RISK_FAMILIES;
DIV-2):** Family H is doctrine-risk-by-construction. The audit MUST
include persisted `evidence_span` inspection content; CI will fail
the audit PR otherwise (`L5_PERSISTED_INSPECTION_PATTERNS` rule in
`scripts/ops/audit-lint-rules.cjs`).

- [ ] **R1 — column pre-check:** verify the
      `argument_machine_observation_results` table has columns
      `raw_key`, `confidence`, `evidence_span`, `family`, `run_id`.
      (Catches a schema drift that would silently break the doctrine
      scan.)
- [ ] Use a live ADVERSARIAL clarity-targeted text (asymmetric
      framing likely to fire `claim_specificity_low` — the H
      doctrinal-axis partner; a broad / unspecified-scope claim that
      the classifier should mark structurally while the persisted
      `evidence_span` MUST NOT echo a verdict on the writer or the
      claim).
- [ ] If `claim_specificity_low` or another doctrine-risk H key
      fired in Phase 3: skip to "ban-list scan" below.
- [ ] If NOT fired: design a STRONGER clarity-targeted fixture whose
      pattern is likely to trigger `claim_specificity_low`
      specifically (broad / unspecified-scope claim with no
      quantifier / temporal frame). Resubmit; query; repeat Phase 3 +
      4 for the new arg.
- [ ] **Ban-list scan over clarity-doctrine patterns** (16-pattern
      set, per the H Card 1 design's doctrine-ban list):
      `winner`, `loser`, `won`, `lost`, `defeated`, `true`, `false`,
      `correct`, `invalid`, `refutes`, `proves wrong`,
      `weak argument`, `fallacy`, `lazy`, `sloppy`,
      `vague-as-criticism` (and the rendering-adjacent set:
      `dishonest`, `bad faith`, `manipulative`).
- [ ] Query persisted `evidence_span` for the Family H production
      rows containing clarity keys; scan for any of the patterns.
      Verify ZERO banned tokens present.
- [ ] If targeted input contained adversarial verdict bait
      (quality-judgment tokens from the ban-list above): verify NO
      ECHO in output `evidence_span`.
- [ ] **If a banned clarity-verdict token is present in persisted H
      production `evidence_span`:** **HALT IMMEDIATELY** and FAIL
      (HALT 18 BINDING DOCTRINE FAIL; file scoped fix card).
- [ ] Doctrine note: H's keys are STRUCTURAL clarity / specificity /
      hedging observations — never a quality judgment on the
      argument. `claim_specificity_low` is a structural broad-claim
      marker (no verdict on quality); `hedging_present` is a
      structural modality marker (no verdict on confidence); etc.
      (cdiscourse-doctrine §1; see also the H Card 1 design §
      "axis-partner" choice).

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<fixture text; H rows; ban-list scan output; evidence_span excerpts>_

---

## Phase 7 — Observability + enforcement-loop provenance

**Required subsection (verbatim per design §Phase 7):**

> "Fourth-enforcement provenance: fourth PRODUCTION-ENABLE card
> linted by audit-lint CI; SECOND L5-BINDING card whose L5 BINDING is
> CI-mechanically enforced at ship (`claim_clarity` / `family_h` /
> `claim_specificity_low` ∈ `DOCTRINE_RISK_FAMILIES` per Card 2
> `c5bea3b`). CI workflow run ID: `<id from PR>`; in_scope count:
> `<n>`; linter exit: 0. L3 satisfied by Phases 2+3+4 (dispatch ✓ +
> targeted-signal ✓ + read-path ✓). L4 satisfied by Phase 3 targeted
> clarity text producing ≥1 positive result row. L5 BINDING
> satisfied by Phase 6 persisted `evidence_span` doctrine inspection
> (≥1 clean firing under production mode)."

- [ ] Q14 density: Family H production density present (FIRST real
      production data for H).
- [ ] Record the 8-family operational state (A+B+C+D+E+F+G+H
      production LIVE; I/J admin_validation only).
- [ ] Record latency observations (per-family + total dispatch
      wall-time at 8 families; bounded-parallel limit=2).
- [ ] **Bounded-parallel pre-Family-H latency gate verification:**
      PR #364 (`2394aef`) measured held / not held; 8-family p95 vs
      the bounded-parallel projection.
- [ ] Doctrine-key calibration note (any unexpected Family H
      `raw_key` behaviour observed during the smoke).
- [ ] **FAMILY-H suite completion note:** 3-card H suite complete; 8
      families production+auto-trigger; I/J unsupported.

**Result:** ☐ PASS ☐ FAIL — _<provenance subsection completed>_

---

## Phase 8 — Verdict + authorization

- [ ] **Pre-push audit-lint:** `node scripts/ops/audit-lint.mjs
      docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-<date>.md`
      exits 0 before push.
- [ ] CI runs on the smoke audit PR and exits 0 (L1-L6 mechanically
      enforced; L3+L4+L5 met; L5 mechanically enforced for H via
      `DOCTRINE_RISK_FAMILIES`).
- [ ] Verdict:
  - **PASS:** 8 runs verified; L3/L4/L5 each satisfied by an
    explicit phase; Phase 6 ≥1 clean firing (doctrine-clean);
    latency under 30s (bounded-parallel projection holds); A–G
    unregressed; pre-lint + CI exit 0.
  - **PARTIAL:** Phase 3 0-positives even on stronger targeted arg;
    OR Phase 6 0-fire even after fallback; OR Phase 5 p95 in 30–45s
    (acceptable under bounded-parallel; flag for follow-up if
    persists).
  - **FAIL:**
    - Phase 6 dirty firing (clarity-verdict token in H production
      `evidence_span`) → IMMEDIATE HALT + fix card.
    - Phase 3 `mcp_validation_failed` on first AND fallback (NOT the
      burst-class — single-arg only) → HALT + fix card.
    - Any non-Family-H rawKey on an H run.
    - A–G byte-equal/regression failure.
    - Phase 5 p95 ≥45s at 8 families (contradicts the
      bounded-parallel projection and the pre-paid gate).
    - CI passes an L-violating audit.
    - Operator gate not ratified at PR-creation time (OPDEC-A; HALT 23).

**Authorizations granted on PASS:**
- `MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE: PASS`
- Family H PRODUCTION + auto-trigger LIVE (8 production families
  A–H)
- FAMILY-H 3-card suite COMPLETE
- `MCP-SERVER-010-FAMILY-I` AUTHORIZED to begin (I is mixed-source
  per the H/I/J planning decision; J still unsupported until its own
  suite)

**Final verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<verdict notes>_

---

**Required final step:** Run `node scripts/ops/audit-lint.mjs <this-doc>`;
MUST exit 0 before Verdict line is valid.
