# MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET — Family-I Edge mixed-source admin_validation bridge

**Status:** Implemented
**Date:** 2026-06-07
**Epic:** Epic 12 / MCP semantic-referee track (MCP-021A family-ship arc)
**Release:** Edge-subset follow-up to `MCP-SERVER-010-FAMILY-I` (#392). Mirrors the
`MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET` (#355) follow-up that was distinct from the
G server card (#354), and the Family-D subset before it.
**Branch:** `feat/mcp-server-010a-family-i-edge-subset` (off `main` @ `0e7dfd6`)
**Predecessor (verified):** Family-I admin_validation classifier shipped on the hosted
MCP server — #392 PR #546 merged `4b9dabd`; hosted Deno smoke 25/25 (Family-I checks
24/25 `family-i-v1`), recorded on issue #392. The hosted MCP server already supports
the 6 `thread_topology` `ai_classifier` keys.

---

## Goal (one paragraph)

Make the Edge `admin_validation` path aware of the hosted MCP `thread_topology`
(Family I) classifier's **6-key `ai_classifier` scope**, so that Family-I
admin_validation requests stop failing closed with `mcp_validation_failed`. This card
adds exactly **one entry** to the `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` source-type
allowlist in `booleanObservationRequestBuilder.ts`, byte-mirroring the Family D
(`evidence_source_chain`) and Family G (`resolution_progress`) entries. It does **NOT**
enable production, does **NOT** touch `familyRegistry.ts` (no `productionEnabled` flip),
does **NOT** change `mcp-server/` (the server already supports the 6 keys — proven by
the #392 smoke), writes **NO** migration, and changes **NO** prompt/boolean/schema.

---

## Mechanism

### The fail-closed state (before this card)

`thread_topology` is a **mixed-source** family. Per the upstream taxonomy
(`supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyI.ts`),
its 21 keys split:

| Source | Count | rawKeys |
| --- | --- | --- |
| `auto_metadata` | 8 | `has_reply`, `participant_skipped_node`, `no_response_after_n_turns`, `repeated_axis_pressure`, `splits_thread`, `merges_thread`, `references_sibling_node`, `references_ancestor_node` |
| `lifecycle` | 7 | `open`, `answered`, `moved_on_by_affirmative`, `moved_on_by_negative`, `ignored_by_affirmative`, `ignored_by_negative`, `ignored_by_both` |
| `ai_classifier` | 6 | `introduces_new_issue`, `references_prior_agreement`, `introduces_sub_axis`, `returns_to_prior_issue`, `references_external_context`, `compares_options` |
| **Total** | **21** | |

Per the MCP-SERVER-010-FAMILY-I Stage 2B operator decision, the hosted MCP server's
classifier handles the **6 `ai_classifier` keys ONLY** — those are text-derivable
thread-graph relations. The 8 `auto_metadata` keys are deterministically derivable from
argument-tree structure; the 7 `lifecycle` keys are cluster/temporal-derived; neither is
LLM-classified.

Before this card, the Edge request builder had **no** `thread_topology` entry in
`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`. Absence = **full registry passthrough**, so the
Edge sent all 21 Family-I rawKeys. The hosted MCP server rejected the 15 deterministic
keys with `unsupported_rawKey`, and the Edge mapped that to `mcp_validation_failed` for
**every** Family-I admin_validation request. This is the same failure mode that gated
Family D and Family G before their subset entries landed (#355).

### The fix (mirror D + G exactly)

One entry is added to the frozen `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`, after the
`resolution_progress` entry:

```ts
thread_topology: Object.freeze(new Set<MachineObservationSource>(['ai_classifier'])),
```

The builder (lines 147-148) already drops any rawKey whose `source` is not in the
family's allowlist. A source-type allowlist of `{'ai_classifier'}` **automatically**
selects exactly the 6 `ai_classifier` keys — **no explicit key list is needed**, because
the source filter does the selection. The 15 deterministic keys are dropped before the
request is built, so the hosted MCP server never sees an `unsupported_rawKey`.

### Mode-agnostic; no production movement

The subset filter runs inside `buildBooleanObservationRequestForArgument` regardless of
mode. Family-I admin_validation now produces exactly 6 `ai_classifier` rawKeys. Family-I
is **NOT** `productionEnabled` (the registry entry stays `{ productionEnabled: false,
adminValidationEnabled: true }`), so `filterFamiliesForMode(..., 'production')` drops the
family entirely in production mode → 0 keys. The subset filter therefore never leaks any
deterministic key in either mode.

---

## The no-flip discipline

This card does **NOT** edit `familyRegistry.ts`. The `thread_topology` registry entry
(lines 109-113) remains byte-identical: `{ productionEnabled: false,
adminValidationEnabled: true }`. Production enablement is a **separate** card
(`MCP-021C-EDGE-FAMILY-I-ENABLE` / #394 territory) gated behind Gate B + a latency
re-measure, and is explicitly out of scope here. A test (`SFI-9`) pins
`productionEnabled === false` so a future card cannot silently flip it through this
file's surface.

---

## Fail-closed-before / filtered-after behavior (summary)

| | Before this card | After this card |
| --- | --- | --- |
| Edge sends (admin_validation) | all 21 Family-I rawKeys | exactly 6 `ai_classifier` rawKeys |
| Hosted MCP server response | `unsupported_rawKey` on the 15 deterministic keys | accepts all 6 (already supported per #392) |
| Edge admin_validation outcome | `mcp_validation_failed` (every request) | success (filtered request matches server scope) |
| Production mode | family filtered out (not productionEnabled) | family filtered out (no flip) — unchanged |

---

## Doctrine self-check

- **§10a (Observations vs Allegations):** the 6 `ai_classifier` keys are structural
  thread-topology relations (introduces new issue / references prior agreement / opens
  sub-axis / returns to prior issue / references external context / compares options).
  They describe how a move relates to the conversation graph, never truth or
  speaker-judgment. The verdict-adjacent candidate `repeats_prior_point` was DROPPED
  upstream (`familyI.ts:28-30`). No new label or string is introduced by this card.
- **§1 (score never a verdict):** this card only changes which structural rawKeys the
  Edge requests; it does not alter scoring, the acceptance gate, or the submit path.
- **§7 (no AI from production app):** the change is in a Deno Edge `_shared` pure module;
  no client AI call. The MCP call itself is in the adapter (untouched).
- **§8 (Supabase conventions):** no migration, no RLS change, no table touched.

---

## Files changed

| File | Change |
| --- | --- |
| `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` | +1 entry (`thread_topology: {'ai_classifier'}`) + mirror comment |
| `__tests__/_helpers/booleanObservationEdgeDeno.ts` | +1 bridge export `edgeGetMcpServerSupportedFamilySources` (test-helper only) |
| `__tests__/mcpFamilyIEdgeMcpSubsetFilter.test.ts` | new — 11 tests mirroring the D/G subset-filter suites |
| `docs/designs/MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET.md` | this doc |
| `docs/core/current-status.md` | prepended manifest comment |

Untouched (asserted): `familyRegistry.ts` (byte-equal), all of `mcp-server/`, every
migration directory, `engine.ts`, the submit path, routing flags, provider behavior.

---

## Deploy posture (operator)

This change is **Edge-bearing** (`supabase/functions/**`). Per the project's
merge=deploy convention (the Supabase GitHub integration auto-redeploys Edge Functions
on merge to `main`), Claude does **NOT** push, open a PR, merge, or deploy. The parent
agent handles push + PR and holds at the operator gate.

- **Deploy step (operator):** none beyond the standard merge=deploy. On merge to `main`,
  the Supabase integration redeploys the affected Edge Functions; the
  `booleanObservationRequestBuilder.ts` change ships with them. No `supabase functions
  deploy` flag, no migration, no secret, no env var is required.
- After deploy, Family-I admin_validation requests stop failing with
  `mcp_validation_failed` and return the 6 `ai_classifier` observations.
