# OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 1 (TYPE) — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-29
**Branch:** feat/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-p1 (5 implementer commits on design `f3add41`; none pushed)
**Design:** docs/designs/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING.md (+ `-intent.md`)
**Issue:** #365

## Summary

Phase 1 stops the adapter discarding the MCP-021A validator's granular `{reason}` and threads a
typed, controlled sub-reason vocabulary (`request_`/`response_`/`provider_` split, 15 values) plus a
bounded, migration-grade-sanitized `detail` object through `BooleanObservationAdapterResult` →
`PerArgumentSummary` (the RETURN read by the Phase 2 harness) and the `AutoTriggerLogFields`
structured log. It is type-only and additive: `reason:'validation_failed'` and
`failure_reason='mcp_validation_failed'` are byte-preserved (HALT-9), no migration, no schema-mirror,
no retry/concurrency/Family-H change. The work is exemplary — the sanitizer is named-args-only +
re-derive-not-forward + defense-in-depth scrub + 2000-char cap, and the hostile-fixture test battery
is non-vacuous (it would go red if the scrub were removed). All ten scrutiny items pass, the changed
set is exactly as specified, and every forbidden file is absent. The only concern is environmental:
the full-suite run reported 1 failed / 18386 passed because an **unrelated, untouched** perf
micro-benchmark (`moveMetadataLedger.test.ts`, asserts a 250-msg ledger builds in <60ms) clocked
61ms under parallel load; re-run in isolation it passed in 9ms. This is a known flaky timing
assertion, not a Phase-1 regression — the effective gate is green at 18387 / 579.

## Verification (independently captured)

| Gate | Result |
|---|---|
| typecheck (`tsc --noEmit`) | **pass** — exit 0 |
| lint (`eslint . --max-warnings 0`) | **pass** — exit 0 |
| test (`jest`) | **18387 total / 579 suites**; full run reported `1 failed, 18386 passed` (exit 1) due to ONE unrelated flaky perf benchmark; isolated re-run of that suite = `49 passed` exit 0 (perf test 9ms). Effective: **green at 18387 / 579** |
| secret scan | **clean** — zero real key material; test fixtures assemble banned shapes from fragments (no contiguous literal) |
| doctrine scan | **clean** — no verdict/truth token in any of the 15 vocab values or any production line; no service-role/Anthropic in src/app (card touches no client file); no direct `public.arguments` insert |
| Migration apply | **N/A — no migration** (Phase 1 is type-only; `git diff --name-only -- 'supabase/migrations/**'` is empty; CONFIRM-ABSENT verified) |

### The one red line (non-blocking, environmental)

```
FAIL __tests__/moveMetadataLedger.test.ts
  ● META-001 … builds a 250-message synthetic ledger in < 60 ms
    Expected: < 60 / Received: 61
```
- `git log/diff main...HEAD -- __tests__/moveMetadataLedger.test.ts` = **empty** (file untouched by this branch).
- Isolated re-run: `npx jest __tests__/moveMetadataLedger.test.ts` → **49 passed, exit 0**, perf test **9 ms**.
- A 1ms-over wall-clock benchmark tipped by concurrent-suite load. Per test-discipline this is a flaky
  perf assertion (pre-existing tech debt in an unrelated file), not a gate failure of this card. The
  implementer's claimed **18387 / 579** count is accurate (18386 passed + the 1 flaky = 18387 total).

## Design conformance

- [x] All design file-changes present (new module + Jest bridge + 2 new test files; 5 modified source; 4 edited tests; current-status; design doc)
- [x] No undocumented file-changes — changed set is **exactly** the brief's expected set
- [x] Data model matches design (optional `subReason?`/`detail?` on `unavailable`; `failureSubReason?`/`failureDetail?` on `PerArgumentSummary`; `failure_sub_reason?`/`failure_detail?` on `AutoTriggerLogFields`)
- [x] API contracts match design (`mapToFailureSubreason`, `buildFailureDetail`, `unavailableReasonToFailureReason` byte-equal)

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — N/A user-facing; VOCAB-2 ban-list proves the vocab is verdict-free
- [x] Score never blocks posting — untouched; change is inert (extra optional fields on a RETURN + log)
- [x] No service-role in client code — card touches no `src/`/`app/`; new module is server-tree, source-scan-fenced (SCAN-19)
- [x] No direct insert into public.arguments — none
- [x] No AI calls in production app paths — module is pure (SCAN-25: no `Deno.env`/`fetch`); no AI surface added
- [x] Plain language only — N/A; sub-reason is operator-diagnostic, never rendered to a user (design §9 N/A correctly documented; no `gameCopy` needed)
- [x] Epic-specific (cdiscourse-doctrine §6 secrets): the `detail` field is guarded by an allowlist builder; HALT-4 satisfied (see Scrutiny 1)

