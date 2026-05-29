# MCP-021C-EDGE-FAMILY-G-ENABLE — Intent brief (Card 3 of the Family G suite)

**Operator:** Kyler
**Date:** 2026-05-29
**Card type:** production-enable — flip `resolution_progress` (Family G) productionEnabled false→true. Mirrors `MCP-021C-EDGE-FAMILY-F-ENABLE`.
**Predecessor (Phase 0 verified):** main at `87ef6ac`. Both Card 3 prerequisites met: Card 1 `MCP-SERVER-008-FAMILY-G` PASS (hosted amendment `87ef6ac`); Card 2 `OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK` PASS (`cfc1fd4`). The production-enable smoke audit is mechanically L5-enforced (`family_g` ∈ `DOCTRINE_RISK_FAMILIES`).

## 1. Motivation

Family G shipped admin_validation-only (Card 1) with the doctrine existential proven live (Phase 4b) and L5 mechanically enforcing it (Card 2). Gate B authorized the production flip. This card flips the one boolean so the auto-trigger extends to 7 families (A–G), and re-measures wall-clock latency live at 7 families against the codified budget (≈36.3s projection, under the 45s FAIL line).

## 2. Phase 0 findings

- G Edge `familyRegistry.ts`: `{ family: 'resolution_progress', productionEnabled: false, adminValidationEnabled: true }` (lines 100–103). Card 3 flips `productionEnabled` → `true` (one boolean; `adminValidationEnabled` stays `true`).
- The Edge subset filter `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['resolution_progress'] = {'ai_classifier'}` already exists (Card 1A, line 77) and is **mode-agnostic** (Card 1A's SFG-6 test proved production-mode G filters to the 18 ai_classifier keys, no deterministic leak). So the production flip inherits the correct 18-key subset — no subset-filter change needed.
- The dispatcher is registry-derived (`productionEnabledFamilies()`); flipping the flag extends the auto-trigger to G with **no dispatcher edit**.

## 3. Binding decisions (D1–D8, mirror F-ENABLE)

D1. One boolean flip: `resolution_progress` productionEnabled false→true (adminValidationEnabled stays true).
D2. Auto-trigger inclusion is registry-derived; the designer VERIFIES (no dispatcher edit).
D3. Subset filter for G is already present (Card 1A) + mode-agnostic; Card 3 preserves it (no change).
D4. Latency: 7-family auto-trigger projected ≈36.3s background (under 45s); the SMOKE re-measures it live.
D5. Source 6 picks up G production rows automatically (run_mode filter is family-agnostic).
D6. Strengthened proof obligations in this brief (L3+L4+L5, mechanically enforced by audit-lint):
  - **L3** — the smoke distinguishes dispatch (7 production runs A–G fire) / targeted signal (≥1 G positive on deliberately resolution-targeted text) / read-path (Source 6 returns G production rows).
  - **L4** — targeted text deliberately exercises a resolution_progress pattern; 0-positives is PARTIAL not PASS.
  - **L5** — live adversarial resolution text; persisted `evidence_span` doctrine-clean (BINDING; mechanically enforced because `family_g` ∈ `DOCTRINE_RISK_FAMILIES`).
D7. Test surface (+20 to +60): familyRegistry G productionEnabled=true; auto-trigger 7-family inclusion; subset filter applied to G in production (mode-agnostic, no deterministic leak); Source 6 7-family read; A–F unregressed (byte-equal behavior).
D8. **Latency re-measurement (the banked discipline):** the smoke runs the live latency measurement at 7 families (5 fresh submissions, canary-first, gated Anthropic spend ~35–40 calls) and confirms measured wall-clock p95 lands near the ≈36.3s projection. If materially higher → surface (the 45s-crossing family count shifts; the parallelization pre-H/pre-I decision moves). Re-measurement uses `mcp-latency-report.mjs`; if it adds ops-SQL it uses a sibling dir (scripts/ops/sql/ is observability-owned — banked lesson).

## 4. Scope

Allowed: `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (the 1 boolean flip); `__tests__/*` (Jest tests, mirror `edgeFamilyFProductionEnable.test.ts`); `docs/core/current-status.md`; this card's design/audit docs.
Forbidden: `autoTriggerDispatcher.ts` (no dispatch edit — registry-derived); any family other than G in the registry; A–F flags (already true); the subset filter (already correct); Source 6 policy; prompts/keys/taxonomy/schema; `mcp-server/**` runtime (G classifier already shipped Card 1); the audit-lint surface; `package.json`; do not start Family H.

## 5. HALT triggers (20, mirror F-ENABLE)

familyRegistry affects any family other than G; A–F productionEnabled flipped; dispatcher hard-codes families; G adminValidationEnabled→false; Source 6 change; schema change; subset filter for G mismatches Card 1's T1 outcome (it must stay present); protocol+security (8–13); **auto-trigger broken for A–F (existential)**; forecast > +90; **production-mode smoke missing live adversarial resolution_progress evidence_span inspection (L5 BINDING — existential)**; **any G production output evidence_span contains a resolution-verdict token (BINDING DOCTRINE FAIL; HALT)**; intent lacks L3/L4/L5 obligations; smoke audit lacks marker/fails CI; unclassified untracked files at PR.

## 6. Test forecast

+20 to +60 (HALT +90). familyRegistry G=true assertion; 7-family auto-trigger inclusion; production-mode G subset (18 keys, no deterministic leak); Source 6 7-family read; A–F unregressed.

## 7. Smoke plan (8-phase, post-merge; L3+L4+L5 + latency re-measure)

Audit `docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE-2026-05-29.md` (`Audit-Lint: v1`; self-lints clean; **production-enable type → L3+L4+L5 mechanically enforced**).
1. Pre-flight (G production posture).
2. Dispatch (L3a): new arg → 7 production runs A–G; H/I/J zero; latency capture.
3. Targeted-signal (L3b+L4): deliberately resolution-targeted text → ≥1 G positive result row (0-positives = PARTIAL).
4. Read-path (L3c): Source 6 returns G production rows; A–F present; no G deterministic-key contamination.
5. **Latency re-measure (D8):** N=5 fresh submissions (canary-first; gated; no JWTs logged; no out/ committed); 7 production runs each; wall_clock_background p50/p95; classify vs the 30s/45s budget; compare measured-7-family to the ≈36.3s projection; state whether the 45s-crossing family count holds. Q9 clean.
6. **Doctrine (L5; BINDING):** live adversarial resolution text; persisted `evidence_span` doctrine-clean (asymmetric resolution; ≥1 clean firing).
7. Observability + enforcement-loop provenance (Q14 G production density; CI run; L5 mechanically enforced).
8. Verdict + audit-lint pre-lint exit 0.

Verdict: PASS if 7 runs verified, L3/L4/L5 each satisfied, latency lands near projection (or shift documented), A–F unregressed, pre-lint+CI exit 0. PARTIAL if targeted 0-positives OR doctrine 0-fire OR latency p95 in 30–45s warning at 7 families (expected — flag). FAIL if doctrine dirty, A–F regression, latency p95 >45s at 7 families (contradicts projection), or CI passes an L-violating audit.

## 8. Ledger

| Item | Value |
| --- | --- |
| Card | MCP-021C-EDGE-FAMILY-G-ENABLE (Card 3 of 3) |
| Change | 1 boolean: resolution_progress productionEnabled false→true |
| Auto-trigger | extends to 7 families (A–G); registry-derived, no dispatcher edit |
| Subset filter | already present (Card 1A), mode-agnostic; preserved |
| Latency | ≈36.3s 7-family projection; smoke re-measures live (D8) |
| L5 enforcement | mechanical (family_g ∈ DOCTRINE_RISK_FAMILIES) |
| Forecast | +20 to +60 (HALT +90) |
| Anthropic spend | smoke Phase 5/6 live (~35–40 calls, gated, canary-first) |
