# CDiscourse — Supabase Admin Operations

_Last updated: 2026-05-16 (Stage 5.5.6)_

## Project Reference

| Field | Value |
|---|---|
| Project ref | `qsciikhztvzzohssddrq` |
| Region | East US |
| Linked via | `npx supabase link --project-ref qsciikhztvzzohssddrq` |

---

## Check Linked Project

```bash
npx supabase projects list
```

Look for `qsciikhztvzzohssddrq` in the output with status `ACTIVE_HEALTHY`.

---

## Check Migration Status

```bash
# Dry-run — shows which migrations would apply without touching the DB
npx supabase db push --dry-run

# Check what is already applied
npx supabase db status
```

All migrations in `supabase/migrations/` should show as applied. A clean dry-run means no pending migrations.

---

## Check Deployed Functions

```bash
npx supabase functions list
```

Expected functions:
- `submit-argument` — validates and persists argument submissions

---

## Check Secrets (names only — values never printed)

```bash
npx supabase secrets list
```

Expected secrets:
- `ANTHROPIC_API_KEY` — AI key, used only when `AI_LANGUAGE_PROCESSING_ENABLED=true`
- `AI_LANGUAGE_PROCESSING_ENABLED` — must be `false` for production (keep AI off by default)

**Never run `npx supabase secrets list --reveal`.** Values must never appear in terminal output, logs, or screenshots.

---

## Deploy submit-argument Function

```bash
npx supabase functions deploy submit-argument
```

Deploys from `supabase/functions/submit-argument/`. No `--no-verify-jwt` flag — JWT verification is required.

---

## Set Anthropic API Key Safely

Paste manually at the prompt — do not include the key in shell history:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=<paste-manually>
```

Verify it registered (name only, no value):

```bash
npx supabase secrets list
```

---

## Keep AI Disabled

```bash
npx supabase secrets set AI_LANGUAGE_PROCESSING_ENABLED=false
```

This is the default. The `submit-argument` function checks this flag before calling Anthropic. If the secret is missing or set to anything other than `"true"`, the AI path is skipped entirely.

---

## Reset Local Database (Development Only)

Docker Desktop must be running:

```bash
npx supabase start        # starts local stack (applies migrations + seed)
npx supabase db reset     # re-runs all migrations + seed.sql from scratch
```

**Never run `db reset` against the linked remote project.** It is local-only.

---

## Link to Remote Project (One-Time Setup)

```bash
npx supabase link --project-ref qsciikhztvzzohssddrq
```

---

## What Not to Commit

| What | Why |
|---|---|
| `.env` | Contains `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key — never in client code or git |
| `ANTHROPIC_API_KEY` | AI key — Supabase secrets only |
| Supabase access tokens | Session tokens from `npx supabase login` |
| Screenshots with secret values | Terminal output showing secrets or keys |

Before committing, verify no secrets are present:

```bash
grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE\|access_token" src/ supabase/functions/
# Must return zero matches
```

`.env.example` is safe to commit — it contains only key names with empty values.

---

## Supabase Dashboard Quick Links

| Task | Where |
|---|---|
| View / disable / delete users | Dashboard → Authentication → Users |
| View / edit profile rows | Dashboard → Table Editor → profiles |
| Run maintenance SQL | Dashboard → SQL Editor |
| View Edge Function logs | Dashboard → Edge Functions → Logs |
| Manage secrets | Dashboard → Edge Functions → Secrets |

See `docs/account-operations.md` for SQL snippets covering common user and profile operations.
