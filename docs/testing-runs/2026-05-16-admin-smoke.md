# Admin smoke run — 2026-05-16

Stage 6.1.2.1 — admin foundation live smoke.

## Test users (aliases only)

- **admin-1** — dev human, plus-addressed gmail (matches the email used in `scripts/admin/bootstrap-admin.local.sql`)
- **bot-sports-optimist** — created during this run (planned)

No real credentials, passwords, or production users in this log.

## Bootstrap status

| Item | Result |
|---|---|
| `is_admin()` helper present | ✅ verified via migration 0007 |
| Bootstrap SQL run | ✅ via `npx supabase db query --linked --file scripts/admin/bootstrap-admin.local.sql` |
| Verification row returned | ✅ `role=admin`, `is_admin=true` for admin-1 |

## Edge function deployment

| Function | Status |
|---|---|
| `submit-argument` | ACTIVE v1 |
| `admin-users` | ACTIVE v1 (deployed 2026-05-16 22:20:06 UTC) |

## Browser smoke checklist

> Operator-driven. Each box must be checked manually in the running app.
> Start with: `npm run web -- --clear` → `http://localhost:8081`

### A. Sign in (admin-1)
- [ ] Sign in succeeds with admin-1 credentials
- [ ] Account tab shows `Role = Admin`
- [ ] Account tab shows `ADMIN? true`
- [ ] No role-change UI is visible in Account tab

### B. Admin visibility
- [ ] Top tab bar shows: Arguments | Account | Admin | Debug
- [ ] Admin tab is visible
- [ ] Debug tab present (dev only)

### C. Admin → Users
- [ ] Users tab loads without error (admin-users invocation succeeds)
- [ ] Search by email narrows the list
- [ ] Filter chips: All / Admins / Bots only work
- [ ] ADMIN badge appears on admin-1 row
- [ ] No service-role key visible in DevTools Network panel for the admin-users call

### D. Create bot (Admin → Bot Users → "+ New bot")
Use:
- label: `bot-sports-optimist`
- email: `kyleruff+bot-sports-optimist@gmail.com`
- display name: `Bot Sports Optimist`
- persona: `playful sports optimist`
- enabled: true
- password: any 8+ char temp string (NOT committed)

- [ ] Form submits without error
- [ ] Bot appears in Bot Users list with `BOT` badge
- [ ] auth.users row created (verifiable via Supabase Dashboard if needed)

### E. View As bot
- [ ] Admin → View As → paste bot user id → "View as snapshot"
- [ ] Banner reads "Read-only admin snapshot — you are NOT signed in as this user…"
- [ ] No "Post as user" affordance anywhere on the view
- [ ] Snapshot shows: target email, profile, bot row, (empty) recent arguments
- [ ] No auth token appears in DevTools

### F. Blocks
- [ ] Admin → Blocks → add `email` rule for `harmless-dummy@example.invalid` with reason
- [ ] Rule appears active in list
- [ ] Tap "Unblock" → rule marked `LIFTED` with timestamp
- [ ] Re-adding the same value succeeds (because the partial unique index only constrains active rules)

### G. History
- [ ] Admin → History → paste bot user id
- [ ] Recent audit events show: `create_bot_user`, `view_as_snapshot`
- [ ] No raw password or token text in any payload summary
- [ ] No raw email of the dummy block target appears as a "leak" — it's expected to appear normalized in the block-rule history (acceptable for app-level audit)

### H. Non-admin check
- [ ] Sign in as a non-admin test user
- [ ] Admin tab is NOT visible in top tab bar
- [ ] Account tab shows `ADMIN? false`
- [ ] Calling admin-users with this JWT (e.g. via DevTools) returns HTTP 403 with `reason=admin_required`

## Failures and patches

(populate as the operator runs each check)

| # | Check | Failure | Patch applied | Re-tested |
|---|---|---|---|---|
|   |       |         |               |           |

## Summary

- Admin bootstrap: ✅ verified server-side
- Admin function deploy: ✅
- Browser smoke (A–H): 🔲 pending operator run
- Bot user created: 🔲 pending
- View As tested: 🔲 pending
- Block/unblock tested: 🔲 pending
- History tested: 🔲 pending
- Non-admin 403 tested: 🔲 pending

## Secrets check

- [x] No secrets in this log
- [x] No bot password text in this log
- [x] No service-role key referenced
- [x] No JWT or token in this log
