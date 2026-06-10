# MCP H / I / J scale-up — implementation program plan

**Type:** Program plan. DOCS-ONLY. Design / audit-plane only.
**Status:** PLAN (design draft). **This document authorizes no advancement.**
**Epic:** Epic 12 / MCP semantic-referee cutover.
**Author role:** roadmap-designer.
**Verified-at-HEAD:** `main` = `8046e08c6d02fa58541800d37f31556a42ac3462` (`8046e08`) == `origin/main`; 0 open PRs at authoring.
**Canonical gate reference (binding; do NOT restate-and-diverge):** `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`.
**Predecessor inventory (superseded for the I row):** `docs/designs/MCP-HIJ-000-READINESS-LEDGER.md` (verified at `37ccd9e`, now stale on Family I — see §1.3).
**Superseded source:** `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md` (its pass/load/ramp wording is historical; the canonical gate doc governs; its "Stage-1 armed at 1% on 2026-06-02" claim is contradicted by current behavioral evidence — see §3.2).

---

## 0. What this document is, and is not (HARD RULE)

This is a **program plan**: it sequences the work to scale the production classifier roster beyond the seven enabled families (A–G) toward Families **H (`claim_clarity`)**, **I (`thread_topology`)**, and **J (`sensitive_composer`)**, and it names the queue/arming and stale-row blockers that gate them. It is a map. The operator drives.

**This document, verbatim:**

> No row in this plan enables any family. No lane template, gate row, or recommendation auto-advances a family to production, arms routing, raises a routing percentage, flips a `productionEnabled` flag, or cleans a database row. A "green plan row" is NOT a gate-pass and does NOT authorize advancement. Advancement remains operator-gated per the canonical gate doc. One family at a time. Failure rolls back. **This plan forbids itself as an advancement authorization.**

**Constitutional acceptance-gate invariant (binding on every card this plan names):**

> The deterministic rules engine, `src/lib/constitution/engine.ts`, is the SOLE submission acceptance gate. Every MCP / classifier / mapping / queue / H-I-J path is **post-storage, display-only, advisory**. No classifier path may block, reject, route, or delay an ordinary user post. `submit-argument/index.ts` returns 201 BEFORE the dispatch/routing fork.

