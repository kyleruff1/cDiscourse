# LIFE-1A — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Branch:** feat/LIFE-1A-tighten-lifecycle-perf-test-budget
**Design:** docs/designs/LIFE-001.md §"Test plan" (no separate LIFE-1A design — issue #72 declares "no design pass needed", test-budget tuning card)

## Summary
This card tightens the LIFE-001 performance test budget for `buildPointLifecycleMap`
on a 250-node synthetic fixture from a deliberately generous `< 120 ms` ceiling
to the LIFE-001 design target of `< 30 ms`. The single commit (3f74d8d) changes
exactly one file, `__tests__/pointLifecycleModel.test.ts`, +6 / -2, test-only.
The implementer characterized cold-run wall time over 15 fresh jest processes
(samples [4,4,4,4,4,5,5,5,5,5,5,5,5,6,7], p95 = 7 ms, max = 7 ms) and applied the
card's prescribed formula `max(30, p95 * 1.5) = max(30, 10.5) = 30`. The new
budget floors at the design target with roughly 4x headroom over observed p95.
The reasoning is sound, the temporary `console.log` instrumentation was removed
before commit, and no production code is touched. Approve.

## Verification
- typecheck: pass
- lint: pass (eslint --max-warnings 0; no eslint-disable introduced)
- test: 4105 → 4105 tests / 137 → 137 suites (no test added or removed — expected for a
  threshold-tuning card that mutates an existing assertion in place)
- targeted perf test: 3 consecutive cold `npx jest` runs of the `250-node synthetic`
  test — all PASS
- secret scan: clean
- doctrine scan: clean

## Design conformance
- [x] All design file-changes are present (single-line threshold change + comment)
- [x] No undocumented file-changes (1 file, test-only; no src/app/supabase touch)
- [x] Data model matches design (n/a — no data model change)
- [x] API contracts match design (n/a — no API change)

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings — diff adds no strings
- [x] Score never blocks posting — n/a, no scoring path touched
- [x] No service-role in client code — n/a, no client code touched
- [x] No direct insert into public.arguments — n/a, no DB code touched
- [x] No AI calls in production app paths — n/a, no production code touched
- [x] Plain language only — n/a, no UI strings; the new comment is dev-only
- [x] Epic-specific doctrine — `test-discipline` skill: test count must not go down
  (it holds steady; a threshold-tuning card mutating one assertion in place is the
  documented exception), no `.skip` / `.only` / `xit` / `xdescribe` introduced, no
  committed `console.log`. The 75 "skipped" lines in the targeted run are jest's
  count of *non-matching* tests filtered out by `--testNamePattern`, not `it.skip`
  in the file — the full `npm run test` run shows 0 skipped.

## Test coverage
- [x] New public functions have unit tests — n/a, no new functions
- [x] User-facing strings have ban-list assertion — n/a, no new strings
- [x] Edge cases from design have tests — the perf test itself is the LIFE-001
  "Test plan" edge case; this card only retunes its threshold
- [x] Accessibility assertions present — n/a, not a UI card

## Blockers
None.

## Suggestions (non-blocking)
1. The measured window (`start` → `elapsed`) wraps both `buildTimelineMap(nodes)`
   and `buildPointLifecycleMap(...)`, while the LIFE-001 design target of `< 30 ms`
   is stated for `buildPointLifecycleMap` alone. The card scope explicitly forbids
   restructuring the measurement, so this is not a blocker — and the observed p95
   of 7 ms (with both calls inside the window) sits ~4x under the 30 ms floor, so
   the conflation does not create flake risk today. If a future LIFE card narrows
   the measurement to `buildPointLifecycleMap` only, the comment block here should
   be updated so it does not claim to measure exactly the design-target operation.
2. 30 ms on a cold shared CI runner is tighter than the old 120 ms but is the
   stated design target and carries ~4x headroom over the worst local cold sample
   (7 ms). If CI ever flakes on this assertion, the recorded formula
   `max(30, p95 * 1.5)` gives a clean, auditable way to re-tune from CI-measured
   p95 rather than guessing. No action needed now.

## Operator next steps
- Push the branch: `git push -u origin feat/LIFE-1A-tighten-lifecycle-perf-test-budget`
- Open PR: `gh pr create --title "LIFE-1A: Tighten lifecycle perf test budget toward design target" --body-file docs/reviews/LIFE-1A.md`
- Deploy steps: none — test-only change, no migration, no Edge Function, no app code.
