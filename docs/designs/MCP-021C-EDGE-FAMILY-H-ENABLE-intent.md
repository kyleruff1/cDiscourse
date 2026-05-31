# MCP-021C-EDGE-FAMILY-H-ENABLE — Intent brief (Card 3 of 3-card suite)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** Edge production-mode flip — ONE boolean character change on Family H's entry in `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (`productionEnabled: false → true`). Closes the Family H chain.
**Suite:** Card 1 (MCP-SERVER-009-FAMILY-H) → Gate A → Card 2 (audit-lint L5 family_h) → Gate B → **Card 3 (this card, production-enable)** → smoke PASS → 8 production families.
**Predecessor:** Card 1 merged + smoke PASS; Card 2 merged + smoke PASS. Family H operational on hosted MCP in admin_validation mode; `DOCTRINE_RISK_FAMILIES` Set on main contains `family_h` (L5 CI-mechanical for Card C smoke).
**Trail:** Umbrella issue #388. Card issue #391.

---

## 1. Goal

Flip Family H to production at the Edge layer. The dispatcher routes ALL submits through 8 production families (A–H) instead of 7 (A–G). The flip is ONE boolean character change in `familyRegistry.ts`; rest of the diff is test-file stale-assertion updates (the SEVEN → EIGHT count in the existing per-card test pattern).

---

## 2. Scope (IN / OUT)

**IN**
- ONE boolean character flip in `supabase/functions/_shared/booleanObservations/familyRegistry.ts`: `claim_clarity` entry `productionEnabled: false → true` (HALT 12 if any other change to the registry file).
- Stale-assertion flips in ~6 existing test files (the same set updated by every prior EDGE-FAMILY-*-ENABLE card):
  - `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` (SEVEN → EIGHT count) [OPERATOR DECISION NEEDED: confirm exact constant name]
  - `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` (production set widens to A→H)
  - `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` (H now production filterable)
  - `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` (8-family auto-trigger)
  - `__tests__/edgeFamilyEProductionEnable.test.ts` (H drops from admin-only list — verify pattern)
  - `__tests__/edgeFamilyFProductionEnable.test.ts` (same)
  - `__tests__/edgeFamilyGProductionEnable.test.ts` (same)
- NEW test file: `__tests__/edgeFamilyHProductionEnable.test.ts` (~19 tests mirroring G's HHE-1..17 pattern across 5 describe blocks).
- NEW smoke template: `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` (8-phase per G's template; Phase 6 BINDING doctrine `evidence_span` inspection — CI-mechanical L5 enforcement).

**OUT**
- NO dispatcher code change (registry-derived since MCP-021C-EDGE-FAMILIES-B-C-ENABLE).
- NO `familyRegistry.ts` edit beyond the 1-character flip (HALT 12).
- NO `scripts/ops/audit-lint*` change (Card 2 owns that).
- NO migration; no MCP server change; no Source 6 / persistence change.
- NO Family A–G change.
- NO `mcp-server/lib/family[A-H]*.ts` change (server-side is Card 1).
- NO `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block edit (HALT 13 — Family H uniform `ai_classifier` per Card 1 HALT 3 PASS; absence = full passthrough).

---

## 3. Binding decisions (D1–D5)

**D1 — One-character flip in `familyRegistry.ts` is the entire production code change.** All other diff in source-tree files is test-file updates. HALT 12 fires on any other production code edit.

**D2 — `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block is NOT touched.** Family H uniform `ai_classifier` source means no subset filter (in contrast to mixed-source families D / I which need explicit entries). HALT 13 fires if added.

**D3 — Production family count post-flip: 8 (A–H).** Admin-only families: I, J (until their respective chains land).

**D4 — Smoke template Phase 6 doctrine `evidence_span` inspection is BINDING + CI-mechanical** (Card 2 already added `family_h` to `DOCTRINE_RISK_FAMILIES` on main).

**D5 — Test forecast: +15 to +25 net** (G shipped +18; HALT 8 ceiling +35).

---

## 4. Test forecast

[OPERATOR DECISION NEEDED: confirm — designer produces binding number]
- Forecast: +15 to +25 net Jest tests across the new `edgeFamilyHProductionEnable.test.ts` + ~6 stale-assertion updates.
- HALT 8 ceiling: > +35.

---

## 5. HALT triggers (numbered, binding)

1. **HALT 1** — Required-reading missing.
2. **HALT 2** — Standard preflight not green.
3. **HALT 6** — roadmap-reviewer returns BLOCK.
4. **HALT 7** — Adversarial Explore finds blocking refutation.
5. **HALT 8** — Test delta > +35 net.
6. **HALT 12** (chain-binding) — `familyRegistry.ts` diff has more than 1 boolean character flipped on Family H's entry.
7. **HALT 13** (chain-binding) — `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block modified (Family H uniform `ai_classifier`; absence = passthrough).
8. **HALT 14** [NEW per Card C pattern] — `autoTriggerDispatcher.ts` diff is non-zero (registry-derived since B/C-enable; dispatcher should not need edits).
9. **HALT 15** [NEW] — `mcp-server/**` diff is non-zero (server-side is Card 1's territory).

---

## 6. Hard guardrails

- ONE-character flip only on `familyRegistry.ts` (HALT 12).
- NO dispatcher edit, NO `mcp-server/` edit, NO migration, NO `package.json` change.
- Family A–G entries on the registry stay byte-equal.
- I and J productionEnabled stays `false`.

---

## 7. Process

1. **Designer** writes `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md` (faithful G-enable replica).
2. **Implementer** on `feat/MCP-021C-EDGE-FAMILY-H-ENABLE`.
3. **Reviewer** writes `docs/reviews/MCP-021C-EDGE-FAMILY-H-ENABLE.md`.
4. Adversarial Explore × 3:
   - **adv1** capacity load delta hunt (7→8 production families; MCP cap=5; sequential per-submit means per-isolate concurrent calls = N_concurrent_submits, not multiplied by family count — verify).
   - **adv2** A–G regression hunt (H crash MUST NOT abort A–G iterations in `dispatchOneFamilyIteration`'s per-iteration try/catch).
   - **adv3** L5 CI-mechanical enforcement verification (Card C smoke template requires Phase 6 `evidence_span` inspection; absence fails audit-lint at exit 1).
5. **PR open + HARD STOP at operator merge gate.**
6. Operator merges, runs 8-phase production-enable smoke per the template, authors `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-<date>.md`.

On smoke PASS: chain CLOSED. Family H operational in production. Family I chain becomes authorized (separate planning decision; mixed-source per Decision 7).

---

## 8. Post-merge smoke skeleton (8 phases, G pattern)

- **Phase 0** — pre-flight (registry confirms 8 production entries)
- **Phase 1** — dispatch confirms 8 production runs per submit
- **Phase 2** — targeted-signal positive: at least one H key surfaces on a designed-positive H input
- **Phase 3** — read-path includes H observations (timeline + inspect)
- **Phase 4** — admin_validation H still operational (parallel verification)
- **Phase 5** — provider load delta: per-isolate concurrent ≤ MCP cap (5); 8-family load does NOT exceed
- **Phase 6** — DOCTRINE (BINDING + L5 CI-mechanical): persisted `evidence_span` scan on the burst H rows; 0 banned verdict tokens; per-key `falsePositiveGuards` hold
- **Phase 7** — regression: A–G unregressed (per-family success counts byte-equivalent to pre-flip baseline)
- **Phase 8** — observability + audit-lint marker + verdict line

Smoke verdict authority: PASS (chain closed; Family H production) | PARTIAL (chain PAUSES, document follow-up) | FAIL (chain stops; revert per operator decision).
