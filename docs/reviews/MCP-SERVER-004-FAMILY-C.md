# MCP-SERVER-004-FAMILY-C — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-27
**Branch:** `feat/MCP-SERVER-004-FAMILY-C`
**HEAD:** `0b79f92`
**Design:** `docs/designs/MCP-SERVER-004-FAMILY-C.md` (`fd924f4`)
**Intent brief:** `docs/designs/MCP-SERVER-004-FAMILY-C-intent.md` (`fbf7c87`)

## Summary

Family C (`misunderstanding_repair`, 17 rawKeys) lands on the MCP server with
file-for-file Family A/B mirror discipline. The 7 absolute rules in
`familyCPrompt.ts:72-79` diff byte-equal to `familyAPrompt.ts:50-57`
(`RULES_DIFF_EXIT: 0`). The Schegloff/Sacks + Clark & Brennan
collaborative-grounding framing is anchored in both the system prompt and the
4 doctrine-risk per-key `falsePositiveGuards` blocks (`rejects_candidate_understanding`,
`acknowledges_misread`, `flags_term_ambiguity`, `clarified`). The Family A/B
`.ts` library files (`familyA*.ts`, `familyB*.ts`, `doctrineBanList.ts`,
`anthropicCall.ts`) are byte-equal untouched (`AB_DIFF_EXIT: 0`). The Edge
familyRegistry was not edited; the entry pre-shipped by MCP-021C-EDGE at
`supabase/functions/_shared/booleanObservations/familyRegistry.ts:73-77`
(`productionEnabled: false`, `adminValidationEnabled: true`) persists. The
verification battery passes clean: typecheck 0, lint 0, mcp-server Deno
467/0 (+124 from 343 baseline), Jest 17712/549/0.

## Verification

| Gate | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint | pass (exit 0) |
| mcp-server Deno test | pass (343 → 467 / 0; +124) |
| Jest test | pass (17712 / 549 suites / 0) |
| Migration apply | not applicable (no `supabase/migrations/` touched) |
| Secret scan | clean (only doctrine references to env-var names + test FAKE_KEY mirroring Family A/B) |
| Doctrine scan | clean (all `winner / truth / correct / wrong` hits inside negation form or Schegloff/Sacks repair-vocabulary allowlist documented inline at `familyCPrompt.test.ts:447-456`) |
| Out-of-scope diff | empty (`supabase/`, `app/`, `src/`, `__tests__/`, `package*`, `.gitignore`, `tsconfig*`, `.claude/` all untouched) |

## 20-item verdict matrix

