# MCP-021C-EDGE-FAMILY-I-ENABLE — Intent brief (Card 3 of 3-card suite)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** Edge production-mode flip — ONE boolean character change on Family I's entry in `supabase/functions/_shared/booleanObservations/familyRegistry.ts`.
**Suite:** Card 1 (MCP-SERVER-010-FAMILY-I) → Gate A → Card 2 (CONDITIONAL: audit-lint L5) → Gate B → **Card 3 (this card)**.
**Predecessor:** Card 1 merged + smoke PASS; Card 2 merged + smoke PASS (or SKIPPED if doctrine-risk LOW). Family I operational on hosted MCP in admin_validation mode.
**Trail:** Umbrella issue #388. Card issue #394.

---

## 1. Goal

Flip Family I to production at the Edge layer. The dispatcher routes ALL submits through 9 production families (A–I) instead of 8 (A–H). Same shape as MCP-021C-EDGE-FAMILY-H-ENABLE with mixed-source-specific differences.

---

## 2. Scope (IN / OUT)

**IN**
- ONE boolean character flip in `familyRegistry.ts`: `thread_topology` entry `productionEnabled: false → true` (HALT 12).
- Stale-assertion flips in ~6 test files (EIGHT → NINE count pattern).
- NEW `__tests__/edgeFamilyIProductionEnable.test.ts` (~19 tests mirroring HHE pattern).
- NEW smoke template `docs/audits/MCP-021C-EDGE-FAMILY-I-ENABLE-SMOKE-template.md`.
- **Subset filter for I**: per the mixed-source design from Card 1, the Edge booleanObservationRequestBuilder must continue to route only the 6 `ai_classifier` keys through the MCP path. The `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block STAYS present for Family I (HALT-13 INVERSE for Family I vs Family H).

**OUT**
- Same OUT list as H edge-enable card.
- Subset filter STAYS — do NOT remove it.

---

## 3. Binding decisions (D1–D6)

**D1 — One-character flip in `familyRegistry.ts` is the entire production code change.**

**D2 — `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` Family I entry STAYS PRESENT.** (HALT-13 inverse from H: H's uniform `ai_classifier` meant absence; I's mixed-source means presence.)

**D3 — Production family count post-flip: 9 (A–I).** Admin-only: J.

**D4 — Smoke template Phase 6 doctrine `evidence_span` inspection** [OPERATOR DECISION NEEDED: BINDING if Card 2 shipped (L5 CI-mechanical); ADVISORY if Card 2 SKIPPED].

**D5 — Test forecast: +15 to +25 net** (mirror H).

**D6 — auto_metadata + lifecycle keys still routed via NON-MCP paths.** This card does NOT change those paths.

---

## 4. Test forecast

[OPERATOR DECISION NEEDED: confirm; mirror H expectation]
- Forecast: +15 to +25 net Jest.
- HALT 8 ceiling: > +35.

---

## 5. HALT triggers

Same as H edge-enable card with one inverse:
- **HALT 13** [INVERTED for I] — `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` Family I entry REMOVED (must STAY present for mixed-source family).

---

## 6. Hard guardrails

Same as H. Subset filter for I STAYS.

---

## 7. Process

Designer → implementer → reviewer → adversarial × 3 (capacity load 8→9; A–H regression; L5 enforcement) → PR → operator merge → smoke.

---

## 8. Post-merge smoke skeleton

8 phases per H pattern. Phase 6 doctrine intensity per Card 2 shipped vs SKIPPED.

On smoke PASS: chain CLOSED. Family I operational in production. Family J disposition is decided by the OPS-FAMILY-J-SCOPING-AUDIT (composer-only / inspect-only gate verification).
