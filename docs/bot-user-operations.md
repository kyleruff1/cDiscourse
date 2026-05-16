# CDiscourse — Bot User Operations

_Stage 6.1.2 — 2026-05-16_

## What bot users are

Bot users are **real Supabase Auth users** flagged as bots in two places:

1. `auth.users.raw_user_meta_data.is_bot = true`
2. A row in `public.bot_user_registry` with the bot label and persona

They are NOT client-side fakes. They have real credentials and can sign in through the normal auth flow once a password is set.

## What bot users are for

- Local/dev/staging testing
- Driving the `argument-counter-runner` skill across fixture scenarios
- Inspecting how the app renders for different personas via View As
- Demoing the app without exposing real users

## What bot users are NOT for (Stage 6.1.2)

- Production automation (no bot automation in this stage)
- Sending real emails / notifications
- Posting arguments programmatically (must still go through `submit-argument`)
- Standing in for real users in any privileged decision

## Creating a bot user

Via Admin UI → Bot Users tab → "+ New bot":
- Email (must be unique in Auth)
- Label (required, used as display name fallback)
- Optional persona (free text, stored in registry)
- Optional password (auto-generated if blank — server-side, never logged)

The Edge Function:
1. Creates auth.users row via `auth.admin.createUser`
2. Trigger creates profile row
3. Function updates profile with display name
4. Function inserts `bot_user_registry` row

Audit row written with `action='create_bot_user'`.

## Bot credentials

- Passwords are passed straight to Supabase Auth admin API and never stored anywhere readable by clients or app DB.
- For automated testing, store bot credentials in shell env vars only — never commit them.
- The `set_temporary_password` Edge Function action exists for resetting bot passwords. By default it only works on accounts flagged as bots (`botOnly=true`); passing `botOnly=false` lets it work on human users but should be reserved for emergency dev/staging operations.

## Disabling / re-enabling

- Disabling a bot uses the same `disable_user` action that humans use.
- Disabling the registry row (`enabled=false`) only marks the bot inactive in the registry — it does NOT disable auth. To prevent sign-in, use `disable_user`.

## Inspecting bot history

Use the View As tab with the bot's user ID:
- Recent arguments
- Recent debate participations
- Recent audit events
- Profile + bot registry metadata

This is read-only. View As never logs you in as the bot.

## Future stages

- Stage 6.1.3+: Counter-runner skill that programmatically signs in as a bot and posts through `submit-argument` (still via normal auth — service-role never in skill code)
- Later: Bot persona templates with fixture-driven moves

---

## Programmatic bot driving (Stage 6.1.2.2)

`scripts/bot-fixtures/runScenario.mjs` can sign in as bots (normal auth) and submit fixture moves through `submit-argument`. See `docs/bot-fixture-runner.md` for setup. The runner does NOT use service-role keys.
