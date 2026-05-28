# MCP-SERVER-007-FAMILY-F-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-SERVER-007-FAMILY-F (Critical Question — 14 Walton (1995, 2008) + Toulmin (1958) + Peirce critical questions)
**Path chosen at Stage 2B:** Stage 2B NOT REQUIRED (uniform ai_classifier, 14/14 keys; MAX_TOKENS=1500 with ~310 token headroom; admin_validation-only)
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Hosted MCP server build:** _<deno-deploy-version>_
**Edge Function build:** _<supabase-function-version>_ (unchanged by this card; existing entry at familyRegistry.ts:95-97)

> Template binding source: design §5 (8-phase smoke plan incl. Phase 4b
> adversarial CQ doctrine verification + Phase 7 D12 BINDING enforcement-
> loop provenance subsection) + intent brief §9 (PASS / PARTIAL / FAIL
> criteria) + intent brief §4 D4 (3 mandatory + 2 optional adversarial
> fixtures BINDING) + intent §4 D5 (12 Family-F-specific ban-list tokens
> BINDING) + intent §4 D10 (`Audit-Lint: v1` marker BINDING). Fill each
> section after merge; commit the completed audit to `docs/audits/` as
> `MCP-SERVER-007-FAMILY-F-SMOKE-<YYYY-MM-DD>.md`.

---

## Phase 1 — Pre-flight

- [ ] `git log --oneline -1 main` shows the PR merge SHA at the top.
- [ ] `git status` clean on `main` (10 known operator-territory
      untracked files documented as expected).
- [ ] Hosted MCP `/health` returns 200 OK and reports the post-merge
      build hash.
- [ ] Supabase Edge Function `classify-argument-boolean-observations`
      shows ACTIVE status + post-merge version timestamp.
- [ ] Supabase Edge Function `semantic-referee` shows ACTIVE status
      (regression: unchanged by this card).
- [ ] DB `config` row: `provider_mode=mcp`, `enabled=true`.
- [ ] Verify Edge familyRegistry Family F entry remains
      `productionEnabled: false, adminValidationEnabled: true` (NO edit
      should have happened in this card; Edge changes are operator-
      territory, deferred to Card 3 of the three-card chain).
- [ ] Verify Edge familyRegistry Family E entry remains
      `productionEnabled: false, adminValidationEnabled: true` (Card 2
      of the chain will flip it; not this card).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Local Deno regression

```bash
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

- [ ] Expected: ~887-922 tests passed (792 pre-Family-F baseline +
      ~95-130 new Family F tests; implementer reported ~871 / 0 at C4).
- [ ] All 6 family suites pass: familyA*, familyB*, familyC*,
      familyD*, familyE*, familyF*.
- [ ] No `family_f` or `critical_question` test failures.
- [ ] familyFAdversarialDoctrine.test.ts passes (intent §4 D4 BINDING;
      26 tests covering 5 D4 fixtures + 12 D5 ban-list tokens + 3 E↔F
      cross-checks + reviewer matrix sub-check).
- [ ] familyFKeys.test.ts passes (14 tests; 6 doctrine-risk per-key
      guards verbatim).
- [ ] familyFPrompt.test.ts passes (22 tests; 7 absolute rules
      byte-equal to A-E; consequence_probability_unclear E↔F doctrine
      anchor verbatim).
- [ ] familyFAnthropic.test.ts passes (11 tests; MAX_TOKENS=1500
      verified at call-args level).
- [ ] familyRegistryInit.test.ts passes (6-family insertion order;
      family-f-has-14-rawKeys; family-f-classifier-version-is-family-f-v1).

**Result:** ☐ PASS ☐ FAIL — _<test count>_

---

## Phase 3 — Hosted MCP server smoke (19 checks; OPERATOR-RUN)

```bash
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-bearer-token>
```

Expected output (truncated, with bearer redacted):

```
PASS [1-health]
PASS [2-compat-no-auth]
PASS [3-compat-bad-token]
PASS [4-compat-semantic-move]
PASS [5-compat-boolean-family-a]
PASS [6-mcp-initialize]
PASS [7-mcp-tools-list]
PASS [8-mcp-tools-call-semantic]
PASS [9-mcp-tools-call-boolean-family-a]
PASS [10-compat-boolean-family-b]
PASS [11-mcp-tools-call-boolean-family-b]
PASS [12-compat-boolean-family-c]
PASS [13-mcp-tools-call-boolean-family-c]
PASS [14-compat-boolean-family-d]
PASS [15-mcp-tools-call-boolean-family-d]
PASS [16-compat-boolean-family-e]
PASS [17-mcp-tools-call-boolean-family-e]
PASS [18-compat-boolean-family-f]
PASS [19-mcp-tools-call-boolean-family-f]

