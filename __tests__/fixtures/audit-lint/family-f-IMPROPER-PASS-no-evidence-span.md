<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-007-FAMILY-F-SMOKE — Amendment (SYNTHETIC improper PASS; doctrine fixture)

Audit-Lint: v1

**Date:** 2026-05-28
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md` (PARTIAL — Phases 3/4/4b/5 NOT-RUN).
**Reason:** SYNTHETIC NEGATIVE FIXTURE. Verdict declared PASS and L6 provenance present, but the doctrine-risk persisted direct-output readback was never performed. L5 must catch this.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family F smoke audit | `5591b76` | **PARTIAL** | Phase 1, 2, 6, 7 PASS. Phase 3 NOT-RUN; Phase 4, 4b, 5 NOT-RUN. Prior verdict: PARTIAL capped by Gap 1 unmet obligation. |
| **This amendment** | (this commit) | **PASS** | Phase 3 closed by operator-supplied hosted MCP smoke evidence (19/19 PASS, EXIT 0). Phase 4 closed by Edge admin_validation HTTP 200 with 10 positives across 3 args. Phase 5 closed by 4/4 G/H/I/J rejection. Gap 1 closed; required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

---

## Phase 3 — Hosted MCP smoke (19 checks)

**Status:** PASS

```
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]
PASS [18-compat-boolean-family-f]
PASS [19-mcp-tools-call-boolean-family-f]
MCP-SERVER-001 smoke: 19 PASSES, 0 FAILS
EXIT: 0
```

19/19 PASS, EXIT 0; checks 18 + 19 prove the deployed build serves Family F end-to-end.

---

## Phase 4 — Edge admin_validation (Family F)

**Status:** PASS

```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
→ HTTP 200; time_total=24s
```

10 Family F positives across 3 args; 4 distinct CQ keys fired; all in Family F's 14-key set; no cross-family leakage.

---

## Phase 5 — Unsupported G/H/I/J rejection regression

**Status:** PASS

4/4 reject correctly under mcp_validation_failed. Zero positives. Zero leakage.

---

## Phase 6 — Targeted regression

**Status:** PASS

typecheck EXIT 0; lint EXIT 0; jest 570 suites pass; deno 871 pass.

---

## Final upgraded verdict

**PASS** — All five required phases (1, 2, 3, 4, 5) now have direct proof; Phase 6 regression unchanged; Phase 7 provenance carries forward.

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
