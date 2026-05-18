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

Stage 6.1.8 complete as of 2026-05-17. New argument-room game surface (Stack + Timeline), deletion request workflow (migration + Edge Function + client wrapper + sheet UI), optional debate title with safe RLS-gated update path. Posted message bodies remain immutable; deletion is REQUEST-ONLY. Admin Arguments + Debate list tables (Stage 6.1.6b) unchanged. **1425 tests / 58 suites passing.** No Anthropic / xAI / X API call by Claude in this stage. Migration 0008 + Edge Function `request-argument-deletion` are written but NOT deployed — operator runs `npx supabase db push --linked` + `npx supabase functions deploy request-argument-deletion` when ready.

Stage 6.1.7 complete as of 2026-05-17. xAI adversarial thread corpus scaffold: new runner `runXaiAdversarialThreadCorpus.js`, provider abstraction (xai_responses default, legacy_chat_search fallback), source/reply collectors, first-disagreement selector with mixed-agreement preference, deterministic 3-bot scene builder, continuation loop with submit-argument flow, v2 annotation pass, single JSONL event stream, committable Markdown report. Engagement credit and factual-standing eligibility tracked SEPARATELY. Synthetic rebuttals (when allowed) are clearly marked `excludedFromRealEpidemiology=true`. **1360 tests / 54 suites passing.** No Anthropic / xAI / X API call by Claude in this stage.

Next safe live runs require operator readiness:
- `bot:fixture:xai-adversarial:dry` — already validated end-to-end. No cost.
- `bot:fixture:xai-adversarial:3 -- --post-to-dev-supabase` — tiny live pilot (3 source posts × candidate 30 × replies 12 × max-depth 5). Estimated xAI: 6 calls (3 source + 3 reply). Anthropic: ~25–40 continuation moves + annotations. Spend roughly under $2. Operator must confirm bot-tests creds are live.
- `bot:fixture:xai-adversarial:50 -- --post-to-dev-supabase` — full pilot. Operator-only. Spend $20–$80 estimated. Run only after the 3-room pilot reads usefully.

Stage 6.1.6b complete as of 2026-05-17. Admin Arguments and Debates are now real tables with sortable Created / Last Updated column headers (not card metadata). Each timestamp cell renders absolute + relative as separate stacked `<Text>` elements; horizontal scroll wrapper keeps columns aligned. Sort uses real `Date.getTime()` comparisons; missing `updated_at` falls back to `created_at` for both display and sort. testIDs: `admin-arguments-table`, `admin-arguments-header-{created,updated}`, `admin-arguments-cell-{created,updated}`, plus the `debates-*` set. **1315 tests / 52 suites passing.** No Anthropic / xAI / X API call by Claude in this stage. Next safe stage is corpus / epidemiology inspection.

Stage 6.1.6a complete as of 2026-05-17. Admin Arguments and the Debate list now expose explicit Last Updated / Created columns with toggleable sort (default `updated_at desc`), plain-language chips (Newest activity / Oldest activity / Newest created / Oldest created), helper copy, and an activity legend. Each row shows `formatDateTime · formatRelativeShort`; missing `updated_at` falls back to `same as created`. AdminHistoryTab also got the timestamp polish. `adminArgumentsApi.loadAdminArguments` now takes `sortField` + `sortDirection`. Env keys are local + gitignored — no key was re-saved, printed, or inspected. **1305 tests / 52 suites passing.** No Anthropic / xAI / X API call by Claude in this stage. Next safe stage is corpus / epidemiology inspection (e.g., run `bot:fixture:ai:annotated:dry` to walk through the new annotated report shape), not more UI timestamp work.

Stage 6.1.5.2 complete as of 2026-05-17. Anti-amplification doctrine encoded across the annotation schema (politicalIssueFrame, politicalValence, amplificationSignals, evidentiaryRisk, amplificationRisk, platformSupportWarning, recommendedGameTreatment, justification, 9 new rule flags). Point-standing engine post-processor (`applyAntiAmplification`): amplification earns engagement credit, never factual-standing credit until evidence arrives; narrowing / sourcing / clarification earns the conversion bonus. xAI X Search live seeder wired (`POST /v1/chat/completions` with `search_parameters`). X News pilot report extended with per-root + per-reply annotations + new aggregates. `runAiDrivenCorpus.js` captures submit error detail. **1258 tests / 50 suites passing.** No Anthropic / xAI call by Claude in this stage.

Next safe live runs require operator readiness:
- 3-room annotated AI corpus (~$1): needs `ANTHROPIC_API_KEY` + `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true` in `.env.engagement-intelligence` AND `.env.bot-tests` populated (anon key + admin email/password + bot creds).
- xAI X Search seeds via `bot:fixture:ai:3:annotated -- --seeds xai_live` (single xAI call): needs the existing `XAI_API_KEY` + `ENGAGEMENT_INTEL_ENABLE_XAI=true` (already set) — combine with the Anthropic readiness above.

Stage 6.1.5.1 annotation pipeline complete as of 2026-05-17. Anthropic argument-intelligence schema + prompt builder + annotator wrapper + deterministic fallback + corpus runner wiring + Markdown report builder + 45 new tests landed. The dry path produces a complete annotated report using deterministic fallback only — no Anthropic call by Claude in this stage. Live 3-room / 50-room annotated pilots remain operator-gated (require `.env.engagement-intelligence` + `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true` + `--pilot`). **1210 tests / 46 suites passing.**

