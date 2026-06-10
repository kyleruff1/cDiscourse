# ARCH-001 Card 3 — GATE-C staged-arm smoke: canary + N=56 PASS-LOAD + PASS-LOAD-CONFIRM (2026-06-10)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-10
**Operator:** Kyler (each gate individually operator-approved on #552)
**Merges consumed (none made by this audit):** Card 3 design PR #553 (`6dfc7e8`, GATE-A docs-only) and Card 3 implementation PR #554 (`8046e08`, cron drain-tick migration `20260608000001` + burst regression test + staged-arm runbook) were already merged before this smoke. Main at `b1321ac` throughout; this audit changed no source, no migration, no config.
**Issue trail:** #552 (Card 3 tracker — preflight, arm, canary, PASS-LOAD, and PASS-LOAD-CONFIRM records posted as comments). Predecessor audit: `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` (pre-Card-3-merge tuning smoke).
**Scope:** First full GATE-C staged-arm execution per `docs/runbooks/ARCH-001-CARD3-staged-arm-runbook.md`: GATE-SEED verification (Vault already seeded 2026-05-31) → GATE-ARM-SMOKE-TAG (`CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0`) → canary (1 synthetic submit) → GATE-PASS-LOAD (N=56 = 8 args × 7 A–G families) → GATE-PASS-LOAD-CONFIRM (second independent N=56). Drainer constants unchanged: C=3, T=90 s, lease=130 s; cron tick `* * * * *` (jobid 13). A–G families only; H/I/J frozen `productionEnabled:false`.

**Verdict: PASS (PASS-LOAD and PASS-LOAD-CONFIRM both met at the canonical bar — 0 terminal dead-letters at N=56, twice consecutively).**

Headline results across the two drills (112 burst cells + 7 canary cells):

* **0 dead-letters / 0 failed_terminal across all 119 cells** — the canonical PASS-LOAD bar ("0 preferred", not "≤1%") was met without exception, improving on the 2026-05-31 pre-merge smoke (1/112 dead-letter, 0.893%).
* **Drill 1: 56/56 succeeded with zero retries** (`max attempt_count=1`) in ~172 s wall from first submit.
* **Drill 2: 56/56 succeeded with the retry path exercised and proven** — 3 transient cells (1 `provider_network_error`, 2 `provider_api_error`) recovered to success at attempt 2 under the Card-3 backoff schedule; 0 cells exhausted retries; settle ~146 s.
* **0 H/I/J rows created anywhere** in the smoke; the #523 historical tripwire count (7 `claim_clarity` rows, all 2026-06-01 01:20:49→01:24:10 UTC) was byte-identical before and after.
* **0 organic routed rows at PCT=0** — re-verified before and after each drill; every non-smoke submit stayed on direct dispatch.
* **0 overlapping drain invocations; kick coalescing held** (drill 1: 9 `skipped_single_flight`; drill 2: 8) and the multi-invocation drain shape appeared as designed (a T=90 s `partial` 47-job drain + completed finishers in both drills).

---

## Phase 0 — preflight + state verification (read-only)

**Status:** PREFLIGHT_OK

| Check | Result |
|---|---|
| Primary guard | main `b1321ac` == origin/main, 0 tracked mods, before each gate |
| Migration `20260608000001_arch_001_card3_cron_drain_tick` | applied on linked project (remote migration list readback) |
| Cron tick | `arch-001-classifier-drain-tick` jobid 13, `* * * * *`, active; deployed `cron.job.command` contains the null-URL guard and runtime `vault.decrypted_secrets` reads; 120/120 succeeded runs in the 2 h pre-arm window |
| `classifier-drainer` Edge Function | ACTIVE v172, `verify_jwt=false`; `CLASSIFIER_DRAIN_SHARED_SECRET` set and behaviorally proven (per-minute `completed` `classifier_drain_audit` rows, no 401 cluster) |
| Vault seed | both names present (`arch_001_classifier_drainer_url`, `arch_001_classifier_drainer_secret`, created 2026-05-31); names read only — values never selected |
| Pre-arm routing state | `CLASSIFIER_QUEUE_ROUTING_ENABLED` digest-matched literal `false`; `PERCENTAGE` digest-matched `0` |
| Queue baseline | pending/leased/retry_scheduled/stale = 0; terminal rows historical only (124 failed_terminal ≤2026-05-30; 14 dead_letter ≤2026-06-03) |
| H/I/J registry | `productionEnabled:false` for all three in `familyRegistry.ts` on main |

## Phase A — GATE-ARM-SMOKE-TAG (operator-approved arm)

**Status:** ARMED_VERIFIED

`CLASSIFIER_QUEUE_ROUTING_ENABLED=true` + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` set 2026-06-10T03:21:14Z via `supabase secrets set` (PAT lane; values never printed). Post-set readback: both secret value digests match the SHA-256 of the literals `true` / `0`. Smoke-tag-only contract: routing applies solely to `[arch-001-queue-smoke]`-titled rooms; the hash-bucket organic path is inert at PCT=0.

## Phase B — canary (routing-path gate)

**Status:** PASS

One synthetic `[arch-001-queue-smoke]` thesis via production `submit-argument` (admin bot lane from `.env.bot-tests`; no service-role; no direct insert). `canary-completeness.sql` readback:

| Gate | Observed |
|---|---|
| Queue cells | 7/7 A–G, `family IS NOT NULL`, `run_mode='production'` |
| `family=NULL` rows | 0 |
| H/I/J rows | 0 |
| Terminal state | 7/7 `succeeded`, `attempt_count=1` |
| Submit latency | 2958 ms (cold-start after secrets-set redeploy; same shape as the 2026-05-31 canary's 3177 ms) |
| Wall to settle | first run row 03:21:18.5 → last completed 03:21:40.7 UTC ≈ 22.2 s |
| Drain audit window | 3 `completed`, 0 `skipped_single_flight` |

## Phase C — GATE-PASS-LOAD, drill 1 (N=56)

**Status:** PASS

8 synthetic smoke-tagged theses (8 fresh rooms) posted in a 13.9 s window (03:39:30.5→03:39:44.4 UTC); 8/8 HTTP 201; submit latency min/p50/max = 1317/~1597/2477 ms. Poll-to-settle at 5 s cadence, settled 03:42:22.5 UTC (~172 s from first submit).

| Gate | Observed |
|---|---|
| Cells | 56/56 present; each of 8 args exactly the 7 A–G families |
| Terminal | 56/56 `succeeded`; 0 dead_letter; 0 failed_terminal; 0 unresolved non-terminal |
| Retries | 0 (`max attempt_count=1`) |
| Duplicate success | 0 (`argument_id × family × run_mode` unique) |
| `family=NULL` / H/I/J / organic routed | 0 / 0 / 0 |
| Drain shape | 1 `partial` (47 jobs, T=90 s budget yield) + 1 `completed` (9 jobs); 0 overlapping drains; 9 `skipped_single_flight` |
| Provider rate | ≈56 calls / 170 s ≈ 19.8/min (Tier-1 50 RPM unapproached; C=3 consistent) |
| Result rows | 113 persisted result rows inspected by scan: 0 banned verdict tokens, 0 secret-shape strings |

## Phase D — GATE-PASS-LOAD-CONFIRM, drill 2 (independent N=56)

**Status:** PASS

8 new synthetic theses (8 new rooms), submit window 14.0 s (04:31:01.3→04:31:15.2 UTC); 8/8 HTTP 201; latency min/p50/max = 1338/~1716/2553 ms. Settled 04:33:29.5 UTC (~146 s from first cell).

| Gate | Observed |
|---|---|
| Cells | 56/56; each arg exactly the 7 A–G families; per-family 8/8 succeeded ×7 |
| Terminal | 56/56 `succeeded`; 0 dead_letter; 0 failed_terminal |
| Retry path | 3 transient cells (`provider_network_error` ×1: disagreement_axis; `provider_api_error` ×2: parent_relation, resolution_progress) recovered at attempt 2; `max attempt_count=2`; 0 retry exhaustion |
| Duplicate success | 0 |
| `family=NULL` / H/I/J / organic routed | 0 / 0 / 0 |
| Drain shape | 1 `partial` (47 jobs) + 2 `completed` (12 jobs; 56 cells + 3 retry re-processings = 59 ✓); 0 overlapping drains; 8 `skipped_single_flight` |
| Result rows | 112 persisted result rows inspected by scan: 0 banned verdict tokens, 0 secret-shape strings |

## Phase E — leak-safety + doctrine scan

**Status:** PASS

Every drain-audit row in both burst windows, every run row for the 15 smoke arguments (canary + 16 burst args), and all 225 persisted result rows were scanned by SQL regex for `Bearer `, `sk-ant`, `sb_secret`, `xai-…`, JWT shape, and the banned verdict-token list (winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist): **0 hits in every scan**. Harness artifacts (`.claude-tmp/queue-smoke-burst.cjs`, arg-id lists, burst summaries) are gitignored and contain short ID prefixes and counts only — no bodies, no evidence spans, no JWTs, no emails, no provider payloads. The submit path's acceptance decision remained solely `src/lib/constitution/engine.ts` validation (all 16 submits accepted pre-fork; classification strictly post-storage and advisory).

## Disposition

* **PASS-LOAD and PASS-LOAD-CONFIRM are both recorded as PASS** on #552 (comments of 2026-06-10). The Card-3 queue architecture is load-proven at the canonical bar: 0 terminal dead-letters across two consecutive independent N=56 drills.
* **Routing state at audit close:** armed smoke-tag-only (`ENABLED=true`, `PERCENTAGE=0`). Organic traffic untouched throughout — 0 routed organic rows since arming.
* **Next step per the staged-arm ladder:** Step 4 (Organic 1%) is a separate operator card with its own authorization; nothing in this audit advances it. Disarm remains a one-flag revert (`CLASSIFIER_QUEUE_ROUTING_ENABLED=false`).
* H/I/J remain `productionEnabled:false`; #394 untouched; #523 historical rows untouched (still exactly 7, window 2026-06-01 01:20:49→01:24:10 UTC).
