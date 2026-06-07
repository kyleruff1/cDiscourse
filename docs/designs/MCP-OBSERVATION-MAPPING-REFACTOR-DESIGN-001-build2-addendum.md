# MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 — Build 2 Addendum (family-by-family boolean expansion)

**Status:** Proposed (Build-2 GATE-C scoping addendum) — extends the ratified GATE-A design (#530 / `MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001.md`).
**Date:** 2026-06-07
**Owner:** orchestrator (post-Build-1 scoping)
**Deploy posture:** Build 2 is **deploy-bearing** (Edge classifier + MCP-server). This addendum is **design-only**; it authors no code and no migration.

---

## 0. Why this addendum exists

Build 1 (the mapping evaluator + card wiring, #535/#536) is live, but only **13** rules fire. Reconciliation found the candidate artifact's A–G mapping rows assume a **planned boolean vocabulary the deployed classifier does not return** — only 2 CSV rows map to live rawKeys. Build 2 adds the **ratified 21 production-family booleans** so more mapping rows fire. This addendum locks the four decisions the GATE-A design left open for the deploy-bearing implementation, and scopes the first card (Family B).

**Scope reality (from the Build-2 scoping pass):** the ratified 21 unlock only **~21–26%** of the ~955 deferred A–G mapping rows. The bulk (~63%) depends on **44 *other* `existing_or_planned` flags that were never doctrine-reviewed** → a **separate Build-3 scope/triage decision**, explicitly NOT Build 2. HiTODS's 18 → Build 4 (frozen). Build 2 ships the doctrine-reviewed 21 only.

---

## 1. Version decision — DO NOT bump `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION`

The persistence read adapter filters observations by **exact** schema-version match (`machineObservationPersistenceAdapter.ts:140`: `if (row.schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) continue;`). Bumping `'mcp-021.machine-observations.boolean.v1'` → `v2` would **silently hide every existing room's observations** from the card/timeline until re-classification.

**Decision:** the constant stays `v1`, **byte-equal**, in Build 2 and every future vocabulary-only build. Adding booleans is a **vocabulary expansion**, not a wire-shape change; the schema version tracks wire format, not vocabulary scope. `v1` is a **living vocabulary**. Each Family card adds a regression test asserting the constant is unchanged.

## 2. MCP-server deploy path — the one manual step  ⚠️ OPERATOR INPUT NEEDED

- **Edge classifier** (`classify-argument-boolean-observations`): **auto-deploys on merge** to main (registered in `supabase/config.toml`; the `_shared/booleanObservations/...` mirrors deploy with it). No manual step.
- **`npx supabase db push`:** nothing happens — **no migration, no DDL** (the store is key-value: `argument_machine_observation_results.raw_key TEXT`, `UNIQUE (run_id, raw_key)`; a new boolean is a new row-value; unknown keys are dropped at read).
- **MCP-server** (`mcp-server/`, standalone Deno app): **NOT auto-deployed** — it's outside the Supabase GitHub integration. **The operator deploys it manually.** Until then, the new `booleanQuestion`s are not asked even though the Edge/client definitions are live.

**OPEN QUESTION (operator):** name the MCP-server deploy mechanism (Deno Deploy / fly.io / hosted VM / other) so each Family card's deploy runbook is exact. This is the single manual deploy step in Build 2.

## 3. Smoke gate — admin-validation before production

New booleans ship **admin-validation-first** (`familyRegistry`: all A–G `adminValidationEnabled: true`; A–G already `productionEnabled: true`). Before a family's new booleans are trusted on the production card surface:
1. Pass an **admin_validation audit** with **operator sign-off** (the Admin → Classifier Health surface is the sign-off surface).
2. **Zero terminal dead-letters** in synthetic smoke (mirror the family-G **N=56 / 0-dead-letter** bar).
3. Verdict-adjacent booleans get the **5-layer defense** (system-prompt doctrine block · per-key `falsePositiveGuards` · ban-list scan · adversarial fixtures · live smoke audit).

## 4. Sequencing — family-by-family, Family B first; the 44 = Build 3

Ship the ratified 21 **one family per card** (not all 7 at once): smaller blast radius for a deploy with a manual MCP step, easier per-family audit, failure isolation, matches the family-G cadence.

- **Build 2a — Family B (`disagreement_axis`) FIRST** (this card's subject). Its 3 booleans each gate **14** deferred rows (the densest slice, ~42 rows) and include the verdict-adjacent template-setter.
- **Build 2b–2g** — A, C, D, E, F, G, one card each, reusing the Family-B template.
- **Build 3 (separate)** — the 44 non-HiTODS `existing_or_planned` flags (~63% of deferred rows). **NOT in Build 2** — un-reviewed vocabulary needs its own scope/doctrine-triage decision (the same fence HiTODS got).
- **Build 4 (separate, P4)** — the 18 HiTODS booleans, frozen, its own doctrine card.

---

## 5. Family B adopt list (the first card — `disagreement_axis`)

| rawKey (proposed) | label | booleanQuestion (the move, never the author) | notes |
|---|---|---|---|
| `isolates_main_disagreement` | "Isolates the disagreement" | Does this move identify the specific point of disagreement (vs talking past it)? | gates 14 rows |
| `distinguishes_fact_value_disagreement` | "Separates fact vs value" | Does this move distinguish a factual disagreement from a values/normative one? | gates 14 rows |
| `preserves_face_while_disagreeing` | "Disagrees while preserving face" | Does this move disagree while preserving the other party's standing? | gates 14 rows; **VERDICT-ADJACENT** → adversarial fixtures + must describe the MOVE, never the author |

Exact `id`/`rawKey`/`label`/`shortLabel`/`description`/`disposition`/`booleanQuestion`/positive+negative definitions+examples/`falsePositiveGuards`/`confidenceEligibility` are authored in the Family-B implementation per the `familyA.ts:38-78` shape (client + byte-equal Edge mirror).

### Per-boolean mechanics (zero DDL)
5 surfaces per boolean: (1) client def `src/features/nodeLabels/machineObservationDefinitions/familyB.ts`; (2) byte-equal Edge mirror `supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyB.ts`; (3) MCP prompt entry + question block in `mcp-server/lib/familyBPrompt.ts`; (4) **NO** schema-version bump; (5) parity-test extension in `__tests__/machineObservationRegistry.test.ts`.

---

## 6. Adversarial-check set for the Family-B build (inherited by 2b–2g)

1. Each boolean passes the **8 adoption tests** (not-derivable · materially-better label · classifier-answerable yes/no · improves reader understanding · display-only/not-a-gate · fixture-testable · verdict-free label · clear absent-fallback) — already cleared at GATE-A.
2. **Verdict-free + describes-the-MOVE-not-the-author** ban-list over every new label/definition/question — especially `preserves_face_while_disagreeing`.
3. **Client ≡ Edge parity** (byte-equal definitions); unique rawKeys per family.
4. **NO schema-version bump** — byte-equal regression test on the constant (§1).
5. **A–G only; `familyRegistry` unchanged** (B already `productionEnabled: true`; no new family entry — that's Build 4).
6. **§10a** (no `inactive_reason`); **post-storage** (classifier runs after storage; `engine.ts` is the sole gate, untouched); no suppression/routing/`productionEnabled` flip.
7. **admin_validation smoke + 0 dead-letters + operator sign-off** before the family is trusted on the production card (§3).
8. **THR-4** — no existing test relaxed; test count up.

---

## 7. Non-goals
No version bump; no DDL/migration; no Build-3 (the 44 flags); no HiTODS; no `productionEnabled` flip (B already on); no auto-deploy of the mcp-server (operator manual step); no widening Build 2 beyond the doctrine-reviewed 21.

---

## 8. Open Questions for operator
- **OQ-deploy (§2):** the MCP-server deploy mechanism (needed for each Family card's deploy runbook). The one manual step.
- **OQ-build3 (§4):** when/whether to scope the 44 un-reviewed flags (Build 3) — that's where ~63% of the deferred-row value sits; adopting them would lift coverage to ~70–80%, but they need a doctrine-triage pass first.
