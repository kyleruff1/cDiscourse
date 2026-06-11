# MCP-SERVER-011-FAMILY-J-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-SERVER-011-FAMILY-J (Family J `sensitive_composer` admin_validation-only ship; 5-key `semantic_referee` SOURCE-UNIFORM set; Template E1 of the H/I/J program). **NO production-enable card in this chain** — the hard ceiling (E4) is admin-validation only; a future production flip requires a fresh `cdiscourse-doctrine` §10a doctrine review (design §11).
**Chain position:** E1 build → E2 hosted smoke → E3 operator-gated admin-validation smoke → **E4 ceiling (admin-validation only; NO Card-3 production flip)**
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)
**MCP server build:** _<deno-deploy-version>_ (auto-deployed)

> Template binding source: design §9 (smoke additions) + §11 (test plan) + §16
> (operator steps). Fill each section after merge; commit the completed audit to
> `docs/audits/` as `MCP-SERVER-011-FAMILY-J-SMOKE-<YYYY-MM-DD>.md`. Local
> pre-lint `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push;
> CI MUST exit 0 on the smoke audit PR.

---

## Doctrine-risk = HIGH — operator obligation (read before starting)

**Family J is doctrine-risk = HIGH by construction** (design §1 / §5 / §13).
This is the **MOST sensitive prompt in the system.** Four of the five
`semantic_referee` keys are verdict-adjacent and three are person/intent-directed:

- `shifts_to_person_or_intent` — **HIGHEST (axis-partner)**; person/intent shift; carries the MAXIMAL guard (the J analog of H's `claim_specificity_low`).
- `contains_unplayable_insult_only` — verdict-adjacent ("insult"/"troll" drift).
- `needs_pre_send_pause` — verdict-adjacent (emotional-state-label drift).
- `uses_satire_as_evidence` — verdict-adjacent (truth-verdict "fake" drift).
- `uses_popularity_as_evidence` — §3 anti-amplification (popularity ≠ evidence).

Unlike Family I (whose verdict-adjacent candidate `repeats_prior_point` was pruned
upstream), **J has NO pruned key — the sensitive vocabulary IS the family.** The
server only DETECTS whether the TEXT exhibits a structural feature; it NEVER
characterizes the author. Composer-only routing (keys 1-3) / inspect-only routing
(keys 4-5) is enforced DOWNSTREAM by the three concentric Edge gates, none touched
by this card.

**Consequence (design §11): Card 2 (L5 mechanization — adding `sensitive_composer`,
`family_j`, and the axis-partner `shifts_to_person_or_intent` to
`DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs`) is WARRANTED**
(HIGH doctrine-risk), but is **OUT OF SCOPE for this card** — it is scoped as a
separate follow-up (MCP-SERVER-011-FAMILY-J Card 2). This card does NOT touch
`audit-lint-rules.cjs` (byte-equal). Gate A records doctrine-risk = HIGH and files
the Card-2 follow-up.

**E4 CEILING (BINDING):** There is NO production-enable card in this chain. A future
J production proposal requires a fresh `cdiscourse-doctrine` §10a doctrine review +
a roadmap-architecture decision (not a normal-card / registry-flip workflow). Until
then, OFF-in-production is the finished state. The held-out jest tripwire
(`__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyJ.test.ts`, FJ-2
`productionEnabled:false`) fails the build if a future card silently flips J to
production.

---

## Operator fallback rules (read before Phase 2/3)

These rules are operator-binding from design §10 + §13.

1. **If a Phase 4b firing returns a banned person/intent token in persisted
   `evidence_span` (troll / bot / astroturfer / toxic / hostile / abusive /
   aggressive / uncivil / incivility / gullible / unhinged / "ad hominem" /
   "personal attack" / "attacking the person" / "bad actor" / "name calling" /
   "fake news" / "losing it" — OR any shared banned token):** IMMEDIATE HALT, mark
   FAIL, file a scoped fix card. THIS IS THE EXISTENTIAL FAIL. Given HIGH
   doctrine-risk, a dirty firing is HALT + revert.
2. **If Phase 4b returns 0 firings on ALL J keys:** treat as PARTIAL (not FAIL) —
   0-fire is operator-deferrable and EXPECTED to be common (sensitive features are
   sparse — most moves have 0 positives).
3. **Source-uniform → NO Edge-subset gap.** Unlike the mixed-source D/G/I families,
   J is `semantic_referee` SOURCE-UNIFORM. There is NO
   `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry for `sensitive_composer` (design
   §7.1 / HALT-13). The Edge sends all 5 registry rawKeys and the MCP server
   classifies all 5 — Phase 4 should NOT see `mcp_validation_failed` for a subset
   reason. Do NOT add an Edge subset entry to "fix" anything (that would be the
   HALT-13-class defect).
