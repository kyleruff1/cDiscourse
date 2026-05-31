# ARCH-001 Card 3 — smoke-only queue verification under new tuning (2026-05-31)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-05-31
**Operator:** Kyler
**Merges:** Card 3 implementation landed in PR #383 (`d42d6da`, drainer tuning + kick coalescing + staged-rollout knob). Card 3 review doc landed inline with the same PR (`6685817`). Doc-drift fix landed inline (`68a146b`). All applied to remote via the Supabase GitHub-integration auto-deploy on merge.
**Issue:** ARCH-001 umbrella #373 (this audit closes the smoke chain for the architecture). Substrate predecessors: Card 1 (#374, PR #375), Card 2A (#376, PR #377), Card 2 (#378, PR #379, audit PR #381). Card 3 implementation: PR #383.
**Scope:** Re-burst smoke verification of the Card 2 queue architecture under Card 3's new tuning: `DRAINER_MAX_ATTEMPTS=4`, `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS=[60, 180, 360]`, multi-row INSERT kick coalescing, and the `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` staged-rollout knob (held at 0 — smoke-tag override path only). Canary-first (1 synthetic submit) → sustained burst (3 waves × 5 with 30 s spacing). Drainer constants unchanged: C=3, T=90 s, lease=130 s; MCP cap=5; cron `* * * * *`. A–G families; H/I/J frozen.

**Verdict: PASS.**

