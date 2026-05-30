# OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 3 (FIX) — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-29
**Branch:** feat/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-p3 (3 implementer commits on design `3659ee8`, none pushed)
**Issue:** #365
**Design:** docs/designs/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-PHASE3.md (+ -PHASE3-intent.md)

## Summary

Phase 3 fixes the Phase-2-diagnosed mis-type: the operator-hosted MCP server's
own `{ isError, reason, path, detail }` error envelope, returned under
concurrent load, was reaching `parseMcpBooleanObservationResponse` and failing
its `schemaVersion` step → mis-typed `response_wrong_schema_version` /
`mcp_validation_failed` (NOT retryable), so the transient never healed. The fix
adds a single strict `isServerErrorEnvelope(extracted)` detection branch in the
Deno adapter, inserted AFTER the `extracted === null` guard and BEFORE the
parser; it types the envelope `provider_server_error` and carries it on the
already-retryable `api_error` reason → `mcp_api_error`, so the EXISTING bounded
retry (MAX_ATTEMPTS=2, backoff 2s/8s, concurrency 2) heals it with ZERO
dispatch-config edit. The server's short `reason` rides the Phase-1 sanitizer
as a new untrusted-forwarded-with-scrub `serverReason` field; the raw envelope
`detail` blob has no entry point. The implementation matches the design and
intent exactly. All gates green (typecheck/lint/test exit 0; 18413/580). No
dispatcher/core/log/schema-mirror edit (all byte-equal vs main). No migration.
No doctrine violation, no secret surface. The recovery claim (e/f) is an
honestly-labeled coverage-wall composition matching prior MCP-021C retry
proofs. Nothing concerns me; this is ready to push.

## Verification (independently captured)

- typecheck: **pass** (`tsc --noEmit`, exit 0)
- lint: **pass** (`eslint . --ext .ts,.tsx --max-warnings 0`, exit 0)
- test: **18387 → 18413 tests (+26); 579 → 580 suites; exit 0; 0 failures, 0 snapshots; 17.16 s**
  - Summary line: `Test Suites: 580 passed, 580 total / Tests: 18413 passed, 18413 total`
  - No `moveMetadataLedger` perf-benchmark flake this run.
