---
name: bot-revocateur
description: Manual-only CDiscourse testing bot skill for refuting, challenging, narrowing, and counter-testing safe argument-room histories.
disable-model-invocation: true
invocation: user
user-invocable: true
effort: low
---

# Skill: bot-revocateur

The "revocateur" half of the CDiscourse bot-testing pair. Takes an existing opening (typically from `bot-provocateur`) and adds the **response** moves: challenges, clarification requests, evidence rebuttals, concessions, and synthesis. Also generates counter-test cases that exercise the app's Constitution rules and `submit-argument` Edge Function under stress.

All output is static fixture JSON. No live Supabase writes, no auth, no Anthropic calls, no secrets.

## When to use

- You have a fixture scenario with only opening moves and want to round it out into a 6–10 move complete history.
- You want to generate counter-test cases (invalid moves, missing target excerpts, weak topic responses) to verify deterministic validation.
- You want to inspect how the timeline/track view handles tangents — produce a branch-worthy reply.

## Hard scope guards

- Do NOT create real user accounts or use real emails.
- Do NOT use service-role keys.
- Do NOT call Anthropic.
- Do NOT write to production, staging, or local Supabase databases directly.
- Do NOT commit secrets, passwords, JWTs, or API keys.
- Do NOT infer winner, loser, truth, bad faith, manipulation, or user intent in fixture content.
- Do NOT mock the opponent. Concessions must be self-directed ("I'm only mostly wrong" — never "you were right all along, sucker").
- Do NOT use named politicians, real ongoing scandals, medical/legal/financial advice, or protected-class attacks.

## How to invoke

```
/bot-revocateur <scenario-id-or-path>
```

Examples:

```
/bot-revocateur sports-play-in
/bot-revocateur fixtures/argument-scenarios/sports-play-in.json
/bot-revocateur new-pop-culture-trailers
```

If the scenario does not yet exist, the skill will report what `bot-provocateur` should produce first.

## What this skill produces

Updates an existing JSON file in `fixtures/argument-scenarios/`, conforming to the `FixtureScenario` type, by appending response moves:

| Move kind | Required | Notes |
|---|---|---|
| `challenge_parent` | yes | Must have `disagreementAxis` OR `qualifierCode` |
| `ask_clarification` | yes | Question targeting the parent's framing |
| `add_evidence` (rebuttal evidence) | optional | Receipts undermining the parent's claim |
| `concede_or_narrow` | yes | With `displayMeta.playfulLabel` |
| `synthesize_thread` | yes | Wraps a sub-thread with a shared takeaway |

Final scenario must total 6–10 moves.

## Disagreement axes (use one per challenge)

- `fact` — factual accuracy
- `definition` — what does the claim's key term actually mean?
- `causal` — does A really cause B?
- `value` — different priority/value system
- `evidence` — the source doesn't support the claim
- `logic` — the inference doesn't follow
- `scope` — claim is true narrowly but doesn't generalize

## Playful concession labels (pick one per concession)

- "I'm only MOSTLY wrong about this"
- "Peace treaty-ish"
- "Context goblin defeated"
- "Surrender completely"
- "Receipt accepted"
- "Mostly wrong, partly right"
- "Argument got smaller"

Never mock the opponent. Concession is self-directed.

## Quote anchoring

For at least one challenge, include a `targetExcerpt` that appears **verbatim** in the parent's body. This exercises the quote-anchor UI in the Argument Room and the deterministic Constitution check.

## Counter-test variants

If asked to produce counter-tests (`/bot-revocateur <scenario> --counter-tests`), include scenarios that intentionally exercise:

| Test | What it checks |
|---|---|
| `targetExcerpt` not in parent body | submit-argument server validation rejects |
| `challenge_parent` without disagreementAxis or qualifier | composer client validation flags |
| `concession` reply to a parent that is itself a `concession` | Constitution transition rules |
| evidence move with empty `attached_evidence` | composer validation |
| off-topic reply (deliberately tangential body) | weak topic flag, branch suggestion |

These counter-test moves must be marked clearly in the fixture's `notes` field so the runner and human reviewer know they are expected to fail.

## Forbidden content

Same list as `bot-provocateur`:

- Named current politicians or candidates
- Real-world accusations against specific people or organizations
- Medical, legal, or financial advice framed as recommendations
- Protected-class identity attacks
- Explicit content, violence, or high-stakes misinformation
- The terms: bad faith, manipulation, liar, dishonest, winner (as system verdict), truth (as system verdict), ban, hide
- Email addresses, passwords, API keys, service-role keys, JWTs

## Output checklist

Before saving the fixture:

- [ ] All `parentMoveId` references resolve to existing move ids
- [ ] Total move count is 6–10
- [ ] At least one `challenge_parent` with `disagreementAxis` or `qualifierCode`
- [ ] At least one `ask_clarification`
- [ ] At least one `concede_or_narrow` with `displayMeta.playfulLabel`
- [ ] At least one `synthesize_thread`
- [ ] At least one `targetExcerpt` that appears verbatim in the parent's body
- [ ] No forbidden terms anywhere
- [ ] No real names, emails, or credentials
- [ ] `npm run test -- --testPathPattern=argumentScenarioValidation` passes

## Running the result

Once the fixture is complete, drive it end-to-end via the dev runner:

```bash
npm run bot:fixture <scenario-id>
```

The runner signs in real bot Auth users (created via `admin-users.create_bot_user`) and submits each move through `submit-argument`. A redacted run log lands in `docs/testing-runs/<date>-<scenario>.md`. See `docs/bot-fixture-runner.md`.

## What this skill does NOT do

- Run automation (the bot fixture runner does that)
- Submit to Supabase (no auth, no Edge Function calls)
- Decide who is right
- Generate hostile or insulting copy
- Bypass `submit-argument`