4. **Do NOT flip `productionEnabled` for `sensitive_composer`** (E4 ceiling;
   design §14). A production flip requires a fresh §10a review.

---

## Phase 1 — Pre-flight

- [ ] HEAD at merge SHA; git status clean (only the documented operator-territory untracked files).
- [ ] Edge Functions auto-deployed via GitHub integration: `submit-argument` and `classify-argument-boolean-observations` reflect post-merge version timestamps.
- [ ] MCP server (Deno Deploy) auto-deployed; verify `serverName: 'cdiscourse-mcp-server'` reachable.
- [ ] Verify Edge familyRegistry Family J entry post-merge state: `{ family: 'sensitive_composer', productionEnabled: false, adminValidationEnabled: true }` at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:114-118` (NOT touched by this card; HALT trigger #13 + #5).
- [ ] Verify A–I entries byte-equal preserved (production where applicable).
- [ ] Verify `mcp-server/lib/family{A,B,C,D,E,F,G,H,I}*.ts` byte-equal: `git diff origin/main..HEAD -- mcp-server/lib/familyA*.ts ... mcp-server/lib/familyI*.ts` = 0 lines (HALT trigger #4).
- [ ] Verify `mcp-server/lib/doctrineBanList.ts`, `anthropicCall.ts`, `mcpBooleanObservationSchemaMirror.ts`, `providerConcurrency.ts` byte-equal (HALT trigger #5).
- [ ] Verify `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts` byte-equal (RO-16; the source-of-truth READ): `git diff origin/main..HEAD -- src/features/nodeLabels/machineObservationDefinitions/familyJ.ts` = 0 lines.
- [ ] Verify `scripts/ops/audit-lint-rules.cjs` byte-equal (J NOT in DOCTRINE_RISK_FAMILIES — Card 2 L5 mechanization is a SEPARATE follow-up).
- [ ] Verify `booleanObservationRequestBuilder.ts` byte-equal (NO `sensitive_composer` entry in `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`; source-uniform → full passthrough; HALT trigger #14).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Local Deno regression

**Capture:** `cd mcp-server && deno test --allow-env --allow-read tests/`
→ expect `ok | N passed | 0 failed`. Capture the count + delta vs the I baseline
(design forecast: +~143 dedicated Deno tests + ~+15-20 cross-family).

- [ ] `cd mcp-server && deno test --allow-env --allow-read tests/` exit 0; new test count >= I baseline + J forecast.
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0 (touched files; repo-wide lint carries pre-existing worktree noise).

**Result:** ☐ PASS ☐ FAIL — _<notes; capture count + exit code>_

---

## Phase 3 — Hosted MCP smoke (41 checks; operator token)

**Capture:** `bash scripts/mcp-server-001-smoke.sh --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net --token <redacted>`
→ expect `41 PASSES, 0 FAILS`, exit 0. Checks 40+41 are the new J checks
(`40-compat-boolean-family-j` + `41-mcp-tools-call-boolean-family-j`); both MUST
assert `family-j-v1` substring in response. This is the GATE-C Deno-redeploy
verification (until Phase 3 passes 41/41 on the hosted URL, Family J is not live
on the server).

- [ ] All 41 checks pass; exit 0.
- [ ] Check 40 response contains `"classifierSetVersion":"family-j-v1"`.
- [ ] Check 41 response contains `"classifierSetVersion":"family-j-v1"` AND `"isError":false`.

**Status:** ☐ PASS ☐ NOT-RUN (operator-token-gated; caps verdict at PARTIAL)

**Result:** ☐ PASS ☐ FAIL ☐ NOT-RUN — _<notes>_

---

## Phase 4 — Edge admin_validation (Family J; ≥3 seeded args)

**Capture:** `POST /functions/v1/classify-argument-boolean-observations` with admin
JWT, `requestedFamilies:['sensitive_composer']`, `mode:'admin_validation'`. Submit
≥3 seeded args. Verify each returns HTTP 200 + positives in the 5-key set + no
cross-family leak.

**Source-uniform — NO subset gap (R3 / §7.1):** all 5 `semantic_referee` keys flow
through unfiltered. Phase 4 should NOT see `mcp_validation_failed` for a subset
reason (the inverse of the mixed-source D/G/I gates).

- [ ] arg 1 (e.g., canonical person-shift — addresses poster motive, no slur) classified; `shifts_to_person_or_intent` positive.
- [ ] arg 2 (e.g., popularity-as-evidence) classified; `uses_popularity_as_evidence` positive (no truth verdict, no engagement credit).
- [ ] arg 3 (operator choice) classified; no cross-family leak.

| arg id | runId | status | positives | rawKeys |
| --- | --- | --- | --- | --- |
| _<arg-1-id>_ | _<run-id>_ | _<status>_ | _<count>_ | _<rawKeys>_ |
| _<arg-2-id>_ | _<run-id>_ | _<status>_ | _<count>_ | _<rawKeys>_ |
| _<arg-3-id>_ | _<run-id>_ | _<status>_ | _<count>_ | _<rawKeys>_ |

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<notes>_

---

## Phase 4b — DOCTRINE (EXISTENTIAL intensity per HIGH doctrine-risk) — adversarial `evidence_span` inspection

**EXISTENTIAL intensity (HIGH doctrine-risk).** Submit THE EXISTENTIAL fixture +
the per-key fixtures:

- THE EXISTENTIAL (`shifts_to_person_or_intent`): input contains a slur ("you're such a troll"/"you're toxic"). The OUTPUT `evidence_span` MUST anchor the STRUCTURAL focus-shift wording (e.g. "because you work for…") and MUST NOT echo the slur. **A FAIL HERE IS HALT + REVERT.**
- per-key: insult-only / pause / popularity / satire fixtures.

Submit via `submit-argument` (fires the production A–I auto-trigger as a documented
side effect — NOT J, since J is admin-only); POST admin_validation
`requestedFamilies:['sensitive_composer']` on the new argument ids; **PRE-CHECK
column names**; for each J positive, the persisted **`evidence_span`** MUST NOT
contain any of the 18 J ban-list tokens NOR any shared banned token.

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
WHERE r.argument_id IN (_<existential-arg-id>_, _<per-key-arg-ids>_)
  AND r.run_mode = 'admin_validation'
  AND res.observation = TRUE
ORDER BY a.id, res.raw_key;
```

