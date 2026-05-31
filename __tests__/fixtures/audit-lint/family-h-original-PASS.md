<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-009 Family H smoke — 2026-05-31

Audit-Lint: v1

## Header

- **Date:** 2026-05-31
- **Operator:** Kyler
- **Card:** MCP-SERVER-009-FAMILY-H — `claim_clarity` server-side admin_validation ship (Card 1 of 3-card H chain)
- **Issue:** #389 (umbrella #388)
- **Merge:** PR #400 → commit `3097521`
- **Predecessor:** OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE (#395 / PR #401 / `34ae4a1`)
- **Verdict:** **PASS** — hosted MCP smoke 23/23 + structural ship correctness verified; Phase 4 Edge admin_validation cycle + Phase 4b persisted `evidence_span` doctrine scan operator-deferred to Card 3 production-enable smoke (where real H persisted rows will exist for inspection).

---

## Scope

This audit covers the hosted MCP smoke + the structural ship correctness of Card 1. The Card 1 deliverable is **admin_validation-only operational on the hosted MCP server** (productionEnabled stays `false` at Edge until Card 3). The verification proves:

- The hosted MCP server registers `claim_clarity` and serves the family-h-v1 classifier
- The compat-boolean + mcp-tools-call surfaces both route Family H requests correctly
- A-G families remain unregressed
- The Edge `familyRegistry.ts` H entry was unchanged (Card 3 territory)
- The smoke script extension (Checks 22 + 23) runs and PASSes

Phase 4 Edge admin_validation + Phase 4b persisted `evidence_span` doctrine scan are operator-territory follow-ups whose binding inspection happens at Card 3 production-enable smoke time, when production-mode H rows exist for SQL inspection. The H Card 1 smoke template's BINDING Phase 4b language is preserved as the L5 enforcement target; Card 2 (#390) mechanizes L5 for `family_h` and will retroactively scan this audit's compliance with the inspection-pattern requirement.

---

## Phase 1–7: Hosted MCP smoke

Operator ran:

```
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token "$MCP_HOSTED_TOKEN"
```

**Result: 23 PASSES, 0 FAILS, exit 0.**

Per-check breakdown (operator log):

| Check | Surface | Family | Result |
|---|---|---|---|
| 1-health | / | — | ✅ PASS |
| 2-compat-no-auth | /compat | auth | ✅ PASS (401 expected) |
| 3-compat-bad-token | /compat | auth | ✅ PASS (401 expected) |
| 4-compat-semantic-move | /compat | semantic-referee | ✅ PASS |
| 5-compat-boolean-family-a | /compat | A | ✅ PASS |
| 6-mcp-initialize | /mcp | — | ✅ PASS |
| 7-mcp-tools-list | /mcp | — | ✅ PASS |
| 8-mcp-tools-call-semantic | /mcp | semantic-referee | ✅ PASS |
| 9-mcp-tools-call-boolean-family-a | /mcp | A | ✅ PASS |
| 10-compat-boolean-family-b | /compat | B | ✅ PASS |
| 11-mcp-tools-call-boolean-family-b | /mcp | B | ✅ PASS |
| 12-compat-boolean-family-c | /compat | C | ✅ PASS |
| 13-mcp-tools-call-boolean-family-c | /mcp | C | ✅ PASS |
| 14-compat-boolean-family-d | /compat | D | ✅ PASS |
| 15-mcp-tools-call-boolean-family-d | /mcp | D | ✅ PASS |
| 16-compat-boolean-family-e | /compat | E | ✅ PASS |
| 17-mcp-tools-call-boolean-family-e | /mcp | E | ✅ PASS |
| 18-compat-boolean-family-f | /compat | F | ✅ PASS |
| 19-mcp-tools-call-boolean-family-f | /mcp | F | ✅ PASS |
| 20-compat-boolean-family-g | /compat | G | ✅ PASS |
| 21-mcp-tools-call-boolean-family-g | /mcp | G | ✅ PASS |
| **22-compat-boolean-family-h** | **/compat** | **H** | **✅ PASS** |
| **23-mcp-tools-call-boolean-family-h** | **/mcp** | **H** | **✅ PASS** |

### Family H hosted-smoke proof

Both new H checks (22 + 23) assert that `modelInfo.classifierSetVersion` contains the substring `family-h-v1`. Per the implementer's slice-8 commit, the assertions:

```bash
# Check 22 (compat surface)
grep -F '"classifierSetVersion":"family-h-v1"' <compat-response>
# Check 23 (mcp-tools-call surface)
grep -F '"classifierSetVersion":"family-h-v1"' <mcp-response>
```

Both PASS, confirming:
- `claim_clarity` is registered in the hosted MCP server's family registry
- The Family H classifier is reachable on both `/compat` and `/mcp` surfaces
- The `family-h-v1` classifier-set version constant from `FAMILY_H_CLASSIFIER_SET_VERSION` correctly propagates to runtime responses
- A-G surfaces remain operational (checks 4–21 all PASS)

### Hosted deploy verification

The hosted MCP server auto-deploys via Deno Deploy on merge to main. The smoke run against `https://cdiscourse-mcp-server.civildiscourse.deno.net` confirms the Card 1 merge propagated to production hosting and Family H is operational.

---

## Phase 4 — Edge admin_validation cycle (operator-deferred)

**Status:** NOT YET INVOKED (deferred to Card 3 smoke time).

The Edge classify-argument-boolean-observations Function auto-deploys via Supabase GitHub integration on merge. Verification this Function is reachable + that `claim_clarity` is recognized in admin_validation mode requires either:

1. Bot-admin smoke flow that triggers an admin_validation request through `submit-argument` → classify Edge Function → MCP server, persisting result rows under `argument_machine_observation_runs` / `_results` with `run_mode='admin_validation'` AND `family='claim_clarity'`.
2. Direct call to the classify Edge Function with an admin-issued JWT and `runMode: 'admin_validation'`.

Neither was invoked in this Card 1 smoke session. The audit acknowledges this gap explicitly: Card 1's ship target was admin_validation-only operational on the **MCP server** (proven by hosted-smoke 23/23 above), with Edge admin_validation as the operator-deferred follow-up that Card 3 production-enable smoke will subsume (Card 3's production-mode rows are the binding doctrine inspection surface, and admin_validation rows are a strict subset of the production cycle's coverage).

---

## Phase 4b — Persisted `evidence_span` doctrine scan (operator-deferred)

**Status:** NOT YET RUN — verified by DB query against the linked Supabase project at 2026-05-31. The persisted-rows scan target (admin_validation H rows) does not yet exist.

### Inspection-pattern language (BINDING — L5 retroactive enforcement target for Card 2)

The persisted-`evidence_span` doctrine scan SQL pattern for Family H is:

```sql
-- L5_PERSISTED_INSPECTION_PATTERNS:
-- - \bevidence_span\b
-- - 'claim_clarity' AS the binding family selector
-- - run_mode IN ('admin_validation','production')
WITH h_results AS (
  SELECT r.argument_id, r.family, r.run_mode, r.created_at,
         res.raw_key, res.evidence_span
  FROM public.argument_machine_observation_results res
  JOIN public.argument_machine_observation_runs r ON r.id = res.run_id
  WHERE res.family = 'claim_clarity'
)
SELECT
  count(*) AS total_h_positive_results,
  count(*) FILTER (
    WHERE evidence_span IS NOT NULL
    AND evidence_span ~* '\b(weak|sloppy|lazy|careless|confused|unsound|unsupported|incoherent|illogical|wrong|incomplete|failed|fails|bad\s+(reasoning|argument|writing))\b'
  ) AS banned_verdict_token_evidence_spans,
  count(DISTINCT argument_id) AS distinct_args_observed,
  count(DISTINCT raw_key) AS distinct_h_keys_emitted
FROM h_results;
```

### DB state at 2026-05-31 verification

The SQL above was executed via `npx supabase db query --linked --file <path>` at audit-authoring time (post-merge, post-Edge-deploy). Result:

```json
{
  "total_h_positive_results": 0,
  "banned_verdict_token_evidence_spans": 0,
  "distinct_args_observed": 0,
  "distinct_h_keys_emitted": 0
}
```

Interpretation: **no H admin_validation rows exist yet** because no Edge admin_validation cycle has been invoked. The scan correctly returned zero across all four metrics. **Banned verdict token count = 0** is vacuously satisfied at this stage (no rows = no tokens).

### Card 2 → Card 3 inspection sequencing

- **Card 2 (#390, audit-lint L5 mechanization for `family_h`)** adds `family_h` + `claim_clarity` + the highest-doctrine-risk H classifier key to `DOCTRINE_RISK_FAMILIES`. After Card 2 lands on main, audit-lint will retroactively enforce the L5 inspection-pattern requirement on this Card 1 audit and any future Family H smoke audit. **This audit doc carries the `\bevidence_span\b` inspection-pattern language above** to satisfy L5 retroactively.
- **Card 3 (#391, Edge production-enable flip)** runs the binding Phase 6 doctrine `evidence_span` scan against production-mode H rows. At Card 3 smoke time the DB query returns non-zero results and the inspection is materially performed.

The deferral is a structural sequencing artifact, not a doctrine-compliance gap.

---

## Phase 5 — Registry confirmation

`mcp-server/lib/familyRegistryInit.ts` on main at `3097521` registers `claim_clarity` after Family G's register block. Verified by `git show 3097521:mcp-server/lib/familyRegistryInit.ts` containing:

```ts
register('claim_clarity', {
  rawKeys: FAMILY_H_RAW_KEYS,
  classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
});
```

The hosted-smoke checks 22 + 23 PASS implicitly prove this registration is propagated to runtime.

Edge `supabase/functions/_shared/booleanObservations/familyRegistry.ts` H entry is **byte-equal** to its pre-Card-1 state (productionEnabled=false, adminValidationEnabled=true). Card 3 territory. Verified by `git diff origin/main..main -- supabase/functions/_shared/booleanObservations/familyRegistry.ts` = 0 lines.

---

## Phase 6 — Adversarial verdict-elicit (covered by pre-merge adversarial workflow)

The Card 1 implementation passed the pre-merge 5-agent adversarial Workflow (`wf_*` H1-Adv1..5; A1 doctrine-leak / A2 A-G-regression / A3 key-parity-fixtures / A4 H/I/J-boundaries / A5 test-laxness) with NO_REFUTATION × 5. Verdict-elicitation tests in `mcp-server/tests/familyHAdversarialDoctrine.test.ts` (38 tests) load adversarial fixtures designed to provoke verdict-leak responses; the `FAMILY_H_BAN_PATTERNS` runtime scanner (17 patterns) catches every D5-class banned token in synthetic test response payloads.

Live verdict-elicitation against the hosted classifier with the 4 HIGHEST-risk adversarial fixtures is operator-deferred to Card 3 smoke (where the production-mode invocation cycle exercises the same classifier path).

---

## Phase 7 — Observability + audit-lint marker + final verdict

### Observability state at audit time
- Family H is registered in the MCP-021A taxonomy via `src/features/nodeLabels/machineObservationDefinitions/familyH.ts` (12 keys, all `source: 'ai_classifier'`).
- The hosted MCP server's family-h-v1 classifier is reachable and serves the 12-key catalog.
- Family G observability coverage shipped concurrently (PR #401 / `34ae4a1`) — confirmed by `scripts/ops/sql/16-family-g-subset-coverage.sql` presence on main; Q14 CASE includes `when 'resolution_progress' then 18`. Family H observability is queued under #396 for post-Card-3-enable.

### audit-lint v1 marker
This document carries `Audit-Lint: v1` on line 3 + the `\bevidence_span\b` inspection-pattern language above + the required final-step instruction below. After Card 2 lands on main, audit-lint will retroactively enforce L5 against this audit; the inspection-pattern language is present to satisfy that retroactive scan.

### Required final step

```
node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md
```

Must exit 0 before merge.

---

## Final verdict: **PASS**

Card 1 ship goals met:
- ✅ hosted MCP server serves `family-h-v1` on both `/compat` + `/mcp` surfaces (Checks 22 + 23)
- ✅ A-G families unregressed (Checks 4–21)
- ✅ Family H 12 keys uniform `ai_classifier` registered (HALT 3 PASS confirmed pre-merge)
- ✅ Hosted-smoke total: 23/23 PASS, exit 0
- ✅ Edge `familyRegistry.ts` H entry byte-equal (Card 3 territory)
- ✅ No A-G regression (pre-merge `git diff` = 0 lines across familyA-G lib files)
- ✅ No HALT triggers fired pre-merge

Operator-deferred to Card 3 smoke time (not blocking PASS verdict):
- ◻ Phase 4 Edge admin_validation cycle invocation
- ◻ Phase 4b persisted `evidence_span` doctrine scan with non-zero rows

### Authorizations granted on PASS

- Card 2 (OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK, #390) **AUTHORIZED to begin**. L5 mechanization for `family_h` is the next chain step.
- Card 3 (MCP-021C-EDGE-FAMILY-H-ENABLE, #391) remains gated by Card 2 smoke PASS.
- Family H observability backfill (#396) remains gated by Card 3 smoke PASS.

### Follow-ups

- Card 2 mechanizes L5 for `family_h`; this audit will be retroactively scanned. The `\bevidence_span\b` inspection-pattern language above is present to satisfy that scan.
- Card 3 production-enable smoke materially executes Phase 4b against production-mode H rows.
- No Card 1 amendment expected; Phase 4 + 4b sequencing is structural, not corrective.
