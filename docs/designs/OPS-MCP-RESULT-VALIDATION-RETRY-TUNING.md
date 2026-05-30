# OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — provider_server_error longer jittered backoff

**Status:** Design draft
**Epic:** Epic 12 / Semantic-referee MCP track (OPS-MCP retry-timing hardening)
**Release:** Operational hardening (post Stage 6.4; the MCP auto-trigger slot is un-stubbed, dormant pending Family H)
**Issue:** https://github.com/<owner>/<repo>/issues/368
**Intent (AUTHORITATIVE):** `docs/designs/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING-intent.md`
**Phase 4 evidence:** `docs/audits/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-PHASE4-SMOKE-2026-05-29.md`

---

## Goal (one paragraph)

The `#365` Phase 3 fix correctly types the hosted MCP server's `{ isError }` overload envelope as `provider_server_error` and routes it through the **already-retryable** `mcp_api_error` carrier. Phase 4 (PARTIAL) proved the existing single retry *fires* but its **2s backoff is too short under a sustained concurrency-10 burst**: the retry re-enters the still-hot server window and re-fails, leaving 2/35 (5.7%) terminal `(argument, family)` coverage holes (`cdc9b80d/critical_question`, `e010bb43/argument_scheme`, both `mcp_api_error × 2`, `retryHeals = 0`). This card changes **only the retry DELAY**, and **only for `provider_server_error`**: when a retry is about to fire and `lastSummary.failureSubReason === 'provider_server_error'`, use a longer jittered backoff (~7–10s) instead of the shared `RETRY_BACKOFF_MS[...]`. Everything else — `isSummaryRetryable` (provider_server_error already rides retryable `mcp_api_error`), `MAX_ATTEMPTS = 2` (still exactly one retry), `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2`, the shared `RETRY_BACKOFF_MS = [2_000, 8_000]`, the adapter, the schema mirrors — stays byte-equal. Doctrine: this is transport-timing tuning only; it touches no verdict surface, no truth value, no user-facing string, no secret surface, and no migration (cdiscourse-doctrine §1/§3/§6/§9 unaffected).

---

## Data model

**No new data model.** No table, no column, no migration, no schema-mirror change.

The only new value-level addition is **two timing constants + one pure function** in a new constant module (see "File changes"). The discriminator the dispatcher reads — `PerArgumentSummary.failureSubReason` — already exists (added in `#365` Phase 1, `classifyArgumentCore.ts:83`) and is already populated on the adapter-unavailable path (`classifyArgumentCore.ts:273` reads `adapterResult.subReason`). The value `'provider_server_error'` is an existing member of `BooleanObservationFailureSubreason` (`booleanObservationFailureSubreason.ts:71`).

Verified chain (no code change needed to establish it):

| Step | Source | Value |
|---|---|---|
| `{ isError: true }` envelope detected | `booleanObservationMcpAdapter.ts:223` `isServerErrorEnvelope` | `reason: 'api_error'`, `subReason: 'provider_server_error'` |
| `reason: 'api_error'` → `failureReason` | `classifyArgumentCore.ts:171-172` `unavailableReasonToFailureReason` | `'mcp_api_error'` |
| `subReason` threaded onto summary | `classifyArgumentCore.ts:273` | `failureSubReason: 'provider_server_error'` |
| `failureReason: 'mcp_api_error'` retryable? | `autoTriggerDispatcher.ts:119-123` `RETRYABLE_FAILURE_REASONS` | **yes** |
| `isSummaryRetryable(lastSummary)` | `autoTriggerDispatcher.ts:216-220` | `true` (status `failed` + reason in set) |

So at the dispatcher backoff branch (`:326-331`) a `provider_server_error` failure already passes both gates (`isSummaryRetryable` true; `attemptNumber < MAX_ATTEMPTS` on attempt 1). This card only changes which `waitMs` is selected at `:330`.

---

## File changes

### New files

