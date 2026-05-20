# RULE-006 — Semantic AI metadata strategy (consolidation index)

**Status:** Consolidation index — RULE-006 is **superseded by the MCP-001 … MCP-010 design family.**
**Epic:** Epic 12 — Rules UX
**Release:** 6.7 (originating) → superseded into Release 6.8 (MCP slate)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/116
**Recommendation:** close RULE-006 (#116) as superseded — see §3.

> **This is an index, not a new design.** It contains **no new architecture and no duplicate prompt library.** It exists to (a) produce RULE-006's literally-named deliverable `docs/designs/RULE-006.md` — the one outstanding acceptance criterion — and (b) map every other RULE-006 acceptance criterion to the MCP doc that already satisfies it. Read the MCP docs for the actual design.

---

## 1. What happened

RULE-006 (#116) was filed by the 2026-05-19 product audit as a **research / spike** card: *whether and how* CDiscourse should adopt a feature-flagged, mocked-by-default semantic AI metadata layer that produces classification metadata at strategic points, never makes a live AI call in v1, and is never the sole blocking mechanism for a post.

The **2026-05-20 MCP semantic-referee roadmap expansion** answered that question concretely. It filed a seven-card design slate — MCP-001, MCP-002, MCP-003, MCP-004, MCP-008, MCP-009, MCP-010 — all now merged, reviewed `Approve`, and closed. RULE-006's flat `SemanticMetadata` shape evolved into MCP-001's `SemanticRefereePacket`: binary `0/1` classifiers, bounded route/friction enums, `scoreHints`, `authoritative: false`, provider-agnostic, mock-default, operator-gated. Every RULE-006 doctrine non-negotiable is preserved and hardened.

RULE-006's named deliverable was the file `docs/designs/RULE-006.md`. It was never written — the #116 comment thread states so explicitly. **This document is that file**, produced as a consolidation index by the 2026-05-20 MCP integration-readiness pass.

## 2. Acceptance-criterion → MCP-doc map

Every RULE-006 acceptance criterion and where it is now satisfied:

| RULE-006 acceptance criterion | Satisfied by |
|---|---|
| Master design doc `docs/designs/RULE-006.md` produced | **This document.** |
| Cost-control plan documented | [`MCP-004`](./MCP-004.md) — trigger gates, caching by `{roomId, parentId, contentHash, promptVersion, classifierSet}`, batching ≤5/call, token budget, retry/fallback. |
| Prompt + schema + version-tracking plan documented | [`MCP-001`](./MCP-001.md) §7 (the `SemanticRefereePacket` schema), §18 (`promptVersion` / `modelVersion` / `packetVersion` tracking); [`mcp-semantic-referee-prompt-bank.md`](../semantic-prompts/mcp-semantic-referee-prompt-bank.md) (the 90-seed prompt library, MCP-002). |
| Mocked test plan documented | [`MCP-001`](./MCP-001.md) §19; [`MCP-003`](./MCP-003.md) §15; the test-plan sections of MCP-004 / MCP-008 / MCP-009 / MCP-010 — all mock/fixture-driven, no live call. |
| Manual override flow documented | [`MCP-010`](./MCP-010.md) — the semantic override / appeal UX; the `semantic_override` metadata event; reversible lane choice; no penalty. |
| Provider strategy (provider-agnostic shape; Haiku / MCP / abstraction) | [`MCP-001`](./MCP-001.md) §10 + §23.1; [`MCP-009`](./MCP-009.md) §"Provider registry" + operator decisions — provider-agnostic registry, `mock` default, `anthropic` / `mcp` slots reserved. |
| False-positive mitigation (every AI field paired with a deterministic derivation; conflicts → `confidence: low`) | [`MCP-001`](./MCP-001.md) §6 + §14; [`MCP-003`](./MCP-003.md) §5 — layer-1 / layer-2 reconciliation; conflict routes to a reversible choice, never a penalty. |
| Edge Function design (extend `process-language-draft` vs new function) | [`MCP-009`](./MCP-009.md) — boundary options (a)/(b)/(c) evaluated; recommended a dedicated `semantic-referee` Edge Function, disabled-by-default. |
| UI contract — no raw model labels; advisory chips only | [`MCP-001`](./MCP-001.md) §17; [`MCP-008`](./MCP-008.md) — banner library, plain-language mapping, ban-list; [`MCP-010`](./MCP-010.md) — override surface copy. |
| "AI does not decide who is right; ordinary posts are not blocked solely by semantic AI" | Stated as a doctrine non-negotiable in every MCP doc's doctrine section ([`MCP-001`](./MCP-001.md) §3, etc.). |
| Doctrine self-check completed | Every MCP doc carries a doctrine self-check section. |

RULE-006's proposed file `src/features/semantic/semanticMetadataModel.ts` is superseded by the `src/features/semanticReferee/` foundation that **MCP-011** ([#178](https://github.com/kyleruff1/cDiscourse/issues/178)) implements — see [`docs/designs/MCP-011.md`](./MCP-011.md) and the readiness roadmap below.

## 3. Disposition recommendation

**Close RULE-006 (#116) as superseded by the MCP-001 … MCP-010 family.**

- Every RULE-006 acceptance criterion is satisfied (§2). The last outstanding one — producing `docs/designs/RULE-006.md` — is satisfied by this document.
- RULE-006 has **no unique remaining scope** the MCP slate does not cover. Keeping it open would be a duplicate tracking issue.
- The MCP implementation work is tracked by its own cards (MCP-011 … MCP-016) on Project #1 — RULE-006 is not needed as an umbrella.

This consolidation does **not** close the issue automatically. The operator closes #116 after accepting this index. A comment on #116 links this document and the readiness roadmap.

## 4. Where the work continues

- **Design slate (complete):** [`docs/roadmap-expansions/2026-05-20-mcp-semantic-referee-roadmap.md`](../roadmap-expansions/2026-05-20-mcp-semantic-referee-roadmap.md) and the MCP-001 … MCP-010 design docs.
- **Implementation sequence:** [`docs/roadmap-expansions/2026-05-20-mcp-integration-readiness-roadmap.md`](../roadmap-expansions/2026-05-20-mcp-integration-readiness-roadmap.md) — files MCP-011 … MCP-016 and orders them so the pure-TS, fixture-only foundation is built first and the live provider stays a separate operator-gated card.
- **First card:** [`docs/designs/MCP-011.md`](./MCP-011.md) — the mock packet validator and fixture provider.

## 5. Doctrine carry-forward (unchanged from RULE-006, hardened by the MCP slate)

- AI never decides who is right; AI never declares a winner; AI never assigns truth or falsity; AI never labels a person.
- AI never blocks an ordinary post by itself — only deterministic structural validation blocks.
- AI never runs on the client — provider calls live only in an Edge Function.
- `authoritative` is the literal `false` for every AI-sourced packet and sample.
- All semantic calls are feature-flagged, mocked by default, fixture-driven in development; live calls are operator-gated.
- Popularity / virality / heat are not evidence; engagement credit and factual-standing credit stay on separate axes.
- v1 ships zero production AI calls; this consolidation does not change that.

## Operator steps

None — pure documentation. The only operator action is the **decision** to close RULE-006 (#116) as superseded (§3).