- `.skip`/`.only`/`xit`/`xdescribe` in changed test files: **none**
- `console.log` in changed production files: **none**
- secret scan: **clean** (only hits: `authorization: '...'` is a HOSTILE-test key NAME with value `'...'`; the other is design-doc prose. No `sk-ant-`/`xai-`/`sb_secret_`/JWT/Bearer-token/`Authorization:`-header VALUE present anywhere. All simulated secrets are fragment-assembled — no contiguous secret literal.)
- doctrine scan: **clean** (only hits: the ban-list test's own forbidden-token list + design-doc prose listing them; no verdict language applied to anyone)
- Migration apply: **N/A — no migration** (`git diff --name-only` shows zero files under `supabase/migrations/`; zero `.sql`)

## Diff footprint (matches the brief exactly)

9 files, all expected:
- `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts` (+the detection predicate + block)
- `supabase/functions/_shared/booleanObservations/booleanObservationFailureSubreason.ts` (+vocab value + `serverReason` field + scrub/cap)
- `__tests__/mcpOneTwoOneCServerErrorEnvelope.test.ts` (new SEV suite)
- `__tests__/booleanObservationFailureSubreason.test.ts` (edited)
- `__tests__/mcpOneTwoOneCEdgeAdapterSourceScan.test.ts` (edited)
- `__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts` (edited)
- `__tests__/_helpers/booleanObservationFailureSubreasonDeno.ts` (test bridge)
- `docs/core/current-status.md` (+1 line)
- `docs/designs/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-PHASE3.md` (design)

**CONFIRMED ABSENT** (empty `git diff` vs main, byte-equal): `autoTriggerDispatcher.ts`,
`classifyArgumentCore.ts`, `autoTriggerLog.ts`, `booleanObservationMcpAdapterCore.ts`,
`mcpBooleanObservationSchema.ts` + both mirrors (`mcp-server/lib/…Mirror.ts`,
`src/features/nodeLabels/…`), `familyRegistry.ts`, `booleanObservationRequestBuilder.ts`,
`autoTriggerConcurrency.ts`, any migration, `package.json`/lockfile. No changed
production `.ts` under `src/` or `app/`.

## Targeted scrutiny (8 items + migration)

1. **Detection correctness (bug fix + HALT-7) — PASS.** Predicate at adapter
   `:215-221`: STRICT `(extracted as Record<string, unknown>).isError === true`
   (not truthiness), plus the three-part object check (`typeof === 'object'`,
   `!== null`, `!Array.isArray`). Block at `:212-235` sits AFTER the
   `extracted === null` guard (`:202-210`) and BEFORE
   `parseMcpBooleanObservationResponse(extracted)` (`:246`) — the envelope never
   reaches the validator. It reads `extracted.reason`/`extracted.path` (`:229-231`),
   NOT `parsed.details`. SEV-12 proves `{schemaVersion:'wrong'}` AND
   `{isError:false, schemaVersion:'wrong'}` both still route to the parser →
   `wrong_schema_version`; SEV-12b asserts the strict-`===true` form is present
   AND the truthiness form (`if (extracted.isError) {`) is absent — non-vacuous
   discriminator. Belt-and-suspenders `response_wrong_schema_version` site
   (`:265-277`) is byte-equal, stays `validation_failed` → non-retryable.

2. **Narrow retry (HALT-1; highest attention) — PASS.** Read the real source:
   `RETRYABLE_FAILURE_REASONS` (dispatcher `:119-123`) is byte-equal — the
   3-element set `{mcp_network_error, mcp_api_error, mcp_rate_limited}`;
   `mcp_validation_failed` ABSENT. `MAX_ATTEMPTS = 2` (`:112`), `RETRY_BACKOFF_MS
   = [2000, 8000]` (`:129`, byte-equal at main and HEAD),
   `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` (autoTriggerConcurrency.ts:12,
   file unchanged). The envelope rides retry ONLY via the `api_error` carrier
   (`classifyArgumentCore.ts:171-172` `case 'api_error': return 'mcp_api_error'`,
   unchanged). `response_wrong_shape`/`missing_field`/`not_json`/belt-and-suspenders
   `response_wrong_schema_version` stay NON-retryable (their `failure_reason`
   is `mcp_validation_failed`/`mcp_parse_failure`, not in the set). No new class
   became retryable. FAIL-26 locks the byte-equal set; SEV-7/SEV-11 cross-check.

3. **serverReason secret-surface (HALT-4; migration-grade) — PASS.** Entry guard
   (`:394-396`): `typeof === 'string' && !looksSecret(...)` then
   `.slice(0, MAX_EXPECTED_PATH_CHARS)` (=200). Defense-in-depth delete
   (`:414-416`). Tier-2 truncate (`:449-451`). Last-resort `minimal` object
   (`:455-460`) drops `serverReason` entirely. `FailureDetailInput` (`:234-252`)
   has NO `detail:` arg — the raw envelope blob has no entry point.
   `looksSecret`/`SECRET_SHAPE_MATCHERS` (`:283-302`) cover sk-ant-/xai-/sb_secret_/
   JWT/Bearer/Authorization/SERVICE_ROLE. HOSTILE test SEV-13 feeds Bearer
   (serverReason), JWT (path), sk-ant- (expected), sb_secret_/prompt/authorization
   (key names) and asserts: no banned shape in serialized output, `serverReason`
   undefined (dropped), `path` undefined, `expected` undefined, surviving keys
   identifier-shaped. DET-23 proves EVERY banned class via `serverReason` yields
   `undefined`. Non-vacuous: removing the `looksSecret` guard would store the
   Bearer-shaped value and `assertNoBannedShapes` + the `toBeUndefined` would
   both fail. SEV-14/DET-24 prove benign survives (shape-based, not blanket).
   `serverReason` is the verification focal point and it is locked down.

4. **Recovery composition (e/f) — PASS (accepted).** The dispatcher loop is not
   Jest-loadable (pulls `npm:@supabase`, reads `Deno.env`), matching the repo's
   established coverage wall. SEV-8 (e) is a documented conjunction: behavioral
   leg `edgeMapToFailureSubreason('api_error') === 'provider_api_error'` (carrier
   is a retryable provider class) ∧ source-scan leg `lastSummary.status ===
   'success'` (dispatcher `:287`) + `outcome: 'triggered'` (`:299`) break-on-success.
   SEV-9 (f): source-scan `failure_sub_reason: terminal?.failureSubReason` +
   `failure_detail: terminal?.failureDetail` (dispatcher `:349-350`) + bounded by
   `attemptNumber >= MAX_ATTEMPTS` (`:327`) ∧ behavioral sanitized detail. Test
   comments state the conjunction explicitly — honestly labeled, not a hidden
   gap. Matches Phase 1 + parallelization-card retry proofs.

5. **`provider_server_error` vocab — PASS.** Union (`:71`) + `ALL_…` (`:95`) grow
   15→16, value in the provider group between `provider_api_error` and
   `provider_network_error`. Set DIRECTLY in the adapter (`subReason:
   'provider_server_error'`), no `mapToFailureSubreason` arm. The two
   `switch`+`_exhaustive: never` guards are over `McpBooleanObservationParseFailureReason`
   (`:146`) and `BooleanObservationUnavailableReason` (`:187`) — the INPUT
   unions, NOT `BooleanObservationFailureSubreason` — so no exhaustiveness break.
   VOCAB-1 asserts the exact 16-value ordered list; VOCAB-2 ban-list iterates all
   16 → `provider_server_error` proven verdict-free. SEV-4 confirms length 16 +
   provider-group position.

6. **Test bridge — PASS.** `_helpers/booleanObservationFailureSubreasonDeno.ts`
   adds `provider_server_error` to the union (provider group) + `serverReason`
   to `BooleanObservationFailureDetail` + `FailureDetailInput`. It `require`s the
   REAL Deno module (`${BO}/booleanObservationFailureSubreason`) and re-exports
   `ALL_…`/`mapToFailureSubreason`/`buildFailureDetail` — local TS type mirror
   over real runtime behavior. No `as any`, no behavior change. Faithful.

7. **Doctrine — PASS.** `provider_server_error`/`serverReason` are
   transport/server facts (a server returned its own error envelope under load) —
   verdict-free, operator-diagnostic. They appear NOWHERE under `src/` (no
   `gameCopy` entry, no UI render, no timeline). Submit stays non-blocking
   (dispatcher byte-equal, fire-and-forget from submit-argument's tail; adding a
   retry to an already-retryable class changes nothing). No truth label. The
   classifier still produces only Machine Observations; a failure envelope is not
   a label on anyone's node.

8. **Test delta substantive — PASS.** +26 net (18387→18413), within +18..+26,
   well under the +50 HALT ceiling. New SEV file = 18 `it()` (SEV-1..15 + b-suffix
   sub-assertions); `booleanObservationFailureSubreason.test.ts` +5
   (DET-6a/23/24/25 + VOCAB-1 retitle-as-edit); source-scan +3 (SCAN-26/27/28);
   FAIL-26 +1. Every test maps to a required (a)-(h) point, a HALT guard, the
   sanitizer, or a regression. Not padding.

**Migration check — PASS.** No migration, no SQL, no DB column — type/logic only,
as expected. No heightened SQL review applicable.

## Blockers

None.

## Suggestions (non-blocking)

1. The Phase-3 design forecast said the new SEV suite is "≈15" tests; the actual
   count is 18 (the `b`-suffixed sub-cases: SEV-1b, SEV-12b, SEV-15b). This is a
   forecast undercount, not a defect — the extra cases are all legitimate and the
   total +26 stayed within the +18..+26 band. No action needed; noted only so the
   next phase's forecaster accounts for `b`-suffix splits.

## Operator next steps

- Push the branch: `git push -u origin feat/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-p3`
- Open PR: `gh pr create --title "OPS-MCP-RESULT-VALIDATION-BURST-HARDENING: Phase 3 (FIX) — detect {isError} envelope before the MCP-021A validator (+26)" --body-file docs/audits/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-PHASE3-REVIEW-2026-05-29.md`
- Deploy: **none manual.** The Supabase GitHub integration auto-redeploys Edge
  Functions on merge to `main` (the detection branch + additive vocab/field ship
  automatically). There is NO migration → NO `db push`.
- Phase 4 (gated SPEND verify of families A-G, concurrency ≤2, p95 < 30s WITH the
  retry) is a separate operator-approved step — NOT part of this merge.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree
  cleanup (operator step)".
