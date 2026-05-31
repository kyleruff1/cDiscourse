# OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — Intent brief (observability backfill)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** Observability SQL + manifest update — extend per-family observability set with Family I.
**Predecessor:** MCP-021C-EDGE-FAMILY-I-ENABLE merged + smoke PASS. Family I production-enabled.
**Trail:** Umbrella issue #388. Card issue #397.

> Status: **queued; do not implement until MCP-021C-EDGE-FAMILY-I-ENABLE has merged + smoke PASS.**

---

## 1. Goal

Update per-family observability SQL files so dashboards/runbooks for the 9 production families (A–I) include I. Mirror the D / G / H observability precedents.

NOTE: Family I is mixed-source (6 ai_classifier + 8 auto_metadata + 7 lifecycle). Observability dashboards may need to distinguish source-routing for I (some keys flow through the MCP path, others via system/cluster paths). [OPERATOR DECISION NEEDED: confirm whether observability needs source-mode breakdown for mixed-source families — designer A.1 reads existing Family D observability output to verify].

---

## 2. Scope (IN / OUT)

**IN**
- Update CASE / family-key-counts to include I.
- Add I-specific SQL files where D/E/F/G/H precedent did so.
- Update manifest / runbook references "8 production families" → "9 production families".
- New `__tests__/opsMcpObservabilityFamilyICoverage.test.ts`.
- Source-mode breakdown SQL update for mixed-source visibility, if needed.

**OUT**
- Same OUT list as G/H observability cards.

---

## 3. Binding decisions

**D1 — Direct replica of Family G/H observability card structure, with mixed-source breakdown additions per D precedent.**
**D2 — Test forecast: +25 to +55** [OPERATOR DECISION NEEDED].
**D3 — No new dependencies; no migration.**

---

## 4. HALT triggers

Same as Family G/H observability cards.

---

## 5. Process

Designer → implementer → reviewer → PR → operator merge.

---

## 6. Status

**Queued.** Do not implement until Family I production-enable lands + smoke PASS confirmed.
