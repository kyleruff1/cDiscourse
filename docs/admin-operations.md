# CDiscourse — Admin Operations

_Stage 6.1.2 — 2026-05-16_

## What an admin can do (Stage 6.1.2)

- List users (with search, role filter, bot-only filter)
- View user detail (auth summary, profile, bot registry, recent arguments, recent audit events, recent participations)
- Create human user (server-side via Supabase Auth admin API)
- Create bot/test user with optional persona and label
- Promote/demote roles (`user` ↔ `moderator` ↔ `admin`) with required reason
- Send password recovery email link (for human users)
- Set temporary password (bot/test users only by default; opt-out requires explicit `botOnly=false`)
- Disable user (sets `banned_until` via Auth admin update)
- Enable user (clears ban)
- Soft-delete user (Supabase Auth soft delete; requires `confirm=true`)
- Add/remove app-level block rules (email, email domain, IP, IP CIDR, profile id)
- View-as snapshot of any user (read-only)
- See recent audit events targeting any user

## What an admin cannot do

- **Impersonate a user.** View As is a read-only snapshot. No auth token is generated for the target.
- **Edit history.** `admin_audit_events` has no update/delete policy; rows are append-only.
- **Demote the last admin.** The Edge Function blocks the call with `cannot_demote_last_admin`.
- **Set a human user's password directly without `botOnly=false`.** For humans, prefer the password reset link.
- **Bypass admin-users from the Expo client.** The client has no service-role key.

## Why View As is read-only

True impersonation would require generating an auth session token for the target user — Supabase Auth admin API supports this (`generateLink`) but it is intentionally NOT used here. Stage 6.1.2 keeps admins inspecting state rather than acting as another user. This avoids: account takeover via leaked admin session, accidental writes attributed to the wrong user, and Constitution rule violations from authority confusion.

A future stage may add an "Act as snapshot" mode that lets admins replay a target's argument-room view; even then, posting will require explicit "exit snapshot" and re-sign-in.

## Why password resets prefer recovery links for humans

- Auditability: Supabase logs the recovery flow.
- The user controls the new password.
- Admins never see or transit the password.
- `set_temporary_password` is dev/staging only and should be used for bot accounts.

## Why blocks are app-level only

Supabase Auth pre-login enforcement requires Auth Hooks or external middleware. Until those are wired in:
- Block rules are stored in `admin_block_rules`.
- The app and Edge Functions can consult them when relevant.
- Auth itself will still let a blocked email or IP attempt sign-up/sign-in.
- Stage 6.1.3+ will wire pre-login enforcement.

## Audit trail

Every successful admin action and most failures write to `admin_audit_events`:

```
actor_user_id → who did it
target_user_id → who was affected (nullable)
action → whitelisted action code
reason → required for destructive actions
source → 'admin_ui' | 'edge_function' | 'sql_editor' | 'system'
payload → sanitized (passwords/tokens redacted)
created_at → server time
```

Audit rows cannot be edited or deleted by admins. Service-role bypass exists for system maintenance but should never be used to rewrite history.

## Action workflow examples

### Granting admin to a user

1. Admin Users tab → search for target by email
2. Open detail panel
3. Enter reason in the "Action reason" field
4. Check "Confirm admin grant"
5. Tap "Promote to admin"
6. Verify the row's ADMIN badge appears on refresh
7. The action is logged in `admin_audit_events` with `action='update_role'`

### Creating a bot test user

1. Admin Bot Users tab → "+ New bot"
2. Fill email, label, optional persona
3. Either provide an 8+ char password or leave blank (auto-generated)
4. Tap Create
5. Bot appears in list. Auth user exists in Supabase Auth with `is_bot=true` metadata.
6. To inspect bot history later: View As tab with the bot's user id

### Disabling an abusive user

1. Admin Users tab → find target
2. Enter reason
3. Tap Disable user → Supabase Auth sets `banned_until`
4. To re-enable: same flow, tap Enable user

## Admin Arguments table — room-source filter + view prefs (ADMIN-ARGUMENTS-003, #469)

The Admin → Arguments tab has a **Room source** filter row and persistable view
preferences. Both are pure-client (AsyncStorage); there is no server change, no
Edge Function, and no migration.

### Room-source filter

The chip row (`All rooms · xAI adversarial · AI corpus · Stress batch · Scenario ·
Seed · Human / untagged`) filters the table by **where a room came from**. It is a
**navigation / diagnostic aid, not a verdict** — it tells you a room was produced
by a corpus run, never anything about whether its content is correct or popular.

How it works: the corpus runners append a suffix to the debate title
(`[xai-adv …]`, `[ai-corpus … #scenario]`, `[stress …]`, `[scenario-…]`,
`[seed-…]` / `[ai-seed-…]`). `classifyRunFamily` in
`src/features/admin/adminArgumentsRunTagModel.ts` reads that suffix off the
**existing `debates(title)` JOIN** the loader already performs — no new column, no
new query. A plain title with no suffix classifies as `Human / untagged`.

When #476 (CORPUS-30-RUNTAG-PERSIST) lands a durable indexed `run_tag` column, the
swap is a one-line change at the single call site in the `filtered` memo; the
filter UI and the family set do not change.

### Persistable view preferences (v1)

Density, sort field + direction, the room-source filter, participant kind, and the
row limit persist to AsyncStorage (`cdiscourse:admin-arguments-prefs:admin`) and
restore on the next mount. The blob is cosmetic device-local view state only — no
auth, secret, or role data. Density (`Comfortable` / `Compact`) tightens row
spacing.

### Deferred (pending operator decisions)

- **Classifier-coverage column** — blocked on PHASE7-OBSERVATION-001 / Blocker B3
  (client-RLS read vs. a new Edge action).
- **Bot / human filter** — blocked on Blocker B1 (confirm the `profiles.is_bot`
  column name). `participantKind` is already in the persisted prefs schema and the
  toolbar shows honest "Bot / human filter coming later." copy, but it drives no
  active filter in v1.
- **Coverage band thresholds** — Blocker B4.
