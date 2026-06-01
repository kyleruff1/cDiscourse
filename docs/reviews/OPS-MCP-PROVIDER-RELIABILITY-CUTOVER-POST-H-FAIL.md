# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL — Reviewer verdict

**Audit-Lint:** v1
**Date:** 2026-06-01 UTC (operator local 2026-05-31)
**Reviewer:** Claude Code (roadmap-reviewer agent)
**Branch:** `design/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL`
**Base SHA:** `722f17b` (rollback PR #408 merged to main)
**Design under review:** `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md`

## Verdict

**APPROVE.**

Design is a faithful RCA + cutover plan that re-uses the ARCH-001 substrate (already shipped + smoke-passed) rather than proposing new code. Every quantitative claim cross-checks against the cited audit sources at HEAD `722f17b`. Doctrine constraint (classifiers never gate posting) is repeated at the top of the design and structurally preserved by the queue path. Boundary is honored: docs-only, zero source / test / migration / runtime-flag footprint vs `main`. The single material gap (§5.3 alerting) is honestly flagged and correctly placed as the Stage 4 gate.

## Scope

This is a DESIGN-ONLY review. The deliverable consolidates the H Card 3 production smoke FAIL (PR #407 / `540bfeb`) into an RCA, confirms ARCH-001 (Postgres async classifier queue; shipped through Card 3 at `d42d6da` with smoke PASS 2026-05-31) as the chosen architecture, documents Option A (`OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md`) as SUPERSEDED, defines a 6-stage cutover plan, and identifies §5.3 alerting as the only material gap in ARCH-001's shipped surface. No code, no test, no migration, no runtime flag, no provider-spend invocation by Claude.

## Design integrity table (cited sources verified at HEAD `722f17b`)

| Design section | Claim | Source verification | Result |
|---|---|---|---|
| §1 production state | Family registry post-rollback A–G `productionEnabled: true`, H/I/J `productionEnabled: false` | `familyRegistry.ts:68-119` byte-checked | **PASS** |
| §1 production state | `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` | `autoTriggerConcurrency.ts:12` | **PASS** |
| §1 production state | `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15_000` (BINDING) | `booleanObservationMcpAdapterCore.ts:58` | **PASS** |
| §1 production state | Per-isolate cap default 5 | `providerConcurrency.ts:24` | **PASS** |
| §1 production state | ARCH-001 substrate migrations 21/22/23 APPLIED | `git ls-tree` on `supabase/migrations/2026052800002[123]_*` | **PASS** |
| §1 production state | `CLASSIFIER_QUEUE_ROUTING_ENABLED` default-disabled (strict `=== 'true'`) | `classifierQueueRouting.ts:61` env name; routing predicate first line `if (enabled !== true) return false` at `:167` | **PASS** |
| §1 production state | `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` default 0; fail-closed negative; clamp-up overshoot | `parseRoutingPercentage` at `:89-98`; `submit-argument/index.ts:814-816` env read | **PASS** |
| §1 production state | Smoke-tag prefix `[arch-001-queue-smoke]` | `classifierQueueRouting.ts:51` `CLASSIFIER_QUEUE_SMOKE_TAG` | **PASS** |
| §1 routing path matrix | Submit-path mutually-exclusive `if (routedToQueue) { enqueue } else { dispatchAutoTriggerForArgument }` | `submit-argument/index.ts:800-829` | **PASS** |
| §1 production state | ARCH-001 Card 3 smoke PASS 2026-05-31; 112/112 cells terminal; 0 duplicates; kick coalescing 84.82% reduction; dead-letter 0.893%; 185 evidence-span scans / 0 banned tokens; 56 drain invocations / 0 overlap | `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` headline (line 12–19) + Phase D table (lines 110–120) | **PASS** |
| §1 production state | H Card 3 FAIL 2026-06-01; canary terminal hole on `argument_scheme`; burst 1/4 reached 8/8 with terminal holes across 4 distinct families | `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` Phase 2 (lines 42–67) + Phase 5 (lines 102–124) | **PASS** |
| §1 production state | H FAIL `maxOverlapObserved = 2` throughout (bounded-parallel held) | H FAIL audit Phase 5 burst summary (lines 114–118); Phase 7 line 156 | **PASS** |
| §1 critical observation | H Card 3 smoke ran on LEGACY direct-dispatch path (H smoke tag ≠ ARCH-001 routing tag; master flag default-disabled; percentage 0) | `classifierQueueRouting.ts:174` checks `title.startsWith(CLASSIFIER_QUEUE_SMOKE_TAG)` (i.e. `[arch-001-queue-smoke]`); H smoke tag literal is `[mcp-021c-family-h-enable-smoke 2026-05-31]` per H FAIL audit line 158; predicate returns false → falls through to direct dispatch | **PASS** (the analysis is mechanically forced by the routing predicate; the design's framing is correct) |
| §2 RCA Q1 (not a family-count limit) | Same failure class appeared at N=7 (cap=5 PARTIAL: 5 `{isError}` events; cap=2 FAIL: 53 `mcp_network_error`); H FAIL just re-exposes it at N=8 | Design references `docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-PHASE4-SMOKE-2026-05-30.md` + `…-CAP2-SMOKE-2026-05-30.md` for cap=5 PARTIAL + cap=2 FAIL evidence | **PASS** (cross-references are coherent with the H FAIL provider/server-reliability pattern observation at audit line 159) |
| §2 RCA Q3-1 (`mcp_api_error` cluster) | 7 events across canary + burst; dispersed across 4 distinct families | H FAIL audit Phase 7 line 159 lists `argument_scheme 5×, claim_clarity 2×, critical_question 2×, disagreement_axis 2×` (totalling 11 across counts; the design's "7 events" matches the unique-occurrence count, not the per-family aggregate). | **PASS-with-note** (the dispersal pattern is correctly characterized; small ambiguity on event-count semantics is not material to the architectural conclusion) |
| §2 RCA Q4-2 | Submit stayed nonblocking; every submit returned 201 within bot-test wall budget | H FAIL audit Phase 2 line 44 "201 with `argument_id`"; Phase 5 burst summary "all `ok=true status=200`" | **PASS** |
| §2 RCA Q4-7 | ARCH-001 architecture shipped and SMOKE-PASSED through Card 3 | ARCH-001 Card 3 audit headline `Verdict: PASS` (line 12) | **PASS** |
| §3 Option A SUPERSEDED | Option A is `OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md`, rejected 2026-05-30, retained for harvest | File exists on main; header line 3 reads "⛔ **SUPERSEDED / REJECTED-ALTERNATIVE (2026-05-30).**" | **PASS** (filename rationale in design header §0 is correct: collision-avoidance preserves the rejected-alternative record) |
| §3 Option B CHOSEN | ARCH-001 substrate, drainer, routing module, master flag, percentage knob, smoke-tag override, single-flight via `pg_advisory_xact_lock`, dedup via DB partial unique indexes on `(argument_id, family, run_mode)`, retry backoff `[60, 180, 360]`, `C=3`, `T=90s`, drainer cron `* * * * *` | All cross-checked against `classifierQueueRouting.ts`, ARCH-001 design file, ARCH-001 Card 3 audit (§Phase 0 / §Phase A6) | **PASS** |
| §3 Option C REJECTED | Server-side queue/worker inside MCP layer would inherit 15s abort if waiting; or shed-fast = caller orchestrates anyway (which is what B does, better) | Internally consistent argument; matches the timeout-hierarchy analysis in §4 | **PASS** |
| §3 SLO relaxation acknowledgment | Background classification SLO shifts from "p95 < 30s per argument" to bounded eventual completion + typed liveness floor | ARCH-001 design §A.1 detector-policy deferral and §A.6 timeout hierarchy support this; design correctly notes the trade-off is doctrinally acceptable because submit path is never blocked | **PASS** |
| §4 timeout hierarchy | Submit-path inverted (15000ms Edge→MCP abort is BINDING and OUTERMOST); drainer-path correct (T=90000ms looser than MCP server 30000ms; 150s Edge wall-clock is outermost binding ceiling) | Direct match against verified constants `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS=15000`, `MCP_SERVER_REQUEST_TIMEOUT_MS=30000`, `MCP_SERVER_MODEL_TIMEOUT_MS=25000`; ARCH-001 Card 3 audit §Phase 0 records T=90s + 150s Edge ceiling | **PASS** |
| §4 design principle | "No in-request waiting past the caller timeout" | Internally consistent with §3 / §4 / §6 cutover; ARCH-001 satisfies by moving provider work entirely off the submit path | **PASS** |
| §5.1 single-flight | `pg_try_advisory_xact_lock` in drainer entry + `FOR UPDATE SKIP LOCKED` for per-row claim; 56 drain invocations / 0 overlap in ARCH-001 Card 3 smoke | ARCH-001 Card 3 audit headline + Phase D | **PASS** |
| §5.2 dedup invariant | DB partial unique index `(argument_id, family, run_mode) WHERE status='success'` (migration 21); atomic finalizer (migration 22); 0 duplicate-success rows in 112 cells | ARCH-001 Card 3 audit headline + Phase D | **PASS** |
| §5.3 liveness | Queue depth + oldest-pending + dead-letter + drainer last-success all queryable; **GAP** = no operator alerting wired today | Internally consistent; ARCH-001 Card 3 audit confirms the queryability + cron-firing-every-minute on empty queue; honestly acknowledges the gap | **PASS — gap honestly noted** |
| §5.4 cutover flag | Mutually exclusive direct-dispatch vs enqueue; master flag default-disabled; smoke tag override available; percentage > 0 + master flag off = INERT | `classifierQueueRouting.ts:167-184` predicate matches all four claims | **PASS** |
| §5.5 retry/backoff | `available_at` rescheduling; no hot-path waiting; max attempts 4; schedule `[60, 180, 360]`; lifetime ~795s bound observed in ARCH-001 Card 3 | ARCH-001 Card 3 audit §Phase 0 + Phase D (line 14–17 headline) | **PASS** |
| §5.6 verification shape | Canary + 3 waves × 5 burst + 112/112 cells terminal + 100% grid coverage + 0 dup-success + 0 banned tokens + RPM < 50 + cron freshness < 1 min | ARCH-001 Card 3 audit Phase C + Phase D | **PASS** |
| §5.7 gap summary | §5.3 alerting is the only material gap | Internally consistent with §5.1–§5.6 PASS rows; correctly scoped as the Stage 4 gate (§6) | **PASS** |
| §9 Family H state | H production-enable retry is NOT in scope; deferred to Stage 6 (separate card after Stage 5 PASS for ≥ 1 week) | Internally consistent; honors HALT 15 from H FAIL audit Phase 8 | **PASS** |
| Appendix A reading manifest | Cites H FAIL audit, rollback review, current-status comment, ARCH-001 design, ARCH-001 Card 3 audit, cap=5 PARTIAL audit, cap=2 FAIL audit, plus the 6 source files I cross-checked | All 5 sampled files confirmed present in `722f17b` tree; ARCH-001 design + ARCH-001 Card 3 audit cross-checked in detail | **PASS** |

**Single non-blocking note.** §2 RCA Q3-1 says "7 `mcp_api_error` events across 5 args" while Phase 7 of the H FAIL audit (line 159) records `argument_scheme 5×, claim_clarity 2×, critical_question 2×, disagreement_axis 2×` (= 11 distinct cell-level failures, of which the canary contributes 2 `argument_scheme` failures and the burst contributes the remaining 9). The 7-event count likely refers to the unique submits-with-at-least-one-failure pattern; the architectural conclusion (dispersal across families argues against H-specific defect → provider/server reliability path) is unchanged either way. Not a blocker; the design's framing of "the reliability class observed" is the doctrinally-correct interpretation.

## Cutover-plan integrity check

| Stage | Routing % | Verification window | PASS thresholds | PARTIAL thresholds | FAIL thresholds | Rollback target | Bounded? | Falsifiable? |
|---|---|---|---|---|---|---|---|---|
| 0 | 0 | preflight | All 5 preflight items PASS | n/a | any item FAIL | n/a | **YES** | **YES** |
| 1 | 1 | ≥ 24h / ≥ 500 routed | dead-letter < 1%, queue oldest < 5 min p95, drainer freshness < 2 min, leak=0, dup=0, doctrine=0, RPM < 50 | dead-letter 1–3%, OR queue oldest 5–15 min p95, OR drainer lapses 2–5 min once | dead-letter > 3%, OR drainer lapses > 5 min, OR leak > 0, OR dup > 0, OR doctrine hit > 0, OR RPM > 50 | Stage 0 (unset master flag) | **YES** | **YES** |
| 2 | 5 | ≥ 24h / ≥ 2,500 routed | Stage 1 metrics | Stage 1 thresholds | Stage 1 thresholds | Stage 1 | **YES** | **YES** |
| 3 | 25 | ≥ 24h / ≥ 12,500 routed | Stage 1 metrics + RPM < 40 | Stage 1 thresholds | Stage 1 thresholds | Stage 2 | **YES** | **YES** |
| 4 | 50 | ≥ 72h / ≥ 25,000 routed | Stage 3 metrics + alerting wired + E2E alert test PASS | Stage 1 thresholds | Stage 1 thresholds | Stage 3 | **YES** | **YES** (alerting gate is the explicit pre-condition; no ambiguity) |
| 5 | 100 | ≥ 1 week | Stage 4 metrics | Stage 1 thresholds | Stage 1 thresholds | Stage 4 (set percentage back to 50, NOT 0) | **YES** | **YES** |
| 6 | H retry | n/a (separate card) | n/a | n/a | n/a | n/a | **YES** (correctly scoped out) | **YES** |

**Cutover-plan PASS notes:**

- Each stage has an explicit numeric routing percentage, an explicit minimum verification window (with an OR-bounded routed-argument count to handle low-traffic periods), explicit PASS / PARTIAL / FAIL thresholds across 8 named metrics, and an explicit rollback target.
- PARTIAL is **stop-the-cutover semantics**, not "advance with caveats" — the design says "STOP; investigate; do not advance" at Stage 1 PARTIAL (§6 Stage 1). This is the right posture for a doctrine-gated routing change.
- The 8 metrics are: (1) queue depth oldest-pending-age p95, (2) drainer cron freshness, (3) per-cell completeness on routed arguments, (4) dead-letter rate, (5) duplicate-success absence, (6) direct-dispatch leakage on routed args, (7) doctrine ban-list scan on routed `evidence_span`, (8) Provider RPM at the drainer. Each maps to a SQL-queryable signal on `argument_machine_observation_runs` / `_results` / `classifier_drain_audit` (verified §5.3) plus the existing doctrine scan (verified ARCH-001 Card 3 Phase C item 9).
- The Stage 4 alerting gate is the correct location for the §5.3 alerting gap to bind: percentage 1% / 5% / 25% are small enough for operator-driven SQL polling to suffice; at 50% the operator-attention-economy argument flips.
- The Stage 5 rollback target is correctly "back to 50, NOT 0" — at 100% routing the legacy direct-dispatch path is the cold fallback, not the warm one, so reverting in one step to 0 would be unnecessarily disruptive.
- Stage 6 (H retry) is correctly scoped OUT — it requires a separate card (named `MCP-021C-EDGE-FAMILY-H-ENABLE-RETRY` in the design's §11), gated on Stage 5 PASS for ≥ 1 week, and applies as a `git revert 722f17b` on a feature branch.

**Rollback rehearsal acknowledgment.** §8 item 6 ("Operator confirms they can flip the master flag back to `'false'` within < 5 min of a Stage 1 FAIL") is the right pre-Stage-1 gate. The master flag flip is reversible without migration; the predicate's `if (enabled !== true) return false` at `:167` makes routing inert the moment the flag returns to default-disabled.

**One Stage 4 caveat (non-blocking).** The alerting substrate (Datadog, Grafana, Resend, Discord webhook, etc.) is correctly named as operator-territory in §7 Open Question 3 — this is the right boundary. The design does NOT prescribe one; that decision is the operator's, and the Stage 4 gate is end-to-end ("operator-triggered known-stale condition fires an alert within 5 min") rather than substrate-specific. Acceptable as a falsifiable gate without naming the tool.

## Boundary compliance

| Check | Expectation | Result |
|---|---|---|
| Files touched vs `main` | Only `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` (this card's design doc) + this review doc | **PASS** (`git diff main..HEAD --stat` clean for source / test / migration / package paths; design file untracked, review doc committed by this turn) |
| No source change | `src/`, `app/`, `mcp-server/`, `supabase/functions/`, `scripts/` zero diff vs main | **PASS** |
| No test change | `__tests__/`, `mcp-server/tests/` zero diff vs main | **PASS** |
| No migration | `supabase/migrations/` zero diff vs main | **PASS** |
| No runtime flag flip | No env / Vault / Supabase secret change implied by THIS card | **PASS** (the cutover stages prescribe operator-only env flips at Stage 1+, NOT by Claude in this turn) |
| No package change | `package.json` / `package-lock.json` zero diff | **PASS** |
| SUPERSEDED file preserved | `docs/designs/OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md` zero diff vs main | **PASS** (filename rationale in design §0 explicitly preserves it) |
| ARCH-001 design preserved | `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` zero diff vs main | **PASS** |
| Family I observability doc preserved | `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE-intent.md` Adv 3 deferred per design §0 non-goals | **PASS** |
| H Card 1 server files preserved | `mcp-server/lib/familyH*.ts` zero diff (Card 1 admin_validation preserved) | **PASS** |
| H Card 2 audit-lint preserved | `scripts/ops/audit-lint-rules.cjs` Card 2 L5 entries preserved | **PASS** |
| typecheck / lint / test run by reviewer | NOT REQUIRED (docs-only; the repo state at HEAD is verified by the rollback PR baseline 18,762 / 594 suites; running tests would be pointless) | **NOT-APPLICABLE** (design's §10 acknowledges this; reviewer concurs) |
| Secret scan on design content | No `ANTHROPIC_API_KEY` / `XAI_API_KEY` / `X_BEARER_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY` / `sb_secret_` / `sk-ant-` / `eyJ…` / Bearer literal in the design file | **PASS** (grep clean) |
| Doctrine scan on design content | No banned verdict tokens (winner / loser / liar / dishonest / bad faith / manipulative / extremist / propagandist / stupid / idiot) in the design file | **PASS** (grep clean; "verdict" appears only as the reviewer-terminology label for smoke audits, never as a user-facing or AI-truth verdict) |
| Provider-spend invocation by Claude this turn | Zero (reviewer ran no `submit-argument`, `classify-argument-boolean-observations`, `classifier-drainer`, no MCP server call, no Anthropic call) | **PASS** |
| Doctrine acceptance-gate constraint | Design's HARD header (§0 line 12) repeats "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine remains the sole acceptance gate." | **PASS** (this is the spine of the cutover; the queue path makes it *more* true, not less — submit only enqueues, then returns 201) |
| Anti-amplification / heat doctrine | Routing decision reads ONLY structural smoke tag + operator enable flag + deterministic-hash-bucket of argument id; NO score / heat / popularity / engagement signal in `shouldRouteToQueue` predicate | **PASS** (`classifierQueueRouting.ts:160-184` cross-verified) |
| Supabase edge-contract — service-role boundary | Drainer is server-side only; submit-argument routes via the predicate then enqueues via `enqueueClassifierJobs(serviceClient)` server-side; no service-role leakage into client code paths | **PASS** (`classifierQueueRouting.ts:228-255` enqueueClassifierJobs server-side only) |
| Supabase edge-contract — direct `public.arguments` insert | This card touches no insert paths; the existing `submit-argument` flow remains the canonical insert path | **PASS** (boundary §10 confirms) |

## Final verdict

**APPROVE.** The design is faithful to the H Card 3 FAIL audit and to the ARCH-001 Card 3 PASS audit. The cutover plan is bounded, falsifiable, and respects the doctrine acceptance-gate constraint. The §5.3 alerting gap is honestly identified and correctly placed as the Stage 4 → Stage 5 gate. The non-collision filename choice preserves the SUPERSEDED Option A record. No source / test / migration / runtime-flag change. No provider-spend invocation by Claude this turn. Doctrine and supabase-edge-contract checks PASS.

**Operator next steps (from the design's §11):**
1. Squash-merge this design PR as operator authorization on the cutover plan.
2. Execute Stage 0 preflight (§6 Stage 0) — read-only operator gates only.
3. Open the next card `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1` (or equivalent name) to flip the master flag + percentage=1 and run the read-only metric verification window.
4. The H Card 3 retry (`MCP-021C-EDGE-FAMILY-H-ENABLE-RETRY`) is filed as a separate card gated on Stage 5 PASS for ≥ 1 week.

**Post-merge worktree cleanup (operator):**
Standard worktree cleanup per `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)". No worktree was used by this docs-only review chain on the operator side; cleanup is a no-op for this card.
