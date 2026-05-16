# CDiscourse — Next Prompts

The next recommended session prompts, in order. Run `npm run checkpoint` first to confirm the current stage.

---

## Prompt 1 — Stage 6.1.1 Visual Smoke Test (gamified UX)

> Stage 6.1.0 is complete. Run the browser smoke test for the gamified argument-room UX.
>
> Run:
> ```bash
> npm run web -- --clear
> ```
>
> Walk through `docs/browser-visual-test.md` sections A–K. Key checks for Stage 6.1.0:
> - Arguments tab shows Thread / Tracks toggle in room toolbar (not "Compose" tab)
> - Tracks view shows: Core, Counters, Receipts, Clarifications, Concessions, Tangents lanes
> - "Invite" chip in toolbar opens InvitePanel inline with backend-coming-soon notice
> - "Start an argument" button opens inline composer ("Your Move" header)
> - Reply opens inline composer with parent context
> - Discard returns to room view
> - No top-level Compose tab visible
> - "Argument Room" label visible in toolbar
>
> Update `docs/live-smoke-debug-log.md` with results. When A–K pass, proceed to Prompt 2.

---

## Prompt 2 — Stage 6.1.2: Dev Fixture Runner

> Stage 6.1.1 smoke test complete. Run the argument-counter-runner skill against a fixture scenario:
>
> `/argument-counter-runner sports-play-in`
>
> This walks all 7 moves through the live browser, checks resting status badges, counter-tests invalid submissions, and creates a run log in `docs/testing-runs/`.
>
> No secrets in the log. Use test aliases only. Verify idempotency, 422 handling, and post-submit refresh.

---

## Prompt 3 — Stage 6.1.3: Invite Backend Migration

> After smoke test and fixture runner pass. Wire the invite backend if desired:
>
> - Create Supabase migration for `argument_room_invites` table (see `docs/invite-flow.md` for schema)
> - Add RLS policies: inviter can insert/select; invitee can select own invites
> - Update InvitePanel to attempt real invite creation when backend is ready
> - Do NOT send emails yet (send email stage is separate)
> - Do NOT expose user search broadly

---

## Prompt 4 — Stage 6.1.4: Persistent Response Marks / Resting Status

> Wire `GameRestingStatus` and `ClaimStanding` into the UI per argument node:
>
> - Show resting status badge on `ArgumentNode` (uses `badge-resting-status` label)
> - Show claim standing on focused argument detail
> - Persist user response marks via a new junction table (future stage)
> - Add "Branch this off" button when `isBranchRecommended === true`
>
> Models already exist in `gameStatus.ts` and `claimStanding.ts`. This stage wires them to the argument viewport data.

---

## Prompt 5 — Stage 6.2.0: Transcript Language Processing Hardening

> Harden the transcript/draft language-processing types and schemas:
>
> - `docs/transcript-language-processing.md` already exists
> - Harden types in `src/features/languageProcessing/` (if present)
> - Mock provider for offline testing
> - No Anthropic calls yet

---

## Prompt 6 — Stage 6.2.1: Anthropic Provider (Disabled by Default)

> Only after: smoke test complete, ANTHROPIC_API_KEY rotation confirmed.
>
> Wire Anthropic provider for the `process-language-draft` Edge Function:
> - Disabled by default (feature flag in Edge Function env)
> - User must explicitly enable via Supabase secret
> - Never in the critical path — AI suggestions never gatekeep submission

---

## Notes

Stage 6.1.0 complete as of 2026-05-16.
Infrastructure live: project `qsciikhztvzzohssddrq`, migrations applied (0001–0006), `submit-argument` ACTIVE.
700 tests pass. TypeScript strict mode clean. ESLint clean.

**Safe to run visual smoke test: YES — `npm run web -- --clear`**
**Safe to run fixture counter-test: YES — `/argument-counter-runner sports-play-in`**
**AI (Anthropic) not called in Stage 6.1.0: confirmed.**

See `docs/current-status.md` for full status.
See `docs/bot-navigation-map.md` for test hook labels.
See `docs/gamified-argument-product-skin.md` for product language guide.