- **`supabase/functions/_shared/booleanObservations/providerServerErrorBackoff.ts`** (~30–40 LOC incl. doc-comment) — the pure, Jest-loadable backoff helper + its two constants. Zero runtime imports (mirrors `autoTriggerConcurrency.ts`, which has zero imports and a single exported constant). **No `Math.random` inside** — the helper takes an injected `rand01`. **No `Deno.`, no `fetch`, no `console`, no `npm:` import.** This file is NOT schema-mirrored (it has no `src/features/nodeLabels/` twin and introduces no symbol any schema mirror references). Chosen as a *new sibling* rather than appending to `autoTriggerConcurrency.ts` so that file's test ("exports ONLY the constant, exactly one export" — `mcpAutoTriggerBoundedConcurrency.test.ts:577-583`) stays byte-equal (HALT-7 / no audit-lint churn).

- **`__tests__/mcpAutoTriggerRetryTuning.test.ts`** (~120–160 LOC) — the new behavioral + source-scan suite for this card (test plan a–h below). Behavioral cases load the pure helper via the bridge; dispatcher invariants are source-scanned (the dispatcher is not Jest-loadable).

### Modified files

- **`supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`** — two small edits, ~6 net new LOC:
  1. Add one import line near the existing constant imports (`:101`):
     `import { providerServerErrorBackoffMs } from './providerServerErrorBackoff.ts';`
  2. Replace the single `waitMs` line at `:330` with a `provider_server_error`-gated conditional (exact text below). `RETRY_BACKOFF_MS` (`:129`), `MAX_ATTEMPTS` (`:112`), `RETRYABLE_FAILURE_REASONS` (`:119-123`), `isSummaryRetryable` (`:216-220`), and the bounded-concurrency dispatch (`:459-463`) are **byte-equal**.

- **`__tests__/_helpers/booleanObservationEdgeDeno.ts`** — add ~10 LOC: a `require()` of the new module + a typed re-export (`edgeProviderServerErrorBackoffMs`, `EDGE_PROVIDER_SERVER_ERROR_RETRY_BASE_MS`, `EDGE_PROVIDER_SERVER_ERROR_RETRY_JITTER_MS`). Mirrors the existing `autoTriggerConcurrency` bridge block (`:267-274`). This is a test helper, not a suite (no `.test.` name; `testMatch = **/__tests__/**/*.test.(ts|tsx)` does not collect it).

- **`__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts`** — add one `describe` block (~3 source-scan tests) asserting: (1) the shared `RETRY_BACKOFF_MS` is still byte-equal `[2_000, 8_000]` and `MAX_ATTEMPTS = 2` (regression, complements existing FAIL-9 / FAIL-26); (2) the longer delay at `:330` is **gated on `failureSubReason === 'provider_server_error'`**; (3) the dispatcher calls `providerServerErrorBackoffMs(...)` with `Math.random()` supplied at the call site (the `Math.random` is in the dispatcher, not the helper). The existing FAIL-1..26 are untouched.

### Deleted files

- None.

---

## API / interface contracts

### The pure helper (`providerServerErrorBackoff.ts`)

