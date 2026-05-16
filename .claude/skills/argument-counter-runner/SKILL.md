---
name: argument-counter-runner
description: Runs and documents CDiscourse fixture and counter-testing using safe dev-only workflows. Manual-only. Does not use service-role keys in client code.
disable-model-invocation: true
user-invocable: true
effort: low
---

# Skill: argument-counter-runner

Runs a repeatable audit of CDiscourse app behavior using fixture scenarios and records the results in `docs/testing-runs/`. No live Supabase writes in automated steps — all live testing is done manually through the browser.

## Scope Guards

- Do NOT use service-role keys in client code.
- Do NOT create real production users through privileged APIs.
- Do NOT commit `.env`, secrets, passwords, or API keys.
- Do NOT call Anthropic.
- Do NOT bypass `submit-argument` Edge Function.
- Do NOT directly insert `posted` arguments from the client.
- Do NOT put test credentials in Git.
- Do NOT print secrets or JWT values.

## How to Invoke

```
/argument-counter-runner <scenario-id>
```

Example:
```
/argument-counter-runner sports-play-in
```

Or run all:
```
/argument-counter-runner all
```

## What This Skill Does

1. Confirms local baseline is green.
2. Confirms infrastructure is live.
3. Loads the named fixture scenario.
4. Walks through each move in the scenario using the browser (manual step).
5. Records expected vs. actual behavior.
6. Creates or updates `docs/testing-runs/<date>-<scenario-id>.md`.

## Command Order

Run these in sequence before any manual browser testing:

```bash
npm run checkpoint
npm run typecheck
npm run lint
npm run test
npx supabase db push --dry-run
npx supabase functions list
```

Then for visual testing:
```bash
npm run web -- --clear
```

Open http://localhost:8081 — do not edit code while the dev server runs.

## Manual Browser Walk (per move)

For each move in the fixture scenario:

1. Sign in as the persona's test account (use manually created dev accounts — never put credentials in Git).
2. Open the Argument Room or create it if it does not exist.
3. For root moves: tap "Start an argument."
4. For reply moves: tap "Reply" on the parent argument node.
5. In the inline composer:
   - Tap the matching move chip in the Conversation Move Navigator.
   - If challenge: select the disagreement axis shown in the fixture.
   - If evidence: paste the evidence fields from the fixture.
   - Write or paste the body from the fixture.
   - Verify validation preview shows no blocking errors.
   - Tap Submit.
6. Confirm the argument appears in the tree.
7. Record actual vs. expected status.

## Counter-Testing Steps

After submitting all happy-path moves, test the following:

**Invalid move type**
- Try to submit a `synthesis` reply to a `concession` (likely blocked by Constitution).
- Confirm error is shown, draft is preserved.

**Duplicate submission**
- Submit a move, note the `client_submission_id`.
- Re-submit with the same ID.
- Confirm no duplicate argument row appears in the tree.

**Empty body**
- Clear the body field.
- Confirm Submit button is disabled.

**Server 422**
- Intentionally submit a body that is too short (< minimum length).
- Confirm 422 error is displayed, draft preserved.

**Quote anchor check**
- For a challenge move with `targetExcerpt`, paste the excerpt into the target excerpt field.
- Confirm the excerpt appears in the submitted argument node.

## Run Log Format

Create or update `docs/testing-runs/<YYYY-MM-DD>-<scenario-id>.md`:

```markdown
# Testing Run: <scenario-id> — <YYYY-MM-DD>

## Baseline

- npm test: PASS / FAIL — N tests
- typecheck: PASS / FAIL
- lint: PASS / FAIL
- npx supabase db push --dry-run: up to date / pending
- submit-argument: ACTIVE / unknown

## Fixture Scenario

- scenarioId: <id>
- resolution: <resolution>
- moves: N

## Test Users (aliases only — no emails or passwords in this file)

- User A alias: <alias>
- User B alias: <alias>

## Argument Room

- Created: yes / no
- Room ID recorded in run log: yes / no (record ID in run, not in Git)

## Move Results

| moveId | Expected | Actual | Pass |
|---|---|---|---|
| m1 | posted | posted | ✅ |
| m2 | posted | posted | ✅ |

## Counter-Test Results

| Test | Expected | Actual | Pass |
|---|---|---|---|
| Invalid move type | blocked | blocked | ✅ |
| Duplicate submission | no duplicate | no duplicate | ✅ |
| Empty body | submit disabled | submit disabled | ✅ |
| Server 422 | error shown, draft preserved | error shown, draft preserved | ✅ |

## Failures and Patches

List any failures and what was patched.

## Secrets Check

- No secrets exposed in console: yes
- No secrets in this log: yes
- No credentials in Git: yes

## Summary

PASS / FAIL — N moves tested, N counter-tests run.
```

## What Not to Record in the Run Log

- Real email addresses
- Passwords or API keys
- JWT tokens
- Full request headers
- Supabase service-role key or access tokens
- Database IDs that could identify real users

## Fixtures Location

```
fixtures/argument-scenarios/
  sports-play-in.json
  pop-culture-trailers.json
  light-civic-bike-lanes.json
  everyday-remote-work.json
```

Validate before using:
```bash
npm run test -- --testPathPattern=argumentScenarioValidation
```
