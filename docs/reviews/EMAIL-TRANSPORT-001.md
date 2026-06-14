# EMAIL-TRANSPORT-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-13
**Branch:** feat/EMAIL-TRANSPORT-001-email-transport
**Design:** docs/designs/EMAIL-TRANSPORT-001.md
**Issue:** #635 · GATE-C (merge = deploy for the registered `room-notifications` fn) · inert while gated OFF

## Summary

This card standardizes CDiscourse transactional email into a shared, swappable,
gated Deno module (`supabase/functions/_shared/email/`) and refactors the
existing-user invite send (`room-notifications`) onto it in a behavior-preserving
way. The implementation matches the design precisely: a provider-agnostic
`EmailProvider` interface + factory (Resend default, Postmark a documented `null`
swap path), a Resend HTTP adapter that is the ONLY place the provider key + the
`Bearer ${apiKey}` header live, pure render/safety modules, an orchestrator
(`sendTransactionalEmail`) with a load-bearing master-gate ladder, and a
dependency-free Jest mirror of the Deno zod schemas. Security hygiene is
exemplary — zero secret key reads in `app/`/`src/`, zero secret values anywhere
in the diff, an audit-safe result shape, and a defense-in-depth runtime ban-list.
The card lands DORMANT: `CDISCOURSE_EMAIL_TRANSPORT_ENABLED` defaults OFF →
`sendTransactionalEmail` returns `skipped_gate_off` with no network on merge.
The GATE-A watch-item (re-pointing the `Bearer ${apiKey}` source-scan to the new
location) was handled correctly — re-pointed and strengthened, never dropped or
weakened. Typecheck, lint, and the full suite all pass at exit 0. No concerns
remain; this is safe to PR and operator-merge as a GATE-C card.

## Verification
- typecheck: pass (exit 0)
- lint: pass (exit 0, `eslint . --max-warnings 0`)
- test: 781 → 794 suites (+13); 30847 → 30994 passed (+147 net); 1 skipped (pre-existing, not introduced by this card); 30995 total; exit 0
- secret scan: clean (no key value in any source/test/doc/log/commit message; `app/`+`src/` hits are guard regex + comments only)
- doctrine scan: clean (all verdict-token matches are ban-list declarations / doctrine comments / test descriptions, never email copy)
- Migration apply: N/A — no files under `supabase/migrations/`; no RLS/policy/table SQL; migration-bearing heightened review not triggered

