# LIFE-1B — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Branch:** feat/LIFE-1B-retire-moveaddsaxisinformation-deprecate
**Design:** None — trivial cleanup; issue body (https://github.com/kyleruff1/cDiscourse/issues/73) was the spec. Card lands immediately after GAME-001 per LIFE-001's review note.

## Summary

LIFE-1B retires the JSDoc-deprecated runtime alias `moveAddsAxisInformation` that LIFE-001 shipped alongside the canonical `hasAdditiveAxisInformation`. The alias had zero callers in `src/` or `__tests__/` after GAME-001 landed using only the canonical name, so removal is safe and contains zero semantic change. The diff is exactly three files (one source file -11 lines, one barrel re-export -1 line, one doc note +15 lines). Test count is identically 4083 passing both before and after the change. Typecheck, lint, and `skills:validate` are all clean. No production code is logically affected; this is naming hygiene only.

## Verification

- typecheck: pass (zero output from `tsc --noEmit`)
- lint: pass (zero output from `eslint --max-warnings 0`)
- test: 4083 → 4083 tests passing (132 of 137 suites pass; the 5 failing suites are the pre-existing xAI / Anthropic / engagement-intel suites that require `.env.engagement-intelligence` and are operator-gated — failure reason is uniformly `env_file_missing`, identical on `main`)
- skills:validate: pass (`bot-provocateur` and `bot-revocateur` skill-gate OK)
- secret scan: clean
- doctrine scan: clean
- verdict-token scan: clean
- X-handle / X-URL scan: only hit is the **removed** JSDoc `- * @deprecated ...` line on a `-` (deletion) prefix — this is the scan-collision the implementer flagged, and removing it actually eliminates the existing scan-collision rather than introducing one

## Design conformance (issue body acceptance criteria)

The issue body listed four acceptance criteria. All four are met:

- [x] **(1)** `src/features/lifecycle/pointLifecycleAdvisoryInputs.ts` no longer defines `moveAddsAxisInformation` — confirmed: lines 75-83 (the `@deprecated` JSDoc + 7-line alias body) are removed; the canonical `hasAdditiveAxisInformation` at line 59 is intact and untouched
- [x] **(2)** `src/features/lifecycle/index.ts` no longer re-exports the alias — confirmed: line 46 is removed from the named-export block, the canonical `hasAdditiveAxisInformation` re-export remains at line 45
- [x] **(3)** `grep -r moveAddsAxisInformation src/ __tests__/` returns zero matches — confirmed: post-edit Grep across the whole worktree finds the identifier only in `docs/` (current-status.md historical reference + LIFE-001 design + LIFE-001 review), never in source or tests
- [x] **(4)** GAME-001's `exhaustionTimeoutModel.ts` is unchanged and still reads `hasAdditiveAxisInformation` — confirmed: imports it at line 43, calls it at line 465, file is not in the diff

## Doctrine self-check (must all be checked)

- [x] No truth/winner/loser language in user-facing strings (verdict-token grep clean on full diff)
- [x] Score never blocks posting (card does not touch any posting / submission path)
- [x] No service-role in client code (no `SERVICE_ROLE` token introduced in the diff)
- [x] No direct insert into `public.arguments` (no Supabase write of any kind)
- [x] No AI calls in production app paths (no `fetch(` introduced; no Anthropic / xAI / X API surface touched)
- [x] Plain language only — no raw internal codes in UI strings (no UI string changed)
- [x] Pure-TS engine purity preserved — `pointLifecycleAdvisoryInputs.ts` remains pure TS, JSON-serializable I/O, side-effect free; only a redundant alias was removed
- [x] Rules engine sacred boundary respected — no change to `src/lib/constitution/engine.ts` or its dependents
- [x] Test discipline (`test-discipline` skill) respected — no alias-equivalence test existed, so none was removed; the canonical function retains its full pre-existing test coverage; no test was skipped or commented out
- [x] Migration discipline (`supabase-edge-contract` skill) respected — no migration written, no Edge Function modified, no RLS surface touched

## Test coverage

- [x] No new public function introduced — coverage requirement is purely "do not regress existing coverage"
- [x] `hasAdditiveAxisInformation` retains its pre-existing test coverage in `__tests__/pointLifecycleAdvisoryInputs.test.ts` (untouched)
- [x] No user-facing string changed — no ban-list assertion needed
- [x] No UI surface changed — no accessibility assertions needed
- [x] Test count unchanged at 4083 — exactly what the implementer reported, exactly what doctrine expects for a name-only retirement

## `@deprecated` safety-scan note (for future readers)

The implementer flagged a subtle hazard worth recording: the literal token `@deprecated` matches the X-handle regex `@<3-15-alphanum>` that `scripts/maintenance/diagnosticInspectPackage` and similar safety scans use to look for leaked X handles. The retired alias's JSDoc comment contained `@deprecated Prefer …` which would trip that scan as a false positive going forward. By retiring the alias the false-positive source is eliminated. The new doc paragraph in `docs/current-status.md` deliberately phrases the change as "JSDoc-deprecated" / "deprecated alias" and never uses the bare `@deprecated` token — verified by Grep, zero matches in the new doc.

## Blockers

None.

## Suggestions (non-blocking)

1. **None substantive.** This is the right size for a cleanup card and the right time to land it (immediately after GAME-001 confirmed the canonical name is the only consumer-facing one).
2. (nit, future) Future cleanup cards of the same shape ("retire JSDoc-deprecated alias right after consumer X lands") could be batched at release boundaries rather than carrying an issue each — but having the issue + commit + review trail is also useful for auditability, so the current cadence is fine.

## Operator next steps

- Push the branch: `git push -u origin feat/LIFE-1B-retire-moveaddsaxisinformation-deprecate`
- Open PR:
  ```
  gh pr create --title "LIFE-1B: Retire moveAddsAxisInformation deprecated alias" --body-file docs/reviews/LIFE-1B.md
  ```
- **No deploy step.** Pure local change — no migration, no Edge Function, no hosting file. Merging the PR is the entire operator action.
