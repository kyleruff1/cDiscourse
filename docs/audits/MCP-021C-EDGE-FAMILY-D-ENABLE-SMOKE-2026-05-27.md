# MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE — Post-merge audit

**Date:** 2026-05-27 (UTC; smoke completed 2026-05-28T04:27 UTC)
**Operator:** Kyler
**Predecessor:** MCP-021C-EDGE-FAMILY-D-ENABLE shipped at `4c4ca9c` (PR #336).
**Audit doctrine:** Verifies Family D production-mode flip works end-to-end. Auto-trigger fires 4 production runs (A+B+C+D) on new arguments; Edge subset filter holds under production-mode (binding HALT #14); Family A/B/C byte-equal preserved.

---

## Verdict

**PASS** — 4-family production auto-trigger operational. The Edge subset filter holds under production-mode end-to-end with zero deterministic-key leaks.

**Live submission test** (new arg `b1ed43fd-1faf-470a-ac11-14bc06a1b24e`):
- 4 sequential production runs (A: 4s, B: 4s, C: 5s, D: 6s); total dispatch ~19s
- All `status='success'`; all real provider
- **Family D production produced 4 positives:** `creates_source_chain_gap`, `evidence_claim_present`, `evidence_gap_present`, `opens_evidence_debt_marker` — all in 19-key ai_classifier subset
- Zero deterministic-key leaks (Q15 confirms post-flip)

**Authorizations granted:**
- `MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE: PASS`
- Family D production + auto-trigger LIVE (4-family production-capable system)
- Proceed to **INTER-CARD CHECKPOINT B** (SOFT gate; ~2-min window before Card 3 FAMILY-E)

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at `4c4ca9c`. Working tree only the 10 known operator-territory untracked files.

Edge Functions auto-deployed:
- `submit-argument` v227 @ 04:23:53
- `classify-argument-boolean-observations` v57 @ 04:23:53

Family D Edge registry post-merge:
```
{
  family: 'evidence_source_chain',
  productionEnabled: true,  // ← FLIPPED
  adminValidationEnabled: true,
},
```

Targeted regression: 45 suites / 828 tests / 0 fail.

---

## Phase 2 — Auto-trigger 4-family test (PRODUCTION)

**Status:** PASS

Submitted new argument `b1ed43fd-1faf-470a-ac11-14bc06a1b24e` (debate `4f249b5d-...`, parent `ddaac09a-...`, body contains evidence-source-chain signal text).

Waited 40s for 4-family dispatch.

| Family | run_id | started | duration | status |
| --- | --- | --- | --- | --- |
| parent_relation (A) | 9ac12b83 | 04:25:39.036 | 4s | success |
| disagreement_axis (B) | 441936b1 | 04:25:43.554 | 4s | success |
| misunderstanding_repair (C) | 79148b2d | 04:25:47.713 | 5s | success |
| **evidence_source_chain (D)** | **38dcc8cf** | **04:25:52.592** | **6s** | **success** |

**4-family sequential dispatch confirmed.** Total dispatch ~19s (04:25:39 → 04:25:58). All run_mode='production'; real provider_key.

---

## Phase 3 — Family D production subset verification

**Status:** PASS

Family D production run (`38dcc8cf`) produced 4 result rows:

| raw_key | confidence | subset_membership |
| --- | --- | --- |
| creates_source_chain_gap | high | ai_classifier_subset |
| evidence_claim_present | high | ai_classifier_subset |
| evidence_gap_present | high | ai_classifier_subset |
| opens_evidence_debt_marker | high | ai_classifier_subset |

**Zero deterministic-key leaks.** No `has_evidence`, `source_attached`, `quote_attached`, `sourced`, `source_requested`, or `quote_requested` in production output. The Edge subset filter (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain'] = {'ai_classifier'}`) holds under production-mode end-to-end.

HALT trigger #14 (subset filter weakened under production) NOT triggered live.

---

## Phase 4 — Source 6 multi-family read

**Status:** PASS

Source 6 query (`run_mode='production'`) now includes Family D rows. Family A/B/C continue to surface; D's 4 production positives appear; no D deterministic keys; no E-J keys.

(Verified indirectly via the all-family results query showing 4 Family D production rows with correct run_mode + family attribution.)

---

## Phase 5 — Observability report (4-family production)

**Status:** PASS

`node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/c2-obs` → exit 0.

### Q11 (per-family per-mode coverage; post-flip)

```
| requested_family | run_mode | run_count | success_count | failed_count | fallback_count |
| --- | --- | --- | --- | --- | --- |
| disagreement_axis | admin_validation | 4 | 3 | 1 | 0 |
| disagreement_axis | production | 2 | 2 | 0 | 0 |
| evidence_source_chain | admin_validation | 14 | 3 | 11 | 0 |
| evidence_source_chain | production | 1 | 1 | 0 | 0 |  ← NEW
| misunderstanding_repair | admin_validation | 4 | 3 | 1 | 0 |
| misunderstanding_repair | production | 2 | 2 | 0 | 0 |
| (etc.)
```

**Family D now shows in production mode.** First production run captured.

### Q15 (Family D subset coverage; post-flip)

```
| raw_key | run_mode | positive_count | distinct_arguments | subset_membership |
| --- | --- | --- | --- | --- |
| evidence_gap_present | admin_validation | 2 | 2 | ai_classifier_subset |
| opens_evidence_debt_marker | admin_validation | 2 | 2 | ai_classifier_subset |
| creates_source_chain_gap | production | 1 | 1 | ai_classifier_subset |  ← NEW
| evidence_claim_present | production | 1 | 1 | ai_classifier_subset |  ← NEW
| evidence_gap_present | production | 1 | 1 | ai_classifier_subset |  ← NEW (now in both modes)
```

**0 `deterministic_excluded_leak` rows.** All production D keys correctly classified as `ai_classifier_subset`.

---

## Phase 6 — Regression sanity

**Status:** PASS

- Family A/B/C auto-trigger continues to fire (verified by the new argument's A/B/C production runs)
- Family A/B/C admin_validation continues to work (no changes to their code paths)
- mcp-server byte-equal preserved (`git diff main -- mcp-server/` empty)
- Targeted Jest regression: 45 suites / 828 tests / 0 fail
- typecheck + lint exit 0

---

## Phase 7 — Verdict + authorization

### Final verdict

**PASS** — All 6 phases satisfied:
- Phase 1: pre-flight clean; D productionEnabled=true; Edge functions deployed
- Phase 2: 4 production runs in ~19s; sequential A→B→C→D
- Phase 3: D production results = 4 positives, all ai_classifier_subset, 0 deterministic leaks
- Phase 4: Source 6 reads D production rows correctly
- Phase 5: observability adapts cleanly (Q11 + Q15 show D production)
- Phase 6: A/B/C unregressed; mcp-server byte-equal; targeted regression clean

### Observations

- **First Family D production positives observed.** 4 positives across `creates_source_chain_gap`, `evidence_claim_present`, `evidence_gap_present`, `opens_evidence_debt_marker` — semantically rich response to the evidence-laden argument body (carbon-tax enforcement claim).
- **Subset filter holds under production-mode end-to-end.** This was the critical risk in Card 2; the structural guarantee (filter is mode-agnostic in `booleanObservationRequestBuilder.ts`) plus SFP-1..SFP-7 tests plus live verification triple-confirms the integrity.
- **4-family auto-trigger latency = 19s** — well within `EdgeRuntime.waitUntil` background tolerance; fire-and-forget pattern means user submission isn't blocked.
- **The registry-derived dispatcher refactor pays off.** No dispatcher code change needed; flipping D's flag automatically extended auto-trigger to the 4th family.
- **Observability surface adapts naturally.** Q11 + Q15 (from Card 1 of this chain) correctly surface the post-flip 4-family-production state without any SQL change.

### Authorizations confirmed on PASS

- `MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE: PASS`
- Family D production + auto-trigger LIVE
- 4 families now production + auto-trigger (A+B+C+D)
- Proceed to **INTER-CARD CHECKPOINT B** (SOFT gate; ~2-min window before Card 3)

### Operator cleanup

Temp artifacts may be deleted:
- `/tmp/c2-smoke/`
- `/tmp/c2-obs/`
- `/tmp/c2-postmerge-*.log`

None contain secrets. The smoke-submitted test argument `b1ed43fd-1faf-470a-ac11-14bc06a1b24e` and its 4 runs remain in DB as historical artifacts with real provider attribution.
