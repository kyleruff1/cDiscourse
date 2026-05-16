# CDiscourse — Current Status

_Last updated: 2026-05-16 (Stage 5 Recovery Gate)_

## Current Stage

**Stage 5 Recovery Gate complete.** Backend is live. Stage 5.5.5 (post-submit refresh) implemented and committed. Local baseline green: 506 tests, typecheck clean, lint clean.

Stage 6.0 and 6.0.1 are also committed (language-processing scaffold + conversation move navigator).

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
- Stage 6.0 — Language-processing scaffold: disabled-by-default, server-only. `process-language-draft` Edge Function, Anthropic + mock providers
- Stage 6.0.1 — Conversation Move Navigator: pure TS move model, chip UI + axis sub-picker, wired into `ArgumentComposer`
- Jest test suite: **506 tests**, 14 suites, all passing
- TypeScript strict mode clean (0 errors)
- ESLint clean (0 warnings)

## What Is Stubbed

- `src/features/moderation/` — feature slice directory exists, no screens
- Navigation stack: manual tab switching via `useState` in `App.tsx` (no Expo Router)
- Full manual smoke test — infrastructure is live but browser walkthrough not yet completed

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
| `npm run test` | ✅ Pass (506 tests, 14 suites) |
| `npx supabase projects list` | ✅ `qsciikhztvzzohssddrq` LINKED |
| `npx supabase db push --dry-run` | ✅ Remote database is up to date |
| `npx supabase functions list` | ✅ submit-argument ACTIVE |

## Hosted Backend Status

| Item | Status |
|---|---|
| Project ref | `qsciikhztvzzohssddrq` |
| Project linked | ✅ Yes |
| Migrations applied | ✅ Yes (0001–0005) |
| `submit-argument` deployed | ✅ Yes (ACTIVE v1) |
| `.env` configured | ✅ Yes |
| ANTHROPIC_API_KEY set | ✅ Set (⚠️ rotation needed) |
| Live auth tested | 🔲 Pending (browser test) |
| Live debate create/join tested | 🔲 Pending |
| Live argument submit tested | 🔲 Pending |
| Server 422 tested | 🔲 Pending |
| Idempotency tested live | 🔲 Pending |
| Post-submit tree refresh | ✅ Implemented (Stage 5.5.5) |

## Next Recommended Stage

**Live manual smoke test.** Run `npm run web -- --clear` and walk through `docs/browser-visual-test.md`. This is the only remaining gate before Stage 6 continuation is fully safe.

After smoke test: Stage 5.5.6 (any polish found during smoke test), then Stage 6.0.2 (move qualifiers, quote anchoring, turn-status governance). Full prompt in `docs/next-prompts.md`.