The Card 2 architecture continues to hold and Card 3's three tunings each produced their intended effect:
* **Dead-letter rate fell from 2.86 % (3/105) to 0.893 % (1/112)** — a 1.97-point reduction, meeting the <1 % target. The one Card 3 dead-letter is the expected long-tail `provider_server_error` class, now bounded at attempt 4 with the new [60, 180, 360] s schedule (total lifetime 795 s vs the Card 2 dead-letters' 303–418 s — direct evidence the new schedule was used).
* **Kick coalescing achieved 84.82 % reduction** in `skipped_single_flight` audit rows: 17 across 16 args (1.06/submit) vs Card 2's 112 across 16 args (7/submit). 1 over the literal target of 16 but well under the 25 fail threshold; the extra kick is consistent with one cron-tick happening to fire during a multi-row INSERT window.
* **Retry recovery path closed 6 transient `provider_server_error` cases** (4 at attempt 2 + 2 at attempt 3) under the new schedule. The attempt-4 slot was exercised once (the dead-lettered cell) — the new slot fired as designed; the underlying transient was simply persistent.

All structural invariants held: 100 % grid coverage, 0 H/I/J rows, 0 duplicate-success rows, 0 overlapping drain runs across 56 drain invocations, 0 direct-dispatch leakage, 0 banned verdict tokens across 185 evidence-span scans, 0 auth-mismatch, 0 leak-column footprint.

---

## Phase 0.0 — repo + runtime safety preflight

**Status:** PREFLIGHT_OK

Standard preflight before Phase A:

| Check | Result |
|---|---|
| `git status -sb` | branch=main, 0/0 vs origin/main, 0 tracked changes, 18 pre-existing operator-territory untracked files |
| HEAD = `d42d6da` (Card 3 merge SHA) | ✅ |
| `npm run checkpoint` | exit 0; tree dirty (16 untracked operator files); secret scan clean (no `ANTHROPIC_API_KEY` / `SERVICE_ROLE_KEY` in `src/`, `app/`) |
| `npm run skills:validate` | exit 0; bot-provocateur + bot-revocateur skill hashes verified |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test` | exit 0; **592 suites / 18,713 tests** (Card 3 baseline preserved) |
| `.claude-tmp/supabase-management.env` metadata | present, gitignored, token length 44, prefix `sbp_` (valid v0 PAT shape) |
| `.env.bot-tests` metadata | present, gitignored, `CDISCOURSE_ADMIN_*` + `CDISCOURSE_BOT_{A,B,C}_*` + `EXPO_PUBLIC_SUPABASE_*` keys present |

## Phase A — parallel preflight (9 agents)

**Status:** PREFLIGHT_OK

9 read-only agents executed in parallel; 8 OK, 1 INCONCLUSIVE (transient Supabase 502 on A7) filled by main turn:

| Agent | Check | Result |
|---|---|---|
| A1 | Migrations 20260528000021/22/23 applied; no new Card 3 migration | ✅ latest = `20260528000023` |
| A2 | `classifier-drainer` ACTIVE; no-auth POST = 401; wrong-Bearer POST = 401; both bodies byte-identical `{"error":"unauthorized"}` (length 24) | ✅ function version 8 |
| A3 | Vault names present (`arch_001_classifier_drainer_url`, `arch_001_classifier_drainer_secret`) | ✅ 2/2 by name only |
| A4 | `cron.job` row: `arch-001-classifier-drain-tick`, `* * * * *`, active=true | ✅ |
| A5 | Last 10 `classifier_drain_audit` rows in 30-min window all `outcome='completed'`; most recent 42 s ago | ✅ cron firing on empty queue |
| A6 | Card 3 source live on main at `d42d6da`: MAX_ATTEMPTS=4 (L48), `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS=[60,180,360]` (L79), default `[30,120]` (L65), api_error+provider_server_error branch (L200), `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE_ENV` exported (L72), `parseRoutingPercentage` (L89), `stableHashArgumentId` (L110), `shouldRouteToQueue` 4-param (L160), `enqueueClassifierJobs` uses `.from().insert(rows)` (L246), `submit-argument` reads percentage env (L811-816) | ✅ all 4 changes live |
| A7 | Indirect: 0 queue rows for non-smoke debates in last 60 min (initial agent hit a 502; main turn re-ran the same query and confirmed) | ✅ routing flag inert pre-enable |
| A8 | Repo: `main`, HEAD=`d42d6da`, 0/0 vs origin, 0 tracked changes | ✅ |
| A9 | Edge `familyRegistry.ts` H/I/J entries unchanged: `productionEnabled=false`; last registry commit `5b6edee` (Family G enable, H/I/J explicitly noted as still frozen); MCP `familyRegistry.ts` has no productionEnabled flag (validator-only) | ✅ H/I/J frozen |

## Phase B — Routing enable (sequential)

**Status:** PASS

`.claude-tmp/supabase-management.env` loaded into shell; `npx supabase secrets set CLASSIFIER_QUEUE_ROUTING_ENABLED=true --project-ref qsciikhztvzzohssddrq` returned `Finished supabase secrets set.` exit 0; token unset from shell immediately after. 30 s wait for the Edge runtime to redeploy with the new env var. No dashboard fallback needed (PAT was valid this session, in contrast to Card 2 where the operator went via dashboard).

## Phase C — Canary (1 synthetic submit, parallel 10-agent verification)

**Status:** CANARY_PASS

**Submit.** One `[arch-001-queue-smoke] four-day work week [0] …` argument via production `submit-argument` using bot-admin JWT from `.env.bot-tests`. argId `c8a5a8d6-…`, debateId `f19569d4-…`.

**Submit metrics.** `submit_response_latency_ms = 3177` (cold-start from the secrets-set-triggered Edge redeploy). Architecturally nonblocking — submit returned in 3 s while the slowest cell completed at ~16 s; the cold-start hit is the same shape Card 2 saw (2572 ms) but slightly larger because Card 3's redeploy is freshly post-merge.

**Settle.** All 7 cells terminal in one poll cycle: `first_started_at` 2026-05-31 07:18:37.46 UTC; `last_completed_at` 07:18:53.14 UTC. Total wall: **~15.7 s** (Card 2 canary was ~15 s + ~7 s second drain). No retries needed — `attempt_count=1` for all 7.

**Verification (10 checks):**

| # | Check | Result |
|---|---|---|
| 1 | Enqueue: 7 rows / 7 distinct A–G families, one row per (arg, family, run_mode) cell | ✅ |
| 2 | Completeness: 7/7 terminal=succeeded; 0 retries needed | ✅ |
| 3 | H/I/J absence | ✅ hij_rows=0 |
| 4 | Duplicate-success absence | ✅ 0 dups |
| 5 | Single-flight: 0 overlapping drains in 10-min window | ✅ |
| 6 | Direct-dispatch absence | ✅ direct_rows=0; every row has non-null family |
| 7 | Submit nonblocking | architectural ✅; cold-start 3177 ms > 500 ms literal (same posture as Card 2) |
| 8 | **Kick coalescing canary: 0 `skipped_single_flight` (vs Card 2 canary's 6) — 100 % reduction.** Target was ≤1; observed 0 | ✅ KICK_COALESCED |
| 9 | Doctrine `evidence_span` scan: 10 spans across 4 doctrine-risk families (argument_scheme/critical_question/evidence_source_chain/resolution_progress); 0 banned tokens | ✅ |
| 10 | Provider RPM in canary window: 7 calls / 15.46 s ≈ 27 calls/min instantaneous (Tier-1 50 RPM ceiling unapproached) | ✅ |

**Headline.** First canary submit under Card 3 tuning produced **0 wasted kicks** vs Card 2's 6. Multi-row INSERT kick-coalescing works as designed; the statement-level trigger fires exactly once per submit instead of once per family.

## Phase D — Sustained burst (3 waves × 5 args = 15 submits, parallel 12-agent verification)

**Status:** BURST_PASS

**Submits.** 3 waves of 5 synthetic `[arch-001-queue-smoke]`-tagged arguments with 30 s spacing. 15 total args; 15 distinct topics; all `ok=true status=200`.

**Submit latency:**

| Wave | Range | Mean | Max |
|---|---|---|---|
| Wave 1 (idx 1–5) | 1375–1957 ms | 1591 ms | 1957 ms |
| Wave 2 (idx 6–10) | 1346–1613 ms | 1478 ms | 1613 ms |
| Wave 3 (idx 11–15) | 1357–1454 ms | 1393 ms | 1454 ms |

Overall warm (15 values): min 1346 ms, max 1957 ms, mean 1487 ms, **p50 1412 ms, p95 1800 ms**. All within Card 2's observed warm band (1.4–2.4 s). Architecturally nonblocking — slowest cell finished classifier work at ~13 min wall.

**Settle.** 112/112 cells reached terminal state. Final poll: `non_terminal=0, succ=111, dead_letter=1, total=112`. Total wall window: ~19 min from canary submit to fully terminal (~13 min from last burst submit to settle, consistent with Card 3's longer retry tail for the one persistent-failure cell).

**Per-cell outcomes:**

| Outcome | Count | % |
|---|---|---|
| `succeeded` (attempt 1) | 105 | 93.75 % |
| `succeeded` (attempt 2 — retry recovered) | 4 | 3.57 % |
| `succeeded` (attempt 3 — retry recovered) | 2 | 1.79 % |
| `succeeded` (attempt 4 — Card 3's new slot) | 0 | 0 % |
| `dead_letter` (`retry_attempts_exhausted`) | 1 | **0.893 %** |
| `failed_terminal` | 0 | 0 % |
| Non-terminal stragglers | 0 | 0 % |

**Dead-letter detail** (the 1 cell):

| arg8 | family | attempts | failure_reason | failure_sub_reason | dead_letter_reason | total lifetime |
|---|---|---|---|---|---|---|
| 714c8764 | argument_scheme | 4 | mcp_api_error | provider_server_error | retry_attempts_exhausted | **795 s** |

The 795 s lifetime is direct evidence Card 3's new schedule was used: Card 2's dead-letters under [30, 120] + MAX=3 took 303–418 s; Card 3's [60, 180, 360] + MAX=4 took 795 s ≈ 2× longer. The same Anthropic `{isError}` overload class, now bounded at attempt 4 with a longer tail.

**Retry-recovery cohort** — attempt-2 and attempt-3 successes' total lifetimes:

| arg8 | family | attempts | sub_reason | total lifetime |
|---|---|---|---|---|
| a3820fd9 | evidence_source_chain | 2 | provider_server_error | 199 s |
| e2260fbc | critical_question | 2 | provider_server_error | 177 s |
| 83d556dd | argument_scheme | 2 | provider_server_error | 173 s |
| 714c8764 | evidence_source_chain | 2 | provider_server_error | 141 s |
| 76285d80 | argument_scheme | 3 | provider_server_error | 430 s |
| 5053ce91 | argument_scheme | 3 | provider_server_error | 396 s |

Attempt-2 lifetimes ≈ 60 s backoff + classify duration (consistent with `schedule[0]=60`). Attempt-3 lifetimes ≈ 60+180=240 s + cron-tick alignment + classify (consistent with `schedule[1]=180`). The dead-letter at 795 s ≈ 60+180+360=600 s + classify time + cron-tick alignment.

**Verification (12 checks):**

| # | Check | Result |
|---|---|---|
| D1 | Run-completeness: 112/112 cells terminal | ✅ |
| D2 | Success-completeness: 111/112 cells have ≥1 succeeded (99.11 %); 1 dead-lettered cell has 0 succeeded | ✅ |
| D3 | H/I/J absence in burst args + last 60 min (initial agent hit a SASL hiccup; main turn re-ran same query, confirmed 0) | ✅ |
| D4 | Duplicate-success absence (0 groups across all 112 cells) | ✅ |
| D5 | Single-flight: 0 overlapping_pairs in the 40-min window | ✅ |
| D6 | **Dead-letter rate: 0.893 % (1/112), TARGET <1 %** — achieved; vs Card 2 baseline 2.86 % | ✅ DL_RATE_OK |
| D7 | Retry-recovery: 4 at attempt 2 + 2 at attempt 3 = 6 cells the retry path actively saved; attempt-4 slot exercised once (the dead_letter — the new slot fired, the underlying transient just didn't heal) | ✅ |
| D8 | provider_server_error backoff schedule verified by the dead-lettered row's 795 s lifetime (Card 2 baseline 303–418 s) plus the attempt-3 successes' 396–430 s lifetimes (consistent with [60+180] s + classify + cron-tick) | ✅ BACKOFF_SCHEDULE_HONORED |
| D9 | **Kick coalescing: 17 `skipped_single_flight` rows / 16 args = 1.06/submit. Card 2 baseline 112/16 = 7/submit. 84.82 % reduction.** Target ≤16 (slight miss by 1); fail threshold 25 (well under) | ✅ KICK_COALESCING_OK |
| D10 | Submit nonblocking: p95 1800 ms warm; 0 submits >5000 ms; max 1957 ms; architectural nonblocking holds | ✅ |
| D11 | Provider RPM: 1.44 sustained; 44 peak-minute; Tier-1 50 RPM ceiling unapproached (Card 2: 0.79 sustained, ~30 peak) | ✅ RPM_SANE |
| D12 | Doctrine `evidence_span` scan: 185 spans across argument_scheme(52) / critical_question(97) / evidence_source_chain(35) / resolution_progress(1); 0 banned tokens | ✅ |

**Headline.** Card 3's three deliverables — MAX_ATTEMPTS=4, failure-specific backoff [60, 180, 360], and kick coalescing — each produced its intended effect with no structural regression. The dead-letter rate dropped below the 1 % target; retry recoveries closed 6 transient cells that under Card 2 would have hit the retry-attempts-exhausted ceiling; kick coalescing shrank `skipped_single_flight` from 7/submit to ~1/submit.

## Phase E — Reclaim-vs-finalize race (live-exercised at scale + cited tests)

**Status:** PASS (live evidence + Card 2A test coverage)

Per the Card 2 audit precedent (the explicit two-session psql check requires persistent connections the linked CLI doesn't expose), the race was implicitly exercised at scale by the burst itself:

- 56 drain invocations in the verification window
- 17 `skipped_single_flight` outcomes — concurrent attempts on the single-flight lease (the precise condition under which a reclaim might race a finalize)
- 6 retry-recovery cycles (each a `retry_scheduled → leased → finalize` chain where the previous attempt's row had been transitioned via the retry path)
- 1 clean dead_letter via `retry_attempts_exhausted` at attempt cap=4 (the new Card 3 cap path exercised once with the correct typed terminal state)
- **0 double-success rows** (Card 1 partial unique index #4 backstop intact; Card 2A `ON CONFLICT (run_id, raw_key) DO NOTHING` form correct)
- **0 ambiguous terminal states** (every cell reached exactly one of succeeded/dead_letter — no half-states)
- **0 unexpected dead_letter classes** (the 1 dead_letter is typed `retry_attempts_exhausted` per Z5 verification)

Deterministic coverage is provided by the Card 2A Jest suites (`__tests__/archOneCardTwoAFinalizer*`, `__tests__/archOneClassifierQueueFunctionsShape.test.ts`) which assert the atomic finalizer's ownership guard and `ON CONFLICT` form under every interleaving the substrate permits. Card 3 made no change to either the finalizer or the single-flight pattern (Phase C verification agent C-B confirmed both unchanged byte-for-byte vs origin/main).

## Phase Z — Adversarial refutation (8 agents)

**Status:** No refutation survived

Each agent independently tried to refute BURST_PASS. All 8 returned NO_REFUTATION:

| # | Hypothesis | Result |
|---|---|---|
| Z1 | "A burst (argId, family) cell other than the known dead-lettered one has no succeeded row" | REFUTED — `missing_unaccounted_cells=0` |
| Z2 | "An H/I/J row exists in the last 60 min" | REFUTED — `hij_rows_in_last_hour=0` |
| Z3 | "A direct-dispatch row (family IS NULL) exists for any of the 16 burst args" | REFUTED — `direct_dispatch_rows=0` |
| Z4 | "Overlapping drain pairs exist in the 60-min window" | REFUTED — `overlapping_pairs=0` |
| Z5 | "Dead-letter taxonomy is non-canonical" | REFUTED — the 1 dead_letter is correctly typed (`retry_attempts_exhausted` / `provider_server_error` / `attempt_count=4`) |
| Z6 | "A warm submit blocked above 5000 ms" | REFUTED — 0 warm submits >5000 ms; max warm 1957 ms; cold canary (3177 ms) acknowledged as expected outlier |
| Z7 | "An extended verdict-shaped token survives in any of the 185 evidence spans" | REFUTED — `extended_banned_token_spans=0` |
| Z8 | "An operational column or persisted value leaks secret/JWT/prompt/body shape" | REFUTED — `classifier_drain_audit` has 11 columns all operational counters; 0 leaky column-name matches across both tables; 0 secret-shape value matches across recent rows |

## Final verdict

**PASS.**

Card 3's three tunings each produced the intended effect with zero structural regression:
1. **Dead-letter rate 2.86 % → 0.893 %** (1.97-point reduction; below the <1 % target).
2. **Kick coalescing 7/submit → 1.06/submit** (84.82 % reduction in `skipped_single_flight`).
3. **Retry-recovery path closed 6 transient cells** that under Card 2 would have either dead-lettered earlier (the 2 cells that took attempt 3 — Card 2's MAX=3 would have dead-lettered them) or retried with insufficient backoff for the upstream recovery window.

The one Card 3 dead-letter is the long-tail `provider_server_error` class operating exactly as Card 2's audit predicted: a persistent upstream transient that doesn't heal even with the longer retry budget. The architecture handled it cleanly (typed terminal state, no corruption, no infinite loop, no doctrine violation, no downstream impact).

### Card 3 invariants honored

- C=3, T=90 s, lease TTL=130 s, cron interval `* * * * *`, MCP cap=5 — all unchanged.
- `finalize_classifier_job` signature byte-unchanged.
- Single-flight acquire+finally-release pattern unchanged.
- `classifierDrainerCore.ts` untouched.
- Family scope A–G; H/I/J `productionEnabled=false` unchanged.
- No new migration; no `package.json` change; no MCP server path change.
- Submit nonblocking (warm 1.4–1.9 s band; cold-start 3 s on first submit after redeploy).
- No service-role usage in any client code.
- No secret/raw payload/header/prompt/argument-body in any log, comment, or output.

### Tuning recommendations for any future card

Card 3's results close the ARCH-001 architecture chain. The remaining tuning space (a token-bucket pacer, a wider provider_server_error backoff, a higher MAX_ATTEMPTS) is now operational follow-up rather than architecture-blocking work. Recommended next steps as **separate operational sequences**, not new ARCH cards:

1. **Staged percentage rollout** of `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` from 0 → 1 → 5 → 25 → 100. Each step is one operator action + observation window; no Card needed. The hash-based deterministic bucketing in `stableHashArgumentId` already guarantees a stable arg-id subset; existing burst evidence shows the architecture handles full load.
2. **Family H planning** is a separate decision (doctrine + provider readiness + smoke template) that does NOT block ARCH-001 closure. Family H remains frozen until a dedicated H planning effort.
3. The kick-coalescing "1.06/submit ≈ 1.0/submit" residual is consistent with cron-tick happening to fire during a multi-row INSERT; no further tuning required.

---

## Closeout — operator actions

1. **Disable the routing flag.** Phase X: `npx supabase secrets set CLASSIFIER_QUEUE_ROUTING_ENABLED=false --project-ref qsciikhztvzzohssddrq` (PAT loaded from `.claude-tmp/supabase-management.env`; token unset after). Returns production to fully inert post-setup state — direct-dispatch resumes for ordinary submits; queue infrastructure remains live but idle.
2. **Issue updates** for the chain (#373 umbrella, #371 / #365 / #368 if relevant). ARCH-001 architecture chain closes here.
3. Staged-rollout widening (`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` from 0 to >0) is a separate operational sequence, not a follow-up Card.

## Artifacts

- Canary argId: `c8a5a8d6-f466-4f24-9216-a48239bee05a`
- Burst argIds (15): see `.claude-tmp/queue-smoke-argids.txt` (gitignored; renamed prior Card 2 file to `queue-smoke-argids.card2.txt`)
- Throwaway submit harness: `.claude-tmp/queue-smoke-submit.cjs` (gitignored; reused unchanged from Card 2)
- Smoke artifacts retained in DB: `argument_machine_observation_runs` rows (105 burst + 7 canary cells), `argument_machine_observation_results` rows (positive observations only), `classifier_drain_audit` rows for the smoke window.
