# MCP H / I / J Readiness Ledger and Blocker Map

**Card:** MCP-HIJ-000 (GitHub issue #471)
**Type:** docs-only, advancement-neutral inventory ledger.
**Authoritative spec:** `docs/designs/MCP-HIJ-000-READINESS-LEDGER.md` (the design; this file is the implemented ledger deliverable it specifies).
**Implementer role:** roadmap-implementer.

---

## Verified-at-HEAD hash

Every state claim and every `file:line` citation in this ledger was re-verified against repository HEAD `3b668d2` (post-#486 main, the branch base for MCP-HIJ-000). The design was authored against HEAD `37ccd9e`; the cited line numbers were re-read at `3b668d2` and confirmed unchanged for the registry (`familyRegistry.ts:106/111/116`), the request builder (`booleanObservationRequestBuilder.ts:62,71,77`), the cutover gates (`OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:78,82`), and the known-blockers FROZEN section (`known-blockers.md:579-582`). If HEAD has advanced when you next rely on this doc, re-verify each citation.

---

## HARD RULE (verbatim — per H-I-J roadmap §7)

> "No file in this card enables any family. No doc, audit, or roadmap auto-advances a family to production. The percentage dial and the family dial are separate. One family at a time. Failure rolls back."

**This ledger is NOT a gate-pass.** It is an inventory ledger, not an advancement authorization. A "green ledger row" is NOT a gate-pass and does NOT authorize advancing any family to production. Advancement remains operator-gated per `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`. This document flips no `productionEnabled` flag, arms no routing, and raises no routing percentage. It records partial and contested evidence honestly and makes no recommendation to advance any family.

**Constitutional acceptance-gate invariant (verbatim, binding on every card that touches classifier / queue / routing / submit-argument / observations / MCP):**

> "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post."

This card is documentation-only — a readiness ledger. It changes no family state and no submission path.

---

## Purpose

H/I/J readiness state is fragmented across at least four documents plus the registry source: `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md`, `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`, the per-family audits, `docs/core/known-blockers.md`, and `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md`. A reviewer or operator who asks "what blocks H production retry / I Card 1 / any J card?" should be able to read the answer off the single matrix below instead of cross-walking those docs.

Each cell is sourced verbatim from an existing artifact; no new facts are invented, and no new or weakened gate criterion is introduced. The "operator gate required" column points at a **LIVE GitHub issue** so the gate is actionable, not just an intent doc.

---

## Current production state

At HEAD `3b668d2`, the family registry (`supabase/functions/_shared/booleanObservations/familyRegistry.ts:68-119`, `Object.freeze`d at line 68) holds 10 families. Families **A–G** (`parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`, `critical_question`, `resolution_progress`) are `productionEnabled: true` + `adminValidationEnabled: true` (`familyRegistry.ts:69-103`). Families **H / I / J** are `productionEnabled: false` + `adminValidationEnabled: true`:

| Family | Registry name | `productionEnabled` | `adminValidationEnabled` | Cite |
|---|---|---|---|---|
| H | `claim_clarity` | **false** | true | `familyRegistry.ts:106` |
| I | `thread_topology` | **false** | true | `familyRegistry.ts:111` |
| J | `sensitive_composer` | **false** | true | `familyRegistry.ts:116` |

`adminValidationEnabled: true` means all three families run in the **admin-validation** path only (the dormant `admin_validation` run mode), never on the production auto-trigger path. No H/I/J observation reaches a production user-facing surface today. Routing baseline is OFF: `CLASSIFIER_QUEUE_ROUTING_ENABLED` reads via strict `=== "true"` (unset ⇒ false) and `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` fail-closes to 0 (`supabase/functions/submit-argument/index.ts:811-816`; `classifierQueueRouting.ts:89-98`).

The frozen-set boundary is a hard limit this ledger respects and re-states (does not weaken): **H/I/J stay `productionEnabled: false`.** No card in this family flips that flag, arms routing, or raises the routing percentage (`docs/core/known-blockers.md:579-582`).

---

## The matrix

### Row H — `claim_clarity`

| Column | State at HEAD `3b668d2` | Cite |
|---|---|---|
| **1. Registry state** | `productionEnabled: false`, `adminValidationEnabled: true` | `familyRegistry.ts:106-107` |
| **2. Prompt / server state** | Card 1 SHIPPED — per-family `claim_clarity` classifier on the MCP server (admin_validation classifier). | PR #400 (Card 1) |
| **3. Validator / schema state** | Card 2 SHIPPED — L5 audit-lint mechanization for `family_h`. Audit smoke PASS. | PR #403 (Card 2/3), PR #404 (smoke PASS 5/5 + L5 teeth) |
| **4. Input requirements** | Source-uniform `ai_classifier` (12 keys). **No** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` subset entry required (absence ⇒ full registry passthrough). | `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:73`; `booleanObservationRequestBuilder.ts:62` |
| **5. UI consumer** | Admin-validation table only today. No production user-facing surface (registry-gated). | `familyRegistry.ts:106` (production gate) |
| **6. Known failures** | Card 3 production-enable merged (PR #405) → smoke FAIL (audit PR #407) → ROLLED BACK (PR #408). The 8-family production surface failed under burst. | `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md`; `docs/reviews/REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE.md:15,37` |
| **7. Doctrine risks** | Every H key is a **structural Observation, never a verdict** (`claim_specificity_low` = "broad claim", not "weak"; `conclusion_missing` = "no explicit conclusion", not "incomplete"). §1 / §4 bind. | `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:191-192` |
| **8. Smoke plan** | Per-family smoke per the H-enable SMOKE template (canary-then-burst), but smoke PASS is **necessary-but-not-sufficient** — the P1 real-organic precondition must precede it. | `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` (template); cutover gate rows 10/11 |
| **9. Load plan** | E#7 three-conjunctive-condition retry gate (below). H/I/J carry a zero-terminal-failure bar (E#11). | `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:78,82` |
| **10. `productionEnabled` blocker** | `false` because the 8-family burst surface FAILed and the retry preconditions are unmet. Named precondition to flip (NOT a recommendation to flip): satisfy E#7 (all three conditions) + a clean Card-3 re-run smoke. The decision is owned by #472, not by this ledger. | `familyRegistry.ts:106`; cutover row 7 (`:78`) |
| **11. Operator gate required** | **#472 MCP-H-001** (Family H scoping / retry design — GATE A only). The retry decision lives there, not here. | gh issue #472 (OPEN) |

**E#7 — H retry gate (three conjunctive conditions, ALL required, stated verbatim from the existing cutover doc — no new or weakened criterion):** (a) a non-H PASS-LOAD; (b) a separate operator decision; (c) provider/server reliability proven at higher (8-family) load **and** a clean Card-3 re-run smoke. The non-H PASS-LOAD alone does NOT unblock H. P1 (A–G stable at higher % with **real organic** evidence) is an ordered precondition that must precede the H synthetic smoke; synthetic PASS is necessary-but-not-sufficient (`OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:78,104`; §F item 3 operator-ratified 2026-06-03 at `:100,104`).

### Row I — `thread_topology`

| Column | State at HEAD `3b668d2` | Cite |
|---|---|---|
| **1. Registry state** | `productionEnabled: false`, `adminValidationEnabled: true` | `familyRegistry.ts:111-112` |
| **2. Prompt / server state** | Cards 1/2/3 **never attempted**. Intent doc only. | `docs/designs/MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md` (intent only); Phase 0 `family_I_card_status_NEVER_ATTEMPTED` |
| **3. Validator / schema state** | No L5 audit-lint mechanization shipped (Card 2 unshipped). | intent-only state |
| **4. Input requirements** | **Mixed-source** family. Production-enable **MUST** add `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] = new Set(['ai_classifier'])` to `booleanObservationRequestBuilder.ts`. This is the **HALT-13 inverse**: today only `evidence_source_chain` (D) and `resolution_progress` (G) have subset entries; `thread_topology` is **absent**, and "absence ⇒ full registry passthrough" — so enabling I without the entry would send deterministic keys the MCP server rejects → `mcp_validation_failed`. **That add is owned by #478, not this ledger.** | `booleanObservationRequestBuilder.ts:68-78` (D + G only; comment line 62); MEMORY note `mcp-mixed-source-family-edge-subset` |
| **5. UI consumer** | Admin-validation table only today. No production surface. | `familyRegistry.ts:111` |
| **6. Known failures** | None (never attempted in production). The only recorded I risk is the mixed-source subset trap above, which is a design hazard, not an incident. | Phase 0 `family_I_card_status_NEVER_ATTEMPTED` |
| **7. Doctrine risks** | Every I key is a structural topology Observation, never a verdict (`ignored_by_both` = a reply-state topology fact, not a verdict on the contribution). §1 / §3 / §4 bind. | `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:191-192` |
| **8. Smoke plan** | Would mirror the family-enable SMOKE template once Cards 1/2 exist; not yet drafted. | (unshipped) |
| **9. Load plan** | Chained behind H stable; the same E#11 zero-terminal bar applies when attempted. | `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:82` |
| **10. `productionEnabled` blocker** | `false` because Cards 1/2/3 are unbuilt **and** the mixed-source subset entry is missing **and** I is chained behind H stable. None of these is unblocked by this ledger; all are owned by #478. | `familyRegistry.ts:111`; `docs/designs/MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md` |
| **11. Operator gate required** | **#478 MCP-I-SCOPE-001** (Family I scoping design — parallel to H #472 / J #473). | gh issue #478 (OPEN) |

### Row J — `sensitive_composer`

| Column | State at HEAD `3b668d2` | Cite |
|---|---|---|
| **1. Registry state** | `productionEnabled: false`, `adminValidationEnabled: true` | `familyRegistry.ts:116-117` |
| **2. Prompt / server state** | No production-enable card under current disposition. Scoping audit verdict **N=0** — no J production-enable card is to be filed under the present disposition. | `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md`; roadmap §5.3 |
| **3. Validator / schema state** | N/A under current disposition (no production validator path; the disposition gate is the safety surface). | roadmap §5.3 |
| **4. Input requirements** | Source-uniform `semantic_referee` (5 keys: 3 `composer_only` + 2 `inspect_only`). **No** subset entry required. | `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md:25-35`; roadmap §6 |
| **5. UI consumer** | **Composer-only** for the sensitive keys; `inspect`-only for the two `inspect_only` keys. **Never** on the target's node. | §10a (verbatim below); roadmap §6 |
| **6. Known failures** | None. The scoping audit ratified the resting state (N=0) — issue #398 closed, PR #406. Not an incident; the finished state. | roadmap §5.3; Phase 0 dedup `MCP-J-001` |
| **7. Doctrine risks** | **§10a load-bearing.** Sensitive Observations (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`) render **composer-only — never on the target's node — because surfacing them publicly reads as accusation**. `uses_popularity_as_evidence` / `uses_satire_as_evidence` are `inspect_only` informational (§3). No verdict, no intent claim. | §10a; roadmap §6 |
| **8. Smoke plan** | N/A — no production surface to smoke under current disposition. Any future surface gets its own smoke + a fresh §10a doctrine review (P4). | roadmap §5.3 |
| **9. Load plan** | N/A under current disposition. Three concentric gates enforce surface routing today: Edge `productionEnabled: false` + persistence-adapter surface acceptlist + presentation-layer disposition switch. | roadmap §5.3 / §6 |
| **10. `productionEnabled` blocker** | `false` **by design / resting state**, not by a missing build. The scoping verdict is N=0: J is intentionally OFF and that is the finished state. Introducing a J surface would require a NEW operator doctrine change + a fresh P4 doctrine review — **not a registry flip, and not authorized by this ledger.** | roadmap §5.3 |
| **11. Operator gate required** | **#473** (Family J scoping design — deepen ratified N=0 disposition). Any future J surface is a NEW doctrine-reviewed card, not an advancement of this ledger. | gh issue #473 (OPEN) |

