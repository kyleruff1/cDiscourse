# CDiscourse — Bot Fixture Runner

_Stage 6.1.2.2 — 2026-05-16_

## What this is

A **dev-only Node script** that drives the app's authoritative paths using fixture scenarios:

1. Signs in as the dev admin (normal Supabase auth)
2. Ensures bot users exist via the `admin-users` Edge Function (`create_bot_user`)
3. Signs each bot in via normal auth
4. Creates an Argument Room
5. Submits each fixture move through `submit-argument` (with `client_submission_id`)
6. Writes a redacted run log to `docs/testing-runs/`

**No service-role keys.** **No direct posted-argument inserts.** **No Anthropic calls.**

## Files

```
scripts/bot-fixtures/
  loadEnv.mjs         — env parsing + validation (pure)
  loadScenario.mjs    — fixture JSON loader + ordering (pure)
  supabaseClient.mjs  — anon-key client factory + signInBot
  adminOps.mjs        — admin-users wrapper (admin JWT)
  submitMove.mjs      — fixture→submit-argument body builder (pure)
  writeRunLog.mjs     — redacted run log writer
  runScenario.mjs     — entry point
```

Unit tests: `__tests__/botFixtureRunner.test.ts` (pure helpers only).

## Operator setup (first time)

1. Copy the template:
   ```bash
   cp .env.bot-tests.example .env.bot-tests
   ```
   (`.env.bot-tests` is gitignored.)

2. Edit `.env.bot-tests`. **Use test-only emails — preferably plus-addressed:**
   ```
   CDISCOURSE_ADMIN_EMAIL=kyleruff+devtests1@gmail.com
   CDISCOURSE_ADMIN_PASSWORD=<the password you signed up with>

   CDISCOURSE_BOT_A_EMAIL=kyleruff+bot-alpha@gmail.com
   CDISCOURSE_BOT_A_PASSWORD=<random 16+ chars>

   CDISCOURSE_BOT_B_EMAIL=kyleruff+bot-beta@gmail.com
   CDISCOURSE_BOT_B_PASSWORD=<random 16+ chars>

   CDISCOURSE_BOT_C_EMAIL=kyleruff+bot-gamma@gmail.com
   CDISCOURSE_BOT_C_PASSWORD=<random 16+ chars>

   CDISCOURSE_FIXTURE_SCENARIO=sports-play-in
   ```

3. The admin account must already be promoted to `role=admin` (see `docs/admin-bootstrap.md`).

4. Generate random bot passwords. Suggested:
   ```bash
   # cross-platform
   node -e "console.log(require('crypto').randomBytes(16).toString('base64url'))"
   ```

5. **Do not commit `.env.bot-tests`.**

## Running

```bash
npm run bot:fixture                # uses CDISCOURSE_FIXTURE_SCENARIO from env
npm run bot:fixture:sports         # sports-play-in
npm run bot:fixture:popculture     # pop-culture-trailers
npm run bot:fixture:bikelanes      # light-civic-bike-lanes
npm run bot:fixture:remotework     # everyday-remote-work
```

Or pass the scenario id directly:
```bash
node scripts/bot-fixtures/runScenario.mjs sports-play-in
```

Exit codes:
- `0` — all moves posted successfully
- `1` — at least one move failed (see run log)
- `2` — env or scenario validation failed
- `3` — admin sign-in failed
- `4` — bot sign-in failed
- `5` — room creation failed
- `99` — unhandled exception

## What the run log contains

After running, you'll find a new file:
```
docs/testing-runs/<YYYY-MM-DD>-<scenario>.md
```

It includes:
- Aliases mapping (admin-1, bot-a, bot-b, bot-c)
- Room id
- Move-by-move table (expected vs actual status)
- Notes summary

All emails, JWTs, tokens, and secret-shaped values are redacted before write.

## Manual verification after a run

```bash
npm run web -- --clear
```

In the app (signed in as admin):
1. **Admin → Bot Users** — confirm bots exist
2. **Admin → View As** — paste each bot's user id → review snapshot
3. **Admin → History** — paste a bot id → see `create_bot_user`, `view_as_snapshot` events
4. **Arguments → (the room created by the run)** — inspect timeline/track view

Then open `docs/testing-runs/<date>-<scenario>.md` to compare expected vs actual.

## Security invariants enforced by tests

- `runScenario.mjs` does not reference `SERVICE_ROLE_KEY`, `sb_secret_`, or `Anthropic`
- The submit body builder enforces a key whitelist (no `author_id`, `depth`, `status`, `server_validation`)
- All argument submissions go through `submit-argument` (no direct `.from('arguments').insert`)
- The run log writer redacts emails, JWTs, and secret-shaped tokens before write

## What this is NOT

- Not production automation. Bots do not post on a schedule.
- Not a load tester.
- Not a moderation tool.
- Not Anthropic-driven.
- Not a way to bypass any client validation.

## Failure handling

If a fixture move fails, the run continues with subsequent moves whose parents posted successfully. Moves whose parent failed are skipped or fail with a clear error code in the log. Re-running with the same `client_submission_id`s is safe — `submit-argument` is idempotent.