## Design conformance
- [x] All design file-changes are present (7 new prod modules, 1 mirror, modified `room-notifications/index.ts` + `config.toml` + `sendInviteSmoke.js`, 13 new + 3 re-pointed test files, design + runbook + design-testing-run + current-status)
- [x] No undocumented file-changes (the untracked `docs/testing-runs/2026-06-13-arg-room-004-email-smoke.md` in the worktree is a separate ARG-ROOM-004 artifact, correctly NOT in this card's diff)
- [x] Data model matches design (no new table/column/migration; reuses `argument_room_invites` + `debate_participants`; raw token persists only as a hash, travels server-side into the redemption href only)
- [x] API contracts match design (`EmailProvider`/`TransactionalEmailMessage`/`EmailSendResult`/`SendTransactionalEmailInput`/`renderArgumentRoomInviteEmail` shapes byte-match the design; gate ladder matches the design pseudocode exactly)

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings — `emailCopyDoctrine.test.ts` runs the REAL `assertNoBannedTokens` engine over the extracted rendered copy; copy is neutral ("You've been invited to an argument", public/private capacity facts only)
- [x] Score never blocks posting — N/A (email transport is not a posting/scoring path); a provider 4xx/5xx/throw → `failed_sanitized`, never blocks the user action
- [x] No service-role in client code — `grep app/ src/` for `SERVICE_ROLE`/`RESEND_API_KEY`/`ANTHROPIC_API_KEY` returns only a detector regex (`argumentScenarioValidation.ts:24`) + two comments (`edgeFunctions.ts:9,397`), all pre-existing, none introduced by this card; `src/features/email/emailSchemasMirror.ts` reads no secret
- [x] No direct insert into public.arguments — N/A (no DB write)
- [x] No AI calls in production app paths — N/A (no AI surface)
- [x] Plain language only — `emailCopyDoctrine.test.ts` asserts no snake_case internal codes in any prose fragment; no validation codes / failure reasons in the body
- [x] Epic-specific doctrine — `supabase-edge-contract`: Lane B runs server-side in the registered Edge fn via `fetch()` to the provider HTTPS API; the `Bearer ${apiKey}` header lives ONLY in `resendProvider.ts` (pinned by `emailNoLogLeak.test.ts` "exactly one file"); no nodemailer, no SMTP socket; audit-safe error shape; `EmailSendResult` carries no recipient/body/key. No-enumeration preserved: `resolveInviteNotificationStatus` is branch-independent posture-based; `INVITE_AUTH_BRIDGE_ENABLED` stays independent of the product master gate. No visible "Supabase" in any template (`authTemplatesBranding.test.ts`); Auth tokens stay Supabase-owned (`{{ .ConfirmationURL }}` only).

## Test coverage
- [x] New public functions have unit tests — all 12 named test classes present + adequate (provider factory, master gate ladder, gate reconciliation, render, copy doctrine, no-token-leak, safety sanitizers, resend request shape, no-log-leak source-scan, room-notifications refactor, schemas-mirror parity, auth-templates branding) + a 13th smoke-guards suite
- [x] User-facing strings have ban-list assertion — `emailCopyDoctrine.test.ts` + the runtime `assertNoBannedTokens` (17-token list incl. `challenger`/`opponent`) + `authTemplatesBranding.test.ts`
- [x] Edge cases from design § "Edge cases" have tests — master OFF (skipped_gate_off), key/FROM missing (not_configured), 4xx/5xx/network (failed_sanitized + class), banned copy (blocked_banned_copy), empty recipient (not_configured), empty room title → "an argument", HTML/control-char stripping
- [x] Accessibility assertions present — N/A (no RN UI card); the email template a11y proxy (≥44px CTA, viewport, max-width) IS asserted in `authTemplatesBranding.test.ts`

### WATCH-ITEM #2 (critical) — re-pointed source-scan
Verified the `Bearer ${apiKey}` in-place assertion FOLLOWED the code from
`room-notifications/index.ts` to `resendProvider.ts`:
- `roomNotifications.email.safety.test.ts`: the old positive assertion against the
  room-notifications source is replaced by `SRC.not.toContain('Bearer ${apiKey}')`
  + `not.toContain('api.resend.com')` (proves the move); a NEW
  `describe('resendProvider — ...')` block re-pins
  `expect(bearerLines.length).toBeGreaterThan(0)` against `PROVIDER_SRC` (non-trivial).
- `roomNotifications.edge.test.ts` + `roomNotifications.email.test.ts`: same pattern —
  positive Bearer/`api.resend.com` assertions inverted on the wrapper file, re-pointed
  to the provider with `expect(authLine).toBeDefined()`.
- `emailNoLogLeak.test.ts`: pins the `Bearer ${apiKey}` construction AND the
  read-then-Bearer key consumption to EXACTLY `resendProvider.ts`, asserts no
  nodemailer/SMTP, host allow-list = `api.resend.com` only, no service-role, no
  secret-shaped literal.
None were deleted or turned trivially-true; the net assertion strength increased.

## Blockers
None.

## Suggestions (non-blocking)
1. The design's open question #2 (defer the non-invite Lane-A templates) is
   resolved in-code: `config.toml` ships only the already-branded `invite.html`
   registration, and `authTemplatesBranding.test.ts` is a `describe.each` invariant
   that scales when recovery/magic-link/confirmation/email-change land. No action
   needed — flagged so the follow-up card is on the radar.
2. `safety.ts` ships `isPlausibleEmail`/`escapeHtml`/`escapeHref` (the latter in
   `emailTemplates.ts`); `escapeHtml` and `escapeHref` overlap in intent. Harmless
   defense-in-depth, but a future consolidation could route both through one helper.
3. Future consolidation target (already noted in design § Out of scope):
   `request-argument-deletion` + `cutover-health-monitor` still carry their own
   inline Resend `maybeSend*` blocks; folding them onto this shared module in a
   later card would remove the remaining drift surface.

## Operator next steps
- Push the branch: `git push -u origin feat/EMAIL-TRANSPORT-001-email-transport`
- Open PR: `gh pr create --title "EMAIL-TRANSPORT-001: CDiscourse-owned email transport + Resend adapter (GATE-C, lands dormant)" --body-file docs/reviews/EMAIL-TRANSPORT-001.md`
- GATE-C merge decision (operator-only — merge IS deploy): the squash-merge auto-redeploys the `config.toml`-registered `room-notifications` fn. It lands INERT (all gates default OFF; no hosted template/SMTP push on merge). No new function is registered.
- Deploy / go-live (operator sequence, per `docs/runbooks/email-provider-setup.md` — Claude never runs any of these): DNS (SPF/DKIM/DMARC) → secrets `CDISCOURSE_EMAIL_FROM`/`CDISCOURSE_EMAIL_REPLY_TO`/`CDISCOURSE_EMAIL_PROVIDER` (key on stdin) → Lane A Custom SMTP (Dashboard or gated Management-API) → single-target seed smoke (`CDISCOURSE_ALLOW_EMAIL_TRANSPORT_SMOKE=1` + `CDISCOURSE_EMAIL_SMOKE_TARGET=<dev alias>`) → go live with BOTH `CDISCOURSE_EMAIL_TRANSPORT_ENABLED=true` AND `INVITE_EMAIL_ENABLED=true` (the documented gate-composition change) → batch only after `CDISCOURSE_ALLOW_EMAIL_TRANSPORT_BATCH=1`.
- Post-merge worktree cleanup (operator step) — run from the main repo root after the PR merges, per roadmap-reviewer.md § "Post-merge worktree cleanup":
  - `git worktree remove -f -f ".claude/worktrees/agent-a263325c2c4c1b7fe"`
  - `git branch -D feat/EMAIL-TRANSPORT-001-email-transport`
  - On Windows "Filename too long": `Remove-Item -Path "\\?\C:\Users\kyler\cdiscourse\debate-constitution-app\.claude\worktrees\agent-a263325c2c4c1b7fe" -Recurse -Force` then `git worktree prune`