Then scan each row's `evidence_span` for the 18 J ban-list tokens (troll / bot /
astroturfer / toxic / hostile / abusive / aggressive / uncivil / incivility /
gullible / unhinged / "ad hominem" / "personal attack" / "attacking the person" /
"bad actor" / "name calling" / "fake news" / "losing it") AND the shared tokens.

| fixture | raw_key | persisted `evidence_span` | person/intent token? |
| --- | --- | --- | --- |
| **EXISTENTIAL** (input: "you're such a troll"/"you're toxic") | **shifts_to_person_or_intent** | _<span — MUST anchor the focus-shift wording, NOT the slur>_ | _<YES/NO>_ |
| insult-only | contains_unplayable_insult_only | _<span>_ | _<YES/NO>_ |
| pause | needs_pre_send_pause | _<span>_ | _<YES/NO>_ |
| popularity | uses_popularity_as_evidence | _<span>_ | _<YES/NO>_ |
| satire | uses_satire_as_evidence | _<span>_ | _<YES/NO>_ |

**Firing-count resolution:**
- ≥1 firing all clean → **PASS**
- 0 firings → **PARTIAL** (unremarkable; sensitive positives are sparse)
- ≥1 dirty firing → **FAIL** (EXISTENTIAL HALT + revert)

**Status:** ☐ PASS ☐ PARTIAL ☐ FAIL ☐ NOT-RUN

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL ☐ NOT-RUN — _<notes; cite the persisted evidence_span / direct-output inspection rows>_

---

## Phase 5 — Unsupported-family rejection regression (synthetic string)

**Capture:** verified at the dispatch-test layer. With Family J now registered,
there is NO remaining real unsupported family; the regression uses a SYNTHETIC
unregistered family string (design §13 HARD finding). Live Edge POST of a synthetic
family → HTTP 200, `failed`, zero positives — operator-deferred to the amendment.

