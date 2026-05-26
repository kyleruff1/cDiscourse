# MCP-021C Edge Runtime Pivot Decision

**Date:** 2026-05-26
**Author:** Operator
**Status:** Binding for MCP-021C-EDGE

## Decision

The MCP-021C live Boolean Observation path must be implemented as a
server-side Supabase Edge Function path, not as a client-side provider.

The earlier MCP-021C-PRESMOKE concept is superseded.

## Reason

Pre-flight verification on the MCP-021C-PRESMOKE attempt found:

1. MCP-018 already shipped a working server-side Deno MCP adapter at
   `supabase/functions/_shared/semanticReferee/mcpAdapter.ts`. It calls
   `classify_semantic_move` (returns `SemanticRefereePacket`).
2. The MCP `mcp` slot is NOT dormant for boolean observations —
   there is NO existing wiring at all for the
   `McpBooleanObservationResponse` shape.
3. MCP credentials are server-only Supabase function secrets:
   `SEMANTIC_REFEREE_MCP_URL` + `SEMANTIC_REFEREE_MCP_TOKEN` are read
   via `Deno.env.get()`. They are NEVER `EXPO_PUBLIC_*`-prefixed.
   They NEVER appear in `app/` or `src/`. (MCP-018 runbook line 61;
   `CLAUDE.md` Security; `cdiscourse-doctrine §7`.)
4. MCP-021A's `mcpBooleanObservationSchema.ts` line 6 explicitly
   states: "The wire layer (transport, retry, batching, real
   sanitization) is MCP-021C territory; this file defines the
   TYPE-LEVEL contract + 4 pure validators." Line 10: "no AI calls
   from the production app (validators are pure-TS; no fetch / XHR /
   HTTP-client import)."

Client-side MCP calls would violate the security boundary. The
scalable path is server-side.

## Scalable model

MCP-021C-EDGE ships a family-sharded classifier runtime:

- `requested_families[]` controls which families are called
- Family A is production-enabled first
- Families B-J remain disabled for production until separately
  validated
- Admin validation mode can run any family without enabling it for
  production
- Future family additions do not require a new runtime architecture

The track sequence becomes:
MCP-021A      = vocabulary + schema + parser            [shipped]
MCP-021B      = persistence + RLS + Source 6 adapter    [shipped]
MCP-021C-EDGE = server-side live classifier execution   [this card]
MCP-021C-EDGE-SMOKE
= operator-run post-merge admin validation [post-merge audit]
MCP-021C-FAMILY-B
= enable disagreement_axis family          [future card]
MCP-021C-AUTO-TRIGGER
= async trigger after argument post        [future card]
MCP-021C-FAMILY-D/E/F
= enable evidence/scheme/critical-question [future cards]
MCP-021C-OPS-DASHBOARD
= admin view: run status, pass rate, etc.  [future card]

## PRESMOKE replacement

The old one-off PRESMOKE concept becomes an admin validation mode
inside the Edge Function.

Admin validation mode:
- Calls selected family/families against selected argument ids
- Validates output against MCP-021A schema
- Records run diagnostics with `run_mode = 'admin_validation'`
- May write positive result rows for diagnostic purposes
- Source 6 filters admin-validation rows out of production rendering
- Does not enable a family for production automatically

## Binding constraints

- No client-side AI/MCP calls
- No EXPO_PUBLIC MCP server URL
- No MCP token in app or client code
- No new taxonomy key in MCP-021C-EDGE
- No display cap change
- No new visual primitive or design token
- No adaptive parser that weakens MCP-021A schema
- No production enablement for families B-J in the first ship

## Initial production enablement

Family A (`parent_relation`) only.

Family A is selected first because it is low doctrine risk,
concrete, parent-relative, and already represented by strong
MCP-021A definitions with positiveExamples + negativeExamples
+ falsePositiveGuards on every entry.

## EDGE-SMOKE clarification

MCP-021C-EDGE-SMOKE is NOT a separate pipeline card. It is an
operator-run post-merge audit, matching the MCP-021B persisted-label
smoke pattern. After MCP-021C-EDGE merges and the Edge Function is
deployed, the operator runs admin validation mode against the three
fixture moves, then commits an audit doc at
`docs/audits/MCP-021C-EDGE-admin-validation-<date>.md`. No code lands
during EDGE-SMOKE unless the audit fails and a follow-up fix card is
filed.
