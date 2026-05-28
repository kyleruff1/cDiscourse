# MCP-SERVER-005-FAMILY-D-SMOKE — audit template

**Card:** MCP-SERVER-005-FAMILY-D (Evidence Source Chain — 19-key ai_classifier Subset)
**Path chosen at Stage 2B:** Subset (19 ai_classifier rawKeys; MAX_TOKENS=1800; admin_validation-only)
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Hosted MCP server build:** _<deno-deploy-version>_
**Edge Function build:** _<supabase-function-version>_

> Template binding source: design §9 (8-phase smoke plan) +
> intent brief §9 (PASS / PARTIAL / FAIL criteria). Fill each section
> after merge; commit the completed audit to `docs/audits/`
> as `MCP-SERVER-005-FAMILY-D-SMOKE-<YYYY-MM-DD>.md`.

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

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Local Deno regression

```bash
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

- [ ] Expected: ~562-622 tests passed (467 pre-Family-D baseline +
      ~95-155 new Family D tests; implementer reported 614 / 0).
- [ ] All 4 family suites pass: familyA*, familyB*, familyC*, familyD*.
- [ ] No `family_d` or `evidence_source_chain` test failures.

**Result:** ☐ PASS ☐ FAIL — _<test count>_

---

## Phase 3 — Hosted MCP server smoke (15 checks)

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

MCP-SERVER-001 smoke: 15 PASSES, 0 FAILS
EXIT: 0
```

- [ ] All 15 checks PASS.
- [ ] Check 14 returns `family-d-v1` in modelInfo.classifierSetVersion.
- [ ] Check 15 returns `family-d-v1` in modelInfo.classifierSetVersion
      AND `isError:false`.
- [ ] No bearer token / API key visible in any log line.

**Result:** ☐ PASS ☐ FAIL — _<verbatim PASS line; paste output here with bearer redacted>_

---

## Phase 4 — Edge admin_validation smoke (Family D)

Acquire admin JWT via the documented Card 1 pattern. POST to Edge
`classify-argument-boolean-observations`:

```json
{
  "argumentIds": [
    "<seeded-arg-id-1>",
    "<seeded-arg-id-2>",
    "<seeded-arg-id-3>"
  ],
  "requestedFamilies": ["evidence_source_chain"],
  "mode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

Expected (per design §9 + intent brief §9 Decision 9):

- [ ] HTTP 200.
- [ ] `time_total` between ~22.5s and ~30s (latency projection;
      cold-start may add 2-3s).
- [ ] 3 `perArgument` entries; all `status=success`.
- [ ] `positiveObservationCount >= 0` per arg (Decision 9: 0 positives
      across all 3 args is PARTIAL-acceptable).
- [ ] `raw_keys ⊆ Family D 19-key ai_classifier Subset` for any positive.
- [ ] **NO** Family A/B/C key in `rawKeysWithPositive` (taxonomy
      boundary check).
- [ ] **NONE** of the 6 excluded deterministic Family D rawKey strings
      (`has_evidence`, `source_requested`, `quote_requested`,
      `source_attached`, `quote_attached`, `sourced`) appear in
      `rawKeysWithPositive` (Stage 2B safeguard).
- [ ] `classifierSetVersion=family-d-v1` in each perArgument entry's
      modelInfo.
- [ ] `mode=admin_validation` (not `production`).
- [ ] No `mcp_validation_failed` envelope.

**Decision 9 binding:** 0 positives across all 3 seeded args is an
acceptable PARTIAL outcome. The seeded args were originally chosen for
Family A; they may lack clean evidence-source signal. The pipeline
verification (HTTP 200 + valid response shape + correct raw_keys universe)
is the binding PASS gate.

**If any positives ARE observed (operator inspection of evidenceSpans):**
- [ ] `anecdote_used` evidenceSpan contains NO `weak` / `inferior` /
      `unreliable` / `merely` / `lesser` framing (doctrine §4.1).
- [ ] `burden_request_present` evidenceSpan contains NO `right` /
      `wrong` / `correct` / `incorrect` / `justified` / `unjustified`
      framing (doctrine §4.2).
- [ ] `evidence_gap_present` evidenceSpan contains NO `dishonest` /
      `low_quality` / `weak` / `manipulative` / `false` / `lying`
      framing (doctrine §4.3).

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<time_total>, <positiveObservationCount per arg>_

---

## Phase 5 — Unsupported E/F/G/H/I/J rejection regression

POST to Edge `classify-argument-boolean-observations` with each of the
6 still-unsupported families against `arg2`.

| Family | Expected response |
| --- | --- |
| E — `argument_scheme` | HTTP 200; `status=failed`; `failureReason=mcp_validation_failed`; 0 positives; empty rawKeys |
| F — `critical_question` | same |
| G — `resolution_progress` | same |
| H — `claim_clarity` | same |
| I — `thread_topology` | same |
| J — `sensitive_composer` | same |

- [ ] All 6 unsupported families correctly rejected at the MCP server's
      registry boundary.
- [ ] No Family A/B/C/D keys leaked into any unsupported-family
      response.

**Result:** ☐ PASS ☐ FAIL — _<6/6 expected outcomes>_

---

## Phase 6 — Targeted Jest + Deno regression

```bash
cd .. && npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|opsMcpObservability|opsMcpTestDataCleanup|opsMcpIdempotencyHardening)" --no-coverage
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