Stage 6.1.3.2b complete as of 2026-05-17. xAI auth probe Windows clean-exit patch: response body now explicitly cancelled/drained, event loop drained one tick, `process.exitCode` replaces `process.exit()`, empty-string `XAI_API_KEY` in `process.env` correctly treated as no-key. Live probe confirmed `status=200 / category=auth_ok / exit 0 / no Windows assertion`. xAI classification stays disabled by default. **1165 tests / 41 suites passing.**

Stage 6.1.5.1 (earlier — Admin Arguments + qualifier taxonomy + game recommendations) complete as of 2026-05-17. Live AI corpus from Stage 6.1.5 (38/38 posted) drove the recommendations. No Anthropic / xAI call by Claude in this stage.

Next safe stages:
- Stage 6.1.5.2 — point-standing persistence + UI nudges in the composer (wires the Stage 6.1.4 engine + uses `messageQualifiers` nudges).
- Stage 6.1.5.3 — `bot:fixture:ai:50` live run (~$10–$30 spend; 50 rooms; rederive recommendations from a wider sample).
- Stage 6.1.6 — argument-room UX cleanup informed by browser walk-through of the Admin Arguments tab.
Infrastructure: project `qsciikhztvzzohssddrq`, migrations 0001–0007 applied. `submit-argument` ACTIVE v1. `admin-users` ACTIVE v1.
**851 tests pass.** TypeScript strict mode clean. ESLint clean.

**Safe to run admin smoke test: YES.**
**Safe to run `bot:fixture:corpus:10` (live): YES.**
**Run `bot:fixture:corpus:50` only after the 10-room corpus reads usefully** — see `docs/bot-engagement-corpus.md`.
**AI (Anthropic) not called in Stage 6.1.3.1: confirmed.**

See `docs/current-status.md` for full status.
See `docs/bot-fixture-runner.md` for runner / fixture authoring rules (updated 6.1.3.1).
See `docs/bot-engagement-corpus.md` for the corpus artifact spec.
See `docs/bot-topic-bank.md` for the topic library.
See `.claude/skills/bot-provocateur/SKILL.md` and `.claude/skills/bot-revocateur/SKILL.md` for spicy stress-test mode rules.

---

## Prompt 6.5 — Stage 6.5 Timeline-first implementation kickoff

> Implement #1 TL-001 (Timeline as default room landing mode), then #2 TL-002 (root marker), then #3 TL-003 (no-redirect board shell). Stay strictly within Stage 6.5.
>
> Read first: `docs/ux-ui-project-board.md`, `docs/argument-stack-timeline-surface.md`, `docs/conversation-gallery-ux.md`.
>
> Charter to follow: `docs/agent-charters.md` § "timeline-gameboard-implementer".
>
> Acceptance is the criteria in each issue body; tests in `__tests__/roomEntryDefaultMode.test.ts` and adjacent files. Do not skip the existing mode-persistence contract.
>
> Do not touch `src/lib/constitution/engine.ts`. Do not call any external AI provider. Do not deploy.

---

## Prompt 6.5-PB — GitHub Projects sync apply

> The dry-run plan in `npm run github:ux-board:dry` is valid. If `scripts/github/uxBoardCards.json` has been edited since the last apply, run `bash scripts/github/applyUxProjectBoard.sh` to push changes to Project #1.
>
> The script reads field IDs live from `gh project field-list` (no embedded schema) and dedupes by issue prefix. Re-running is safe.
>
> Required: `gh` from cli.github.com (not the npm `gh` package), `gh auth status` showing `project` scope.

---

## Prompt 6.5-AE — Admin email validation dry/mock pass (QOL-015)

> Walk `docs/admin-email-validation-plan.md` steps M1 – M5. Write or extend tests in `__tests__/` for the `request-argument-deletion` Edge Function. Mock Resend. Assert that `Authorization`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, JWT tokens, and admin email addresses never appear in test snapshots or response payloads.
>
> Do NOT call `npx supabase functions deploy`. Do NOT call `npx supabase secrets set`. Do NOT send a real email. Stop at L1 — operator does the live test.

---

## Prompt 6.6-OE — Open-room engagement runner patch (QOL-020)

> Implement `scripts/bot-fixtures/runOpenRoomEngagementBots.js` patches per #44 acceptance: skip rooms with `moveCount < 1`, respect a bot's already-assigned side, target 33-66% deterministic coverage per run.
>
> Dry mode must still emit the full event set. Tests in `__tests__/openRoomEngagementMoveRenderer.test.ts` (and a new `runOpenRoomEngagementBotsFilters.test.ts` if helpful).
>
> Do NOT pass `--pilot` in this session. No service-role. No direct insert into `public.arguments` — posts only via `submit-argument`.

---

## Prompt 6.8-HOST — cdiscourse.com/dev hosting spike (HOST-001)

> Spike both options in `docs/`:
> A) `dev.cdiscourse.com` subdomain (recommended fallback).
> B) `cdiscourse.com/dev` path with reverse-proxy rewrite + SPA fallback.
>
> For each: how Expo web `homepage` / base-path is configured, how nested route refresh resolves, asset URL behaviour, Supabase public URL env handling.
>
> Output a recommendation in `docs/`. Do not configure DNS, do not deploy, do not edit production env.
