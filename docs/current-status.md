# CDiscourse — Current Status

_Last updated: 2026-05-16 (Stage 5.5.6)_

## Current Stage

**Stage 6.0.3 complete.** Argument-first UX simplification: removed Compose tab from top-level nav, composer now opens inline within the Arguments tab. Nav is now `Arguments | Account | Debug`. Two Claude Code skills created (`argument-fixture-author`, `argument-counter-runner`). Four fixture scenarios in `fixtures/argument-scenarios/`. 594 tests, 17 suites — typecheck clean, lint clean.

Stage 5.5.6.1 (RLS hotfix), Stage 5.5.6 (account feature), Stage 6.0 (language-processing scaffold), and Stage 6.0.1 (conversation move navigator) also committed.

## What Works

### Infrastructure (live)
- Supabase project `qsciikhztvzzohssddrq` linked and accessible
- All 5 migrations applied to hosted project (`db push --dry-run` reports "up to date")
- `submit-argument` Edge Function ACTIVE (version 1) on hosted project
- `.env` configured with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `.env` gitignored; no secrets in tracked files (checkpoint secret scan: clean)
- ANTHROPIC_API_KEY set as Supabase secret (needs rotation — exposed in chat session)

### Core (local, tested)
- Session contracts: `AppSessionSnapshot`, `DebateViewport`, `ComposerDraftSession`, `PendingSubmission`
- Session reducer: pure state machine, tests pass
- Session storage: AsyncStorage read/write with corrupt-data recovery
- Constitution v1 fully defined; rules engine pure TS, side-effect free
- Discourse rails C-RAIL-001–005; topic satisfaction check
- DB adapter layer; `evaluateArgumentDraft` end-to-end evaluation
- `submit-argument` Edge Function (JWT-protected, deterministic Constitution re-validation server-side)
- Database migrations 0001–0005 (schema, RLS, seed, rails+edge, session+scalability)
- RLS policies on all tables
- Auth: `AuthScreen`, `useAuthSession`
- Debates: `DebateListScreen`, `CreateDebateForm`, `JoinDebatePanel`, `DebateDetailHeader`, `useDebates`, `useCurrentDebate`
- Argument viewport: normalized cache, viewport reducer, tree builder, composer handoff
- `ArgumentTreeScreen` — now accepts `refreshRef` prop; registered by `App.tsx` for post-submit refresh
- Argument submission (Stage 5.5.3): idempotent via `client_submission_id`, server 422 shown, draft preserved on failure
- **Stage 5.5.5: Post-submit refresh** — `App.tsx` calls `refreshTreeRef.current?.()` in `handleSubmitSuccess`; tree re-fetches after success
- **Stage 5.5.6: Account/profile feature** — `src/features/account/` (types, API, hook, screen, index). `AccountScreen` shows email, masked user ID, role label, editable display name. `buildProfileUpdatePayload` never includes role/id/email. `docs/account-operations.md` + `docs/supabase-admin-ops.md` created.
- **Stage 5.5.6.1: RLS hotfix** — migration 0006 fixes debates/debate_participants infinite recursion with three SECURITY DEFINER helpers.
- **Stage 6.0.3: Argument-first UX + fixture skills** — top-level Compose tab removed, inline composer in Arguments tab. Two Claude Code skills. Four fixture scenarios. `src/features/arguments/roomNavigation.ts` for pure nav helpers. `src/features/devFixtures/` for fixture types and validation.
- Stage 6.0 — Language-processing scaffold: disabled-by-default, server-only. `process-language-draft` Edge Function, Anthropic + mock providers
- Stage 6.0.1 — Conversation Move Navigator: pure TS move model, chip UI + axis sub-picker, wired into `ArgumentComposer`
- Jest test suite: **526 tests**, 15 suites, all passing
- TypeScript strict mode clean (0 errors)
- ESLint clean (0 warnings)

## What Is Stubbed

- `src/features/moderation/` — feature slice directory exists, no screens
- Navigation stack: manual tab switching via `useState` in `App.tsx` (no Expo Router)
- Full manual smoke test — infrastructure is live but browser walkthrough not yet completed
- Account screen: no profile editing for moderator/admin escalation (by design — backend-only)

## What Is Blocked / Pending

- **ANTHROPIC_API_KEY rotation required** — key was exposed in a previous chat session. See `docs/known-blockers.md`.
- **Live manual smoke test pending** — hosted backend is configured; full A–I walkthrough in browser not yet completed. See `docs/browser-visual-test.md`.
- **Docker/Supabase local** — local Supabase never validated (Docker Desktop unavailable). Migrations are applied to hosted project.

## Last Verification Commands

Run on 2026-05-16:

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ Pass (0 errors) |
| `npm run lint` | ✅ Pass (0 warnings) |
| `npm run test` | ✅ Pass (594 tests, 17 suites) |
| `npx supabase projects list` | ✅ `qsciikhztvzzohssddrq` LINKED |
| `npx supabase db push --dry-run` | ✅ Remote database is up to date |
| `npx supabase functions list` | ✅ submit-argument ACTIVE |

## Hosted Backend Status

| Item | Status |
|---|---|
| Project ref | `qsciikhztvzzohssddrq` |
| Project linked | ✅ Yes |
| Migrations applied | ✅ Yes (0001–0006) |
| `submit-argument` deployed | ✅ Yes (ACTIVE v1) |
| `.env` configured | ✅ Yes |
| ANTHROPIC_API_KEY set | ✅ Set (⚠️ rotation needed) |
| RLS recursion on debates | ✅ Fixed (migration 0006) |
| Live auth tested | 🔲 Pending (browser test) |
| Live debate create/join tested | 🔲 Pending |
| Live argument submit tested | 🔲 Pending |
| Server 422 tested | 🔲 Pending |
| Idempotency tested live | 🔲 Pending |
| Post-submit tree refresh | ✅ Implemented (Stage 5.5.5) |

## Next Recommended Stage

**Live manual smoke test (Stage 6.0.3.1).** Run `npm run web -- --clear` and walk through `docs/browser-visual-test.md` sections A–K. Confirm:
- Arguments tab shows debate list / argument room (no Compose tab visible)
- Room shows "Start an argument" button at bottom
- Tapping "Start an argument" opens inline composer ("Your Move" header)
- Tapping "Reply" on an argument opens inline composer with parent context
- Discard closes the inline composer and returns to the tree
- Submit success closes composer and refreshes tree

After smoke test: Stage 6.0.2 (move qualifiers, quote anchoring, turn-status governance), or run a fixture counter-test with `/argument-counter-runner sports-play-in`. Full prompts in `docs/next-prompts.md`.
