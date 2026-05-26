# MCP-021 Track Sequencing Decision

**Date:** 2026-05-26
**Author:** Operator
**Status:** Binding for MCP-021B and MCP-021C card design

## Decision

MCP-021B (persistence) ships before MCP-021C (live MCP execution).

## Reasoning

The product goal for the MCP track is durable, shared, reload-surviving
node labels. Machine Observations from future live MCP classifier runs
must be visible to authorized room participants and must survive reload.

Live MCP execution without persistence would produce ephemeral or
local-only classifier results. That fails the product goal.

Persistence-first means:

1. MCP-021B can ship safely without any live AI/MCP call. It owns
   schema, RLS, query helpers, row validation, and Source 6
   persisted-row adapter wiring.
2. MCP-021B's persistence layer can be seeded manually for smoke
   testing before MCP-021C wires the live execution path.
3. MCP-021C can be designed against a known persistence shape instead
   of racing schema, RLS, transport, retry, validation, and rendering
   at the same time.

## Chosen persistence direction

MCP-021B uses a runs + results split:

- `argument_machine_observation_runs` records one classifier run per
  argument / family batch / schema version.
- `argument_machine_observation_results` records positive observations
  only.

This is preferred over a single table with `present boolean` because:

- Failed and fallback runs can be recorded without polluting positive
  result rows.
- Positive-only rows avoid storing 172 false rows per argument.
- MCP-021C can write one run row plus N positive result rows in a
  transaction.
- Reviewers can distinguish "not present" from "not evaluated" by
  inspecting run status.

## Non-decisions

This document does NOT decide:

- Exact SQL implementation details.
- Exact RLS predicate text if existing project visibility helpers
  require a different spelling.
- Whether MCP-021C runs all 10 families in its first live pass.
- Whether MCP-021C starts with a one-family presmoke first.

Those are designer-phase decisions for MCP-021B / MCP-021C,
constrained by this sequencing decision.

## Out of scope for MCP-021B

- No live MCP call.
- No new AI provider path.
- No new taxonomy key.
- No new visual primitive.
- No new design token.
- No display cap change.
- No User Allegation modification.
- No raw internal key rendered in UI.
- No client-JWT writes to classifier result tables.

## Required follow-up after MCP-021B

After MCP-021B merges, run a persisted-label smoke:

1. Seed 5-10 fake persisted Machine Observation result rows via
   service-role SQL against the bot-seeded rooms.
2. Verify Source 6 adapter consumes them.
3. Verify Timeline still caps at 1 Machine Observation + 1 User
   Allegation + overflow.
4. Verify Selected Context still caps at 3 Machine Observations + 3
   User Allegations + overflow.
5. Verify Inspect remains grouped and unbounded.
6. Verify reload preserves persisted Machine Observations.
7. Verify second-account visibility follows RLS.

## Required follow-up before full MCP-021C

Before full live MCP execution, run MCP-021C-PRESMOKE:

1. Call live MCP for one small family only.
2. Validate exact schema version.
3. Require confidence on every positive flag.
4. Discard unknown rawKey silently.
5. Assert malformed output emits zero observations.
6. Do not launch full MCP-021C until at least one family returns valid
   schema-shaped output.
