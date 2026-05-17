---
name: bot-provocateur
description: Manual-only CDiscourse testing bot skill for creating safe argument-room claims, opening moves, receipts, and fixture histories.
disable-model-invocation: true
invocation: user
user-invocable: true
effort: low
---

# Skill: bot-provocateur

The "provocateur" half of the CDiscourse bot-testing pair. Creates safe argument-room **openings**: the initial claim, the obvious counter, supporting receipts, and a complete opening sequence that another bot (`bot-revocateur`) can then refute, narrow, or synthesize.

All output is static fixture JSON. No live Supabase writes, no auth, no Anthropic calls, no secrets.

## When to use

- You want a new fixture scenario for the bot fixture runner (`npm run bot:fixture`).
- You want to expand an existing scenario with extra opening moves before challenges arrive.
- You want a "first 3 moves" stub for manual UX testing in the Argument Room.

## Hard scope guards

- Do NOT create real user accounts or use real emails.
- Do NOT use service-role keys.
- Do NOT call Anthropic.
- Do NOT write to production, staging, or local Supabase databases directly.
- Do NOT commit secrets, passwords, JWTs, or API keys.
- Do NOT infer winner, loser, truth, bad faith, manipulation, or user intent.
- Do NOT use named politicians, real ongoing scandals, medical/legal/financial advice, or protected-class attacks.

## How to invoke

```
/bot-provocateur <topic-or-claim>
```

Examples:

```
/bot-provocateur "Pitch clock makes baseball more watchable"
/bot-provocateur "Group chats are worse than shared docs for engineering decisions"
/bot-provocateur "Library hours should extend later for evening commuters"
```

## What this skill produces

A new or updated JSON file in `fixtures/argument-scenarios/` conforming to the `FixtureScenario` type from `src/features/devFixtures/argumentScenarioTypes.ts`.

The output focuses on the **opening** of the exchange:

| Move kind | Required | Notes |
|---|---|---|
| `start_thesis` | yes (root) | The provocateur's main claim |
| `make_claim` (optional follow-up) | optional | Tee up the obvious counter as a secondary claim |
| `add_evidence` | yes | At least one receipt supporting the thesis |

The provocateur does NOT produce the challenges, concessions, or synthesis — that's `bot-revocateur`'s job. A complete scenario combines both.

## Safe topic categories

| Category | Examples |
|---|---|
| `sports` | Format changes, scheduling, stat-era comparisons (no gambling lines) |
| `pop_culture` | Trailers, streaming vs. theatrical, album track ordering |
| `light_civic` | Bike lanes, library hours, meeting formats (no named politicians) |
| `everyday` | Remote work, coffee shop quiet zones, productivity habits |

## Forbidden content

- Named current politicians or candidates
- Real-world accusations against specific people or organizations
- Medical, legal, or financial advice framed as recommendations
- Protected-class identity attacks
- Explicit content, violence, or high-stakes misinformation
- The terms: bad faith, manipulation, liar, dishonest, winner (as system verdict), truth (as system verdict), ban, hide
- Email addresses, passwords, API keys, service-role keys, JWTs

## Output checklist

Before saving the fixture:

- [ ] `scenarioId` is unique (check existing files in `fixtures/argument-scenarios/`)
- [ ] Root move is exactly one `start_thesis` with `parentMoveId: null`
- [ ] At least one `add_evidence` move with a non-null `evidence` field
- [ ] At least one `displayMeta.quoteAnchorCandidate` somewhere in the opening
- [ ] All `targetExcerpt` strings appear verbatim in the parent's body
- [ ] No forbidden terms anywhere
- [ ] No real names, emails, or credentials
- [ ] `npm run test -- --testPathPattern=argumentScenarioValidation` passes

## Handoff to bot-revocateur

After producing an opening, hand off to `bot-revocateur` to add:
- A `challenge_parent` with disagreement axis
- A `clarification_request`
- A `concession` with a playful label
- A `synthesis`

Together they form a complete fixture that `npm run bot:fixture` can drive end-to-end.

## What this skill does NOT do

- Run automation (the bot fixture runner does that)
- Submit to Supabase (no auth, no Edge Function calls)
- Decide who is right
- Generate hostile or insulting copy

## Spicy Stress-Test Mode (Stage 6.1.3)

The bots are **test personas, not humans**. In stress-test mode the provocateur may be sharp, sarcastic, overconfident, and annoying about claims. The goal is to generate a varied corpus of arguments that exercises the game's transitions, topic-satisfaction, quote anchoring, receipt requests, concessions, synthesis, and branch recommendations.

**Rule of thumb:** _attack the move, not the person._

The provocateur **may**:
- Plant deliberately spicy but safe root claims (animal-taxonomy hot takes, sports / pop-culture / food / design takes).
- Make intentionally overbroad claims so the revocateur has obvious targets.
- Tee up "the obvious counter" as a hook for the next move.
- Drop receipt-light openers that invite source demands.
- Add intentionally weak examples to test rebuttals.
- Plant tangent hooks ("This deserves its own thread") to test branch recommendations.
- Use sharp openers like "Hot take incoming.", "I'm planting the flag.", "This claim is spicy but testable."

The provocateur **must not**:
- Make protected-class attacks, slurs, threats, doxxing, or sexual remarks.
- Accuse the counterpart of lying, dishonesty, bad faith, or manipulation as fact.
- Use the words `liar`, `dishonest`, `bad faith`, `manipulative`, `manipulation`.
- Declare a system winner / loser / objective truth.
- Use named current politicians, real ongoing public scandals, or accusations against private people.
- Use medical / legal / financial high-stakes claims as topics.
- Attack the person; only attack the move.

### Allowed safe topic categories (stress mode)

`animal_taxonomy_weird`, `sports_hot_takes`, `pop_culture_hot_takes`, `everyday_absurd`, `light_civic`, `technology_everyday`, `food_low_stakes`, `design_product`. See `docs/bot-topic-bank.md` and `fixtures/argument-scenarios/topicBank.json` for the canonical list and example resolutions.

### Stress-test deliverables

In stress mode the provocateur produces deterministic fixture JSON — no Supabase calls. The stress generator (`scripts/bot-fixtures/generateStressScenarios.js`) renders templates from the topic bank. The stress batch runner (`scripts/bot-fixtures/runStressBatch.js`) drives generated fixtures end-to-end through normal Supabase auth + `submit-argument`. Full event logs land in `logs/bot-stress/` (gitignored); a safe `docs/testing-runs/<date>-bot-stress-summary.md` is committable.
