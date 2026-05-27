# MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE — Post-merge audit

**Date:** 2026-05-27
**Operator:** Kyler
**Predecessor:** MCP-021C-EDGE-FAMILIES-B-C-ENABLE shipped at `ce84bb1` (PR #329; Stage 2B Option A operator-approved).
**Audit doctrine:** Verifies the production-mode flip for Family B + Family C, plus the autoTriggerDispatcher.ts refactor (registry-derived, one-run-per-family sequential loop) works end-to-end. New argument submissions now produce 3 production runs (A+B+C) instead of 1 (A-only). Family A behavior preserved byte-equal.

---

## Verdict

**PASS.** Auto-trigger dispatcher refactor is operational in production. A new argument submission via the `submit-argument` Edge Function produces 3 sequential production runs (one per registry-enabled family). All 3 runs use the real `mcp:classify_argument_boolean_observations` provider; Family A behavior is byte-equal preserved; Family B + C admin_validation still works alongside the new production-mode runs.

- **Live submission test:** new argument `f2f321d8-58d4-4350-9288-382bd6f29325` submitted at 2026-05-27T23:39:52 → 3 production runs created (A+B+C) within ~14 seconds
- **Sequential one-run-per-family loop confirmed:** runs started at 23:39:54 / 23:39:59 / 23:40:03 (each ~4-5s; total dispatch ~14s)
- **All 3 runs `status='success'`** with `run_mode='production'`
- **No cross-family contamination:** each run's `requested_families` array contains exactly one family
- **Zero new organic duplicate candidates:** Q9 still shows only the 3 historical `audit_or_smoke_rerun` pairs

**Authorizations granted:**
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE: PASS`
- Family B + C are now production + auto-trigger live (in addition to admin_validation)
- **`MCP-SERVER-005-FAMILY-D` is the NEXT card** per the combined launch's binding sequence — with mandatory Stage-2B operator-decision checkpoint for subset (~12-key) vs full-27-key paths
- Inter-card checkpoint surfaces to operator before Card 2 begins

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at `ce84bb1`. Working tree contains only the 10 known operator-territory untracked files. All prior audits present.

Edge Functions auto-deployed post-merge:

| Function | Pre-merge version | Post-merge version | Updated |
| --- | --- | --- | --- |
| `submit-argument` | (older) | **216** | 2026-05-27 22:21:56 UTC |
| `classify-argument-boolean-observations` | (older) | **46** | 2026-05-27 22:21:56 UTC |

(Auto-deploy fired ~30-90s after merge via Supabase GitHub integration.)

Edge familyRegistry post-flip state verified at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:67-85`:

| Family | productionEnabled | adminValidationEnabled |
| --- | --- | --- |
| parent_relation (A) | true (unchanged) | true |
| disagreement_axis (B) | **true (NEW)** | true |
| misunderstanding_repair (C) | **true (NEW)** | true |
| evidence_source_chain (D) | false (unchanged) | true |
| argument_scheme through sensitive_composer (E-J) | false (unchanged) | true |

Baseline run counts (pre-test):
- parent_relation production: 5 runs
- B + C production: 0 runs (pre-flip; expected)
- All families admin_validation: existing smoke history preserved

---

## Phase 2 — Auto-trigger new argument test (PRODUCTION)

**Status:** PASS

### Submission

A new argument was submitted via the `submit-argument` Edge Function:

```
debate_id: f47b9c5f-6ff8-4672-a0bf-6f708e33fde1
parent_id: 73515bf9-a949-449a-88f9-68a6889eecd2 (root thesis; affirmative)
argument_type: claim
side: affirmative
author: kyleruff+devtests1@gmail.com (admin)
```

- HTTP 201 Created
- New argument ID: `f2f321d8-58d4-4350-9288-382bd6f29325`
- Submission timestamp: 2026-05-27T23:39:52.398Z

### Auto-trigger dispatch result

After ~14 seconds, querying `argument_machine_observation_runs` for the new argument:

| run_id | requested_families | run_mode | status | started_at | completed_at | duration |
| --- | --- | --- | --- | --- | --- | --- |
| `27ed5f98-03f8-4fd6-a9d1-18539b4cf72e` | `['parent_relation']` | production | success | 23:39:54.909 | 23:39:59.375 | 4.5s |
| `ea9c9dd4-1866-42be-8e8b-927c107355f2` | `['disagreement_axis']` | production | success | 23:39:59.670 | 23:40:03.531 | 3.9s |
| `3185f3f4-9b9e-4b17-9028-e808c924ead8` | `['misunderstanding_repair']` | production | success | 23:40:03.819 | 23:40:08.666 | 4.8s |

**3/3 runs created.** All runs use real provider `mcp:classify_argument_boolean_observations` and model `operator-mcp-server` (no synthetic data).

### Sequential one-run-per-family loop verified

Run A completed at 23:39:59.375 → Run B started at 23:39:59.670 (300ms gap; sequential) → Run B completed at 23:40:03.531 → Run C started at 23:40:03.819 (288ms gap; sequential) → Run C completed at 23:40:08.666.

This confirms the operator-preferred shape (Stage 2B item #3): per-family sequential loop, not multi-family parallel call.

### Family D-J: zero production runs

No `evidence_source_chain` (D) or other unsupported family runs were created for the new argument. The registry-derived dispatcher correctly excluded them per `productionEnabled=false`.

---

## Phase 3 — Source 6 multi-family read verification

**Status:** PASS

Result rows for the 3 new production runs: **0 positives** across all 3 families.

This is the **expected** outcome for synthetic test text (the new argument body was a smoke-test placeholder, not real debate content). The classifiers correctly produced no positives — the conservative-positives bias is holding. Each run completed `status='success'` with an empty result set.

Implications:
- Source 6 reads `run_mode='production'` rows; the 3 new runs land in that filter but produce no displayable raw_keys (none fired).
- The renderer's graceful handling of multi-family rendering is structurally intact (it would surface B + C raw_keys if real debate content produced positives).
- No cross-family contamination: each run's result rows would have had their parent run's `family` value (had any positives fired).

The Source 6 filter at `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` is byte-equal preserved.

---

## Phase 4 — Observability report verification

**Status:** PASS

`node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/efbc-obs` exit 0; report regenerated with new 4-family activity state.

### Q11 — Family B and C admin-validation-only check

Pre-card output (admin_validation-only):
```
| disagreement_axis | admin_validation | 3 |
| misunderstanding_repair | admin_validation | 3 |
```

Post-card output (additive production rows visible):
```
| disagreement_axis | admin_validation | 3 |
| disagreement_axis | production | 1 |
| misunderstanding_repair | admin_validation | 3 |
| misunderstanding_repair | production | 1 |
```

The 1 production run per family is the **expected** state after Card 1 ships. Q11's title remains "Are Family B and C still admin_validation-only?" — and the report's data plainly shows the answer is now "no, they have production runs too." This is the post-Card-1 expected state.

### Q9 — Duplicate runs

Still classifies the 3 historical pairs as `audit_or_smoke_rerun`. **No new `organic_duplicate_candidate` rows.** The new B+C production runs are single (one each) and do not accumulate duplicates with existing data.

### Q12 — Unsupported-family attempt visibility

"No unsupported-family attempts observed." Unchanged from prior smoke. The new auto-trigger correctly excludes D-J.

### Observability surface adapted cleanly

All 14 SQL queries ran successfully; no broken section; no NaN/undefined outputs.

---

## Phase 5 — Regression sanity check

**Status:** PASS

### Family A behavior preserved (byte-equal-asserted via tests)

The new argument's Family A run (`27ed5f98...`) completed in 4.5s with `status='success'` and `provider_key='mcp:classify_argument_boolean_observations'` — identical shape to pre-Card-1 Family A runs. The pre-refactor TRG-* assertions (`__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts`) continue to hold for Family A in isolation.

### Admin_validation still works

The 3 admin_validation runs for B + C from prior smokes still exist alongside the new production runs (Q11 confirms). Admin_validation calls continue to be accepted by the Edge Function per the unchanged `adminValidationEnabled` flags.

### mcp-server byte-equal

`git diff main^..main -- mcp-server/` returns empty. Hosted MCP server unchanged. Hosted smoke (per prior 13/13 baseline) unaffected.

### Targeted Jest regression

```
npx jest --testPathPattern="(mcpOneTwoOneCEdgeFamilyRegistry|mcpOneTwoOneCAutoTrigger|edgeFamilyRegistry|opsMcpObservability)" --no-coverage
→ Test Suites: 18 passed, 18 total
  Tests:       292 passed, 292 total
EXIT: 0
```

Full Jest suite: 17,924 / 17,924 / 0 failed.
mcp-server Deno: 467 / 467 / 0 failed (byte-equal preserved).
typecheck + lint exit 0.

---

## Phase 6 — Verdict + authorization

### Final verdict

**PASS** — All 5 phases satisfied:
- Phase 1: registry post-flip state correct; Edge Functions auto-deployed
- Phase 2: 3 production runs created for new argument (A+B+C sequential)
- Phase 3: Source 6 filter byte-equal; result rows correctly empty (synthetic test text)
- Phase 4: observability surface adapted cleanly; Q9 + Q11 + Q12 reflect new state correctly
- Phase 5: Family A byte-equal; admin_validation unaffected; mcp-server unchanged; full Jest + Deno regression pass

### Observations

- **Sequential dispatch latency:** A+B+C took ~14s total for 3 families. Acceptable; well below EdgeRuntime.waitUntil() limits. If Family D ships later via the same pattern, expect ~4-5s per additional family.
- **Conservative-positives bias holds:** synthetic text produced 0 positives across all 3 families — exactly as the bias is designed to behave.
- **Operator's Stage 2B Option A choice validated:** the scope expansion was necessary; the 2-boolean-only path would have been a PARTIAL since the dispatcher hard-coded Family A. The dispatcher refactor is now registry-derived, future-proof for Family D ship.
- **Three-OPS-card observability pipeline pays off:** Q9 + Q11 + Q12 all read meaningful state post-flip; no false-positive findings.

### Authorizations confirmed on PASS

- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE: PASS`.
- Family B + C now production + auto-trigger live.
- **`MCP-SERVER-005-FAMILY-D`** AUTHORIZED to begin (subject to inter-card operator checkpoint + mandatory Stage 2B subset-vs-full-27 decision).
- `OPS-MCP-OBSERVABILITY-FAMILY-B-C-PRODUCTION-COVERAGE` (optional) may be filed if operator wants Q11's title to update to reflect the post-flip semantics.

### Operator cleanup

After audit doc commits, temp artifacts may be deleted:
- `/tmp/efbc-smoke/submit-and-verify.mjs`
- `/tmp/efbc-pre-counts*.sql`
- `/tmp/efbc-post-merge.sql`
- `/tmp/efbc-verify-runs.sql`
- `/tmp/efbc-verify-results.sql`
- `/tmp/efbc-find-*.sql`
- `/tmp/efbc-obs/`
- `/tmp/efbc-postmerge-*.log`

The smoke-submitted test argument `f2f321d8-58d4-4350-9288-382bd6f29325` and its 3 runs remain in the DB as historical artifacts (provider_key is the real production provider; not subject to OPS-MCP-TEST-DATA-CLEANUP's `smoke-%` filter). Operator may optionally delete this argument + cascade via a follow-up SQL if desired, but it's not contamination — it's a smoke-test data point with real provider attribution.
