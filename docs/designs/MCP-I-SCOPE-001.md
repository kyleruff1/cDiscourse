# MCP-I-SCOPE-001 — Family I thread_topology scoping confirmation

Audit-type: design
Family: thread_topology

**Status:** Design draft (GATE-A). DOCS-ONLY. Enables no family.
**Issue:** #478 (`MCP-I-SCOPE-001`). This artifact is bundled with `docs/designs/MCP-021C-EDGE-FAMILY-I-PRODUCTION-ENABLE-D1.md` and **Closes #478 on merge**. The runbook lives in the D1 doc; this file is the thin scoping confirmation.
**Verified-at-HEAD:** `main` = `67f86d3`.

This file answers #478's four required questions with re-verified `file:line` citations and carries the verbatim authorization boundary. The full production-enable runbook (D2 scope, D3 smoke, D4 window, rollback) is in the D1 doc — **see `docs/designs/MCP-021C-EDGE-FAMILY-I-PRODUCTION-ENABLE-D1.md`.**

---

## (a) Required thread context for Family I

Family I (`thread_topology`) is mixed-source: 8 `auto_metadata` + 7 `lifecycle` + 6 `ai_classifier` keys (`mcp-server/lib/familyIKeys.ts:14-24`). Only the **6 `ai_classifier` keys** route to the hosted MCP at production (`familyIKeys.ts:92-99`); the 15 deterministic keys are derived elsewhere and never sent. The thread context the family's signals draw on, with the four named dimensions:

| Dimension | What it means for I | Which keys need it |
|---|---|---|
| **Parent-chain depth** | how far the move sits below the root; how many ancestors precede it | `introduces_sub_axis`, `returns_to_prior_issue` (re-engaging an earlier-parked ancestor) |
| **Sibling count** | how many co-children share the move's parent | deterministic `references_sibling_node`, `splits_thread` (auto_metadata — NOT MCP-routed) |
| **Lane / branch membership** | which branch line the move belongs to | deterministic `merges_thread`, `references_ancestor_node` (auto_metadata — NOT MCP-routed) |
| **Ancestor stance** | the position/side expressed by ancestor moves | `references_prior_agreement` (cites established common ground), `introduces_new_issue` (distinct from the parent's subject) |

The 6 `ai_classifier` keys are **text-derivable thread-graph relations** (`familyIKeys.ts:14-24`): they operate on the move text, the parent text, and the recent ancestor-body excerpt. The four structured topology dimensions above (a numeric depth, an enumerated sibling set, a branch/lane ordinal, an ancestor side/stance field) back the **deterministic** keys, which are computed from the argument tree on NON-MCP paths.

---

## (b) Does the current classify input shape carry that context? — answer per dimension, with `file:line`

The classify request is assembled by `loadArgumentContext` in `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts:117-167` and shaped by `buildBooleanObservationRequestForArgument` in `booleanObservationRequestBuilder.ts:134-190`. The wire request (`mcpBooleanObservationSchema.ts:58-88`) carries: `nodeId`, `parentNodeId`, `currentText`, `parentText`, `threadContextExcerpt`, plus the rawKey/definitions union.

- **Parent-chain depth — PARTIAL (text only).** The assembler walks **up to 3 ancestors** via a `parent_id` cursor (`classifyArgumentCore.ts:140-156`; loop guard `while (cursor && depth < 3)` at `:144`) and joins their bodies into `threadContextExcerpt`, sliced to 2,000 chars (`:157`). No structured numeric depth field is emitted; the request interface has only `parentArgumentId` / `parentText` / `threadContextExcerpt` (`booleanObservationRequestBuilder.ts:102-125`, return `:175-189`). Depth is textually inferable from the excerpt, not transmitted as a field.
- **Sibling count — NO.** The assembler issues only the move row query and an ancestor-chain walk (`classifyArgumentCore.ts:121-156`); there is no sibling query (no `.eq('parent_id', …)` listing co-children). No sibling field exists in the request shape (`booleanObservationRequestBuilder.ts:102-125`; `mcpBooleanObservationSchema.ts:58-88`).
- **Lane / branch membership — NO.** No branch / lane / branch-ordinal field is queried or transmitted; the assembler carries only the linear ancestor chain.
- **Ancestor stance — PARTIAL (text only).** Ancestor **bodies** are transmitted as text in `threadContextExcerpt` (`classifyArgumentCore.ts:151-157`), so stance is inferable from prose, but no structured stance/side field is sent.

**Verdict (yes/no):** **YES** — the current classify input shape carries **sufficient context for the 6 `ai_classifier` keys that production routes to MCP** (move text + parent text + up to 3 ancestor bodies). **NO** for the structured topology fields (numeric depth, sibling set, branch/lane ordinal, ancestor side) — **but those back only the 15 deterministic keys**, which are computed on NON-MCP paths and never reach the hosted MCP (the subset filter at `booleanObservationRequestBuilder.ts:88,158-159` drops them). The gap is **by design and is NOT a blocker** for I production-enable: the subset entry guarantees only the 6 text-derivable keys are sent, and the request already carries the text they need.

---

## (c) UI consumers of a Family I observation

While `thread_topology` is `productionEnabled: false`, no I observation reaches a production user surface (`familyRegistry.ts:111`). The consumers that WOULD render an I observation (and their current gating):

- **Node labels / argument-detail hub (timeline-adjacent chips + uncapped hub).** `src/features/arguments/detail/argumentDetailModel.ts` — I is gated off the production hub by the explicit family allow-list: `HUB_NON_PRODUCTION_FAMILIES` lists `thread_topology` (`:669-670`); the gate is `isHubAllowedFamily` (`:756-760`). The verdict-free plain-language heading `'How the thread is shaped'` is pre-authored (`:706`) but dormant.
- **Node-label definitions (timeline scrubber / selected-context / inspect floors).** `src/features/nodeLabels/machineObservationDefinitions/familyI.ts` defines the 21 I entries with `confidenceEligibility` floors (timeline / selected-context / inspect); these feed node-label rendering but are gated out of production surfaces while I is non-production.
- **Admin classifier-health surface.** `src/features/adminClassifierHealth/classifierHealthModel.ts:36-40` — `FROZEN_NON_PRODUCTION_FAMILIES` lists `thread_topology`; the admin-validation view is where I output is auditable today.
- **Gallery cards.** No dedicated I gallery-card consumer exists today; gallery surfaces remain future-reserved and are not part of the I production-enable scope.

**Decoupling note:** flipping I to production at the Edge does NOT auto-surface I on the client — the `HUB_NON_PRODUCTION_FAMILIES` and `FROZEN_NON_PRODUCTION_FAMILIES` mirrors are updated by a **separate follow-up card** (the I analog of the deferred H tripwire re-scope), not by the flip card. See the D1 doc §4.3.

---

## (d) Blocker list (tied to the #471 readiness ledger)

Per `docs/core/MCP-HIJ-READINESS-LEDGER.md` Row I (`thread_topology`):

1. **Chained behind H stable.** Ledger Row I col 10 + col 11 (`#478`): I was blocked behind H-stable. **Status: CLEARED** under the operator's accelerated standard (#552 C4 PASS / NO ORGANIC VOLUME, 2026-06-10; #394 D0 H-stable precondition cleared, 2026-06-10), with the honesty caveat that this is operator-seeded, not a 24-hour organic PASS, and P1 real-organic evidence remains separately pending.
2. **Mixed-source subset entry must be present.** Ledger Row I col 4 named the HALT-13-inverse trap. **Status: RESOLVED** — `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] = {'ai_classifier'}` shipped (#550, `booleanObservationRequestBuilder.ts:82-88`) and STAYS exactly as shipped. Removing/widening it re-introduces `mcp_validation_failed`.
3. **Cards 1/2/3 build state.** Ledger Row I col 2/3 recorded "never attempted." **Status: SUPERSEDED** — I server is Deno-live (#546), `family_i` L5 audit-lint shipped (#549), Edge bridge shipped (#550). The remaining work is the one-boolean flip + test re-baselines + smoke (the D1 runbook).
4. **Tier-3 operator authorization (open).** The #394 flip is Tier-3 never-self-approve and remains gated on explicit operator-named authorization; the D4 observation window and any queue-percentage ramp are separate operator-gated steps.

**Doctrine note (evidence_span):** the D3 smoke (D1 doc §6) inspects every persisted I `evidence_span` for banned verdict tokens and secret shapes, enforcing the §10a Observation boundary (I observations are structural, never verdicts) empirically. The `family_i` L5 audit-lint mechanization (`scripts/ops/audit-lint-rules.cjs:92-108`) is the CI enforcement surface.

---

## Authorization boundary (verbatim — #478 acceptance criterion)

not authorized to flip productionEnabled in this card or any subsequent card without explicit operator-named authorization.
