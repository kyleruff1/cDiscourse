# CDiscourse — Open-Room Engagement Runner

_Stage 6.5 — 2026-05-18_

## What this is

A dev/test bot runner that walks **existing** open CDiscourse rooms,
classifies each one with the deterministic **open-room HOT model**, and
has the `bot-revocateur` / `bot-provocateur` skills take alternating
turns until the room reaches a target depth, hits a concession marker,
or fails three submits in a row.

The point is to turn previously-quiet rooms into rooms with real
argumentative friction — _not_ to boost engagement counts.

> **HOT means activity / friction / unresolved argumentative pressure.**
> **HOT does NOT mean popularity, virality, truth credit, or abuse.**
> Engagement is never converted into factual standing. Popularity is
> not evidence.

## Files

| File | Purpose |
| --- | --- |
| `scripts/bot-fixtures/openRoomHeatModel.js` | Pure deterministic HOT classifier. Inputs: messages + bot user IDs + nowMs. Outputs: heat band, score, reason codes, recommended bot, recommended action, target move id + excerpt, safeToPost. No network. |
| `scripts/bot-fixtures/openRoomEngagementMoveRenderer.js` | Heat-aware Anthropic move renderer. System prompt wraps the full skill body verbatim + HOT context (band, reason codes, recommended action, recent axes). Strict JSON output (`body / disagreementAxis / mechanism / targetExcerpt`). 2 retries → deterministic fallback that never violates the validators. |
| `scripts/bot-fixtures/runOpenRoomEngagementBots.js` | Orchestrator. Discovers eligible rooms, classifies + sorts by heat, picks a bot seat-pair whose post-sides will be opposite (fixed + fixed → flex + fixed → fully unjoined), submits via `submit-argument`, writes JSONL + Markdown. |
| `.claude/skills/bot-provocateur/SKILL.md` | Contains a `## Dynamic room engagement mode` section that names heat reason codes, the "HOT does not mean rude" rule, axis-rotation guidance, and "do not keyword-stuff". |
| `.claude/skills/bot-revocateur/SKILL.md` | Mirrors the dynamic-engagement section with revocateur-specific bias toward first-rebuttal and source-chain pressure. |
| `scripts/skills/validateBotSkills.js` | Skill gate validator. Requires the new content markers (`dynamic room engagement mode`, `heat reason codes`, `hot does not mean rude`, `avoid repeating the same axis`, `do not keyword-stuff`). |

## How to run

```bash
# Dry mode — no Anthropic, no Supabase. Validates wiring + writes the
# JSONL skeleton and a setup-only Markdown.
npm run bot:engage:open:dry

# Tiny live pilot — up to 10 rooms, 8-12 target moves, 10% coverage.
# Requires: .env.engagement-intelligence with ANTHROPIC_API_KEY +
# ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true + .env.bot-tests + --pilot.
npm run bot:engage:open:tiny
```

CLI flags (full):

```
--dry                       (default) no network calls
--pilot                     enable live mode; requires env gates
--max-rooms <N>             cap selected rooms (default 20)
--target-min-moves <N>      target total move count floor (default 8)
--target-max-moves <N>      target total move count ceiling (default 12)
--target-coverage <pct|frac> portion of eligible rooms to consider; accepts 10 or 0.10 (default 100)
--max-moves-per-room <N>    per-room cap (default 6)
--max-moves-total <N>       global cap (default 200)
--seed <string>             deterministic per-room move-count RNG
```

## Outputs

- **JSONL** (gitignored): `logs/engagement-intelligence/<runId>-open-room-engagement.jsonl`
- **Markdown** (committable): `docs/testing-runs/<YYYY-MM-DD>-open-room-engagement-summary.md`

### JSONL event types

| Stage | Purpose |
| --- | --- |
| `run_start` | CLI args + env booleans (no values logged) |
| `skill_validation` | Skill hashes + validated flag |
| `room_candidate` | Every classified room (band, score, reason codes, recommended bot/action) |
| `room_scan` | Aggregate eligible count |
| `bot_assignment` | The recommended bot per selected room |
| `room_selected` | A room enters the engagement loop |
| `bot_assignment_resolved` | Final seat pair (provoSide / revSide / seat kinds) |
| `room_skipped` | Skip reason (`bots_on_same_side`, `not_enough_bots`, `no_opposite_side_pair_available`, `room_join_failed`) |
| `move_prompt_built` | Renderer call about to run (heat band + reason codes stamped) |
| `move_rendered` | Renderer result (source, attempts, axis, mechanism, axisRepeatHit) |
| `move_validated` | Post-render validator pass/fail |
| `submit_attempt` | Outgoing `submit-argument` call |
| `submit_result` | `posted` (with argument id + axis) or `rejected` (HTTP status + safe detail) |
| `room_heat_update` | Posted axis appended; `postedAxesAfter` snapshot |
| `room_summary` | Per-room totals + initial/final heat band |
| `run_summary` | Aggregate run totals: reasonCodeCounts, axisCounts, bandTransitions, anthropicUsage |

## Hard rules (all enforced in source + tests)

- **All posts route through `submit-argument`.** No `service-role` key.
  No `.from('arguments').insert(...)`. The Edge Function fires its own
  RLS / audit / topic-satisfaction pass.
- **Never logs** Anthropic / xAI / Supabase keys, Bearer tokens,
  Authorization headers, JWTs, raw X handles, raw URLs, raw post IDs,
  raw emails, or raw abusive bodies. Source files are scanned in the
  test suite for these shapes.
- **No bot pretends to be a real X user.** The skill bodies enforce the
  test-bot identity disclaimer; the renderer rejects bodies that try to
  claim a real biography.
- **No speaker labels.** Forbidden user labels (liar, dishonest,
  bad faith, manipulative, extremist, propagandist, troll, bot,
  astroturfer) trigger validation failure → retry → deterministic
  fallback.
- **No banned canned phrases.** Same enforcement path.
- **HOT is never converted to truth credit.** Popularity / virality /
  repetition is not evidence. The skill prompts repeat this every
  time the runner builds a system prompt.
- **No production app call.** This runner is dev/test only. The
  production app must never invoke Anthropic, xAI, or this runner.

## Heat reason codes catalogue

`no_rebuttal · unreplied_latest · source_chain_debt · evidence_debt ·
scope_fight · definition_fight · logic_fight · causal_fight ·
recent_activity · stale_but_promising · max_depth_unresolved ·
needs_concession_or_synthesis`

## Recommended-action catalogue

`first_rebuttal · source_chain_pressure · ask_quote · narrow_scope ·
countermechanism · defend_root · concede_narrow · synthesis_attempt ·
branch_recommendation`

## Heat bands

`quiet · warming · hot · overheated`

- `overheated` short-circuits to skip (abusive latest message).
- `quiet` rooms with `moveCount === 0` are not engageable.

## Anti-amplification doctrine in the prompt

Every system prompt the runner sends to Anthropic restates:

> Popularity is not evidence. Repetition is not evidence. Engagement
> velocity is not evidence. Political identity is not evidence. HOT
> does not mean rude — it means sharper unresolved argument friction.

The deterministic fallback bodies are written to be safe against this
doctrine: they call out missing primary sources, name a mechanism, and
ask for receipts rather than asserting a claim is "popular".