| # | Item | Status | Evidence |
|---|---|---|---|
| A | Family C only; no D/E/F/G/H/I/J added | **PASS** | `familyRegistryInit.ts:57-70` registers exactly `parent_relation` + `disagreement_axis` + `misunderstanding_repair`; no `familyDKeys.ts`/`familyEKeys.ts` exists in the diff |
| B | 17-key list byte-equal verbatim to upstream | **PASS** | `familyCKeys.ts:61-79` matches `src/features/nodeLabels/machineObservationDefinitions/familyC.ts` declaration order; `familyCKeysParity.test.ts:41-68` enforces (asserts upstream regex extracts 17 declarations, all in server-side constant) |
| C | One-line additive register call in init | **PASS** | `familyRegistryInit.ts:67-70` adds a third `register('misunderstanding_repair', { ... })` call after the Family B call; Family A + Family B blocks preserved byte-equal (`lines 57-65`) |
| D | Family A behavior byte-equal | **PASS** | `git diff fd924f4..HEAD -- mcp-server/lib/familyA*.ts` returns empty (`AB_DIFF_EXIT: 0`); `familyCDispatch.test.ts:127-140` asserts Family A request still routes to `family-a-v1` |
| E | Family B behavior byte-equal | **PASS** | `git diff fd924f4..HEAD -- mcp-server/lib/familyB*.ts` returns empty; `familyBDispatch.test.ts` edit is a 1-name + 1-assertion swap (C→F) since the previously-tested "C is unsupported" semantics are now false (test count preserved; behavioral coverage preserved); `familyCDispatch.test.ts:142-155` asserts Family B request still routes to `family-b-v1` |
| F | unsupported_family envelope correct for D-J | **PASS** | `familyCDispatch.test.ts:237-273` covers D + E rejection with full 3-family `supportedFamilies` envelope; `familyBDispatch.test.ts:179-208` covers F; `familyBooleanRequestSchema.test.ts:371-379` covers D, E, F regression loop |
| G | Prompt frames repair as collaborative grounding | **PASS** | `familyCPrompt.ts:84-88` system prompt contains "Repair is collaborative grounding work; both sides remain valid contributors to the discussion. … None of these is a verdict on either participant"; `familyCPrompt.ts:211-220` user-prompt collaborative-grounding note; `familyCPrompt.test.ts:86-106` enforces all 10 framing fragments |
| H | Ban-list scan rejects verdict/failure tokens | **PASS** | `familyCBanListScan.ts:37-65` mechanical copy of `familyBBanListScan.ts` field-for-field; reuses shared `DOCTRINE_BAN_PATTERNS`; `familyCBanListScan.test.ts` covers winner/loser/verdict/truth/liar/bad faith/extremist/manipulative/propagandist/correct/incorrect/dishonest in evidenceSpans + modelInfo |
| I | Fixtures cover canonical + 4 specific patterns | **PASS** | 5 per-scenario request fixtures present: canonical (offers_candidate_understanding), clarification-cycle (answers_clarification), candidate-understanding (rejects + offers paraphrase), shared-definition (confirms_shared_definition), no-repair (Family-B `disputes_generalization` adversarial content); `familyCDoctrineFixtures.test.ts:180-199` asserts the no-repair fixture content shape |
| J | Edge familyRegistry untouched in this card | **PASS** | `git diff fd924f4..HEAD -- supabase/` returns empty; the pre-existing entry at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:73-77` (`productionEnabled: false, adminValidationEnabled: true`) persists; existing `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` FR-7 + FR-9 pin the shape |
| K | Smoke script extended with +2 Family C checks | **PASS** | `scripts/mcp-server-001-smoke.sh:358-401` adds Check 12 (`compat-boolean-family-c`) + Check 13 (`mcp-tools-call-boolean-family-c`) verbatim from design §6.3-6.4; header updated from "11 checks" to "13 checks" (`lines 3-7, 18`) |
| L | Test forecast met (+95 to +115 design; +124 observed) | **PASS** | 343 → 467 = +124; ~9% upper-band overage explained by the 4 cross-family dispatch combinations + 7 Family C boolean schema additions + 3 doctrine-risk-key verbatim assertions; well clear of HALT #16 (+300) |
| M | All new tests pass | **PASS** | mcp-server Deno test reports `467 passed | 0 failed (2s)` |
| N | Existing Deno tests still pass | **PASS** | 343-baseline preserved; the dispatcher regression tests in `familyCDispatch.test.ts:127-155` re-prove Family A + B routing post-Family-C-registration |
| O | Existing Jest tests still pass | **PASS** | Jest reports `Test Suites: 549 passed, 549 total / Tests: 17712 passed, 17712 total / Time: 14.605 s / JEST_EXIT: 0` |
| P | No new taxonomy keys | **PASS** | `git diff fd924f4..HEAD -- src/features/nodeLabels/` returns empty (out-of-scope diff is empty) |
| Q | No schema version change | **PASS** | All response-shape `schemaVersion` constants remain `mcp-021.machine-observations.boolean.v1`; `familyCPrompt.ts:175` + canonical fixture line 2 + all 5 request fixtures verify |
| R | No persistence / migration / DB shape change | **PASS** | `git diff fd924f4..HEAD -- supabase/` empty; no migration file added; no Edge edit |
| S | No UI changes | **PASS** | `git diff fd924f4..HEAD -- app/ src/` empty |
| T | No client secret leakage | **PASS** | `familyCAnthropic.ts:38-47` reuses shared `callAnthropic`; `familyCAnthropic.test.ts:179-224` API-key-never-logged on both success + failure paths with `FAKE_KEY = 'sk-ant-fake-key-for-test-only-1234567890abcdef'` mirroring Family A/B precedent; no `console.log` of headers/prompts/bodies/responses; no Authorization or x-api-key literal in any new source file (the comment at `familyCAnthropic.ts:17` is documentation pointing into the shared wrapper) |

## HALT trigger re-evaluation

All 22 HALT triggers re-evaluated **CLEAN**.

Specific re-evaluation notes worth recording (none are blocking, just substantiating the design-time `PASS` claims):

- **#5 (Family A/B byte-equal):** test-file edits exist in `familyBDispatch.test.ts` and `classifyArgumentBooleanObservations.test.ts`. Both are pure stale-assertion swaps. The B-dispatch test (lines 176-208 in diff) renames `unsupported family C → unsupported family F (critical_question)` since `misunderstanding_repair` is now supported; the dispatcher test (lines 122-145 in diff) updates the `supportedFamilies` array literal from `['parent_relation', 'disagreement_axis']` to `['parent_relation', 'disagreement_axis', 'misunderstanding_repair']`. No behavior coverage reduced; no Family A/B production code touched (`AB_DIFF_EXIT: 0`).
- **#14 (compound-key collision):** `familyCKeysParity.test.ts:70-96` explicitly asserts Family A ∩ Family C = ∅ AND Family B ∩ Family C = ∅. Both pass at Deno run-time.
- **#15 (MAX_TOKENS bump):** `familyCPrompt.ts:40` sets `FAMILY_C_MAX_TOKENS = 1500` (matches Family A/B); `familyCPrompt.test.ts:108-112` pins to 1500.
- **#16 (test forecast > +300):** observed +124 vs forecast +95 to +115. Slight upper-band overage is documented in the handoff (`docs/core/current-status.md` Family C section) and is attributable to the 4 cross-family dispatch combinations × 2 envelope checks + the 3 doctrine-risk-key verbatim assertions. +124 is well clear of +300.
- **#17 (repair as correct/incorrect):** `familyCPrompt.ts` system prompt contains "correct" only in the rule-block negation form ("You do NOT decide who is right") and "correct" appears in user-prompt entries in the Schegloff/Sacks descriptive sense ("invitation to correct", "the move corrects rather than confirms", "Actually, correction — I meant 13%"). The `familyCPrompt.test.ts:396-477` doctrine scan explicitly allowlists these descriptive uses as class (c) Schegloff/Sacks technical vocabulary with the reasoning documented inline; the ban-list scan at the model RESPONSE boundary still catches verdict-form uses.
- **#18 (rejects_candidate_understanding as negative):** `familyCKeys.ts:212` per-key `falsePositiveGuards` reads verbatim "the rejector saying 'that is not what I meant,' not 'you are wrong.' It is symmetric to confirms_understanding"; `familyCPrompt.test.ts:273-282` enforces the verbatim fragment.
- **#19 (verdict tokens in user-facing strings):** the rendered user prompt (model-facing, not user-facing) is scanned at `familyCPrompt.test.ts:396-477`; the verdict tokens appear only in doctrine-positive negation form or the Schegloff/Sacks descriptive allowlist. No UI in this card.
- **#21 (misunderstanding as failure on either side):** `familyCPrompt.ts:84` system prompt contains "Repair is collaborative grounding work; both sides remain valid contributors to the discussion"; `familyCKeys.ts:276` `acknowledges_misread` per-key guard reads verbatim "acknowledging a misread is constructive repair work, not a verdict on the original author"; `familyCPrompt.test.ts:284-293` enforces the verbatim fragment.

## Doctrine deep-check findings

**1. Collaborative-grounding framing integrity.** `familyCPrompt.ts:69-102` contains the full system prompt. The 7 absolute rules block at lines 72-79 is byte-equal to `familyAPrompt.ts:50-57` (verified with `diff`, `RULES_DIFF_EXIT: 0`). The collaborative-grounding doctrine framing at lines 81-93 explicitly says "Repair is collaborative grounding work; both sides remain valid contributors to the discussion … None of these is a verdict on either participant." The user-prompt note at lines 211-220 carries the 4 doctrine-risk anchors verbatim (rejects → "not 'you are wrong'", acknowledges_misread → "not a failure", flags_term_ambiguity → "does NOT imply the parent wrote ambiguously", scope_mismatch_identified → "not a fault"). Pass.

**2. Lifecycle key guard for `clarified`.** `familyCKeys.ts:115-116` per-key `falsePositiveGuards` for `clarified` reads verbatim "Lifecycle key: when you only see the move text and not the full cluster, answer FALSE with low confidence." `familyCPrompt.ts:204-209` user-prompt lifecycle note repeats the FALSE-low instruction. This is structurally equivalent to Family A's `has_rebuttal`/`has_counter_rebuttal`/`rebutted` guard at `familyAPrompt.ts:169-175`. The canonical fixture at `mcp-server/fixtures/classify-argument-boolean-observations.family-c-canonical-response.json` encodes `"clarified": false` + `"confidence": "low"` (lines 24, 43); `familyCPrompt.test.ts:306-315` enforces the verbatim guard fragment. Pass.

**3. Ban-list scan coverage.** `familyCBanListScan.ts:37-65` mechanical copy of `familyBBanListScan.ts` field-for-field. Scans: every `evidenceSpan` string (17 max — one per Family C rawKey), `modelInfo.serverName`, `modelInfo.classifierSetVersion`. Does NOT scan: `nodeId`, `schemaVersion`, `checkedRawKeys` entries, `confidence` band values, `observations` boolean values. Pattern set is the shared `DOCTRINE_BAN_PATTERNS` constant (no new banned tokens added per intent brief §7 Phase A.4). Pass.

**4. Anthropic call discipline.** `familyCAnthropic.ts:38-47` reuses the shared `callAnthropic` wrapper with `toolNameForLogging: 'classify_argument_boolean_observations'`. No new fetch call. No `console.log` of headers/prompts/request bodies/response bodies (the only `x-api-key` mention in the diff is a comment at line 17 documenting the shared wrapper). `familyCAnthropic.test.ts:179-204` (success path) + `familyCAnthropic.test.ts:206-224` (failure path) assert the API key never appears in any log line, using a captured-line sink. `familyCAnthropic.test.ts:226-252` asserts logs are tagged with the tool name. Mirrors Family A/B precedent test-by-test. Pass.

**5. Fixture content discipline.** The 5 per-scenario request fixtures use synthesized library / climate / carbon-tax text drawn from the same domain pool as Family B's fixtures (per design Decision 1). No real-world political figures, no current events that age out. The no-repair fixture (`mcp-server/fixtures/classify-argument-boolean-observations.family-c-no-repair-request.json`) contains Family B `disputes_generalization` move text (Australia carbon-tax counter-example); `familyCDoctrineFixtures.test.ts:180-199` asserts the fixture contains "generalization" and "Australia" trap markers, proving the cross-family discriminator design. Pass.

**6. Smoke check 12 + 13 fidelity.** `scripts/mcp-server-001-smoke.sh:358-401` carries Check 12 + 13 bodies verbatim from design §6.3-6.4. Check 12 POSTs to `/mcp/adapter-compat` with `requestedFamilies: ['misunderstanding_repair']` + 3 sample rawKeys (`offers_candidate_understanding`, `confirms_understanding`, `rejects_candidate_understanding`) and asserts the response contains `'family-c-v1'`. Check 13 is the JSON-RPC equivalent via `/mcp` `tools/call` with the same body and adds an `isError:false` assertion. Existing redaction patterns reused; final tally bumps to "13 PASSES, 0 FAILS". Pass.

**7. Edge familyRegistry untouched.** `git diff fd924f4..HEAD -- supabase/` returns empty. The pre-shipped MCP-021C-EDGE entry at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:73-77` persists. The existing `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` FR-4 (declaration order), FR-7 (non-parent_relation `productionEnabled: false`), and FR-9 (`adminValidationEnabledFamilies()` includes `misunderstanding_repair`) all continue to pass (Jest 549/549, 17712/17712). Per design Decision 3, the implementer correctly chose NOT to add a redundant Jest assertion. Pass.

