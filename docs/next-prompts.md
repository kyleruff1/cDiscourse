# CDiscourse — Next Prompts

The next recommended session prompts, in order. Run `npm run checkpoint` first to confirm the current stage.

---

## Prompt 0 — Deploy & bootstrap (✅ done 2026-05-16)

> 1. ✅ `npx supabase functions deploy admin-users` → ACTIVE v1
> 2. ✅ `npx supabase db query --linked --file scripts/admin/bootstrap-admin.local.sql` → verification row shows `role=admin`, `is_admin=true`
> 3. ✅ `npx supabase functions list` confirms `admin-users` ACTIVE

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

Stage 6.1.2.4b complete as of 2026-05-17. Bot fixture runner repaired; first end-to-end fixture posted 7/7 moves via normal auth + `submit-argument` (sports-play-in, room `62305b8b-c11e-41a6-81b8-4c95daf73d2c`).
Infrastructure: project `qsciikhztvzzohssddrq`, migrations 0001–0007 applied. `submit-argument` ACTIVE v1. `admin-users` ACTIVE v1.
**803 tests pass.** TypeScript strict mode clean. ESLint clean.

**Safe to run admin smoke test: YES.**
**Safe to run other bot fixtures (popculture / bikelanes / remotework): YES — but each fixture body may need the same parent-overlap + resolution-keyword tightening applied to sports-play-in.**
**AI (Anthropic) not called in Stage 6.1.2.4b: confirmed.**

See `docs/current-status.md` for full status.
See `docs/bot-fixture-runner.md` for runner / fixture authoring rules (updated 6.1.2.4b).
See `docs/testing-runs/2026-05-17-sports-play-in.md` for the live run log.
See `docs/admin-security-model.md` for admin security details.
