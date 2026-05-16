# CDiscourse — Current Status

_Last updated: 2026-05-16_

## Current Stage

**Stage 6.0.1 complete.** Conversation Move Navigator implemented: pure TS move model (`conversationMoves.ts`), `ConversationMoveNavigator.tsx` component wired into `ArgumentComposer.tsx`, 62 new tests (505 total, all passing). Language-processing scaffold (Stage 6.0) also complete — server-only Anthropic + mock providers, disabled by default.

## What Works

- Session contracts: `AppSessionSnapshot`, `DebateViewport`, `ComposerDraftSession`, `PendingSubmission` (`src/features/session/types.ts`)
- Session reducer: pure state machine, tests pass (`src/features/session/sessionState.ts`)
- Session storage: AsyncStorage read/write with corrupt-data recovery (`src/features/session/sessionStorage.ts`)
- Storage key namespacing by userId (`src/features/session/sessionKeys.ts`)
- Constitution v1 fully defined (`src/domain/constitution/constitution.v1.ts`)
- Rules engine (`src/domain/constitution/engine.ts`) — pure TS, side-effect free
- Transition matrix and allowed-transitions helpers (`src/domain/constitution/allowedTransitions.ts`)
- Discourse rails C-RAIL-001–005 (`src/domain/constitution/railsChecks.ts`)
- Topic satisfaction check (`src/domain/constitution/topicSatisfaction.ts`)
- DB adapter layer (`src/domain/constitution/dbAdapters.ts`)
- `evaluateArgumentDraft` end-to-end evaluation function (`src/domain/constitution/evaluateArgumentDraft.ts`)
- `submit-argument` Supabase Edge Function (`supabase/functions/submit-argument/index.ts`)
- Shared Edge Function helpers (`supabase/functions/_shared/`)
- Database migrations 0001–0005 (schema, RLS, seed, rails+edge, session+scalability)
- RLS policies on all tables (migration `20260516000002_rls_policies.sql`)
- Supabase client initialization (`src/lib/supabase.ts`)
- Edge Function client wrapper (`src/lib/edgeFunctions.ts`)
- Auth: `AuthScreen`, `useAuthSession` (`src/features/auth/`)
- Debates: `DebateListScreen`, `CreateDebateForm`, `JoinDebatePanel`, `DebateDetailHeader`, `useDebates`, `useCurrentDebate`, `debatesApi`, `debateUserStateApi` (`src/features/debates/`)
- Argument viewport: normalized cache, viewport reducer, tree builder, composer handoff (`src/features/arguments/`)
  - `argumentCache.ts` — `mergeArguments`, `mergeRelations`, `markLoaded`, `isParentLoaded`, `getKnownChildCount`
  - `buildArgumentTree.ts` — `computeVisibleArgumentIds`, `computeFocusedPath`, `MAX_DISPLAY_DEPTH = 6`
  - `argumentViewport.ts` — `viewportReducer`, `buildInitialViewport`, `toSessionViewport`; actions: `ROOTS_LOADED`, `CHILDREN_LOADED`, `FOCUS_LOADED`, `EXPAND`, `COLLAPSE`, `FOCUS`, `UNFOCUS`, `SELECT_PARENT`, `CLEAR_PARENT`, `REFRESH_COMPLETE`
  - `useArgumentViewport.ts` — debounced session sync, inflight guard, expand/collapse/focus/unfocus/refresh
  - `composerHandoff.ts` — `selectReplyTarget`, `clearReplyTarget`, `getAllowedReplyTypesForParent`, `getVisibleArgumentIds`, `getArgumentRelationsForDisplay`, `getParentArgumentForComposer`
  - `ArgumentTreeScreen`, `ArgumentNode`, `ArgumentPathBar`, `ArgumentNodeSummary`, `FlagSummary`, `TopicSatisfactionBadge`
- `ArgumentRow` fully matches `public.arguments` schema: includes `targetExcerpt`, `disagreementAxis`, `railPayload`, `clientValidation`, `serverValidation`, `clientSubmissionId`
- Composer state layer (Stage 5.5.1): `composerState.ts`, `composerHelpers.ts`, `useArgumentComposer`, `ComposerDraftRecoveryNotice`
- Composer UI (Stage 5.5.2):
  - `useConstitution.ts` — Supabase fetch with local v1 fallback; never blocks the composer
  - `composerValidation.ts` — `buildEvaluationInput` pure mapper (draft + debate + parent + constitution → evaluation input | null)
  - `ArgumentComposer.tsx` — type picker, side picker, body input (2000-char), target excerpt, disagreement axis selector for rebuttal/counter_rebuttal, tag pickers (general + axis layer), evidence fields (url/label/source text), live `evaluateArgumentDraft` preview
  - `ComposerTargetPanel.tsx` — root-mode copy, reply mode with parent excerpt + target excerpt field + type-specific guidance (concession/clarification/rebuttal)
  - `ComposerValidationPanel.tsx` — blocking errors, warnings, extended topic scores (resolution/parent/combined), matched/missing terms, constitution source chip
  - Reply target wired: `ArgumentTreeScreen.onReply(id, argument)` → `App.tsx` `replyTarget` state → `ArgumentComposer` props
