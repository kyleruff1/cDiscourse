# CDiscourse — Current Status

_Last updated: 2026-05-16 (Stage 6.1.0)_

## Current Stage

**Stage 6.1.0 complete.** Gamified argument-room UX refactor: game resting status model, claim standing model, DAW-style timeline/track view, invite UX foundation, upfront counterclaim support, bot navigation map, and gamified copy system. No DB migrations. No Anthropic calls. 700 tests, 23 suites — typecheck clean, lint clean.

Stages 6.0.3 (inline composer), 5.5.6.1 (RLS hotfix), 5.5.6 (account), 5.5.5 (post-submit refresh), and earlier all committed.

## What Works

### Infrastructure (live)
- Supabase project `qsciikhztvzzohssddrq` linked and accessible
- All 6 migrations applied to hosted project (0001–0006)
- `submit-argument` Edge Function ACTIVE (version 1)
- `.env` configured with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `.env` gitignored; no secrets in tracked files (checkpoint secret scan: clean)
- ANTHROPIC_API_KEY set as Supabase secret (reportedly rotated — not called in this stage)

### Core (local, tested)
- Session contracts, reducer, storage — all passing
- Constitution v1 fully defined; rules engine pure TS, side-effect free
- Discourse rails C-RAIL-001–005; topic satisfaction check
- DB adapter layer; `evaluateArgumentDraft` end-to-end evaluation
- `submit-argument` Edge Function (JWT-protected, deterministic re-validation server-side)
- Database migrations 0001–0006 (schema, RLS, seed, rails+edge, session+scalability, RLS fix)
- RLS policies on all tables (migration 0006 fixes debates/debate_participants recursion)
- Auth: `AuthScreen`, `useAuthSession`
- Debates: `DebateListScreen`, `CreateDebateForm`, `JoinDebatePanel`, `DebateDetailHeader`, `useDebates`, `useCurrentDebate`
- Argument viewport: normalized cache, viewport reducer, tree builder, composer handoff
- `ArgumentTreeScreen` — supports `viewMode: 'tree' | 'timeline'` (Stage 6.1.0)
- Argument submission: idempotent via `client_submission_id`, server 422 shown, draft preserved on failure
- Post-submit refresh via `refreshTreeRef`
- Account/profile feature: `AccountScreen`, editable display name
- **Stage 6.0.1: ConversationMoveNavigator** — pure TS move model, 7 move kinds, challenge axis sub-picker
- **Stage 6.0.3: Argument-first UX** — inline composer ("Your Move"), no top-level Compose tab, Arguments | Account | Debug nav
- **Stage 6.1.0: Gamified UX**:
  - `gameStatus.ts` — 19 GameRestingStatus values, pure derivation, forbidden copy rules enforced
  - `claimStanding.ts` — 13 ClaimStanding values, allowed next moves per standing
  - `argumentTimeline.ts` — DAW-style track model (core/counter/receipts/clarification/concession/tangent)
  - `ArgumentTimelineScreen.tsx` — track view, toggles from ArgumentTreeScreen
  - `ArgumentTrack.tsx` + `ArgumentTimelineNode.tsx` — lane/card components
  - `gameCopy.ts` — pure copy strings, no forbidden labels, self-directed concessions
  - `counterClaim.ts` — pure model for optional upfront counterclaim
  - `inviteTypes.ts` + `inviteCopy.ts` + `InvitePanel.tsx` — invite foundation (UI only, no backend)
  - App.tsx updated: Thread/Tracks toggle, Invite chip, room toolbar
  - `docs/bot-navigation-map.md` — stable accessibilityLabel anchors for bot skills
- Claude Code skills: `argument-fixture-author`, `argument-counter-runner` (updated for gamified UX)
- Fixture scenarios: 4 scenarios with `expectedRestingStatus`, `expectedClaimStanding`, `expectedFinalRestingStatus`
- Jest test suite: **700 tests**, 23 suites, all passing
- TypeScript strict mode clean (0 errors)
- ESLint clean (0 warnings)

## What Is Stubbed

- `src/features/moderation/` — feature slice directory exists, no screens
- Navigation: manual tab switching via `useState` in `App.tsx` (no Expo Router)
- Live manual smoke test — infrastructure is live but browser walkthrough not yet completed for Stage 6.1.0
- Invite backend — InvitePanel is UI-only; no Supabase migration for invites (Stage 6.1.3+)
- Counterclaim — model-only; not yet wired into CreateDebateForm
- Resting status badge — model exists; not yet displayed in UI per argument node
- Claim standing display — model exists; not yet displayed in UI

## What Is Blocked / Pending

- **Live manual smoke test (Stage 6.1.1)** — run `npm run web -- --clear`, walk `docs/browser-visual-test.md`
- **Docker/Supabase local** — local Supabase never validated (Docker Desktop unavailable)
- **ANTHROPIC_API_KEY rotation** — reportedly done; verify via Supabase dashboard before enabling AI stage

## Last Verification Commands

Run on 2026-05-16:

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ Pass (0 errors) |
| `npm run lint` | ✅ Pass (0 warnings) |
| `npm run test` | ✅ Pass (700 tests, 23 suites) |
| `npm run checkpoint` | ✅ Stage 6.1.0 complete |

## Hosted Backend Status

| Item | Status |
|---|---|
| Project ref | `qsciikhztvzzohssddrq` |
| Project linked | ✅ Yes |
| Migrations applied | ✅ Yes (0001–0006) |
| `submit-argument` deployed | ✅ Yes (ACTIVE v1) |
| `.env` configured | ✅ Yes |
| ANTHROPIC_API_KEY set | ✅ Set (reportedly rotated — not called in this stage) |
| RLS recursion | ✅ Fixed (migration 0006) |
| Live auth tested | 🔲 Pending (browser test) |
| Live debate create/join tested | 🔲 Pending |
| Live argument submit tested | 🔲 Pending |

## Next Recommended Stage

**Stage 6.1.1 — Live browser smoke test** of the gamified argument-room UX. Run:
```
npm run web -- --clear
```

Walk `docs/browser-visual-test.md` sections A–K. Verify:
- Arguments tab shows Thread / Tracks toggle in room toolbar
- Tracks view shows Core / Counters / Receipts / Concessions / Tangents lanes
- Invite chip opens InvitePanel inline
- "Start an argument" button opens inline composer ("Your Move")
- Reply opens inline composer with parent context
- Discard closes composer and returns to room

After smoke test: Stage 6.1.2 (fixture runner with normal client auth) or Stage 6.1.3 (invite backend migration).
