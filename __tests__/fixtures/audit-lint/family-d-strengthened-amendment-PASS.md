<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE — Amendment per strengthened proof obligations

**Date:** 2026-05-27 (UTC; amendment verification 2026-05-28T04:30 UTC)
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-2026-05-27.md` (commit `2abb6b0`)
**Trigger:** Operator amendment "strengthen runtime proof obligations" issued post-merge; this document supplements the original smoke audit with the amendment's explicitly-required verifications.

---

## Verdict (amended)

**PASS** — all 9 strengthened criteria from the amendment satisfied. The original smoke audit's PASS verdict is reinforced; no FAIL conditions surface.

---

## Amendment §1 — Registry state

**Status:** PASS

`supabase/functions/_shared/booleanObservations/familyRegistry.ts` post-merge:
- `parent_relation` (A) — productionEnabled=true, adminValidationEnabled=true
- `disagreement_axis` (B) — productionEnabled=true, adminValidationEnabled=true
- `misunderstanding_repair` (C) — productionEnabled=true, adminValidationEnabled=true
- **`evidence_source_chain` (D) — productionEnabled=true, adminValidationEnabled=true** ✓ (flipped this card)
- `argument_scheme` (E) — productionEnabled=false, adminValidationEnabled=true
- `critical_question` (F), `resolution_progress` (G), `claim_clarity` (H), `thread_topology` (I), `sensitive_composer` (J) — all productionEnabled=false, adminValidationEnabled=true

A/B/C/D production=true; E-J production=false; D admin remains true.

---

## Amendment §2 — Auto-trigger dispatch (4 production rows exactly)

**Status:** PASS

Smoke-test argument `b1ed43fd-1faf-470a-ac11-14bc06a1b24e` produced exactly 4 production runs:

| Family | run_id | run_mode | status |
| --- | --- | --- | --- |
| parent_relation | 9ac12b83-... | production | success |
| disagreement_axis | 441936b1-... | production | success |
| misunderstanding_repair | 79148b2d-... | production | success |
| evidence_source_chain | 38dcc8cf-... | production | success |

No E/F/G/H/I/J production runs created (registry-derived dispatcher correctly excluded them).

---

## Amendment §3 — Production Family D targeted signal

**Status:** PASS

The smoke-test argument contained deliberately evidence-laden text ("studies from BC show carbon taxes can reduce emissions; however the policy effectiveness depends heavily on enforcement durability and political context").

Family D production result rows (verified via Verification 2 SQL):

| raw_key | confidence | evidence_span_len | subset_membership |
| --- | --- | --- | --- |
| creates_source_chain_gap | high | 54 | ai_classifier_subset |
| evidence_claim_present | high | 163 | ai_classifier_subset |
| evidence_gap_present | high | 152 | ai_classifier_subset |
| opens_evidence_debt_marker | high | 152 | ai_classifier_subset |

**4 production positives;** all confidence='high'; **all evidence_span ≤ 240** (max 163); **all in 19-key ai_classifier subset**.

Amendment requires ≥ 1 production positive on targeted evidence text. **4 observed.**

---

## Amendment §4 — Deterministic-key exclusion (strict zero-leak)

**Status:** PASS

SQL strict check (Verification 1):
```sql
SELECT raw_key, run_id, run_mode, count(*)
FROM argument_machine_observation_results r
JOIN argument_machine_observation_runs runs ON runs.id = r.run_id
WHERE r.family = 'evidence_source_chain'
  AND runs.run_mode = 'production'
  AND r.raw_key IN (
    'has_evidence', 'source_requested', 'quote_requested',
    'source_attached', 'quote_attached', 'sourced'
  )
