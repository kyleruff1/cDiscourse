# CDiscourse — Next Prompts

The next recommended session prompts, in order. Run `npm run checkpoint` first to confirm the current stage.

---

## Prompt 0 — Deploy & bootstrap (must run before Prompt 1)

> Deploy the admin function and bootstrap admin access. This is a one-time step.
>
> 1. Deploy the admin-users Edge Function:
>    ```
>    npx supabase functions deploy admin-users
>    ```
> 2. Open Supabase Dashboard → SQL Editor for `qsciikhztvzzohssddrq`.
> 3. Paste the contents of `scripts/admin/bootstrap-admin.local.sql` (gitignored — pre-filled with your dev admin email).
> 4. Run the script. The verification query should return one row with `role='admin'` and `is_admin=true`.
> 5. Confirm `npx supabase functions list` shows `admin-users` as ACTIVE.

---

## Prompt 1 — Stage 6.1.2 Visual Smoke Test (admin foundation)

> Stage 6.1.2 is complete (admin layer); prompt 0 has been run.
>
> Run:
> ```bash
> npm run web -- --clear
> ```
>
> Sign in as `kyleruff+devtests1@gmail.com`. Walk `docs/browser-visual-test.md` sections N (Admin) and M (Account ADMIN? row).
>
> Key checks:
> - Account tab shows ADMIN? true (and Role = Admin)
> - Top-level Admin tab is visible
> - Users sub-tab loads via admin-users function
> - Create a bot user → succeeds → bot appears in Users list with BOT badge
> - View As bot user → shows read-only snapshot with banner
> - Block rules: add an email block → appears in list → unblock → marked LIFTED
> - History tab: load events for the bot user → shows recent actions
> - Sign in as a non-admin user → Admin tab is hidden
> - Try calling admin-users from a non-admin signed-in user → 403
>
> Update `docs/live-smoke-debug-log.md` with results.

---

## Prompt 2 — Stage 6.1.3: Invite Backend Migration (optional)

> Wire the invite backend if desired:
> - Migration for `argument_room_invites` (see `docs/invite-flow.md`)
> - RLS: inviter can insert/select; invitee can select own invites
> - Update InvitePanel to attempt real invite creation
> - Do NOT send emails yet
> - Do NOT expose user search broadly

---

## Prompt 3 — Stage 6.1.4: Persistent Response Marks / Resting Status

> Wire `GameRestingStatus` and `ClaimStanding` into per-argument-node UI.
> Models in `gameStatus.ts` / `claimStanding.ts` already exist.

---

## Prompt 4 — Stage 6.2.0: Transcript Language Processing Hardening (no AI yet)

> Harden types and schemas in `src/features/languageProcessing/` if present.
> Mock provider for offline testing. No Anthropic calls.

---

## Prompt 5 — Stage 6.2.1: Anthropic Provider (disabled by default)

> Only after smoke test + ANTHROPIC_API_KEY rotation confirmed.
> Wire Anthropic provider for `process-language-draft` Edge Function — disabled by default, never gatekeeps submission.

---

## Notes

Stage 6.1.2 complete as of 2026-05-16.
Infrastructure: project `qsciikhztvzzohssddrq`, migrations 0001–0007 applied. `submit-argument` ACTIVE. `admin-users` written, **deploy pending**.
750 tests pass. TypeScript strict mode clean. ESLint clean.

**Safe to run admin smoke test: YES — after deploy + bootstrap (Prompt 0).**
**AI (Anthropic) not called in Stage 6.1.2: confirmed.**

See `docs/current-status.md` for full status.
See `docs/admin-security-model.md` for admin security details.
See `docs/admin-bootstrap.md` for one-time bootstrap.
See `docs/admin-operations.md` for what admins can/cannot do.
See `docs/bot-user-operations.md` for bot user flow.