```ts
/**
 * OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — provider_server_error backoff.
 *
 * Pure, Jest-loadable backoff computation for the SINGLE retry of a
 * `provider_server_error` failure (the hosted MCP `{ isError }` overload
 * envelope, typed in #365 Phase 3). Used ONLY by the dispatcher's backoff
 * branch when `lastSummary.failureSubReason === 'provider_server_error'`;
 * all other retryable classes keep the shared RETRY_BACKOFF_MS.
 *
 * NO `Math.random` inside (HALT-6): the caller supplies `rand01` (the
 * dispatcher passes `Math.random()` at the call site, source-scanned).
 * NO `Deno.`, no `fetch`, no `console`, no `npm:` import. Zero imports —
 * mirrors autoTriggerConcurrency.ts so the Jest bridge can require() it.
 */

/** Base wait (ms) before the single provider_server_error retry. */
export const PROVIDER_SERVER_ERROR_RETRY_BASE_MS = 7_000;

/** Bounded jitter span (ms) added on top of the base. */
export const PROVIDER_SERVER_ERROR_RETRY_JITTER_MS = 3_000;

/**
 * Backoff (ms) before the provider_server_error retry. Pure + total.
 *
 * @param attemptNumber 1-based attempt that just FAILED (the wait precedes
 *        attempt attemptNumber+1). Accepted for signature parity with the
 *        shared RETRY_BACKOFF_MS index and forward-compat; with MAX_ATTEMPTS
 *        = 2 the only retry is after attempt 1, so the value does not branch
 *        on attemptNumber today (documented; a future 2nd attempt would).
 * @param rand01 a number in [0, 1) — injected (Math.random() at the call
 *        site). Values outside [0,1) are CLAMPED so the result stays bounded
 *        even on a degenerate input (defense-in-depth; the real call site
 *        always passes Math.random()).
 * @returns BASE_MS + floor(clamp(rand01) * JITTER_MS), i.e. an integer in
 *          [BASE_MS, BASE_MS + JITTER_MS).
 */
export function providerServerErrorBackoffMs(
  attemptNumber: number,
  rand01: number,
): number {
  // Clamp rand01 into [0, 1) so the bound holds for any input. NaN -> 0.
  const r =
    Number.isFinite(rand01) && rand01 > 0
      ? Math.min(rand01, 0.999_999_999)
      : 0;
  void attemptNumber; // accepted for parity; constant schedule with MAX_ATTEMPTS=2
  return PROVIDER_SERVER_ERROR_RETRY_BASE_MS + Math.floor(r * PROVIDER_SERVER_ERROR_RETRY_JITTER_MS);
}
```

**Bound contract (the tested invariant):** for any `rand01`, `BASE_MS ≤ result ≤ BASE_MS + JITTER_MS` (the floor makes the upper bound `BASE_MS + JITTER_MS − 1` in practice; the `≤ BASE+JITTER` assertion holds). With `BASE = 7000`, `JITTER = 3000`: result ∈ `[7000, 10000)`. Always `> 2000` (the standard first-retry backoff), so the "longer than 2s" assertion (test e) holds for every `rand01`.

**Why `attemptNumber` is in the signature but not branched on:** the intent specifies `providerServerErrorBackoffMs(attemptNumber, rand01)` for parity with `RETRY_BACKOFF_MS[attemptNumber - 1]` and for forward-compat if a future Stage 2B approves a 2nd attempt. With `MAX_ATTEMPTS = 2` the only backoff is before attempt 2 (i.e. after `attemptNumber === 1`), so a constant base is correct today. The parameter is retained (not dropped) so the call site and a future schedule need no signature change; `void attemptNumber` documents the intentional no-branch and keeps lint clean.

### The dispatcher edit (exact text at `autoTriggerDispatcher.ts:329-331`)

Current (`:329-331`):

```ts
      // Bounded backoff before next attempt.
      const waitMs = RETRY_BACKOFF_MS[attemptNumber - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      await sleep(waitMs);
```

Replacement:

```ts
      // Bounded backoff before next attempt.
      // OPS-MCP-RESULT-VALIDATION-RETRY-TUNING: a `provider_server_error`
      // failure (the hosted MCP `{ isError }` overload envelope, #365 Phase 3)
      // uses a LONGER jittered backoff so the single retry waits out the hot
      // burst window (#365 Phase 4 found the 2s backoff re-enters the still-hot
      // server window → retryHeals=0). This is keyed on `failureSubReason`, NOT
      // the shared `failure_reason` — genuine HTTP `mcp_api_error` /
      // `mcp_network_error` / `mcp_rate_limited` keep the byte-equal
      // RETRY_BACKOFF_MS. Math.random() is supplied HERE (the helper is pure
      // and takes rand01); MAX_ATTEMPTS (1 retry) + RETRYABLE_FAILURE_REASONS
      // are unchanged — only the DELAY changes.
      const waitMs =
        lastSummary.failureSubReason === 'provider_server_error'
          ? providerServerErrorBackoffMs(attemptNumber, Math.random())
          : RETRY_BACKOFF_MS[attemptNumber - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      await sleep(waitMs);
```

`lastSummary` is in scope at `:330` (declared `:276`, assigned from `classifyOneArgumentCore(...)` at `:279`; narrowed to non-null because `:287` returned on success and `:326` already dereferenced it via `isSummaryRetryable(lastSummary)`). `failureSubReason` is the optional field on `PerArgumentSummary` (`classifyArgumentCore.ts:83`). The `else` branch is **character-for-character** the current `:330` expression — so the byte-equal source-scan on the shared schedule passes.

