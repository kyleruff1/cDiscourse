# MCP-SERVER-008-FAMILY-G-SMOKE — Post-merge smoke (2026-05-29)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Merge:** PR #354 (Family G admin ship) squash-merged to `main` at `2640bf9`; the Edge subset fix PR #355 (`MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET`) at `3f395f8`.
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/353
**Scope:** Card 1 of the Family G 3-card suite. Ships `resolution_progress` (Family G) on the hosted MCP server, **admin_validation-only** (production flip is Card 3). Doctrine-risk = **YES** (resolution↔verdict adjacency). This smoke verifies the live admin path + the binding doctrine existential.

**Verdict: PARTIAL** — Phase 3 (hosted 21-check MCP smoke) is operator-deferred (`MCP_HOSTED_TOKEN` not available to Claude Code); under L1 the family-ship verdict cannot exceed PARTIAL while a required phase is NOT-RUN. **All Edge live phases (4 / 4b / 5) PASS**, including the binding adversarial doctrine existential. An amendment lifts PARTIAL → PASS once the operator supplies the hosted 21/21.

---

## Summary

The Family G classifier (18-key ai_classifier subset) ships admin_validation-only. The live Phase 4b smoke **caught a real defect** (the smoke working as intended): G admin_validation universally failed `mcp_validation_failed` while the control Family E succeeded. Root cause: the Edge request builder's `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` subset filter had no `resolution_progress` entry, so the Edge sent all 30 G keys (incl. 12 deterministic) and the MCP server (which supports only the 18 ai_classifier keys) rejected the unsupported keys. The surgical fix card `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET` (PR #355) added the 1-line entry mirroring Family D; after deploy, G admin_validation succeeds and the binding doctrine existential PASSES.

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at the merge SHA; A–F production + auto-trigger; G admin_validation-only (Edge `familyRegistry` `{ family: 'resolution_progress', productionEnabled: false, adminValidationEnabled: true }`, byte-equal — not touched by Card 1). MCP server (Deno Deploy) and Edge functions auto-deployed on merge.

---

## Phase 2 — Local Deno regression

**Status:** PASS

`cd mcp-server && deno test --allow-net --allow-env --allow-read` → **1022 passed / 0 failed** (871 → 1022, +151 for the familyG suite). typecheck 0, lint 0. The Edge subset-filter fix added 9 Jest tests (`mcpFamilyGEdgeMcpSubsetFilter.test.ts`); D regression unchanged.

---

## Phase 3 — Hosted MCP smoke (21 checks)

**Status:** NOT-RUN (operator-token-gated)

The 21-check hosted smoke (`MCP_HOSTED_TOKEN` against the deployed Deno server, incl. the new `[20-compat-boolean-family-g]` + `[21-mcp-tools-call-boolean-family-g]`) requires the operator hosted token, which Claude Code does not hold. Under L1/R2, this NOT-RUN required family-ship phase caps the verdict at **PARTIAL** pending the operator-run hosted smoke (the amendment supplies it).

---

## Phase 4 — Edge admin_validation (Family G)

**Status:** PASS (after the Card 1A Edge subset fix)

`POST /functions/v1/classify-argument-boolean-observations` (admin JWT; `requestedFamilies:['resolution_progress']`; `mode:'admin_validation'`). Two seeded args classified successfully; positives all within the 18-key ai_classifier subset; no deterministic-key leak; no cross-family leak.

| arg | runId | status | positives | rawKeys |
| --- | --- | --- | --- | --- |
| `12b22b06…` (Fixture A) | `8489ec32…` | success | 2 | narrows_claim, common_ground_identified |
| `c270bea3…` (Fixture C) | `8a3cabef…` | success | 2 | narrows_claim, **concedes_broader_point** |

