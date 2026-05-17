# CDiscourse — Bot Engagement Corpus

_Stage 6.1.3.1 — 2026-05-17_

## What this is

A **single Markdown artifact** that captures one bot stress run as a readable conversation corpus, not just a throughput summary. Stage 6.1.3 already proved the bots can post 123/123 moves. Stage 6.1.3.1 asks the next question: **were those moves interesting, specific, traceable, and useful?**

The corpus is meant to be read by a human and reviewed for engagement quality. It is the primary artifact for tuning the bots before any UX work.

## Primary output

```
docs/testing-runs/<YYYY-MM-DD>-bot-engagement-corpus.md       (live run)
docs/testing-runs/<YYYY-MM-DD>-bot-engagement-corpus-dry.md   (dry run)
```

## Optional local-only output

```
logs/bot-stress/<runId>-engagement-corpus.jsonl
```

JSONL is gitignored. Enable with `--write-jsonl`.

## How to run

```bash
npm run bot:fixture:corpus:dry        # 10 scenarios, no Supabase, planned-only corpus
npm run bot:fixture:corpus:10         # 10 scenarios, live, full corpus + summary
npm run bot:fixture:corpus:50         # 50 scenarios, live, full corpus (operator confirmation required)
```

Behind the scenes these invoke `runStressBatch.js --corpus --regenerate --count N [--dry]`.

## What the corpus contains

### Run header
- `runId`, date, mode (`dry` / `live`)
- scenario count, room count, move count
- categories covered, bot personas used
- posted %, failed_422 / failed_403 / failed_500 / skipped counts
- secrets check (always "no" by construction)

### Corpus engagement summary
- Strongest rooms (top 3 by avg score)
- Weakest rooms (bottom 3 by avg score)
- Decision-intent distribution across the whole run
- Notable moments: tangent / branch candidates, hot-spice moves, concessions, evidence drops
- Top-level tuning recommendations

### Per-room transcript
For each of the 10–50 rooms:
- `scenarioId`, `roomId`, `category`, `resolution`, template id, topic id
- Engagement score (average over 8 dimensions)
- Topic hook (alias / side mapping)

### Per-move transcript
For every move:
- `moveId`, `argumentId` (if posted), `moveKind`, `argumentType`
- `disagreementAxis`, `qualifierCode`
- Parent reference + parent excerpt
- `targetExcerpt` if present
- Receipts if present
- Status: `posted (HTTP 201)` / `failed_422` / `failed_403` / `failed_500` / `skipped_missing_parent` / `planned`
- `errorDetail` if non-2xx
- Full body text (redacted)

### Per-move decision trace
- `decisionIntent` — one of: `plant_claim`, `challenge_scope`, `challenge_fact`, `challenge_logic`, `challenge_definition`, `challenge_causal`, `challenge_value`, `challenge_evidence`, `request_receipts`, `quote_exact_bit`, `drop_receipts`, `counterexample`, `concede_small_point`, `narrow_dispute`, `synthesize_thread`, `branch_tangent`
- `spiceLevel`: `mild` / `medium` / `hot`
- `specificity`: `vague` / `medium` / `specific`
- `pressureApplied`: `low` / `medium` / `high`
- `whyThisMove` — one sentence
- `whyThisParent` — one sentence
- `expectedCounter` — one sentence prediction
- `tuningConcern` — optional short note

### Per-room scores (0–5)
- `backAndForthScore` — author alternation rate
- `specificityScore` — average move specificity
- `personaDistinctnessScore` — count of distinct authors
- `evidenceUseScore` — evidence moves + receipt demands
- `concessionQualityScore` — concession + synthesis presence
- `tangentControlScore` — branch candidate present
- `funScore` — hot-spice density
- `traceabilityScore` — child bodies overlap parents

These are internal heuristics, not objective truth. They exist to flag tuning opportunities, not to grade arguments.

## Safety invariants

- No Anthropic call. No OpenAI call. No model call.
- No service-role key.
- No bypass of `submit-argument` — live mode still goes through normal Supabase auth + Edge Function.
- Redactor strips: email addresses, JWT-shape tokens (`eyJ...`), Supabase secret keys (`sb_secret_...`), Anthropic-shape keys (`sk-ant-...`, `sk-...`), and `password=...` lines.
- Forbidden phrases (`liar`, `dishonest`, `bad faith`, `manipulation`, `manipulative`, `you are stupid`, `winner`, `loser`) are asserted absent by `__tests__/engagementCorpus.test.ts`.

## Spice / tone rule

The corpus may be sharp, sarcastic, skeptical, overconfident, and adversarial **toward the move, claim, scope, evidence, or logic**. It must never be personal. Allowed lines include _"That sounds like a dodge."_, _"That's a vibes-only claim."_, _"Receipts, please."_, _"Wrong scope."_, _"This tangent wants its own room."_, _"I'll surrender the small point, not the whole war."_

Forbidden: any phrasing that calls a counterpart a liar / dishonest / bad-faith / manipulator, any protected-class attack, threats, doxxing, sexual content, real-person accusations, or a declared system winner / loser / truth.

## When to use this

- After running `stress:10` to validate volume, run `corpus:dry` (no Supabase writes) to inspect generated language quality first.
- Once `corpus:dry` reads well, run `corpus:10` and review the Markdown.
- Only run `corpus:50` after the 10-room corpus reads usefully. It creates 50 rooms and ~600 arguments in your dev Supabase project.

## When not to use this

- Not against production Supabase. Dev only.
- Not as production user content. Bots are test personas.
- Not as a UX evaluation. This is fixture data — it tells you whether the rails and language pools produce engaging conversation; it does not measure real users.

See also: `docs/bot-fixture-runner.md`, `docs/bot-topic-bank.md`, `.claude/skills/bot-provocateur/SKILL.md`, `.claude/skills/bot-revocateur/SKILL.md`.
