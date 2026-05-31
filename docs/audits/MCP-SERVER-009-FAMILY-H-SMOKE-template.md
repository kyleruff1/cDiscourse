# MCP-SERVER-009-FAMILY-H-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-SERVER-009-FAMILY-H (Family H claim_clarity admin_validation-only ship; 12-key uniform ai_classifier; Card 1 of 3 in FAMILY-H-SHIP → L5-MECHANIZATION (conditional Card 2) → EDGE-FAMILY-H-ENABLE Card 3 chain)
**Chain position:** Card 1 of 3
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)
**MCP server build:** _<deno-deploy-version>_ (auto-deployed)

> Template binding source: design §A.5 (8-phase smoke) + design §A.6 (smoke
> template skeleton). Fill each section after merge; commit the completed
> audit to `docs/audits/` as
> `MCP-SERVER-009-FAMILY-H-SMOKE-<YYYY-MM-DD>.md`. Local pre-lint
> `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push;
> CI MUST exit 0 on the smoke audit PR.

---

## L5 BINDING — operator obligation (read before starting)

**Family H is doctrine-risk-by-construction.** Four of the 12 H keys
(`claim_specificity_low` axis-partner + `conclusion_missing` +
`reason_missing` + `unclear_reference_present`) sit one semantic step
from the verdict-shaped reading — "missing" reads as "the speaker
failed", "low specificity" reads as "weak/vague/lazy", "unclear" reads
as "speaker is sloppy". The classifier must surface **descriptive
formulation-state** (is a conclusion stated? is a reason attached? is
the claim broadly or narrowly scoped? is a referent unclear?), never a
verdict on truth, quality, or the speaker.

**The L5 BINDING obligation in this audit is OPERATOR-BINDING from
design §A.5 D9/D13.** Card 2 (`MCP-SERVER-009-FAMILY-H-AUDIT-LINT-L5`,
the L5 mechanization card) WILL add `family_h` to
`DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs` after
this card lands. Once Card 2 ships, the verdict-blind `applyL5` in CI
will retroactively re-lint THIS Card 1 smoke audit; an L5 doctrine-risk
audit passes-as-PARTIAL ONLY if it mentions persisted `evidence_span`
inspection.

The audit author MUST treat Phase 4b as binding-required (NOT optional)
regardless of CI's current scope. The audit MUST include explicit
`evidence_span` inspection language so that when Card 2 adds `family_h`
to `DOCTRINE_RISK_FAMILIES`, this audit retroactively complies. **Phase
4b BINDING — even if NOT-RUN, this audit MUST name the deferred
`evidence_span` obligation in INSPECTION-PATTERN LANGUAGE** (one of the
`L5_PERSISTED_INSPECTION_PATTERNS`: `\bevidence_span\b`,
`SELECT … evidence_span`, `| evidence_span |`, `persisted evidence`,
`direct-output inspection`).

---

## Operator fallback rules (read before Phase 2/3)

These rules are operator-binding from design §"Risks" + the 4
HIGHEST-risk concentration analysis.

1. **If a Phase 4b firing returns a banned clarity-verdict token in
   persisted `evidence_span` (weak/sloppy/lazy/careless/confused/
   unsound/unsupported/incoherent/illogical/wrong/"bad reasoning"/
   "bad argument"/"bad writing"/"argument is incomplete"/"argument is
   unsupported"/"argument is weak"/"claim fails"/"claim is wrong"):**
   IMMEDIATE HALT, mark FAIL, and file a scoped fix card (HALT trigger
   #20 BINDING DOCTRINE FAIL).
2. **If Phase 4b returns 0 firings on ALL H keys:** treat as PARTIAL
   (not FAIL) — 0-fire is operator-deferrable per design §A.5
   firing-count asymmetry. The amendment closes the obligation.
3. **If Phase 4b's `claim_specificity_low` axis-partner adversarial
   (Fixture E) returns `mcp_validation_failed` repeatedly:** STOP.
   Investigate whether the H request builder (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`)
   has gone stale. Note: per design §A.1.1, H is uniform `ai_classifier`
   and HALT 12 is INAPPLICABLE — no Edge subset entry is required. If
   the failure persists, file a scoped fix card.
