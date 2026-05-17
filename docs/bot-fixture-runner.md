# CDiscourse — Bot Fixture Runner

_Stage 6.1.3 — 2026-05-17 (spicy stress-test suite)_

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
  loadEnv.js          — env parsing + validation (pure)
  loadScenario.js     — fixture JSON loader + ordering (pure)
  supabaseClient.js   — anon-key client factory + signInBot
  adminOps.js         — admin-users wrapper (admin JWT)
  submitMove.js       — fixture→submit-argument body builder + error classifier
  writeRunLog.js      — redacted run log writer
  personaMapping.js   — persona side → participant side mapping (pure)
  runScenario.js      — entry point
```

Unit tests: `__tests__/botFixtureRunner.test.ts` (pure helpers only).

## Error classification (Stage 6.1.2.4b)

`submitMove.js` extracts the real HTTP status from `FunctionsHttpError.context.status` — the `error.status` field on supabase-js v2 is undefined, so a previous version mislabeled every real 422 / 403 as `failed_500`. The runner now records:

- `failed_403` for forbidden (with `detail` = `body.reason`)
- `failed_422` for validation_failed (with `detail` = first `blockingErrors[0].ruleCode + message`)
- `failed_500` only for true transport / internal errors
- `skipped_missing_parent` for moves whose parent did not post

`writeRunLog.js` includes a Detail column for at-a-glance diagnosis. JWTs, apikey values, request headers, and emails are never logged.

## Persona → participant side mapping (Stage 6.1.2.4b)

`personaMapping.js` maps the fixture persona's `side` to the participant `side` that satisfies `submit-argument`'s authorization matrix:

| Persona side | Participant side | Why |
|---|---|---|
| affirmative | affirmative | normal |
| negative | negative | normal |
| neutral | moderator | so a third-party synthesizer can post synthesis / cross-side moves; observers may only post neutral `clarification_request` |
| (other) | observer | safe default |

## Fixture authoring rules (informed by 6.1.2.4b)

- **Transitions are enforced server-side.** A child move's `argumentType` must be in the parent's `allowed_reply_types` (see `transition_*` rules in `supabase/migrations/20260516000003_seed_data.sql`). Most notably: `synthesis` can ONLY follow `concession`; `concession` cannot follow `evidence`.
- **Topic satisfaction is lexical.** Each body must share enough unique non-stop tokens with the **resolution** AND with the **parent body** to clear the off-topic threshold (combined = min of the two). Quote a few words from the parent and from the resolution.
- **Concession marker required.** Bodies of `concession` AND `synthesis` arguments must include one of: `i concede`, `i grant`, `i agree with`, `that point is valid`, `you're right`, `fair point`, `i acknowledge`.
- **Runner does NOT pass `scenario.notes` as `debate.description`** — `notes` is test metadata and pollutes the topic-reference token set. Use the optional `debateDescription` field in the scenario JSON for real description text.

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

## Spicy stress-test suite (Stage 6.1.3)

The stress suite extends the per-scenario runner to drive **batches** of generated rooms. The bots run sharper, sarcastic, claim-hostile (never person-hostile) language to exercise the game's transitions, topic-satisfaction, quote anchoring, receipts, concessions, synthesis, and branch recommendations.

### Files

```
scripts/bot-fixtures/
  spicyLanguage.js              — bounded "spicy" phrase pools + forbidden list (pure)
  stressConfig.js               — directory + threshold constants (pure)
  stressScenarioTemplates.js    — 3 templates (12/11/13 moves) + seeded body composer
  generateStressScenarios.js    — CLI: writes deterministic fixture JSON from topic bank
  runStressBatch.js             — CLI: drives generated scenarios end-to-end
```

```
fixtures/argument-scenarios/topicBank.json   — committed source of safe topics (8 categories)
fixtures/generated-scenarios/                — gitignored output of the generator
logs/bot-stress/                             — gitignored JSONL event log per run
docs/testing-runs/<date>-bot-stress-summary.md — committable safe summary
```

### Commands

```bash
npm run bot:fixture:generate-stress   # write 50 deterministic JSON scenarios to fixtures/generated-scenarios/
npm run bot:fixture:stress:dry        # regenerate 10 + validate; NO Supabase calls
npm run bot:fixture:stress:10         # regenerate 10 + run live (auth + submit-argument)
npm run bot:fixture:stress:50         # regenerate 50 + run live (operator confirmation required)
```

The dry mode is the default safe path. The 10- and 50-room live modes use the existing `.env.bot-tests` credentials, reuse the three bot Auth users created by Stage 6.1.2, and never use a service-role key.

### What stress mode is bounded by

- Topics are drawn from `topicBank.json` — no current politicians, no real-person accusations, no medical / legal / financial advice, no protected-class conflict, no sexual / violent / extremist content.
- Bot bodies are composed from `spicyLanguage.js` phrase pools. Forbidden phrases (`liar`, `dishonest`, `bad faith`, `manipulation`, `manipulative`, `you are stupid`, etc.) are asserted absent by `__tests__/stressGenerator.test.ts`.
- Every generated scenario must pass `validateStressScenario` (Constitution transitions, concession markers, forbidden-term scan, 10–15 moves).
- The runner writes only **aliases** to logs — emails / passwords / JWTs / apikey / auth headers / Supabase secrets never reach disk.

### JSONL event schema

Each line in `logs/bot-stress/<runId>-stress.jsonl` is an object with safe fields only:

| Field | Note |
|---|---|
| `ts` | ISO timestamp |
| `runId` | Per-batch identifier |
| `scenarioId`, `category` | Generated scenario identity |
| `roomId` | `debates.id` after creation (UUID, not sensitive) |
| `moveId`, `authorAlias`, `moveKind`, `qualifierCode`, `argumentType`, `parentMoveId`, `parentArgumentId` | Move identity |
| `status`, `httpStatus`, `errorCode`, `errorDetail` | Outcome — `errorDetail` is the first `blockingErrors[0]` rule code + message, or 403 `reason` |
| `argumentId` | Returned `arguments.id` (UUID) on success |
| `bodyLength`, `tagCount`, `hasTargetExcerpt`, `hasEvidence` | Shape stats for tuning |
| `expectedStatus`, `actualStatus`, `durationMs` | Comparison + latency |

### Acceptable 10-room gate

- ≥ 80 % of rooms created
- ≥ 70 % of moves posted
- No `failed_500` unless a true bug is found
- Every `failed_422 / failed_403` has a safe `errorDetail`
- No runner crash; no secrets in logs

Only after this gate is acceptable should an operator run the 50-room batch.

### Do not

- Run `stress:50` without operator confirmation (it creates many Supabase rows).
- Run against production. Use dev / staging only.
- Commit `logs/bot-stress/` or `fixtures/generated-scenarios/` — both are gitignored.
- Add Anthropic, OpenAI, or any model calls.
- Add service-role keys to runner code.
