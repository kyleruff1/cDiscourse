# CDiscourse — Admin Security Model

_Stage 6.1.2 — 2026-05-16_

## Principles

1. **Admin UI is client-visible but not client-trusted.** Hiding the Admin tab from non-admins is a UX nicety; the only security boundary is the Edge Function.
2. **All privileged actions go through `admin-users` Edge Function.** Never use service-role keys in Expo.
3. **The Edge Function verifies the caller's JWT then checks `profiles.role = 'admin'`.** No action runs without both checks.
4. **Service-role/secret keys live only as Supabase Function secrets.** They are never bundled into the client, the migration, or any tracked file.
5. **Every successful admin action writes an `admin_audit_events` row.** Failures are also logged when safe to do so.
6. **View As is a read-only snapshot.** It does NOT swap auth sessions or generate tokens for the target user. Admins cannot post as anyone else from this UI.
7. **Bot users are normal Supabase Auth users** (with `is_bot` metadata + `bot_user_registry` row), not client-side fakes.
8. **Passwords are never stored in app DB or docs.** Temporary passwords for bot/dev users are passed through the Auth admin API and never logged.
9. **Account disabling/deletion uses Supabase Auth admin endpoints** (ban_duration, deleteUser with soft delete), never raw RLS mutation.

## Threat model — what this layer protects against

| Threat | Mitigation |
|---|---|
| Non-admin user calls admin-users | `requireAdmin` returns 403 |
| Admin client tampering to mutate `profiles.role` directly | RLS denies admin role updates from client; only Edge Function (service-role) can update |
| Service-role key leakage from client | Service-role key never imported into `src/` (security scan enforces this) |
| Audit log tampering | No UPDATE/DELETE policies on `admin_audit_events` (admins cannot edit) |
| Last-admin lockout | `update_role` blocks demoting the last admin |
| Password handling errors | Passwords never logged; sanitizer redacts password-shaped keys |
| Brute-force admin role grant | `update_role` to admin requires `confirmAdminGrant=true` |
| Accidental delete | `soft_delete_user` requires `confirm=true` |

## What this layer does NOT protect against (yet)

- **Pre-auth IP blocking.** Block rules are app-level. A blocked IP can still reach the auth endpoint; enforcement is at the Edge Function / app level only. Full network-level enforcement is a later stage.
- **Pre-auth email blocking.** Same as above. A blocked email can still attempt sign-up; we may reject post-signup via Edge Function or trigger, but full pre-login enforcement requires Auth hooks.
- **Compromised Supabase service-role key.** If the service-role key leaks, all defenses fall. Rotate immediately and audit `admin_audit_events`.

## Action whitelist

Defined in `supabase/functions/_shared/adminAudit.ts`:

```
list_users, get_user_detail, create_user, create_bot_user,
update_role, send_password_reset, set_temporary_password,
disable_user, enable_user, soft_delete_user,
list_blocks, add_block, remove_block,
view_as_snapshot
```

The Edge Function rejects unknown actions with 400.

## Required confirmations

| Action | Required confirmation |
|---|---|
| `create_user` with role=admin | `confirmAdminCreate=true` |
| `update_role` to admin | `confirmAdminGrant=true` |
| `soft_delete_user` | `confirm=true` |
| `set_temporary_password` (default) | target must have a `bot_user_registry` row (botOnly=true) |
| Any destructive action | `reason` field (>= 1 char) |

## Audit payload sanitization

`sanitizePayload` strips these keys before insert:

```
password, temporary_password, temporaryPassword,
access_token, refresh_token, token, token_hash,
service_role_key, anon_key, api_key, apikey
```

Sensitive values are replaced with `[redacted]`.
