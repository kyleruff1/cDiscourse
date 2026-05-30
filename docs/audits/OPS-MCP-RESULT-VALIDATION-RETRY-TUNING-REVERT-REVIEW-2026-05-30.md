# OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — REVERT Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-30
**Branch:** `revert/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING`
**Topology:** 1 revert commit (`359da8d`) on top of `main` `ff7bfe3` (merge-base = main HEAD = commit parent). True surgical single-commit revert of #368 (`d24988e`).
**Reverted card:** OPS-MCP-RESULT-VALIDATION-RETRY-TUNING (#368) — Phase 4 production verify FAILED (p95 49.46s > 45s; stacked long retries under clustered `{isError}`; 2/35 terminal holes).

## Summary

This is a clean, symmetric, surgical revert of ONLY the #368 retry-DELAY tuning. It deletes the
`providerServerErrorBackoff.ts` helper, restores the `autoTriggerDispatcher.ts` backoff line to the
byte-equal Phase-3 expression, drops the helper's test bridge re-export, deletes the #368-only test
suite (27 cases) and the 3 retry-tuning source-scan guards (FAIL-27/28/29) added to the failure-mode
suite, and reverts the `current-status.md` "Latest implementer card" comment to the Phase-3 entry.
The Phase 1 (typed sub-reason) and Phase 3 (`{isError}` detection + `provider_server_error` typing)
work is fully PRESERVED — the relevant files are not in the diff and their content is confirmed intact
at HEAD. `provider_server_error` still RETRIES, just at the shared 2s backoff instead of the tuned
~7–10s. Production returns to the Phase-3 state. No doctrine, secret, schema, migration, or
concurrency collateral. All gates green at the pre-#368 baseline.

## Verification (independently captured)

| Gate | Result |
| --- | --- |
| typecheck | **pass** — `tsc --noEmit`, `EXIT typecheck: 0` |
| lint | **pass** — `eslint . --ext .ts,.tsx --max-warnings 0`, `EXIT lint: 0` |
| test | **pass** — `Test Suites: 580 passed, 580 total` / `Tests: 18413 passed, 18413 total`, `EXIT test: 0` |
| count delta | `18443 → 18413` tests, `581 → 580` suites — exactly the +30/+1 #368 added, now removed; matches pre-#368 baseline |
| secret scan | **clean** — zero ADDED (`+`) secret-shaped lines; the 4 `grep` matches are all `-` (removed) ban-list assertions in the deleted #368 test |
| doctrine scan | **clean** — no truth/winner/loser tokens in added lines; no SERVICE_ROLE / ANTHROPIC in client TS; no direct insert into `public.arguments` |

## Diff footprint (`git diff --name-only main...HEAD`)

Touches EXACTLY the six expected paths, no more:

| Path | Change | Expected |
| --- | --- | --- |
| `supabase/functions/_shared/booleanObservations/providerServerErrorBackoff.ts` | **DELETE** | ✓ |
| `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` | MODIFY | ✓ |
| `__tests__/_helpers/booleanObservationEdgeDeno.ts` (bridge) | MODIFY | ✓ |
| `__tests__/mcpAutoTriggerRetryTuning.test.ts` | **DELETE** | ✓ |
| `__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts` | MODIFY | ✓ |
| `docs/core/current-status.md` | MODIFY | ✓ |

**Confirmed ABSENT from the diff** (all required exclusions hold): `booleanObservationMcpAdapter.ts`,
`booleanObservationFailureSubreason.ts`, `classifyArgumentCore.ts`, `mcpBooleanObservationSchema.ts`
+ mirrors (`src/features/nodeLabels/*`), `boundedConcurrencyRunner.ts`, `autoTriggerConcurrency.ts`,
`familyRegistry.ts`, any `supabase/migrations/` / `*.sql`, `package.json`. The #368 design + review docs
are correctly NOT in the diff (kept as history).

## Targeted scrutiny results

1. **Phase 3 PRESERVED (critical check) — PASS.** At HEAD, `booleanObservationMcpAdapter.ts` still
   contains `isServerErrorEnvelope(extracted)` with the STRICT `extracted.isError === true` guard
   (lines 111–118) and the detection block typing `subReason: 'provider_server_error'` on the
   `api_error` carrier (lines 223–227). `booleanObservationFailureSubreason.ts` still has
   `provider_server_error` in both the union (line 71) and the runtime `ALL_…` set (line 95). Neither
   file is in the revert diff — the typing/detection/vocab is untouched. Only the retry-DELAY tuning was
   reverted.

2. **Dispatcher back to Phase-3 byte-equal — PASS.** The backoff line is now
   `const waitMs = RETRY_BACKOFF_MS[attemptNumber - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];`
   (line 330) — no `providerServerErrorBackoffMs`, no `failureSubReason`-gated conditional, no
   `Math.random()` call site, and the helper import is removed. Surrounding constants confirmed byte-equal:
   `MAX_ATTEMPTS = 2` (line 112), `RETRY_BACKOFF_MS = Object.freeze([2_000, 8_000])` (line 129),
   `RETRYABLE_FAILURE_REASONS` (line 119, 3-element set), `isSummaryRetryable` (line 216),
   `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` (lines 101/461). The line 349 `failure_sub_reason:` is only the
   audit-log field assignment (Phase-1 surface), correctly preserved.

3. **Helper fully gone — PASS.** `grep -rnE 'providerServerErrorBackoff|PROVIDER_SERVER_ERROR_RETRY'
   supabase/ __tests__/` → zero matches (exit 1). The module file is deleted; the bridge re-export block
   (`EDGE_PROVIDER_SERVER_ERROR_RETRY_BASE_MS` / `_JITTER_MS` / `edgeProviderServerErrorBackoffMs`) is
   removed from `booleanObservationEdgeDeno.ts`.

4. **`provider_server_error` still RETRIES (at 2s) — PASS.** The Phase-3 chain holds intact:
   `{isError}` → `api_error` reason → `mcp_api_error` carrier (present in `RETRYABLE_FAILURE_REASONS`)
   → the existing first-retry backoff `RETRY_BACKOFF_MS[0] = 2_000`. The revert removed the LONGER delay,
   not the retryability.

5. **Bounded-parallel untouched (#364) — PASS.** `boundedConcurrencyRunner.ts` and
   `autoTriggerConcurrency.ts` are absent from the diff; `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` intact
   (concurrency 2 preserved). The bridge's `edgeMaxAutoTriggerConcurrentFamilies` re-export is preserved.

6. **No collateral — PASS.** No prompt / taxonomy / schema-mirror / flag / Source-6 / audit-lint /
   `package.json` / migration change. submit fire-and-forget unchanged. The two test modifications remove
   ONLY retry-tuning assertions: the bridge drops the helper re-export block; the failure-mode suite drops
   FAIL-27/28/29 (which asserted the now-removed `failureSubReason`-gated delay + helper import — they
   would fail against the reverted dispatcher, so removal is correct, not a coverage gap). The
   BURST-HARDENING describe block and FAIL-1..26 are explicitly preserved. The `current-status.md` change
   removes the #368 "Latest implementer card" comment, restoring the Phase-3 (#365 Phase 3) entry as the
   latest.

## Doctrine self-check

- [x] No truth/winner/loser language in user-facing strings (clean; revert is operator/transport-timing only)
- [x] Score never blocks posting (untouched; submit fire-and-forget unchanged)
- [x] No service-role in client code (clean scan)
- [x] No direct insert into `public.arguments` (clean scan)
- [x] No AI calls in production app paths (no AI surface touched)
- [x] Plain language only — no raw internal codes leaked to UI (`provider_server_error` is operator/diagnostic-only, never user-facing; unchanged)
- [x] Epic-specific (MCP boolean-observation auto-trigger): Phase-3 detection/typing/vocab preserved; retryability preserved; concurrency 2 preserved; schema + mirrors byte-equal

## Blockers

None.

## Suggestions (non-blocking)

1. None affecting merge. After merge, the gated Phase-4 production re-verify (#365) should confirm p95 is
   back under the Phase-3 envelope now that the stacked long retries are removed — but that is a separate
   operator gate, not part of this revert.

## Operator next steps

- Branch is already pushed (`revert/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING` tracks origin).
- Open PR: `gh pr create --title "Revert OPS-MCP-RESULT-VALIDATION-RETRY-TUNING (#368) — Phase 4 FAIL" --body-file docs/audits/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING-REVERT-REVIEW-2026-05-30.md`
- Deploy: NO migration. The Supabase GitHub integration redeploys the Edge Function on merge to `main`
  (production returns to the Phase-3 state: provider/server errors typed + the existing 2s retry on the
  `mcp_api_error` carrier).
- Post-merge: the gated Phase-4 production re-verify for #365 is a separate operator step.
