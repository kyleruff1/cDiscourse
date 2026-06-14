# ARCH-001-CARD3-RETUNE — Calibrate the classifier-queue retry/pacer for a clean 9-family PASS-LOAD

**Status:** Design draft
**Epic:** Infrastructure / ARCH-001 (civil-discourse classifier queue) — NOT a UX epic
**Release:** Internal infra (precondition for the Family-H/I re-attempt + the organic-routing ladder)
**Issue:** ARCH-001-CARD3-RETUNE (tracker on the ARCH-001 umbrella #373; the 9-family PASS-LOAD gate sits under the staged-arm runbook)
**Predecessor evidence:**
- PARTIAL (this card's trigger): `docs/audits/ARCH-001-CARD3-SMOKE-2026-06-14-PARTIAL.md`
- Last clean PASS (A–G / 56-cell): `docs/audits/ARCH-001-CARD3-SMOKE-2026-06-10-PASS-LOAD.md`
- First post-Card-3-tuning PASS (A–G / 112-cell, the [60,180,360] schedule's first live proof): `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md`
- Staged-arm runbook: `docs/runbooks/ARCH-001-CARD3-staged-arm-runbook.md`

---

## Goal (one paragraph)

On 2026-06-14 the first full 9-family production-roster queue burst (8 args × 9 families = 72 cells — the densest queue drill yet, run to reproduce the #371/#373 provider-saturation regime) came back **PARTIAL**: 71/72 cells succeeded; exactly one cell (`claim_clarity`) dead-lettered with `failure_reason=mcp_api_error`, `failure_sub_reason=provider_server_error`, `dead_letter_reason=retry_attempts_exhausted`, `attempt_count=4`, retry span ~899 s. The queue **architecture is sound** — it retried with the `provider_server_error`-specific backoff, isolated the blast radius to one cell, leaked nothing, produced 0 duplicate successes, and dead-lettered (did not loop) when the budget ran out. The failure is a genuinely-long provider-side transient that fully consumed the current retry budget. This card re-tunes the retry budget for the `provider_server_error` class **only** so a single long transient survives, earning a 0-dead-letter 9-family PASS-LOAD, without raising provider cost for healthy traffic, without inflating the per-tick latency budget, and without touching any other failure class. Doctrine shaping the design: cdiscourse-doctrine §1 (these are operational transport/capacity reasons, never verdicts — `provider_server_error` / `retry_attempts_exhausted` assert nothing about any participant's claim), §5 (the rules engine stays sacred — the drainer is pure transport scheduling and the change is confined to the retry-policy constants, never the engine), §6/§7 (no secret literal, no client AI call — the change is server-side Edge code), and §8 (no migration, no RLS change, additive-or-inert only). Per test-discipline, the deliverable includes tests (count goes UP) and the bar is a **0-dead-letter PASS-LOAD across the full 9-family roster (8×9 = 72 cells)** plus a re-smoke step appended to the runbook.

---

## Root-cause framing (the two failure surfaces, with the evidence that distinguishes them)

The prompt asks us to distinguish two candidate root causes. We can decide between them from the audit numbers, not by guessing.

### Surface (a) — the retry BUDGET is marginally under-provisioned for a 9-family burst

The `provider_server_error` retry schedule is `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS = [60, 180, 360]` (`classifierDrainerRetryPolicy.ts:79`) with `DRAINER_MAX_ATTEMPTS = 4` (`:53`). That gives exactly **three retry transitions** (after attempts 1, 2, 3) totalling **60 + 180 + 360 = 600 s of backoff**, then `dead_letter` at attempt 4. Add the per-attempt provider work (≤30 s `DRAINER_MCP_REQUEST_TIMEOUT_MS`, `booleanObservationMcpAdapterCore.ts:74`) and the ≤60 s cron-tick re-claim latency per transition, and the realized worst-case lifetime lands at **~795 s (05-31 smoke, A–G) → ~899 s (06-14 PARTIAL, 9-family)** — i.e. the budget was consumed in full both times. On 05-31 the one dead-letter was also this exact class at 795 s; the schedule "fired as designed; the underlying transient was simply persistent." On 06-14 the transient was ~100 s longer and exceeded the same ceiling. **This is the marginal-budget surface: a single genuinely-long `provider_server_error` transient that needs one more attempt tier to clear.**

### Surface (b) — the drainer's per-tick CONCURRENCY/claim-batch saturates the provider Tier RPM at the source

If the drainer fanned out enough concurrent provider calls to push Anthropic over its Tier RPM, the transient *rate* would rise (more cells would hit `provider_server_error`, and the dead-letter would correlate with instantaneous fan-out). The audit numbers rule this out as the **primary** cause:

- The drainer bounds global in-flight provider calls to **C=3** (`DRAINER_PROVIDER_CONCURRENCY = 3`, `classifierDrainerCore.ts:70`), fed into `runWithBoundedConcurrency` (`:209-213`), and single-flight (`acquire_drain_lease`) guarantees only one drainer runs at a time — so a duplicate tick+kick collapses to one drain and cannot multiply C.
- The 06-10 PASS-LOAD measured the realized provider rate at **≈19.8 calls/min** against a Tier-1 50 RPM ceiling ("Tier-1 50 RPM unapproached"). The 72-cell burst is only ~29% denser than the 56-cell drill; at C=3 the steady-state rate is governed by per-call latency, not by burst size, so the 9-family burst still runs far under 50 RPM.
- The PARTIAL was **71/72 success with exactly ONE dead-letter** — not a cluster. A source-saturation regime produces a *band* of `provider_*` failures correlated with the densest fan-out window, not a lone long-tail cell. (The runbook FAIL criterion is explicitly "a single-family provider/server cluster ≥2 `provider_*` terminal failures"; we are at 1.)

**Conclusion:** the root cause is **surface (a)** — a marginally under-provisioned retry budget for the `provider_server_error` class against a single long transient. Surface (b) is not implicated by the evidence (C already sum-bounds; realized RPM is ~40% of the ceiling; the failure is a singleton, not a cluster). We therefore do NOT change C, the claim batch, the wall-clock budget, or the lease — changing them would lengthen burst drain time and add ticks for no demonstrated benefit, and any reduction of C/batch would slow the queue while leaving the long-transient tail (the real cause) untouched.

---

## Candidate levers — evaluation and recommendation

### (a) Raise the retry ceiling for the `provider_server_error` class

Add one attempt tier to the `provider_server_error` class only: `DRAINER_MAX_ATTEMPTS 4 → 5`, and extend `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS [60, 180, 360] → [60, 180, 360, 360]` (a fourth retry transition reusing the 360 s tail). New worst-case retry budget for this class: 60 + 180 + 360 + 360 = **1260 s ≈ 21 min** of backoff, +4 × (≤30 s call) +4 × (≤60 s re-claim) ⇒ realized worst-case lifetime ~24 min. That comfortably clears the observed ~899 s transient with margin, and a fifth attempt clears any transient up to ~1260 s of backoff before dead-lettering.

**Trade-offs / interactions:**
- *Latency:* a cell that hits the full chain now takes ~24 min wall to terminal instead of ~13–15 min. This is **async-only background classification** (advisory observations, never on the submit path), so submit latency is unchanged and the user never waits on it. The PASS-LOAD's "async SLO band" is the only thing affected, and the runbook treats a missed async-SLO-with-completeness as PARTIAL, not FAIL — but a *completed* cell is a PASS regardless of how many retries it took (the 06-10 PASS-LOAD-CONFIRM had cells recover at attempt 2 and still PASSed).
- *Provider cost:* one extra provider call **only for cells that are still failing `provider_server_error` after 4 attempts** — a long-tail set (1 cell in 72 on 06-14; ≤1% historically). Healthy traffic and every other failure class make **zero** extra calls. A genuinely-dead provider still terminates: a 5th failed attempt → `dead_letter` (the loop is still bounded, just one tier deeper).
- *Tick budget (T=90 s):* unaffected. A retry is a run-row-only UPDATE to `retry_scheduled` with `available_at = now()+backoff` and the lease CLEARED (`scheduleRetry`, `classifierDrainerCore.ts:567-581`); the backoff wait happens **between** drains while the row sits idle, not inside any single 90 s tick. More attempts = more *future* ticks each doing a tiny amount of work, never a longer single tick.
- *Lease (130 s) / job lease (120 s):* unaffected. A `retry_scheduled` row holds **no lease** during backoff (`lease_owner=NULL`, `lease_expires_at=NULL`). Only the per-attempt work (one ≤30 s call) sits under the 120 s job lease and the 130 s drain lease; the binding invariant L ≥ T(90) + call(30) + margin(10) = 130 is untouched because we change neither T nor the per-call timeout. Lengthening the *chain* of attempts does not lengthen any single attempt.

### (b) Pace the drainer's per-tick concurrency / claim-batch under provider Tier RPM

Lower C (e.g. 3→2) or the claim batch (20→10) to reduce instantaneous fan-out.

**Rejected as the primary fix.** The evidence (RPM ≈ 40% of ceiling; C already sum-bounds; singleton not cluster — see root-cause §) says we are not saturating the provider. Lowering C would *lengthen* the wall-clock to drain a 72-cell burst (more ticks), add `skipped_single_flight` churn, and still leave the long-transient tail (the real cause) un-helped — a strictly worse trade. We explicitly do **not** touch C, T, lease, or the claim batch. (If a *future* run shows a genuine ≥2-cell `provider_*` cluster correlated with the densest window, that is the signal to revisit (b); this card is not that.)

### (c) Smarter backoff / distinct retry class for `provider_server_error`

The retry policy **already** treats `provider_server_error` as a distinct retry class with its own schedule (`classifierDrainerRetryPolicy.ts:200-202` selects the longer schedule by typed sub-reason; every other retryable sub-reason keeps the default `[30, 120]`). So the class separation we'd want already exists — the only refinement needed is to make that class's schedule one tier longer. Adding jitter is **not recommended**: under single-flight the drains are already serialized and the cron cadence (60 s) is the dominant timing term, so per-cell jitter buys little and complicates the deterministic backoff-schedule tests for no measured thundering-herd (the PASS-LOAD showed clean recovery without it). Keep the schedule deterministic.

### Recommendation

**Lever (a), scoped to the `provider_server_error` class, expressed through the existing (c) class-separation — the smallest possible change.** Concretely:

1. `DRAINER_MAX_ATTEMPTS: 4 → 5` (`classifierDrainerRetryPolicy.ts:53`).
2. `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS: [60, 180, 360] → [60, 180, 360, 360]` (`:79`).
3. Leave **everything else byte-identical**: the default schedule stays `[30, 120]` (it clamps to its last entry for attempts ≥3, so the extra attempt tier reuses +120 s for the rare non-server-error retryable class that reaches attempt 4 — acceptable, since those classes were never the dead-letter source and a 5th attempt for them is harmless); C=3, T=90 s, lease=130 s, claim batch=20, cron `* * * * *`, the contract-failure branch (1 retry then terminal, never dead-letter), and the config-failure branch (immediate terminal) are all unchanged.

This is the minimal change that plausibly achieves a 0-dead-letter 9-family PASS-LOAD: it gives exactly the one cell-class that has ever dead-lettered one more chance to clear a long transient, costs at most one extra provider call per long-tail cell, and leaves healthy traffic, latency budgets, and lease invariants untouched.

### Open decision for the operator (record it on the tracker)

One reasonable alternative to step 2 is `[60, 180, 360, 600]` (a longer fourth tier, ~28 min worst-case) if the operator believes the provider's overload-recovery window is occasionally longer than ~15 min. The recommended `[…, 360]` clears the observed 899 s with ~6 min of headroom; `[…, 600]` adds margin at the cost of a slower terminal for a genuinely-dead provider. **Recommend `[…, 360]`; flag `[…, 600]` as the operator's call.** Either value is a one-line edit and the test assertions name the chosen array explicitly.

---

## Data model

**No new data model.** Zero schema change, zero migration, zero RLS change. The change is confined to two exported numeric constants in one pure-TS Deno module (`classifierDrainerRetryPolicy.ts`). The existing queue columns (`attempt_count`, `state`, `available_at`, `failure_reason`, `failure_sub_reason`, `dead_letter_reason`) already represent everything a 5th attempt needs:

- `attempt_count` is an `int` with no cap in the schema — a value of 5 stores fine.
- The substrate's independent reclaim backstop (`reclaim_stale_leases`, `max_attempts CONSTANT int := 3`, migration `20260528000021:409`) is **intentionally left unchanged**. It is a *different ceiling for a different path* (lease-expiry stuck-row recovery, the slow backstop), and the drainer's live-retry cap (this card's constant) has always been allowed to differ from it by design (`classifierDrainerRetryPolicy.ts:28-32, 48-51`). A lease-expired stuck row still dead-letters at 3; a live `provider_server_error` retry now dead-letters at 5. No migration is needed to change the live cap because it is a code constant, not SQL.

---

## File changes

### Modified files (production code — minimal)

- `supabase/functions/_shared/booleanObservations/classifierDrainerRetryPolicy.ts` — **~2 value lines + ~12 doc-comment lines.**
  - Line 53: `export const DRAINER_MAX_ATTEMPTS = 4;` → `= 5;`
  - Line 79: `…BACKOFF_SECONDS = Object.freeze([60, 180, 360]);` → `Object.freeze([60, 180, 360, 360]);`
  - Update the two governing doc-comments (`:38-52` MAX_ATTEMPTS rationale; `:67-78` provider_server_error schedule rationale) to cite the 2026-06-14 9-family PARTIAL (`attempt_count=4`, ~899 s) as the calibration signal, the new ~1260 s budget, and the unchanged reclaim cap (3). Keep the "Card 3 raised 3→4" history line and append the "RETUNE raised 4→5" line.
  - The `classifyDrainerFailure` body needs **no logic change**: the `Math.min(attemptCount - 1, schedule.length - 1)` indexer (`:206`) automatically uses the new 4th entry; the `attemptCount < DRAINER_MAX_ATTEMPTS` gate (`:195`) automatically admits a 5th attempt; the dead-letter-at-cap branch (`:216-223`) fires at attempt 5. This is the payoff of the existing class-separation design — only the two constants move.

No other production file changes. In particular:
- `classifierDrainerCore.ts` is **untouched** (C, T, lease, batch, cap-per-invocation all stay).
- No migration file is added or edited (the live cap is a code constant; `reclaim_stale_leases`'s 3 stays).
- `booleanObservationMcpAdapterCore.ts` (the 30 s call timeout) is untouched.
- `familyRegistry.ts` is untouched (H/I already production-enabled; this card does not flip families).
- `classifierQueueRouting.ts` is untouched (the percentage ladder is NOT advanced — see GATE discipline §).

### Modified files (tests)

- `__tests__/archOneCardThreeTuningAndRollout.test.ts` — update the value-pin assertions (C3-RP-1, C3-RP-3) and add the new attempt-tier coverage (C3-RP-4/5 extended; new cases for attempt 4 → retry +360 s and attempt 5 → dead_letter). ~+6 tests.
- `__tests__/archOneCardTwoRetryPolicy.test.ts` — update RP-1 (`MAX_ATTEMPTS` 4 → 5), RP-5/RP-6 (dead-letter now at attempt 5, retry through attempt 4). ~+2 tests (add the attempt-4-retry case; keep the existing dead-letter case re-pointed to attempt 5).
- `__tests__/archOneCardThreeBurstConcurrency.test.ts` — the burst-concurrency proof is **already** N=72 (9 families) and pins C=3; it needs **no change** for this card (C is unchanged). Add ONE new assertion block (RETUNE-1..N) documenting the post-retune retry budget against the burst: a pure arithmetic check that `sum(provider_server_error schedule) ≥ observed_worst_case_transient_seconds` using the schedule parsed from source, plus a value-pin that the 9-family roster is the burst (already asserted by BC-3). ~+3 tests.

### New files

- `__tests__/archOneCardThreeRetuneBudget.test.ts` (NEW) — a focused suite for the retune: the new budget arithmetic, the class-separation invariant (only `provider_server_error` gets the longer schedule; every other retryable sub-reason still gets `[30, 120]`), the "5th attempt then dead_letter, never loop forever" bound, the unchanged-reclaim-cap assertion (the substrate's 3 is not changed by this card — a source-scan that the migration is untouched), and the doctrine ban-list scan over the new constant/strings. ~12–16 tests.

### Modified files (docs)

- `docs/runbooks/ARCH-001-CARD3-staged-arm-runbook.md` — append a **§4a "RE-SMOKE after the retune"** sub-section: the post-merge re-deploy note, the authorized re-run of the §4 burst at the **full 9-family roster (8×9 = 72)** with the PASS bar restated as **0 terminal dead-letters at N=72**, and the explicit statement that a clean re-smoke earns the 9-family PASS-LOAD but does **not** advance the organic percentage ladder. Also update the §3 table note that the smoke roster is now 9 families (the historical N=56 A–G figure stays as a dated record).
- `scripts/arch-001-card3-smoke/README.md` — the burst test's BAN-4 asserts this README still contains "0 terminal dead-letters" and "N=56". **Decision:** keep the N=56 line as the historical A–G bar AND add an N=72 line for the 9-family roster, OR re-point BAN-4 to N=72. Recommend: add the N=72 line and **update BAN-4 to assert both** "0 terminal dead-letters" and the 9-family "N=72" string, so the regression test tracks the current roster. (See Risks for the BAN-4 coupling.)
- `docs/audits/ARCH-001-CARD3-SMOKE-<date>.md` — written by the operator AFTER the re-smoke, not by the implementer (the implementer ships code + tests + runbook only).

---

## API / interface contracts

The only public surface is the two exported constants and the pure function whose behavior they govern. The function signature is **unchanged**:

```ts
// classifierDrainerRetryPolicy.ts (exported, pure, total, never throws)
export const DRAINER_MAX_ATTEMPTS: number;                          // 4 → 5
export const DRAINER_RETRY_BACKOFF_SECONDS: ReadonlyArray<number>;  // [30, 120] (UNCHANGED)
export const DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS:
  ReadonlyArray<number>;                                            // [60,180,360] → [60,180,360,360]

export function classifyDrainerFailure(
  reason: BooleanObservationUnavailableReason,
  attemptCount: number,            // current attempt_count (already bumped by claim)
  subReason?: BooleanObservationFailureSubreason,
): DrainerFailureDecision;         // { disposition, failureReason, failureSubReason, backoffSeconds, deadLetterReason }
```

Post-retune behavioral contract for the `provider_server_error` class (`reason='api_error'`, `subReason='provider_server_error'`):

| `attemptCount` | disposition | `backoffSeconds` | `deadLetterReason` |
|---|---|---|---|
| 1 | `retry` | 60 | null |
| 2 | `retry` | 180 | null |
| 3 | `retry` | 360 | null |
| 4 | `retry` | **360** (NEW tier) | null |
| 5 | `dead_letter` | 0 | `retry_attempts_exhausted` |

Every other retryable class (`network_error`, `rate_limited`, `api_error` with a non-server-error sub-reason) keeps `[30, 120]` clamped (retry through attempt 4 at +120 s, dead_letter at attempt 5). Contract failures (`validation_failed`, `parse_failure`) and config failures (`url_missing`, `token_missing`) are **byte-unchanged**.

The test bridge `__tests__/_helpers/classifierQueueCard2Deno.ts` already re-exports `DRAINER_MAX_ATTEMPTS` and `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS` (lines 69, 71) — **no bridge change needed**; the new values flow through automatically.

---

## Edge cases the implementer must handle (and how the design covers each)

- **Lease expiry vs the longer retry chain.** A `retry_scheduled` row holds NO lease during backoff (`scheduleRetry` clears `lease_owner`/`lease_expires_at`). A 5th attempt does not lengthen any single leased window; only one ≤30 s call sits under the 120 s/130 s leases. The L ≥ T+call+margin invariant is untouched (T, call timeout, lease all unchanged). No new lease-expiry interaction.
- **T=90 s tick budget vs more attempts.** Each attempt is a separate future tick doing a small amount of work; the backoff wait is between ticks, not inside one. The wall-clock budget is never approached by adding attempts. (The `partial` drain outcome still appears under burst as designed.)
- **One-success-per-cell unique index (`amor_one_success_per_cell_idx`).** Unaffected — a 5th *failed* attempt still leaves the cell with no `succeeded` row until it succeeds; the partial index only constrains `succeeded` rows. A late success after 4 retries is a single `succeeded` row. No violation.
- **One-active-job-per-cell unique index (`amor_one_active_job_per_cell_idx`).** Unaffected — a retry stays in `retry_scheduled` (still "active" per the index predicate), so the cell never has two active rows. The retune adds attempts to the SAME row, never a second row. No violation; idempotent enqueue (`ON CONFLICT … DO NOTHING`) still no-ops a duplicate enqueue.
- **Kick-coalescing / `skipped_single_flight` under more ticks.** More retry transitions mean more *future* ticks may find the row due, but single-flight (`acquire_drain_lease`) still collapses concurrent tick+kick to one drain; the only effect is a few more benign `skipped_single_flight` audit rows over the (longer) tail. The PASS counter is `dead_letters`, not skip count; the 05-31 smoke already tolerated skip churn well under threshold.
- **Provider genuinely down (must still dead-letter, not loop).** The dead-letter-at-cap branch (`:216-223`) fires at attempt 5 (the new `DRAINER_MAX_ATTEMPTS`). A permanently-failing `provider_server_error` terminates at attempt 5 with `dead_letter_reason='retry_attempts_exhausted'` — one tier deeper, still strictly bounded. No infinite loop.
- **Idempotent enqueue.** Unchanged — `enqueue_classifier_job` `ON CONFLICT … DO NOTHING` is untouched; the retune touches no SQL.
- **A non-server-error retryable class reaching the new attempt 4.** With MAX_ATTEMPTS=5, a `network_error`/`rate_limited`/non-server `api_error` can now retry once more (attempt 4 → +120 s clamped, attempt 5 → dead_letter) instead of dead-lettering at 4. This is a benign side effect (those classes were never the dead-letter source; one more retry only helps), and it is covered by an explicit test so it is intentional, not accidental.
- **Doctrine-constraint edge case ("could heat/popularity ever influence the retry decision?").** No — `classifyDrainerFailure` reads only the typed `reason`, `attemptCount`, and typed `subReason`. It never reads engagement, heat, score, or any raw provider body. The decision is pure transport/capacity classification (doctrine §1/§3). A ban-list test asserts no reason/sub-reason/dead-letter string is a verdict token.

---

## Test plan (per test-discipline; tests go UP)

Pure-TS retry-policy logic → real behavioral unit tests via the existing Jest Deno bridge (no Deno runtime, no fetch, no provider call, no Supabase). All counts are full-suite, captured with an explicit exit code.

1. `__tests__/archOneCardThreeTuningAndRollout.test.ts` (UPDATE) — re-point C3-RP-1 (`MAX_ATTEMPTS=5`), C3-RP-3 (`[60,180,360,360]`); add: attempt-4 `provider_server_error` → retry +360 s; attempt-5 → dead_letter +0 s; the default schedule still `[30,120]` (C3-RP-2 unchanged). Doctrine: C3-RP-11 extended to the 4-entry array.
2. `__tests__/archOneCardTwoRetryPolicy.test.ts` (UPDATE) — RP-1 → `MAX_ATTEMPTS=5`; RP-5/RP-6 → dead_letter at attempt 5, retry through attempt 4; keep RP-2 (`[30,120]` default) and the contract/config branches unchanged; RP-16 ban-list re-run.
3. `__tests__/archOneCardThreeRetuneBudget.test.ts` (NEW) — the focused retune suite:
   - Budget arithmetic: `sum([60,180,360,360]) = 960 ≥ 899` (the observed PARTIAL transient) with a stated headroom assertion; schedule parsed from source so the test tracks the shipped value.
   - Class-separation invariant: ONLY `(api_error, provider_server_error)` selects the longer schedule; `(api_error, provider_capacity_exhausted)`, `network_error`, `rate_limited` all use `[30,120]` clamped.
   - Bounded-forever: for attempts 1..10 the `provider_server_error` disposition is `retry` for 1–4 and `dead_letter` for ≥5 — never anything else, never an unbounded retry.
   - Reclaim-cap untouched: a source-scan that `20260528000021_*.sql` still contains `max_attempts CONSTANT int := 3` (the live cap and the reclaim cap are independent — assert the migration is NOT edited by this card).
   - No-migration invariant: assert no new migration file references `DRAINER_MAX_ATTEMPTS` / the schedule (the change is code-only).
   - Doctrine ban-list: scan every reason/sub-reason/dead-letter string + the new constant's surrounding strings against the canonical verdict-token ban-list (the same list `archOneCardTwoRetryPolicy.test.ts::RP-16` already enforces) → zero hits.
4. `__tests__/archOneCardThreeBurstConcurrency.test.ts` (UPDATE) — add a RETUNE block: C unchanged (BC-1 still pins 3), and a pure arithmetic proof that the post-retune provider_server_error budget (parsed from source) exceeds the observed worst-case transient; re-point BAN-4 to assert both "0 terminal dead-letters" and the 9-family "N=72" string in the smoke README (after the README is updated). No change to the bounded-concurrency proof itself (C is not changing).

**Doctrine ban-list assertions:** items 2 (RP-16), 3 (new), and 4 (BAN-1) all scan emitted strings for verdict tokens. No user-facing copy is added by this card (the constants are server-internal), so there is no `gameCopy.toPlainLanguage` surface to extend — but the ban-list scan over the typed reasons is retained.

**Expected test-count delta:** **+~25 tests, +1 suite** (the new `archOneCardThreeRetuneBudget.test.ts`), net of the in-place re-points (which replace, not remove, assertions). The implementer captures the exact delta from a full `npm run test` run with `; echo "EXIT: $?"`, and updates `docs/core/current-status.md` only after the count is confirmed. Baseline at design time: **797 suites / 31065 passed (1 skip; 31066 total)** (current-status.md, 2026-06-13). Tests must go UP; the implementer reports the captured `Test Suites:`/`Tests:` lines, not an estimate.

---

## Dependencies (cards / docs / files)

- Assumes the **4-card ARCH-001 chain is merged + applied** (Card 1 substrate, Card 2 drainer+enqueue+kick, Card 2A finalizer, Card 3 cron tick) — confirmed live on main (migrations `20260528000021/022/023`, `20260608000001`; `classifier-drainer` ACTIVE; Vault seeded; cron job present per the 06-10 PASS-LOAD preflight).
- Assumes **Families H (`claim_clarity`) and I (`thread_topology`) are production-enabled** (confirmed: `familyRegistry.ts` has 9 `productionEnabled: true` entries; commits `580f197` H, `c86ce53` I). The 9-family roster is what makes the 72-cell burst the real production burst.
- Reads the existing retry table in `classifierDrainerRetryPolicy.ts::classifyDrainerFailure` and the budget constants — the only thing this card mutates.
- Reads (does NOT change) `classifierDrainerCore.ts` (C/T/lease/batch) and `20260528000021_*.sql` (`reclaim_stale_leases` cap=3).
- **Blocks** the Family-H/I re-attempt gate and the organic-routing percentage ladder (Step 4+ in the staged-arm runbook), because a clean 9-family PASS-LOAD is the documented precondition for both (runbook §6). This card earns that PASS-LOAD; it does not itself advance either downstream gate.

---

## Risks

- **BAN-4 coupling (the most likely implementer trip).** `archOneCardThreeBurstConcurrency.test.ts::BAN-4` asserts the smoke README contains `0 terminal dead-letters` and `N=56`. If the implementer updates the README to N=72 without updating BAN-4 (or vice-versa) the test fails. The design's instruction: update BOTH together — keep the N=56 line as a dated historical record AND add the N=72 9-family line, then update BAN-4 to assert the 9-family string. Run the full burst suite isolated to confirm.
- **The default-schedule clamp side effect.** Raising MAX_ATTEMPTS to 5 gives non-server-error retryable classes one extra retry (attempt 4) before dead-lettering. This is intended and benign, but the implementer must add the explicit test so a reviewer sees it is deliberate, not a regression. Do NOT "fix" it by special-casing — the uniform cap is simpler and safe.
- **Reclaim-cap confusion.** A reviewer may flag "the cap is 3 in the migration but 5 in code." This is correct and by design (two paths, two ceilings — live retry vs lease-expiry backstop), documented in `classifierDrainerRetryPolicy.ts:28-32` and re-asserted by the new test. The implementer must preserve and cite that doc-comment; do NOT touch the migration to "reconcile" the numbers (that would be an unnecessary migration-bearing change).
- **Flaky wall-clock perf tests.** None of this card's tests are wall-clock budgeted (they are pure arithmetic/logic), so the known LIFE-001/META-001 full-suite flake class does not apply. If an unrelated wall-clock test flakes under full-suite load, re-run it isolated before blaming this branch (per the test-discipline note and the known-flaky memory).
- **Async-SLO latency.** The ~24-min worst-case tail for a maximally-long transient could trip a future async-SLO alert if one is added. Today the runbook treats completeness-with-slow-async as PARTIAL not FAIL, and a completed cell is a PASS; note this so a later SLO card sizes its band above ~24 min for this class.
- **Migration-bearing? No.** This card writes NO migration and edits none. The OPS-001 heightened-migration-review path does not apply; standard GATE-C (merge=deploy of the Edge function) does.

---

## Out of scope (explicit — reduces scope creep)

- Changing C, T, the drain lease, the job lease, the claim batch, or the cron cadence (lever (b) — rejected by the evidence; not this card).
- Adding jitter to any backoff schedule.
- Changing the default `[30, 120]` schedule or any non-`provider_server_error` retry class's behavior beyond the benign cap side effect.
- Changing the substrate `reclaim_stale_leases` cap (stays 3, by design).
- Advancing the organic-routing percentage ladder (Step 4: 1% / Step 5: 5→25→50→100). This card earns the 9-family PASS-LOAD ONLY; each percentage step is its own operator card (runbook §3).
- Re-enabling or disabling any classifier family (H/I are already on; J stays frozen).
- Any submit-path change — the direct-dispatch path and the 15 s submit-path timeout are byte-unchanged.
- Any user-facing copy, UI, or plain-language mapping (the constants are server-internal).
- Running the re-smoke itself (operator-gated provider spend — see Operator steps).

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the retune touches only operational transport/capacity classification. `provider_server_error`, `retry_attempts_exhausted`, `mcp_api_error` are typed failure reasons, never verdicts about a participant. The change is async-background classification only; it cannot block or gate posting (submit returns 201 before the dispatch fork — unchanged). A ban-list test asserts no emitted string is a verdict token.
- **cdiscourse-doctrine §3 (popularity is not evidence):** the retry decision reads only typed transport reasons + attempt count; it never reads engagement, heat, virality, or any amplification signal. No path to factual-standing influence.
- **cdiscourse-doctrine §5 (rules engine is sacred):** the engine is not touched. The drainer remains pure transport scheduling; the change is two numeric constants in a pure, side-effect-free, Deno-light module with type-only imports — no network, no React, no mutation.
- **cdiscourse-doctrine §6/§7 (secrets; no client AI calls):** no secret literal is added or read; the change is in Edge-side code; the production app makes no AI call. The Vault-read tick and the drainer's service-role posture are untouched.
- **cdiscourse-doctrine §8 (Supabase conventions):** no migration, no RLS change, no policy change, no table/column/index change. Nothing to roll back. The applied migration `20260528000021` is NOT edited (its reclaim cap stays 3).
- **test-discipline:** tests are part of the deliverable (the new suite + the in-place re-points), the count goes UP, the bar is the captured exit-0 full-suite run, and the PASS-LOAD bar is restated (0 dead-letters at N=72) in the runbook.

## Operator steps (if any)

This is a server-side Edge change to a `config.toml`-registered function, so **merge = deploy (GATE-C)**.

1. **Deploy step (operator):** the squash-merge to `main` auto-redeploys `classifier-drainer` via the Supabase GitHub integration (it is `config.toml`-registered, `verify_jwt=false`). The operator MAY also run `npx supabase functions deploy classifier-drainer --linked`. **No `npx supabase db push` is needed — this card ships no migration.**
2. **Re-smoke (operator; SEPARATE authorized provider spend):** after the deploy, re-run the §4 production burst per the runbook at the **full 9-family roster (8×9 = 72 cells)**, smoke-tag-only, synthetic-only, leak-safe, poll-to-settle. The bar is **0 terminal dead-letters at N=72** plus the structural gates. This is a deliberate, authorized provider spend — it is NOT performed by the implementer and NOT auto-run by CI.
3. **Record:** write the verdict to `docs/audits/ARCH-001-CARD3-SMOKE-<date>.md` (PASS-LOAD / PASS-LOAD-CONFIRM, or PARTIAL → re-tune again).
4. **Ladder discipline (state plainly):** a clean 9-family PASS-LOAD earns the gate the currently-live `PCT=100` routing is running ahead of. It does **NOT** advance the organic percentage ladder — every ≥1% organic step remains its own separate operator authorization card (runbook §3). The one-flag disarm (`CLASSIFIER_QUEUE_ROUTING_ENABLED=false` → instant revert to direct dispatch) remains the safety valve throughout (runbook §5 / Risks rollback note).