**Pre-fix:** every G admin_validation returned `mcp_validation_failed` (the Edge sent all 30 keys; the MCP server rejected the 12 deterministic). **Control:** Family E (`argument_scheme`) succeeded on the same arg throughout, isolating the defect to the G subset path. **Post-fix (PR #355 deployed):** G classifies; the Edge sends exactly the 18 ai_classifier keys (proven by `mcpFamilyGEdgeMcpSubsetFilter.test.ts` SFG-1).

---

## Phase 4b — Adversarial doctrine verification (BINDING; the resolution↔verdict existential)

**Status:** PASS

The persisted `evidence_span` rows (`argument_machine_observation_results`) were queried for the G runs and scanned for resolution-verdict tokens (won/lost/winner/loser/defeated/prevailed/capitulated/ahead/behind/beat/"settled in favor"/"conceded the loss" + the shared ban-list):

| arg | raw_key | persisted `evidence_span` | verdict token? |
| --- | --- | --- | --- |
| Fixture A | narrows_claim | "I'll narrow my claim: they work where enforcement is stable, over 5+ year horizons" | **NO** |
| Fixture A | common_ground_identified | "you've shown BC and Sweden" | **NO** |
| **Fixture C** (input: "you basically **won** this point and I **lost** the broader argument… You **beat** me") | **concedes_broader_point** | **"I withdraw the broad claim and stand on the narrow scope only"** | **NO** |
| Fixture C | narrows_claim | "they work where enforcement is stable" | **NO** |

**The existential proof:** Fixture C's input contained verdict framing three times ("won", "lost", "beat me"); the G classifier detected `concedes_broader_point` (the highest-risk axis-partner key) but its persisted `evidence_span` anchored the structural **relinquishment** ("I withdraw the broad claim and stand on the narrow scope only") and did **NOT** echo any verdict word. This is the G analog of the Family F "fallacy"-non-echo proof — the 5-layer descriptive-convergence doctrine defense holds end-to-end under live Anthropic conditions.

**Firing-count resolution (asymmetric per intent §9):** 2 successful classifications, both clean; ≥1 clean firing including the existential `concedes_broader_point` → **PASS**. Zero banned tokens across the persisted `evidence_span` scan.

The binding L5 obligation — live adversarial resolution-progress **`evidence_span`** inspection (persisted `argument_machine_observation_results.evidence_span` rows queried for resolution-verdict tokens) — is SATISFIED at this phase.

---

## Phase 5 — Unsupported H/I/J rejection regression

**Status:** PASS

`admin_validation` for the 3 still-unsupported families (`claim_clarity` / `thread_topology` / `sensitive_composer`) on a seeded arg → all `failed` / `mcp_validation_failed` / 0 positives. The still-unsupported families reject correctly while G now succeeds; no cross-family leakage. Card 1's removal of G from the unsupported envelope did not regress H/I/J rejection.

---

## Phase 6 — Targeted regression

**Status:** PASS

typecheck 0; lint 0; Deno 1022/1022; targeted Jest (`[Ff]amily|resolution|booleanObservation`) green. Cross-family byte-equal verified: family{A–F}*.ts, doctrineBanList.ts, Edge familyRegistry.ts, audit-lint-rules.cjs, package.json — all 0-diff from Card 1. (The Card 1A fix touched only the Edge request-builder subset filter + its test.)

---

## Phase 7 — OPS observations + enforcement-loop provenance + Card 1A

**Status:** PASS

**7-family operational state:** A+B+C+D+E+F production + auto-trigger; **G admin_validation new** (this card); H/I/J unsupported.

**Card 1A defect + fix (the live-smoke value):** Phase 4b's live run caught a defect the fixture-based Deno tests (1022 passing) could not — a live-only Edge→MCP subset mismatch. The surgical fix `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET` (PR #355, `3f395f8`) added `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['resolution_progress'] = {'ai_classifier'}` mirroring Family D. The subset filter is mode-agnostic, so admin_validation and (future Card 3) production request paths share it — Card 3's production flip inherits the correct 18-key subset. **Do not flip G to production (Card 3) until Card 2 (L5 mechanization) PASSES.**

**Latency:** G is the 7th family; `docs/ops/LATENCY-BUDGET.md` projects ≈36.9s 7-family `wall_clock_background` (under the 45s FAIL line). G is admin_validation-only here, so it does NOT enter the production auto-trigger; G's per-family latency is measured live in **Card 3**.

**Enforcement-loop provenance (D12):** this smoke-audit PR triggers the audit-lint CI workflow; the smoke audit carries the `Audit-Lint: v1` marker and self-lints clean (`node scripts/ops/audit-lint.mjs <this doc>` → exit 0).

---

## Final verdict

**PARTIAL**

- Phase 1, 2, 4, 4b, 5, 6 PASS. Phase 3 (hosted 21-check) NOT-RUN (operator-token-gated) → caps at PARTIAL per L1.
- Doctrine existential PASSED: Fixture C's verdict-word input did NOT cause a verdict echo in the persisted `evidence_span`; `concedes_broader_point` anchored the relinquishment. 5-layer defense verified live.
- The Edge subset defect was caught by this smoke and fixed by Card 1A (PR #355); re-verified post-deploy.
- Card 1 doctrine-risk determination = **YES** → Gate A authorizes Card 2 (L5 mechanization) before any production enablement.

### Consistent-PARTIAL discipline (D13 — binding for the Card 2 interaction)

Because doctrine-risk = YES, the suite's Card 2 will add `family_g` to `DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs`. `detectFamily` emits `family_g` for this `MCP-SERVER-008-FAMILY-G-SMOKE` title (`mapFamilyLetterToName` has no G case → `family_g`), so the verdict-blind `applyL5` will re-evaluate this audit on its next CI lint. This audit passes-as-PARTIAL ONLY because it names the persisted **`evidence_span`** inspection (Phase 4b above queries `argument_machine_observation_results.evidence_span` for resolution-verdict tokens) — one of the `L5_PERSISTED_INSPECTION_PATTERNS`. The Phase 4b live persisted-`evidence_span` verification is the binding existential for L5 satisfaction; per the firing-count asymmetry, it is SATISFIED (≥1 clean firing), not deferred.

### Amendment path to PASS (per L6)

The amendment lifts this PARTIAL to PASS by supplying the one missing required phase: **Phase 3 hosted MCP smoke 21/21** (operator-run with `MCP_HOSTED_TOKEN`). The capped prior state is PARTIAL (Phase 3 NOT-RUN); the missing proof is the operator-supplied hosted 21/21; all other phases (incl. the binding Phase 4b doctrine existential) are already PASS at this commit.

---

## Authorizations + smoke artifacts

- `MCP-SERVER-008-FAMILY-G-SMOKE: PARTIAL` (Phase 3 hosted operator-deferred; Phase 4/4b/5 PASS).
- **Gate A:** doctrine-risk = YES → Card 2 (`OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK`) is authorized to mechanize L5 for Family G before production.
- **Do NOT proceed to G production (Card 3) until Card 1 smoke is PASS (operator hosted Phase 3 amendment) AND Card 2 L5 mechanization is PASS.**

Smoke artifacts (remain in DB as tagged test fixtures, `[ops-family-g-smoke]`): seeded args `c270bea3` (Fixture C; concession-as-loss) + `12b22b06` (Fixture A; narrows_claim), each with 2 clean G positives + their A–F production auto-trigger side-effect rows. No secrets logged; no service-role; submissions from the `.env.bot-tests` admin session.
