# ADMIN-ARGS-CANONICAL-001 — Review (GATE C)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-05
**Branch:** feat/admin-args-canonical-001
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/463
**Design:** docs/designs/ADMIN-ARGS-CANONICAL-001.md
**Reviewed at HEAD:** `ae14f85` (top of branch; sequence `ae14f85 → 59dd5ab → a1de313 → d5fcc75` over base `fe6c126`)

## Summary

This card ships design Option (a): a pure-TS view-model
`src/features/arguments/argumentArtifactModel.ts` (no React / Supabase / fetch)
wired into the EXISTING `AdminArgumentsTab.tsx`, mirroring
`conversationGalleryModel`'s suffix-tag dedupe at the argument level. The admin
list now renders one clickable artifact per logical argument with structural
badges (`N updates` / observation coverage or `n/a` / `N duplicate runs
collapsed`) and a Show/Hide update-history expansion. The diff is exactly 7
files (1 new model, 1 modified tab, 3 new tests, 1 ADDITIVE-extended test, 1
current-status line). No Edge, no migration, no new tab, no new query, no write.
The central discipline — `inactive_reason` non-exposure (§10a /
policy_no_censorship) — is held end-to-end: the admin sees WHAT is inactive
(`inactiveAt`-derived badge + the literal `' · inactive'` per-revision marker),
NEVER WHY. `inactiveReason` is not a field on either output type, is never read
in the model or tab, and is proven dropped from serialized output even under
poisoned-input tests. Typecheck, lint, and the full suite all pass at exit 0 with
the forecasted **641 suites / 19439 passing / 1 skipped / 19440 total**. No
concerns remain.

## Verification

| Gate | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint | pass (exit 0, `--max-warnings 0`) |
| test | pass (exit 0) — **638 → 641 suites / 19393 → 19439 passing / 1 skipped (unchanged) / 19440 total**; +3 suites / +46 passing, matches design forecast (+18..+24 tests; landed +46) and implementer claim |
| new + admin suites | 9/9 green: `argumentArtifactModel`, `argumentArtifactBanList`, `argumentArtifactInactiveResilience`, `AdminArgumentsTab.canonical`, `argumentInactiveLeakageScan`, `adminArguments`, `adminArgumentsSort`, `adminArgumentsTagJoin`, `AdminArgumentsTab.inactive` |
| secret scan | clean (the only `Bearer`-substring hit is prior-card prose in `current-status.md`, not a real token; 0 real secret values across all 7 files) |
| doctrine ban-list scan | clean (no winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist/stupid/idiot in any added source line) |
| Migration apply | n/a — no `supabase/migrations/**` touched (pure-TS read-path card) |

## The 17 adversarial checks

**1. `inactiveReason` NEVER exposed (THE check) — PASS.** `git diff main..HEAD |
grep -niE 'inactiveReason|inactive_reason'` returns hits ONLY in: test fixtures
feeding poisoned values, test assertions of absence, doctrine comments, and the
manifest. ZERO member-access reads. The model
(`argumentArtifactModel.ts`) has no `inactiveReason` field on `ArtifactSourceRow`
(input, lines 38-61), `ArgumentRevision` (lines 65-73), or `ArgumentArtifact`
(lines 75-97) — the field is structurally absent. The tab
(`AdminArgumentsTab.tsx`) never reads it; the canonical test pins
`r.inactiveReason` / `artifact.inactiveReason` / `\binactiveReason\s*[:=]`
absence (`AdminArgumentsTab.canonical.test.tsx:93-95`). The ban-list test proves
both the KEY and the poisoned VALUES (`policy_violation`, `spam`, `harassment`,
`abuse`) are absent from serialized output
(`argumentArtifactBanList.test.ts:84-94`).

