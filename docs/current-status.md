# CDiscourse — Current Status

_Last updated: 2026-05-16 (Stage 6.1.2)_

## Current Stage

**Stage 6.1.2 complete.** Admin and bot operations foundation: `is_admin()` helper, `admin_audit_events` / `admin_block_rules` / `bot_user_registry` tables (migration 0007 applied to hosted DB), `admin-users` Edge Function with 14 whitelisted actions, admin client wrapper, AdminScreen with 5 sub-tabs (Users / View As / History / Blocks / Bot Users), Admin tab gated by `profiles.role = 'admin'`. View As is read-only snapshot only — no auth impersonation. Bootstrap admin SQL is untracked (`scripts/admin/bootstrap-admin.local.sql` is gitignored). 750 tests, 26 suites, all passing.

Stages 6.1.0 (gamified UX), 6.0.3 (inline composer), 5.5.6.1 (RLS hotfix), 5.5.6 (account), 5.5.5 (post-submit refresh), and earlier all committed.

## What Works

### Infrastructure (live)
- Supabase project `qsciikhztvzzohssddrq` linked and accessible
- All 7 migrations applied to hosted project (0001–0007)
- `submit-argument` Edge Function ACTIVE (version 1)
- `admin-users` Edge Function: ✅ deployed ACTIVE v1 (2026-05-16 22:20 UTC)
- `.env` configured; gitignored
- Secret scan clean
- ANTHROPIC_API_KEY set as Supabase secret (reportedly rotated — not called in this or earlier stages)

### Core (local, tested)
- Session contracts, reducer, storage
- Constitution v1 engine — pure TS
- `submit-argument` Edge Function (JWT-protected, deterministic re-validation server-side)
- Migrations 0001–0007 (schema, RLS, seed, rails+edge, session+scalability, RLS fix, admin operations)
- Auth: `AuthScreen`, `useAuthSession`
- Argument viewport, tree, timeline/track view
- Argument composer (inline, "Your Move", idempotent submit, server 422)
- Account/profile feature (display name, ADMIN? row visible)
- **Stage 6.1.0** — gameStatus, claimStanding, argumentTimeline, gameCopy, counterClaim, invite UI
- **Stage 6.1.2** — admin layer:
  - Migration 0007: `is_admin()` helper, `admin_audit_events`, `admin_block_rules`, `bot_user_registry`
  - Edge Function `admin-users` (Deno, JWT-verified, admin-only): list_users, get_user_detail, create_user, create_bot_user, update_role, send_password_reset, set_temporary_password, disable_user, enable_user, soft_delete_user, list_blocks, add_block, remove_block, view_as_snapshot
  - Shared helpers: `adminAuth.ts` (requireAdmin), `adminAudit.ts` (write + sanitize), `adminSchemas.ts` (zod discriminated union)
  - Client wrapper: `src/lib/edgeFunctions.ts → adminUsers()`
  - Feature slice: `src/features/admin/` (AdminScreen, AdminUsersTab, AdminUserDetailPanel, AdminCreateUserForm, AdminViewAsTab, AdminHistoryTab, AdminBlocksTab, AdminBotUsersTab, adminHelpers, adminApi, useAdminUsers)
  - Tab gating: `getVisibleTabs(role, isDev)` in `roomNavigation.ts`
  - Account screen shows `ADMIN? true/false`
  - Bootstrap docs + untracked local SQL script (`scripts/admin/bootstrap-admin.local.sql`)
- Jest test suite: **750 tests**, 26 suites, all passing
- TypeScript strict mode clean (0 errors)
- ESLint clean (0 warnings)

## What Is Stubbed / Pending

- `admin-users` deploy: ✅ done
- Admin bootstrap SQL: ✅ run; dev human is `role=admin` (verified)
- **Live browser smoke (Stage 6.1.2.1 A–H)**: pending operator run — see `docs/testing-runs/2026-05-16-admin-smoke.md`
- IP/email block rules are **app-level only**; full Supabase Auth pre-login enforcement is a later stage
- View As is **read-only snapshot only**; no auth impersonation in this stage
- Bot user automation (counter-runner programmatic posting) is a later stage

## What Is Blocked

- **Live admin smoke test** — requires `admin-users` deploy + bootstrap SQL run
- **Docker/Supabase local** — never validated (Docker Desktop unavailable)

## Last Verification Commands

Run on 2026-05-16:

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ Pass (0 errors) |
| `npm run lint` | ✅ Pass (0 warnings) |
| `npm run test` | ✅ Pass (750 tests, 26 suites) |
| `npx supabase db push --dry-run` | ✅ Remote database is up to date |
| `npx supabase functions list` | submit-argument ACTIVE; admin-users not yet deployed |
| `npx supabase secrets list` | All expected secrets present (names only) |

## Hosted Backend Status

| Item | Status |
|---|---|
| Project ref | `qsciikhztvzzohssddrq` |
| Migrations applied | ✅ 0001–0007 |
| `submit-argument` deployed | ✅ ACTIVE v1 |
| `admin-users` deployed | ✅ ACTIVE v1 |
| `.env` configured | ✅ |
| Admin bootstrap SQL run | ✅ dev human promoted; verification row confirms `is_admin=true` |

## Next Recommended Steps

1. ✅ `admin-users` deployed
2. ✅ Admin bootstrap SQL run
3. **Live browser smoke**: `npm run web -- --clear`, walk `docs/testing-runs/2026-05-16-admin-smoke.md` sections A–H
4. **Stage 6.1.2.2 — dev bot fixture runner** (Node scripts under `scripts/bot-fixtures/`, uses normal auth, no service-role)
5. Later: Stage 6.1.3 (invite backend) or Stage 6.1.4 (resting status persistence)
