# META-1B — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-24
**Branch:** feat/META-1B-realtime-multi-user-manual-tag-sync
**Design:** docs/designs/META-1B.md

## Summary

META-1B introduces the first Supabase Realtime postgres-changes subscription in the production app: a JWT-authed `point_tags:debate:${debateId}` channel that broadcasts INSERT and UPDATE events for `public.point_tags` rows filtered by `debate_id=eq.${id}`. A pure-TS reducer (`src/features/metadata/pointTagsRealtime.ts`) owns the merge / diff / echo-tracker / latest-change helpers; a React hook (`src/features/metadata/usePointTagsRealtime.ts`) owns the channel lifecycle (exponential backoff capped at 30 s / max 6 attempts, teardown on unmount + debateId change, reconcile-on-SUBSCRIBED). `useArgumentRoomMessages` wires the hook with Option A integration per design §4, merging realtime events directly into `pointTagsByArgumentId`. A scoped reconcile fetcher (`fetchPointTagsForArguments`) is co-located in `argumentsApi.ts` next to `fetchArgumentRelations`. Echo suppression by row id (apply) and predicate (remove, 60 s TTL). `ROOM_REALTIME_COPY` in `gameCopy.ts` carries the screen-reader strings (move-anchored, no PII slot). The implementation matches the design as written, all four designer questions (Q1–Q4) are covered by code + tests, doctrine is clean, no read-only boundary file was modified, and the OPS-002/OPS-003 regression suite still passes.

## Verification

- typecheck: pass
- lint: pass
- test: 10492/418 → **10589/422** (+97 tests, +4 suites — matches implementer report)
- secret scan: clean (only hit is a test-assertion line `expect(raw).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/)`)
- doctrine scan: clean (no truth labels, no popularity framing, no person-attribution; the truth-label `grep` hits are all inside docs/test-assertions describing absences)

## Design conformance

- [x] All design file-changes are present (3 new source, 4 new tests, 4 modified source, 2 modified docs)
- [x] No undocumented file-changes
- [x] Data model matches design (no schema change; client-only)
- [x] API contracts match design (`PointTagRealtimeEvent`, `PointTagSubscriptionStatus`, `mergeRealtimeEvent`, `mergeReconcileResult`, `mapPointTagsRealtimeRow`, `pruneExpiredLocalIds`, `shouldSuppressEcho`, `diffPointTagSets`, `pickLatestChange`, `usePointTagsRealtime`, `fetchPointTagsForArguments`)

## Designer Q1–Q4 coverage

- **Q1 (new channel) — PASS.** `usePointTagsRealtime.ts:259-270` uses `supabase.channel('point_tags:debate:${debateId}').on('postgres_changes', { ..., filter: 'debate_id=eq.${debateId}' }, ...)`. Auth via the shared `supabase` client (JWT-only, no service-role). Verified by `__tests__/usePointTagsRealtime.test.ts` (27 tests covering binding shape, subscribe-state machine, teardown, 100x mount/unmount leak guard, source security scan).
- **Q2 (UI indicator) — PASS.** Silent visual merge (the tag appears via the existing META-001 read path). `AccessibilityInfo.announceForAccessibility` in `ArgumentGameSurface.tsx:432-457` reads `getManualTagPlainLabel(latest.row.tagCode)` and routes through `ROOM_REALTIME_COPY.tagAppliedAnnouncement(label)` / `tagRemovedAnnouncement(label)`. The block exists in `gameCopy.ts:1282-1310` and contains zero PII slots — both announcement functions accept `(label)` only. Verified by `__tests__/pointTagsRealtimeMerge.test.ts` lines 407-444 (asserts `length === 1` per function + ban-list scan).
- **Q3 (reconcile) — PASS.** `fetchPointTagsForArguments(argumentIds)` exists in `argumentsApi.ts:281-292`, executes a single `.from('point_tags').select(...).in('argument_id', ids).is('removed_at', null)` query. Called from `useArgumentRoomMessages.ts:117-141` on every `SUBSCRIBED` (hook invokes `onReconcileNeeded`). On `ok: false`, falls back to the loader's full `refresh()`. Coverage in `__tests__/pointTagsRealtimeReconcile.test.ts` (16 tests covering query shape, convergence, RLS-denied fallback, source security + doctrine scan).
- **Q4 (echo) — PASS.** `markLocalApply(rowId)` and `markLocalRemoveByPredicate({argumentId, tagCode, taggedByUserId})` exist on the hook surface. Both use `Map<string, number>` (or array predicate) with TTL default `DEFAULT_ECHO_TTL_MS = 60_000`. Suppression checks at `usePointTagsRealtime.ts:179-182` (INSERT) and 195-207 (UPDATE remove). Coverage in `__tests__/pointTagsRealtimeEcho.test.ts` (11 tests: own-write apply / remove by id and by predicate, two-participant concurrent apply, TTL expiry). **Optional regression-introduction smoke ran** (reviewer temporarily removed the suppression check in `handleInsert`; 2 echo tests failed correctly; revert restored 11/11 green).

## Read-only boundary verification