### Test bridge addition (`booleanObservationEdgeDeno.ts`, after `:274`)

```ts
// ── providerServerErrorBackoff.ts (pure, OPS-MCP-RESULT-VALIDATION-RETRY-TUNING) ─
const providerServerErrorBackoffModule = require(`${BO}/providerServerErrorBackoff`) as {
  PROVIDER_SERVER_ERROR_RETRY_BASE_MS: number;
  PROVIDER_SERVER_ERROR_RETRY_JITTER_MS: number;
  providerServerErrorBackoffMs: (attemptNumber: number, rand01: number) => number;
};

export const EDGE_PROVIDER_SERVER_ERROR_RETRY_BASE_MS =
  providerServerErrorBackoffModule.PROVIDER_SERVER_ERROR_RETRY_BASE_MS;
export const EDGE_PROVIDER_SERVER_ERROR_RETRY_JITTER_MS =
  providerServerErrorBackoffModule.PROVIDER_SERVER_ERROR_RETRY_JITTER_MS;
export const edgeProviderServerErrorBackoffMs =
  providerServerErrorBackoffModule.providerServerErrorBackoffMs;
```

---

## Constant value justification

| Constant | Value | Justification |
|---|---|---|
| `PROVIDER_SERVER_ERROR_RETRY_BASE_MS` | `7_000` | Phase 4 measured each family classification taking ~5s (the clean 7-family wall is ~19s under bounded concurrency 2; the retried family in `e010bb43` cost ~+3s over the clean ~19s, of which the 2s backoff was part). The base **must exceed the ~5s classification/server window** so the retry lands *after* the prior request wave has cleared the hot window, not while it is still in flight. 7000ms is comfortably > 5s with margin, and is the lower end of the intent's "~7–10s" target. |
| `PROVIDER_SERVER_ERROR_RETRY_JITTER_MS` | `3_000` | Total worst case `BASE + JITTER = 10_000ms`, the **upper end of the intent's "~7–10s"** and the latency-budget ceiling (see below). Jitter decorrelates concurrent retries (two args whose family failed in the same burst do not retry in lockstep), spreading the retry wave instead of re-concentrating it — the precise failure Phase 4 observed. 3s span keeps the spread meaningful without blowing the budget. |
| (derived) total retry wait | `[7_000, 10_000)` ms | `> 2_000` for every `rand01` (longer than the standard backoff); `≤ 10_000` so a single healed family keeps p95 under the 30s PASS line (latency reasoning below). |

These values live in `providerServerErrorBackoff.ts` as named `export const`s (not magic numbers in the dispatcher), so a future tune is a one-line change in a pure, test-bridged module and the bound tests pin the contract.

---

## Latency budget interaction (for Phase 4 — DO NOT change the budget; reasoning only)

The PASS line is `wall_clock_background` **p95 < 30s** (intent §"Post-merge Phase 4"; Phase 4 audit line 72). The longer retry adds wall-clock to a *healed* family. Reasoning from the Phase 4 measurements:

- **Clean (no retry):** ~19s for 7 families at concurrency 2 (audit: 18.54–19.42s).
- **One family retried under the OLD 2s backoff:** 22.44s (`e010bb43`) = clean ~19s + ~3.4s retry cost. That ~3.4s ≈ 2s backoff + a partial overlap of the retry's own classification window with the tail of the family wave.
- **One family retried under the NEW ~7–10s backoff:** the delta over the OLD path is the extra backoff, `(7–10s) − 2s = +5 to +8s`. So worst case ≈ `22.44s + 8s ≈ 30.4s`, and typical ≈ `22.44s + 5–6s ≈ 27–28s`. The intent's own framing: "the clean 7-family wall is ~19s; +~8s retry on one family ≈ 27s — under 30s but tight."

**Conclusion for Phase 4:** a single healed family with the tuned backoff is expected to land **~27–28s typical, ≤ ~30s worst case** — under the 30s PASS line but **tight**. This is acceptable per the intent (which explicitly accepts the tightness and frames 30–45s as PARTIAL, > 45s as FAIL). Two notes the implementer/reviewer must carry forward to Phase 4, *without changing anything in this card*:

1. The `BASE + JITTER ≤ 10_000` cap is **load-bearing for the budget** — it is why the jitter is 3s not, say, 8s. Bumping `JITTER` (or `BASE`) later must be re-checked against the 30s line.
2. If two families on the *same* arg both hit `provider_server_error` in the same burst, both retries run *within the per-arg concurrency-2 window*, so their backoffs overlap (they do not serialize) — the per-arg wall is governed by the *longest* retried family, not the sum. So the worst case stays single-retry-shaped (~30s), not 2×. The jitter de-syncs them so they don't re-collide.

This card makes **no budget change**; it only documents that the tuned delay is expected to stay under 30s and flags the tightness for the Phase 4 gate.

---

## Test plan (the operator's 8 + the byte-equal regression)

All tests are **non-spend** (no Anthropic / xAI / X / MCP network; no Supabase write). Behavioral cases run against the **pure helper** via the bridge; dispatcher invariants are **source-scanned** (dispatcher is not Jest-loadable). This is the established "coverage-wall split" (behavioral helper + dispatcher source-scan) used by `mcpAutoTriggerBoundedConcurrency.test.ts`.

New file: **`__tests__/mcpAutoTriggerRetryTuning.test.ts`**

- **(value pin)** `providerServerErrorBackoffMs` is importable via the bridge; `PROVIDER_SERVER_ERROR_RETRY_BASE_MS === 7000` and `..._JITTER_MS === 3000` (the only literal `7000`/`3000` in the suite — single value-pin per the D7 convention; every other assertion uses the imported constants).

- **(a) first attempt `provider_server_error`, delayed retry valid → SUCCESS.** Composition (coverage-wall split):
  - *behavioral on the helper*: `providerServerErrorBackoffMs(1, rand01)` returns a finite delay in `[BASE, BASE+JITTER)` for the retry-before-attempt-2 slot.
  - *dispatcher source-scan*: the loop returns `{ outcome: 'triggered' }` on `lastSummary.status === 'success'` (the success-break at `:287-303` is present and precedes the failed/backoff branch), so a healed retry surfaces SUCCESS. Asserts the success path is reached *after* the backoff branch exists (i.e. the gated `waitMs` does not short-circuit success).

- **(b) repeated `provider_server_error` → fails after `MAX_ATTEMPTS`, still typed.** Source-scan: `MAX_ATTEMPTS = 2` (one retry) byte-equal; after the loop the terminal `emitAutoTriggerLog` carries `failure_sub_reason: terminal?.failureSubReason` (`:349`) and the returned outcome's `failureReason` is `terminal?.failureReason` (`:358`) — so two `{isError}` failures end `failed` with `failureReason: 'mcp_api_error'` and `failureSubReason: 'provider_server_error'` preserved (no re-typing, no extra attempt).

- **(c) ordinary response-schema failures NOT swept in.** Source-scan: the longer delay is gated *strictly* on `lastSummary.failureSubReason === 'provider_server_error'`; `response_wrong_schema_version` / `response_not_json` / other `response_*` sub-reasons take the `else` (shared `RETRY_BACKOFF_MS`). Plus: those response-schema failures ride `mcp_validation_failed` / `mcp_parse_failure` which are **not** in `RETRYABLE_FAILURE_REASONS`, so they are non-retryable anyway (assert `mcp_validation_failed` absent from the set — complements FAIL-26). Two independent guards: not-swept-into-the-longer-delay AND not-retryable.

- **(d) doctrine / ban-list NOT retried.** Source-scan: `RETRYABLE_FAILURE_REASONS` is byte-equal the 3-element transient set; no doctrine/ban-list class (`mcp_validation_failed` and its `response_ban_list_violation` sub-reason) is retryable; the longer delay never applies to them (the gate is `provider_server_error`-only). Asserts the gate literal is exactly `'provider_server_error'` (not a broader prefix match like `startsWith('provider_')` that would sweep `provider_rate_limited` / `provider_api_error` / `provider_network_error`).

