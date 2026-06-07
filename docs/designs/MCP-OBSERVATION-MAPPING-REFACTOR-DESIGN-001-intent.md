# MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 — intent brief

**Status:** Proposed — GATE A (design-only)
**Date:** 2026-06-07
**Parent design:** `MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001.md`
**Migration plan:** `MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001-migration-plan.md`

---

## Why now

The MCP boolean classifier already runs post-storage and persists positive observations as `raw_key` rows, but the display layer is **1:1** — one positive boolean maps to one label spread verbatim from its definition. A candidate artifact (`docs/designs/mcp-observation-mapping/`, 2,383 rows) shows we can produce **far richer, combination-aware diagnostic labels** ("Central-point refutation with claim-matched evidence" from four positive booleans across two families) with **zero schema risk** for the bulk of it.

Two facts make this the right moment:
1. **A large no-migration win is sitting unrealized.** 1,268 of the 2,383 candidate rows (`fits_existing_or_planned_boolean_answers`) need only an evaluator over booleans the classifier *already* returns. That is a high-value, low-risk display improvement we can ship first.
2. **The expansion has a clean, well-fenced boundary.** The new booleans (especially the face-attack/aggression HiTODS family) are exactly where doctrine risk concentrates. Consolidating the two proposed cards (#4 no-migration mapping + #5 new-boolean expansion) into one design lets us draw that boundary deliberately — fence HiTODS into its own P4 doctrine card, defer the frozen H/I/J booleans with their families, and sequence the rest so the safe work ships ahead of the gated work.

The Phase 0 discovery also overturned a misframing: the choice was framed as "new SQL column per boolean vs jsonb," but the store is **already** a `raw_key`-row key-value model — so a new boolean is a new row value, **not a column → no DDL**. That changes the migration story from "schema migration per boolean" to "near-zero migration," and this card pins that finding down precisely.

## What success looks like

- A ratified design that **consolidates the two proposed cards** into a two-track plan (no-migration mapping vs new-boolean expansion), with HiTODS spun out as its own card.
- A resolved **boolean adoption table**: 21 production-family new booleans adopted (each passing the 8 tests), 18 HiTODS deferred to its own card, 6 frozen-family booleans deferred with their families.
- A **migration plan** that states, with verification, **DDL needed: NO** — the raw_key-row model stores any boolean as a value; the only deploy-affecting changes are a schema-version constant, new definitions, and MCP prompts.
- A **mapping evaluator architecture** decision: a declarative registry of combination rules, evaluated post-storage at read time, labels routed through `gameCopy.toPlainLanguage`, confidence as pips, card-default-visible / timeline-tap-to-reveal.
- A **CSV adoption posture**: reviewed subset seeded as checked-in declarative data (never a wholesale 2,383-row import), with a review pass that the artifact's verdict-free register and `safety_note` survive into production and the one borderline cross-family "ad hominem" label is re-registered.
- A clear **sequencing** into 4 build cards (1 evaluator/no-migration → 2 new booleans/merge=deploy → 3 mapping extension → 4 HiTODS doctrine card) and an adversarial-check set binding every build.
- Three open questions surfaced for the operator (genre-taxonomy source-of-truth; the one adopt-bubble boolean; supersede-vs-additive composite semantics), each with a recommendation.

## Out of scope

- **No production code, no migration, no `.ts`/`.tsx`/`.sql` outside these three docs.** No `src/**`, `app/**`, `supabase/**`, `mcp-server/**`, `__tests__/**` edits.
- **No HiTODS family build** — that is its own P4 doctrine card (`MCP-FAMILY-HITODS-DESIGN-001`).
- **No advancement of frozen H/I/J families** — they stay `productionEnabled:false`; their 6 new booleans are not designed in.
- **No routing arm, no percentage ramp, no `productionEnabled` flip** of any family.
- **No moderation surface** — no report/strike/"act on this" affordance for any observation.
- **No wholesale CSV import** — reviewed subset only.
- **No genre / nav / Start-Argument work** — `startArgumentTaxonomy.ts` untouched (the shared-vocabulary doc is an Open Question recommendation only).
- **No new timeline-grammar node visual state** — the surface posture is detail-strip disclosure, not a new shape/strength/heat encoding.
- **No change to the acceptance gate** — `engine.ts` stays the sole submission gate; everything here is post-storage display.
