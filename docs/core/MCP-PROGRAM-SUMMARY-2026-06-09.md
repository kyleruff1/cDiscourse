# MCP Program Summary — completed vs yet-to-complete (2026-06-09)

**Verified at:** `main = 8046e08` (clean, `== origin/main`). Grounded in a 5-surface parallel
codebase study (MCP server / Edge plane / client plane / docs trail / GitHub trail) plus the
2026-06-08→09 session evidence (Build-2 closeout, client-plane verification, burst RCA).

> **Inventory only.** This summary records state. It is NOT a gate-pass and does NOT authorize
> any advancement, flag flip, arming, deploy, or spend. Advancement stays operator-gated per
> `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` and
> `docs/core/pipeline-governance-contract.md`. The acceptance-gate invariant is absolute:
> `src/lib/constitution/engine.ts` is the sole submission gate; everything below is
> post-storage, display-only, advisory.

---

## 1. Executive summary

The MCP boolean-observation program is **complete through Build-2 A–G** on every plane:
definitions + mapping rows (client), classifier + batching + auto-trigger (Edge), per-family
classifiers + hosted smoke 39/39 (Deno MCP server), and a client-plane verification PASS.
The **scale-up program (H/I/J + queue arming)** is planned (PR #555) but not executed: the
async classifier queue is **implemented and dormant** (not armed), Family H is **built but
rolled back** from its one production attempt, Family I is **built and admin-validation-live**
awaiting its Tier-3 production flip (#394), and Family J is **not built at all**.

| Plane | State |
|---|---|
| Client (defs/mapping/gameCopy) | ✅ 193 definitions (A–J), 119 active mapping rules, Build-2 rows render-mapped |
| Edge classifier + batching + auto-trigger | ✅ A–G production; D/G batch 16+6 / 16+5; cap 20 intact |
| Deno MCP server | ✅ families A–I implemented; J = `unsupported_family` by design |
| Queue (ARCH-001) | ✅ implemented (Cards 1/2/2A/3 merged) · ⬜ **dormant — arming is operator GATE-C** |
| Production enablement | A–G ✅ · H ⬜ (rolled back) · I ⬜ (#394 Tier-3) · J ⬜ (never, under current disposition) |

---

## 2. COMPLETED

### 2.1 MCP-021 foundation chain (client + Edge)
- **MCP-021A** — `MachineObservationDefinition` registry, families A–J (now **193 keys** total,
  test-pinned), Observations-vs-Allegations doctrine (§10a).
- **MCP-021B** — persistence: `argument_machine_observation_runs` + `_results` tables, RLS
  (`amor_results_select_via_run` → runs → `public.arguments` own/participant/posted-public),
  read-only client SELECTs, no client write path.
- **MCP-021C** — Edge Function `classify-argument-boolean-observations` (admin-gated both
  modes, ≤10 args/call, production family gate), request builder
  (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`: D, G, I entries), MCP adapter (typed, never throws),
  failure_detail/sub-reason plumbing (leak-safe).
- **Auto-trigger** — `submit-argument` post-insert tail → `dispatchAutoTriggerForArgument` →
  `productionEnabledFamilies()` (A–G), bounded concurrency 2/arg, idempotency pre-check,
  bounded retry; fire-and-forget (`EdgeRuntime.waitUntil`) — never blocks submit.

### 2.2 MCP server family chain (MCP-SERVER-001…010, Deno Deploy)
- **Families A–I all implemented** (keys/prompt/Anthropic/ban-list/fixture modules ×9;
  registered in order A→I). Classified key counts: **A=19, B=17, C=20, D=22, E=19, F=17,
  G=21, H=12, I=6** (153 total). All classifier-set versions stay `*-v1`.
- Hosted smoke `scripts/mcp-server-001-smoke.sh` = **39 checks** (core+A 1–9, B–I pairs
  10–25, **Build-2 new-key proofs 26–39** — the merged-≠-live harness). Last full run 39/39.
- Per-family doctrine ban-list scanners (E and F stack extra binding tokens; H carries
  per-key DOCTRINE paragraphs); Anthropic provider `claude-haiku-4-5`, no-logging tested;
  per-isolate provider concurrency gate = 5; constant-time bearer auth.
- 92 Deno test files / **1404 Deno.test registrations**; 101 fixtures; fixture-provider
  offline mode (never in production).
- Production URL on Deno Deploy (org subdomain); deploys are dashboard/GitHub-integration
  driven; promotion is operator-confirmed (build ≠ serving).

### 2.3 Build-2 A–G vocabulary expansion (all merged 2026-06-08, Deno-live, smoked)
| PR | Family | Keys | Notes |
|---|---|---|---|
| #538 | B disagreement_axis | 14→17 | pilot family, four-gate Deno go-live proven |
| #540 | A parent_relation | 16→19 | + SFI-11 cross-PR count fix |
| #541 | C misunderstanding_repair | 17→20 | transient Deno build retry incident |
| #542 | E argument_scheme | 16→19 | theory-term-not-surfaced rule |
| #543 | F critical_question | 14→17 | F3 invites-revision-not-a-verdict fence |
| #545 | — batching infra | — | `BATCH_SIZE=16`, threshold=20, chunk/merge, all-or-nothing |
| #547 | D evidence_source_chain | 19→22 | **first over-cap family: 16+6 batches** |
| #548 | G resolution_progress | 18→21 | **last family: 16+5 batches**; evidence-doctrine fence |
- **Cap `MAX_FLAGS_PER_RESPONSE = 20` intact** — over-cap solved by batching, never by raising
  the cap. Cap-holds negatives proven live (direct 21/22-key calls rejected).
- Live Edge batched proofs: D and G admin_validation each merged positives across **both**
  batches under one run_id.
- **106 Build-2 mapping rows adopted** (per `OBSERVATION_MAPPING_ADOPTION_MANIFEST`);
  `totalActiveRules = 119`; all labels verdict-free, snake-free, routed through
  `gameCopy.toPlainLanguageOrSuppress`.
- Test base at closeout: **705 Jest suites / 29,421 passing** + 1404 Deno; typecheck/lint clean.

### 2.4 Family I chain (admin-validation-live)
- **#546** (MCP-SERVER-010) I server classifier — hosted smoke 25/25, `family-i-v1`.
- **#549** (#393) L5 audit-lint doctrine-risk mechanization for `family_i`.
- **#550** Edge mixed-source subset bridge — `thread_topology: {ai_classifier}` (6-key subset
  of 21 mixed-source keys) so Edge admin_validation no longer fails `mcp_validation_failed`.

### 2.5 Family H chain (built; production attempt rolled back)
- H server classifier + L5 + Edge support all shipped (#400/#403 chain). H is
  **admin-validation-live** (12 uniform ai_classifier keys, under-cap).
- H was production-enabled once (PR #405, 2026-05-31) → 8-family-load smoke **FAIL**
  (provider/server reliability, not an H classifier defect) → **rolled back** (PR #408,
  2026-06-01). That ~2h window wrote the 7 rows now firing the #523 tripwire.

### 2.6 ARCH-001 async classifier queue (implemented, dormant)
- **Cards 1/2/2A** (#374/#378/#376): queue substrate + claim/lease SQL + pg_cron/pg_net
  extensions + enqueue-kick trigger + atomic finalizer + `classifier-drainer` Edge fn
  (single-flight lease, bounded batch, drainer concurrency C=3) — merged and applied.
- **Card 3 design (#553) + implementation (#554)**: 60s cron drain tick migration
  `20260608000001` (null-URL-guarded → **applied on the live DB but inert until Vault-seeded**),
  burst regression test (56 jobs never exceed C=3 where unbounded fan-out hits 56), staged-arm
  runbook, smoke harness (6 read-only SQL snapshots).
- Motivating RCA: `docs/rca/OPS-MCP-AUTOTRIGGER-BURST-PROVIDER-NETWORK-ERROR-RCA-2026-06-08.md`
  (~96% `mcp_network_error` loss under a 38-args-in-seconds burst; A→G monotonic starvation).

### 2.7 Verification / observability / corpus chain
- **OPS-MCP-OBSERVABILITY** report (16 questions) + family-D/G coverage + audit-lint rules
  (incl. family_i L5); classifier failure_detail auto-trigger fill (#485).
- **#465/#469/#470/#476** — corpus verification read, Admin Arguments coverage column +
  runTag filter, classifier health panel (incl. the H/I/J leakage tripwire), runTag
  first-class column.
- **#479 corpus run (2026-06-08)** — 38/38 args posted; **every family A–G produced ≥1
  positive**, including all newly-shipped Build-2 D/F/G keys; H/I/J leakage = 0. Burst loss
  diagnosed (the RCA above); paced admin_validation lights everything up.
- **Client-plane verification PASS** (×2, recorded on #548): live Netlify bundle = main,
  secret-clean, Build-2 markers present; authed reads return 86 production observations
  (A/B/D rendering new keys); `evidence_span` argument-scoped via RLS; doctrine render suites
  green. Codified in `scripts/verify/client-plane-verify.sh` +
  `docs/runbooks/client-plane-verify-runbook.md` (#551).
- **Build-2 closeout** recorded on #548 (2026-06-09).

### 2.8 Semantic-referee MCP track (Epic 12 — separate from boolean observations)
- **MCP-017** (`classify_semantic_move` server tool), **MCP-019**, **ADMIN-AI-001**,
  **MCP-018** (MCP adapter) all shipped. The `mcp` provider slot is un-stubbed but **dormant**
  (provider-mode selection is operator-controlled; #477 audit territory).

### 2.9 Scale-up program plan
- **PR #555** (open) — `docs/designs/MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md`: 15-column H/I/J
  readiness matrix, blocker classifications, lane templates A–E, do-not-batch rationale,
  recommended order. Supersedes the stale ledger Row I + the 2026-06-02 roadmap.

---

## 3. YET TO COMPLETE

Ordered per the scale-up plan's lane order. **None of these is authorized by this doc.**

### Lane A — ARCH-001 Card 3 GATE-C arming (#552) — recommended first
The queue is merged + applied but **dormant**: `CLASSIFIER_QUEUE_ROUTING_ENABLED` unset/false,
`PERCENTAGE=0`, Vault secrets (`arch_001_classifier_drainer_url` / `…_secret`) **not seeded**,
the 60s tick is a null-guard no-op. Remaining (operator, per
`docs/runbooks/ARCH-001-CARD3-staged-arm-runbook.md`): DP-1/2/3 confirmed 2026-06-09
(Tier 2+ / paid 400s / 60s tick — initial arm still ships conservative C=3, T=90s) → seed
Vault (secret must equal `CLASSIFIER_DRAIN_SHARED_SECRET`) → verify one tick → smoke-tag arm
(`ENABLED=true`, `PERCENTAGE=0`) → canary → **N=56 PASS-LOAD (0 terminal dead-letters)** →
PASS-LOAD-CONFIRM → percentage ramp (1→5→25→50→100, one operator card per step, organic
Stage-1 evidence required for 5%+). This is the **E#7 precondition for the whole H→I chain**
and the fix for the ~96% burst loss.

### Lane B — #523 stale H-row tripwire cleanup
7 `claim_clarity` production-success rows (2026-06-01 01:20–01:24Z, the rolled-back #405/#407
window) keep the H/I/J leakage tripwire firing. Remaining: read-only SQL proof of the window →
operator-gated cleanup (narrowest possible mutation) → tripwire clears → before/after counts
recorded. **Must land before any H production flip.** (Note: the #523 diagnosis comment dates
the window "June 2–4"; the PR record says May 31→June 1 — the proposed cutoff still bounds it.)

### Lane C — Family H production re-attempt (#472 scoping → E#7 gate)
H is built and admin-validation-live; what remains is the **retry design** (#472, GATE-A
docs-only: rule the 7 failure layers in/out + a 4-stage admin_validation repro plan) and then
the production re-flip gated on E#7's three conjunctive conditions: (a) non-H PASS-LOAD,
(b) separate operator decision, (c) provider reliability at 8-family load + clean Card-3
re-run smoke — with the P1 real-organic precedence ordering. Doctrine-risk HIGH
(claim-clarity must never read as author critique).

### Lane D — Family I production enable (#394, Tier-3)
A **runbook lane, not a build** — the I server (#546), L5 (#549), and Edge bridge (#550) are
all merged; only the `productionEnabled` flip + staged rollout + smoke remain. Status
"Authorized, not started"; **blocked by H-not-stable** (intent brief chains I behind H).
No Card-3 design doc or enable PR exists yet. Also missing: committed I smoke audits in
`docs/audits/` (the 25/25 evidence lives on #392).

### Lane E — Family J design → build (#473)
J is **not implemented anywhere on the server** (dispatcher returns `unsupported_family`;
"future MCP-SERVER-011+"). All 5 J keys are `semantic_referee`-sourced, composer-only per
§10a — **highest doctrine risk; never production under the current N=0 disposition**.
Remaining: #473 scoping deepening (design-only) → a fresh doctrine-reviewed build card →
admin-validation only. ⚠️ New hazard surfaced by this study: J has **no
`MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry**, so a future J admin_validation call would send
5 `semantic_referee` keys to the hosted server — the same live-only `mcp_validation_failed`
class that bit D/G/I. The J build card must address the source-subset question.

### Post-flip / follow-on items
- **#396 / #397** — observability backfills for H and I coverage (gated on the family flips;
  only `-intent.md` docs exist).
- **#479** — the "demonstrably lights up A–G" corpus close-out effectively waits on Lane A
  (a burst run cannot demonstrate A–G while the queue is unarmed; verdict + RCA recorded).
- **#388** — workflow-restoration umbrella (open children: #394/#396/#397).
- **#478** — I scoping design; **likely superseded** by the shipped I build (recommend fold
  into #394 or close — operator confirm).

### Mapping / vocabulary backlog
- **Build 3 (deferred by decision):** ~849 of the ~955 deferred CSV A–G mapping rows remain
  deferred (rows needing PLANNED partner flags — `requests_source`, `cites_source`,
  `poses_question`, `has_premise_conclusion`, …). A separate scope/triage decision.
- **Build 4 (frozen):** HiTODS 18 booleans + any NEW family (a `familyRegistry` change is a
  Build-4-only operation). The spawned `MCP-FAMILY-HITODS-DESIGN-001` design doc was named
  but never authored.
- **Build-2 H/I keys:** none exist (H=12 / I=6 baselines; Build-2 covered A–G only).

### Known gaps & hygiene (new findings from this study)
1. **Orphaned production-mode render filter:** the run_mode-filtered fetcher
   (`fetchPersistedObservationsForArguments`, `.eq(run_mode,'production')`) has **zero call
   sites**; the live room loader uses the unfiltered observation read. Decide intended
   behavior (should admin_validation rows render in rooms?) and wire or remove.
2. **Build-2 booleans are not yet visible as node-label chips:** every ai_classifier
   definition (incl. all 21 Build-2 keys) carries disposition `future_source`, which
   `filterMarksBySurface` suppresses on **all** surfaces. What users see today is the
   mapping-rule layer, not raw observation chips. Surfacing them is a future
   disposition-promotion card (doctrine-gated).
3. **Admin Arguments `observationCoverage` column has no producer** — it always renders
   "observations n/a". The render surface shipped; the data feed didn't.
4. **Stale comments contradicting shipped state** (cleanup card material):
   `familyRegistry.ts` header still says only A/B/C production-enabled;
   `classify-argument-boolean-observations/index.ts:231` still says "Only parent_relation is
   enabled"; `machineObservationDefinitions.ts` header still says 171 defs (actual 193);
   `docs/core/MCP-HIJ-000-READINESS-LEDGER.md` Row I predates the I build; 
   `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md` frozen at 2026-06-02 with a
   wrong-row J-audit citation for Family I.
5. **Enqueue idempotency note:** the submit-side queue routing uses a raw multi-row INSERT
   (no ON CONFLICT — supabase-js can't express the partial-index predicate); duplicate-enqueue
   safety rests on the partial unique indexes + cron-tick healing. Documented, but worth a
   regression test when arming.
6. **3 reserved failure sub-reasons have no emitter** (`response_evidence_span_invalid`,
   `response_ban_list_violation`, `provider_timeout` — folded into network_error).
7. **Family I deterministic `auto_metadata` derivers are still no-op stubs** client-side
   (8 keys; "future MCP-021C territory") even though the I classifier shipped server-side.
8. **Realtime channel for observation rows** explicitly deferred to a future card.
9. **runTag legacy backfill** (pre-#476 rooms) is an unrun operator one-time step.
10. **No committed Build-2 audits under `docs/audits/`** — the go-live proof lives on the
    PR/issue trail (#548 closeout + GATE-SPEND comments). Acceptable, but an audit-plane
    normalization card could mirror it into `docs/audits/`.
11. **Non-admin smoke account still missing** — BOT_A is admin-roled, so client-plane RLS
    verification is policy-source-proven, not yet empirically non-admin-proven.

### Adjacent open items (MCP-flavored, not family work)
- **#462** runtime-gates inspection surface (would consolidate `providerMode`, routing flags,
  H/I/J flags, secret digests — useful before/after Lane A arming).
- **#433** jest/jest-expo v30 upgrade (the 29k-test MCP-heavy suite).
- **#508** Admin Arguments room grouping; **#504** card-view data centerpiece (doctrine-risk).
- **#555** itself — the scale-up plan PR awaiting review/merge.

---

## 4. Key numbers (verified at 8046e08)

| Metric | Value |
|---|---|
| Machine-observation definitions (A–J) | **193** (test-pinned) |
| Active mapping rules | **119** (`totalActiveRules`; 106 Build-2-adopted) |
| Server-classified keys A–I | 19/17/20/22/19/17/21/12/6 = **153** |
| Response cap | `MAX_FLAGS_PER_RESPONSE = 20` (intact) |
| Batched families | D 22→16+6 · G 21→16+5 (others single-batch byte-identical) |
| Hosted smoke | **39 checks** (last full run 39/39) |
| Server per-isolate provider cap | 5 (`MCP_SERVER_MAX_PROVIDER_CONCURRENCY` overridable) |
| Queue drainer concurrency | C=3 (≤ provider cap), T=90s, 60s tick, retry cap 4 (lease reclaim 3 — intentional) |
| PASS-LOAD bar | 0 terminal dead-letters at N=56 (canonical; never widened) |
| Jest baseline | 705 suites / 29,421 passing (+1 pre-existing skip) |
| Deno tests | 1404 registrations / 92 files |
| Production-enabled families | A–G (H/I/J `productionEnabled:false`, all `adminValidationEnabled:true`) |