## Scrutiny items (1–10) + migration check

1. **SANITIZER (HALT-4) — PASS.** `buildFailureDetail` is named-args-only (no `extra`/`message`/`details`
   entry point); `receivedType` = `typeof input.received` internally (stores typeof even if a value is
   passed); `receivedKeys` capped ≤32 keys / ≤64 chars / `[A-Za-z0-9_]`-only; `path` static-allowlist-gated;
   `checkedRawKey` registry-validated (`MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY`); defense-in-depth
   `SECRET_SHAPE_MATCHERS` (sk-ant / xai- / sb_secret_ / JWT triple / Bearer / Authorization / SERVICE_ROLE,
   fragment-assembled); ≤2000-char serialized cap with graceful degradation (drop receivedKeys → truncate
   → `{validatorReason,schemaVersion}`). The hostile-fixture battery (DET-14, DET-20, DET-21, DET-22,
   DET-7/8/9/11) feeds **every** banned class through every entry point and asserts each is dropped/scrubbed;
   **non-vacuous** — DET-14 `toBeUndefined()` and DET-20 `assertNoBannedShapes` are coupled to the scrub and
   would fail if it were removed.
2. **`parsed.details` NEVER read — PASS.** The only `.details` occurrence in the adapter is a comment
   (line 190). Adapter passes `parsed.reason` (enum) + re-derives from `extracted`. Machine-enforced by
   SCAN-23 (strips comments/strings, asserts no `parsed.details`/`.details` in executable code).
3. **HALT-9 compat — PASS.** `reason:'validation_failed'` present at BOTH collapse sites (adapter `:196`
   main + `:214` schema-version belt). `unavailableReasonToFailureReason` byte-equal (diff shows the only
   `mcp_validation_failed` hit is an additive comment). FAIL-25 asserts `failureReason` is NOT derived from
   `subReason` (`not.toMatch(/failureReason:\s*adapterResult\.subReason/)`); SCAN-22 asserts ≥2 occurrences.
4. **RETURN threading (Phase 2 prereq) — PASS (source-scan accepted).** `classifyArgumentCore.ts`
   sets `failureSubReason: adapterResult.subReason` / `failureDetail: adapterResult.detail` in the
   unavailable branch (read in source). Asserted by THR-3 (interface declares both + 6 load-bearing fields),
   THR-4 (exactly ONE return sets each → only the unavailable branch), FAIL-23/24. Source-scan is adequate
   and matches the established coverage wall (`classifyArgumentCore` transitively imports
   `@supabase/supabase-js` via `supabaseClients.ts` → not Jest-loadable); the behavioral half rides on the
   real pure map via the `require()`-based Jest bridge. (See Suggestions for an optional behavioral seam.)
