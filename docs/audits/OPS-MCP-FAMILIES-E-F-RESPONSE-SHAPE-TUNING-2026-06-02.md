# OPS-MCP-FAMILIES-E-F-RESPONSE-SHAPE-TUNING — implementation audit (2026-06-02)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-02 UTC
**Operator:** Kyler
**Card:** OPS-MCP-FAMILIES-E-F-RESPONSE-SHAPE-TUNING
**Issue / trail:** #373 (cutover umbrella); drill results from PR #422
**Base HEAD at execution:** `331cfb6` (PR #422 — PASS-R3-DIAGNOSTIC / FAIL-LOAD with classification of argument_scheme + critical_question packet/schema failures)
**Predecessors merged:** PR #411, #412, #413, #414, #415, #416, #417, #418, #419, #420, #421, #422

**Scope:** Two-family source-level mitigation following PR #422's classification. Extends the STRICT RESPONSE-SHAPE CONTRACT pattern from PR #421 — (a) adds a per-rawKey reinforcement for Family E's `abductive_explanation_present` (residual packet/schema failure path), (b) applies the full pattern to Family F's user prompt with a per-rawKey reinforcement for `alternative_explanation_available` (the new failing path PR #422 surfaced). Validator unchanged. Ban-lists unchanged. Key files unchanged. familyRegistry unchanged.

**Final verdict:** **PASS, mitigation implemented. Requires Deno Deploy push and queue-load-smoke retry before Stage 1 reconsideration.**

---

## 1. Diagnosis carried forward from PR #422 (wording discipline)

Per PR #422's R3 classification of the post-PR-#421 retry (Deno Deploy `cdiscourse-mcp-server` logs, drill window 2026-06-02T00:14:00Z → 00:28:00Z):

**`argument_scheme` (E; 1 dead-letter cell, down from 3 in PR #416/#419 — PR #421 mitigation worked):**
- 3 × `boolean_observation_tool_error.reason = validation_failed`
- 3 × co-occurrence with `boolean_observations_packet_invalid`
- 0 × co-occurrence with `boolean_observations_doctrine_ban_list`
- 3 × path = `evidenceSpan.abductive_explanation_present`
- Anthropic returned `httpStatus=200` + `anthropic_call_success` BEFORE each failure

**`critical_question` (F; 1 dead-letter cell, NEW family that surfaced once E's dominant 3-cell cluster shrank):**
- 2 × `boolean_observation_tool_error.reason = validation_failed`
- 2 × co-occurrence with `boolean_observations_packet_invalid`
- 0 × co-occurrence with `boolean_observations_doctrine_ban_list`
- 2 × path = `evidenceSpan.alternative_explanation_available`
- Anthropic returned `httpStatus=200` + `anthropic_call_success` BEFORE each failure

**RCA hypothesis verdicts:**
- **H1 (ban-list rejection): REFUTED for BOTH families** (zero ban-list co-occurrences).
- **H2 (Anthropic provider-side instability): REFUTED for BOTH families** (200 + `anthropic_call_success` before every validation failure; zero `api_error` / `timeout` / `rate_limited` / `network_error`).
- **H3 (packet/schema validation): CONFIRMED for BOTH families**, narrowed to two specific evidenceSpan rawKey paths.

**Wording discipline (verbatim from PR #422 §1, carried forward):** _response-shape validation confirmed; token-budget pressure remains a possible contributor._ This card does NOT treat token budget as confirmed.

## 2. Source-level RCA (Phase 1)

### 2a. Family F prompt gaps (pre-fix; comparing to Family E post-PR-#421)

`mcp-server/lib/familyFPrompt.ts:259-261` (pre-fix) carried only the weak one-way coordination language byte-equal to E's pre-PR-#421 state:

> "Every key in observations MUST also appear in confidence and evidenceSpan (use null in evidenceSpan when no anchoring quote exists). Every key in checkedRawKeys MUST appear in observations."

Gaps relative to the validator contract (`mcpBooleanObservationSchemaMirror.ts:218-265`):
- WEAK: bidirectional key-set equality (model could emit extras in checkedRawKeys / mismatched key sets)
- ABSENT: explicit `null` evidenceSpan convention for false observations
- ABSENT: self-check instruction before emitting JSON
- WEAK: per-rawKey uniformity rule for evidenceSpan value type (no explicit forbidding of object/array for the failing path)

These gaps are IDENTICAL to those PR #421 fixed for E. The same fix transfers to F.

### 2b. Token-budget check (carried forward)

- Family E: 16 keys / `FAMILY_E_MAX_TOKENS = 1500` (~9% headroom).
- Family F: 14 keys / `FAMILY_F_MAX_TOKENS = 1500` (~21% headroom — comfortably wider than E).
- Family C: 17 keys / `MAX_TOKENS = 1500` (tighter per-key than F; NOT a chronic victim).

**Recommendation: no bump warranted for E or F.** Observed drill failures are present-but-wrong-typed values at specific evidenceSpan paths — model-comprehension errors at the shape contract, not truncation. Token budget remains in the "possible contributor only" bucket per §1 wording discipline. `FAMILY_E_MAX_TOKENS` stays at 1500. `FAMILY_F_MAX_TOKENS` stays at 1500.

## 3. Implementation (Phase 2)

### 3a. Family E — add rule 6 (RAWKEY-SHAPE REINFORCEMENT)

`mcp-server/lib/familyEPrompt.ts` — append a sixth section to the existing PR #421 STRICT RESPONSE-SHAPE CONTRACT block (between rule 5 SELF-CHECK and "Conservative-positives bias"). The new section:

- Names the specific failing path: `evidenceSpan.abductive_explanation_present`.
- Re-enumerates the allowed shape: a JSON string ≤ 240 chars OR the JSON literal null.
- Re-enumerates the not-allowed shapes: nested JSON object, array, boolean, number, missing entry.
- Pins the rule to BOTH true and false observations (null required when false; string-or-null required when true).
- Cites the exact validator rejection path the drill surfaced (defense-in-depth against shape drift on this specific rawKey).

Rules 1-5 from PR #421 are byte-equal preserved. `FAMILY_E_SYSTEM_PROMPT` is byte-equal preserved. `FAMILY_E_MAX_TOKENS = 1500` is unchanged.

### 3b. Family F — replace the weak coordination text with the full STRICT block

`mcp-server/lib/familyFPrompt.ts:259-261` — replace with the 6-section STRICT RESPONSE-SHAPE CONTRACT block analogous to E's PR #421 + rule 6 from this card. The block:

1. KEY-SET EQUALITY across all four maps (checkedRawKeys, observations, confidence, evidenceSpan); no extras, no omissions, no duplicates.
2. INCLUDE EVERY REQUESTED RAWKEY EXACTLY ONCE — names `alternative_explanation_available`, `consequence_probability_unclear`, `analogy_mapping_missing`, `missing_warrant` (the four highest-doctrine-risk CQs per F's system prompt §3).
3. EVIDENCESPAN VALUE TYPE: string ≤ 240 chars OR null; forbids object/array/boolean/number/missing.
4. NULL EVIDENCESPAN FOR FALSE OBSERVATIONS; if no anchoring text, set the observation back to false rather than fabricating.
5. SELF-CHECK BEFORE EMITTING (four mechanical checks; regenerate if any fails).
6. RAWKEY-SHAPE REINFORCEMENT for `alternative_explanation_available` — analogous to E's rule 6.

`FAMILY_F_SYSTEM_PROMPT` is byte-equal preserved. `FAMILY_F_MAX_TOKENS = 1500` is unchanged.

### 3c. Doctrine cleanliness of the new blocks

Both new blocks were authored to avoid all banned standalone or positive-assertion tokens: `fallacy`, `fallacious`, `invalid`, `flawed`, `wrong`, `weak argument`, `bad reasoning`, `logical error`, `proof of`, plus F-specific extensions (`proves wrong`, `refutes`, `invalidates`, `unmet-means-fallacy`). Tests in §4 scan the new blocks for all of these.

## 4. Tests (Phase 3)

### 4a. `mcp-server/tests/familyEPrompt.test.ts` (+1 new test)

- **NEW** `Family E user prompt: declares per-rawKey shape reinforcement for abductive_explanation_present (rule 6)` — anchors on `RAWKEY-SHAPE REINFORCEMENT`, names `evidenceSpan.abductive_explanation_present`, enumerates allowed (string ≤ 240 OR null) and not-allowed (object/array/boolean/number), scans the isolated rule-6 block for banned verdict tokens.

### 4b. `mcp-server/tests/familyFPrompt.test.ts` (+8 new tests; +1 existing test updated)

- **NEW** `declares a strict response-shape contract block` — anchor on STRICT heading.
- **NEW** `enforces bidirectional key-set equality across the four maps` — asserts all four maps named, identical-key-set phrasing, `no extras, no omissions` anti-drift phrase.
- **NEW** `forbids object / array / boolean / number in evidenceSpan values` — enumerates all four forbidden types + string-or-null allowed + 240-char cap citation.
- **NEW** `prescribes null evidenceSpan for false observations`.
- **NEW** `directs a self-check before emitting the JSON` — anchor on `SELF-CHECK` + `verify`/`regenerate`.
- **NEW** `names alternative_explanation_available in the no-special-shape rule` — drill-derived; also requires `consequence_probability_unclear`, `analogy_mapping_missing`, `missing_warrant` to be named (parity with F's system-prompt doctrine-risk anchors).
- **NEW** `declares per-rawKey shape reinforcement for alternative_explanation_available` — Family-F analog of E's rule-6 test.
- **NEW** `response-shape guardrail block does not introduce banned verdict tokens` — scans the new block for 13 patterns (9 shared + 4 F-specific extensions: proves-wrong, refutes, invalidates, unmet-means-fallacy).
- **UPDATED** `instructs model to provide confidence on every rawKey` — updated to assert the stronger bidirectional contract (same pattern as PR #421 applied to E).

### 4c. `mcp-server/tests/familyFResponseValidator.test.ts` (NEW FILE; +7 tests)

Mirrors the Family E validator test pattern:
- **NEW** `happy path returns ok=true with parsed value` — baseline acceptance.
- **NEW** `rejects evidenceSpan value that is neither string nor null` — baseline rejection.
- **NEW** `observation key MUST appear in checkedRawKeys` — baseline checkedRawKeys constraint.
- **NEW** `drill regression — rejects evidenceSpan.alternative_explanation_available when value is a plain object` — drill-observed path; asserts `result.path === 'evidenceSpan.alternative_explanation_available'`.
- **NEW** `drill regression — rejects evidenceSpan.alternative_explanation_available when value is an array` — variant of same path.
- **NEW** `drill regression — rejects checkedRawKeys when observations contains an extra key the model failed to include` — drill-observed mechanism; asserts `result.path === 'checkedRawKeys'`.
- **NEW** `acceptance — packet with strict key-set equality across all four maps and null evidenceSpan for false observations` — codifies the shape the new F STRICT block instructs the model to emit.

### 4d. Family E validator tests

The PR #421 validator regression tests for `evidenceSpan.abductive_explanation_present` (object + array rejection) and the strict-key-equality acceptance test are already present and unchanged. No additions needed.

### 4e. Test count transitions

| Surface | Pre-fix | Post-fix | Delta |
|---|---:|---:|---:|
| `familyEPrompt.test.ts` | 30 | 31 | +1 |
| `familyEResponseValidator.test.ts` | 21 | 21 | 0 |
| `familyFPrompt.test.ts` | 25 | 33 | +8 |
| `familyFResponseValidator.test.ts` | 0 (file new) | 7 | +7 |
| **Family E + F subset** | **76** | **92** | **+16** |
| MCP full Deno suite | 1213 | 1229 | +16 |
| Jest full | 18825 | 18825 | 0 |

## 5. Preservation manifest (byte-equal — asserted)

| Surface | Status |
|---|---|
| All other families' prompts (familyA/B/C/D/G/H Prompt.ts) | byte-equal preserved |
| All other families' MAX_TOKENS | byte-equal preserved |
| `validateMcpBooleanObservationResponse` (mcpBooleanObservationSchemaMirror.ts) | byte-equal preserved |
| `familyEBanListScan.ts` | byte-equal preserved |
| `familyFBanListScan.ts` | byte-equal preserved |
| `familyEKeys.ts` | byte-equal preserved |
| `familyFKeys.ts` | byte-equal preserved |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (H/I/J `productionEnabled: false` at lines 106/111/116) | byte-equal preserved |
| `classifierDrainerCore.ts` / `classifierDrainerRetryPolicy.ts` / drainer constants | byte-equal preserved |
| Cron / env / Vault / migrations / runtime flags / Supabase secrets | NOT touched by CC |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` (R3 emitter) | byte-equal preserved |
| `FAMILY_E_SYSTEM_PROMPT` (7 absolute rules byte-equal across A/B/C/D/E) | byte-equal preserved |
| `FAMILY_F_SYSTEM_PROMPT` (CQ-as-productive-probe doctrine; E↔F partnership anchor) | byte-equal preserved |
| `FAMILY_E_MAX_TOKENS = 1500` / `FAMILY_F_MAX_TOKENS = 1500` | both unchanged |
| `package.json` / `package-lock.json` | byte-equal preserved |

Verified via `git diff --stat HEAD` and `git status --porcelain` — only 5 files in scope:
- `mcp-server/lib/familyEPrompt.ts` (+14 net lines; rule 6 appended)
- `mcp-server/lib/familyFPrompt.ts` (+57 net lines; weak text replaced with full STRICT block + rule 6)
- `mcp-server/tests/familyEPrompt.test.ts` (+72 net lines; +1 test)
- `mcp-server/tests/familyFPrompt.test.ts` (+217 net lines; +8 tests + 1 updated)
- `mcp-server/tests/familyFResponseValidator.test.ts` (NEW; +7 tests)

## 6. Verification (Phase 4)

| Step | Result |
|---|---|
| Targeted E + F prompt + validator tests | **92 passed / 0 failed** (was 76 pre-fix; +16 net) |
| Full MCP Deno suite | **1229 passed / 0 failed** (was 1213; +16 net) |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test` (Jest) | **18,825 passed / 596 suites / 0 failed** (unchanged) |
| Routing-flag scan in touched files | zero new references |
| Provider-endpoint scan in touched files | zero matches |
| Secret/JWT/auth scan in touched files | zero matches |
| Preservation manifest (`git diff --stat HEAD` on forbidden files) | all zero — byte-equal preserved |

## 7. Adversarial review (Phase 5; 3 read-only verifier agents)

Run via Workflow with `agentType: 'Explore'` (no commits, no edits, no test execution by agents). All three verifiers returned **APPROVE**.

### 7a. Boundary verifier (B1–B7)
All seven boundary checks PASS:
- B1: only allowed files touched; all forbidden files byte-equal.
- B2: `FAMILY_E_SYSTEM_PROMPT` and 7-absolute-rules parity with A/B/C/D unchanged.
- B3: `FAMILY_F_SYSTEM_PROMPT` byte-equal preserved.
- B4: `FAMILY_E_MAX_TOKENS = 1500` / `FAMILY_F_MAX_TOKENS = 1500` — neither bumped.
- B5: H/I/J still production-disabled at familyRegistry.ts:106/111/116.
- B6: zero new runtime references to routing flags / provider endpoints / cron / env / Vault.
- B7: zero secret-shaped literals.

### 7b. Test-teeth verifier (T1–T14)
All fourteen tests have teeth — each pins a unique anchor that would flip red if the corresponding production guardrail were removed or weakened. Validator regression tests on F pin both `result.ok === false` AND the exact `result.path` value.

### 7c. Doctrine + wording verifier (D1–D7)
All seven doctrine/wording checks PASS:
- D1–D2: no banned doctrine tokens in either new block.
- D3: §1 carries the operator-mandated wording verbatim; token budget treated as "possible contributor only", not confirmed.
- D4: final verdict + §8 explicitly state Stage 1, H retry, Family I, Family J all remain blocked.
- D5: §8 names Deno Deploy `cdiscourse-mcp-server` as the deployment target; states Supabase merge auto-deploy does NOT propagate `mcp-server/`.
- D6: system prompts byte-equal preserved.
- D7: §1 cites PR #422 and both drill paths (`evidenceSpan.abductive_explanation_present` + `evidenceSpan.alternative_explanation_available`).

## 8. Authorizations + follow-ups

**Active verdict: PASS, mitigation implemented.**

**This PR does NOT authorize Stage 1.** Stage 1 routing flip remains UNAUTHORIZED until a queue-load-smoke retry achieves PASS-LOAD (no cluster recurrence). The mitigation pattern from PR #421 demonstrably reduced argument_scheme failures by 67% but did not eliminate them; this card's two-family extension is expected to further reduce both rates but does not make validator rejection impossible.

**Family H production retry remains gated.**
**Family I remains gated.**
**Family J remains gated.**

### Required operator next steps after merge (NOT executed by CC)

1. **Deploy `cdiscourse-mcp-server` to Deno Deploy** with the post-merge `mcp-server/` build. Supabase merge-auto-deploy redeploys `supabase/functions/*` automatically; **it does NOT propagate `mcp-server/`**. A separate Deno Deploy push is required (operator did this successfully between PR #421 and the PR #422 drill at `cdiscourse-mcp-server-39aev5ek2c4e.civildiscourse.deno.net`; same pattern applies for this card).

2. **Schedule a separate `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY` card** AFTER the Deno Deploy push lands. Same N=8 harness + same query pack. Compare per-family dead-letter rates against the PR #422 baseline (1 argument_scheme + 1 critical_question = 2 dead-letters / 3.571% rate). Expected outcomes:
   - If both families further reduce — pattern continues to work; iterate.
   - If a third family surfaces — extend the same pattern to that family.
   - If PASS-LOAD (zero cluster) — operator separately decides on Stage 1 routing flip.

### Other follow-ups (regardless of next drill outcome)

- RCA's **R1** (jsonb `failure_detail` column on `argument_machine_observation_runs`) becomes higher-value each drill: persisting the validator's exact failure path to the DB automatically would remove the dependency on operator-side Deno Deploy log pulls.
- The PR #421 + this card established a repeatable pattern: when a packet/schema cluster on a specific evidenceSpan rawKey path is confirmed, the mitigation is (1) STRICT RESPONSE-SHAPE CONTRACT for the family's user prompt and (2) per-rawKey reinforcement naming the specific path. Catalog this pattern for future families if/when classified packet-shape clusters appear.

## 9. Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0**. No `submit-argument` / `classify-argument-boolean-observations` / MCP / Anthropic / xAI / X API call.
- **CC writes (DB):** **0**. Read-only `SELECT` SQL via `npx supabase db query --linked --file .claude-tmp/rehearsal-queries/preflight.sql` for Phase 0 inert verification only.
- **CC writes (file system; only these seven):**
  - `mcp-server/lib/familyEPrompt.ts` — rule 6 appended to PR #421 STRICT block (+14 net lines).
  - `mcp-server/lib/familyFPrompt.ts` — weak coordination text replaced with full STRICT block + rule 6 (+57 net lines).
  - `mcp-server/tests/familyEPrompt.test.ts` — +1 new test (+72 net lines).
  - `mcp-server/tests/familyFPrompt.test.ts` — +8 new tests + 1 updated (+217 net lines).
  - `mcp-server/tests/familyFResponseValidator.test.ts` — NEW file with +7 tests.
  - `docs/audits/OPS-MCP-FAMILIES-E-F-RESPONSE-SHAPE-TUNING-2026-06-02.md` — this audit.
  - `docs/core/current-status.md` — +1 entry.
- **Routing flag at execution time:** `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-attested per PR #422 stand-down at 2026-06-02T01:12:09Z). NOT touched by this card.
- **Family roster at execution time:** A-G production-enabled; H/I/J production-disabled (`familyRegistry.ts:106 / 111 / 116`). NOT touched.
- **Mutations:** **0** by CC. No env / Vault / cron / percentage / routing-flag / migration / familyRegistry / retry-policy / drainer / ban-list / validator / schema-mirror / key file / MCP-tool / package.json / source-6 change.
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / raw provider payloads / raw MCP log lines written to this audit.

## 10. Test-count baseline for `current-status.md`

Tests at HEAD post-merge of this card:
- **Jest**: 18,825 / 596 suites (unchanged — no Jest-side change).
- **MCP Deno**: 1,229 / 0 failed (was 1,213 at HEAD `331cfb6`; +16 from this card).
- **Family E + F subset**: 92 / 0 failed (was 76 at HEAD `331cfb6`; +16 = +1 E prompt + +8 F prompt + +7 F validator).