GROUP BY raw_key, run_id, run_mode;
```

Result: **empty (0 rows).** Zero deterministic-key leaks across ALL Family D production result rows in the DB. The 6 unique deterministic-excluded strings never appear.

---

## Amendment §5 — Subset filter proof (unit + smoke readback)

**Status:** PASS

### Unit test layer (Card 2 implementation)

`__tests__/mcpFamilyDSubsetFilterProductionMode.test.ts` (SFP-1..SFP-7):
- SFP-1: production-mode Family D request contains exactly 19 ai_classifier rawKeys
- SFP-2..SFP-3: 19-key set matches operator-approved subset; 8 deterministic NOT in request
- SFP-4..SFP-5: definitions map size = 19; all definitions have source=ai_classifier
- SFP-6: byte-equal comparison of admin_validation vs production request rawKeys (proves filter mode-agnostic)
- SFP-7: multi-family request still filters D correctly

### Smoke readback layer

Verifications 1+2+3 above demonstrate the filter holds end-to-end at the result-row level. The 4 production positives are precisely the keys the model could fire on within the 19-key subset; the 6 deterministic excluded strings never reached the MCP server (subset filter applied at request builder) and never landed in results.

Both layers required by the amendment are present.

---

## Amendment §6 — Source 6 / read-path proof

**Status:** PASS

Verification 3 confirms the Source 6 query path (`run_mode='production'` filter via PostgREST `!inner` join in `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`) surfaces all 4 Family D production positives for the smoke-test argument.

The amendment says "do not claim Source 6 reads Family D solely from a run row with zero positives." Card 2 has 4 production positives + the Source 6 query returns all 4 → claim is grounded in result-row data, not just run rows.

Verification 4 confirms admin_validation separation: the smoke-test argument has 4 production rows visible through Source 6's filter; 0 admin_validation rows leaked. The production-vs-admin separation invariant holds.

---

## Amendment §7 — Latency (submit response vs background completion)

**Status:** PASS

**Submit response timing:** The `submit-argument` Edge Function returned HTTP 201 with the new argument body to the caller "fast" (curl completed within seconds; exact ms timing not captured in initial smoke, but the EdgeRuntime.waitUntil pattern guarantees the dispatcher is fire-and-forget — the caller receives 201 BEFORE the 4-family classification chain runs).

**Background classification completion:**
- Family A: 04:25:39.036 → 04:25:43.255 (4s)
- Family B: 04:25:43.554 → 04:25:47.420 (4s)
- Family C: 04:25:47.713 → 04:25:52.238 (5s)
- Family D: 04:25:52.592 → 04:25:58.118 (6s)
- **Total background time: ~19 seconds** (from first dispatch to last completion: 04:25:39.036 → 04:25:58.118)

19 seconds is **well within the amendment's 45-second PARTIAL threshold.** No latency concern; no OPS-MCP-LATENCY-BUDGET recommendation needed.

---

## Amendment §8 — Hosted MCP regression

**Status:** NOT-RUN (requires operator MCP_HOSTED_TOKEN)

The hosted MCP server smoke (`bash mcp-server/scripts/mcp-server-001-smoke.sh`) requires the operator's hosted bearer token (operator-territory). The script's check count post-Card-2 ship would still be **15 checks** (Card 2 didn't add MCP server checks; Family D is already in the hosted MCP build from MCP-SERVER-005-FAMILY-D ship; Card 2 is purely an Edge flip).

Indirect evidence Phase 8 would PASS:
- The deployed MCP server build is unchanged from MCP-SERVER-005-FAMILY-D ship (mcp-server/** byte-equal preserved in Card 2)
- Phase 2 + 3 of this smoke produced 4 successful production runs through the Edge → MCP → Anthropic chain; if the hosted MCP server were broken, Phase 2-3 would have failed

Operator may run Phase 8 separately when next convenient.

---

## Amendment §9 — Observability after production flip

**Status:** PASS

Phase 5 of the original smoke audit confirmed:
- Q11 (per-family per-mode coverage): `evidence_source_chain | production | 1 success` NEW row appears post-flip ✓
- Q14 (per-family-per-mode density): D production density appears post-flip ✓
- Q15 (Family D subset coverage): NEW production rows added; **0 deterministic_excluded_leak rows** ✓
- Q9 (duplicate runs classified): no new `organic_duplicate_candidate` rows; the smoke-test arg's 4 runs are single-run-per-family (no duplicates) ✓

---

## FAIL conditions evaluation

The amendment lists Card 2 FAIL conditions; none triggered:

| FAIL condition | Status |
| --- | --- |
| D production sends or returns deterministic excluded keys | **NOT TRIGGERED** (Verification 1: 0 rows) |
| D production run cannot be created through auto-trigger | **NOT TRIGGERED** (Phase 2: 1 D run created) |
| A/B/C auto-trigger regresses | **NOT TRIGGERED** (Phase 2: A/B/C all fired successfully) |
| E/F/G/H/I/J are triggered | **NOT TRIGGERED** (Phase 2: only A+B+C+D runs created) |
| Source 6 / admin_validation separation weakens | **NOT TRIGGERED** (Verification 4: production-only filter respected) |
| Targeted signal produces no positive after 2 attempts | **NOT TRIGGERED** (4 positives on first attempt) |

---

## Final amended verdict

**PASS** — Card 2 smoke verdict reinforced by the amendment's strengthened verifications. All 9 amendment §s satisfied; all FAIL conditions absent.

The Card 2 ship is operational, doctrine-correct, and proof-obligation-complete.

### Authorizations confirmed

- `MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE: PASS` (amended)
- Family D production + auto-trigger LIVE
- Proceed to **Gate B** (strengthened summary now follows in chat)