MCP-SERVER-001 smoke: 19 PASSES, 0 FAILS
EXIT: 0
```

- [ ] All 19 checks PASS.
- [ ] Check 18 returns `family-f-v1` in modelInfo.classifierSetVersion.
- [ ] Check 19 returns `family-f-v1` in modelInfo.classifierSetVersion
      AND `isError:false`.
- [ ] No bearer token / API key visible in any log line.

**Result:** ☐ PASS ☐ FAIL — _<verbatim PASS line; paste output here with bearer redacted>_

---

## Phase 4 — Edge admin_validation smoke (Family F)

Acquire admin JWT via the documented Card 1 pattern. POST to Edge
`classify-argument-boolean-observations`:

```json
{
  "argumentIds": [
    "<seeded-arg-id-1>",
    "<seeded-arg-id-2>",
    "<seeded-arg-id-3>"
  ],
  "requestedFamilies": ["critical_question"],
  "runMode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

Expected (per design §5 + intent brief §9):

- [ ] HTTP 200.
- [ ] `time_total` between ~14s and ~18s (latency projection: 14 keys
      × 3 args ≈ 14.6s; conservative ceiling: 18s including TLS / cold-
      start variance on Deno Deploy).
- [ ] 3 `perArgument` entries; all `status=success`.
- [ ] `positiveObservationCount >= 0` per arg (0 positives across all
      3 args is PARTIAL-acceptable per design §5 Phase 4b asymmetric
      firing-count resolution).
- [ ] `raw_keys ⊆ Family F 14-key set` for any positive.
- [ ] **NO** Family A/B/C/D/E key in `rawKeysWithPositive` (taxonomy
      boundary check).
- [ ] `classifierSetVersion=family-f-v1` in each perArgument entry's
      modelInfo.
- [ ] `mode=admin_validation` (not `production`).
- [ ] No `mcp_validation_failed` envelope.
- [ ] **Production-mode regression:** POST same body with
      `runMode=production`; the Edge function should REJECT
      critical_question at the production-mode gate (HALT trigger #7
      guard at the Edge boundary; Family F productionEnabled=false).

**If any positives ARE observed (operator inspection of evidenceSpans):**
- [ ] No positive CQ evidenceSpan contains `fallacy` / `fallacious` /
      `weak argument` / `invalid argument` / `bad reasoning` / `flawed` /
      `wrong` / `proof of` / `unmet-means-fallacy` / `proves wrong` /
      `invalidates` / `refutes` (intent §4 D5 binding).
- [ ] Each positive CQ's evidenceSpan anchors a verbatim quote from
      the move body anchoring the structural GAP (missing warrant,
      missing mechanism, probability gap), not a quality judgment.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<time_total>, <positiveObservationCount per arg>_

---

## Phase 4b — DOCTRINE: adversarial critical_question verification (BINDING)

This is the existential doctrine verification phase. Per intent §9:
PASS requires the adversarial CQ fixtures to produce doctrine-clean
OUTPUT regardless of whether the model fires on the pattern. This is
the L5 mechanical enforcement layer.

**Step 1:** POST to the Edge admin_validation endpoint with an argument
whose text matches Adversarial Fixture A (clear slippery-slope chain,
no fallacy framing in input — verbatim Family E's slippery-slope-clear
input):

```json
{
  "argumentIds": ["<seeded-arg-with-slippery-slope-text>"],
  "requestedFamilies": ["critical_question"],
  "runMode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

**Step 2:** Inspect the response row in `argument_machine_observation_results`:
- [ ] **PRE-CHECK column names** (R1 per Family E amendment precedent —
      `run_id` confirmed as the column name in Family E smoke; reconfirm
      at audit time). Main query MUST return non-empty rows.
- [ ] If `observations.consequence_probability_unclear === true`:
  - [ ] Verify `evidence_span.consequence_probability_unclear` does NOT
        contain `fallacy`, `fallacious`, `weak argument`, `invalid
        argument`, `bad reasoning`, `flawed`, `wrong`, `proof of`,
        `unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`,
        `logical error`, `informal fallacy`.
  - [ ] Verify `evidence_span.consequence_probability_unclear` anchors
        the PROBABILITY GAP (a verbatim quote of the chain step that
        lacks probability framing — e.g., "they will expand to a second
        category, then a third, then a fourth").
- [ ] If `observations.consequence_probability_unclear === false`:
  - [ ] Pattern did not fire on this argument; document as PARTIAL per
        intent §9 asymmetric firing-count resolution. Not a failure.

**Step 3:** POST a second admin_validation request with an argument
whose text matches Adversarial Fixture C (input contains "fallacy"
TWICE — existential adversarial):
- [ ] Repeat the doctrine verification on the response.
- [ ] **Critical assertion:** even though the INPUT contains "fallacy",
      the OUTPUT must NOT echo `fallacy` in any evidenceSpan. The
      evidenceSpan must anchor the STRUCTURAL GAP (e.g.,
      "probabilities are not the point"), NOT the fallacy framing
      lifted from the input.

**Step 4:** Optionally POST a third admin_validation request with
Adversarial Fixture B (CQ-met baseline; probability anchors present):
- [ ] Verify CQ does NOT fire (or fires with extreme low confidence).
      Calibration proof.

**Step 5:** Optionally POST adversarial fixtures D + E (multi-CQ
mixed-state + verdict-baiting bait):
- [ ] Verify NONE of the positive CQs' evidenceSpans contain D5 banned
      tokens.

**Phase 4b verdict (per intent §9 asymmetric firing-count resolution):**
- **PASS:** All CQ-positive evidenceSpans are doctrine-clean (>=1
  firing, all clean).
- **PARTIAL:** 0 of 3 firings (pattern not exercised live; do NOT
  authorize Family F production until stronger fixture).
- **FAIL:** Any CQ-positive evidenceSpan contains a banned token
  (>=1 firing, any dirty — existential doctrine violation; HALT).

This is the existential phase. A FAIL here is a doctrine violation;
HALT and revert. The implementer must NOT proceed to Phase 5 until
Phase 4b PASS or PARTIAL.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<per-fixture doctrine check results>_

---

## Phase 5 — Unsupported G/H/I/J rejection regression (4 families remaining)

POST to Edge `classify-argument-boolean-observations` with each of the
4 still-unsupported families against `arg2`.

| Family | Expected response |
| --- | --- |
| G — `resolution_progress` | HTTP 200; `status=failed`; `failureReason=mcp_validation_failed`; 0 positives; empty rawKeys |
| H — `claim_clarity` | same |
| I — `thread_topology` | same |
| J — `sensitive_composer` | same |

- [ ] All 4 still-unsupported families correctly rejected at the MCP
      server's registry boundary.
- [ ] No Family A/B/C/D/E/F keys leaked into any unsupported-family
      response.
- [ ] **Family F `critical_question` is now SUPPORTED at the MCP server**
      and should be ABSENT from the unsupported-family test set.

**Result:** ☐ PASS ☐ FAIL — _<4/4 expected outcomes>_

---

## Phase 6 — Targeted Jest + Deno regression

```bash
cd .. && npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|familyE|familyF|opsMcp)" --no-coverage
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

