# CDiscourse — Current Status

_Last updated: 2026-05-16_

## Current Stage

**Stage 5.1 complete.** Stage 5.2 (Home screen + Debate Room) is next.

## What Works

- Session contracts: `AppSessionSnapshot`, `DebateViewport`, `ComposerDraftSession`, `PendingSubmission` (`src/features/session/types.ts`)
- Session reducer: pure state machine, 48 tests pass (`src/features/session/sessionState.ts`)
- Session storage: AsyncStorage read/write with corrupt-data recovery (`src/features/session/sessionStorage.ts`)
- Storage key namespacing by userId (`src/features/session/sessionKeys.ts`)
- Migration 0005: `debate_user_state` table, `client_submission_id` on `arguments`, scalability indexes, RLS
- Idempotent `submit-argument`: returns existing argument on retry with same `client_submission_id`
- Constitution v1 fully defined (`src/domain/constitution/constitution.v1.ts`)
- Rules engine (`src/domain/constitution/engine.ts`) — pure TS, side-effect free
- Transition matrix and allowed-transitions helpers (`src/domain/constitution/allowedTransitions.ts`)
- Discourse rails C-RAIL-001–005 (`src/domain/constitution/railsChecks.ts`)
- Topic satisfaction check (`src/domain/constitution/topicSatisfaction.ts`)
- DB adapter layer (`src/domain/constitution/dbAdapters.ts`)
- `evaluateArgumentDraft` end-to-end evaluation function (`src/domain/constitution/evaluateArgumentDraft.ts`)
- `submit-argument` Supabase Edge Function (`supabase/functions/submit-argument/index.ts`)
- Shared Edge Function helpers (`supabase/functions/_shared/`)
- Database migrations 0001–0004 (schema, RLS, seed, rails+edge)
- RLS policies on all tables (migration `20260516000002_rls_policies.sql`)
- Supabase client initialization (`src/lib/supabase.ts`)
- Edge Function client wrapper (`src/lib/edgeFunctions.ts`)
- Jest test suite passing (`__tests__/`)
- TypeScript strict mode — `npm run typecheck` passes
- ESLint — `npm run lint` passes

## What Is Stubbed

- `src/features/arguments/` — feature slice directory exists, no UI components
- `src/features/auth/` — feature slice directory exists, no screens
- `src/features/debates/` — feature slice directory exists, no screens
- `src/features/moderation/` — feature slice directory exists, no screens
- `src/components/` — directory exists, no components
- Navigation stack not wired (Expo Router not yet installed)
- Auth screens not built
- Debate Room screen not built
- Argument Submission drawer not built

## What Is Blocked

- **Docker/Supabase local not validated** — Docker Desktop was not available when Stage 4 completed. Migrations exist but have never been applied. See `docs/known-blockers.md`.
- **No linked remote Supabase project** — `npx supabase link` has not been run.
- **Edge Function not deployed** — `submit-argument` exists locally but has not been deployed or tested against a live database.

## Last Verification Commands and Results

Run on 2026-05-16:

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ Pass (0 errors) |
| `npm run lint` | ✅ Pass (0 warnings) |
| `npm run test` | ✅ Pass (190 tests, 5 suites) |
| `npm run checkpoint` | ✅ Pass |
| `npx supabase start` | ❌ Blocked — Docker not running |
| `npx supabase db status` | ❌ Blocked — Docker not running |

## Docker/Supabase Local Status

**Not validated.** Docker Desktop was not available when Stage 4 was completed. Migrations 0001–0004 are written and syntactically valid but have not been applied to a local instance. When Docker is available:

```bash
npx supabase start
npx supabase db reset
npx supabase db status
npx supabase db lint
```

## Edge Function Status

`submit-argument` is implemented locally at `supabase/functions/submit-argument/index.ts`. Not deployed. Requires a linked remote project first:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy submit-argument
```

## RLS Status

Policies defined in `supabase/migrations/20260516000002_rls_policies.sql`. Not applied to any live database (Docker blocked). All tables designed with `ENABLE ROW LEVEL SECURITY`. Service role bypasses RLS — Edge Functions use this by design.

## Next Recommended Stage

**Stage 5.1 — Navigation + Auth Screens.** See `docs/next-prompts.md` for the exact prompt.