**§10a verbatim (binding on Row J):**

> "Sensitive Observations (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`) render composer-only — never on the target's node — because surfacing them publicly reads as accusation."

---

## What this ledger deliberately does NOT do

- It does NOT touch `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — no `productionEnabled` flip.
- It does NOT touch `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` — no `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` change.
- It does NOT touch any migration, any Edge Function, or any file under `mcp-server/**`.
- It does NOT advance H retry, I Card 1, or any J card; it makes no recommendation to advance any of them.
- It does NOT lower any bar, change any guard, change any threshold, or modify any failing test/lint to pass.
- It does NOT include any acceptance criterion of the form "when ledger is green, advance" — advancement stays operator-gated.
- It does NOT reopen, redesign, or re-litigate #371 or #373. The Deno-KV global limiter is recorded-rejected; the ARCH-001 Postgres async classifier queue is the chosen path (`docs/core/known-blockers.md:552,556`).
- It does NOT propose moving any renderer / validator / classifier logic from `scripts/bot-fixtures/` into `src/` (doctrine §7).

The capacity history is recorded-and-closed: the provider-capacity incident (#371 per-isolate cap, #373 Deno-KV limiter) is resolved off-path by the ARCH-001 Postgres async classifier queue — drainer concurrency `C=3`, `MAX_ATTEMPTS=4`, backoff `[30,120]s` (`docs/core/known-blockers.md:552,556`). H/I/J are never enqueued today because `enqueueClassifierJobs` enqueues one row per `productionEnabledFamilies()` only.

---

## Operator follow-up (none unblocked by this ledger)

- **H** retry remains gated on the E#7 three conjunctive conditions (#472).
- **I** Card 1 is chained behind H stable **and** requires the mixed-source `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology']` subset entry before any production-enable (#478).
- **J** stays at the ratified N=0 disposition; any new J surface is a NEW P4-doctrine-reviewed card, never an advancement of this ledger (#473).

---

*End of MCP H/I/J readiness ledger. This document enables no family, authorizes no advancement, and flips no `productionEnabled` flag. A green ledger row is NOT a gate-pass.*
