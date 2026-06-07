# MCP-SERVER-010-FAMILY-I-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-SERVER-010-FAMILY-I (Family I thread_topology admin_validation-only ship; 6-key ai_classifier MIXED-source Subset; Card 1 of a 2-card chain in FAMILY-I-SHIP → EDGE-FAMILY-I-ENABLE Card 3 chain. Card 2 — L5 mechanization — is SKIPPABLE given LOW doctrine-risk per design §3/D11.)
**Chain position:** Card 1 of 2 (admin ship → Gate A → Card 3 production-enable; Card 2 L5 mechanization SKIPPED)
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)
**MCP server build:** _<deno-deploy-version>_ (auto-deployed)

> Template binding source: design §A.5 (8-phase smoke) + design §A.6 (smoke
> template skeleton). Fill each section after merge; commit the completed
> audit to `docs/audits/` as
> `MCP-SERVER-010-FAMILY-I-SMOKE-<YYYY-MM-DD>.md`. Local pre-lint
> `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push;
> CI MUST exit 0 on the smoke audit PR.

---

## Doctrine-risk = LOW — operator obligation (read before starting)

**Family I is doctrine-risk = LOW by construction** (design §A.1.2 / §3 / D11).
All 6 Family I ai_classifier keys (`introduces_new_issue`,
`references_prior_agreement`, `introduces_sub_axis`, `returns_to_prior_issue`,
`references_external_context`, `compares_options`) are **thread-graph topology
relations** — they describe HOW A MOVE RELATES TO THE CONVERSATION GRAPH, not
the move's merit. There is **no verdict-adjacent / HIGHEST-risk key**: the one
verdict-adjacent candidate `repeats_prior_point` was DROPPED upstream
(`familyI.ts:28-30`, Trigger-10 doctrine-risk: "repeats reads as verdict on
contribution") before this card. The two keys with any *misreading* surface
(`introduces_new_issue` — "off-topic"; `returns_to_prior_issue` — "rehashing")
carry verbatim proportional doctrine guards.

**Consequence (D11): Card 2 (L5 mechanization — adding `family_i` to
`DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs`) is
SKIPPABLE.** Gate A records doctrine-risk = LOW, which AUTHORIZES the
Card-2 SKIP (the suite collapses to a 2-card chain — Card 1 admin ship →
Gate A → Card 3 production-enable). This mirrors the Family E precedent
(uniform, LOW-risk → no L5 mechanization card) rather than the F/G/H precedent.

**Forward-safety (D10): Phase 4b is at NORMAL intensity (not the
existential-FAIL intensity H's was), BUT this audit STILL includes the
persisted `evidence_span` inspection language as a forward-safety precaution.**
If the operator later reverses the Card-2 SKIP and adds `family_i` to
`DOCTRINE_RISK_FAMILIES`, the verdict-blind `applyL5` in CI will retroactively
re-lint THIS Card 1 smoke audit; an L5 doctrine-risk audit passes-as-PARTIAL
ONLY if it mentions persisted `evidence_span` inspection. The cost of including
the language is zero; the cost of omitting it (if the SKIP is reversed) is a
retroactive lint failure. The audit therefore names the deferred
`evidence_span` obligation in INSPECTION-PATTERN LANGUAGE (one of the
`L5_PERSISTED_INSPECTION_PATTERNS`: `\bevidence_span\b`,
`SELECT … evidence_span`, `| evidence_span |`, `persisted evidence`,
`direct-output inspection`).

---

## Operator fallback rules (read before Phase 2/3)

These rules are operator-binding from design §"Risks".

1. **If a Phase 4b firing returns a banned topology-verdict token in
   persisted `evidence_span` (off-topic / derailing / evasive / rehashing /
   repetitive / "going in circles" / "changing the subject" / "beating a dead
   horse"):** IMMEDIATE HALT, mark FAIL, and file a scoped fix card (HALT
   trigger #20 BINDING DOCTRINE FAIL). Even at LOW doctrine-risk, a dirty
   firing is a HALT + revert.
2. **If Phase 4b returns 0 firings on ALL I keys:** treat as PARTIAL (not
   FAIL) — 0-fire is operator-deferrable and EXPECTED to be common (topology
   positives are sparse) per design §A.5 firing-count asymmetry (HALT trigger
   #21). The amendment closes the obligation.
3. **If Phase 4 Family I admin_validation through the MCP path returns
   `mcp_validation_failed` repeatedly:** this is the EXPECTED Edge-subset gap
   (design §"Risks" / R1 / §D2). The Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`
   entry for `thread_topology` is DEFERRED to a separate Edge-subset follow-up
   card / Card 3 — without it the Edge sends all 21 registry rawKeys and the
   MCP server rejects the 15 deterministic keys with `unsupported_rawKey`.
   Document the gate; do NOT silently add the Edge entry to "fix" Phase 4 (that
   would make the card Edge-bearing and contradict §D2; HALT trigger #14).
4. **Do NOT bump `FAMILY_I_MAX_TOKENS` above 2000 without explicit operator
   approval** (HALT trigger #10). Designer forecast: no bump needed (6 keys,
   ~990 headroom).

---

## Phase 1 — Pre-flight

- [ ] HEAD at merge SHA; git status clean (only the documented
      operator-territory untracked files).
- [ ] Edge Functions auto-deployed via GitHub integration:
      `submit-argument` and `classify-argument-boolean-observations`
      reflect post-merge version timestamps.
- [ ] MCP server (Deno Deploy) auto-deployed; verify
      `serverName: 'cdiscourse-mcp-server'` reachable.
- [ ] Verify Edge familyRegistry Family I entry post-merge state:
      `{ family: 'thread_topology', productionEnabled: false, adminValidationEnabled: true }`
      at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:110-113`
      (NOT touched by this card; HALT trigger #13 + #5).
- [ ] Verify A–H entries byte-equal preserved (production where applicable; H admin-only or in-flight per its Card-3 chain).
- [ ] Verify J entry byte-equal preserved (`productionEnabled: false`).
- [ ] Verify `mcp-server/lib/family{A,B,C,D,E,F,G,H}*.ts` byte-equal:
      `git diff origin/main..HEAD -- mcp-server/lib/familyA*.ts mcp-server/lib/familyB*.ts mcp-server/lib/familyC*.ts mcp-server/lib/familyD*.ts mcp-server/lib/familyE*.ts mcp-server/lib/familyF*.ts mcp-server/lib/familyG*.ts mcp-server/lib/familyH*.ts`
      = 0 lines (HALT trigger #4).
- [ ] Verify `mcp-server/lib/doctrineBanList.ts`, `seedPrompt.ts`,
      `anthropicCall.ts`, `mcpBooleanObservationSchemaMirror.ts`,
      `providerConcurrency.ts` byte-equal (HALT trigger #5).
- [ ] Verify `scripts/ops/audit-lint-rules.cjs` byte-equal (I NOT in
      DOCTRINE_RISK_FAMILIES — Card 2 SKIPPED per LOW doctrine-risk).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Local Deno regression

**Capture:** `cd mcp-server && deno test --allow-net --allow-env --allow-read`
→ expect `ok | N passed | 0 failed`. Capture the count + delta vs the
H baseline (design forecast: +~111 Deno tests; implementer reported
+138 net Deno + +8 Jest — within the HALT-8 ceiling of +250).

- [ ] `cd mcp-server && deno test --allow-net --allow-env --allow-read`
      exit 0; new test count >= H baseline + I forecast.
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0.

**Result:** ☐ PASS ☐ FAIL — _<notes; capture count + exit code>_

---

## Phase 3 — Hosted MCP smoke (25 checks; operator token)

**Capture:** `MCP_HOSTED_TOKEN=<redacted> bash scripts/mcp-server-001-smoke.sh https://cdiscourse-mcp-server.civildiscourse.deno.net`
→ expect `25 PASSES, 0 FAILS`, exit 0. Checks 24+25 are the new I
checks (`24-compat-boolean-family-i` + `25-mcp-tools-call-boolean-family-i`);
both MUST assert `family-i-v1` substring in response. This is the GATE-C
Deno-redeploy verification (until Phase 3 passes 25/25 on the hosted URL,
Family I is not live on the server).

- [ ] All 25 checks pass; exit 0.
- [ ] Check 24 response contains `"classifierSetVersion":"family-i-v1"`.
- [ ] Check 25 response contains `"classifierSetVersion":"family-i-v1"`
      AND `"isError":false`.

**Status:** ☐ PASS ☐ NOT-RUN (operator-token-gated; caps verdict at PARTIAL per design §A.5 L1)

**Result:** ☐ PASS ☐ FAIL ☐ NOT-RUN — _<notes>_

---

## Phase 4 — Edge admin_validation (Family I; ≥3 seeded args)

**Capture:** `POST /functions/v1/classify-argument-boolean-observations`
with admin JWT, `requestedFamilies:['thread_topology']`,
`mode:'admin_validation'`. Submit ≥3 seeded args. Verify each returns
HTTP 200 + positives in the 6-key set + no cross-family leak; the 15
excluded deterministic keys never appear.

**PRE-CHECK the Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` gap (R1 / §D2):**
if Family I is requested through the MCP path WITHOUT the Edge subset entry,
the Edge will send all 21 registry rawKeys → the MCP server rejects the 15
deterministic keys with `unsupported_rawKey` → `mcp_validation_failed`. This
Phase 4 step is the live confirmation of the §D2 decision — admin_validation
Family I through the MCP path is GATED on the follow-up Edge-subset card
(exactly as Family G's #355 was). If this gate blocks Phase 4 live, the smoke
is PARTIAL.

- [ ] arg 1 (e.g., Fixture A — canonical new-issue) classified; positives
      within 6-key set.
- [ ] arg 2 (e.g., Fixture B — canonical comparison + sub-axis) classified;
      `introduces_sub_axis` + `compares_options` positives observed.
- [ ] arg 3 (operator choice) classified; no cross-family leak; no excluded
      deterministic key appears.

| arg id | runId | status | positives | rawKeys |
| --- | --- | --- | --- | --- |
| _<arg-1-id>_ | _<run-id>_ | _<status>_ | _<count>_ | _<rawKeys>_ |
| _<arg-2-id>_ | _<run-id>_ | _<status>_ | _<count>_ | _<rawKeys>_ |
| _<arg-3-id>_ | _<run-id>_ | _<status>_ | _<count>_ | _<rawKeys>_ |

**Result:** ☐ PASS ☐ PARTIAL (Edge-subset gap deferred) ☐ FAIL — _<notes>_

---

## Phase 4b — DOCTRINE (NORMAL intensity per LOW doctrine-risk) — adversarial `evidence_span` inspection

**NORMAL intensity (LOW doctrine-risk).** Submit the 2 boundary-adversarial fixtures (C, D; each carries motive-verdict-baiting input):

- Fixture C (introduces_new_issue): input contains "dodging"/"changing the subject"/"evasive"/"off-topic"
- Fixture D (returns_to_prior_issue): input contains "rehashing"/"going in circles"

Submit via `submit-argument` (fires the production A–H auto-trigger as a documented side effect — NOT I, since I is admin-only); POST admin_validation `requestedFamilies:['thread_topology']` on the new argument ids; **PRE-CHECK column names (R1)**; for each I positive, the persisted **`evidence_span`** MUST NOT contain any of the 8 D6 topology-verdict tokens NOR any shared banned token.

**Persisted `evidence_span` query (forward-safety; L5_PERSISTED_INSPECTION_PATTERNS):**

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
WHERE r.argument_id IN (_<fixture-C-arg-id>_, _<fixture-D-arg-id>_)
  AND r.run_mode = 'admin_validation'
  AND res.observation = TRUE
ORDER BY a.id, res.raw_key;
```

Then scan each row's `evidence_span` for the 8 I ban-list tokens
(off-topic / derailing / evasive / rehashing / repetitive / "going in circles"
/ "changing the subject" / "beating a dead horse").

| fixture | raw_key | persisted `evidence_span` | topology-verdict token? |
| --- | --- | --- | --- |
| Fixture A (canonical new-issue) | _<key>_ | _<span>_ | _<YES/NO>_ |
| Fixture B (canonical comparison) | _<key>_ | _<span>_ | _<YES/NO>_ |
| **Fixture C** (input: "dodging"/"changing the subject"/"evasive"/"off-topic") | **introduces_new_issue** | _<span — MUST anchor the new-topic wording, NOT verdict words>_ | _<YES/NO>_ |
| **Fixture D** (input: "rehashing"/"going in circles") | **returns_to_prior_issue** | _<span — MUST anchor the re-engagement + new evidence, NOT verdict words>_ | _<YES/NO>_ |

**Firing-count resolution (asymmetric per design §A.5):**
- ≥1 firing all clean → **PASS**
- 0 firings → **PARTIAL** (unremarkable; topology positives are sparse; HALT trigger #21)
- ≥1 dirty firing → **FAIL** (HALT trigger #20 + revert)

**Status:** ☐ PASS ☐ PARTIAL ☐ FAIL ☐ NOT-RUN

> **Phase 4b forward-safety (D10 — even if NOT-RUN):** Phase 4b (NORMAL
> intensity per LOW doctrine-risk verdict; optional per audit-lint-rules.cjs
> `family-ship` set) is operator-run — the live thread-topology **`evidence_span`**
> inspection (persisted `argument_machine_observation_results.evidence_span`
> rows queried for topology-verdict tokens) is the descriptive-clean
> verification; per firing-count asymmetry, NOT-RUN / 0-fire behaves as PARTIAL
> for verdict-capping. This language is retained as forward-safety should
> `family_i` later be added to `DOCTRINE_RISK_FAMILIES`.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL ☐ NOT-RUN — _<notes; cite L5_PERSISTED_INSPECTION_PATTERNS lines hit>_

---

## Phase 5 — Unsupported J rejection regression

**Capture:** verified at the dispatch-test layer (post-card unsupported set `{J}` only — I removed; envelope shape preserved). Live Edge POST of J → HTTP 200, `failed`, `mcp_validation_failed`, zero positives — operator-deferred to the amendment (mirror G/H Phase 5).

- [ ] Edge `thread_topology` returns supported (Family I now registered).
- [ ] Edge `sensitive_composer` returns `unsupported_family`.

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 6 — Targeted Jest + Deno regression

- [ ] `npx jest --testPathPattern="[Ff]amily.*[Ii]|thread.topology" --no-coverage` exit 0.
- [ ] `npx jest --no-coverage` exit 0; cite new total count.
- [ ] `cd mcp-server && deno test --allow-net --allow-env --allow-read` exit 0; cite new total count.
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0.
- [ ] Byte-equal verification:
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/familyA*.ts ... familyH*.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/doctrineBanList.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/seedPrompt.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/anthropicCall.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/providerConcurrency.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- src/` = 0 lines (taxonomy READ-only)
  - [ ] `git diff origin/main..HEAD -- supabase/migrations/` = 0 lines (no migration)
  - [ ] `git diff origin/main..HEAD -- package.json` = 0 lines (no deps)
  - [ ] `git diff origin/main..HEAD -- scripts/ops/audit-lint-rules.cjs` = 0 lines (I not in DOCTRINE_RISK_FAMILIES; Card 2 SKIPPED)
  - [ ] `git diff origin/main..HEAD -- supabase/functions/_shared/booleanObservations/familyRegistry.ts` = 0 lines (I entry already correct; HALT 13)
  - [ ] `git diff origin/main..HEAD -- supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` = 0 lines (HALT 14; Edge subset entry deferred per §D2)

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE (BINDING)

**Capture:**

- 9-family operational state table:

| family | productionEnabled | adminValidationEnabled | notes |
| --- | --- | --- | --- |
| parent_relation (A) | true | true | production |
| disagreement_axis (B) | true | true | production |
| misunderstanding_repair (C) | true | true | production |
| evidence_source_chain (D) | true | true | production |
| argument_scheme (E) | true | true | production |
| critical_question (F) | true | true | production |
| resolution_progress (G) | true | true | production |
| claim_clarity (H) | _<false or true>_ | true | admin_validation [or production if H Card-3 landed] |
| **thread_topology (I)** | **false** | **true** | **admin_validation new (this card)** |
| sensitive_composer (J) | false | true | unsupported on MCP |

- Latency: note the 9-family projection but state I's per-family duration is
  measured in **Card 3** (I not production yet); reference the
  bounded-concurrency parallelization (limit 2; p95 34.6s→19.3s) + the #365
  burst hazard. This card adds **zero latency to the production path** (I is
  admin_validation-only and never enters the production auto-trigger).
- CI provenance:
  - CI run ID: _<id>_
  - in_scope count: _<n>_
  - Linter exit on smoke audit PR: _<0|nonzero>_

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 8 — Verdict + authorization

**Verdict rules** (per design §A.5):
- PASS = Phase 3 25/25 + Phase 4 valid + Phase 4b ≥1 clean firing (or 0-fire PARTIAL) + Phase 5 J reject + Phase 6 clean + Phase 7 provenance present + pre-lint/CI exit 0
- PARTIAL = Phase 3 NOT-RUN, OR Phase 4b 0-fire, OR the Edge subset gap blocks Phase 4 live (D2-deferred)
- FAIL = Phase 4b dirty firing, OR non-I rawKey leak, OR prior-family byte-equal failure

**Verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL

**Gate A — doctrine-risk determination:** LOW (the 6 keys are descriptive thread-graph topology relations; the one verdict-adjacent candidate `repeats_prior_point` was pruned upstream; no axis-partner / HIGHEST-risk key). **This AUTHORIZES the Card-2 SKIP** — the suite collapses to a 2-card chain (Card 1 admin ship → Gate A → Card 3 production-enable). The 5-layer doctrine defense still ships on this card regardless; only the mechanized retroactive lint (Card 2) is skipped.

**Pre-push checklist:**
- [ ] `node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-010-FAMILY-I-SMOKE-<date>.md` exit 0 (D9 BINDING).
- [ ] Smoke audit committed to `docs/audits/`.
- [ ] PR opened; CI exit 0.

**Verdict-upgrade-path (deferred per L6):** if PARTIAL or NOT-RUN, the amendment must close Phase 3 (hosted 25/25) and Phase 4/4b live. The amendment's persisted-`evidence_span` table + scan against the 8-pattern I ban-list is the upgrade path PARTIAL → PASS.

---