- [ ] Jest exit 0.
- [ ] Deno exit 0.
- [ ] Total Jest test count not lower than the implementer report
      (~18,153 baseline + new Family F Edge registry test if added).
- [ ] Total Deno test count ≥ 871 (implementer's C4 baseline; up
      from 792 pre-Family-F).
- [ ] `familyFAdversarialDoctrine.test.ts` continues to pass (26 tests).
- [ ] `mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` continues to pass
      (Card 3 baseline preserved; Family E admin-validation-only).

**Result:** ☐ PASS ☐ FAIL — _<test counts>_

---

## Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE (D12 BINDING)

**Required subsection per intent §4 D12 BINDING:**

> First-enforcement provenance: this is the first family-ship PR to be
> linted by audit-lint CI with a non-empty in-scope set. CI workflow
> run ID: `<id>`; in_scope count: `<n; should be 1 — the smoke audit
> itself>`; linter exit: 0. L1-L6 mechanical enforcement empirically
> validated end-to-end.

- [ ] **6 families now operational on the hosted MCP server:**
  - Family A (`parent_relation`): production + auto-trigger live.
  - Family B (`disagreement_axis`): production + auto-trigger live.
  - Family C (`misunderstanding_repair`): production + auto-trigger live.
  - Family D (`evidence_source_chain`): production + admin_validation.
  - Family E (`argument_scheme`): admin_validation ONLY (Card 2 of
    the chain will flip).
  - Family F (`critical_question`): admin_validation ONLY (NEW; Card
    3 of the chain will flip).