**2. `isInactive` derived from `inactiveAt` ONLY — PASS.** Every `isInactive`
flows through the single helper `deriveRevisionIsInactive(row)` which reads
`(row.inactiveAt ?? null) !== null` (`argumentArtifactModel.ts:108-110`); its
input type does not even carry `inactiveReason`. Artifact `isInactive` is
`revisions.some(r => r.isInactive)` (`:286`). No ad-hoc derivation.

**3. No-resurrect invariant — PASS.** Each revision derives `isInactive`
independently in `toRevision` (`:181-189`); the artifact OR-folds for the badge
only and never clears a child (`:285-286`). Tab comment + code preserve this:
`const isInactive = artifact.isInactive || r.inactiveAt !== null`
(`AdminArgumentsTab.tsx:550-553`). Guarded by
`argumentArtifactInactiveResilience.test.ts:127-143` (inactive child keeps its
state even with a later active sibling revision).

**4. No write operations — PASS.** No `.insert/.update/.delete/.upsert` DB call in
non-test source. The one regex match (`next.delete(artifactId)`) is `Set.delete`
on local React expand-state, not a DB write. No `.from(` / `supabase.` /
`createClient` in any added source line.

**5. No moderation action — PASS.** No reactivate/modify/delete/ban/moderate
handler. The only new callback is `toggleArtifactExpanded` (pure
expand/collapse). The "hide" regex match is the toggle label `'Hide update
history'`. Canonical test pins absence of `hardDelete|deleteArtifact|
reactivateArtifact|modifyArtifact` (`AdminArgumentsTab.canonical.test.tsx:124`).

**6. No migration — PASS.** `git diff main..HEAD --name-only | grep
'^supabase/'` → empty. Zero `supabase/**` files touched.

**7. familyRegistry.ts byte-equal — PASS.** Not in the diff.

**8. engine.ts + submit-argument byte-equal — PASS.** Not in the diff.

**9. Producer chain byte-equal — PASS.** None of
`classifierRunRowFailureDetail` / `classifierDrainerCore` / `persistenceWriter` /
`classifyArgumentCore` / `autoTriggerDispatcher` in the diff.

**10. conversationGalleryModel + adminArgumentsApi + types byte-equal — PASS.**
None of `conversationGalleryModel.ts`, `adminArgumentsApi.ts`,
`admin/types.ts`, `arguments/types.ts` in the diff. The gallery dedupe pattern is
re-implemented locally (`SUFFIX_TAG_PATTERNS` at `argumentArtifactModel.ts:118-123`),
not imported — decoupling held.

**11. No raw content beyond existing admin display — PASS.** The history-revision
body uses `shortenBody(rev.body)` (`AdminArgumentsTab.tsx:660`), the same excerpt
function (max 160 chars) the existing primary-row body already used
(`:611`). No new full-body dump surface introduced.

**12. Column-explicit / no new query — PASS.** `grep -E
"supabase|createClient|fetch\(|from\('|react" argumentArtifactModel.ts` → 0. Pure
TS over already-loaded `AdminArgumentRow[]`; no fetch, no Supabase, no new query.

**13. Backward compat: NULL `inactiveAt` renders — PASS.** Tab maps
`inactiveAt: r.inactiveAt` straight into the source row
(`AdminArgumentsTab.tsx`); model treats NULL/absent as active. Covered by
`AdminArgumentsTab.canonical.test.tsx:114-118` and the full suite's pre-existing
admin row-count assertions (all green).

**14. No new env reads — PASS.** No added `Deno.env.get` / `process.env.` line.

**15. No provider call — PASS.** No `fetch(` / `http` / `anthropic` / `api.x.ai`
in added source (one fixture-only occurrence noted, in tests).

**16. Acceptance-gate invariant preserved — PASS.** Stated verbatim in the model
header (`argumentArtifactModel.ts:24-27`): the deterministic rules engine remains
the sole submission acceptance gate; classifiers run after storage. This is admin
read-path presentation grouping, downstream of every gate; it cannot affect
submissions. Deep-link route unchanged — `artifactId` IS the argument id for the
option-a primary key (`onOpenArgumentTimeline(r.debateId, r.id)`,
`AdminArgumentsTab.canonical.test.tsx:109`).

