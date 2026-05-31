# MCP-SERVER-010-FAMILY-I — Intent brief (Card 1 of 3-card suite)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** MCP-server family ship — `thread_topology` (Family I), admin_validation-only Edge posture. Mixed-source (D precedent applies).
**Suite:** Card 1 (admin ship) → Gate A → Card 2 (CONDITIONAL: L5 mechanization for `family_i`) → Gate B → Card 3 (production-enable).
**Predecessor:** Family H chain merged + production. main at TBD-post-H-merge SHA.
**Trail:** Umbrella issue # [OPERATOR DECISION NEEDED: capture from Phase 4 of OPS-WORKFLOW-RESTORATION]. Card issue # TBD.

> Phase 0 source-split (verified by OPS-WORKFLOW-RESTORATION Phase 1 Agent 1.2): **21 keys, MIXED source** — 8 `auto_metadata` + 7 `lifecycle` + 6 `ai_classifier`. Family D precedent governs the subset filter pattern.

---

## 1. Goal

Ship Family I (`thread_topology`) on the hosted MCP server with an **admin_validation-only** Edge posture (production flip is Card 3). MCP-server scope = the **6 `ai_classifier` keys only**; `auto_metadata` and `lifecycle` keys are system/cluster-derived and routed via separate paths (NOT the LLM classifier). This mirrors the Family D precedent (`familyDKeys.ts` = "19 ai_classifier-subset rawKeys … per Stage 2B operator binding decision").

---

## 2. Phase 0 findings (designer to confirm)

- **I source** (`src/features/nodeLabels/machineObservationDefinitions/familyI.ts`): **21 keys total** — 8 `auto_metadata` (has_reply, participant_skipped_node, no_response_after_n_turns, repeated_axis_pressure, splits_thread, merges_thread, references_sibling_node, references_ancestor_node), 7 `lifecycle` (open, answered, moved_on_by_affirmative, moved_on_by_negative, ignored_by_affirmative, ignored_by_negative, ignored_by_both), 6 `ai_classifier` (introduces_new_issue, references_prior_agreement, introduces_sub_axis, returns_to_prior_issue, references_external_context, compares_options).
- **MCP-server scope:** the LLM boolean classifier handles the **6 `ai_classifier` keys only** (text-derivable). 8 `auto_metadata` keys are system-derived from message structure (e.g., reply chain detection). 7 `lifecycle` keys are cluster-derived from temporal patterns. Both are NOT LLM-classified.
- **Card 1 creates** `familyIKeys.ts` (6-key ai_classifier subset), `familyIPrompt.ts`, `familyIAnthropic.ts`, `familyIBanListScan.ts`, `familyIFixtureProvider.ts` + one `register('thread_topology', { rawKeys: <6 keys> })` call in `familyRegistryInit.ts` + dispatcher routing + fixtures + tests + smoke +2 checks.
- **Edge `familyRegistry.ts` I entry status** [OPERATOR DECISION NEEDED: confirm by reading the file at the post-H-merge SHA — expected `{ family: 'thread_topology', productionEnabled: false, adminValidationEnabled: true }` baseline].

---

## 3. Doctrine — thread_topology

**Doctrine-risk: ASSUMED-LOW** (A.1 confirms). The 6 ai_classifier keys are structural-relation observations (introduces_new_issue / references_prior_agreement / etc.) about how a message relates to the conversation graph. They describe topology, not truth or speaker-judgment.

- **DESCRIPTIVE (clean):** "does this message introduce a new issue? reference a prior agreement? compare options?"
- **VERDICT (would-be violation if introduced):** "is this message off-topic / derailing / disrespecting prior agreement?" — but the I keys do not approach this framing.

If A.1 confirms LOW doctrine-risk, the operator may decide Card 2 (audit-lint L5) is OPTIONAL or DEFERRED rather than required. [OPERATOR DECISION NEEDED: per the Family E precedent where doctrine-risk was downgraded after Card A smoke; designer A.1 produces the binding determination].

---

## 4. Autonomy — Stage 2B (anticipated MANDATORY)

