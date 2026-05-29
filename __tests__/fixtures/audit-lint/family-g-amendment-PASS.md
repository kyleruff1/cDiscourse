<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-008-FAMILY-G-SMOKE — Amendment (live-evidence completion; representative)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` (PARTIAL — Phase 3 hosted operator-deferred).
**Reason:** Representative hosted-completion amendment. Lifts the prior PARTIAL to PASS by supplying the operator-run hosted 21/21, and re-affirms the binding doctrine-risk persisted direct-output readback.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family G smoke audit | `2640bf9` | **PARTIAL** | Phase 1, 2, 4, 4b, 5, 6 PASS. Phase 3 NOT-RUN (operator-token-gated). Prior verdict: PARTIAL capped by Gap 1 (hosted 21/21 unmet obligation). |
| **This amendment** | (this commit) | **PASS** | Gap 1 closed by operator-supplied hosted MCP smoke (21/21 PASS, EXIT 0). Required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

---

## Phase 3 — Hosted MCP smoke (21 checks)

**Status:** PASS

```
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]
PASS [20-compat-boolean-family-g]
PASS [21-mcp-tools-call-boolean-family-g]
MCP-SERVER-001 smoke: 21 PASSES, 0 FAILS
EXIT: 0
```

21/21 PASS, EXIT 0.

---

## Amendment §1 — Persisted direct-output readback (BINDING; doctrine-risk)

**Status:** PASS

The persisted `evidence_span` rows were re-queried for the G runs and scanned for resolution-verdict tokens:

```
SELECT raw_key, confidence, evidence_span
  FROM argument_machine_observation_results
 WHERE run_id IN ('8489ec32...', '8a3cabef...');
```

| raw_key | persisted evidence_span | verdict token? |
| --- | --- | --- |
| concedes_broader_point | "I withdraw the broad claim and stand on the narrow scope only" | NO |
| narrows_claim | "they work where enforcement is stable" | NO |

The persisted `evidence_span` anchored the structural relinquishment and did NOT echo any verdict word. The binding L5 obligation (persisted `argument_machine_observation_results.evidence_span` inspection) is SATISFIED.

---

## Final upgraded verdict

**PASS** — Phase 3 hosted 21/21 supplied; the doctrine-risk persisted `evidence_span` readback re-affirmed clean; prior PARTIAL lifted.

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
