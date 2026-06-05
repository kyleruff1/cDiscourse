# ADMIN-ARGUMENTS-003 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-05
**Branch:** feat/admin-arguments-003 (HEAD `d71c45a`)
**Base:** origin/main (`8278390`)
**Card:** GitHub issue #469 — Admin Arguments: unblocked slices (runTag/room-source filter + persistable view prefs). No standalone design doc; spec is the issue body + reviewer prompt.

## Summary

This card ships exactly the two unblocked slices and nothing more: (1) a client-side
**runTag / room-source filter** that classifies each room by the corpus suffix the
fixture runners append to the debate title (read off the EXISTING `debates(title)`
JOIN — no new column, no new query, loader untouched), and (2) a **persistable
view-prefs v1** layer (density / sort / runTag filter / participant kind / limit) in
AsyncStorage, scoped `cdiscourse:admin-arguments-prefs:admin`, restored on remount.
The work is pure-client: no Edge Function, no migration, no service-role, no new
dependency, no provider call. The three deferred slices (classifier-coverage column,
active bot/human filter, coverage band thresholds) are correctly **not built** —
`participantKind` is in the persisted schema but inert, surfaced with honest
"Bot / human filter coming later." copy, mirroring the PR-001 inert-colour-blind-mode
precedent. Doctrine is clean: the runTag filter is framed throughout as a
navigation/diagnostic aid, never a verdict, with ban-list test coverage over labels,
hints, and rendered copy. Forward-compat for #476 is real: `classifyRunFamily` takes
a `{ debateTitle }` context object so the swap to a durable `run_tag` column is a
one-line change at the single call site. The only concern is a pre-existing,
load-only perf-timing flake in an unrelated suite (see Verification), which passes in
isolation and is not introduced by this card.

## Verification

| Gate | Result |
| --- | --- |
| typecheck | pass (`tsc --noEmit`, exit 0) |
| lint | pass (`eslint . --ext .ts,.tsx --max-warnings 0`, exit 0) |
| test (full) | 650/651 suites, 19612/19614 passing, 1 skipped, **1 load-only flake** (exit 1 from the flake only) |
| test (card suites, isolated) | 5/5 suites, 95/95 passing (exit 0) |
| Migration apply | n/a — no `supabase/migrations/**` or `supabase/functions/**` touched |
| secret scan | clean (no key/token/Bearer/JWT in diff) |
| doctrine scan | clean (verdict tokens appear only in ban-list test arrays + negating doctrine prose) |

**Test delta:** 647 → 651 suites / 19559 → 19613 passing (+4 suites / +54 tests).
New suites: `adminArgumentsRunTagModel.test.ts`, `adminArgumentsPrefsModel.test.ts`,
`useAdminArgumentsPrefs.test.tsx`, `AdminArgumentsTab.runtagPrefs.test.tsx`. The
implementer's reported 651/19614 matches the reviewer re-run (the single failing
assertion is the flake below, which the implementer counted as passing because it is
green in isolation and under lighter load).

**Flake detail (not a blocker):** `__tests__/pointLifecycleModel.test.ts` →
`LIFE-001 performance › 250-node synthetic fixture builds in < 30 ms` returned 31 ms
vs a 30 ms budget under full-suite CPU contention. Re-run in isolation: **76/76 pass,
exit 0** (build at ~1 ms wall, well inside budget). This is the documented load-only
perf-timing class (same family as the known `moveMetadataLedger` flake the prompt
flagged). The card touches no performance-sensitive code — it adds a pure-TS prefs
model, a regex title classifier, and cosmetic cell padding — so it cannot be the
cause. Not a regression; not attributable to this branch.

## Design conformance

- [x] All scoped file-changes present — runTag model, prefs model, prefs storage,
  prefs hook, sessionKeys key, AdminArgumentsTab wiring, docs.
- [x] No undocumented file-changes — diff footprint is 13 files, all explained.
- [x] Data model matches scope — no `public.arguments` column added; runTag derived
  from the existing `debates(title)` embed; prefs are device-local AsyncStorage blob.
- [x] API contracts match scope — `adminArgumentsApi.ts` (the loader) is **untouched**;
  the filter is applied client-side in the `filtered` memo. No new loader param.
- [x] Deferred slices NOT partially built — no `loadAdminArgumentCoverage`, no
  `argument_machine_observation_results` query, no `profiles.is_bot` read, no
  threshold logic. `participantKind` persisted-but-inert with honest "coming later"
  copy.

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — runTag labels/hints are
  navigation framing ("xAI adversarial", "Rooms seeded from…"); ban-list test in
  `adminArgumentsRunTagModel.test.ts` + copy-literal scan in the UI shape test.
