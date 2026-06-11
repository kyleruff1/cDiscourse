<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-011-FAMILY-J-AMENDMENT — admin_validation smoke completion (representative)

Audit-Lint: v1

**Date:** 2026-06-11
**Operator:** Kyler
**Predecessor audit:** docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md (PARTIAL — Phase 3 + 4b operator-deferred).
**Reason:** Representative admin_validation smoke completion. Lifts the Card 1 build-only state to the verified admin_validation ceiling by supplying the operator-run Edge admin_validation cycle + the binding Phase 4b persisted direct-output readback against admin_validation-mode J rows. NO production flip (E4 ceiling).

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family J smoke audit | (prior) | **PARTIAL** | Phase 1-2 local green. Phase 3 hosted smoke NOT-RUN. Phase 4b persisted readback NOT-RUN (no admin_validation J rows yet). Prior verdict: PARTIAL; doctrine-risk inspection deferred. |
| **This amendment** | (this commit) | **PASS** | Phase 3 + 4b closed by operator-supplied admin_validation smoke. The doctrine-risk persisted evidence_span readback was performed against the first admin_validation sensitive_composer rows. Required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

## Phase 4 — Edge admin_validation cycle (Family J)

**Status:** PASS

```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
runMode: 'admin_validation' → HTTP 200; time_total=22s
```

Seeded args classified successfully; positives within the 5-key semantic_referee
set; no cross-family leakage. Source-uniform → no Edge-subset gap (the inverse of
the mixed-source D/G/I gates).

## Amendment §1 — Persisted direct-output readback (BINDING; doctrine-risk)

**Status:** PASS

The persisted evidence_span rows were queried for the J admin_validation runs and
scanned for person/intent drift:

```
SELECT res.raw_key, res.confidence, res.evidence_span FROM public.argument_machine_observation_results res JOIN public.argument_machine_observation_runs r ON r.id = res.run_id WHERE res.family = 'sensitive_composer' AND r.run_mode = 'admin_validation';
```

| raw_key | evidence_span (synthetic fixture text) | person/intent drift? |
| --- | --- | --- |
| shifts_to_person_or_intent | "you only push this because you work for an EV company" (the focus-shift wording verbatim) | NO |
| uses_popularity_as_evidence | "500 million people shared it, so that settles it" (the popularity-as-support wording verbatim) | NO |
| needs_pre_send_pause | "of COURSE you would say that, you ALWAYS do" (the reactive structural markers verbatim) | NO |

The persisted evidence_span anchored the STRUCTURAL feature (the focus-shift
wording / the popularity-leaned-on wording / the reactive markers) and did NOT
echo any person/intent label (ad hominem / personal attack / name calling /
bad actor) nor any shared banned token. The binding L5 obligation (persisted
argument_machine_observation_results.evidence_span inspection against the J
ban-list) is SATISFIED.

## Final upgraded verdict

**PASS** — Phase 4 admin_validation cycle supplied; the doctrine-risk persisted
evidence_span readback re-affirmed clean; Card 1 PARTIAL preserved and lifted to
the admin_validation ceiling. E4 ceiling stands — NO production flip.

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
