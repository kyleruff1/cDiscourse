# MCP-HIJ-000 — H / I / J Readiness Ledger and Blocker Map

**Card:** MCP-HIJ-000 (GitHub issue #471)
**Type:** docs-only, advancement-neutral inventory ledger.
**Status:** DESIGN. No implementation, no enablement.
**Author role:** roadmap-designer.

---

## Verified-at-HEAD hash

All state claims in this document were verified against repository **HEAD `37ccd9e`** (`git rev-parse HEAD` → `37ccd9ed027c625686f3eee517d03a48df25a29d`). Every `file:line` citation below was read at that commit. If HEAD has advanced when this doc is implemented, re-verify each citation before relying on it.

---

## HARD RULE (verbatim — per H-I-J roadmap §7)

> "No file in this card enables any family. No doc, audit, or roadmap auto-advances a family to production. The percentage dial and the family dial are separate. One family at a time. Failure rolls back."

**This ledger is NOT a gate-pass.** It is an inventory ledger, not an advancement authorization. A "green ledger row" is NOT a gate-pass and does NOT authorize advancing any family to production. Advancement remains operator-gated per `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`. This document flips no `productionEnabled` flag, arms no routing, and raises no routing percentage.

**Constitutional acceptance-gate invariant (verbatim, binding on every card that touches classifier/queue/routing/submit-argument/observations/MCP):**

> "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post."

---

## Scope

Deliver a single inventory doc — this file — that consolidates the readiness state of MCP classifier families **H (`claim_clarity`)**, **I (`thread_topology`)**, and **J (`sensitive_composer`)** into one matrix, one row per family, with these columns:

1. Current registry state (`productionEnabled` + `adminValidationEnabled`).
2. Prompt / server state (per-family MCP-server classifier ship state).
3. Validator / schema state (audit-lint / L5 mechanization ship state).
4. Input requirements (key inventory; whether a `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` subset entry is required).
5. UI consumer (which surface renders the family).
6. Known failures (the canonical incident per family).
7. Doctrine risks (the binding doctrine clause per family).
8. Smoke plan (per-family smoke shape).
9. Load plan (per-family burst / PASS-LOAD posture).
10. `productionEnabled` blocker (the concrete reason it is `false` today + the named precondition to flip it).
11. Operator gate required (the named, LIVE issue that owns the operator decision).

The ledger consolidates facts that are today scattered across `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md`, `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`, the per-family audits, `docs/core/known-blockers.md`, and `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md`. A reviewer who wants "what blocks H retry / I Card 1 / any J card?" should be able to answer it from this one matrix.

---

## Non-goals

- Does NOT touch `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — no `productionEnabled` flip.
- Does NOT touch `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` — no `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` change.
- Does NOT touch any migration in `supabase/migrations/**`, any Edge Function in `supabase/functions/**`, or any file under `mcp-server/**`.
- Does NOT advance H retry, I Card 1, or any J card.
- Does NOT lower any bar, change any guard, change any threshold, or modify any failing test/lint to pass (§4-T).
- Does NOT include any acceptance criterion of the form "when ledger is green, advance" — advancement stays operator-gated.
- Does NOT reopen, redesign, or re-litigate #371 or #373. The Deno-KV global limiter is recorded-rejected; the ARCH-001 Postgres async classifier queue is the chosen path (`docs/designs/OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md:3-7,26`; `docs/core/known-blockers.md:556`).
- Does NOT propose moving any renderer / validator / classifier logic from `scripts/bot-fixtures/` into `src/` (would violate doctrine §7 — no AI from the production app).

---

## Current production state

At HEAD `37ccd9e`, the family registry (`supabase/functions/_shared/booleanObservations/familyRegistry.ts:68-119`) holds 10 families. Families **A–G** (`parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`, `critical_question`, `resolution_progress`) are `productionEnabled: true` + `adminValidationEnabled: true` (`familyRegistry.ts:69-103`). Families **H / I / J** are `productionEnabled: false` + `adminValidationEnabled: true`:

| Family | Registry name | `productionEnabled` | `adminValidationEnabled` | Cite |
|---|---|---|---|---|
| H | `claim_clarity` | **false** | true | `familyRegistry.ts:106` |
| I | `thread_topology` | **false** | true | `familyRegistry.ts:111` |
| J | `sensitive_composer` | **false** | true | `familyRegistry.ts:116` |

`adminValidationEnabled: true` means all three families run in the **admin-validation** path only (the dormant `admin_validation` run mode), never on the production auto-trigger path. No H/I/J observation reaches a production user-facing surface today. Routing baseline is OFF: `CLASSIFIER_QUEUE_ROUTING_ENABLED` reads via strict `=== "true"` (unset ⇒ false) and `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` fail-closes to 0 (`supabase/functions/submit-argument/index.ts:811-816`; `classifierQueueRouting.ts:89-98`).

---

## RCA / problem summary

**Problem (organizational, not a code defect):** H/I/J readiness state is fragmented. The answer to "what blocks each frozen family from production?" requires cross-walking at least four documents plus the registry source. There is no single matrix that lets a reviewer or operator read off the registry state, server/validator state, input requirements, known failure, doctrine risk, and the named operator gate per family. This card resolves the fragmentation by writing that matrix once.

**Why now:** H Card 3 (the production-enable attempt) merged as PR #405, was smoke-FAILed (PR #407 audit `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md`), and was rolled back (PR #408 — `docs/reviews/REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE.md:15,37`). H retry is now gated behind a three-conjunctive-condition operator gate (E#7 below). Three scoping cards (#472 MCP-H-001, #473 J scoping, #478 MCP-I-SCOPE-001) are now LIVE. A ledger lets those cards share one canonical state map instead of each re-deriving it.

**This is not a capacity RCA.** The provider-capacity incident (#371 per-isolate cap, #373 Deno-KV limiter) is resolved off-path by the ARCH-001 Postgres async classifier queue (`docs/core/known-blockers.md:552,556`). That history is recorded-and-closed; this card neither reopens nor re-litigates it.

---

## Why this is or is not a ceiling/limit

This is **not a ceiling**. It is an organizational consolidation, not an architectural limit. No throughput, latency, schema, or family-count limit is being raised or lowered. The ledger is a passive read of existing state; it adds no runtime path and changes no flag. The only "ceiling" it touches is documentary — it makes the existing frozen-set boundary easier to read, and it deliberately re-states (does not weaken) that boundary.

The frozen-set boundary itself is a hard limit this card respects: **H/I/J stay `productionEnabled: false`.** No card in this family flips that flag, arms routing, or raises the routing percentage (`docs/core/known-blockers.md:579-582`; Phase 0 risk `FROZEN-SET BOUNDARY`).

---

## Architecture options considered

**Option A — one matrix doc (CHOSEN).** A single Markdown ledger with one row per family and the 11 columns. Pros: single source of truth; docs-only; auto-merge-eligible; zero runtime surface. Cons: must be kept in sync by hand when a family advances (mitigated by per-row "verified-at-HEAD" discipline and the citation test).

**Option B — extend an existing status doc** (`OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md`). Rejected: that doc is the canonical architecture-status narrative; bolting a per-family readiness matrix onto it would blur its purpose and create two competing "status" surfaces. The ledger cross-links to it instead of replacing it.

**Option C — a machine-readable registry annotation** (extend `familyRegistry.ts` with a `readiness` field). Rejected hard: touching `familyRegistry.ts` is a §4-C self-approval surface (it is the production-enable flag file). A docs card must not edit it. Out of scope and doctrinally forbidden for this card.

**Option D — an admin UI panel that renders readiness.** Rejected for this card: that is a future surface card with its own §9 plain-language mapping, §10a discipline, and tests. The ledger documents what such a card would consume; it does not build it.

---

## Chosen architecture

**Option A — a single inventory matrix doc** (this file). The matrix is the deliverable. Each row is sourced verbatim from existing artifacts; no new facts are invented. Each cell carries a `file:line` or Phase 0 fact-key citation. The "operator gate required" column points at a **LIVE GitHub issue** (#472 / #473 / #478) so the gate is actionable, not just an intent doc.

### The matrix

#### Row H — `claim_clarity`

| Column | State at HEAD `37ccd9e` | Cite |
|---|---|---|
| **1. Registry state** | `productionEnabled: false`, `adminValidationEnabled: true` | `familyRegistry.ts:106-107` |
| **2. Prompt / server state** | Card 1 SHIPPED — per-family `claim_clarity` classifier on the MCP server (admin_validation classifier). | PR #400 (`92d4ebe`-lineage; CLAUDE.md Stage 6.x line) |
| **3. Validator / schema state** | Card 2 SHIPPED — L5 audit-lint mechanization for `family_h`. Audit smoke PASS. | PR #403 (Card 2/3), PR #404 (smoke PASS 5/5 + L5 teeth) |
| **4. Input requirements** | Source-uniform `ai_classifier` (12 keys). **No** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` subset entry required (absence ⇒ full registry passthrough). | `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:73`; `booleanObservationRequestBuilder.ts:62` |
| **5. UI consumer** | Admin-validation table only today. No production user-facing surface (registry-gated). | `familyRegistry.ts:106` (production gate) |
| **6. Known failures** | Card 3 production-enable merged (PR #405) → smoke FAIL (audit PR #407) → ROLLED BACK (PR #408). The 8-family production surface failed under burst. | `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md`; `docs/reviews/REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE.md:15,37` |
| **7. Doctrine risks** | Every H key is a **structural Observation, never a verdict** (`claim_specificity_low` = "broad claim", not "weak"; `conclusion_missing` = "no explicit conclusion", not "incomplete"). §1 / §4 bind. | `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:191-192` |
| **8. Smoke plan** | Per-family smoke per the H-enable SMOKE template (canary-then-burst), but smoke PASS is **necessary-but-not-sufficient** — P1 real-organic precondition must precede it. | `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md`; cutover §10/§104 |
| **9. Load plan** | E#7 three-conjunctive-condition retry gate (below). H/I/J carry a zero-terminal-failure bar (E#11). | `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:78,82,104` |
| **10. `productionEnabled` blocker** | `false` because the 8-family burst surface FAILed and the retry preconditions are unmet. Precondition to flip: satisfy E#7 (all three conditions) + clean Card-3 re-run smoke. | `familyRegistry.ts:106`; cutover §78 |
| **11. Operator gate required** | **#472 MCP-H-001** (Family H scoping / retry design — GATE A only). The retry decision lives there, not here. | gh issue #472 (OPEN) |

**E#7 — H retry gate (three conjunctive conditions, ALL required):** (a) a non-H PASS-LOAD; (b) a separate operator decision; (c) provider/server reliability proven at higher (8-family) load **and** a clean Card-3 re-run smoke. The non-H PASS-LOAD alone does NOT unblock H. P1 (A–G stable at higher % with **real organic** evidence) is an ordered precondition that must precede the H synthetic smoke (`OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:78,104`).

#### Row I — `thread_topology`

| Column | State at HEAD `37ccd9e` | Cite |
|---|---|---|
| **1. Registry state** | `productionEnabled: false`, `adminValidationEnabled: true` | `familyRegistry.ts:111-112` |
| **2. Prompt / server state** | Cards 1/2/3 **never attempted**. Intent doc only. | `docs/designs/MCP-SERVER-010-FAMILY-I-intent.md` (intent only) |
| **3. Validator / schema state** | No L5 audit-lint mechanization shipped (Card 2 unshipped). | intent-only state |
| **4. Input requirements** | **Mixed-source** family. Production-enable **MUST** add `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] = new Set(['ai_classifier'])` to `booleanObservationRequestBuilder.ts`. This is the **HALT-13 inverse**: today only `evidence_source_chain` (D) and `resolution_progress` (G) have subset entries; `thread_topology` is **absent**, and "absence ⇒ full registry passthrough" — so enabling I without the entry would send deterministic keys the MCP server rejects → `mcp_validation_failed`. | `booleanObservationRequestBuilder.ts:68-78` (D + G only; comment line 62); MEMORY note `mcp-mixed-source-family-edge-subset` |
| **5. UI consumer** | Admin-validation table only today. No production surface. | `familyRegistry.ts:111` |
| **6. Known failures** | None (never attempted in production). The only recorded I risk is the mixed-source subset trap above, which is a design hazard, not an incident. | Phase 0 `family_I_card_status_NEVER_ATTEMPTED` |
| **7. Doctrine risks** | Every I key is a structural topology Observation, never a verdict (`ignored_by_both` = a reply-state topology fact, not a verdict on the contribution). §1 / §3 / §4 bind. | `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:191-192` |
| **8. Smoke plan** | Would mirror the family-enable SMOKE template once Cards 1/2 exist; not yet drafted. | (unshipped) |
| **9. Load plan** | Chained behind H stable; same E#11 zero-terminal bar applies when attempted. | `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:82` |
| **10. `productionEnabled` blocker** | `false` because Cards 1/2/3 are unbuilt **and** the mixed-source subset entry is missing **and** I is chained behind H stable. | `familyRegistry.ts:111`; `MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md` |
| **11. Operator gate required** | **#478 MCP-I-SCOPE-001** (Family I scoping design — parallel to H #472 / J #473). | gh issue #478 (OPEN) |

#### Row J — `sensitive_composer`

| Column | State at HEAD `37ccd9e` | Cite |
|---|---|---|
| **1. Registry state** | `productionEnabled: false`, `adminValidationEnabled: true` | `familyRegistry.ts:116-117` |
| **2. Prompt / server state** | No production-enable card under current disposition. Scoping audit verdict **N=0** — no J production-enable card is to be filed under the present disposition. | `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md`; roadmap §5.3 |
| **3. Validator / schema state** | N/A under current disposition (no production validator path; the disposition gate is the safety surface). | roadmap §5.3 |
| **4. Input requirements** | Source-uniform `semantic_referee` (5 keys: 3 composer_only + 2 inspect_only). **No** subset entry required. | roadmap §6 |
| **5. UI consumer** | **Composer-only** for the sensitive keys; `inspect`-only for the two `inspect_only` keys. **Never** on the target's node. | §10a (verbatim below); roadmap §6 |
| **6. Known failures** | None. The scoping audit ratified the resting state (N=0) — `#398` closed, PR #406. Not an incident; the finished state. | roadmap §5.3; Phase 0 dedup `MCP-J-001` |
| **7. Doctrine risks** | **§10a load-bearing.** Sensitive Observations (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`) render **composer-only — never on the target's node — because surfacing them publicly reads as accusation**. `uses_popularity_as_evidence` / `uses_satire_as_evidence` are `inspect_only` informational (§3). No verdict, no intent claim. | §10a; roadmap §6 |
| **8. Smoke plan** | N/A — no production surface to smoke under current disposition. Any future surface gets its own smoke + a fresh §10a doctrine review (P4). | roadmap §5.3 |
| **9. Load plan** | N/A under current disposition. Three concentric gates enforce surface routing today: Edge `productionEnabled: false` + persistence-adapter surface acceptlist + presentation-layer disposition switch. | roadmap §5.3 / §6 |
| **10. `productionEnabled` blocker** | `false` **by design / resting state**, not by a missing build. The scoping verdict is N=0: J is intentionally OFF and that is the finished state. Flipping it would require a NEW operator doctrine change introducing a NEW J surface + fresh P4 doctrine review — **not a registry flip**. | roadmap §5.3 |
| **11. Operator gate required** | **#473** (Family J scoping design — deepen ratified N=0 disposition). Any future J surface is a NEW doctrine-reviewed card, not an advancement of this ledger. | gh issue #473 (OPEN) |

**§10a verbatim (binding on Row J):**

> "Sensitive Observations (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`) render composer-only — never on the target's node — because surfacing them publicly reads as accusation."

---

## Data model (if relevant)

Not relevant. This card introduces no schema, no column, no table, no migration. It reads the existing frozen `FAMILY_REGISTRY` (`familyRegistry.ts:68`, `Object.freeze`) as data; it does not extend it. No `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry is added (that is an I-enablement action owned by #478, explicitly out of scope here).

---

## Worker/drainer model (if relevant)

Not relevant. No worker, no drainer, no queue path is touched. For completeness the ledger records (but does not modify) that production classification for the enabled A–G families runs off the synchronous submit path via the ARCH-001 Postgres async classifier queue (drainer C=3, MAX_ATTEMPTS=4, backoff [30,120]s — `docs/core/known-blockers.md:556`); H/I/J are never enqueued because `enqueueClassifierJobs` enqueues one row per `productionEnabledFamilies()` only (`classifierQueueRouting.ts:228-255`).

---

## Liveness and observability

No new liveness or observability surface. The ledger is a static document. Its only "observability" property is self-checking: two test files (below) assert the doc's ban-list cleanliness and citation validity, so drift is caught in CI rather than by manual review. The ledger does NOT consume `failure_detail` and does NOT add an admin panel — that is #470 OPS-MCP-OBSERVABILITY-002's surface, cross-linked but not built here.

---

## Cutover and rollback path

**Cutover:** none. This is a docs-only addition. There is no runtime cutover, no flag arm, no deploy.

**Rollback:** trivial. Reverting the PR deletes one Markdown file and two test files. No state, no data, no schema, no flag is affected. Because the card touches neither `supabase/functions/**` nor `supabase/migrations/**` nor `mcp-server/**`, merge is **NOT a deploy** (`docs/core/pipeline-governance-contract.md:108-127`).

---

## Smoke plan

No runtime smoke (no runtime surface). The "smoke" for this card is the gate triad:

1. `npm run typecheck` exits 0.
2. `npm run lint` exits 0.
3. `npm run test` exits 0 with the test count UP (the two new doc tests added, no existing test removed/loosened).

Each gate must be confirmed by a captured exit code (`; echo "EXIT: $?"`), not a tailed partial (test-discipline gate-timeout rule).

---

## Open questions

1. **Doc path naming.** This card writes `docs/designs/MCP-HIJ-000-READINESS-LEDGER.md` (this file). The original issue #471 body (acceptance-criterion line) names the artifact `docs/designs/MCP-HIJ-READINESS-LEDGER.md`. The refinement comment resolves this to the `MCP-HIJ-000-` prefixed path for consistency with the card code. Operator to confirm no other doc hard-links the un-prefixed path. *(Non-blocking — the citation test references this file's own path.)*
2. **I key inventory exact counts.** The roadmap states I as mixed-source (`auto_metadata` + `lifecycle` + `ai_classifier`); the exact per-source key counts (the predecessor body cited 8+7+6) should be re-confirmed against the Family-I definition file at I-Card-1 time, since no Family-I definition file is shipped at HEAD `37ccd9e` to verify the split directly. Named here rather than invented. *(Owned by #478.)*
3. **J `#398`/PR #406 provenance.** The N=0 ratification is cited from the roadmap and the scoping audit. The exact PR number (#406) is carried from the Phase 0 dedup finding for `MCP-J-001`; if the operator wants the ledger to hard-cite the PR merge SHA, that is a one-line addition at implement time.

---

## Stage gates before implementation

Per `docs/core/pipeline-governance-contract.md` §2 stage machine: **Phase 0 → DESIGN → GATE A → IMPLEMENT → GATE B → REVIEW → GATE C**.

- **Phase 0:** complete (fact bundle verified; all 9 §5 state items confirmed `allStateConfirmed=true`).
- **DESIGN:** this document. Read-only. Operator approves at **GATE A**.
- **IMPLEMENT:** docs-only diff — adds this doc + 2 test files. No source, schema, Edge, or `mcp-server/**` change.
- **GATE B:** agent runs the gate triad, opens PR, does NOT self-merge.
- **REVIEW:** roadmap-reviewer verifies ban-list, citations, §10a J-row discipline, and that no `productionEnabled` flag is touched.
- **GATE C:** docs-only + test-only PR. Touches no deploy surface and no §4 surface. **Auto-merge eligible** after GATE B + REVIEW PASS. `requiresMigration` / `requiresEdgeDeploy` / `requiresOperatorGateC` all **false**.

§4 never-self-approve respected: this card does not change any failing guard/test/lint to pass, does not lower any bar (§4-T), does not flip the family registry (§4-C forbids the production-enable flag flip), does not arm routing or secrets, does not advance 5%/ramp.

---

## Commit-slice plan

Single slice (docs + its tests are one logical unit):

1. **Slice 1 (the only slice):** add `docs/designs/MCP-HIJ-000-READINESS-LEDGER.md` + `__tests__/docs/mcpHijReadinessLedgerBanList.test.ts` + `__tests__/docs/mcpHijReadinessLedgerCitations.test.ts`. One commit, one PR. No reason to split — tests and doc must land together so the doc is never committed without its CI guard.

---

## Test-count forecast

Baseline (test-discipline skill): **630 suites / 19263 passing / 1 skipped / 19264 total on main.**

This card adds **+2 suites** and **+~6–10 tests** (ban-list scan + HARD-RULE-present + disclaimer-present in suite 1; path-exists + line-in-range citation checks in suite 2). No existing test is removed, skipped, or loosened. Expected post-merge: ~632 suites / ~19271–19273 passing, 1 skipped.

*(Note: the existing #471 issue body and CLAUDE.md Stage 6.4 line quote a 1805/70 baseline; the binding baseline for this card is the test-discipline skill's current main count of 630/19263. The implementer captures the real `Test Suites: … / Tests: …` line with an explicit exit code and reconciles before claiming the count.)*

---

## HALT ceiling

HALT and refuse to proceed if any of the following is true:

- Any diff would flip `productionEnabled` from `false` to `true` for H, I, or J (`familyRegistry.ts:106/111/116`) — frozen-set breach.
- Any diff would add or modify a `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry (that is an I-enablement action owned by #478, not this card).
- Any diff would arm routing (`CLASSIFIER_QUEUE_ROUTING_ENABLED`) or raise the routing percentage.
- The doc or its issue body would re-litigate, reopen, or redesign #371 / #373 (recorded-rejected; do-not-re-litigate).
- The doc would assert a "green ledger row authorizes advancement" semantics (forbidden by the HARD RULE).
- Any ban-list token (winner / loser / liar / dishonest / bad faith / manipulative / extremist / propagandist / stupid / idiot) appears in the doc.
- A gate exits non-zero, or a gate result is INDETERMINATE (tool-wrapper timeout) and was not re-run to a captured exit code.

---

## Current-status manifest stub

- **MODIFIED:** `docs/core/current-status.md` (one ledger line noting MCP-HIJ-000 readiness ledger added; advancement-neutral, no flag flipped).
- **NEW:** `docs/designs/MCP-HIJ-000-READINESS-LEDGER.md`; `__tests__/docs/mcpHijReadinessLedgerBanList.test.ts`; `__tests__/docs/mcpHijReadinessLedgerCitations.test.ts`.
- **BYTE-EQUAL preserved:** `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (no edit); `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` (no edit); all `supabase/migrations/**`; all `supabase/functions/**`; all `mcp-server/**`.
- **Test deltas:** +2 suites, +~6–10 tests; 0 removed; 0 skipped; 0 loosened.
- **Operator follow-up:** H retry remains gated on E#7 three conditions (#472); I Card 1 chained behind H stable + requires the mixed-source subset entry (#478); J stays at ratified N=0, any new surface is a NEW P4-doctrine-reviewed card (#473). None unblocked by this ledger.
- **Discipline line:** design-only; no secret printed; frozen set (H/I/J `productionEnabled:false`) untouched; every cite verified at HEAD `37ccd9e`.

---

## Required-reading manifest for the later build phase

The implementer of MCP-HIJ-000 must read, before writing the doc + tests:

1. `supabase/functions/_shared/booleanObservations/familyRegistry.ts:68-119` — the frozen registry (rows 1 of the matrix).
2. `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts:60-89,140-154` — the `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` mechanism (I-row HALT-13 inverse).
3. `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:61,78,82,104` — the E#7 / E#11 gates + the frozen H/I/J statement.
4. `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` + `docs/reviews/REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE.md:15,37` — the H Card 3 FAIL + rollback (Row H known-failure).
5. `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` + `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:§5.3,§6` (lines ~171-192) — the J N=0 verdict + §10a doctrine.
6. `docs/core/known-blockers.md:552,556,579-582` — capacity resolved by ARCH-001 (do-not-re-litigate #371/#373) + H/I/J FROZEN.
7. `.claude/skills/cdiscourse-doctrine` §1/§3/§4/§4-C/§4-T/§10a and `.claude/skills/test-discipline` — doctrine + test bar.
8. `docs/core/pipeline-governance-contract.md` §2/§4/§5 — stage machine, never-self-approve, merge=deploy.
9. LIVE cross-link issues: #472 (MCP-H-001), #473 (J scoping), #478 (MCP-I-SCOPE-001) — the "operator gate required" targets.

---

## Sources (every concrete claim → citation)

| Claim | Citation |
|---|---|
| H/I/J `productionEnabled:false` today | `familyRegistry.ts:106` (H), `:111` (I), `:116` (J) |
| A–G `productionEnabled:true` | `familyRegistry.ts:69-103` |
| Registry is frozen | `familyRegistry.ts:68` (`Object.freeze`) |
| Routing baseline OFF | `submit-argument/index.ts:811-816`; `classifierQueueRouting.ts:89-98` |
| H Card 1 shipped | PR #400 |
| H Card 2 L5 shipped + audit PASS | PR #403, PR #404 |
| H Card 3 merged then rolled back after smoke FAIL | PR #405 → PR #407 (FAIL audit) → PR #408; `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md`; `docs/reviews/REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE.md:15,37` |
| H source-uniform `ai_classifier`, no subset entry | roadmap `:73`; `booleanObservationRequestBuilder.ts:62` |
| H retry = E#7 three conjunctive conditions | `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:78,104` |
| H/I/J zero-terminal bar (E#11) | `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:82` |
| I Cards 1/2/3 never attempted | `docs/designs/MCP-SERVER-010-FAMILY-I-intent.md`; Phase 0 `family_I_card_status_NEVER_ATTEMPTED` |
| I mixed-source requires `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology']` entry (HALT-13 inverse) | `booleanObservationRequestBuilder.ts:68-78` (only D + G present; comment `:62` "absence = full registry passthrough"); MEMORY `mcp-mixed-source-family-edge-subset` |
| Current subset entries = D + G only | `booleanObservationRequestBuilder.ts:71,77` |
| J scoping verdict N=0 | `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md`; roadmap §5.3 |
| J §10a composer-only sensitive Observations | §10a verbatim; roadmap §6 (lines ~181-192) |
| J ratified N=0 (#398 / PR #406) | Phase 0 dedup finding `MCP-J-001`; roadmap §5.3 |
| H/I/J FROZEN | `docs/core/known-blockers.md:579-582` |
| Capacity solved by ARCH-001; #371/#373 superseded | `docs/core/known-blockers.md:552,556`; `OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md:3-7,26` |
| Merge-is-deploy rule (this card NOT a deploy) | `docs/core/pipeline-governance-contract.md:108-127` |
| Never-self-approve / family-flip forbidden | `docs/core/pipeline-governance-contract.md` §4; cdiscourse-doctrine §4-C |
| Cross-link operator gates | gh issue #472 (H), #478 (I), #473 (J) — all OPEN |
| Test baseline | test-discipline skill: 630 suites / 19263 passing / 1 skipped / 19264 total on main |
| HEAD hash | `git rev-parse HEAD` → `37ccd9ed027c625686f3eee517d03a48df25a29d` (`37ccd9e`) |

---

*End of MCP-HIJ-000 readiness ledger. This document enables no family, authorizes no advancement, and flips no `productionEnabled` flag. A green ledger row is NOT a gate-pass.*