- [x] Score never blocks posting — N/A; admin read surface only, no submission path.
- [x] No service-role in client code — confirmed; secret/SERVICE_ROLE grep over
  `src/**` diff returns zero (the `service_role`/`token`/`secret` strings present are
  negative `.not.toContain(...)` assertions in tests).
- [x] No direct insert into public.arguments — confirmed; no write path at all
  (matches in `current-status.md` are historical prior-card prose).
- [x] No AI calls in production app paths — confirmed; no provider import or call.
- [x] Plain language only — labels/hints carry no internal snake_case code (asserted
  by `not.toMatch(/[a-z]+_[a-z]+/)` over every label and hint).
- [x] Epic-specific doctrine:
  - **cdiscourse-doctrine §1/§2/§9** — runTag is a NAVIGATION/DIAGNOSTIC signal, never
    a truth signal; the model header and the UI helper line both state "a navigation
    aid, not a verdict on any room."
  - **expo-rn-patterns** — RN primitives only (`View`/`Text`/`Pressable`), no new dep;
    model files (`adminArgumentsRunTagModel.ts`, `adminArgumentsPrefsModel.ts`,
    `adminArgumentsPrefsStorage.ts`) are pure TS / storage glue — only the hook imports
    React, per the feature-folder convention.
  - **accessibility-targets** — all new chips have `accessibilityRole="button"`,
    `accessibilityState={{ selected }}`, `accessibilityHint`, and
    `hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}` lifting the ~24px visual
    chip to ~44px vertical; sub-toolbars carry `accessibilityLabel`s. Density is a
    text/spacing control (no color-only signal); the filter conveys via label, not
    color. Reduce-motion: no animation introduced.

## Test coverage

- [x] New public functions have unit tests — `classifyRunFamily`,
  `runFamilyMatchesFilter`, `coerceRunTagFilterValue`, `mergeWithDefaults`,
  `applyPrefsPatch`, `densityToCellPaddingY` all covered, including
  null/garbage/wrong-type failure cases.
- [x] User-facing strings have ban-list assertion — verdict-token scan over every
  runTag label+hint and over the UI copy literals ("Room source:", "Density:",
  "Comfortable", "Compact", "Bot / human filter coming later.", the navigation-aid
  helper line).
- [x] Edge cases covered — body-mention guard (a "stress" word in prose does not
  mis-bucket), dash-compound precedence (`ai-corpus` beats bare `corpus`),
  case-insensitivity, null/empty title, corrupt/partial AsyncStorage blob,
  out-of-range limit, restore-on-remount round-trip.
- [x] Accessibility assertions present — UI shape test pins role / selected state /
  hint / hitSlop and testIDs on the new chips and controls.

## `adminArguments.test.ts` change check (UPDATED, not RELAXED)

Confirmed. Two of the three sort-wiring assertions were rewired to match the
prefs-routed source (default `updated_at`/`desc` now asserted via
`const sortField = prefs.sortField` and the toggle via `updatePref('sortDirection', …)`)
— **behavior is unchanged**, the canonical default is pinned in the new
`adminArgumentsPrefsModel.test.ts`. The third assertion (pass-through to
`loadAdminArguments`) is unchanged. No assertion was deleted, weakened, or skipped;
net test count rises.

## Blockers

None.

## Suggestions (non-blocking)

1. The `filtered` memo's dependency array is `[rows, search, runTagFilter]`, which is
   correct (density does not affect filtering). No action needed — noted only to
   confirm the reviewer checked it.
2. When #476 lands, the single swap site is the `classifyRunFamily({ debateTitle })`
   call in the `filtered` memo; the follow-up issue `DEVEX-RUNTAG-COLUMN-SWAP-001`
   (referenced by the sibling classifier-health panel) is the natural home to track
   un-deferring this and the bot/human filter (Blocker B1).

## Operator next steps

- Client-only card (no `supabase/functions/**`, no `supabase/migrations/**`) →
  autonomous green squash-merge is permitted under governance §5 after this approve.
- Push the branch: `git push -u origin feat/admin-arguments-003`
- Open PR: `gh pr create --title "ADMIN-ARGUMENTS-003: runTag filter + persistable prefs (#469)" --body-file docs/reviews/ADMIN-ARGUMENTS-003.md`
- Deploy steps: none (pure-client; no Edge/migration to deploy).
- To un-defer the remaining slices later: resolve Blocker B1 (confirm the
  `profiles.is_bot` column name) for the bot/human filter; resolve B3 (client-RLS vs.
  new Edge action) + B4 (band thresholds) for the classifier-coverage column.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup".