- **(e) the helper's delay is BOUNDED and longer than 2s.** Behavioral on the helper: for `rand01 ∈ {0, 0.5, 0.999_999}` (and degenerate `-1`, `1`, `NaN` for the clamp), assert `BASE_MS ≤ result < BASE_MS + JITTER_MS` (using imported constants), `result === BASE_MS` at `rand01 = 0`, `result` near `BASE+JITTER` at `rand01 ≈ 0.999`, and `result > 2000` (longer than the standard first-retry backoff) for every case. Determinism: same `rand01` → same result (no `Math.random` inside).

- **(f) concurrency stays 2.** Source-scan: `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` is referenced in the dispatcher and is unedited; the imported bridge constant equals 2 (value pin reused). Asserts this card added no concurrency literal and did not touch the `runWithBoundedConcurrency(..., MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES, ...)` call.

- **(g) submit fire-and-forget unchanged.** Source-scan on `submit-argument/index.ts`: `dispatchAutoTriggerForArgument(...).catch(() => undefined)` present; no `await dispatchAutoTriggerForArgument`; `return created(...)` after the dispatch call. The call site is **byte-equal** (this card edits only the dispatcher's backoff line + a new import, never the submit handler). Mirrors FAIL-14..16 / the concurrency suite's D6 #7.

- **(h) no secrets in return/log.** Two parts: (1) *helper purity* — source-scan `providerServerErrorBackoff.ts` contains no `Deno.`, no `fetch(`, no `console.`, no `Authorization`/`Bearer`/`SERVICE_ROLE`/`sk-ant`/`xai-`/`sb_secret_`/JWT-shape literal, and no `import` statement (fully standalone). (2) *return shape* — the helper returns a `number` only; the dispatcher's `waitMs` selection introduces no new field on `AutoTriggerOutcome` or the log entry (the terminal log's `failure_sub_reason` / `failure_detail` were already there from `#365` Phase 1 and are sanitized by `buildFailureDetail`). Doctrine ban-list scan on the new source file + the edited dispatcher (no `winner/loser/liar/...` tokens), mirroring the concurrency suite's ban-list test.

Addition to existing file: **`__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts`** (one new `describe`, ~3 tests)

- **byte-equal regression #1:** the shared `RETRY_BACKOFF_MS` is still the frozen `[2_000, 8_000]` (re-asserts FAIL-9's order/values as a HALT-2 guard) and `MAX_ATTEMPTS = 2` (HALT-3 guard) — proves this card did not edit the shared schedule or add an attempt.
- **byte-equal regression #2:** the longer delay at `:330` is gated on the literal `failureSubReason === 'provider_server_error'` (HALT-1 guard: the tuned delay is `provider_server_error`-only, not applied to any other class), and the `else` arm still contains the byte-equal `RETRY_BACKOFF_MS[attemptNumber - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]`.
- **call-site `Math.random` location:** the dispatcher calls `providerServerErrorBackoffMs(` and the `Math.random()` literal appears *in the dispatcher* on the same gated line (HALT-6 guard: random is at the call site, not in the pure helper — cross-checked by the helper-purity scan in the new suite which asserts `providerServerErrorBackoff.ts` contains no `Math.random`).

**Test count forecast:** **+12 to +18** (helper value-pin 1; helper bound/determinism ~4–5; dispatcher source-scans for a/b/c/d/f/g/h ~6–8; the 3 regression adds in the existing suite). Comfortably inside the intent's +10 to +20; well under the +40 HALT.

---

## Dependencies (cards / docs / files)

- Assumes **`#365` Phase 1** is complete because it reads `PerArgumentSummary.failureSubReason` (`classifyArgumentCore.ts:83`) — verified present + populated (`:273`).
- Assumes **`#365` Phase 3** is complete because the `{ isError }` envelope must already be typed `provider_server_error` and routed through `api_error` → retryable `mcp_api_error` — verified (`booleanObservationMcpAdapter.ts:223-227`, `classifyArgumentCore.ts:171-172`).
- Reads the established small-pure-constant-module pattern at `autoTriggerConcurrency.ts` and the Jest bridge pattern at `__tests__/_helpers/booleanObservationEdgeDeno.ts` (`:267-274`) + `__tests__/_helpers/booleanObservationFailureSubreasonDeno.ts`.
- Reads the dispatcher backoff branch `autoTriggerDispatcher.ts:325-331` (the only production edit site).
- **Blocks `#365` closure + Family H planning resumption** (intent §Verdict): `#365` closes only after this card PASSes a clean production burst (run-completeness, p95 < 30s) in the gated post-merge Phase 4.