**8. No CI/CD or hook bypasses.** No `.gitignore`, `settings.json`, or `tsconfig` changes; no `--no-verify` or `--no-gpg-sign` invocations in any commit message. Commits are unsigned (`GPG: N`) consistent with the repo's existing Family A/B commits and the project norm. Pass.

## Specific actionable comments

None — verdict is Approve.

## Optional polish suggestions (non-blocking; operator can defer)

1. **`familyCPrompt.test.ts:447-456` Schegloff/Sacks "correct" allowlist documentation.** The class (c) allowlist that treats "correct" descriptively in the model-facing user prompt is technically sound (Schegloff/Sacks repair-pattern vocabulary names a move type, not a verdict), but the allowlist is slightly looser than HALT trigger #17's strict reading. The reasoning is documented inline at lines 405-416. If the operator wants a stricter ratchet, a follow-on OPS observability card could narrow the allowlist to specific phrases (`"invitation to correct"`, `"the move corrects rather than confirms"`, `"self-correct"`, `"Actually, correction"`) rather than the open `/correct/i.test(matchedToken)` predicate. Non-blocking — the prompt template is model-facing only and the ban-list scan at the response boundary still catches verdict-form uses.

2. **Decision 7 (validator script).** Per design §9 Brief Ledger #7, the implementer correctly chose NOT to add `validate-family-c-response.ts` (a CLI convenience parallel to Family A/B). If the operator wants the parity, it can be added in a small follow-on card; not needed for Family C operability.

