# OPS-ADMIN-ARGS-PROFILES-EMBED-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-05
**Branch:** feat/ops-admin-args-profiles-embed-001
**Branch HEAD reviewed:** 498e4bca (single commit)
**Base:** origin/main 20264cc
**Design:** none — P0 production hotfix tracked by GitHub issue #503 (spec is the issue + CLAUDE.md doctrine)
**GATE:** C

## Summary

This is a one-line P0 hotfix. #480 (ADMIN-ARGS-INACTIVE-001) added a second
foreign key from `public.arguments` to `public.profiles` (`inactive_by →
arguments_inactive_by_fkey`), which made the loader's bare
`profiles(display_name)` PostgREST embed ambiguous ("more than one relationship
was found for 'arguments' and 'profiles'"), breaking the entire Admin → Arguments
tab. The fix pins the author FK — `profiles!arguments_author_id_fkey(display_name)`
— in `loadAdminArguments`'s `.select(...)`. The returned JSON key stays
`profiles`, so `asDisplayName(r.profiles)` and `RawArgumentRow.profiles` are
unchanged. The change mirrors the existing FK-pinning idiom already used in
`adminMetadataEventsApi.ts` (`point_tags_tagged_by_fkey` / `point_tags_removed_by_fkey`).
The fix is correct, minimal, doctrine-clean, and backed by a true negative-control
regression test. Full suite is green. No concerns remain.

## Verification

| Gate | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint | pass (exit 0, `--max-warnings 0`) |
| test (full suite) | pass (exit 0) — **646 suites / 19541 passed, 1 skipped, 19542 total**, 34.7 s |
| secret scan | clean |
| doctrine scan | clean |
| Migration apply | n/a — no `supabase/migrations/**` files touched (section not triggered) |

### Test-count reconciliation

- Implementer's note (in `current-status.md`) reported "19540 passing of 19541, 1
  pre-existing flaky perf-timing assertion in `moveMetadataLedger.test.ts`."
- **Reviewer's fresh-worktree run was a clean sweep**: all 19541 non-skipped tests
  passed, including `moveMetadataLedger.test.ts` — the warned flake did not
  manifest. Re-run of `adminArguments` + `moveMetadataLedger` in isolation: 6
  suites / 158 tests, exit 0. The 1 skipped test is pre-existing and unchanged.
- No real failure observed at any point; no isolation workaround was needed.

## Design conformance (issue #503 acceptance criteria)

- [x] **(1)** Fix pins the author FK: `profiles!arguments_author_id_fkey(display_name)`
  in `loadAdminArguments`'s `.select(...)`. JSON key stays `profiles`;
  `asDisplayName(r.profiles)` (line 147) and `RawArgumentRow.profiles` (line 57)
  unchanged. **Confirmed.**
- [x] **(2)** Constraint name `arguments_author_id_fkey` is correct. Initial schema
  (`20260516000001_initial_schema.sql:185`) declares `author_id uuid NOT NULL
  REFERENCES public.profiles(id)` as an **inline FK with no explicit `CONSTRAINT`
  name**, so PostgreSQL auto-names it `<table>_<col>_fkey` =
  `arguments_author_id_fkey`. The second FK (`inactive_by`, from
  `20260604000001_admin_args_inactive_001_argument_inactive_state.sql:31`,
  inline, auto-named `arguments_inactive_by_fkey`) is the genuine source of the
  ambiguity. **Confirmed.**
- [x] **(3)** New regression test (`adminArguments.test.ts:85-98`) is a true
  negative control — **empirically verified against git**:
  - pre-fix source contains `profiles(display_name)` exactly once →
    `not.toContain('profiles(display_name)')` **FAILS** pre-fix;
  - post-fix source has 0 occurrences of the bare form and 1 occurrence of
    `profiles!arguments_author_id_fkey(display_name)` → both assertions **PASS**
    post-fix.
  It forbids the bare embed AND requires the FK-pinned embed. It also asserts
  `not.toContain('profiles!arguments_inactive_by_fkey')` — the inactivator FK is
  **never** embedded (doctrine §10a, no who-inactivated leak). **Confirmed.**
- [x] **(4)** The tightened pre-existing guard test (`adminArguments.test.ts:72-79`)
  is a **CORRECTION, not a relaxation**. On `origin/main` it asserted
  `expect(src).toContain('profiles(display_name)')` — i.e. it actively *locked in
  the buggy bare embed* and would have blocked the fix. The change replaces that
  with the strictly-more-specific `toContain('profiles!arguments_author_id_fkey(display_name)')`.
  Strengthening, not weakening. **Confirmed.**
- [x] **(5)** Repo-wide sweep — no other ambiguous `arguments↔profiles` embed
  anywhere:
  - Only bare `profiles(` hit in production code is the fix's own explanatory
    comment.
  - The two `profiles!` pinned embeds in the repo are this fix plus the
    pre-existing `adminMetadataEventsApi.ts` idiom it mirrors.
  - `admin-users` Edge fn queries `arguments` and `profiles` in **separate**
    scalar-only queries (no embed) — verified.
  - `submit-argument` and `classifyArgumentCore.ts` have **no** `profiles` embed.
  - `argumentsApi.ts` / `argumentRoomLinksApi.ts` select scalar-only from
    `arguments`; no profiles embed.
  - No `debates↔profiles` change (the diff touches only `adminArgumentsApi.ts`).
  **Confirmed.**
- [x] **(6)** No migration, no Edge change, no `inactive_reason` exposure added,
  no secret, no new dependency. File footprint is exactly 3 files
  (`adminArgumentsApi.ts`, `adminArguments.test.ts`, `current-status.md`);
  `package.json`/`package-lock.json`/`supabase/**` untouched. The
  `inactive_reason` column *selection* in the loader is pre-existing from #480
  and unchanged by this card. **Confirmed.**

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — diff scan clean.
- [x] Score never blocks posting — N/A (read path only; no score/validation
      change).
- [x] No service-role in client code — loader uses the shared anon client
      (`from '../../lib/supabase'`); `not.toMatch(/createClient\(/)` guard still
      green. The lone `SERVICE_ROLE`/`createClient`/`.insert` grep hit is *doc
      prose inside an unrelated prior card's `current-status.md` HTML comment*,
      not code.
- [x] No direct insert into `public.arguments` — read path only.
- [x] No AI calls in production app paths — none.
- [x] Plain language only — no raw internal codes added to UI strings.
- [x] Epic-specific doctrine — **supabase-edge-contract**: no service-role in
      client (✓), RLS-friendly read via `is_moderator_or_admin()` SELECT (no
      `.rpc()` bypass, guard green), append-only migration discipline N/A (no
      migration). **doctrine §10a**: the inactivator's profile is deliberately
      NOT embedded — the regression test forbids
      `profiles!arguments_inactive_by_fkey`, so "who inactivated a row" never
      leaks via this loader.

## Test coverage

- [x] Public function `loadAdminArguments` retains its existing source-contract
      tests; the embed contract is now pinned by two assertions (corrected guard
      + new negative-control regression).
- [x] Negative control proven (fails pre-fix, passes post-fix) — empirically
      verified against `git show origin/main` vs `HEAD`.
- [x] §10a no-leak assertion present (`not.toContain('profiles!arguments_inactive_by_fkey')`).
- [x] No accessibility assertion needed — this card touches the data layer only,
      no UI component changed.
- Net test delta: +1 test (the new regression `it(...)`), folded into the
  existing `adminArguments` suite; suite/test counts otherwise stable.

## Blockers

None.

## Suggestions (non-blocking)

1. (Future hardening, defer) A repo-wide guard test that scans all
   `.from('arguments')` selects for a bare `profiles(` embed would catch this
   class of regression generically rather than per-loader. Not needed for this
   hotfix — the targeted regression test is sufficient and the sweep confirmed
   `adminArgumentsApi.ts` was the only call site.

## Operator next steps

- Push the branch: `git push -u origin feat/ops-admin-args-profiles-embed-001`
- Open PR: `gh pr create --title "OPS-ADMIN-ARGS-PROFILES-EMBED-001: pin author FK in Admin Arguments profiles embed (fixes #503)" --body-file docs/reviews/OPS-ADMIN-ARGS-PROFILES-EMBED-001.md`
- **Deploy steps:** none for Claude. This is a **client-side read-path change
  only** — no migration, no Edge Function. The fix ships with the app bundle;
  there is no `supabase db push` / `functions deploy` to run. (Merge to `main`
  is safe to squash-merge once green per governance §5 — it touches no
  `supabase/functions/**` or `supabase/migrations/**`.)
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge
  worktree cleanup (operator step)").