**17. No existing guard test RELAXED (THR-4) — PASS.** Only
`argumentArtifactInactiveResilience.test.ts` shows as modified; its diff is
ADDITIVE ONLY — the original `ADMIN-ARGS-INACTIVE-001 — isVisibleToNonAdmin
contract` describe block + the `isVisibleToNonAdmin` predicate are byte-intact;
the diff adds only the import block and three new `CANONICAL-001` describe blocks
after the original. No original assertion removed or relaxed. All 9 pre-existing
admin/inactive suites (incl. `argumentInactiveLeakageScan`,
`AdminArgumentsTab.inactive`, `adminArguments`) stay green in a targeted re-run —
no pre-existing row-count assertion broke, confirming the wiring is correct.

## Doctrine self-check

- [x] No truth/winner/loser language in user-facing strings (ban-list test scans every rendered artifact string incl. badges, body, qualifiers, title, revisions)
- [x] Score never blocks posting (read-path presentation only; no submit path touched)
- [x] No service-role in client code (no env read, no service-role token)
- [x] No direct insert into public.arguments (no write of any kind)
- [x] No AI calls in production app paths (no provider call in source)
- [x] Plain language only ("N updates" / "observations n/a" / "Show update history" / "Inactive" — no raw internal codes)
- [x] §10a Observations-vs-Allegations: `inactive_reason` is composer-only admin free text; the artifact surfaces WHAT (`inactiveAt`) never WHY (`inactiveReason`). THE load-bearing discipline; held end-to-end (check #1).

## Test coverage

- [x] New public functions have unit tests (`argumentArtifactModel.test.ts`: 22 `it` cases / 13 describes — `groupArgumentsIntoArtifacts`, `sortArtifactsByLatestActivity`, `filterArtifactsByQuery`, `deriveRevisionIsInactive`, `cleanArtifactTitleForDedupe`)
- [x] Ban-list assertion present (`argumentArtifactBanList.test.ts` — verdict tokens + `inactiveReason` key/value non-exposure)
- [x] Edge cases covered: no-resurrect, NULL inactiveAt active, poisoned-reason non-exposure, determinism, observation coverage absent → `n/a`
- [x] Accessibility present (history toggle has `accessibilityRole="button"` + `accessibilityState={{ expanded }}`; badge/history clusters carry `accessibilityLabel` + testIDs)

## Blockers

None.

## Suggestions (non-blocking)

1. Design §15 slice 5 (wire DebateListScreen / gallery / ViewAs / UserDetail
   `recentArguments` surfaces) is a documented fast-follow, intentionally out of
   scope here. Open Q1 (whether to extend the ViewAs/UserDetail Edge projection
   to carry `inactive_at`) remains an operator GATE-C decision. No action needed
   for this card.

## Operator next steps

- **Merge posture:** Per design §14/§5, Option (a) touches no
  `supabase/functions/**` and no `supabase/migrations/**`, so merge is NOT an
  Edge/DB deploy (nothing auto-applies on merge). The diff does touch `src/**`
  (app UI), which goes live via a separate Expo build/release the operator
  triggers — it is not auto-merged by a flag. Autonomous green squash-merge is
  permitted under governance §5; the operator merges and triggers the Expo
  release when ready.
- Push the branch: `git push -u origin feat/admin-args-canonical-001`
- Open PR / squash-merge per the standard flow.
- Trigger the Expo build/release to ship the admin UI change.
- Post-merge worktree cleanup per `.claude/agents/roadmap-reviewer.md`
  § "Post-merge worktree cleanup (operator step)".

## Boundary attestation

No code modified. No push. No PR opened. No merge. This review wrote only
`docs/reviews/ADMIN-ARGS-CANONICAL-001.md` and commits it on the same branch.
