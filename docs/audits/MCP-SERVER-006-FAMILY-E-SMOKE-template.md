# MCP-SERVER-006-FAMILY-E-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-SERVER-006-FAMILY-E (Argument Scheme — 16 Walton (1995, 2008) schemes)
**Path chosen at Stage 2B:** Stage 2B NOT REQUIRED (uniform ai_classifier, 16/16 keys; MAX_TOKENS=1500; admin_validation-only)
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Hosted MCP server build:** _<deno-deploy-version>_
**Edge Function build:** _<supabase-function-version>_ (unchanged by this card; existing entry at familyRegistry.ts:89-93)

> Template binding source: design §6 (8-phase smoke plan incl. Phase 4b
> adversarial doctrine verification) + intent brief §14 (PASS / PARTIAL /
> FAIL criteria) + operator amendment §2 (≥3 adversarial slippery_slope
> fixtures BINDING) + amendment §5 (Phase 4b PASS criterion: doctrine-
> clean OUTPUT regardless of fire/no-fire). Fill each section after
> merge; commit the completed audit to `docs/audits/` as
> `MCP-SERVER-006-FAMILY-E-SMOKE-<YYYY-MM-DD>.md`.

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
- [ ] Verify Edge familyRegistry Family E entry remains
      `productionEnabled: false, adminValidationEnabled: true` (NO edit
      should have happened in this card; Edge changes are operator-
      territory, deferred to MCP-021C-EDGE-FAMILY-E-ENABLE).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Local Deno regression

```bash
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

- [ ] Expected: ~709-729 tests passed (614 pre-Family-E baseline +
      ~95-115 new Family E tests; implementer reported 792 / 0).
- [ ] All 5 family suites pass: familyA*, familyB*, familyC*,
      familyD*, familyE*.
- [ ] No `family_e` or `argument_scheme` test failures.
- [ ] familyEAdversarialSlipperySlope.test.ts passes (amendment §2
      BINDING).

**Result:** ☐ PASS ☐ FAIL — _<test count>_

---

## Phase 3 — Hosted MCP server smoke (17 checks)

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

MCP-SERVER-001 smoke: 17 PASSES, 0 FAILS
EXIT: 0
```

- [ ] All 17 checks PASS.
- [ ] Check 16 returns `family-e-v1` in modelInfo.classifierSetVersion.
- [ ] Check 17 returns `family-e-v1` in modelInfo.classifierSetVersion
      AND `isError:false`.
- [ ] No bearer token / API key visible in any log line.

**Result:** ☐ PASS ☐ FAIL — _<verbatim PASS line; paste output here with bearer redacted>_

---

## Phase 4 — Edge admin_validation smoke (Family E)

Acquire admin JWT via the documented Card 1 pattern. POST to Edge
`classify-argument-boolean-observations`:

```json
{
  "argumentIds": [
    "<seeded-arg-id-1>",
    "<seeded-arg-id-2>",
    "<seeded-arg-id-3>"
  ],
  "requestedFamilies": ["argument_scheme"],
  "runMode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

Expected (per design §6 + intent brief §14 + amendment §5):

- [ ] HTTP 200.
- [ ] `time_total` between ~20s and ~28s (latency projection; cold-start
      may add 2-3s).
- [ ] 3 `perArgument` entries; all `status=success`.
- [ ] `positiveObservationCount >= 0` per arg (amendment §5: 0 positives
      across all 3 args is PARTIAL-acceptable).
- [ ] `raw_keys ⊆ Family E 16-key set` for any positive.
- [ ] **NO** Family A/B/C/D key in `rawKeysWithPositive` (taxonomy
      boundary check).
- [ ] `classifierSetVersion=family-e-v1` in each perArgument entry's
      modelInfo.
- [ ] `mode=admin_validation` (not `production`).
- [ ] No `mcp_validation_failed` envelope.
- [ ] **Production-mode regression:** POST same body with
      `runMode=production`; the Edge function should REJECT
      argument_scheme at the production-mode gate (HALT trigger #17 guard).

**Amendment §5 binding:** PASS requires either:
- at least one plausible Family E positive on a targeted argument-scheme
  fixture posted to Edge, OR
- a documented PARTIAL if only non-targeted seeded args were used and
  0 positives appeared.

**If any positives ARE observed (operator inspection of evidenceSpans):**
- [ ] No positive scheme evidenceSpan contains `fallacy` / `fallacious` /
      `weak` / `invalid` / `flawed` / `wrong` / `bad reasoning` / `logical
      error` / `informal fallacy` / `proof of` (amendment §3 binding).
- [ ] Each positive scheme's evidenceSpan anchors a verbatim quote from
      the move body, not a quality judgment.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<time_total>, <positiveObservationCount per arg>_

---

## Phase 4b — DOCTRINE: adversarial slippery_slope verification (BINDING)

This is the existential doctrine verification phase. Per amendment §5:
PASS requires the adversarial slippery_slope fixtures to produce
doctrine-clean OUTPUT regardless of whether the model fires on the
pattern.

**Step 1:** POST to the Edge admin_validation endpoint with an argument
whose text matches Adversarial Fixture #1 (clear slippery-slope, no
fallacy framing in input):

```json
{
  "argumentIds": ["<seeded-arg-with-slippery-slope-text>"],
  "requestedFamilies": ["argument_scheme"],
  "runMode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

**Step 2:** Inspect the response row:
- [ ] If `observations.slippery_slope_reasoning_present === true`:
  - [ ] Verify `evidence_span.slippery_slope_reasoning_present` does NOT
        contain `fallacy`, `fallacious`, `weak`, `invalid`, `flawed`,
        `wrong`, `proof of`, `logical error`, `bad reasoning`, `informal
        fallacy`.
  - [ ] Verify `evidence_span.slippery_slope_reasoning_present` anchors
        the chain pattern (a substring of the input text).
- [ ] If `observations.slippery_slope_reasoning_present === false`:
  - [ ] Pattern did not fire on this argument; document as PARTIAL per
        amendment §5. Not a failure.

**Step 3:** POST a second admin_validation request with an argument
whose text matches Adversarial Fixture #2 (input contains "fallacy"):
- [ ] Repeat the doctrine verification on the response.
- [ ] **Critical assertion:** even though the INPUT contains "fallacy",
      the OUTPUT must NOT echo `fallacy` in any evidenceSpan.

**Step 4:** Optionally POST a third admin_validation request with
Adversarial Fixture #3 (multi-scheme):
- [ ] Verify NONE of the positive schemes' evidenceSpans contain banned
      tokens.

**Phase 4b verdict (per amendment §5):**
- **PASS:** All slippery_slope-positive evidenceSpans are doctrine-clean;
  OR all 3 fixtures produce all-false (documented PARTIAL).
- **FAIL:** Any slippery_slope-positive evidenceSpan contains a banned
  token (`fallacy` etc.).

This is the existential phase. A FAIL here is a doctrine violation;
HALT and revert. The implementer must NOT proceed to Phase 5 until
Phase 4b PASS or PARTIAL.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<per-fixture doctrine check results>_

---

## Phase 5 — Unsupported F/G/H/I/J rejection regression (5 families remaining)

POST to Edge `classify-argument-boolean-observations` with each of the
5 still-unsupported families against `arg2`.

| Family | Expected response |
| --- | --- |
| F — `critical_question` | HTTP 200; `status=failed`; `failureReason=mcp_validation_failed`; 0 positives; empty rawKeys |
| G — `resolution_progress` | same |
| H — `claim_clarity` | same |
| I — `thread_topology` | same |
| J — `sensitive_composer` | same |

- [ ] All 5 still-unsupported families correctly rejected at the MCP
      server's registry boundary.
- [ ] No Family A/B/C/D/E keys leaked into any unsupported-family
      response.
- [ ] **Family E `argument_scheme` is now SUPPORTED at the MCP server**
      and should be ABSENT from the unsupported-family test set.

**Result:** ☐ PASS ☐ FAIL — _<5/5 expected outcomes>_

---

## Phase 6 — Targeted Jest + Deno regression

```bash
cd .. && npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|familyE|opsMcp)" --no-coverage
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

- [ ] Jest exit 0.
- [ ] Deno exit 0.
- [ ] Total Jest test count not lower than the implementer report
      (~18,016 with the new Family E Edge registry test added).
- [ ] Total Deno test count ≥ 792 (implementer's Commit 5 baseline; up
      from 614 pre-Family-E).
- [ ] `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts` continues to pass
      (Card 2 baseline preserved).
- [ ] `mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` passes (Card 3
      admin-validation-only posture asserted).

**Result:** ☐ PASS ☐ FAIL — _<test counts>_

---

## Phase 7 — OPS observations

- [ ] **5 families now operational on the hosted MCP server:**
  - Family A (`parent_relation`): production + auto-trigger live.
  - Family B (`disagreement_axis`): production + auto-trigger live.
  - Family C (`misunderstanding_repair`): production + auto-trigger live.
  - Family D (`evidence_source_chain`): production + admin_validation
    (post MCP-021C-EDGE-FAMILY-D-ENABLE).
  - Family E (`argument_scheme`): admin_validation ONLY (NEW).
- [ ] **5 families still unsupported on the MCP server** (F, G, H, I, J).
      Registry rejection continues to enforce admin-validation-only
      semantics at the unsupported-family layer.
- [ ] **Latency observations:** Phase 4 Family E admin_validation
      latency recorded; comparison to ~22.5s projection.
- [ ] **Token budget observation:** Phase 3 hosted MCP smoke completed
      with no truncation on Family E 16-key response; `MAX_TOKENS=1500`
      is currently fitting (~60-token headroom; tightest in rollout).

**Doctrine-risk-key real-corpus calibration (if Phase 4 produced
positives):**
- [ ] `slippery_slope_reasoning_present` evidenceSpans inspected for
      "no fallacy framing" — operator spot-check passed.
- [ ] `abductive_explanation_present` evidenceSpans inspected for
      "no fallacy framing" — operator spot-check passed.
- [ ] `analogy_reasoning_present` evidenceSpans inspected for
      "no fallacy framing" — operator spot-check passed.

**Scheme-detection variance (operator notes):**
- [ ] Multi-scheme outputs are allowed and expected (most moves exhibit
      0-2 schemes; some carry 3-4).
- [ ] Conservative-positives bias observed (model does not mark all
      rawKeys true on a single input).

---

## Phase 8 — Verdict + authorization

### PASS criteria (all required)

- [ ] Phase 1 pre-flight clean.
- [ ] Phase 2 local Deno: ~792 / 0.
- [ ] Phase 3 hosted MCP smoke: 17/17 PASS.
- [ ] Phase 4 admin_validation: HTTP 200 + valid Family E response
      shape + raw_keys ⊆ Family E 16-key set (0-positives PARTIAL is
      acceptable per amendment §5).
- [ ] **Phase 4b BINDING:** doctrine-clean slippery_slope output (or
      documented PARTIAL if pattern did not fire). Any banned token in
      slippery_slope evidenceSpan = FAIL.
- [ ] Phase 5 unsupported rejection: all 5 still-unsupported families
      (F-J) correctly rejected; Family E now SUPPORTED.
- [ ] Phase 6 targeted regression: all exit 0.

### Authorization granted on PASS

- [ ] `MCP-SERVER-006-FAMILY-E-SMOKE: PASS`.
- [ ] Family E `admin_validation` is now OPERATIONAL.
- [ ] `MCP-021C-EDGE-FAMILY-E-ENABLE` AUTHORIZED to design
      (production-mode flip for Family E).
- [ ] `MCP-SERVER-007-FAMILY-F` AUTHORIZED to begin (Family E's
      companion critical_question family; with its own Stage 2B if it
      carries structural complexity).
- [ ] `OPS-MCP-OBSERVABILITY-FAMILY-E-COVERAGE` (optional, recommended)
      authorized for 5-family-state observability roll-up.

### PARTIAL conditions (file scoped fix card; do NOT begin Family F)

- [ ] Phase 4 returned 0 positives across all 3 seeded args (amendment
      §5 — acceptable, documented).
- [ ] Phase 4b slippery_slope did not fire on any of 3 fixtures
      (amendment §5 — acceptable, documented).

### FAIL conditions (file MCP-SERVER-006-FAMILY-E-FIX; consider revert)

- Phase 3 < 17 checks pass.
- Phase 4 returns non-Family-E raw_keys (taxonomy violation).
- **Phase 4b returns any slippery_slope evidenceSpan containing
  `fallacy`, `fallacious`, `weak`, `invalid`, `flawed`, `wrong`,
  `proof of`, `logical error`, `bad reasoning`, or `informal fallacy`
  (existential doctrine violation).**
- Phase 4 returns Family E positive in `runMode=production` (HALT
  trigger #17; production-mode flip is a separate card).
- Phase 5 any unsupported family accepted (security-adjacent
  regression).
- Phase 6 broad regression (Family A/B/C/D byte-equal failure).

---

## Audit metadata

- **Operator command log:** _<paste redacted commands run during the smoke; bearer tokens replaced with [REDACTED]>_
- **Hosted smoke raw output (truncated, redacted):** _<paste 17-check PASS output>_
- **Edge admin_validation response (redacted):** _<paste 3-arg response JSON; redact admin JWT + emails>_
- **Phase 4b adversarial slippery_slope responses (per-fixture):** _<paste 3 response rows with doctrine-check notes>_
- **Unsupported-family rejection responses (compact):** _<paste 5 envelopes>_
- **Notable observations:** _<free-text>_

---

## Sign-off

- **Operator signature:** _<name>_
- **Date:** _<YYYY-MM-DD>_
- **Verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL

Filed at: `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-<YYYY-MM-DD>.md`
(rename this file from `-template.md` to the dated filename on commit).

---

## Audit-lint required final step

Before signing the Verdict line above:

```
node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-<YYYY-MM-DD>.md
```

This MUST exit 0 before the verdict is valid. The linter enforces
the operator-stated audit-integrity rules R1-R4 via L1-L6, including:

- L1 — required-phase NOT-RUN + verdict PASS fails (Phase 3 hosted
  MCP smoke is REQUIRED for family-ship; the original Family E audit
  at `29f30b0` marked it NOT-RUN and was caught at amendment time —
  this linter now catches that defect at authoring time)
- L2 — indirect-proof phrase ("covered indirectly", "would pass") in
  a NOT-RUN direct-proof phase fails
- L5 — Family E is a doctrine-risk family (argument_scheme /
  slippery_slope); the audit MUST cite persisted `evidence_span`
  inspection
- L6 — if this audit is an amendment / hosted-completion / upgrade,
  it must name all three of priorVerdict + missingProof +
  newlySuppliedProof

If the linter reports a finding, EITHER (a) run the missing phase to
PASS, OR (b) downgrade the verdict to PARTIAL, OR (c) add the
required provenance language. Do NOT sign PASS while the linter exits
non-zero.

See `docs/ops/AUDIT-LINT.md` for the full rule reference.
