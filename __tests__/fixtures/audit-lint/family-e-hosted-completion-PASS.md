<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-006-FAMILY-E-SMOKE — Hosted-smoke completion (Gap 1 closed)

**Date:** 2026-05-28
**Operator:** Kyler
**Predecessor amendment:** `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT-2026-05-28.md` (commit `b1829f5`)
**Reason:** Supply the NOT-RUN Phase 1 hosted-smoke evidence that capped `b1829f5` at PARTIAL. Operator ran the hosted MCP smoke script and provided redacted 17/17 PASS output. R2 cap is lifted; verdict upgrades PARTIAL → PASS.

---

## Verdict-upgrade provenance (full arc)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family E smoke audit | `29f30b0` | PASS (improperly) | Phase 4 Edge admin_validation green; Phase 4b unit-test layer green; doctrine ban-list scan on non-adversarial response = 0 tokens. **Phase 3 hosted MCP marked "covered indirectly via Phase 4 success."** Under R2, "covered indirectly" should have capped the verdict at PARTIAL, not PASS. |
| Smoke-completion amendment | `b1829f5` | **PARTIAL** | **Gap 2 closed live:** 3 adversarial slippery_slope test args via live submit-argument; Phase 3 Edge admin_validation surfaced 2/3 success with slippery_slope_reasoning_present firing on F2 + F3; Phase 4 persisted evidence_span doctrine inspection found ZERO banned tokens (13 patterns × 2 firings); F2 specifically proved output does NOT echo "fallacy" even though input contained it twice. **Gap 1 still NOT-RUN:** `$HOME/mcp-hosted-token.current` missing at audit time; per R2 verdict capped at PARTIAL. |
| **This doc** | (this commit) | **PASS** | **Gap 1 closed by direct operator-run hosted MCP smoke evidence: 17/17 PASS, EXIT 0.** R2 cap lifted. Both gaps now closed by direct proof (R4 satisfied). |

---

## Phase 1 — Hosted MCP smoke (17 checks)

**Status:** PASS

Operator-supplied evidence (verbatim; token redacted at source):

```
HOSTED SMOKE EXIT: 0
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]

PASS [1-health]
PASS [2-compat-no-auth]
PASS [3-compat-bad-token]
PASS [4-compat-semantic-move]
PASS [5-compat-boolean-family-a]
PASS [6-mcp-initialize]
PASS [7-mcp-tools-list]
PASS [8-mcp-tools-call-semantic]
PASS [9-mcp-tools-call-boolean-family-a]
PASS [10-compat-boolean-family-b]
PASS [11-mcp-tools-call-boolean-family-b]
PASS [12-compat-boolean-family-c]
PASS [13-mcp-tools-call-boolean-family-c]
PASS [14-compat-boolean-family-d]
PASS [15-mcp-tools-call-boolean-family-d]
PASS [16-compat-boolean-family-e]
PASS [17-mcp-tools-call-boolean-family-e]

MCP-SERVER-001 smoke: 17 PASSES, 0 FAILS
EXIT: 0
```

### Acceptance checklist (all verified)

| Item | Status |
| --- | --- |
| HOSTED SMOKE EXIT: 0 | ✓ |
| Token shown as [REDACTED] | ✓ |
| All 17 checks PASS individually listed | ✓ |
| PASS [16-compat-boolean-family-e] | ✓ |
| PASS [17-mcp-tools-call-boolean-family-e] | ✓ |
| Final tally "MCP-SERVER-001 smoke: 17 PASSES, 0 FAILS" | ✓ |
| Final EXIT: 0 | ✓ |

### What checks 16 + 17 prove (R4 satisfied)

Checks 16 + 17 specifically prove that the **deployed hosted MCP server build** serves Family E end-to-end:

- **Check 16** (`compat-boolean-family-e`): a Family E request reaches the adapter-compat endpoint and the server returns a Family E response. The deployed code base contains `familyEKeys.ts`, `familyEPrompt.ts`, `familyEAnthropic.ts`, `familyEBanListScan.ts`, `familyEFixtureProvider.ts` AND they are wired through `familyRegistryInit.ts` + `classifyArgumentBooleanObservations.ts` correctly.
- **Check 17** (`mcp-tools-call-boolean-family-e`): the MCP JSON-RPC `tools/call` interface accepts and dispatches Family E. The tool description was updated; the dispatcher routes Family E; the server returns a structured tool result.

