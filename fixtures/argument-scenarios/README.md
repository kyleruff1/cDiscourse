# CDiscourse — Argument Fixture Scenarios

Safe, static test scenarios for CDiscourse argument history testing. No secrets, no real user data. Safe to commit.

## Purpose

These JSON files define deterministic argument histories that exercise the full move vocabulary: root thesis, challenge, clarification, evidence, concession, synthesis, quote anchoring, and turn status.

Use them with the `argument-fixture-author` and `argument-counter-runner` Claude Code skills.

## Scenarios

| File | Category | Resolution |
|---|---|---|
| `sports-play-in.json` | sports | NBA play-in tournament and regular season interest |
| `pop-culture-trailers.json` | pop_culture | Movie trailers revealing too much |
| `light-civic-bike-lanes.json` | light_civic | Protected bike lanes in urban corridors |
| `everyday-remote-work.json` | everyday | Remote work and deep-focus task performance |

## Validation

Run validation in tests:

```bash
npm run test -- --testPathPattern=argumentScenarioValidation
```

Or validate from code:

```typescript
import { validateScenario } from '../../src/features/devFixtures/argumentScenarioValidation';
import scenario from './sports-play-in.json';

const errors = validateScenario(scenario);
// errors === [] means valid
```

## Safe Content Rules

Each scenario must:
- Use aliases only — no real names, no emails, no passwords
- Contain 6–10 moves
- Include at least one of each required move kind:
  - `challenge_parent` with `disagreementAxis` or `qualifierCode`
  - `ask_clarification`
  - `add_evidence`
  - `concede_or_narrow`
  - `synthesize_thread`
- Include a quote anchor candidate (target excerpt or displayMeta.quoteAnchorCandidate)
- Include a playful concession label in `displayMeta.playfulLabel`
- Contain no forbidden terms: bad faith, manipulation, liar, dishonest, winner, truth, ban, hide
- Contain no secrets, API keys, emails, passwords

## Adding a New Scenario

1. Copy an existing JSON file as a template.
2. Change `scenarioId` to a unique kebab-case string.
3. Run `npm run test -- --testPathPattern=argumentScenarioValidation` to validate.
4. The test suite will auto-discover new JSON files in this directory.

## What These Are Not

- Not real user data
- Not live test seeds (see `docs/dev-fixture-seeding-plan.md` for the future live seed plan)
- Not Constitution-validated move sequences (live testing via the browser smoke test validates Constitution transitions)
