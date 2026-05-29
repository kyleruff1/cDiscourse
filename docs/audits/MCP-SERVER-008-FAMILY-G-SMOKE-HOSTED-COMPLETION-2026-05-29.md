# MCP-SERVER-008-FAMILY-G-SMOKE — Hosted-completion amendment (live-evidence completion)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` at `1c19d11` (PARTIAL — Phase 3 hosted MCP smoke NOT-RUN, operator-token-gated).
**Reason:** Supply the one missing required phase that capped `1c19d11` at PARTIAL — the hosted 21-check MCP smoke. The operator ran the hosted smoke (`MCP_HOSTED_TOKEN` against the deployed Deno server); it returned 21/21 PASS, EXIT 0, including the two new Family G checks. All other Card 1 phases (incl. the binding Phase 4b doctrine existential) were already PASS at `1c19d11`. Verdict upgrades PARTIAL → PASS.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family G smoke audit | `1c19d11` | **PARTIAL** | Phases 1, 2, 4, 4b, 5, 6 PASS (incl. the binding Phase 4b adversarial doctrine existential: Fixture C's "won/lost/beat" input → `concedes_broader_point` fired; persisted `evidence_span` anchored "I withdraw the broad claim and stand on the narrow scope only"; zero verdict echo). Phase 3 (hosted 21-check MCP smoke) NOT-RUN — operator-token-gated. Under L1/R2 the verdict was capped at PARTIAL pending the hosted proof. |
| **This amendment** | (this commit) | **PASS** | **Phase 3 closed by operator-supplied hosted MCP smoke: 21/21 PASS, EXIT 0** (including the new `[20-compat-boolean-family-g]` + `[21-mcp-tools-call-boolean-family-g]`). The missing proof is now supplied; the prior PARTIAL cap is lifted. |

**Prior verdict:** PARTIAL (`1c19d11`). **Missing proof:** Phase 3 hosted MCP smoke 21/21 was operator-deferred. **Newly-supplied proof:** operator-supplied redacted hosted smoke output (below). **Upgraded verdict:** PASS.

---

## Phase 3 — Hosted MCP smoke (21 checks)

**Status:** PASS

Operator-supplied evidence (verbatim; token redacted at source):

```
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
PASS [18-compat-boolean-family-f]
PASS [19-mcp-tools-call-boolean-family-f]
PASS [20-compat-boolean-family-g]
PASS [21-mcp-tools-call-boolean-family-g]

MCP-SERVER-001 smoke: 21 PASSES, 0 FAILS
EXIT: 0
```

### Acceptance checklist (all verified)

| Item | Status |
| --- | --- |
| HOSTED SMOKE EXIT: 0 | ✓ |
| Token shown as [REDACTED] | ✓ |
| All 21 checks PASS individually listed | ✓ |
| PASS [20-compat-boolean-family-g] | ✓ |
| PASS [21-mcp-tools-call-boolean-family-g] | ✓ |
| Final tally `MCP-SERVER-001 smoke: 21 PASSES, 0 FAILS` | ✓ |
| Final EXIT: 0 | ✓ |

### What checks 20 + 21 prove (direct, R4)

The deployed Deno Deploy MCP server build serves Family G (`resolution_progress`) end-to-end:

- **Check 20** (`compat-boolean-family-g`): the adapter-compat endpoint accepts `requestedFamilies: ['resolution_progress']` and returns a Family G response carrying `family-g-v1`. The deployed code base contains `familyGKeys.ts`, `familyGPrompt.ts`, `familyGAnthropic.ts`, `familyGBanListScan.ts`, `familyGFixtureProvider.ts`, all wired through `familyRegistryInit.ts` (`register('resolution_progress', …)`) + the `pickFamilyProviders` G block.
- **Check 21** (`mcp-tools-call-boolean-family-g`): the MCP JSON-RPC `tools/call` interface accepts and dispatches Family G; the dispatcher routes `resolution_progress`; the server returns a structured, non-error tool result.

This directly closes the proof gap that the Edge admin_validation evidence (Card 1 Phase 4) could not close on its own: it confirms the **deployed hosted MCP server** — not just the local Deno test build — serves Family G via both the compat path and the JSON-RPC tools/call path, with the server registry and dispatcher wiring live in production hosting.

---

## Doctrine note (L5 — persisted evidence_span inspection from the predecessor)

Family G is now a doctrine-risk family in `DOCTRINE_RISK_FAMILIES` (Card 2, `OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK`, at `cfc1fd4`, added `resolution_progress` + `family_g` + `concedes_broader_point`). The binding L5 obligation — live adversarial resolution-progress persisted `evidence_span` inspection — was satisfied in the predecessor at `1c19d11` Phase 4b: the persisted `argument_machine_observation_results.evidence_span` rows for the Fixture C / Fixture A runs were queried and scanned for resolution-verdict tokens; the `concedes_broader_point` `evidence_span` anchored the descriptive relinquishment ("I withdraw the broad claim and stand on the narrow scope only") and contained zero verdict tokens. This hosted-completion amendment supplies the orthogonal Phase 3 hosted-deployment proof and does not alter the Phase 4b doctrine finding (which stands from the predecessor).

---

## Final upgraded verdict

**PASS** — All required Card 1 phases now have direct proof: Phase 3 hosted MCP 21/21 (this amendment); Phases 1, 2, 4, 4b, 5, 6 from the predecessor `1c19d11` (incl. the binding Phase 4b doctrine existential). The combined Family G admin-ship smoke arc is **PASS**.

| Gap | Proof type | Audit doc | Verdict |
| --- | --- | --- | --- |
| Phase 3 — Hosted MCP 21/21 | Direct (operator-run hosted smoke script; redacted output verbatim) | This doc | PASS |
| Phase 4b — Adversarial persisted evidence_span (carried) | Direct (predecessor live submit-argument + admin_validation + persisted DB query + token scan) | `1c19d11` | PASS |

- `MCP-SERVER-008-FAMILY-G-SMOKE: PASS` (predecessor PARTIAL cap lifted).

---

## Authorizations + gating

- Card 1 (`MCP-SERVER-008-FAMILY-G`) is now **PASS**. Both Card 3 prerequisites are satisfied: (1) Card 1 hosted-amendment PASS (this doc) AND (2) Card 2 (`OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK`) PASS (`cfc1fd4`).
- **Gate B (production-flip + latency) is re-surfaced for the Family G production-flip decision.** Card 3 (`MCP-021C-EDGE-FAMILY-G-ENABLE`) is now unblocked pending the operator's Gate B decision.
