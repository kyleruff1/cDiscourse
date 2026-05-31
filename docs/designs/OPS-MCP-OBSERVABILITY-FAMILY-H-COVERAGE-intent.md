# OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE — Intent brief (observability backfill)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** Observability SQL + manifest update — extend per-family observability set with Family H.
**Predecessor:** MCP-021C-EDGE-FAMILY-H-ENABLE merged + smoke PASS. Family H production-enabled.
**Trail:** Umbrella issue # [OPERATOR DECISION NEEDED]. Card issue # TBD.

> Status: **queued; do not implement until MCP-021C-EDGE-FAMILY-H-ENABLE has merged + smoke PASS.**

---

## 1. Goal

Update per-family observability SQL files in `scripts/ops/sql/` so dashboards/runbooks for the 8 production families (A–H) show H alongside A–G. Mirror the OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE precedent. Same shape as OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.

---

## 2. Scope (IN / OUT)

**IN**
- Update CASE statements / family-key-counts in existing SQL files to include H.
- Add new H-specific SQL files where D/E/F/G precedent did so [OPERATOR DECISION NEEDED: list which Q files].
- Update `manifest.json` / runbook references from "7 production families" to "8 production families".
- New `__tests__/opsMcpObservabilityFamilyHCoverage.test.ts` per pattern.

**OUT**
- Same OUT list as Family G observability card.

---

## 3. Binding decisions

**D1 — Direct replica of Family G observability card structure.**
**D2 — Test forecast: +20 to +50** [OPERATOR DECISION NEEDED].
**D3 — No new dependencies; no migration; no SQL function added.**

---

## 4. HALT triggers

Same as Family G observability card.

---

## 5. Process

Designer → implementer → reviewer → PR → operator merge.

---

## 6. Status

**Queued.** Do not implement until Family H production-enable lands + smoke PASS confirmed.
