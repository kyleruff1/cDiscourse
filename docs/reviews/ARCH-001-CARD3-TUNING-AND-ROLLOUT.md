# ARCH-001-CARD3-TUNING-AND-ROLLOUT — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-31
**Branch:** feat/ARCH-001-card3-tuning-and-rollout
**Design source:** commit cb57aba body + operator prompt rationale (no
separate design-doc PR for this card; predecessor design is
`docs/designs/ARCH-001-CARD2-DRAINER-ENQUEUE-intent.md` §A.9 / §A.11).
**Audit basis:** `docs/audits/ARCH-001-CARD2-SMOKE-2026-05-31.md` (commit
d43b3b1) — Card 2 smoke PARTIAL/PASS-with-tuning, 102/105 succeeded; 3/105
dead-lettered on `mcp_api_error / provider_server_error` after
attempt_count=3.

## Summary

Card 3 is a tuning-and-rollout card: four scoped changes applied on top of
the Card 2 substrate to address the C-calibration signal from the Card 2
smoke. (1) `DRAINER_MAX_ATTEMPTS` 3 → 4 extends the retry tail for the
Anthropic {isError} overload class. (2) A new
`DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS = [60, 180, 360]` schedule
is applied ONLY when `reason='api_error' AND subReason='provider_server_error'`;
every other retryable reason preserves the original `[30, 120]` schedule
byte-for-byte. (3) `enqueueClassifierJobs` collapses 7 sequential
`enqueue_classifier_job` RPC calls into ONE multi-row
`.from('argument_machine_observation_runs').insert(rows)` — the
STATEMENT-level kick trigger (`arch_001_kick_classifier_drainer_trg`) now
fires once per submit instead of seven times. (4) A new
`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` env knob (default 0) plus
`parseRoutingPercentage` (fail-closed neg/NaN, clamp-up >100, floor
fractional) and `stableHashArgumentId` (djb2 32-bit, deterministic across
Deno/Node) extend `shouldRouteToQueue` with an optional fourth `percentage`
parameter for staged production rollout. The implementation honors every
hard constraint declared in the design rationale: no migration, no
prompts/taxonomy/family/schema-mirror change, no MCP server provider path
touched, no Family H/I/J change, C/T/lease/cron/MCP cap unchanged,
`classifierDrainerCore.ts` untouched. The submit-argument routing branch
remains mutually exclusive (predicate true → enqueue path only; predicate
false → direct dispatch path only) and the predicate stays DEFAULT
DISABLED (master flag off ⇒ false for everything).

## Verification