5. **SEC-8 + REG-8 edits — PASS.** SEC-8 KEEPS all 9 Decision-9 `.toContain` field assertions and only adds
   `failure_sub_reason?:`/`failure_detail?:` + updates the title/comment. REG-8 KEEPS all 6
   `PerArgumentSummary` field assertions, flips the stale "no new fields" title to the accurate wording, and
   adds the 2 new optional-field assertions. Neither deleted a field-present assertion. (The implementer
   correctly caught that the design's modified-test list omitted SEC-8 — and edited it anyway, per
   test-discipline's "no contradicted intent left in place.")
6. **SEC-7 / SEC-9 / DREG-16 / EFH-26 — PASS.** No new field name contains `body`/`currentText`/`parentText`
   (SEC-7) or `bearer`/`authorization`/`token`/`serviceClient`/`SERVICE_ROLE`/`anthropic`/`mcp-token`
   (SEC-9/EFH-26). `emitAutoTriggerLog` body byte-equal (DREG-16 family tag preserved — diff touches only
   the interface). EFH-26 + SEC-9 green in the full run.
7. **Dispatcher minimal touch (HALT-1/5) — PASS.** `autoTriggerDispatcher.ts` diff = **7 added lines, 0
   removed** — the comment + 2 field pass-throughs at the terminal-failure `emitAutoTriggerLog` site.
   `RETRYABLE_FAILURE_REASONS`, `isSummaryRetryable`, `MAX_ATTEMPTS`, retry loop, bounded-concurrency
   dispatch, success-only idempotency guard, `AutoTriggerOutcome`, return type all byte-equal. THR-7
   independently asserts `MAX_ATTEMPTS=2`, `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` present,
   `RETRYABLE_FAILURE_REASONS` contains `mcp_network_error` and NOT `mcp_validation_failed`.
8. **Mapping correctness — PASS.** Exhaustive `never`-checked switch (mapValidatorReason + mapToFailureSubreason).
   `duplicate_node_id → unknown` (MAP-6); `url_missing`/`token_missing → undefined` (MAP-12/13); validator +
   adapter reasons map per the design table (MAP-1..11); totality proven (MAP-14, no throw).
9. **Doctrine ban-list — PASS.** No value in the 15-member vocab contains a verdict/truth token (VOCAB-2 +
   independent scan). Sub-reason is operator-diagnostic, never user-facing — no `gameCopy` required.
10. **Test delta substantive — PASS.** +50 = ~34 (`booleanObservationFailureSubreason.test.ts`: MAP-1..14,
    VOCAB-1..3, DET-1..13, DET-14/20/21/22) + 7 (`mcpOneTwoOneCFailureSubreasonThreading.test.ts` THR-1..7) +
    additions to 4 edited suites (FAIL-23..25, SCAN-21..25, SEC-8, REG-8). Legitimate hostile-fixture +
    mapping + threading coverage, not padding. Exceeds the +22..+30 forecast (the forecast was conservative;
    the hostile battery alone is substantial) and is well under the +60 HALT-10 ceiling.

**Migration check — PASS.** No `.sql` in the diff. CONFIRM-ABSENT verified: no `supabase/migrations`,
no `mcpBooleanObservationSchema.ts` (+2 mirrors), no `familyRegistry.ts`, no
`booleanObservationRequestBuilder.ts`, no `boundedConcurrencyRunner.ts`, no `autoTriggerConcurrency.ts`,
no `persistenceWriter.ts`, no `package.json`/lockfile.

## Test coverage

- [x] New public functions have unit tests (`mapToFailureSubreason`, `buildFailureDetail`, `ALL_…` — behavioral, via the real module through the Jest bridge)
- [x] User-facing strings have ban-list assertion (VOCAB-2; vocab is the only string surface and it is operator-only)
- [x] Edge cases from design § "Edge cases" have tests (`duplicate_node_id`, `validation_failed` w/o validatorReason, url/token unset, cap degradation, non-object receivedKeys, empty input)
- [x] Accessibility assertions — N/A (no UI card)

## Blockers

None.

## Suggestions (non-blocking)

1. **Optional behavioral seam for the RETURN threading (Phase 2 hardening).** The threading from
   `adapterResult.subReason`/`.detail` onto `PerArgumentSummary` is proven by source-scan (THR-3/4,
   FAIL-23/24), which matches the repo's accepted coverage wall and is sufficient. If Phase 2 wants a
   behavioral guarantee that the field reaches the RETURN, a thin pure helper (e.g.
   `buildUnavailableSummary(adapterResult): PerArgumentSummary`) extracted from the unavailable branch
   would be Jest-loadable and let a test assert the round-trip without dragging in `@supabase/supabase-js`.
   Defer-able; not required for Phase 1.

## Operator next steps

- Push the branch: `git push -u origin feat/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-p1`
- Open PR: `gh pr create --title "OPS-MCP-RESULT-VALIDATION-BURST-HARDENING: Phase 1 (TYPE) — typed validation sub-reason at the failure point" --body-file docs/audits/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-PHASE1-REVIEW-2026-05-29.md`
- **Deploy:** none manual. No migration (no `db push`). The additive optional fields ship inertly via the
  Supabase GitHub merge auto-deploy of the Edge Functions (~30–90s after merge to `main`). The change
  cannot alter the run row, `failure_reason`, or whether submit is blocked.
- **Phase 2** (gated SPEND reproduction harness reading `PerArgumentSummary.failureSubReason` off the
  admin_validation RETURN) is a separate operator-approved step — not part of this merge.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".
- This audit doc is intentionally NOT `git add`-ed — staged/committed by the orchestrator.