- [ ] **4 families still unsupported on the MCP server** (G, H, I, J).
      Registry rejection continues to enforce admin-validation-only
      semantics at the unsupported-family layer.
- [ ] **Latency observations:** Phase 4 Family F admin_validation
      latency recorded; comparison to ~14.6s projection.
- [ ] **Token budget observation:** Phase 3 hosted MCP smoke completed
      with no truncation on Family F 14-key response; `MAX_TOKENS=1500`
      is currently fitting (~310-token headroom; wider than Family E's
      ~60 token headroom).

**Doctrine-risk-key real-corpus calibration (if Phase 4 produced
positives):**
- [ ] `consequence_probability_unclear` evidenceSpans inspected for
      "no fallacy framing; anchors probability gap" — operator spot-check
      passed.
- [ ] `analogy_mapping_missing` evidenceSpans inspected for
      "no fallacy framing; anchors mapping absence" — operator spot-check
      passed.
- [ ] `alternative_explanation_available` evidenceSpans inspected for
      "no fallacy framing; anchors unaddressed alternative" — operator
      spot-check passed.
- [ ] `causal_mechanism_missing` / `authority_basis_missing` /
      `missing_warrant` evidenceSpans likewise doctrine-clean.

**CQ-detection variance (operator notes):**
- [ ] Multi-CQ outputs are allowed and expected (most moves exhibit
      0-2 unmet CQs; some carry 3-4).
- [ ] Conservative-positives bias observed (model does not mark all
      14 rawKeys true on a single input).

---

## Phase 8 — Verdict + authorization

### PASS criteria (all required)

- [ ] Phase 1 pre-flight clean.
- [ ] Phase 2 local Deno: ~871-922 / 0.
- [ ] Phase 3 hosted MCP smoke: 19/19 PASS.
- [ ] Phase 4 admin_validation: HTTP 200 + valid Family F response
      shape + raw_keys ⊆ Family F 14-key set (0-positives PARTIAL is
      acceptable per intent §9 asymmetric firing-count resolution).
- [ ] **Phase 4b BINDING:** doctrine-clean CQ output (or documented
      PARTIAL if pattern did not fire). Any banned token in CQ
      evidenceSpan = FAIL.
- [ ] Phase 5 unsupported rejection: all 4 still-unsupported families
      (G-J) correctly rejected; Family F now SUPPORTED.
- [ ] Phase 6 targeted regression: all exit 0.
- [ ] Phase 7 enforcement-loop provenance subsection present verbatim
      per intent §4 D12.

### Authorization granted on PASS

