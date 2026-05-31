# OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — Intent brief (observability backfill)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** Observability SQL + manifest update — backfill Family G into the `scripts/ops/sql/` per-family observability set. Trivial follow-up to a previously-merged production-enable card.
**Predecessor:** MCP-021C-EDGE-FAMILY-G-ENABLE merged on main (2026-05-29). Family G is in production; observability is the catch-up.
**Trail:** Umbrella issue # [OPERATOR DECISION NEEDED: capture from Phase 4 of OPS-WORKFLOW-RESTORATION]. Card issue # TBD.

> Replicates the `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` precedent. The card should have shipped immediately after Family G production-enabled; this brief records the queued state and the work needed when CC resumes implementer work.

---

## 1. Goal

Update the per-family observability SQL files in `scripts/ops/sql/` so dashboards / runbooks for the 7 production families (A–G) show G alongside A–F. The Family G enable card landed without an observability follow-up; this brief queues it.

---

## 2. Scope (IN / OUT)

**IN**
- Update `scripts/ops/sql/11-per-family-per-mode-coverage.sql` (or equivalent) — add Family G to the CASE statement / family-key-count list.
- Add new family-G-specific SQL files where the D/E/F precedent did so [OPERATOR DECISION NEEDED: list which Q files need adding by reading the current `scripts/ops/sql/` contents at the post-G-enable SHA].
- Update `scripts/ops/sql/manifest.json` or equivalent if a per-family manifest exists.
- Update `docs/ops/MCP-OBSERVABILITY-RUNBOOK.md` if it references a 6-family count.
- Tests: `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts` (if observability tests follow the D/E/F pattern of per-family test files); [OPERATOR DECISION NEEDED: confirm test pattern].

**OUT**
- NO Edge / MCP server / migration / Family A–F change.
- NO non-SQL/non-manifest/non-runbook change.
- NO `package.json` change.

---

## 3. Binding decisions

**D1 — Direct replica of OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE structure**, substituting Family D → Family G.

**D2 — Test forecast: +20 to +50** [OPERATOR DECISION NEEDED: confirm].

**D3 — No new dependencies; no SQL function added; no migration.**

---

## 4. HALT triggers

1. HALT 1 — Required-reading missing.
2. HALT 2 — Standard preflight not green.
3. HALT 6 — roadmap-reviewer returns BLOCK.
4. HALT 8 — Test delta out of bounds.
5. **HALT — observability test isolation:** the `scripts/ops/sql/` directory has a recursive count-16 + header ownership assertion in observability test files (see memory: `ops-sql-dir-observability-owned.md`). New SQL files must follow the established count and ownership conventions OR live in a sibling directory.

---

## 5. Process

Designer → implementer → reviewer → PR → operator merge.

---

## 6. Status

**Queued.** Implement when Family G production-enable smoke has fully stabilized (already shipped 2026-05-29; observability is overdue).