- Argument submission (Stage 5.5.3):
  - `composerSubmit.ts` — pure helpers: `createSubmissionFingerprint`, `shouldReuseClientSubmissionIdForRetry`, `getOrCreateClientSubmissionId`, `buildSubmitArgumentPayload`, `extractServerValidationError`, `isIdempotentSuccess`
  - `ArgumentComposer.tsx` — live submit button enabled when client validation passes and Supabase configured; dispatches `SUBMISSION_QUEUED → SUBMISSION_STARTED → SUBMISSION_SUCCEEDED/FAILED`; shows server blocking errors on 422; reuses `clientSubmissionId` on retry when payload unchanged; clears draft and switches to debate tab on success
  - `PendingSubmission.submissionFingerprint` — optional field stores draft fingerprint at queue time for idempotency comparison
  - `App.tsx` `handleSubmitSuccess` — clears `replyTarget`, switches to debate tab on successful submit
- App shell: `App.tsx` with tab navigation, auto-switches to debate room on selection
- Stage 6.0 — Language-processing scaffold: `supabase/functions/process-language-draft/`, `src/features/languageProcessing/`, `src/lib/edgeFunctions.ts` (`processLanguageDraft`). Disabled by default (`AI_LANGUAGE_PROCESSING_ENABLED=false`). Docs: `docs/transcript-language-processing.md`, `docs/semantic-review.md`, `docs/ai-provider-decision.md`.
- Stage 6.0.1 — Conversation Move Navigator: `src/features/arguments/conversationMoves.ts` (pure TS move model), `src/features/arguments/ConversationMoveNavigator.tsx` (chip UI, axis sub-picker, warnings), wired into `ArgumentComposer.tsx`. Skill: `.claude/skills/transcript-lang-min/SKILL.md`. Docs: `docs/conversation-move-navigation.md`.
- Jest test suite: 505 tests pass across 14 suites
- TypeScript strict mode — `npm run typecheck` passes (0 errors)
- ESLint — `npm run lint` passes (0 warnings)

## What Is Stubbed

- `src/features/moderation/` — feature slice directory exists, no screens
- Navigation stack: manual tab switching via `useState` in `App.tsx` (no Expo Router)
- Viewport refresh after submit — tab switches to debate view but argument tree does not auto-refresh to show the new argument
- Full manual smoke test (Sections B–J of `docs/browser-visual-test.md`) — blocked by no `.env` / no deployed Supabase

## What Is Blocked

- **Docker/Supabase local not validated** — Docker Desktop unavailable. Migrations exist (0001–0005) but have never been applied. See `docs/known-blockers.md`.
- **No linked remote Supabase project** — `npx supabase link` has not been run.
- **Edge Function not deployed** — `submit-argument` exists locally but has not been deployed or tested against a live database.

## Last Verification Commands and Results

Run on 2026-05-16:

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ Pass (0 errors) |
| `npm run lint` | ✅ Pass (0 warnings) |
| `npm run test` | ✅ Pass (505 tests, 14 suites) |
| `npm run web -- --clear` | ✅ Bundled 352 modules — http://localhost:8081 |
| `npx supabase start` | ❌ Blocked — Docker not running |
| `npx supabase db status` | ❌ Blocked — Docker not running |

## Docker/Supabase Local Status

**Not validated.** Docker Desktop was not available. Migrations 0001–0005 are written and syntactically valid but have not been applied. When Docker is available:

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

Policies defined in `supabase/migrations/20260516000002_rls_policies.sql` and updated in `20260516000004_stage4_rails_and_edge.sql`. Not applied to any live database (Docker blocked). All tables designed with `ENABLE ROW LEVEL SECURITY`.

## Next Recommended Stage

**Stage 6.0.2** — Move qualifiers (25 codes), quote anchoring (`QuoteAnchor`), and turn-status governance (`TurnResponseStatus`, `UserResponseMark`). No DB migration, no Anthropic, `UserResponseMark` is local-only. See `docs/next-prompts.md` for the full prompt.

After Stage 6.0.2: **MVP backend validation** — configure `.env`, link Supabase, push migrations, deploy `submit-argument`, complete manual smoke test.
