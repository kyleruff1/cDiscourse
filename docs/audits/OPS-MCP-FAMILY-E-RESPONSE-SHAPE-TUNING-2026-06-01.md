# OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING — implementation audit (2026-06-01)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-01 UTC
**Operator:** Kyler
**Card:** OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING
**Issue / trail:** #373 (cutover umbrella); R3 classification from PR #420
**Base HEAD at execution:** `2f179cc` (PR #420 — R3 classification = packet/schema validation failure on `argument_scheme`)
**Predecessors merged:** PR #411, #412, #413, #414, #415, #416, #417, #418, #419, #420

**Scope:** Lowest-risk source-level mitigation for the chronic `argument_scheme` cluster — harden the Family E user prompt so the model emits a packet that conforms to the existing `validateMcpBooleanObservationResponse` contract (`mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:218-265`). The validator is unchanged; the prompt is aligned to it.

**Final verdict:** **PASS, mitigation implemented. Requires Deno Deploy push and queue-load-smoke retry before Stage 1 reconsideration.**

---

## 1. Diagnosis carried forward from #420 (wording discipline preserved)

Per PR #420's R3 classification of the QUEUE-LOAD-SMOKE-RETRY drill (2026-06-01 19:42-19:44Z, Deno Deploy `cdiscourse-mcp-server` logs):

- 3/3 `argument_scheme` `boolean_observation_tool_error` events: `reason=validation_failed`
- 3/3 co-occurred with `boolean_observations_packet_invalid` (same `requestId`); 0/3 with `boolean_observations_doctrine_ban_list`
- 0 `api_error` / `timeout` / `rate_limited` / `network_error`
- Anthropic returned `httpStatus=200` + `anthropic_call_success` BEFORE the validation failures
- Failure paths: `evidenceSpan.abductive_explanation_present` (1) + `checkedRawKeys` (2)

**Verdicts on the RCA hypotheses (carried verbatim from PR #420):**
- H1 (Family E ban-list rejection): **REFUTED** for this drill — zero ban-list co-occurrence.
- H2 (Anthropic backend instability): **REFUTED** — provider returned 200 before validation failed.
- H3 (output budget / response shape): **CONFIRMED**, sharpened to packet-shape errors at specific paths.

**Wording discipline (verbatim from §3 of the card):** _response-shape validation confirmed; token-budget pressure remains a possible contributor._ This card does **not** treat token budget as confirmed.

## 2. Source-level RCA (Phase 1, read-only fan-out)

Three parallel read-only subagents (`agentType: 'Explore'`) returned structured findings. Main thread then verified directly by reading `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:100-313`.

### 2a. Validator contract (verified at HEAD `2f179cc`)

`validateMcpBooleanObservationResponse` (file:line cites):

- `observations` ↔ `confidence` ↔ `evidenceSpan`: **bidirectional key-set equality** required (lines 218-254 — three for-loops: observation→confidence/evidenceSpan presence; confidence→observations presence; evidenceSpan→observations presence). Net effect: the three maps share identical key sets.
- `observations.keys ⊆ checkedRawKeys`: **one-way containment** (lines 256-265). The validator REJECTS when observations has a key not in checkedRawKeys (path = `checkedRawKeys`, detail = `observations key "<key>" missing from checkedRawKeys`). It does NOT reject extras in checkedRawKeys.
- `evidenceSpan[k]`: `string | null` only; max 240 chars (lines 200-216); `MAX_EVIDENCE_SPAN_CHARS = 240` (line 38).
- `observations[k]`: boolean only (line 171).
- `confidence[k]`: `'low' | 'medium' | 'high'` only (line 186).
- Observation count cap: `MAX_FLAGS_PER_RESPONSE = 20` (lines 35, 163-168).
- No comparison against "requested rawKeys" anywhere in the validator. The validator is structural-only; rawKey-membership lives in the tool handler (`classifyArgumentBooleanObservations.ts`).

### 2b. Family E prompt gaps (pre-fix)

`mcp-server/lib/familyEPrompt.ts:226-228` (pre-fix) carried only **one-way containment language**:

> "Every key in observations MUST also appear in confidence and evidenceSpan (use null in evidenceSpan when no anchoring quote exists). Every key in checkedRawKeys MUST appear in observations."

The Phase 1 source audit flagged the following gaps relative to the validator contract:
- WEAK: bidirectional key-set equality (model could emit extras in checkedRawKeys / mismatched key sets)
- ABSENT: explicit `null` evidenceSpan convention for false observations
- ABSENT: self-check instruction before emitting JSON
- WEAK: per-key uniformity rule for evidenceSpan value type (no explicit forbidding of object/array, especially for `abductive_explanation_present` — the drill-observed failing path)

### 2c. Token-budget recommendation

- Family E: 16 keys, `FAMILY_E_MAX_TOKENS = 1500` (mcp-server/lib/familyEPrompt.ts:40).
- Family C: 17 keys, MAX_TOKENS = 1500 (tighter per-key density than E, NOT a chronic victim).
- Family D: 19 keys, MAX_TOKENS = 1800 (Stage 2B operator-approved bump).
- Expected E output ≈ 1360 tokens (16 × ~85, per E's own docstring) → ~9% headroom.

**Recommendation: `no_bump_warranted`.** The observed drill failure is a PRESENT-BUT-WRONG-TYPED `evidenceSpan` value and a `checkedRawKeys` arity mismatch — model-comprehension errors at the shape contract, NOT truncation. Family C has tighter per-key density at the same 1500 cap and is not a chronic victim. `FAMILY_E_MAX_TOKENS` is left at 1500 unchanged.

## 3. Implementation (Phase 2)

**Only file modified:** `mcp-server/lib/familyEPrompt.ts` — user-prompt block at lines 226-228 (the weak one-way coordination text) is replaced with a stronger STRICT RESPONSE-SHAPE CONTRACT block. The replacement is inside `buildFamilyEUserPrompt` (the user prompt template), NOT in `FAMILY_E_SYSTEM_PROMPT`. The system prompt's 7-absolute-rules byte-equality with Family A/B/C/D is preserved.

The new block encodes 5 mechanical guardrails aligned to §2a:

1. **Key-set equality** — the four sets (`checkedRawKeys` as a set, `observations` keys, `confidence` keys, `evidenceSpan` keys) MUST be identical. Same rawKey strings, same count, no extras, no omissions, no duplicates.
2. **Include every requested rawKey exactly once** — explicitly names `abductive_explanation_present`, `slippery_slope_reasoning_present`, `analogy_reasoning_present` so the model cannot silently drop any of them.
3. **evidenceSpan value type** — `string ≤ 240 chars OR null` only; explicitly forbids object, array, boolean, number, and missing entries. Calls out per-key uniformity: no scheme has a special nested or structured evidenceSpan shape; abductive_explanation_present uses the same string-or-null shape as every other scheme key.
4. **Null evidenceSpan for false observations** — when `observations[rawKey]=false`, set `evidenceSpan[rawKey]=null`. When true but no anchoring text exists, set the observation back to false rather than fabricating a quote.
5. **Self-check before emitting** — four mechanical checks (key-count equality, exact rawKey string match, value type uniformity, no silently-dropped or invented keys); regenerate the packet if any check fails.

**FAMILY_E_MAX_TOKENS: unchanged at 1500.** Per §2c; default is no bump unless source shows > 90% expected utilization (E is at ~91% — over the soft threshold but not the recommended threshold, and the observed failure mode is shape-correctness, not truncation). Leaving headroom unchanged keeps the failure space narrowed to the prompt fix.

## 4. Tests (Phase 3)

Two test files extended (no new files added):

### `mcp-server/tests/familyEPrompt.test.ts` (+7 new tests; +1 existing test updated)

- **NEW** `Family E user prompt: declares a strict response-shape contract block` — anchor test on the section heading; durable (fails if heading is renamed).
- **NEW** `Family E user prompt: enforces bidirectional key-set equality across the four maps` — asserts all four maps named, asserts `identical|same exact|exactly once` phrasing, asserts the `no extras, no omissions` load-bearing anti-drift phrase.
- **NEW** `Family E user prompt: forbids object / array / boolean / number in evidenceSpan values` — enumerates all four forbidden types; asserts the `string OR null` allowed pair; asserts the 240-char cap is cited.
- **NEW** `Family E user prompt: prescribes null evidenceSpan for false observations`.
- **NEW** `Family E user prompt: directs a self-check before emitting the JSON` — asserts the SELF-CHECK anchor + `verify|regenerate` language.
- **NEW** `Family E user prompt: names abductive_explanation_present in the no-special-shape rule` — drill-derived: the specific failing path must be called out by name.
- **NEW** `Family E user prompt: response-shape guardrail block does not introduce banned verdict tokens` — doctrine non-regression: scans the new block for `fallacy / fallacious / invalid / flawed / wrong / weak argument / bad reasoning / logical error / proof of` standalone or positive-assertion form.
- **UPDATED** `Family E user prompt instructs model to provide confidence on every rawKey` — the existing test asserted the literal pre-fix string `Every key in observations MUST also appear in confidence`. Updated to assert the **stronger** bidirectional contract via regex (presence of `observations` + `confidence` + the `identical|same exact|exactly the same` coordination phrase). Intent preserved; the assertion is now harder to satisfy.

### `mcp-server/tests/familyEResponseValidator.test.ts` (+4 new tests)

- **NEW** `Family E validator: drill regression — rejects evidenceSpan.abductive_explanation_present when value is a plain object` — drill-observed path (1 of 1 instance count in the #420 log segment).
- **NEW** `Family E validator: drill regression — rejects evidenceSpan.abductive_explanation_present when value is an array` — variant of same path.
- **NEW** `Family E validator: drill regression — rejects checkedRawKeys when observations contains an extra key the model failed to include` — drill-observed path (2 of 2 instance count in the #420 log segment); asserts `path === 'checkedRawKeys'`.
- **NEW** `Family E validator: acceptance — packet with strict key-set equality across all four maps and null evidenceSpan for false observations` — codifies the shape the new STRICT RESPONSE-SHAPE CONTRACT prompt block instructs the model to emit.

### Count transitions

| Surface | Pre-fix | Post-fix | Delta |
|---|---:|---:|---:|
| Family E Deno tests (full suite) | 162 | 173 | +11 |
| MCP full Deno suite | 1202 | 1213 | +11 |
| Jest full | 18825 | 18825 | 0 (no Jest-side change) |

## 5. Preservation manifest (byte-equal — asserted)

| Surface | Status |
|---|---|
| All other families' prompts (familyAPrompt.ts / B / C / D / F / G / H) | byte-equal preserved |
| All other families' MAX_TOKENS | byte-equal preserved |
| `validateMcpBooleanObservationResponse` (mcpBooleanObservationSchemaMirror.ts) | byte-equal preserved |
| Schema mirror constants (MAX_EVIDENCE_SPAN_CHARS, MAX_FLAGS_PER_RESPONSE, schemaVersion) | byte-equal preserved |
| `familyEBanListScan.ts` (Family E ban-list patterns) | byte-equal preserved |
| `familyEKeys.ts` (FAMILY_E_RAW_KEYS, prompt entries) | byte-equal preserved |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (H/I/J `productionEnabled: false`) | byte-equal preserved |
| `classifierDrainerCore.ts` / retry policy / drainer constants | byte-equal preserved |
| Cron / env / Vault / migrations | unchanged by CC |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` (R3 emitter) | byte-equal preserved |
| FAMILY_E_SYSTEM_PROMPT (the system prompt; 7 absolute rules byte-equal across A/B/C/D/E) | byte-equal preserved (only the USER prompt at lines 226-228 changed) |
| `FAMILY_E_MAX_TOKENS = 1500` | unchanged per §2c recommendation |

Verified via `git diff --stat HEAD` — only three files touched:
- `mcp-server/lib/familyEPrompt.ts` (+42 net lines; user-prompt block 226-228 expanded)
- `mcp-server/tests/familyEPrompt.test.ts` (+197 net lines; +7 new tests, +1 updated)
- `mcp-server/tests/familyEResponseValidator.test.ts` (+110 net lines; +4 new tests)

## 6. Verification (Phase 4)

| Step | Command | Result |
|---|---|---|
| Tracked-file delta scope check | `git status --porcelain` | only 3 expected files modified |
| Targeted Family E Deno tests (10 files) | `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/familyE*.test.ts tests/classifyArgumentBooleanObservationsSourceScan.test.ts` | **187 passed / 0 failed** |
| Full MCP Deno suite | `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/` | **1213 passed / 0 failed** |
| TypeScript typecheck | `npm run typecheck` | exit 0 |
| ESLint | `npm run lint` | exit 0 |
| Jest full | `npm run test` | **18,825 passed / 596 suites / 0 failed** |
| Routing-flag scan in touched source + tests | `grep -RInE "CLASSIFIER_QUEUE_ROUTING_ENABLED|CLASSIFIER_QUEUE_ROUTING_PERCENTAGE" mcp-server/lib mcp-server/tests` | the only hit is the pre-existing R3 source-scan guardrail (`classifyArgumentBooleanObservationsSourceScan.test.ts:181`) which enforces absence; **zero new references** |
| Provider-endpoint scan | `grep -RInE "submit-argument|classify-argument-boolean-observations|api\.anthropic\.com|api\.openai\.com|api\.x\.ai|api\.resend\.com" mcp-server/lib/familyEPrompt.ts mcp-server/tests/familyEPrompt.test.ts mcp-server/tests/familyEResponseValidator.test.ts` | zero matches |
| Secret/JWT/auth scan | `grep -RInE "sbp_…\|sb_secret_…\|sk-ant-…\|eyJ…\|Authorization:\|Bearer <literal>" <touched files>` | zero matches |

## 7. Adversarial review (Phase 5; ≥7 card-specific checks)

Run as a structured self-review against §12 of the card brief.

| # | Concern | Verdict | Evidence |
|---|---|---|---|
| 1 | Did we loosen schema validation? | **No** | `mcpBooleanObservationSchemaMirror.ts` byte-equal preserved (verified via `git diff --stat HEAD` — zero entry). Validator still rejects invalid packets identically to before. |
| 2 | Did we loosen doctrine/ban-list validation? | **No** | `familyEBanListScan.ts` byte-equal preserved. The PR #420 RCA refuted H1 (ban-list rejection) for this drill but the doctrine remains binding; ban-list semantics unchanged. |
| 3 | Did we add brittle prompt text that raises banned-token risk in `evidenceSpan` (`wrong` / `invalid` / `flawed` / `fallacy`)? | **No** | Dedicated test `Family E user prompt: response-shape guardrail block does not introduce banned verdict tokens` scans the new block for all 9 banned standalone tokens / phrases; passes. |
| 4 | Did we distinguish *confirmed* response-shape failure from *unconfirmed* token-budget pressure (wording discipline)? | **Yes** | §1 carries the operator-mandated phrasing verbatim: "response-shape validation confirmed; token-budget pressure remains a possible contributor." §2c recommends no bump; §3 leaves `FAMILY_E_MAX_TOKENS=1500` unchanged. |
| 5 | Did we avoid Stage 1, H retry, Family I, routing, cron, Vault, env? | **Yes** | Routing-flag scan returns zero new references. familyRegistry.ts byte-equal preserved. No env/Vault/cron/migration change. |
| 6 | Do the validator-regression tests codify the prior failure class, and does the prompt source-scan fail if the key-set-equality guardrail is removed? | **Yes** | (a) Three new validator tests name the exact drill failure paths (`evidenceSpan.abductive_explanation_present` object/array; `checkedRawKeys` missing-key) and assert `result.path === '<drill-path>'`. (b) Prompt source-scan tests use anchor regexes (`STRICT RESPONSE-SHAPE CONTRACT` heading; `no extras, no omissions` phrase; `SELF-CHECK` block) that fail if the guardrails are removed. |
| 7 | Is Deno Deploy documented as the deployment target for the mcp-server change (merge ≠ deploy)? | **Yes** | §8 "Authorizations + follow-ups" + the §11 final operator message both state that merging this PR does NOT deploy `mcp-server/`; the operator must push to Deno Deploy `cdiscourse-mcp-server` before the queue-load-smoke retry. |

**Bonus checks (card-tailored):**

| # | Concern | Verdict | Evidence |
|---|---|---|---|
| 8 | Did the prompt fix align to the validator's actual behavior (not the reverse)? | **Yes** | Phase 1 §2a verified the validator contract directly at `mcpBooleanObservationSchemaMirror.ts:100-313`. The new STRICT RESPONSE-SHAPE CONTRACT block restates the validator's bidirectional and one-way containment rules in model-comprehensible language; the prompt is stricter than the validator in one place (declares checkedRawKeys-equality across all four maps, vs the validator's one-way `observations ⊆ checkedRawKeys`) — stricter prompt + same validator is safe. |
| 9 | Did the existing `MAX_TOKENS=1500 is sent to Anthropic API (no bump)` test still pass after the prompt change? | **Yes** | Family E Anthropic test count unchanged (11 → 11); full Family E suite green at 173 tests. |

## 8. Authorizations + follow-ups

**On PASS (this card's verdict):**
- Family E packet-shape contract is now mechanically enforced in the prompt and codified in validator regression tests.
- The fix does NOT make validator rejection impossible — prompt-hardening is a *probabilistic* mitigation against systematic shape drift. Whether the residual rate is within the dead-letter budget is what the **separate** queue-load-smoke retry measures, not this card.
- **Stage 1 routing flip remains UNAUTHORIZED.** Family H production retry remains gated. Family I remains gated.

**Required operator next step (NOT executed by CC):**
1. **Deploy `cdiscourse-mcp-server` to Deno Deploy** with the post-PR `mcp-server/` build. Supabase merge-auto-deploy does NOT propagate `mcp-server/` code; a separate Deno Deploy push is required. Reference the operator's PR #420 finding ("R3 emitter lives in Deno Deploy, NOT Supabase Edge Function") and PR #418's deploy-attribution correction.
2. Schedule a **separate** `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY` card (NOT auto-opened by this audit) AFTER the Deno Deploy push lands. Use the same N=8 burst harness + same query pack; expect the cluster's recurrence rate to drop sharply if this mitigation is effective.

**Other follow-ups (regardless of the next drill's outcome):**
- RCA's R1 (jsonb `failure_detail` column on `argument_machine_observation_runs`) remains the highest-value persistence-side probe — it would persist the inner `validateMcpBooleanObservationResponse` failure path to the DB automatically for every cell, removing the dependency on Deno Deploy log retention and operator-side manual aggregation.
- RCA's R4 (fixture-mode burst) is now lower-priority since H2 (provider-side) is refuted; fixture mode would still partition any residual MCP-internal failure from provider-internal failure.
- `OPS-MCP-FAMILY-E-BANLIST-DOCTRINE-REVIEW` (RCA R6) is **deprioritized** per PR #420 finding (ban-list path never reached in this drill); still a valid long-term doctrine cleanup but does not unblock Stage 1.

## 9. Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0**. No `submit-argument` / `classify-argument-boolean-observations` / MCP / Anthropic / xAI / X API call.
- **CC writes (DB):** **0**. Read-only `SELECT` SQL via `npx supabase db query --linked --file .claude-tmp/rehearsal-queries/preflight.sql` for the Phase 0 inert verification only.
- **CC writes (file system; only these four):**
  - `mcp-server/lib/familyEPrompt.ts` — user-prompt block 226-228 replaced with STRICT RESPONSE-SHAPE CONTRACT (+42 lines net).
  - `mcp-server/tests/familyEPrompt.test.ts` — +7 new tests + 1 updated.
  - `mcp-server/tests/familyEResponseValidator.test.ts` — +4 new tests.
  - `docs/audits/OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING-2026-06-01.md` — this audit.
- **Routing flag at execution time:** `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-attested per PR #419 / #420 stand-down). NOT touched by this card.
- **Family roster at execution time:** A-G production-enabled; H/I/J production-disabled (`familyRegistry.ts:106 / 111 / 116`). NOT touched.
- **Mutations:** **0** by CC. No env / Vault / cron / percentage / routing-flag / migration / familyRegistry / retry-policy / drainer / ban-list / prompt-for-other-families / schema-mirror / package.json / source-6 change.
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / raw provider payloads / raw MCP log lines written to this audit. The drill's three failing requestIds (`6ef74311…`, `8b0d42de…`, `50abe6af…`) are correlation ids only; no body / prompt / payload accompanies them.

## 10. Test-count baseline for `current-status.md`

Tests at HEAD post-merge of this card:
- **Jest**: 18,825 / 596 suites (unchanged — no Jest-side change in this card)
- **MCP Deno**: 1,213 / 0 failed (was 1,202 at HEAD `2f179cc`; +11 from this card)
- **Family E Deno (subset)**: 173 / 0 failed (was 162 at HEAD `2f179cc`; +11 = +7 prompt + +4 validator regression)
