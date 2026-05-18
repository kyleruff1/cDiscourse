---
name: cdiscourse-doctrine
description: Universal CDiscourse product + safety doctrine. Invoke for ANY code or doc change in this repo — it carries the non-negotiable rules about truth/heat/popularity, AI moderation limits, secrets policy, and what v1 will not build. Read this before designing or implementing any roadmap card.
---

# CDiscourse doctrine — non-negotiable

These rules apply to every file you write, every API surface you design, every test you add. Violating any of them is a blocker, not a comment.

## 1. Score is gameplay analysis, never truth

- The app **never** labels a person, post, or claim as "winner", "loser", "correct", "true", "false", "liar", "dishonest", "bad faith", "manipulative", "extremist", "propagandist", "stupid", "idiot".
- Strength bands ("Strongly supported", "Needs work", etc.) describe a **point's standing in the game**, not its objective truth.
- Score never blocks posting. Validation can block, score cannot.
- Topic-fit, source-chain, scope risk, anti-amplification — all advisory, surfaced as suggested moves, not verdicts.

## 2. Heat means activity / friction

- "Hot" = recent move count, unresolved axes, branch depth, no-rebuttal pressure.
- "Hot" does NOT mean correct, popular, important, or trending.
- Copy must distinguish: heat ≠ truth, heat ≠ consensus.

## 3. Popularity is not evidence

- High engagement, retweet count, view count, follower count, virality — none of these grant a claim factual standing.
- The anti-amplification module (`src/features/pointStanding/antiAmplification.ts`) is the authoritative deterministic gate; preserve its semantics.
- Engagement credit and factual-standing eligibility are SEPARATE scores. Amplification can earn engagement credit while factual-standing gain is suppressed until evidence arrives.

## 4. AI moderator hard limits

The AI moderator **must not**:
- Decide who is right or wrong in a debate.
- Delete, hide, or modify any user content automatically.
- Assign a truth value to a claim.
- Return authoritative flags (`authoritative` must always be `false` for AI-sourced flags).
- Run on the client. AI calls happen only in Supabase Edge Functions.

The AI moderator **may**:
- Assess topic relevance (is this argument on-topic to the resolution?).
- Assess type fit (does the body match the declared argument type?).
- Suggest tags (user must confirm).
- Summarize subtrees when requested (user must edit and submit).

## 5. The rules engine is sacred

`src/lib/constitution/engine.ts` must remain:
- Pure TypeScript — no imports from Supabase, React, or any network library.
- Side-effect free — no mutations, no async.
- JSON-serializable inputs/outputs — so it runs identically on client and in Edge Functions.

Never add network calls or React hooks to the engine. If you need to fetch a constitution, do it outside the engine and pass the loaded value in.

## 6. Secrets policy

| Key | Where it lives | Never in |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` (client) | git |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` (client) | git |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets (Edge Functions only) | client code, git |
| `ANTHROPIC_API_KEY` | Supabase secrets (Edge Functions only) | client code, git |
| `XAI_API_KEY`, `X_BEARER_TOKEN` | `.env.engagement-intelligence` (operator-gated only) | client code, git |

Before any commit:
```
grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/   # zero matches
```

`.env.example` contains only key names with empty values; safe to commit.

## 7. No AI calls from the production app

Production app (everything under `app/` and `src/` outside `scripts/bot-fixtures/`) must NOT call Anthropic, xAI, X API, or any external AI provider. The **only** narrow exception is `scripts/bot-fixtures/` runners gated by `.env.engagement-intelligence` + `--pilot` flag + explicit env flags.

## 8. Supabase conventions

- All tables have RLS enabled. Never disable RLS on any table.
- Migrations are numbered sequentially. Never edit an applied migration — write a new one.
- Constitution versions: written only by service role; never mutated after insert.
- `flags` rows: never deleted — only dismissed.
- `arguments` rows: never hard-deleted — soft-delete via `is_deleted = true`. Deletion is a *request*, processed by an admin via `request-argument-deletion` Edge Function.

## 9. Plain language for users

- Internal validation codes (`source_chain_lexical`, `topic_satisfaction_lexical`, `anti_amplification`, etc.) must NEVER appear in user-facing strings.
- Map every code through `gameCopy.toPlainLanguage`. Unknown codes are suppressed, not echoed.
- This is enforced by tests — adding a new code without updating the mapping is a test failure.

## 10. v1 scope guards — DO NOT BUILD

- No voting or scoring system that produces a winner.
- No real-time collaborative editing of argument bodies.
- No OAuth / social login (email+password only in v1).
- No public API.
- No push notifications.
- No argument search.

If a roadmap card or user request describes one of these, flag it as v2 and do not implement.

## How to apply when designing/implementing a card

1. Read CLAUDE.md for stage status.
2. Skim relevant existing docs in `docs/` (the doc index is at the top of CLAUDE.md).
3. Before writing code, verify your design respects all 10 rules above.
4. If a rule conflicts with the card's stated goal, STOP and surface the conflict.