- [ ] Edge `sensitive_composer` returns supported (Family J now registered; returns `family-j-v1`).
- [ ] Edge `__unregistered_family_for_test__` (synthetic) returns `unsupported_family`.

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 6 — Targeted Jest + Deno regression

- [ ] `npx jest --testPathPattern="[Ff]amily.*[Jj]|sensitive.composer" --no-coverage` exit 0.
- [ ] `npx jest --no-coverage` exit 0; cite new total count.
- [ ] `cd mcp-server && deno test --allow-env --allow-read tests/` exit 0; cite new total count.
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0.
- [ ] Byte-equal verification:
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/familyA*.ts ... familyI*.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/doctrineBanList.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/anthropicCall.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/providerConcurrency.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` = 0 lines
  - [ ] `git diff origin/main..HEAD -- src/` = 0 lines (taxonomy READ-only; RO-16)
  - [ ] `git diff origin/main..HEAD -- supabase/migrations/` = 0 lines (no migration)
  - [ ] `git diff origin/main..HEAD -- package.json` = 0 lines (no deps)
  - [ ] `git diff origin/main..HEAD -- scripts/ops/audit-lint-rules.cjs` = 0 lines (J not in DOCTRINE_RISK_FAMILIES; Card 2 SEPARATE follow-up)
  - [ ] `git diff origin/main..HEAD -- supabase/functions/_shared/booleanObservations/familyRegistry.ts` = 0 lines (J entry already correct; HALT 13)
  - [ ] `git diff origin/main..HEAD -- supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` = 0 lines (HALT 14; source-uniform, no Edge subset entry)

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE (BINDING)

**Capture:**

- 10-family operational state table:

| family | productionEnabled | adminValidationEnabled | notes |
| --- | --- | --- | --- |
| parent_relation (A) | true | true | production |
| disagreement_axis (B) | true | true | production |
| misunderstanding_repair (C) | true | true | production |
| evidence_source_chain (D) | true | true | production |
| argument_scheme (E) | true | true | production |
| critical_question (F) | true | true | production |
| resolution_progress (G) | true | true | production |
| claim_clarity (H) | true | true | production |
| thread_topology (I) | true | true | production |
| **sensitive_composer (J)** | **false** | **true** | **admin_validation new (this card); E4 ceiling — NO production flip** |

- Latency: this card adds **zero latency to the production path** (J is admin_validation-only and never enters the production auto-trigger). Reference the bounded-concurrency parallelization (limit 2) + the #365 burst hazard.
- CI provenance:
  - CI run ID: _<id>_
  - in_scope count: _<n>_
  - Linter exit on smoke audit PR: _<0|nonzero>_

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 8 — Verdict + authorization

**Verdict rules** (per design §9 + §11):
- PASS = Phase 3 41/41 + Phase 4 valid + Phase 4b ≥1 clean firing (or 0-fire PARTIAL) + Phase 5 synthetic reject + Phase 6 clean + Phase 7 provenance present + pre-lint/CI exit 0
- PARTIAL = Phase 3 NOT-RUN, OR Phase 4b 0-fire
- FAIL = Phase 4b dirty firing (EXISTENTIAL), OR non-J rawKey leak, OR prior-family / `familyJ.ts` byte-equal failure

**Verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL

**Gate A — doctrine-risk determination:** HIGH (4 of 5 keys are verdict-adjacent; 3 are person/intent-directed; `shifts_to_person_or_intent` is the axis-partner carrying the maximal guard). **This WARRANTS the Card-2 L5 mechanization follow-up** (add `sensitive_composer` / `family_j` / `shifts_to_person_or_intent` to `DOCTRINE_RISK_FAMILIES`), filed as a SEPARATE card. **E4 ceiling: NO production-enable card in this chain** — a future J production flip requires a fresh `cdiscourse-doctrine` §10a doctrine review.

**Pre-push checklist:**
- [ ] `node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-<date>.md` exit 0.
- [ ] Smoke audit committed to `docs/audits/`.
- [ ] PR opened; CI exit 0.

**Verdict-upgrade-path (deferred):** if PARTIAL or NOT-RUN, the amendment must close Phase 3 (hosted 41/41) and Phase 4/4b live. The amendment's persisted-`evidence_span` table + scan against the 18-pattern J ban-list is the upgrade path PARTIAL → PASS.