These two checks are precisely the proofs the Edge → MCP indirect path in `29f30b0` could not establish. The original "covered indirectly via Phase 4 success" reasoning was a substitution of indirect for direct evidence — exactly the substitution R4 forbids for the two gaps this completion exists to close.

Now both gaps have direct proof:

- **Gap 1 (hosted 17/17):** closed by operator-run hosted smoke evidence above
- **Gap 2 (adversarial slippery_slope persisted evidence_span):** closed by `b1829f5` Phase 4b (2 clean slippery_slope firings on F2 + F3; 0 banned tokens; F2 proved no "fallacy" echo despite adversarial input)

---

## Gap 2 — confirmation (no re-run needed)

The smoke-completion amendment at `b1829f5` produced the binding Phase 4b proof against persisted `evidence_span` rows:

- **F2** (input contained "fallacy" twice): `slippery_slope_reasoning_present.evidence_span` = "legalizing this practice will lead to wider acceptance, which will normalize related practices, which will then erode the existing legal framework, eventually producing the very outcome critics fear" — **0 banned tokens** across all 13 amendment patterns (fallacy, fallacious, weak, weak argument, invalid, invalid argument, bad reasoning, flawed, flawed reasoning, wrong, proof of, logical error, informal fallacy)
- **F3** (multi-scheme): `slippery_slope_reasoning_present.evidence_span` = "that exit will trigger supply-chain disruptions, which will lead to consumer price increases, which will eventually destabilize entire markets" — **0 banned tokens**
- All 5 result rows: `evidence_len ≤ 240`; all `raw_key` in Family E 16-key set
- F2's adversarial assertion verified: input had "fallacy" twice; output did NOT echo

The Gap 2 proof stands. No re-run needed.

---

## Final upgraded verdict

**PASS** — both gaps now closed by direct proof. R2 cap lifted. R4 satisfied for both binding obligations.

| Gap | Proof type | Audit doc | Verdict |
| --- | --- | --- | --- |
| 1 — Hosted MCP 17/17 | Direct (operator-run hosted smoke script; redacted output) | This doc | PASS |
| 2 — Adversarial slippery_slope persisted evidence_span | Direct (live submit-argument + Edge admin_validation + persisted DB query) | `b1829f5` | PASS |

Combined Family E smoke arc: PASS.

---

## Authorizations UNLOCKED

- **`MCP-SERVER-007-FAMILY-F`**: may proceed. Stage-2B operator-decision checkpoint required only if designer Phase A surfaces structural complexity (e.g., E↔F coupling — F is critical_question to E's argument_scheme per the Walton model). Default expectation: NO Stage 2B if F is uniform ai_classifier like E was.
- **`MCP-021C-EDGE-FAMILY-E-ENABLE`**: may proceed. Strengthened proof obligations (4-family auto-trigger; subset filter holds under production — though E does not currently use a subset filter so this is structurally simpler than Card 2 of the prior chain) should be baked into the intent brief from Phase A, not retrofitted post-merge.
- **`OPS-MCP-SMOKE-DOCTRINE-HARDENING`**: remains the **RECOMMENDED** next card. This card would codify the audit-integrity rules (R1-R4) into the smoke template + adversarial fixture pattern + persisted evidence_span doctrine check, so future family ships ship with these proofs from Phase 1 rather than requiring a smoke-completion amendment.

---

## Carry-forward backlog (do not action here)

These items remain open from the predecessor audit chain and should be picked up by an appropriate future card:

1. **Stale production-rejection error message** at `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (or wherever the message is constructed): "Only `parent_relation` is enabled at this ship" — A+B+C+D are now production-enabled per prior chain Cards. Behavior correct; message false. Cosmetic OPS fix.
2. **F1 transient mcp_validation_failed** observed in `b1829f5` Phase 2 + Phase 3 (Family D + Family E both failed on F1 = `242b05d8`; A/B/C succeeded on the same arg). Likely Anthropic-side transient. Q9 watch if it recurs as a pattern.
