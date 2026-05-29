# MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE — Post-merge smoke (2026-05-29)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Merge:** PR #361 squash-merged to `main` at `5b6edee` (resolution_progress productionEnabled false→true).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/360
**Scope:** Card 3 (terminal) of the Family G suite. Flipped Family G to production; the auto-trigger now fires 7 families (A–G) per new argument. This smoke verifies the 7-family dispatch (L3a), a targeted G signal (L3b/L4), the Source 6 read-path (L3c), the live 7-family latency re-measure (D8), and the BINDING L5 doctrine `evidence_span` inspection in production mode.

**Verdict: PARTIAL** — all functional + doctrine phases PASS; the live 7-family `wall_clock_background` p95 (34.555s) lands in the 30–45s warning band (under the 45s FAIL line). This is the designed "warning crossed at 7 families" outcome (intent §7 / Gate B: "latency p95 in 30–45s at 7 families — expected, flag it"), not a failure. The actionable flag: file `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` before the 45s-crossing family.

---

## Summary

Family G (`resolution_progress`) is live in production. Five fresh synthetic submissions each fired the production 7-family auto-trigger (A–G); every G production `evidence_span` is descriptive convergence-state with zero verdict tokens — the 5-layer doctrine defense holds end-to-end in production under live Anthropic conditions. Measured 7-family latency (34.555s p95) is under the ≈36.3s projection and under the 45s FAIL line.

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at `5b6edee`; `familyRegistry.ts` `resolution_progress` `productionEnabled: true`, `adminValidationEnabled: true`. A–F productionEnabled=true; H/I/J false. Edge functions auto-deployed on merge; the 7-family deploy propagation was confirmed by the probe arg getting 7 production runs.

## Phase 2 — Dispatch (L3a)

**Status:** PASS

The production auto-trigger fires for each new argument. 5 fresh submissions each produced **exactly 7 production runs** (`run_mode = 'production'`, `status = 'success'`): parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question, **resolution_progress** (A–G). H/I/J: zero runs. 35 production runs created/observed across the 5 args; `resolution_progress` (G) fired in 5/5. The dispatch is registry-derived (`productionEnabledFamilies()` now returns 7) with no dispatcher edit.

## Phase 3 — Targeted classifier-signal (L3b + L4)

**Status:** PASS

Deliberately resolution-targeted text fired ≥1 positive G result row per targeted arg. Positive raw keys observed (production positives, all in the 18-key ai_classifier subset):

| arg (targeted text) | G positive raw_key | confidence | evidence_span |
| --- | --- | --- | --- |
| concession | concedes_broader_point | high | "I withdraw the broad claim and stand on the narrow scope only — they work where enforcement is stable over 5+ years." |
| synthesis | synthesis_proposed | high | "What if both are true: EVs cut urban tailpipe pollution AND battery production needs cleaner grids?" |
| synthesis | unresolved_point_isolated | high | "The open question is which dominates by 2030." |
| common-ground | common_ground_identified | high | "BC and Sweden carbon-tax data both show effectiveness" |
| common-ground | unresolved_point_isolated | high | "The open question is whether Australia's repeal is the exception or the warning" |
| criterion | decision_criterion_proposed | high | "I propose we evaluate carbon-tax effectiveness by sustained 5-year emission deltas in jurisdictions with stable enforcement." |

At least 1 positive result row on targeted text (not a run-row-only claim) — the L4 obligation is satisfied with raw_key | confidence | evidence_span result-row evidence.

## Phase 4 — Read-path (L3c)

**Status:** PASS

Source 6 (the production-only read path, `machineObservationPersistenceQuery`) returns G production rows: the persisted `argument_machine_observation_results` rows for `family = 'resolution_progress'`, `run_mode = 'production'` are queryable and were read back for all 5 args (Phase 3 + Phase 6 tables). A–F production rows also present; no G deterministic-key contamination (only the 18 ai_classifier keys can persist for G — the Edge subset filter, Card 1A, mode-agnostic).

## Phase 5 — Latency re-measure at 7 families (D8)

**Status:** PASS (classification result: PARTIAL — warning band)

N=5 fresh submissions, canary-first; each fired 7 production runs. Submit response time 1.4–3.2s (fire-and-forget; submit never blocks on the background 7-family chain — D3). Measured via `mcp-latency-report.mjs` (read-only) over the most-recent-5 args:

| metric | value |
| --- | --- |
| `wall_clock_background` p50 | 32.892s |
| **`wall_clock_background` p95 (binding)** | **34.555s** |
| min | 32.236s |

