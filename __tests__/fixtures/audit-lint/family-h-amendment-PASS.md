<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-009-FAMILY-H-AMENDMENT — Production-enable completion (representative)

Audit-Lint: v1

**Date:** 2026-05-31
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` (PASS — Phase 4 + 4b operator-deferred to Card 3).
**Reason:** Representative production-enable completion. Lifts the Card 1 admin_validation-only state to production by supplying the operator-run Edge admin_validation cycle + the binding Phase 4b persisted direct-output readback against production-mode H rows.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family H smoke audit | `12ec7eb` | **PASS** | Phase 1-3 hosted MCP smoke 23/23 PASS. Phase 4 Edge admin_validation cycle NOT-RUN (operator-deferred). Phase 4b persisted readback NOT-RUN (no production H rows yet). Prior verdict: PASS structurally; doctrine-risk inspection deferred to Card 3. |
| **This amendment** | (this commit) | **PASS** | Phase 4 + 4b closed by operator-supplied production-enable smoke. The doctrine-risk persisted `evidence_span` readback was performed against the first production H rows. Required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

---

## Phase 4 — Edge admin_validation + production cycle (Family H)

**Status:** PASS

```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
runMode: 'production'
→ HTTP 200; time_total=18s
```

Seeded args classified successfully; positives within the 12-key ai_classifier subset; no cross-family leakage.

---

## Amendment §1 — Persisted direct-output readback (BINDING; doctrine-risk)

**Status:** PASS

The persisted `evidence_span` rows were queried for the H production runs and scanned for verdict-token drift:

```
SELECT res.raw_key, res.confidence, res.evidence_span
  FROM public.argument_machine_observation_results res
  JOIN public.argument_machine_observation_runs r ON r.id = res.run_id
 WHERE res.family = 'claim_clarity'
   AND r.run_mode = 'production';
```

| raw_key | persisted evidence_span | verdict token? |
| --- | --- | --- |
| claim_specificity_low | "Carbon taxes work" (the bare claim verbatim) | NO |
| reason_missing | "EVs are good" (the bare claim verbatim) | NO |
| conclusion_missing | "Therefore — [the reasoning chain]" (the bare reasoning verbatim) | NO |

The persisted `evidence_span` anchored the structural ABSENCE / BREADTH and did NOT echo any verdict word (weak / sloppy / lazy / careless / confused / unsound / unsupported / incoherent / illogical / wrong / incomplete / failed / bad reasoning / bad argument / bad writing). The binding L5 obligation (persisted `argument_machine_observation_results.evidence_span` inspection against H ban-list) is SATISFIED.

---

## Final upgraded verdict

**PASS** — Phase 4 production cycle supplied; the doctrine-risk persisted `evidence_span` readback re-affirmed clean; Card 1 PASS preserved and extended.

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