- [ ] Jest exit 0.
- [ ] Deno exit 0.
- [ ] Total Jest test count not lower than the implementer report
      (~17,930 with the new Family D Edge registry test added).
- [ ] Total Deno test count ≥ 614 (implementer's Commit 5 baseline).

**Result:** ☐ PASS ☐ FAIL — _<test counts>_

---

## Phase 7 — OPS observations

- [ ] **4 families now operational on the hosted MCP server:**
  - Family A (`parent_relation`): production + auto-trigger live.
  - Family B (`disagreement_axis`): production + auto-trigger live.
  - Family C (`misunderstanding_repair`): production + auto-trigger live.
  - Family D (`evidence_source_chain`): admin_validation ONLY (NEW).
- [ ] **6 families still unsupported on the MCP server** (E, F, G, H,
      I, J). Registry rejection continues to enforce
      admin-validation-only semantics at the unsupported-family layer.
- [ ] **Latency observations:** Phase 4 Family D admin_validation
      latency recorded; comparison to ~22.5-25s projection.
- [ ] **Token budget observation:** Phase 3 hosted MCP smoke completed
      with no truncation on Family D 19-key Subset; `MAX_TOKENS=1800`
      is currently fitting.

**Doctrine-risk-key real-corpus calibration (if Phase 4 produced
positives):**
- [ ] `anecdote_used` evidenceSpans inspected for "not weakness"
      framing — operator spot-check passed.
- [ ] `burden_request_present` evidenceSpans inspected for
      "descriptive not verdict" framing — operator spot-check passed.
- [ ] `evidence_gap_present` evidenceSpans inspected for "not failure
      / not dishonest" framing — operator spot-check passed.

**Anti-amplification calibration (if Phase 4 produced positives):**
- [ ] Statistical / causal claims without sources flagged
      `evidence_gap_present: true`.
- [ ] Value / normative / hedged claims NOT flagged
      `evidence_gap_present: true`.

---

## Phase 8 — Verdict + authorization

### PASS criteria (all required)

- [ ] Phase 1 pre-flight clean.
- [ ] Phase 2 local Deno: ~614 / 0.
- [ ] Phase 3 hosted MCP smoke: 15/15 PASS.
- [ ] Phase 4 admin_validation: HTTP 200 + valid Family D response
      shape + raw_keys ⊆ Family D 19-key Subset (0-positives PARTIAL
      is acceptable per Decision 9).
- [ ] Phase 5 unsupported rejection: all 6 unsupported families (E-J)
      correctly rejected.
- [ ] Phase 6 targeted regression: all exit 0.

### Authorization granted on PASS

- [ ] `MCP-SERVER-005-FAMILY-D-SMOKE: PASS`.
- [ ] Family D `admin_validation` is now OPERATIONAL.
- [ ] `MCP-021C-EDGE-FAMILY-D-ENABLE` AUTHORIZED to design
      (production-mode flip for Family D; Stage 2B may be required if
      operator wishes to revisit the compound-key Full-27 path).
- [ ] `MCP-SERVER-006-FAMILY-E` AUTHORIZED to begin (with its own
      Stage 2B if Family E carries structural complexity).
- [ ] `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` (optional, recommended)
      authorized for 4-family-state observability roll-up.

### PARTIAL conditions (file scoped fix card; do NOT begin Family E)

- [ ] Phase 4 returned 0 positives across all 3 seeded args (Decision 9
      — acceptable, documented).

### FAIL conditions (file MCP-SERVER-005-FAMILY-D-FIX; consider revert)

- Phase 3 < 15 checks pass.
- Phase 4 returns non-Family-D raw_keys (taxonomy violation).
- Phase 4 returns any of the 6 excluded deterministic Family D
  rawKey strings — those are NOT in the Subset scope.
- Phase 5 any unsupported family accepted (security-adjacent
  regression).
- Phase 6 broad regression (Family A/B/C byte-equal failure).

---

## Audit metadata

- **Operator command log:** _<paste redacted commands run during the smoke; bearer tokens replaced with [REDACTED]>_
- **Hosted smoke raw output (truncated, redacted):** _<paste 15-check PASS output>_
- **Edge admin_validation response (redacted):** _<paste 3-arg response JSON; redact admin JWT + emails>_
- **Unsupported-family rejection responses (compact):** _<paste 6 envelopes>_
- **Notable observations:** _<free-text>_

---

## Sign-off

- **Operator signature:** _<name>_
- **Date:** _<YYYY-MM-DD>_
- **Verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL

Filed at: `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-<YYYY-MM-DD>.md`
(rename this file from `-template.md` to the dated filename on commit).