All MUST-be-empty diffs verified empty (0 lines each):
- `src/features/metadata/pointTagsApi.ts`
- `src/features/metadata/moveMetadataLedger.ts`
- `src/features/metadata/manualTagModel.ts`
- `src/features/metadata/metadataEvents.ts`
- `supabase/functions/apply-manual-tag/`
- `supabase/migrations/`
- `supabase/functions/`

OPS work preserved (0 lines each):
- `.claude/agents/roadmap-implementer.md`
- `.claude/agents/roadmap-reviewer.md`
- `.claude/scripts/`

## OPS-002 / OPS-003 regression suite

`npx jest __tests__/spawnCardBranchName.test.ts` → **13/13 tests pass** (no regression).

## Issue body side-task

Verified via `gh issue view 77 --json body`:
- The `## Do not implement yet` and `## Dependencies` (`Blocked by META-1A`) blocker clauses are GONE.
- The `## Dependency satisfied` note appears with the operator-provided text.
- Goal / Why it matters / Why P2 / Scope / Acceptance criteria / Tests / Doctrine constraints / Agent recommendation sections preserved verbatim.

## Doctrine self-check (all green)

- [x] No truth/winner/loser language in user-facing strings (`ROOM_REALTIME_COPY` ban-list test asserts)
- [x] Score never blocks posting (no scoring path is touched)
- [x] No service-role in client code (channel uses shared JWT-authed client; verified by source scan)
- [x] No direct insert into `public.arguments` (read-only `fetchPointTagsForArguments`; existing `apply-manual-tag` Edge Function remains the sole writer)
- [x] No AI calls in production app paths (no AI provider imported anywhere in the new files)
- [x] Plain language only (announcements use `getManualTagPlainLabel`; no internal codes leak)
- [x] No `console.log` in committed source (the lone `console.warn` in `logRealtimeError` is documented as the repo's structured-logger fallback, never logs payload bodies / auth header / row content)
- [x] No `.skip` / `.only` / `fdescribe` / `fit` in any new test file
- [x] Realtime broadcasts respect RLS — `pt_select_read_access` policy (EXISTS on `public.arguments`) inherits the QOL-039 visibility check; no client-side visibility re-check needed (design §9 verified against the migration file)
- [x] Epic-specific doctrine: `supabase-edge-contract` — read-only client SELECT is the documented exception (mirrors `fetchArgumentRelations`); JWT-only realtime auth; no migration; no Edge Function change. `expo-rn-patterns` — uses `AccessibilityInfo` RN primitive; no new dependency.

## Test coverage

- [x] 4 new test suites verified: pointTagsRealtimeMerge (40 `it()`), usePointTagsRealtime (27), pointTagsRealtimeEcho (11), pointTagsRealtimeReconcile (16) — total 94 `it()` blocks → 97 tests pass (small in-band describe-test additions account for the +3)
- [x] ban-list assertion present on `ROOM_REALTIME_COPY` strings
- [x] reducer + hook + reconcile + echo each covered by their own dedicated suite
- [x] Supabase realtime mock is a clean reusable pattern (first realtime mock in the repo per design §0.3)
- [x] All 422 suites pass (10589 tests)

## Minor observations (non-blocking)

1. `ArgumentGameSurface.tsx`'s `handleApplyManualTag` / `handleRemoveManualTag` are currently retained as dead code (`void handleApplyManualTag; void handleRemoveManualTag;` at lines 731-732) and do NOT yet call `markLocalPointTagApply` / `markLocalPointTagRemoveByPredicate`. This is consistent with the design's framing — the write-trigger UI is a thin follow-up; the read path is live — and the implementer's status doc explicitly notes "Write-trigger UI is a thin follow-up." Echo suppression is still verified at the hook level. When a future card wires the tag-apply UI control, that card must also wire the marker callbacks (the hook surface is already exposed via `useArgumentRoomMessages`). Worth a one-line note in the eventual follow-up card.
2. `pruneExpiredLocalIds` uses `expiry > nowMs - ttlMs`. This works because the `expiry` value stored is actually a timestamp (the time the marker was registered), not a true expiry — the comparison is therefore "age < ttl." The naming is a minor mismatch but the semantics are correct and well-tested. Non-blocking.

## Operator next steps

- Push the branch: `git push -u origin feat/META-1B-realtime-multi-user-manual-tag-sync`
- Open PR: `gh pr create --title "META-1B: Realtime multi-user manual-tag sync" --body-file docs/reviews/META-1B.md`
- Post-deploy verify (per design §15 OQ-1): Supabase dashboard → Database → Publications → confirm `point_tags` is in `supabase_realtime`. If absent, run once: `ALTER PUBLICATION supabase_realtime ADD TABLE public.point_tags;`. Default Supabase setup includes `FOR ALL TABLES` so this is almost certainly a no-op verification.
- Post-merge worktree cleanup: per OPS-002 / OPS-003 charter under `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)".
- Update `CLAUDE.md` "Current stage" line on stage completion (per repo convention; the implementer added the new test count to `docs/core/current-status.md` already).