Five complexity triggers (A.1 evaluates):
- **T1 mixed source provenance** — **TRUE** (auto_metadata + lifecycle + ai_classifier). → ai_classifier-subset decision (mirror Family D). Stage 2B MANDATORY.
- **T2 compound rawKey collision** — assumed FALSE; A.2 verifies.
- **T3 doctrine-risk framing** — assumed LOW (see §3). Stage 2B not required on this axis.
- **T4 MAX_TOKENS bump** — anticipated FALSE. Token math: 6 keys × ~85 tokens ≈ 510 with ~990 headroom against 1500 default. [OPERATOR DECISION NEEDED: confirm `FAMILY_I_MAX_TOKENS = 1500` — could go lower].
- **T5 dependency on prior-family outputs** — FALSE (I's classifier reads argument text + parent context + sibling-graph topology; not A–H classifier outputs).

Designer MUST state: **"Stage 2B REQUIRED because T1"** (anticipated; subset confirmation is the operator-decision surfaced).

---

## 5. Binding decisions (D1–D14)

**D1 — `familyIKeys.ts` rawKeys list is the 6-key ai_classifier subset** [OPERATOR DECISION NEEDED: confirm exact list — Phase 1 extracted: `introduces_new_issue`, `references_prior_agreement`, `introduces_sub_axis`, `returns_to_prior_issue`, `references_external_context`, `compares_options`].

**D2 — `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry REQUIRED for thread_topology** (mirror Family D). The Edge booleanObservationRequestBuilder needs to know which subset of I keys flow through the MCP path. Card 1 may need to add the entry, OR defer to Card 3 (Edge production-enable); [OPERATOR DECISION NEEDED: confirm boundary — Family D added the entry in the server card; designer A.1 reads the booleanObservationRequestBuilder pattern and decides].

**D3 — auto_metadata + lifecycle keys routed via NON-MCP paths.** This card does NOT modify those paths. Card scope is the ai_classifier subset only.

**D4 — 5-layer doctrine defense** mirrors Family G structurally but with LOWER doctrine-risk profile (no HIGH-risk keys identified in Phase 1).

**D5 — `FAMILY_I_MAX_TOKENS = 1500`** [OPERATOR DECISION NEEDED: confirm; could be 1000 given only 6 keys].

**D6 — `FAMILY_I_BAN_PATTERNS`** [OPERATOR DECISION NEEDED: confirm Family-I-LOCAL token list; thread_topology has lower doctrine-risk surface — fewer family-local tokens needed; reuse of shared `doctrineBanList.ts` likely sufficient].

**D7 — Edge `familyRegistry.ts` I entry unchanged in this card.** Card 3 owns the flip.

**D8 — Cross-family rawKey collision empty.** A.2 verifies I keys do not collide with A–H.

**D9 — `FAMILY_I_CLASSIFIER_SET_VERSION = 'family-i-v1'`** per chain convention.

**D10 — Smoke template carries `Audit-Lint: v1`** + Phase 4b doctrine evidence_span inspection language [OPERATOR DECISION NEEDED: required vs OPTIONAL depending on §3 risk verdict].

**D11 — Card 2 (audit-lint L5 for `family_i`) is CONDITIONAL** on A.1 doctrine-risk verdict. If LOW: Card 2 may be SKIPPED (2-card chain). If MEDIUM+: Card 2 ships.

**D12 — Test forecast: +60 to +110 net Deno tests + ~8 Jest tests** [OPERATOR DECISION NEEDED: confirm; smaller than H/G due to 6-key scope vs 12+/29].

**D13 — Smoke script extension: 2 new checks** (`compat-boolean-family-i` + `mcp-tools-call-boolean-family-i`) mirroring G/H pattern.

**D14 — Family-A/B/C/D/E/F/G/H lib byte-equal preserved** (HALT 4); shared `doctrineBanList.ts` byte-equal (HALT 5); protected surfaces unchanged (HALT 5).

---

## 6. Test forecast

[OPERATOR DECISION NEEDED: confirm — designer A.5 produces binding number]
- Deno: +60 to +110 (smaller than H due to 6-key vs 12-key scope).
- Jest: +6 to +10.
- HALT 8 ceiling: +250 net.

---

## 7. HALT triggers (numbered, binding)

[OPERATOR DECISION NEEDED: confirm full list — mirror H's table with adjustments]
1-13: same shape as MCP-SERVER-009-FAMILY-H-intent.md §7.
14. **HALT 14** — `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry for thread_topology missing OR includes non-ai_classifier source keys (must be the 6-key ai_classifier subset only).

---

## 8. Hard guardrails

Same as H. Additionally: NO `auto_metadata` or `lifecycle` key processing in the MCP classifier path (those are system-derived elsewhere).

---

## 9. Process

Same shape as H suite. Designer → implementer → reviewer → adversarial × 3 → PR → operator merge → smoke.

---

## 10. Post-merge smoke skeleton

Same shape as H Card 1 smoke. Phase 4b doctrine intensity adjusted per §3 risk verdict.

---

## Markers summary ([OPERATOR DECISION NEEDED] count: ~12)

- Trail issue #
- Edge familyRegistry.ts I entry line numbers
- Doctrine-risk verdict (LOW vs MEDIUM+; affects Card 2 conditional)
- `FAMILY_I_MAX_TOKENS` final value
- `FAMILY_I_BAN_PATTERNS` final list (may be empty)
- `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry boundary (Card 1 vs Card 3)
- ai_classifier subset key list (6 keys; confirm verbatim)
- Card 2 conditional (ships vs SKIPPED)
- Test forecast binding numbers
- Smoke script check IDs
- HALT trigger full list
- Stage 2B explicit declaration
