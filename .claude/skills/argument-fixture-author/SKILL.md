---
name: argument-fixture-author
description: Creates safe fixture argument histories for CDiscourse testing. Manual-only. Does not touch production data, real users, or secrets.
disable-model-invocation: true
user-invocable: true
effort: low
---

# Skill: argument-fixture-author

Creates or expands safe, deterministic argument fixture scenarios for CDiscourse testing. All output is static JSON — no live Supabase writes, no auth, no secrets.

## Scope Guards

- Do NOT create real user accounts or emails.
- Do NOT use service-role keys.
- Do NOT call Anthropic.
- Do NOT write to production or staging databases.
- Do NOT commit secrets, passwords, or API keys.
- Do NOT infer winner, truth, bad faith, or manipulation.
- Do NOT use named politicians, real ongoing scandals, medical/legal/financial claims, or protected-class attacks.

## What This Skill Produces

A new or updated JSON file in `fixtures/argument-scenarios/` conforming to the `FixtureScenario` type from `src/features/devFixtures/argumentScenarioTypes.ts`.

## How to Invoke

```
/argument-fixture-author <topic>
```

Example:
```
/argument-fixture-author "College football rankings rely too much on preseason reputation"
```

## Fixture Structure

Each scenario must include:

- **scenarioId** — unique kebab-case string
- **resolution** — the statement being argued
- **category** — `sports | pop_culture | light_civic | everyday`
- **personas** — 2–3 aliases with side and tone (no real names, no emails)
- **moves** — 6–10 moves (see below)
- **notes** — what the scenario exercises

### Required Moves (at least one each)

| moveKind | argumentType | When |
|---|---|---|
| `start_thesis` | thesis | Root only |
| `challenge_parent` | rebuttal / counter_rebuttal | Must have `disagreementAxis` or `qualifierCode` |
| `ask_clarification` | clarification_request | Any level |
| `add_evidence` | evidence | Any level; include `evidence` field |
| `concede_or_narrow` | concession | Include `displayMeta.playfulLabel` |
| `synthesize_thread` | synthesis | Any level |

### Quote Anchors

At least one move must have:
- `targetExcerpt` that appears verbatim in the parent's `body`, OR
- `displayMeta.quoteAnchorCandidate` pointing to a quotable phrase

### Playful Labels

At least one concession move must have `displayMeta.playfulLabel`. Safe options:
- "I'm only MOSTLY wrong about this"
- "Peace treaty-ish"
- "Context goblin defeated"
- "Surrender completely"
- "Receipt accepted"

No hostile copy. Never mock the opponent.

## Safe Topic Categories

**Sports (light, non-gambling)**
- Format changes (play-in, pitch clock, replay rules)
- Scheduling and travel fairness
- Statistical era comparisons
- Defensive vs. offensive styles

**Pop culture**
- Trailer spoilers, remake quality, streaming vs. theatrical
- Album track ordering, genre crossover
- Sequel expectations, franchise fatigue

**Light civic (no named politicians)**
- Local infrastructure (bike lanes, transit, parks)
- Meeting formats (three-minute limit, hybrid attendance)
- Library programming, community event scheduling
- Ranked-choice voting mechanics

**Everyday**
- Remote work, meeting culture, group chats vs. docs
- Coffee shop quiet zones, menu size
- Habit formation, productivity approaches

## Forbidden Content

Do not include in any field:
- Named current politicians or candidates
- Real-world accusations against specific people or organizations
- Medical, legal, or financial advice
- Protected-class identity attacks
- Explicit content, violence, or high-stakes misinformation
- The terms: bad faith, manipulation, liar, dishonest, winner, truth, ban, hide
- Email addresses, passwords, API keys, service-role keys, JWTs

## Validation

After creating a fixture, run:

```bash
npm run test -- --testPathPattern=argumentScenarioValidation
```

All existing and new scenarios must pass with 0 errors.

## Output Checklist

Before handing off the fixture file:

- [ ] scenarioId is unique (check existing files in `fixtures/argument-scenarios/`)
- [ ] 6–10 moves
- [ ] All required move kinds present
- [ ] At least one quote anchor candidate
- [ ] At least one playful concession label
- [ ] All parentMoveId references exist in the move list
- [ ] Challenge moves have disagreementAxis or qualifierCode
- [ ] target excerpts appear verbatim in parent body
- [ ] No forbidden terms
- [ ] No real names, emails, or credentials
- [ ] `npm run test` passes
