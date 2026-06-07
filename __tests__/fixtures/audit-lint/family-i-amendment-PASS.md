<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-010-FAMILY-I-AMENDMENT — Production-enable completion (representative)

Audit-Lint: v1

**Date:** 2026-06-07
**Operator:** Kyler
**Predecessor audit:** docs/audits/MCP-SERVER-010-FAMILY-I-SMOKE-2026-06-07.md (PARTIAL — Phase 3 + 4b operator-deferred to Card 3).
**Reason:** Representative production-enable completion. Lifts the Card 1 admin_validation-only state to production by supplying the operator-run Edge admin_validation cycle + the binding Phase 4b persisted direct-output readback against production-mode I rows.

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family I smoke audit | (prior) | **PARTIAL** | Phase 1-2 local green. Phase 3 hosted smoke NOT-RUN. Phase 4b persisted readback NOT-RUN (no production I rows yet). Prior verdict: PARTIAL; doctrine-risk inspection deferred to Card 3. |
| **This amendment** | (this commit) | **PASS** | Phase 3 + 4b closed by operator-supplied production-enable smoke. The doctrine-risk persisted evidence_span readback was performed against the first production thread_topology rows. Required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

## Phase 4 — Edge admin_validation + production cycle (Family I)

**Status:** PASS

```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
runMode: 'production' → HTTP 200; time_total=14s
```

Seeded args classified successfully; positives within the 6-key ai_classifier subset; no cross-family leakage.

## Amendment §1 — Persisted direct-output readback (BINDING; doctrine-risk)

**Status:** PASS

The persisted evidence_span rows were queried for the I production runs and scanned for topology-verdict drift:

```
SELECT res.raw_key, res.confidence, res.evidence_span FROM public.argument_machine_observation_results res JOIN public.argument_machine_observation_runs r ON r.id = res.run_id WHERE res.family = 'thread_topology' AND r.run_mode = 'production';
```

| raw_key | evidence_span | topology-verdict drift? |
| --- | --- | --- |
| introduces_new_issue | "Worth thinking about museum funding too" (the new-topic wording verbatim) | NO |
| compares_options | "carbon tax vs cap-and-trade … the tax is simpler" (the compared options verbatim) | NO |
| returns_to_prior_issue | "Coming back to the library staffing question" (the re-engagement wording verbatim) | NO |

The persisted evidence_span anchored the structural relation (new topic opened / compared options / parked issue returned to) and did NOT echo any topology-verdict word (off-topic / derailing / evasive / rehashing / repetitive / going-in-circles / the-right-option / winner). The binding L5 obligation (persisted argument_machine_observation_results.evidence_span inspection against the I ban-list) is SATISFIED.

## Final upgraded verdict

**PASS** — Phase 4 production cycle supplied; the doctrine-risk persisted evidence_span readback re-affirmed clean; Card 1 PARTIAL preserved and lifted.

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