3. **Test count band edge (+124 vs +95-115 forecast).** The 9% upper-band overage is explained in the handoff doc (4 cross-family dispatch combinations + 3 doctrine-risk-key verbatim assertions added 1-2 more tests than estimated). Well clear of HALT #16 (+300). No action needed; the PR body should reflect the observed +124 delta rather than the forecast +95-115.

## Recommendation to operator

Use the design §6 PR template as the binding PR-body form, with the following factual updates against the design-time forecast:

- **Test delta:** **+124** observed (343 → 467 Deno tests in `mcp-server/tests/`), vs design forecast +95 to +115. The slight upper-band overage is documented in `docs/core/current-status.md` and is attributable to the 4 cross-family dispatch combinations (A↔C, B↔C) + the 3 doctrine-risk-key verbatim guard assertions. Well clear of HALT #16 (+300).
- **Jest:** **17712 / 549 suites / 0 fail / 14.605 s**.
- **Typecheck + lint:** both exit 0 on root.
- **Edge familyRegistry:** byte-equal untouched in this card; pre-existing MCP-021C-EDGE entry at lines 73-77 persists (`productionEnabled: false`, `adminValidationEnabled: true`); existing `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` continues to pin the shape (FR-4 / FR-7 / FR-9).
- **Doctrine scan:** clean — all `winner / truth / correct / wrong` hits are in negation form, the Schegloff/Sacks repair-vocabulary descriptive allowlist documented inline at `familyCPrompt.test.ts:447-456`, or the verbatim doctrine-positive sentences in the system + user prompts.
- **Secret scan:** clean — only doctrine references to env-var names + test `FAKE_KEY` mirroring Family A/B precedent.

