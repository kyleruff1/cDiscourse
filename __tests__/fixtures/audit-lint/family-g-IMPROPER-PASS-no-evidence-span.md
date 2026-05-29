<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-008-FAMILY-G-SMOKE — Amendment (SYNTHETIC improper PASS; doctrine fixture)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` (PARTIAL — Phase 3 NOT-RUN).
**Reason:** SYNTHETIC NEGATIVE FIXTURE. Verdict declared PASS and L6 provenance present, but the doctrine-risk persisted direct-output readback was never performed. L5 must catch this.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family G smoke audit | `2640bf9` | **PARTIAL** | Phase 1, 2, 4, 4b, 5, 6 PASS. Phase 3 NOT-RUN. Prior verdict: PARTIAL capped by Gap 1 unmet obligation. |
| **This amendment** | (this commit) | **PASS** | Phase 3 closed by operator-supplied hosted MCP smoke evidence (21/21 PASS, EXIT 0). Gap 1 closed; required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

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

21/21 PASS, EXIT 0; checks 20 + 21 prove the deployed build serves Family G end-to-end.

---

## Phase 4 — Edge admin_validation (Family G)

**Status:** PASS

```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
→ HTTP 200; time_total=25s
```

Two seeded args classified successfully; positives all within the 18-key ai_classifier subset; no cross-family leakage.

---

## Phase 5 — Unsupported H/I/J rejection regression

**Status:** PASS

3/3 reject correctly under mcp_validation_failed. Zero positives. Zero leakage.

---

## Phase 6 — Targeted regression

**Status:** PASS

typecheck EXIT 0; lint EXIT 0; jest pass; deno 1022 pass.

---

## Final upgraded verdict

**PASS** — All five required phases (1, 2, 3, 4, 5) now have direct proof; Phase 6 regression unchanged; Phase 7 provenance carries forward.

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