| Check | Result |
|---|---|
| typecheck | pass (`npm run typecheck` exit 0) |
| lint | pass (`npm run lint` exit 0, --max-warnings 0) |
| test (full suite) | 591/592 suites passed; 18712/18713 tests passed; 1 pre-existing flake in `moveMetadataLedger.test.ts` (perf threshold 60ms hit 62ms; passes at 22ms in isolation; Card 3 does not touch this file) |
| test (Card 2/3 + read-only boundary) | 93/93 passed in 5.6s |
| secret scan | clean (zero hits across `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `X_BEARER_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_`, `sk-ant-`, JWT shape, Bearer/Authorization literals) |
| doctrine scan | clean (zero verdict tokens in source or user-facing strings; the only `true`/`false` hits are TS boolean literals or predicate-return descriptions) |
| service-role-in-client scan | clean (zero hits in `src/**` or `app/**`) |
| direct `public.arguments` insert scan | clean (zero hits) |
| console.log scan | clean |
| `.skip` / `.only` / `xit` / `xdescribe` scan | clean |
| Migration apply | heightened-review pass — no migration in this diff (the design explicitly proves no-migration-needed; the existing FOR-EACH-STATEMENT kick trigger + partial unique indexes #4 and #5 from Card 1 substrate already support the multi-row INSERT form). The "absence of migration" is itself the artifact: `git diff origin/main..HEAD --name-only -- 'supabase/migrations/**'` returns zero lines. |

## Design conformance

- [x] All four declared changes are present in the diff.
  - `DRAINER_MAX_ATTEMPTS = 4` in `classifierDrainerRetryPolicy.ts:48`.
  - `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS = [60, 180, 360]` in `classifierDrainerRetryPolicy.ts:74`; selection branch in `classifyDrainerFailure` at lines 195–197.
  - `enqueueClassifierJobs` rewritten to a single multi-row `.from().insert()` in `classifierQueueRouting.ts:228–255` (no more `.rpc()` calls).
  - `parseRoutingPercentage`, `stableHashArgumentId`, percentage-aware `shouldRouteToQueue` in `classifierQueueRouting.ts:89–184`; `submit-argument/index.ts:813–823` reads the env and threads `percentage` into `shouldRouteToQueue`.
- [x] No undocumented file-changes (8 files, all aligned with the four declared changes).
- [x] Data model unchanged — no new column / constraint / index / policy. The multi-row INSERT shape (`argument_id`, `debate_id`, `family`, `run_mode`, `schema_version`, `requested_families`, `state`) matches the Card-1 `enqueue_classifier_job` SQL function body byte-for-byte for the columns Card 3 sets; `available_at`, `started_at`, `created_at`, and `id` rely on column DEFAULTs.
- [x] API contracts preserved.
  - `shouldRouteToQueue` 4th parameter is OPTIONAL with default 0 (backward-compatible — existing 3-arg callers behave identically).
  - `classifyDrainerFailure` signature unchanged; the selection branch is internal.
  - `enqueueClassifierJobs` external signature and return shape unchanged (`{ attemptedFamilies, ok }`).
- [x] The C/T/lease TTL/cron/MCP cap controls are untouched (`grep -E "DRAINER_MAX_CONCURRENCY|DRAINER_JOB_TIMEOUT|LEASE_TTL"` in the diff returns no source-code changes to those constants; only commentary in `classifierDrainerRetryPolicy.ts`).
- [x] `finalize_classifier_job` SQL signature unchanged (zero SQL files in the diff).
- [x] Single-flight pattern unchanged (`classifierDrainerCore.ts` not in the diff).

## Doctrine self-check

- [x] No truth/winner/loser language in user-facing strings (the verdict-token scan returned zero hits; the new failure-class strings — `mcp_api_error`, `provider_server_error`, `retry_attempts_exhausted` — are structural transport classifications, never verdicts).
- [x] Score never blocks posting (Card 3 doesn't touch the submit-validation gate; the routing decision happens AFTER `insertedArg` is committed and the response is already on the way to 201).
- [x] No service-role in client code (`src/**` and `app/**` scans clean).
- [x] No direct insert into `public.arguments` (zero hits; Card 3 only inserts into `public.argument_machine_observation_runs` via the service-role Edge Function path).
- [x] No AI calls in production app paths (Card 3 has no fetch/HTTP/provider call; the only async surface is one `.from().insert()` on a Supabase service client).
- [x] Plain language only — no internal codes leak to UI (Card 3 produces zero UI strings; the failure-class strings live in DB columns and Edge-Function audit logs, never rendered to users).
- [x] Epic-specific doctrine (`supabase-edge-contract`):
  - The new code is server-only (`supabase/functions/_shared/booleanObservations/`); never imported by `src/` or `app/`.
  - Service-role client is used only for the privileged enqueue write, after the verify_jwt=true auth gate the rest of `submit-argument` already enforces.
  - The Card-1 partial unique indexes #4 (`amor_one_success_per_cell_idx`: state='succeeded') and #5 (`amor_one_active_job_per_cell_idx`: state IN ('pending','leased','retry_scheduled')) remain the structural backstops; the multi-row INSERT inherits them without modification.
- [x] Test-discipline:
  - 36 new tests in `archOneCardThreeTuningAndRollout.test.ts` (C3-RP-1..11, C3-PP-1..7, C3-HASH-1..5, C3-ROUTE-1..11, C3-INERT-1..2).
  - Card-2 retry-policy and routing-predicate tests updated (`MAX_ATTEMPTS=4` now expected; ENQ-1..5 rewritten for the multi-row INSERT contract; ENQ-5 specifically defends against a regression back to `.rpc()`).
  - Read-only boundary test (`uxOneOneFiveReadOnlyBoundary.test.ts`) extended with `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`, `parseRoutingPercentage`, `queueRoutingPercentage`, `Card 3`, `ARCH-001` tokens — the dispatch-tail authorization keeps a non-dispatch edit (auth / validation / insert / notification / response) failing.

## Test coverage

- [x] New public functions have unit tests.
  - `parseRoutingPercentage`: 7 tests (C3-PP-1..7) covering undefined/null/empty, non-numeric, negative, overshoot, valid range, Infinity, env-name constant.
  - `stableHashArgumentId`: 5 tests (C3-HASH-1..5) covering determinism, distinct hashes, empty/short strings, long UUID-shape strings, modulo-100 distribution sanity.
  - `shouldRouteToQueue` (new percentage path): 11 tests (C3-ROUTE-1..11) covering smoke-tag override at percentage=0, percentage=100, deterministic subset at percentage=50, distribution at 1000 ids, master-flag gate, smoke-and-100 simultaneous, default-parameter backward compatibility, invalid-percentage handling, percentage=99 strict-less-than boundary, debate_id mismatch.
  - `classifyDrainerFailure` (new branch): 11 tests (C3-RP-1..11) covering MAX_ATTEMPTS=4, default schedule preservation, provider_server_error schedule, the (api_error, provider_server_error) selection, dead-lettering at attempt 4, fallback to default schedule for other api_error sub-reasons, no spillover to network_error / rate_limited, contract failures still bounded, url_missing / token_missing terminal, doctrine-ban-list on the new backoff array.
  - `enqueueClassifierJobs` (multi-row form): 5 tests (ENQ-1..5) covering exactly-one-insert, 7-family enumeration, row shape, error swallowing, regression defense against `.rpc()`.
- [x] User-facing strings have ban-list assertion (RP-16 ban-list test still passes the new `provider_server_error` strings through `classifyDrainerFailure` and confirms zero verdict tokens in the resulting `disposition`, `failureReason`, `deadLetterReason` strings).
- [x] Edge cases covered.
  - Negative / NaN / Infinity / overshoot percentage: C3-PP-3, C3-PP-4, C3-PP-6, C3-ROUTE-9.
  - Master flag off + percentage=100 stays false: C3-ROUTE-6.
  - Smoke debate routes at percentage=0: C3-ROUTE-2.
  - Default 3-arg signature still works: C3-ROUTE-8 (regression defense for the Card-2 callers if any survived).
  - debate_id mismatch defensive: C3-ROUTE-11.
- [x] Accessibility: N/A (no UI surface in this card).

## Duplicate-enqueue walk (operator-requested)

The multi-row INSERT path is `.from('argument_machine_observation_runs').insert(rows)` with no `ON CONFLICT` clause. The operator asked me to walk the duplicate-enqueue scenario and confirm the DB indexes prevent double-success / double-active anomalies.

**Setup.** First call enqueues 7 rows (A–G) for `arg-X` with `state='pending'`. Card 1's partial unique index #5 (`amor_one_active_job_per_cell_idx` on `(argument_id, family, run_mode, schema_version)` WHERE `state IN ('pending','leased','retry_scheduled') AND family IS NOT NULL`) is now populated for `arg-X` × {A..G}.

**Race A — pure duplicate call.** Second `enqueueClassifierJobs('arg-X', ...)` issues another 7-row INSERT. Each of the 7 new rows collides with index #5 (predicate matches `state='pending'` for both old and new rows). Postgres atomically rolls back the entire 7-row statement with SQLSTATE 23505. `supabase-js` returns `{ error: { code: '23505' } }`; the code sets `ok=false`; the caller swallows the result via `.catch(() => undefined)`. Net effect: zero new rows, original 7 continue to drain, no double-active, no provider call wasted.

**Race B — first call mid-drain, some families succeeded.** Suppose families A and B have transitioned to `state='succeeded'` by the time the second call lands. Index #5 excludes `'succeeded'` from its predicate, so the new (A, pending) and (B, pending) rows do NOT collide on index #5 — they would land. BUT the drainer's eventual success path is gated by index #4 (`amor_one_success_per_cell_idx` on the same key WHERE `state='succeeded' AND family IS NOT NULL`): the next `succeeded` transition for (arg-X, A) would collide with the existing success row, and the drainer's success-write fails with 23505. The drainer's atomic finalizer treats this as a benign no-op (the existing success row is the canonical one). The wasted provider call is the only operational cost — and it is bounded to the percentage of retried submits, which in practice is small.

**Race C — pathological re-entry.** Even if every family transitions to terminal and a third call lands, the same logic applies per cell. Index #4 forbids two succeeded rows for the same (argument_id, family, run_mode, schema_version) cell. Index #5 forbids two active rows. The cell is structurally singleton in both terminal and active states.

**Conclusion.** The no-ON-CONFLICT design is sound. The DB partial unique indexes #4 + #5 prevent every double-success / double-active anomaly the operator asked about. The known operational consideration — a duplicate enqueue produces an audit `error.code=23505` recorded as `ok=false` in the fire-and-forget result, with no operator-visible log — is acceptable for this card's smoke-only + staged-rollout scope. See "Suggestions" §1 below.

## Blockers

None.

## Suggestions (non-blocking)

1. **Optional observability for duplicate-enqueue 23505.** The current `enqueueClassifierJobs` swallows the multi-row INSERT error into `ok=false` and the caller `.catch(() => undefined)` discards it. Under the smoke-only + 0% rollout posture this is fine, but once `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE > 0` ships, a structured one-line log at error level (e.g. `console.error('enqueueClassifierJobs failed', { argumentId, debateId, errorCode })` — code only, never the message body, never any header) would make a duplicate-INSERT race operator-visible without breaking the doctrine secrets rule. Defer to a follow-up; not a Card 3 blocker.
2. **Future-proof the default backoff cardinality.** `DRAINER_RETRY_BACKOFF_SECONDS` stays at length 2 (`[30, 120]`); attempt 3→4 reuses the last entry via `Math.min(attemptCount - 1, schedule.length - 1)` clamping. This is correct and preserves the Card-2 schedule byte-for-byte, as the design rationale specifies. A future Card N that wants to grow the default schedule should bump the array length explicitly and add a new test like C3-RP-7 (the "attempt 3 uses clamped last entry" case stops being a clamping case). Not actionable for Card 3.
3. **Optional: test the hash-modulo distribution at a tighter slack.** C3-HASH-5 asserts no single bucket exceeds 50% of 1000 ids and at least 50/100 buckets get a hit; C3-ROUTE-5 asserts the routed-count over 1000 sits in [400, 600]. Both pass comfortably with the djb2 hash, but a fixed RNG seed in a follow-up could let the test tighten to ±10% for stronger regression coverage of a future hash change. Not actionable for Card 3.

## Operator next steps

- Push the branch: `git push -u origin feat/ARCH-001-card3-tuning-and-rollout`
- Open PR:
  `gh pr create --title "ARCH-001 Card 3: drainer tuning + kick coalescing + staged-rollout knob" --body-file docs/reviews/ARCH-001-CARD3-TUNING-AND-ROLLOUT.md`
- After merge, the Supabase GitHub integration auto-redeploys the affected Edge Function (`submit-argument`) on merge to main; no manual deploy step is required by this card. The classifier-drainer Edge Function's pure modules (`classifierDrainerRetryPolicy.ts` + `classifierQueueRouting.ts`) ride along with the next drainer redeploy if not already covered by the same auto-deploy.
- After merge, set the staged-rollout knob to the desired percentage on the Supabase project's Edge Function env (default 0 keeps the smoke-only posture); the master `CLASSIFIER_QUEUE_ROUTING_ENABLED` flag still gates BOTH paths.
- No migration to apply.
- Post-merge worktree cleanup (commands in `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)").