- [ ] `MCP-SERVER-007-FAMILY-F-SMOKE: PASS`.
- [ ] Family F `admin_validation` is now OPERATIONAL.
- [ ] **Gate A** UNBLOCKS Card 2 of the three-card chain
      (`MCP-021C-EDGE-FAMILY-E-ENABLE`; Family E production flip).
- [ ] `OPS-MCP-OBSERVABILITY-FAMILY-F-COVERAGE` (optional, recommended)
      authorized for 6-family-state observability roll-up.

### PARTIAL conditions (file scoped fix card; do NOT begin Card 2)

- [ ] Phase 4 returned 0 positives across all 3 seeded args (intent §9
      — acceptable, documented).
- [ ] Phase 4b CQ did not fire on any of 3 adversarial fixtures (intent
      §9 — acceptable, documented).
- [ ] Phase 7 CI workflow run ID NOT captured because CI didn't trigger
      on this PR (PARTIAL with explanation).

### FAIL conditions (file MCP-SERVER-007-FAMILY-F-FIX; consider revert)

- Phase 3 < 19 checks pass.
- Phase 4 returns non-Family-F raw_keys (taxonomy violation).
- **Phase 4b returns any CQ evidenceSpan containing `fallacy`,
  `fallacious`, `weak argument`, `invalid argument`, `bad reasoning`,
  `flawed`, `wrong`, `proof of`, `unmet-means-fallacy`, `proves wrong`,
  `invalidates`, `refutes`, `logical error`, or `informal fallacy`
  (existential doctrine violation).**
- Phase 4 returns Family F positive in `runMode=production` (HALT
  trigger #7 guard; production-mode flip is Card 3 of the chain).
- Phase 5 any unsupported family accepted (security-adjacent
  regression).
- Phase 6 broad regression (Family A/B/C/D/E byte-equal failure).
- **Phase 7 enforcement-loop provenance subsection missing** (CI
  workflow run ID + in_scope count + linter exit) — D12 BINDING.

---

## Audit metadata

- **Operator command log:** _<paste redacted commands run during the smoke; bearer tokens replaced with [REDACTED]>_
- **Hosted smoke raw output (truncated, redacted):** _<paste 19-check PASS output>_
- **Edge admin_validation response (redacted):** _<paste 3-arg response JSON; redact admin JWT + emails>_
- **Phase 4b adversarial CQ responses (per-fixture):** _<paste 3 response rows with doctrine-check notes>_
- **Unsupported-family rejection responses (compact):** _<paste 4 envelopes>_
- **Phase 7 enforcement-loop provenance:** _<CI run ID; in_scope count; linter exit code; verbatim per intent §4 D12>_
- **Notable observations:** _<free-text>_

---

## Sign-off

- **Operator signature:** _<name>_
- **Date:** _<YYYY-MM-DD>_
- **Verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL

Filed at: `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-<YYYY-MM-DD>.md`
(rename this file from `-template.md` to the dated filename on commit).

---

## Audit-lint required final step

Before signing the Verdict line above:

```
node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-<YYYY-MM-DD>.md
```

This MUST exit 0 before the verdict is valid. The linter enforces
the operator-stated audit-integrity rules R1-R4 via L1-L6, including:

- L1 — required-phase NOT-RUN + verdict PASS fails (Phase 3 hosted
  MCP smoke is REQUIRED for family-ship)
- L2 — indirect-proof phrase ("covered indirectly", "would pass") in
  a NOT-RUN direct-proof phase fails
- L5 — Family F is a doctrine-risk family (critical_question /
  consequence_probability_unclear partners with Family E
  slippery_slope_reasoning_present); the audit MUST cite persisted
  `evidence_span` inspection
- L6 — if this audit is an amendment / hosted-completion / upgrade,
  it must name all three of priorVerdict + missingProof +
  newlySuppliedProof

If the linter reports a finding, EITHER (a) run the missing phase to
PASS, OR (b) downgrade the verdict to PARTIAL, OR (c) add the
required provenance language. Do NOT sign PASS while the linter exits
non-zero.

See `docs/ops/AUDIT-LINT.md` for the full rule reference.
