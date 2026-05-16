# CDiscourse — Dev Fixture Seeding Plan

_Stage 6.0.3 — 2026-05-16_

This document describes how fixture argument histories can be seeded into a development Supabase project for live testing. No live seeding is implemented in this stage.

---

## What Exists Now (Stage 6.0.3)

- Static JSON fixture scenarios in `fixtures/argument-scenarios/`
- Validation suite in `__tests__/argumentScenarioValidation.test.ts`
- Skills for authoring and counter-testing: `argument-fixture-author`, `argument-counter-runner`
- No live writes — all testing is manual browser flow

---

## Option A: Manual Browser Flow (Current)

Use the fixture JSON as a script. A human performs each move:

1. Sign in as a dev test account.
2. Create an argument room with the fixture resolution.
3. For each move in the scenario:
   - Tap "Start an argument" (root) or "Reply" (non-root).
   - Fill in the body, move kind, axis, evidence as specified in the fixture JSON.
   - Submit through the UI.
4. Record actual vs. expected output in `docs/testing-runs/<date>-<scenario>.md`.

**Pros:** Exercises the real UI. No scripting.  
**Cons:** Slow. Manual. Not repeatable without effort.

---

## Option B: Public-Auth Scripted Flow (Future — not implemented)

A future script signs in test users with known credentials and calls the submit-argument Edge Function path.

Requirements:
- Uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — no service-role key.
- Signs up/in test users with explicit environment variables:
  ```
  CDISCOURSE_TEST_USER_A_EMAIL=<value>
  CDISCOURSE_TEST_USER_A_PASSWORD=<value>
  CDISCOURSE_TEST_USER_B_EMAIL=<value>
  CDISCOURSE_TEST_USER_B_PASSWORD=<value>
  ```
- These values must NEVER be committed to Git.
- Calls `submitArgumentDraft` / Edge Function path for every submission — no direct Postgres inserts.
- Targets the dev Supabase project only.
- Records results in `docs/testing-runs/`.

**Activation:** Requires explicit user approval before implementation.

**What will NOT happen in this script:**
- No service-role key used in the script.
- No bypass of `submit-argument` Edge Function.
- No direct `INSERT INTO arguments` from the client.
- No production data modified.

---

## Option C: Admin Seed (Future — restricted)

A future service-role script could seed data directly. This option:
- Is only allowed to run locally.
- Must never be bundled into the Expo app.
- Must never be committed with secrets.
- Must be clearly marked dev-only with a `--dev-only` flag.
- Requires explicit written approval from the user before implementation.

Not implemented and not planned until Option A and B have been proven insufficient.

---

## Fixture File Location

```
fixtures/argument-scenarios/
  README.md
  sports-play-in.json
  pop-culture-trailers.json
  light-civic-bike-lanes.json
  everyday-remote-work.json
```

Validate before any seeding:
```bash
npm run test -- --testPathPattern=argumentScenarioValidation
```

---

## Testing Run Log Location

```
docs/testing-runs/
  <YYYY-MM-DD>-<scenario-id>.md
```

Each run log must:
- Use aliases only (no real emails or passwords in the file)
- Mark any secret check: "no secrets exposed: yes"
- Record expected vs. actual for each move