---

## Risks

- **Latency tightness (highest risk for the *next* gate, not this PR).** A healed family lands ~27–28s typical, ≤ ~30s worst case (see latency reasoning). If the live burst pushes a retried family's p95 into 30–45s, Phase 4 is PARTIAL — but that is a *post-merge gate* outcome, not a code defect. The `BASE + JITTER ≤ 10_000` cap is the lever that keeps it under 30s; the implementer must not exceed it.
- **`lastSummary` nullability at `:330`.** TypeScript types `lastSummary` as `PerArgumentSummary | null` (`:276`). It is non-null at `:330` because `:326` already dereferenced it through `isSummaryRetryable(lastSummary)` (which takes a non-null `PerArgumentSummary`) — but the strict-null compiler may still flag `lastSummary.failureSubReason` if it cannot narrow across the `break` statements. **Mitigation:** if `tsc`/Deno-check flags it, read the field off the same value the line above already uses — i.e. the `isSummaryRetryable(lastSummary)` call at `:326` proves non-null in the control flow, so a direct `lastSummary.failureSubReason` should narrow; if not, a local `const sub = lastSummary?.failureSubReason;` immediately before the backoff line resolves it without changing semantics. (The implementer should prefer the direct access and only add the local if the checker complains — do NOT add a non-null assertion `!` per the repo's no-`any`/no-suppression posture.) Note `supabase/functions` is excluded from the project `tsc` compile, so the binding check is the Deno-side type-check during deploy; the source-scan tests do not type-check the dispatcher.
- **Bridge `require()` path drift.** The new module's bridge entry uses the same `${BO}/providerServerErrorBackoff` shape as the existing entries; a typo would fail at suite load. Low risk (copy the existing block).
- **Existing test updates.** None of FAIL-1..26 change. The new `describe` in the failure-mode suite is additive. No existing assertion is loosened or removed (test count goes up only).
- **No migration / no deploy-coupling defect.** Pure code change; the Supabase GitHub integration redeploys Edge Functions on merge (no DB migration in this card), so the only operator action is the gated Phase 4 verify (separate gate).

---

## Out of scope

- **Adding a 2nd retry / changing `MAX_ATTEMPTS`** — explicitly deferred to a *future* Stage 2B with evidence the single longer retry is insufficient (intent §Scope.1, HALT-3).
- **Changing `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`** (concurrency 3) — out (HALT-4); a separate 1-line PR gated on the measured 429 rate.
- **Editing the shared `RETRY_BACKOFF_MS`** — out (HALT-2); genuine `mcp_api_error` / `mcp_network_error` / `mcp_rate_limited` keep their 2s first-retry.
- **Broadening retry to `mcp_validation_failed` / doctrine-ban-list / ordinary response-schema failures** — out (HALT-1; intent §Scope.3).
- **Any migration, column, schema-mirror, prompt, taxonomy, family-key, Source-6, flag, audit-lint, `package.json`, `.gitignore` change** — out (HALT-5/7; intent header).
- **Family H enable / planning** — frozen until `#365` PASS or a Gate H (intent header).
- **The production Phase 4 spend verify itself** — a separate operator gate, post-merge (intent §"Post-merge Phase 4").
- **Server-side fix for the underlying `{ isError }` overload** — if it persists after the tuned retry, a separate server-side investigation card is filed (intent §Verdict PARTIAL).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (score is gameplay analysis, never truth):** the change is transport-timing only. No verdict, no truth label, no "winner/loser/correct/false" surface. The new source file + edited dispatcher line carry zero verdict tokens (asserted by the ban-list scan, test h). Score-vs-validation is untouched; this is neither.
- **cdiscourse-doctrine §3 (popularity is not evidence):** no engagement / popularity input anywhere; the helper takes `(attemptNumber, rand01)` and returns a number.
- **cdiscourse-doctrine §4 (AI moderator hard limits) / §7 (no AI calls from the production app):** server-only file under the `booleanObservations` tree (never imported by `src/`/`app/`); the helper is pure with zero imports and makes no AI/network call. The retry governs *when* a classifier call is re-attempted, never *whether the model decides a verdict* — outcomes remain structural Machine Observations.
- **cdiscourse-doctrine §5 (rules engine is sacred):** the constitution engine is not touched.
- **cdiscourse-doctrine §6 (secrets):** the helper returns a `number`; it introduces no new field on any log/return surface. The terminal log's `failure_sub_reason` / `failure_detail` predate this card and are sanitized by `buildFailureDetail` (allowlist + secret-shape scrub). Helper-purity scan (test h) asserts no `Authorization`/`Bearer`/`SERVICE_ROLE`/key-shape literal and no `console`. No secret-shaped literal is added (the new file has none).
- **cdiscourse-doctrine §8 (Supabase conventions):** no table, no RLS change, no migration; no run row is mutated by this card (the delay is computed *before* the retry attempt; the existing persistence path is byte-equal).
- **cdiscourse-doctrine §9 (plain language) / §10a (Observations vs Allegations):** no user-facing string and no node-label change. `provider_server_error` is an operator/diagnostic sub-reason, never user-facing (per `booleanObservationFailureSubreason.ts` doc) — the gate reads it but surfaces nothing new to users.
- **cdiscourse-doctrine §10 (v1 scope guards):** no voting/scoring-winner, no real-time edit, no OAuth, no public API, no push, no search. Not implicated.
- **test-discipline:** tests are part of this card (the operator's 8 + byte-equal regression), behavioral on the pure helper + dispatcher source-scan, non-spend, with a value-pin and a doctrine ban-list scan; test count goes up (+12 to +18); no `.skip`/`.only`; no committed `console.log`.

**HALT self-check (intent §HALT — all clear):**

| # | HALT trigger | This design |
|---|---|---|
| 1 | tuned delay applied to a non-`provider_server_error` class | Gate is the exact literal `failureSubReason === 'provider_server_error'`; tests c/d assert no broadening (no prefix match). **Clear.** |
| 2 | shared `RETRY_BACKOFF_MS` edited | `else` arm is character-for-character the current `:330` expression; byte-equal regression test asserts `[2_000, 8_000]`. **Clear.** |
| 3 | a 2nd retry / `MAX_ATTEMPTS` change | `MAX_ATTEMPTS = 2` byte-equal; only the DELAY changes; regression test pins it. **Clear.** |
| 4 | concurrency change / > 2 | `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` unedited; test f pins it. **Clear.** |
| 5 | migration / column | None. No data model change. **Clear.** |
| 6 | `Math.random` inside the pure helper | Helper takes `rand01`; `Math.random()` is at the dispatcher call site; helper-purity scan asserts no `Math.random` in the helper. **Clear.** |
| 7 | schema-mirror / prompt / flag / family-key / audit-lint / package.json touched | New file is a fresh non-mirrored pure module; only the dispatcher backoff line + bridge + tests change. **Clear.** |
| 8 | submit becomes blocking | Submit call site byte-equal (fire-and-forget `.catch(() => undefined)`); test g pins it. **Clear.** |
| 9 | forecast > +40 | Forecast +12 to +18. **Clear.** |

No HALT fired.

---

## Operator steps (if any)

**None for the merge — pure code change.** No migration, no manual env var; the Supabase GitHub integration redeploys Edge Functions on merge to `main` (no DB push needed because there is no migration).

**Separate, gated, post-merge (NOT part of this card's implementation):** the operator runs the Phase 4 production verify per intent §"Post-merge Phase 4" (canary-first, synthetic smoke-tagged, A–G, concurrency ≤ 2, reach cross-arg overlap ≥ ~7–8, confirm every `(arg, family)` ends ≥ 1 success, p95 < 30s with the tuned retry). PASS there closes `#365` and resumes Family H planning.