**Doctrine spine (applied throughout):** `cdiscourse-doctrine` §1 (no truth/verdict/author label; score never blocks posting), §3 (popularity/heat is not evidence), §4 (AI moderator is advisory, never authoritative, Edge-only), §6 (secrets), §9 (plain-language mapping), and **§10a (Observations vs Allegations** — machine outputs are Observations; sensitive Observations render composer-only, never on a target's node).

---

## 1. Verified current state

### 1.1 Repository + Build-2

- `main` = `8046e08` == `origin/main`. 0 open PRs at authoring time (`gh pr list --state open` → empty).
- **Build-2 Families A–G are complete:** all merged, Deno-live, hosted-smoked (39/39), and client-plane verified (#548 closeout + the CLIENT-PLANE VERIFY PASS comments). The most recent `main` commits confirm the Family-I MCP-server chain and the Family-B disagreement-axis Build-2 work landed (`bcce800` Family B, `4b9dabd` MCP-SERVER-010-FAMILY-I Card 1, `0e7dfd6` family_i audit-lint, `#550` Family-I Edge bridge).
- **Production roster today = A–G (7 families)**, each `productionEnabled: true` + `adminValidationEnabled: true` (`supabase/functions/_shared/booleanObservations/familyRegistry.ts:69-103`).

### 1.2 The acceptance-gate invariant is intact

`familyRegistry.ts` is read by the auto-trigger dispatcher at runtime; `productionEnabledFamilies()` (`familyRegistry.ts:162-166`) returns the A–G set. Routing to the async classifier queue is gated by a master flag with a strict `=== 'true'` posture and a fail-closed percentage (`classifierQueueRouting.ts:61,75-98,164-184`). None of this is an acceptance gate — submit returns 201 before the fork. Verified read-only this card.

### 1.3 The readiness ledger is STALE on the Family-I row

`docs/designs/MCP-HIJ-000-READINESS-LEDGER.md` (closed issue #471) was verified at `37ccd9e`, where it recorded Family I as "Cards 1/2/3 never attempted / intent doc only / mixed-source subset entry MISSING." **That is no longer true at `8046e08`:**

- Family I's MCP-server classifier shipped (Card 1, MCP-SERVER-010-FAMILY-I, `#546`) — the dispatcher now serves `thread_topology` (`mcp-server/tools/classifyArgumentBooleanObservations.ts:430`, comment `:54-56`).
- Family I's L5 audit-lint doctrine-risk mechanization shipped (Card 2, `#549`).
- Family I's Edge mixed-source bridge shipped (`#550`, MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET): `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] = Set(['ai_classifier'])` is **already present** (`booleanObservationRequestBuilder.ts:82-88`).

**Consequence for this plan:** the I production-enable card (#394) no longer "MUST add" the subset entry that the ledger and `MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md` describe — the entry is already there. #394's remaining surface is the one-character `productionEnabled` flip + test re-baselines + the production smoke. The subset entry **STAYS** (removing it is HALT-13-inverse for I). This plan supersedes the ledger's Row I; Rows H and J still hold.

### 1.4 Per-family verified facts (read-only this card)

| Fact | Evidence (file:line) |
|---|---|
| H/I/J `productionEnabled: false`, `adminValidationEnabled: true` | `familyRegistry.ts:106-107` (H), `:111-112` (I), `:116-117` (J) |
| H = 12 keys, uniform `ai_classifier` | `machineObservationDefinitions/familyH.ts` (12 `rawKey`, all `source: 'ai_classifier'`) |
| I = 21 keys (8 `auto_metadata` + 7 `lifecycle` + 6 `ai_classifier`) | `machineObservationDefinitions/familyI.ts` (21 key defs; source split 8/7/6) |
| J = 5 keys, uniform `semantic_referee` (3 `composer_only` + 2 `inspect_only`) | `machineObservationDefinitions/familyJ.ts` (5 `rawKey`, all `source: 'semantic_referee'`) |
| H + I served by MCP server; J returns `unsupported_family` | `mcp-server/tools/classifyArgumentBooleanObservations.ts:422` (H), `:430` (I), `:52-56` (J not implemented; future MCP-SERVER-011+) |
| Cap intact at 20 | `MAX_FLAGS_PER_RESPONSE = 20` (`mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:35`; mirror `supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts:151`) |
| Routing master flag default-disabled + fail-closed percentage | `classifierQueueRouting.ts:61,75-98,164-184` |

---

## 2. The H / I / J readiness matrix

One row per family. Every cell is a read-only fact at `8046e08` or a citation to the canonical gate doc. **No cell authorizes advancement.**

| Column | **H — `claim_clarity`** | **I — `thread_topology`** | **J — `sensitive_composer`** |
|---|---|---|---|
| **rawKey family id** | `claim_clarity` | `thread_topology` | `sensitive_composer` |
| **`productionEnabled`** | **false** (`familyRegistry.ts:106`) | **false** (`:111`) | **false** (`:116`) |
| **`adminValidationEnabled`** | true (`:107`) | true (`:112`) | true (`:117`) |
| **Key count** | **12** | **21** (MCP path = 6) | **5** |
| **Source breakdown** | 12 `ai_classifier` (uniform) | 8 `auto_metadata` + 7 `lifecycle` + 6 `ai_classifier` (mixed) | 5 `semantic_referee` (3 `composer_only` + 2 `inspect_only`) (uniform) |
| **MCP-server support** | IMPLEMENTED (`classify…:422`) | IMPLEMENTED (`classify…:430`, Card 1 #546) | **NOT implemented** — `unsupported_family` envelope (`classify…:52-56`); future MCP-SERVER-011+ |
| **Edge request-builder support** | Uniform → **no** subset entry needed (absence = full passthrough; adding one would be a defect) | **Subset entry PRESENT** (`booleanObservationRequestBuilder.ts:88`, #550) — 6 `ai_classifier` keys to MCP; 8+7 deterministic keys via NON-MCP deriver paths. STAYS. | No subset entry (uniform); not server-built |
| **Admin-validation live?** | Yes (admin server path) | Yes (admin server path + Edge bridge) | No — server returns `unsupported_family`; admin-validation is the BUILD target |
| **Under/over the 20-cap** | 12 ≤ 20 → **UNDER-CAP** | MCP path 6 ≤ 20 → **UNDER-CAP** | 5 ≤ 20 → **UNDER-CAP** |
| **Batching note** | **None needed.** Direct path (unlike D=19→2 batches / G=21→2 batches under #545). | **None needed.** Only the 6 `ai_classifier` keys hit the MCP path; 6 ≤ 20. Direct path. | **None needed** (if/when built; 5 ≤ 20). |
| **Smoke coverage today** | Card-1 + Card-2 admin smokes PASS; the production re-attempt smoke is the open piece (#407 smoke-failed → #408 rollback). | Card-1 hosted Deno smoke 25/25 (#392; checks 24/25 family-i-v1); production-enable smoke not yet run. | None (no production surface to smoke under current disposition). |
| **Doctrine-risk** | **HIGH** — claim-clarity keys must never read as a critique of author / intelligence / honesty / argument-quality. "Absence is not failure; broad scope is a SHAPE, not a defect." (`claim_specificity_low` = "broad claim", not "weak"; `conclusion_missing` = "no explicit conclusion", not "incomplete"). | **MEDIUM** (structural). Topology Observations only (`ignored_by_both` = a reply-state topology fact, never a verdict on the contribution). | **HIGHEST** — §10a composer-only sensitive Observations. The 3 `composer_only` keys render in the author's own composer ONLY, never on the target's node, because surfacing them publicly reads as accusation. The 2 `inspect_only` keys anchor §3 (popularity/satire are not evidence). |
| **L5 doctrine-risk mechanization** | `family_h` armed in `DOCTRINE_RISK_FAMILIES` (Card 2 shipped) | `family_i` armed (Card 2 shipped, #549) | N/A under current disposition |
| **Issue trail** | #472 (scoping/retry design, GATE-A) → later prod re-attempt; #396 (post-enable observability backfill) | #394 (production enable, Tier-3) ; #478 (scoping design); #397 (post-enable observability backfill) | #473 (scoping design — deepen ratified N=0); future MCP-SERVER-011+ build |
| **Blockers** | E#7 three conjunctive conditions (queue-armed non-H PASS-LOAD + separate operator decision + provider reliability at 8-family load + clean Card-3 re-run smoke); P1 real-organic precondition; **#523 stale rows** must be resolved first | `#394_BLOCKED_BY_H-not-stable` (chained behind H); same terminal-zero bar; subset entry must stay | Highest doctrine-risk; needs fresh MCP-server build → Deno redeploy → admin-validation; NEVER production without a separate §10a doctrine review |

### 2.1 Doctrine-risk one-liners (for the per-lane self-checks)

- **H:** structural shape Observations; no author-quality, no intelligence/honesty critique. Render verdict-free via `gameCopy.toPlainLanguage` (§9) and the node-label registry (§10a). Absence/breadth is a shape, never a defect.
- **I:** structural topology Observations about reply state and thread shape; no verdict on the contribution. The 8 `auto_metadata` + 7 `lifecycle` keys are deterministic derivations, not classifier opinions.
- **J:** the 3 `composer_only` keys are composer-only nudges to the author before posting; they never reach a target's node. The 2 `inspect_only` keys are informational `inspect`-surface only. No verdict, no intent claim. Publication always remains the author's decision (the chip never blocks posting).

---

## 3. Queue / ARCH-001 Card-3 readiness

### 3.1 State: `QUEUE_IMPLEMENTED_NOT_ARMED`

The ARCH-001 Postgres async classifier queue is built and applied on the live DB but DORMANT:

- Cards 1 / 2 / 2A shipped + applied (substrate, drainer + enqueue, atomic finalizer); the Card-3 cron-tick migration `20260608000001_arch_001_card3_cron_drain_tick.sql` merged (`#554`) and is applied on the live DB.
- The cron tick has a **null-URL guard** → it is a **silent no-op until the operator seeds Vault** (`docs/designs/ARCH-001-CARD3-PRODUCTION-SMOKE-STAGED-ROLLOUT.md` §1(a)).
- Routing flags default-off: `CLASSIFIER_QUEUE_ROUTING_ENABLED` (strict `=== 'true'`, unset ⇒ false) + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` (fail-closed to 0) (`classifierQueueRouting.ts:61,75-98`).
- Behavioral evidence of unarmed: the #479 corpus ran **all DIRECT-dispatch (0 queued)**, confirming routing is not armed.
- Burst RCA: `docs/rca/OPS-MCP-AUTOTRIGGER-BURST-PROVIDER-NETWORK-ERROR-RCA-2026-06-08.md` (the queue is the durable fix for the ~96%-loss-under-burst failure mode).

### 3.2 The stale "armed at 1%" claim — operator-confirm at the arming gate

`docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md` §0 states the cutover was "armed `2026-06-02T07:50:54Z`, Stage-1 1%, window still open." **That claim is STALE / superseded.** Current behavioral evidence (the #479 corpus all-direct, the null-URL-guarded dormant cron, the default-off flags) shows the queue is **unarmed**. This plan does NOT resolve the discrepancy; it **flags it as an operator-confirm at the arming gate (DP-1/2/3 + the staged-arm runbook)**: before arming, the operator must confirm the live flag state and reconcile the 2026-06-02 claim against `SELECT * FROM cron.job` + the routing env.

### 3.3 Arming is ARCH-001 Card-3 GATE-C (operator)

Per `docs/runbooks/ARCH-001-CARD3-staged-arm-runbook.md`: confirm DP-1 (Anthropic tier; recommend Tier 1 / C=3), DP-2 (Edge plan; T=90s vs 150s floor), DP-3 (pg_cron 60s `* * * * *`, one job); seed the two Vault secrets (call SHAPE only — never a real value); arm smoke-tag-first (`ENABLED=true`, `PERCENTAGE=0` — routes only `[arch-001-queue-smoke]` titles, 0% organic); run the §3 smoke (canary → N=56). **PASS-LOAD = 0 terminal dead-letters at N=56** (8 args × 7 families) + structural gates. PASS-LOAD-CONFIRM = a second consecutive independent N=56 drill (all 15 gates). The canonical gate doc §A/§B/§C/§F governs every threshold; this plan cites it and does not diverge.

---

## 4. Blocker classifications (carried verbatim)

### 4.1 `QUEUE_IMPLEMENTED_NOT_ARMED` (see §3)

Queue built + applied + dormant; flags default-off; #479 all-direct confirms unarmed. The 2026-06-02 "armed at 1%" roadmap claim is stale → operator-confirm at the arming gate.

### 4.2 `STALE_H_ROWS_CONFIRMED` (#523)

`OPS-TRIPWIRE-CLAIM-CLARITY-001` (#523, OPEN) is FIRING: **7 `claim_clarity` (Family H) production-success rows from 2026-06-01 01:20–01:24Z** — the rolled-back #407 H-enable attempt. This is **NOT a live producer bug**; the tripwire counts all-time, so it fires on the historical rows. Two candidate fixes:

1. **Tripwire time-window** (src) — scope the tripwire to post-arm rows so historical rows don't fire it; OR
2. **Cleanup the 7 stale rows** (operator-gated Supabase) — with **read-only proof first** (exact 7-row identification + before/after counts), never a blind delete.

**This plan does NOT delete any row.** It recommends resolving #523 BEFORE any H production flip, because once H is production-enabled, `claim_clarity` production rows become EXPECTED and the tripwire can no longer cleanly distinguish stale rows from a real producer regression. Recommended disposition: prefer the tripwire time-window fix (no data mutation) unless the operator chooses cleanup with read-only proof.

### 4.3 `#394_BLOCKED_BY_H-not-stable` (#394)

Family I production enable (#394, Tier-3, "Authorized, not started" per `MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md`) is **chained behind H-stable**. H is gated on queue-armed PASS-LOAD + #523 resolved + the H re-attempt (E#7). Therefore I cannot proceed until H is stable in production under its own observation window. Enabling I before H would re-expose the provider-reliability surface at a 9-family load (strictly worse than the 8-family load that already failed its smoke).

---

## 5. Per-family implementation cards + the gate structure

### 5.0 Gate vocabulary (used per lane below)

| Gate | What it means here |
|---|---|
| **GATE-A (design)** | roadmap-designer writes the scoping/retry/build design; operator approves. No code. |
| **GATE-MERGE** | implementer green (typecheck/lint/test exit 0, count UP, byte-equality of untouched files), reviewer PASS, squash-merge. For docs/test-only PRs, merge is NOT a deploy. |
| **GATE-DENO-REDEPLOY** | `mcp-server/**` is a Deno Deploy target (NOT a Supabase Edge fn). A server build (J, or any prompt/key change) is deploy-bearing: it requires the Deno redeploy + a hosted `*.deno.net` smoke before the new behavior is live. H + I are already Deno-live; J is not built. |
| **GATE-SPEND** | operator-gated provider-spend smoke (the Anthropic-bearing admin-validation / production smoke). Never auto-run. |
| **GATE-ARM** | operator flips the env / `productionEnabled` flag / arms routing. Tier-3 never-self-approve (production-enable, merge-as-deploy, arming). |
| **Tier-3** | the highest never-self-approve tier per the pipeline governance contract: production-enable, deploy, arm routing, ramp, H/I/J. The agent NEVER self-approves these. |

### 5.1 Family H — `claim_clarity` production re-attempt

- **Build state:** MCP server + admin-validation + L5 already shipped. The open piece is the **production RE-ATTEMPT** (the #407 flip smoke-failed at the 8-family load → #408 rollback).
- **#472 (GATE-A only):** the scoping / retry design. This plan does NOT do #472's work; it names it.
- **Gate structure:** GATE-A (#472 design) → [precondition: queue-armed non-H PASS-LOAD + #523 resolved] → the H production-enable card (one-char flip `claim_clarity` `false→true` + sibling-count re-baselines `SEVEN→EIGHT` + restore `edgeFamilyHProductionEnable.test.ts`; **no** subset entry — H is uniform) → GATE-MERGE → GATE-SPEND (canary-then-burst H smoke, 8-family load, terminal-zero) → GATE-ARM (Tier-3 operator flip) → its own observation window → A–H clean before I is considered.
- **E#7 gate (three conjunctive conditions, ALL required — canonical doc §E item 7 / §F item 3):** (a) a non-H PASS-LOAD; (b) a separate operator decision; (c) provider/server reliability proven at the higher 8-family load + a clean Card-3 re-run smoke. The non-H PASS-LOAD alone does NOT unblock H. P1 (A–G stable at a higher % with **real organic** evidence) is an ordered precondition that must precede the H synthetic smoke; synthetic PASS is necessary-but-not-sufficient.

### 5.2 Family I — `thread_topology` production enable (#394)

- **Build state:** MCP server + Edge subset bridge + L5 already shipped (§1.3). This is a **production-enable / staged-rollout RUNBOOK, NOT a fresh classifier build.**
- **#394 (Tier-3, "Authorized, not started"):** the production-enable card. Scope reduces to: one-char flip `thread_topology` `false→true` + sibling-count re-baselines `EIGHT→NINE` + `edgeFamilyIProductionEnable.test.ts`. **The subset entry STAYS** (already present; removing it is HALT-13-inverse).
- **Gate structure:** [precondition: H stable in production, its window clean] → GATE-A (#478 scoping confirms; #394 design) → the flip card → GATE-MERGE → GATE-SPEND (canary-then-burst I smoke, 9-family load; verify the mixed-source subset filter holds — zero deterministic-key leak into the MCP path, zero `mcp_validation_failed` from `unsupported_rawKey`; terminal-zero) → GATE-ARM (Tier-3) → its own observation window.
- **Blocker:** `#394_BLOCKED_BY_H-not-stable` (§4.3). No I work before H is stable.

### 5.3 Family J — `sensitive_composer` design → admin-validation BUILD

- **Build state:** NOT server-implemented. Needs a fresh DESIGN (#473) → a fresh MCP-server build (MCP-SERVER-011+) → Deno redeploy → admin-validation. Production is **out of scope under the current disposition** (the OPS-FAMILY-J-SCOPING-AUDIT ratified N=0).
- **#473 (GATE-A):** scoping design — deepen the ratified N=0 disposition; specify the composer-only / inspect-only surface contract per §10a.
- **Gate structure:** GATE-A (#473 design + a §10a doctrine review) → MCP-server build card (MCP-SERVER-011+) → GATE-MERGE → GATE-DENO-REDEPLOY (hosted `*.deno.net` smoke) → GATE-SPEND (admin-validation smoke only) → **STOP at admin-validation.** Production-enable is NEVER reached under the current disposition; any future J production surface is a NEW doctrine-reviewed card (a fresh P4 §10a review), not a registry flip.
- **Doctrine gate:** the 3 `composer_only` keys must render composer-only; a J key reaching a target's public node is a doctrine violation, full stop.

---

## 6. Lane dependency graph + recommended lane order

### 6.1 Dependency graph

```
ARCH-001 Card-3 GATE-C arming (Template A)
        │  produces: non-H PASS-LOAD (+ CONFIRM) — E#7 condition (a) + part of (c)
        ▼
#523 stale-H-rows resolution (Template B)  ──[independent; can run in parallel,
        │                                      but MUST precede the H flip]
        ▼
Family H production re-attempt (Template C)  ──requires: E#7 (a)+(b)+(c) + P1 organic + #523 resolved
        │  produces: A–H stable under H's own observation window
        ▼
Family I #394 production enable (Template D, Tier-3)  ──blocked by H-not-stable
        │
        ▼
Family J design → admin-validation (Template E)  ──independent of H/I production;
                                                   build-state gated (unbuilt); NEVER production here
```

J's design/build lane is **independent** of the H→I production chain (it touches a different build-state and a different gate set), so it MAY proceed in parallel at the design/admin-validation level — but it must NEVER cross into production under the current disposition.

### 6.2 Recommended lane order (generated from the verified state)

1. **Lane A — ARCH-001 Card-3 GATE-C arming (Template A).** Foundational: H's E#7 condition (a) requires a non-H PASS-LOAD, which requires the queue armed (smoke-tag arm → N=56 PASS-LOAD + CONFIRM). Resolve the stale "armed at 1%" discrepancy (§3.2) at this gate.
2. **Lane B — #523 stale-H-rows resolution (Template B).** Independent of arming; can run in parallel. MUST land before the H flip so the leakage tripwire is a true producer-bug detector during the H window.
3. **Lane C — Family H production re-attempt (Template C).** H's admin server already exists; the open piece is the production re-attempt. Gated on Lane A's PASS-LOAD + Lane B + E#7 + P1 organic.
4. **Lane D — Family I #394 production enable (Template D, Tier-3).** Chained behind H-stable. Runbook, not a fresh build (subset entry already present).
5. **Lane E — Family J design → admin-validation (Template E).** Fresh design (#473) → MCP-SERVER-011+ build → Deno redeploy → admin-validation. STOPS at admin-validation; never production under current disposition.
6. **Later — H/J production posture.** H production stabilizes under its window before I; J never reaches production under the current disposition (a future J production surface is a separate doctrine-reviewed card).

---

## 7. Lane templates

Each template covers **ONE family or ONE blocker**. Phases + gates per lane. None is an authorization.

### Template A — Queue arming (ARCH-001 Card-3 GATE-C)

| Phase | Action | Gate / proof |
|---|---|---|
| A0 | Confirm preconditions: 4-card substrate applied; drainer deployed; routing default-disabled. Reconcile the stale "armed at 1%" claim (§3.2) against `SELECT * FROM cron.job` + the routing env. | Operator-confirm; live-state read. |
| A1 | Confirm DP-1 (Anthropic tier → C=3), DP-2 (Edge plan → T=90s), DP-3 (pg_cron 60s, one job). | `cron.job` shows exactly one tick. |
| A2 | Seed the two Vault secrets (`arch_001_classifier_drainer_url` + `_secret`) — call SHAPE only; the `<shared-secret>` must equal `CLASSIFIER_DRAIN_SHARED_SECRET`. | One manual tick → a `classifier_drain_audit` row. |
| A3 | Smoke-tag arm: `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `PERCENTAGE=0` (routes only `[arch-001-queue-smoke]`, 0% organic). | GATE-ARM (Tier-3). |
| A4 | Run the production smoke: canary (7 A–G rows, 0 H/I/J, all `succeeded`; HALT on any `family=NULL`) → N=56 burst. | **PASS-LOAD = 0 terminal dead-letters at N=56** + structural gates (dup=0, overlap=0, family=NULL=0, 0 H/I/J, submit nonblocking, leak-safe). PASS-LOAD-CONFIRM = second consecutive independent N=56 (all 15 gates). |
| A5 | Record verdict in `docs/audits/ARCH-001-CARD3-SMOKE-<date>.md`. Percentage ramp (1→5→…) is a SEPARATE operator card per step, gated on real organic evidence. | Canonical doc §C — no auto-ladder. |

### Template B — #523 stale-H-rows resolution

| Phase | Action | Gate / proof |
|---|---|---|
| B0 | Read-only proof: identify the exact 7 `claim_clarity` production-success rows (2026-06-01 01:20–01:24Z) + before counts. | Read-only query output; no mutation. |
| B1 | Choose disposition: **(1) tripwire time-window fix** (src; no data mutation; preferred) OR **(2) cleanup the 7 rows** (operator-gated Supabase, with before/after counts). | GATE-A design decision (operator). |
| B2a (if 1) | Implement the time-window so the tripwire scopes to post-arm rows. Tests assert the historical rows no longer fire it and a synthetic post-arm leak still does. | GATE-MERGE (code + test). |
| B2b (if 2) | Operator runs the bounded cleanup with read-only proof first + after counts. **This plan does NOT delete rows.** | GATE-ARM (operator, Tier-3 — data mutation). |
| B3 | Confirm the tripwire is GREEN and remains a true producer-bug detector. | Before/after counts recorded. |

### Template C — Family H production re-attempt

| Phase | Action | Gate / proof |
|---|---|---|
| C0 | #472 scoping/retry design. | GATE-A. |
| C1 | Confirm E#7 (a) non-H PASS-LOAD (Lane A) + (b) separate operator decision + (c) provider reliability at 8-family load + clean Card-3 re-run smoke; P1 real-organic precondition; #523 resolved (Lane B). | Operator-confirm; canonical doc §E#7 / §F#3. |
| C2 | The flip card: `claim_clarity` `false→true` + sibling counts `SEVEN→EIGHT` + restore `edgeFamilyHProductionEnable.test.ts`. **No** subset entry (uniform). | GATE-MERGE. |
| C3 | GATE-SPEND: canary-then-burst H smoke (8-family load, terminal-zero, evidence_span doctrine scan with L5 `family_h`). | PASS = 0 terminal holes; 0 banned tokens; falsePositiveGuards hold. |
| C4 | GATE-ARM (Tier-3) → its own observation window. | A–H clean before I considered. On FAIL → roll back per the #408 revert pattern (H returns to admin-only). |

### Template D — Family I #394 production enable (Tier-3)

| Phase | Action | Gate / proof |
|---|---|---|
| D0 | Precondition: H stable in production, its window clean (Lane C). | Operator-confirm; `#394_BLOCKED_BY_H-not-stable` cleared. |
| D1 | #478 scoping confirms; #394 design. | GATE-A. |
| D2 | The flip card: `thread_topology` `false→true` + sibling counts `EIGHT→NINE` + `edgeFamilyIProductionEnable.test.ts`. **Subset entry STAYS** (already present; do NOT remove). | GATE-MERGE. |
| D3 | GATE-SPEND: canary-then-burst I smoke (9-family load). Verify the mixed-source subset filter holds — zero deterministic-key leak into the MCP path; zero `mcp_validation_failed` from `unsupported_rawKey`; terminal-zero. | PASS = 0 terminal holes; subset filter clean. |
| D4 | GATE-ARM (Tier-3) → its own observation window. | On FAIL → roll back per the H-revert pattern (I returns to admin-only). |

### Template E — Family J design → admin-validation

| Phase | Action | Gate / proof |
|---|---|---|
| E0 | #473 scoping design — deepen the ratified N=0 disposition; specify the composer-only / inspect-only surface contract per §10a + a §10a doctrine review. | GATE-A + doctrine review. |
| E1 | MCP-server build card (MCP-SERVER-011+): implement the 5-key `sensitive_composer` classifier on the Deno server. | GATE-MERGE. |
| E2 | GATE-DENO-REDEPLOY: Deno redeploy + hosted `*.deno.net` smoke (J keys, not just baseline). | Hosted smoke PASS. |
| E3 | GATE-SPEND: admin-validation smoke ONLY. Verify the 3 `composer_only` keys never persist to a target-node surface; the 2 `inspect_only` keys land on `inspect` only. | Composer-only routing proven; §10a held. |
| E4 | **STOP at admin-validation.** Production-enable is NOT reached under the current disposition. | Any future J production surface = a NEW P4 doctrine-reviewed card. |

---

## 8. Why NOT to batch H / I / J into one PR

A single combined PR is forbidden:

1. **Different doctrine-risk tiers.** H = HIGH (author-critique hazard), I = MEDIUM (structural), J = HIGHEST (§10a composer-only). A combined review cannot give each the doctrine attention it needs; a J §10a slip would ride in on an H/I green.
2. **Different build-states.** H + I are built (server + admin-validation + Edge bridge); J is unbuilt (server returns `unsupported_family`). Bundling a build-from-scratch (J) with two flips (H, I) mixes incompatible scopes and review depths.
3. **Different gates.** I = Tier-3 production-enable; H = Tier-3 production re-attempt (chained behind E#7); J = design-first / admin-validation-only (never production here). The gate sets do not overlap.
4. **One family at a time** (canonical HARD RULE). Each enablement is a discrete operator-gated step with its own ship, smoke, observation window, and verdict.
5. **Failure rolls back.** A combined PR cannot roll back one family without reverting the others. One-family-at-a-time keeps the rollback surface a single flip.

---

## 9. Rollback plan per plane

| Plane | Rollback |
|---|---|
| **Routing (disarm)** | `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` → `shouldRouteToQueue` returns false for everything → every new submit takes the unchanged direct-dispatch branch (still in the tree). Instant; no redeploy, no migration rollback. |
| **Edge (`familyRegistry.ts` flip)** | Revert the one-char flip (`productionEnabled: true→false`) per the #408 REVERT pattern; the family returns to admin-only; server files + L5 entries + subset entry are preserved. |
| **Deno (`mcp-server/**`)** | Roll back the Deno Deploy build to the prior commit (e.g. for a J build regression); H + I server behavior is unaffected (they predate any J build). Hosted smoke confirms the rollback. |
| **Netlify (client)** | The client renders Observations read-only via `gameCopy` + the node-label registry; a client regression rolls back via the client deploy. H/I/J never reach a client surface while `productionEnabled: false`. |
| **DB (migration / rows)** | The queue columns/rows are additive + inert when routing is off — nothing to migrate back. For #523, prefer the tripwire time-window fix (no data mutation); a row cleanup is operator-gated with read-only proof + before/after counts (this plan deletes nothing). `cron.unschedule('arch-001-classifier-drain-tick')` pauses the tick. |

---

## 10. Doctrine hazards per family

- **H (author-critique hazard, HIGH).** Every `claim_clarity` key must read as a structural shape Observation, never a critique of the author's intelligence, honesty, or argument quality. `claim_specificity_low` = "broad claim" (a shape), not a defect; `conclusion_missing` = "no explicit conclusion present", not "incomplete". Render verdict-free through `gameCopy.toPlainLanguage` (§9) and the node-label registry (§10a, `source: 'machine'`). Absence is not failure. The L5 `family_h` mechanization is the CI enforcement surface; the smoke's Doctrine Phase scans `evidence_span` + falsePositiveGuards.
- **I (structural, MEDIUM).** Topology Observations only. `ignored_by_both` is a reply-state topology fact, not a verdict on the contribution. The 8 `auto_metadata` + 7 `lifecycle` keys are deterministic derivations routed through NON-MCP paths; only the 6 `ai_classifier` keys are classifier outputs. No heat/popularity input.
- **J (§10a composer-only, HIGHEST).** The 3 `composer_only` keys (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`) render composer-only — never on the target's node — because surfacing them publicly reads as accusation. The 2 `inspect_only` keys (`uses_popularity_as_evidence`, `uses_satire_as_evidence`) are `inspect`-surface informational (§3 — popularity/satire are not evidence). No verdict, no truth value, no intent claim; publication remains the author's decision (the chip never blocks posting).
- **Verdict-free render (all three).** Every internal code maps through `gameCopy.toPlainLanguage` / the node-label registry; unknown codes are suppressed, not echoed (§9). No raw classifier ID reaches a user string.
- **Non-admin client leak verification (all three).** While `productionEnabled: false`, no H/I/J row reaches a production user surface (the persistence query filters `run_mode='admin_validation'` out of Source-6 production rendering). The smoke must verify this empirically — see the standing finding (§14): a non-admin smoke account is required because BOT_A is admin-roled.
- **`evidence_span` RLS posture.** `evidence_span`, `inactive_reason`, `inactive_by`, and raw bodies must not leak to a non-admin client. The smoke leak-scan covers these fields; the RLS posture must be verified against a non-admin role (again, the BOT_A admin-role gap — §14). No secret, token, or raw payload in any persisted row or log line (§6).

---

## 11. Cap / batching handling

- **The cap stays 20.** `MAX_FLAGS_PER_RESPONSE = 20` is INTACT (`mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:35`; mirror `mcpBooleanObservationSchema.ts:151`) and stays intact. No lane in this plan changes it.
- **H/I/J are all UNDER-CAP → direct path.** H = 12 ≤ 20; I MCP path = 6 ≤ 20 (only the 6 `ai_classifier` keys hit the MCP path; the 21-key registry total is irrelevant to the per-response cap because the deterministic keys route NON-MCP); J = 5 ≤ 20. **None needs the #545 batching/chunker** (unlike D = 19 keys → 2 batches and G = 21 keys → 2 batches, which exceed the per-classified-subset cap and chunk).
- **Batching only if a family ever exceeds 20.** If a future card raised any family's classified-key subset above 20, that card (not this plan) would add the chunker per `docs/designs/MCP-BOOLEAN-BATCHING-DESIGN-001.md`. No H/I/J card does.

---

## 12. Smoke requirements (per family-enable / admin-validation smoke)

Each family's smoke (GATE-SPEND) must:

1. **Request the family's relevant keys, not just baseline.** A baseline-only smoke proves no new family key is live; the family smoke must exercise the family's own keys on a designed-positive input (H: at least one of the 12; I: at least one of the 6 `ai_classifier`; J: the composer-only + inspect-only keys at admin-validation).
2. **Fail-closed.** Any unexpected envelope (`unsupported_family`, `unsupported_rawKey`, `mcp_validation_failed`, packet/schema residual) FAILs the smoke; no nonzero-dead-letter budget is admitted (canonical doc §A threshold note + §F item 1).
3. **Leak-scan.** Scan every positive row's `evidence_span` + every `failure_*` field + every drain-audit row + log line for: banned verdict/author-label tokens (zero); `Bearer` / `sk-ant` / `sb_secret` / JWT-shape secrets (zero); raw-body / `inactive_reason` / `inactive_by` leakage to a non-admin surface (zero). The token/evidence_span/inactive_*/raw-body/secret scan is mandatory.
4. **Record the exact check count + family-specific checks.** Capture the `Test Suites: X / Tests: Y` line with an explicit exit code; record the hosted smoke's check count (e.g. the Family-I Card-1 hosted Deno smoke 25/25, checks 24/25 family-i-v1).
5. **Structural gates (production-enable smokes).** canary (correct production-family-count rows, 0 H/I/J beyond the enabled family, `family IS NOT NULL`, HALT on any `family=NULL`) → N-burst, terminal-zero, submit nonblocking, dup=0, overlap=0, single-family provider-cluster (≥2 `provider_*` terminal failures) = FAIL.
6. **Over-cap proof only if applicable.** None of H/I/J needs an over-cap batching proof (all under-cap, §11). The over-cap chunk proof is a D/G concern, not an H/I/J one.
7. **Mixed-source subset proof (I only).** Verify zero deterministic-key leak into the MCP path and zero `mcp_validation_failed` from `unsupported_rawKey` — the subset filter must hold.

---

## 13. Issue map + recommended dispositions (RECOMMEND — do NOT execute)

| Issue | State | What it is | Recommended disposition |
|---|---|---|---|
| **#394** | OPEN | MCP-021C-EDGE-FAMILY-I-ENABLE — production flip for `thread_topology` (Tier-3) | Hold (`#394_BLOCKED_BY_H-not-stable`). Reduce its brief: subset entry already present (STAYS); scope is the flip + re-baselines + smoke. Proceed only as Lane D after H-stable. |
| **#396** | OPEN | OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE — backfill observability for H (queued post-H-enable) | Keep queued; sequence AFTER the H production re-attempt (Lane C) lands. Not a blocker for H itself. |
| **#397** | OPEN | OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — backfill observability for I (mixed-source; queued post-I-enable) | Keep queued; sequence AFTER #394 (Lane D). |
| **#471** | CLOSED | MCP-HIJ-000 readiness ledger (docs-only) | Done. Note this plan supersedes its Row I (§1.3); recommend a one-line pointer from #471's ledger to this plan. |
| **#472** | OPEN | MCP-H-001: Family H scoping / retry design (GATE-A only) | Proceed as Lane C Phase C0 (GATE-A). It is design-only; it does NOT authorize the H flip. |
| **#473** | OPEN | Family J scoping design — deepen ratified N=0 | Proceed as Lane E Phase E0 (GATE-A + §10a doctrine review). Design/admin-validation only; never production under current disposition. |
| **#478** | OPEN | MCP-I-SCOPE-001: Family I scoping design (parallel to #472/#473) | Largely satisfied by the shipped I server + bridge; recommend folding its remaining design notes into #394's reduced brief, or closing as superseded by the shipped Card-1/2 + bridge. Operator to confirm. |
| **#523** | OPEN | OPS-TRIPWIRE-CLAIM-CLARITY-001 — `STALE_H_ROWS_CONFIRMED` (7 stale rows) | Resolve as Lane B BEFORE the H flip. Prefer the tripwire time-window fix (no data mutation); cleanup only operator-gated with read-only proof + before/after counts. |
| **#552** | OPEN | ARCH-001 Card 3 (design-only first) | Design + implementation (#554) merged; the remaining work is GATE-C arming (Lane A). Recommend the issue track the arming + smoke verdict, then close on PASS-LOAD-CONFIRM. |
| (#550) | MERGED | Family-I Edge mixed-source bridge | Reference only — the subset entry it added is the reason #394 no longer "MUST add" it. |
| (#554) | MERGED | ARCH-001 Card-3 cron migration + burst regression test + runbook | Reference only — applied + dormant (§3.1). |

---

## 14. Standing finding — provision a non-admin smoke account

**Finding:** the empirical client-plane RLS verification (that H/I/J `admin_validation` rows and sensitive columns — `evidence_span`, `inactive_reason`, `inactive_by`, raw bodies — do NOT reach a normal user) cannot be done with the current smoke identity, because **BOT_A is admin-roled.** An admin account sees admin-validation rows by design, so a leak-scan run as BOT_A proves nothing about the non-admin client surface.

**Recommendation:** provision a dedicated **non-admin** smoke account before the H/I production-enable smokes (Lane C / Lane D) and before any J admin-validation surface verification (Lane E). Run the client-plane RLS leak-scan as that non-admin role to empirically confirm zero leakage. This is a standing prerequisite for the "non-admin client leak verification" check in §12.3 and the `evidence_span` RLS posture in §10. (Operator action; named here, not executed.)

---

## 15. Next-lane recommendation + disclaimer

**Recommended first lane: Lane A — ARCH-001 Card-3 GATE-C arming (Template A).** Rationale (from the verified state): the queue is built + applied + dormant (`QUEUE_IMPLEMENTED_NOT_ARMED`), and a non-H PASS-LOAD is E#7 condition (a) — the foundational precondition for everything downstream (H, then I). Lane B (#523) can proceed in parallel since it is independent, but it must land before the H flip. At the Lane-A arming gate, the operator must reconcile the stale "armed at 1%" claim (§3.2) against the live `cron.job` + routing-env state.

**Disclaimer (binding):** This document is a PLAN. A green plan row, a satisfied dependency arrow, or a recommended lane order is **NOT a gate-pass** and does **NOT authorize advancement**. Every flip, arm, ramp, deploy, redeploy, and row mutation named here is operator-gated (Tier-3 never-self-approve) per `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` and the pipeline governance contract. **This plan enables no family, arms no routing, raises no percentage, flips no flag, cleans no row, and forbids itself as an advancement authorization.**

---

## Self-check (doctrine + scope)

- **DOCS-ONLY:** one new file (`docs/designs/MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md`). No code, migration, config, test, `productionEnabled` flip, arming, #394 execution, or row cleanup.
- **Cap:** `MAX_FLAGS_PER_RESPONSE = 20` stated as intact; no change proposed.
- **Acceptance gate:** `engine.ts` named as the sole gate; all H/I/J/queue paths post-storage/advisory.
- **Secrets (§6):** Vault referenced as call-shape / placeholder only; no real secret, URL, token, or `Bearer`/`sk-ant`/`sb_secret`/JWT value appears.
- **Ban-list (§1, §10a):** no verdict/author-label token (winner / loser / liar / dishonest / bad faith / manipulative / extremist / propagandist / stupid / idiot) appears in this doc. Boolean code literals (`productionEnabled: false`, `=== 'true'`) are flag values, not truth labels about claims.
- **Verified-at-HEAD `8046e08`:** every state claim re-confirmed against the live files this card; the readiness ledger's stale Row I is corrected (§1.3).
- **Forbids itself as an advancement authorization** (§0, §15).

*End of MCP H/I/J scale-up implementation program plan. This document authorizes no advancement. A green plan row is NOT a gate-pass.*