## Operator next steps

1. **Push the branch:**
   ```bash
   git push -u origin feat/MCP-SERVER-004-FAMILY-C
   ```

2. **Open PR using the design §6 template:**
   ```bash
   gh pr create --title "MCP-SERVER-004-FAMILY-C: Misunderstanding Repair Boolean Observation Classifier" --body-file docs/reviews/MCP-SERVER-004-FAMILY-C.md
   ```

3. **Post-merge auto-deploy:** Deno Deploy auto-deploys `mcp-server/main.ts` on push to `main`. No Supabase migration; no Edge Function redeploy needed.

4. **Run 8-phase smoke per design §6 / intent brief §9:**
   - Phase 3 hosted smoke: `bash scripts/mcp-server-001-smoke.sh --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net --token <hosted-bearer-token>`. Expect `13 PASSES, 0 FAILS / EXIT: 0`.
   - Phase 4 Edge `admin_validation` against the 3 seeded args (`f41b18b0-…`, `781f8057-…`, `db0de3e0-…`). Per Decision 9, 0 Family C positives is acceptable PARTIAL.
   - Phase 5 unsupported D-J rejection regression.
   - Phase 6 targeted Jest + Deno regression suites.
   - Phase 7 OPS observations.
   - Phase 8 verdict + authorization.
   - Author audit at `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-<YYYY-MM-DD>.md` using the template at `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-template.md`.

5. **Post-merge worktree cleanup (operator step):**
   ```powershell
   # From the main repo root (NOT inside a worktree).
   git worktree list | grep "feat/MCP-SERVER-004-FAMILY-C"
   git worktree remove -f -f ".claude/worktrees/agent-<hash>"
   git branch -D feat/MCP-SERVER-004-FAMILY-C
   git worktree list | grep -c "agent-<hash>"   # must print 0
   ```
   If `git worktree remove` reports "Filename too long", use the UNC long-path workaround documented in roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)" EC-2 (PowerShell `Remove-Item -Path "\\?\<abs-path>" -Recurse -Force` followed by `git worktree prune`).

6. **Authorization after PASS** (per intent brief §11):
   - `MCP-SERVER-005-FAMILY-D` AUTHORIZED to begin with mandatory Stage-2B operator-decision checkpoint for the ai_classifier subset filter decision.
   - `OPS-MCP-OBSERVABILITY` STRONGLY RECOMMENDED to ship before D (3 families operational).
