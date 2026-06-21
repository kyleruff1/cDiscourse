# ARCH-001 — MCP retry-budget fix (provider_server_error class-specific cap)

**Status:** Implemented (Edge-only); PR open, stops at GATE-MERGE.
**Tracking issue:** #552 (ARCH-001 Card 3 — production smoke + staged rollout / burst fix).
**Trigger:** Family I D3 GATE-SPEND production smoke FAILED on 2026-06-21 (recorded append-only on closed #394).
**Classification:** **A — `EDGE_QUEUE_RETRY_BUDGET_UNDERPROVISIONED`** (provider-side Anthropic `{isError}` overload, C-flavored). Adversarially verified; NOT B (hosted-MCP Deno defect), NOT D (Family-I defect).
**Lane boundary:** Edge-only retry-policy/backoff change. No mcp-server change, no migration, no registry/subset change, no queue percentage change, no productionEnabled flip, no Family-I rollback. D3 re-smoke is a SEPARATE GATE-SPEND (not in this PR).

---

## 1. Evidence summary

Family I D3 (2026-06-21) ran two independent canaries through production `submit-argument` into smoke-tagged rooms (queue-routed; `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `PERCENTAGE=100`). Each canary = 1 target argument → 9 production family cells (A–I).

- **Both canaries dead-lettered the SAME 3 families:** `argument_scheme` (E), `resolution_progress` (G), `thread_topology` (I). 12/18 target cells succeeded, 6/18 dead-lettered.
- **All 6 dead-letters:** `failure_detail.reason = mcp_api_error`, `failure_sub_reason = provider_server_error` (the Edge buckets the hosted-MCP `{isError}` / Anthropic-overload envelope here), `dead_letter_reason = retry_attempts_exhausted`, `attempt_count = 4`.
- **Zero Family-I-defect signals:** 0 `mcp_validation_failed`, 0 `unsupported_rawKey`, 0 deterministic Family-I key leak (15 excluded keys absent), 0 J (`sensitive_composer`) rows, 0 `family=NULL` (all queue-routed). Subset entry intact. Doctrine/leak scan clean (85 result rows, 0 verdict/secret tokens).
- **Not a per-family defect (history, `public.argument_machine_observation_runs`):**
  - `argument_scheme` succeeded-on-retry **8×**; `resolution_progress` **1×** (2026-06-10); `thread_topology` **3×** (2026-06-10..06-14). Retries DO clear these families.
  - `resolution_progress` and `thread_topology` had **zero dead-letters before this D3 window** — their only-ever dead-letters are the 2 D3 canaries.
  - Dead-letters historically spread across families (argument_scheme 13, critical_question 3, claim_clarity 2, disagreement_axis 1, evidence_source_chain 1) — including `critical_question`, which SUCCEEDED in D3.
  - The failing set does **not** correlate with prompt size: the largest family (`critical_question`, ~53 KB) succeeded; the near-smallest (`thread_topology`, ~34 KB) failed. Adversarial code review confirmed E/G/I share identical `MAX_TOKENS=1500`, the same `callAnthropic` skeleton, and family-agnostic validation — no per-family deterministic path.

**Conclusion:** a genuine ~13–15 min provider-side Anthropic overload transient out-lasted the current ~10 min (4-attempt) retry budget. The 2026-06-14 PARTIAL (1 cell, ~899 s) was the same class; 06-21 was a WIDER instance (3-cell cluster across two ~13-min windows, each exhausting the budget edge).

## 2. Current retry model

`supabase/functions/_shared/booleanObservations/classifierDrainerRetryPolicy.ts` (pure, Deno + Jest-bridge tested):
- `DRAINER_MAX_ATTEMPTS = 4` — total attempts for any retryable class.
- `RETRYABLE_REASONS = {network_error, rate_limited, api_error}`. `api_error` "covers the `{isError}` provider_server_error envelope."
- `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS = [60, 180, 360]` — class-specific schedule selected by `reason==='api_error' && subReason==='provider_server_error'`; every other retryable class uses `DRAINER_RETRY_BACKOFF_SECONDS = [30, 120]`.
- `classifyDrainerFailure(reason, attemptCount, subReason)` gates `attemptCount < DRAINER_MAX_ATTEMPTS → retry` else `dead_letter`. Contract failures (validation_failed / parse_failure) and config failures (url/token_missing) are bounded/terminal and never dead-letter.
- The Card-1 substrate `reclaim_stale_leases` cap (`max_attempts := 3`, migration `20260528000021`) is an INDEPENDENT lease-expiry backstop; unchanged.

`classifierDrainerCore.ts` calls `classifyDrainerFailure` and reads only `decision.disposition` — it does **not** read `DRAINER_MAX_ATTEMPTS` directly (`coreNeedsChange = false`).

## 3. Fix decision

**Narrowest viable fix: a `provider_server_error`-SPECIFIC attempt cap + one extra backoff tier, leaving every other class byte-identical.** This is tighter than the prior `ARCH-001-CARD3-RETUNE.md` draft (which bumped the GLOBAL `DRAINER_MAX_ATTEMPTS 4→5`): only the proven-problematic class gets more budget; `network_error` / `rate_limited` / generic `api_error` and all non-retryable classes are unchanged — so the `DRAINER_MAX_ATTEMPTS=4` pins (RP-1/C3-RP-1) and the network/rate dead-letter-at-4 pins (RP-5/RP-6) stay green.

Explicitly NOT changed: response `MAX_FLAGS_PER_RESPONSE=20`; D/G/I key counts; the registry / subset entry; the staged-rollout percentage; concurrency `C=3`; tick `T=90s`; lease TTLs; `reclaim_stale_leases` cap (3); contract/config failure handling. No Deno/mcp-server change (the MCP server correctly surfaces Anthropic overload as a retryable error; classification A, not B).

## 4. Candidate implementation (this PR)

`supabase/functions/_shared/booleanObservations/classifierDrainerRetryPolicy.ts`:
1. **New constant** `DRAINER_PROVIDER_SERVER_ERROR_MAX_ATTEMPTS = 5` (provider_server_error-only cap; default stays 4).
2. **Extend** `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS` `[60,180,360] → [60,180,360,600]` (4 transitions = cap-1).
3. **Gate** in `classifyDrainerFailure`: compute `isProviderServerError = reason==='api_error' && subReason==='provider_server_error'`; `maxAttempts = isProviderServerError ? DRAINER_PROVIDER_SERVER_ERROR_MAX_ATTEMPTS : DRAINER_MAX_ATTEMPTS`; gate on `attemptCount < maxAttempts`. Schedule selection reuses the same flag. All other branches unchanged.
4. Doc-comments updated to cite the 06-21 evidence.

`__tests__/_helpers/classifierQueueCard2Deno.ts`: re-export the new constant through the Deno→Jest bridge.

**Sizing (evidence-selected):** cap 5 + `[60,180,360,600]` → worst-case backoff 1200 s (~20 min), realized lifetime ~26 min once per-attempt call (≤30 s) + cron re-claim (~60 s) latency are added — ~2× the observed ~13–15 min transient. The `+600` tail (vs the prior draft's minimal `+360`) is sized for the WIDER 06-21 event. A genuinely-dead provider still terminates at attempt 5. Budget tied to the `provider_server_error` class only, so the extra provider call is incurred ONLY by long-tail overload cells (≤1 in 72 historically), never by healthy traffic.

## 5. Acceptance tests (all passing in this PR)

`__tests__/archOneCardThreeTuningAndRollout.test.ts`:
- **C3-RP-3** — schedule is `[60,180,360,600]`.
- **C3-RP-4** — provider_server_error retries attempts 1–4 with backoff `60/180/360/600`.
- **C3-RP-5** — provider_server_error RETRIES at attempt 4 (+600) and dead-letters only at attempt 5 (`retry_attempts_exhausted`).
- **C3-RP-5b** — cap is 5, > default 4, and the schedule has exactly cap-1 entries.
- **C3-RP-5c (isolation)** — at attempt 4: provider_server_error retries, while `network_error`, `rate_limited`, and a non-provider_server_error `api_error` sub-reason all dead-letter (cap change is scoped).
- Unchanged & green: C3-RP-1 (`MAX_ATTEMPTS=4`), C3-RP-2 (`[30,120]`), C3-RP-6/7/8 (other classes), C3-RP-9 (contract bounded), C3-RP-11 (doctrine: numbers only).

`__tests__/archOneCardTwoRetryPolicy.test.ts` unchanged & green: RP-1 (cap 4), RP-5/RP-6 (network/rate dead-letter at 4), RP-7 (provider_server_error retryable), RP-15 (never throws), RP-16 (doctrine ban-list). Broader affected suites green (drainer-core, burst-concurrency incl. BAN-4, admin-classifier-health ×3, finalizers, routing-predicate).

## 6. Post-merge gate

- **GATE-MERGE** (operator-authorized) merges to `main`; the Supabase GitHub integration auto-deploys the `classifier-drainer` / `submit-argument` Edge functions (config.toml-registered). **No Deno deploy, no migration.**
- After deploy, the **D3 re-smoke is a SEPARATE authorized provider spend** (not part of this PR): Family I D3 canary first; if the canary is clean (0 dead-letter, ≥1 Family-I positive), then the N=8 / 72-cell burst. PASS bar unchanged: **0 terminal dead-letters**.
- A clean re-smoke earns the 9-family PASS-LOAD but does **not** advance the organic queue-routing percentage ladder.
- If the re-smoke STILL dead-letters provider_server_error at the new cap, the next lever is NOT another retry bump — it points to genuinely-long (>~20 min) or capacity-bounded overload, i.e. the topology-aware provider-reliability architecture (#409) lane.

## 7. Rollback

- Revert this PR (pure constant + gate change; reverting restores cap 4 / `[60,180,360]`). No data migration to undo; in-flight `retry_scheduled` rows simply dead-letter one tier sooner.
- Routing disarm (`CLASSIFIER_QUEUE_ROUTING_ENABLED`) is a SEPARATE operator action, not part of this lane.
- Family-I `productionEnabled` rollback is **not recommended** — the D3 failure is shared-infra, not Family-I-specific; a rollback would not fix the `argument_scheme` / `resolution_progress` (A–G) dead-letters.

---

_Doctrine: cdiscourse-doctrine §1 (operational transport/capacity classification — `provider_server_error` / `retry_attempts_exhausted` assert nothing about any participant or claim), §5 (engine untouched — pure transport scheduling), §6/§7 (no secret literal, no client AI call — server-side Edge), §8 (no migration, additive-or-inert). test-discipline: test count goes UP; the 0-dead-letter re-smoke is the live gate._