`classifyLatencyBudget(34.555, submitBlocked=false)` → **PARTIAL** (≥30 warning, <45 FAIL). The measured 7-family wall-clock (34.555s) is **under the ≈36.3s projection** and under the 45s FAIL line. **Projection-vs-measured:** the measured value came in below the conservative projection — no upward shift.

**Report anchor-label note:** `mcp-latency-report.mjs`'s projection section hardcodes its anchor label as "6-family" (it predates the G production flip). The measured set is now 7-family (A–G), so the report's family-count labels in the projection table are off by one. Corrected interpretation from the measured 7-family anchor (34.555s) + per-added-family ~5.5s: the **45s FAIL line is projected to cross at the 9th family (Family I) central / 8th (Family H) pessimistic**. Actionable: file `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` before the Family H (pessimistic) / Family I (central) production-enable. (A future card may also re-anchor the report's projection labels to the live production family count.)

## Phase 6 — Doctrine (L5; BINDING; production mode)

**Status:** PASS

The persisted G **production** `evidence_span` rows (Phase 3 table) were scanned for resolution-verdict tokens (won/lost/winner/loser/defeated/prevailed/capitulated/ahead/behind/beat/"conceded the loss"/"settled in favor" + the shared ban-list). **Zero banned tokens.** The existential: the concession arg's input embedded a broad relinquishment; `concedes_broader_point` fired and its production `evidence_span` anchored the structural relinquishment ("I withdraw the broad claim and stand on the narrow scope only"), with no verdict framing. ≥1 clean firing (5 args, multiple clean G positives incl. the existential). The 5-layer descriptive-convergence defense holds in production. This satisfies the BINDING L5 obligation — mechanically enforced because `family_g` ∈ `DOCTRINE_RISK_FAMILIES` (Card 2).

## Phase 7 — Observability + enforcement-loop provenance

**Status:** PASS

7-family operational state: A+B+C+D+E+F+**G** production + auto-trigger; H/I/J unsupported. G production density (Q14): 5 new args × 1 G production run each = 5 G production runs this smoke (plus the prior admin_validation runs from Card 1). Enforcement-loop: this smoke-audit PR triggers the audit-lint CI on an in-scope production-enable doc; L3+L4+L5 are mechanically enforced (production-enable type; `family_g` doctrine-risk). The audit carries `Audit-Lint: v1` and self-lints clean.

## Phase 8 — Verdict

**Status:** PARTIAL

---

## Final verdict

**PARTIAL**

- Phase 1, 2, 3, 4, 6 PASS. Phase 5 classification = PARTIAL (7-family `wall_clock_background` p95 = 34.555s, in the 30–45s warning band — under the 45s FAIL line; the designed "warning crossed at 7 families" outcome).
- 7-family auto-trigger verified (A–G; 7 production runs per arg; G in 5/5); H/I/J zero.
- L3 (dispatch + targeted signal + read-path), L4 (positive result rows), L5 (production `evidence_span` doctrine-clean) each satisfied; mechanically enforced.
- Doctrine existential preserved in production: `concedes_broader_point` evidence_span anchored the relinquishment; zero verdict echo.
- A–F unregressed; latency lands under the ≈36.3s projection.

This PARTIAL is the budget warning signal, not a regression. Per the Card 3 verdict rules, latency p95 in the 30–45s band at 7 families is the expected, flagged outcome.

---

## Authorizations + follow-ups

- `MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE: PARTIAL` (latency warning-band flag; all functional + doctrine phases PASS).
- **The Family G 3-card suite is complete:** G admin-ship (Card 1, PASS incl. hosted 21/21) → L5 mechanization (Card 2, PASS) → production flip (Card 3, this smoke). 7 families now production + auto-trigger (A–G).
- `MCP-SERVER-009-FAMILY-H` is authorized (H/I/J remain unsupported).
- **File `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` before the next production-enable family:** the 7-family wall-clock is 34.555s (warning band); the 45s FAIL line is projected at the 9th family (Family I) central / 8th (Family H) pessimistic. Parallelization is the pre-H (pessimistic) / pre-I (central) gate — decide before Family H's production-enable.

Smoke artifacts (remain in DB as tagged test fixtures, `[ops-family-g-prod-smoke]`): 5 args (`84e23cb0`, `eb168e9d`, `abf01893`, `d5ca5fab`, `cead14c1`), each with 7 production runs (A–G). No secrets logged; no service-role; submissions from the `.env.bot-tests` bot session via the public anon path.