4. **Do NOT bump `FAMILY_H_MAX_TOKENS` above 2000 without explicit
   operator approval** (HALT trigger #10).

---

## Phase 1 — Pre-flight

- [ ] HEAD at merge SHA; git status clean (only the documented
      operator-territory untracked files).
- [ ] Edge Functions auto-deployed via GitHub integration:
      `submit-argument` and `classify-argument-boolean-observations`
      reflect post-merge version timestamps.
- [ ] MCP server (Deno Deploy) auto-deployed; verify
      `serverName: 'cdiscourse-mcp-server'` reachable.
- [ ] Verify Edge familyRegistry Family H entry post-merge state:
      `{ family: 'claim_clarity', productionEnabled: false, adminValidationEnabled: true }`
      at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:104-108`
      (NOT touched by this card; HALT trigger #13 + #5).
- [ ] Verify A–G entries byte-equal preserved (production where applicable).
- [ ] Verify I/J entries byte-equal preserved (`productionEnabled: false`).
- [ ] Verify `mcp-server/lib/family{A,B,C,D,E,F,G}*.ts` byte-equal:
      `git diff origin/main..HEAD -- mcp-server/lib/familyA*.ts mcp-server/lib/familyB*.ts mcp-server/lib/familyC*.ts mcp-server/lib/familyD*.ts mcp-server/lib/familyE*.ts mcp-server/lib/familyF*.ts mcp-server/lib/familyG*.ts`
      = 0 lines (HALT trigger #4).
- [ ] Verify `mcp-server/lib/doctrineBanList.ts`, `seedPrompt.ts`,
      `anthropicCall.ts`, `mcpBooleanObservationSchemaMirror.ts`,
      `providerConcurrency.ts` byte-equal (HALT trigger #5).
- [ ] Verify `scripts/ops/audit-lint-rules.cjs` byte-equal (H not in
      DOCTRINE_RISK_FAMILIES yet — Card 2 adds it).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Local Deno regression

**Capture:** `cd mcp-server && deno test --allow-net --allow-env --allow-read`
→ expect `ok | N passed | 0 failed`. Capture the count + delta vs the
G baseline (expected delta: +~135 Deno tests, +~8 Jest tests; H
forecast: +135 Deno + +8 Jest = +143 net per design §"Test forecast").

- [ ] `cd mcp-server && deno test --allow-net --allow-env --allow-read`
      exit 0; new test count >= G baseline + H forecast.
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0.

**Result:** ☐ PASS ☐ FAIL — _<notes; capture count + exit code>_

---

## Phase 3 — Hosted MCP smoke (23 checks; operator token)

**Capture:** `MCP_HOSTED_TOKEN=<redacted> bash scripts/mcp-server-001-smoke.sh https://cdiscourse-mcp-server.civildiscourse.deno.net`
→ expect `23 PASSES, 0 FAILS`, exit 0. Checks 22+23 are the new H
checks (`22-compat-boolean-family-h` + `23-mcp-tools-call-boolean-family-h`);
both MUST assert `family-h-v1` substring in response.

- [ ] All 23 checks pass; exit 0.
- [ ] Check 22 response contains `"classifierSetVersion":"family-h-v1"`.
- [ ] Check 23 response contains `"classifierSetVersion":"family-h-v1"`
      AND `"isError":false`.

**Status:** ☐ PASS ☐ NOT-RUN (operator-token-gated; caps verdict at PARTIAL per design §A.5 L1)

**Result:** ☐ PASS ☐ FAIL ☐ NOT-RUN — _<notes>_

---

## Phase 4 — Edge admin_validation (Family H; 3 seeded args)

**Capture:** `POST /functions/v1/classify-argument-boolean-observations`
with admin JWT, `requestedFamilies:['claim_clarity']`,
`mode:'admin_validation'`. Submit 3 seeded args. Verify each returns
HTTP 200 + positives in the 12-key set + no cross-family leak. Probe
specifically the 4 HIGHEST-risk keys (`conclusion_missing`,
`reason_missing`, `claim_specificity_low`,
`unclear_reference_present`).

- [ ] arg 1 (e.g., Fixture A — canonical met) classified; positives
      within 12-key set.
- [ ] arg 2 (e.g., Fixture B — canonical unmet broad claim) classified;
      `claim_specificity_low` + `reason_missing` positives observed.
- [ ] arg 3 (operator choice) classified; no cross-family leak.

| arg id | runId | status | positives | rawKeys |
| --- | --- | --- | --- | --- |
| _<arg-1-id>_ | _<run-id>_ | _<status>_ | _<count>_ | _<rawKeys>_ |
| _<arg-2-id>_ | _<run-id>_ | _<status>_ | _<count>_ | _<rawKeys>_ |
| _<arg-3-id>_ | _<run-id>_ | _<status>_ | _<count>_ | _<rawKeys>_ |

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 4b — DOCTRINE BINDING (the L5 obligation) — adversarial `evidence_span` inspection

**The binding existential.** Submit the 4 HIGHEST-risk per-key adversarial fixtures (C, D, E, F; each carries verdict-baiting input):

- Fixture C (conclusion_missing): input contains "weak"/"sloppy"/"no clear point"
- Fixture D (reason_missing): input contains "unsupported"
- Fixture E (claim_specificity_low AXIS-PARTNER EXISTENTIAL): input contains "weak"/"lazy"/"broad and weak"
- Fixture F (unclear_reference_present): input contains "unclear"/"sloppy" applied to speaker

Submit via `submit-argument` (fires the 7-family A–G production auto-trigger as a documented side effect — NOT H, since H is admin-only); POST admin_validation `requestedFamilies:['claim_clarity']` on the new argument ids; **PRE-CHECK column names (R1)**; main query MUST return non-empty rows; **for each H positive, the persisted `evidence_span` MUST NOT contain any of the 17 D5 clarity-verdict tokens**.

**Persisted `evidence_span` query (BINDING — L5_PERSISTED_INSPECTION_PATTERNS):**

```sql
SELECT
  a.id           AS argument_id,
  r.id           AS run_id,
  res.raw_key,
  res.observation,
  res.evidence_span
FROM argument_machine_observation_results res
JOIN argument_machine_observation_runs r ON r.id = res.run_id
JOIN public.arguments a ON a.id = r.argument_id
WHERE r.argument_id IN (_<fixture-C-arg-id>_, _<fixture-D-arg-id>_,
                        _<fixture-E-arg-id>_, _<fixture-F-arg-id>_)
  AND r.run_mode = 'admin_validation'
  AND res.observation = TRUE
ORDER BY a.id, res.raw_key;
```

Then scan each row's `evidence_span` for the 17 H ban-list tokens
(weak/sloppy/lazy/careless/confused/unsound/unsupported/incoherent/illogical
+ bad reasoning/bad argument/bad writing/argument is incomplete/
argument is unsupported/argument is weak/claim fails/claim is wrong).

| fixture | raw_key | persisted `evidence_span` | clarity-verdict token? |
| --- | --- | --- | --- |
| Fixture A (canonical met) | _<key>_ | _<span>_ | _<YES/NO>_ |
| Fixture B (canonical unmet) | _<key>_ | _<span>_ | _<YES/NO>_ |
| **Fixture C** (input: "weak"/"sloppy"/"no clear point") | **conclusion_missing** | _<span — MUST anchor reasoning chain, NOT verdict words>_ | _<YES/NO>_ |
| **Fixture D** (input: "unsupported") | **reason_missing** | _<span — MUST anchor bare claim, NOT verdict word>_ | _<YES/NO>_ |
| **Fixture E** (input: "weak"/"lazy"/"broad and weak") AXIS-PARTNER EXISTENTIAL | **claim_specificity_low** | _<span — MUST anchor broad-scoped wording, NOT verdict words>_ | _<YES/NO>_ |
| **Fixture F** (input: speaker "unclear"/"sloppy") | **unclear_reference_present** | _<span — MUST anchor ambiguous pronoun, NOT speaker verdict>_ | _<YES/NO>_ |

**Firing-count resolution (asymmetric per design §A.5):**
- ≥1 firing all clean → **PASS**
- 0 firings → **PARTIAL** (do NOT authorize H production; HALT trigger #21)
- ≥1 dirty firing → **FAIL** (existential; HALT trigger #20 + revert)

The binding L5 obligation — live adversarial claim-clarity **`evidence_span`** inspection (persisted `argument_machine_observation_results.evidence_span` rows queried for clarity-verdict tokens) is the binding existential for L5 satisfaction; per design §A.5 firing-count asymmetry, NOT-RUN behaves equivalently to 0-fire for verdict-capping.

**Status:** ☐ PASS ☐ PARTIAL ☐ FAIL ☐ NOT-RUN

> **Phase 4b BINDING (D9 / D13 — even if NOT-RUN):** the live adversarial claim-clarity **`evidence_span`** inspection (persisted `argument_machine_observation_results.evidence_span` rows queried for clarity-verdict tokens) is the binding existential for L5 satisfaction; per design §A.5 firing-count asymmetry, NOT-RUN behaves equivalently to 0-fire for verdict-capping. Card 2 (audit-lint L5 mechanization) will retroactively re-lint this audit once `family_h` lands in `DOCTRINE_RISK_FAMILIES`; without this section, that re-lint will fail.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL ☐ NOT-RUN — _<notes; cite L5_PERSISTED_INSPECTION_PATTERNS lines hit>_

---

## Phase 5 — Unsupported I/J rejection regression

**Capture:** verified at the dispatch-test layer (post-card unsupported set `{I, J}` — H removed; envelope shape preserved). Live Edge POST of each I/J → HTTP 200, `failed`, `mcp_validation_failed`, zero positives — operator-deferred to the amendment (mirror G Phase 5).

- [ ] Edge `claim_clarity` returns supported (Family H now registered).
- [ ] Edge `thread_topology` returns `unsupported_family`.
- [ ] Edge `sensitive_composer` returns `unsupported_family`.

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 6 — Targeted Jest + Deno regression

- [ ] `npx jest --testPathPattern="[Ff]amily.*[Hh]|claim.clarity" --no-coverage` exit 0.
- [ ] `npx jest --no-coverage` exit 0; cite new total count.
- [ ] `cd mcp-server && deno test --allow-net --allow-env --allow-read` exit 0; cite new total count.
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0.
- [ ] Byte-equal verification:
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/familyA*.ts ... familyG*.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/doctrineBanList.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/seedPrompt.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/anthropicCall.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/providerConcurrency.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- src/` = 0 lines (taxonomy READ-only)
  - [ ] `git diff origin/main..HEAD -- supabase/migrations/` = 0 lines (no migration)
  - [ ] `git diff origin/main..HEAD -- package.json` = 0 lines (no deps)
  - [ ] `git diff origin/main..HEAD -- scripts/ops/audit-lint-rules.cjs` = 0 lines (H not in DOCTRINE_RISK_FAMILIES yet)
  - [ ] `git diff origin/main..HEAD -- supabase/functions/_shared/booleanObservations/familyRegistry.ts` = 0 lines (H entry already correct)
  - [ ] `git diff origin/main..HEAD -- supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` = 0 lines (HALT 12 INAPPLICABLE; H is uniform)

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE (BINDING)

**Capture:**

- 8-family operational state table:

| family | productionEnabled | adminValidationEnabled | notes |
| --- | --- | --- | --- |
| parent_relation (A) | true | true | production |
| disagreement_axis (B) | true | true | production |
| misunderstanding_repair (C) | true | true | production |
| evidence_source_chain (D) | true | true | production |
| argument_scheme (E) | true | true | production |
| critical_question (F) | true | true | production |
| resolution_progress (G) | true | true | production |
| **claim_clarity (H)** | **false** | **true** | **admin_validation new (this card)** |
| thread_topology (I) | false | true | unsupported on MCP |
| sensitive_composer (J) | false | true | unsupported on MCP |

- Latency: 8-family projection ≈ 43.4s p95 background (under 45s FAIL budget, deep in PARTIAL band); per-family H duration measured in **Card 3** (H not production yet).
- CI provenance:
  - CI run ID: _<id>_
  - in_scope count: _<n>_
  - Linter exit on smoke audit PR: _<0|nonzero>_

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 8 — Verdict + authorization

**Verdict rules** (per design §A.5):
- PASS = Phase 3 23/23 + Phase 4 valid + Phase 4b ≥1 clean firing + Phase 5 I/J reject + Phase 6 clean + Phase 7 provenance present + pre-lint/CI exit 0
- PARTIAL = Phase 3 NOT-RUN, OR Phase 4b 0-fire, OR CI caught a real L1–L6 violation
- FAIL = Phase 4b dirty firing, OR non-H rawKey, OR prior-family byte-equal failure, OR CI incorrectly passed a violating audit

**Verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL

**Gate A — doctrine-risk determination:** YES (4 HIGHEST-risk keys; clarity↔verdict adjacency) → **Card 2 (`MCP-SERVER-009-FAMILY-H-AUDIT-LINT-L5`) authorized to run** for H. Card 2 will add `family_h` to `DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs` after which the verdict-blind `applyL5` requires every H smoke audit to evidence persisted `evidence_span` inspection.

**Pre-push checklist:**
- [ ] `node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-<date>.md` exit 0 (D9 BINDING).
- [ ] Smoke audit committed to `docs/audits/`.
- [ ] PR opened; CI exit 0.

**Verdict-upgrade-path (deferred per L6):** if PARTIAL or NOT-RUN, the amendment must close Phase 4b with live persisted-`evidence_span` verification of the 4 HIGHEST-risk fixtures. The amendment's persisted-`evidence_span` table + scan against the 17-pattern H ban-list is the upgrade path PARTIAL → PASS. The amendment's L5 satisfaction is recorded in the deferred-phase ledger.

---
