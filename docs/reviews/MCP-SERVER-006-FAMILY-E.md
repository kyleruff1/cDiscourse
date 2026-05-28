# MCP-SERVER-006-FAMILY-E — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-27
**Branch:** feat/MCP-SERVER-006-FAMILY-E
**Design:** docs/designs/MCP-SERVER-006-FAMILY-E.md
**Intent brief:** docs/designs/MCP-SERVER-006-FAMILY-E-intent.md
**HEAD:** b4422e9
**Merge base:** fda7a80 (intent brief commit on main)
**Commit count on branch:** 7 (1 designer + 6 implementer)

---

## Summary

This card lands the fifth MCP boolean-observation classifier family — Family E (`argument_scheme`, 16 Walton 1995/2008 argumentation schemes) — in admin-validation-only posture. The doctrine load on this card is the highest in the family batch because `slippery_slope_reasoning_present` carries an existential risk: the literature frames slippery-slope as a fallacy, and CDiscourse treats it descriptively. The implementer built a five-layer defense (system prompt CRITICAL DOCTRINE block + per-key falsePositiveGuards + Family E-specific 12-pattern ban-list scan + 3 adversarial fixtures + a dedicated test file with 15 Deno.test entries) that exactly mirrors the design §3 + amendment §2/§3 binding. Family A/B/C/D, the shared `DOCTRINE_BAN_PATTERNS`, the schema mirror, the Edge functions, and all `supabase/migrations/` are byte-equal preserved. All gates exit 0: typecheck, lint, Deno (614 → 792, +178), Jest (18,008 → 18,016, +8), secret scan clean (only a test-fake `sk-ant-fake-key-for-test-only-...` matches), doctrine scan hits are all inside negation patterns or as inputs to ban-list-rejection tests. The +178 Deno test count is +63 above the design's +95-115 midpoint forecast but is essentially the design §5's own upper-band raw sum (176) — the implementer shipped the full upper-band rather than folding cross-family tests as the design permitted. Justified expansion: 5-way cross-family rejection, full amendment §3 token coverage in the ban-list scan, and the dedicated adversarial slippery_slope file. Not test-bloat.

---

## Top 3 findings

1. **The five-layer slippery_slope doctrine defense is real and surgically anchored.** `mcp-server/lib/familyEPrompt.ts:81-94` contains the CRITICAL DOCTRINE block naming all three doctrine-risk schemes (slippery_slope / abductive / analogy). `mcp-server/lib/familyEKeys.ts:337` carries the verbatim slippery_slope `falsePositiveGuards` per design §3. `mcp-server/lib/familyEBanListScan.ts:65-83` enumerates 12 patterns covering all 11 amendment §3 tokens (plus `invalid argument` as defense-in-depth bonus). `mcp-server/tests/familyEAdversarialSlipperySlope.test.ts` is a dedicated 15-test file that exercises every banned token AND the prompt-entry guard surface. The implementer did not shortcut any layer.

2. **Byte-equal preservation is provably complete.** `git diff fda7a80..HEAD -- mcp-server/lib/familyA*.ts mcp-server/lib/familyB*.ts mcp-server/lib/familyC*.ts mcp-server/lib/familyD*.ts mcp-server/lib/doctrineBanList.ts mcp-server/lib/seedPrompt.ts mcp-server/lib/mcpBooleanObservationSchemaMirror.ts mcp-server/lib/anthropicCall.ts mcp-server/lib/familyRegistry.ts mcp-server/lib/familyBooleanRequestSchema.ts mcp-server/bootstrap.ts mcp-server/tools/classifySemanticMove.ts supabase/functions/ supabase/migrations/` is empty. Updates to Family B/C/D dispatch tests are surgical: they swap unsupported-family probes from `argument_scheme` to Family F/G/H and extend the supportedFamilies envelope assertion to include `argument_scheme` (5-family expansion). No behavioral change to existing assertions.

3. **Edge familyRegistry Family E entry already-existing posture is locked-in by 8 new Jest assertions** in `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts`. FE-2 asserts `productionEnabled: false` — Card 3 is admin-validation-only. FE-8 asserts the registry's A→J A-position invariant (Family E is index 4 of the 10-family list). Any future card that accidentally flips Family E's production posture before the explicit ENABLE card will fail the build with a Family-E-specific message.

---

## Verification

| Gate | Result |
| ---- | ------ |
| `npm run typecheck` | pass (exit 0) |
| `npm run lint` | pass (exit 0) |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read` | pass — 792 passed / 0 failed (3s). Baseline 614 + 178 new = 792. |
| `npm test` | pass — 18,016 passed / 569 suites (14.8s). Baseline 18,008 + 8 new = 18,016. |
| Secret scan (key/token shapes in diff) | clean — only `FAKE_KEY = 'sk-ant-fake-key-for-test-only-1234567890abcdef'` (test fake; `for-test-only` marker; standard Family A/B/C/D pattern). No real secret values. |
| Doctrine scan (winner/loser/verdict/popularity etc.) | clean — all hits are inside negation patterns ("MUST NOT call this fallacy"), prompt doctrine framing, or are inputs to ban-list-rejection tests asserting the scan correctly rejects them. |
| `src/`+`app/` diff | empty — production app untouched. |

---

## 25-item verdict matrix

### Scope (8 items)

| # | Item | Verdict | Evidence |
| - | ---- | ------- | -------- |
| A | Family E 16-key list matches `familyE.ts` source verbatim | PASS | `mcp-server/lib/familyEKeys.ts:68-85` lists all 16 in declaration order from upstream `familyE.ts`. `familyEKeysParity.test.ts` enforces parity (9 Deno.test entries). |
| B | `familyEKeys.ts` uniform `ai_classifier` source | PASS | Per upstream `familyE.ts` Phase 0 audit (design §1). All 16 use `buildScheme(b)` which pins `source: 'ai_classifier'`. 0 auto_metadata / 0 lifecycle. |
| C | `FAMILY_E_CLASSIFIER_SET_VERSION === 'family-e-v1'` | PASS | `mcp-server/lib/familyEKeys.ts:88` `export const FAMILY_E_CLASSIFIER_SET_VERSION = 'family-e-v1' as const;` |
| D | `FAMILY_E_MAX_TOKENS = 1500` (no bump; A/B/C also 1500; D=1800 isolated) | PASS | `mcp-server/lib/familyEPrompt.ts:40` `export const FAMILY_E_MAX_TOKENS = 1500;` Family A/B/C/D files byte-equal. |
| E | `mcp-server/lib/family[ABCD]*.ts` byte-equal preserved | PASS | `git diff fda7a80..HEAD -- mcp-server/lib/familyA*.ts mcp-server/lib/familyB*.ts mcp-server/lib/familyC*.ts mcp-server/lib/familyD*.ts` is empty. |
| F | `mcp-server/lib/doctrineBanList.ts` byte-equal preserved | PASS | `git diff fda7a80..HEAD -- mcp-server/lib/doctrineBanList.ts` is empty. Family E extensions live in own scan file per design §3. |
| G | `supabase/functions/` byte-equal preserved | PASS | `git diff fda7a80..HEAD -- supabase/functions/` is empty. Edge familyRegistry Family E entry was pre-existing per design §1. |
| H | `mcp-server/lib/seedPrompt.ts` + `mcpBooleanObservationSchemaMirror.ts` byte-equal preserved | PASS | Both empty in `git diff`. Schema mirror unchanged; flat-keyed response shape preserved. |

### Doctrine — slippery_slope core (BINDING; amendment §2+§3) — 6 items

| # | Item | Verdict | Evidence |
| - | ---- | ------- | -------- |
| I | `familyEPrompt.ts` system prompt frames schemes as descriptive, NOT as faults | PASS | `familyEPrompt.ts:74-79` "Each question is a structural observation about the form of the move's reasoning — not a judgment about whether that reasoning is fallacious, weak, valid, invalid, sound, unsound, or bad. Schemes are descriptive shape facts." Lines 81-94 add the CRITICAL DOCTRINE block naming slippery_slope, abductive, analogy. |
| J | `familyEKeys.ts` has verbatim per-key `falsePositiveGuards` for slippery_slope | PASS | `familyEKeys.ts:337` reproduces the design §3 verbatim guard for slippery_slope_reasoning_present: "DOCTRINE: slippery-slope is a SCHEME, never a fallacy... output evidenceSpan ... MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'bad reasoning', 'flawed', 'wrong', 'proof of', 'logical error', or any quality judgment." Equivalent guards present for abductive (line 305) and analogy (line 145). |
| K | `familyEBanListScan.ts` scans all 11 amendment §3 tokens | PASS | `familyEBanListScan.ts:65-83` lists 12 patterns: `fallacy`, `fallacious`, `invalid`, `flawed`, `wrong`, `weak argument`, `invalid argument` (bonus over amendment list — defense in depth), `bad reasoning`, `flawed reasoning`, `logical error`, `informal fallacy`, `proof of`. All 11 amendment-binding tokens present + 1 additive. |
| L | Ban-list scan scope covers evidenceSpan + modelInfo + explanation/reason | PASS | `familyEBanListScan.ts:103-125` scans every evidenceSpan string (16 max), then modelInfo.serverName, then modelInfo.classifierSetVersion. Design §3 documents that MCP response shape has NO free-form explanation/reason fields; every string field that COULD carry prose IS scanned. content[text] is `JSON.stringify(responseCheck.value)` per `classifyArgumentBooleanObservations.ts:446`, so its scan coverage is transitive. |
| M | 3+ adversarial slippery_slope fixtures present | PASS | All 3 binding fixtures verified: `mcp-server/fixtures/classify-argument-boolean-observations.family-e-slippery-slope-clear-request.json` (4 lines of `currentText` chaining 4 steps); `…-slippery-slope-adversarial-fallacy-word-request.json` (line 7 contains "Critics call this a slippery-slope fallacy"); `…-slippery-slope-multi-scheme-request.json` (4 requestedRawKeys; multi-scheme). Verified by `familyEAdversarialSlipperySlope.test.ts:55-109`. |
| N | `familyEAdversarialSlipperySlope.test.ts` asserts model output does NOT echo "fallacy"/etc. | PASS | `familyEAdversarialSlipperySlope.test.ts:116-179` has 9 ban-list rejection tests covering fallacy, weak argument, invalid, flawed, wrong, proof of, logical error, informal fallacy; line 181-205 asserts FAMILY_E_BAN_PATTERNS contains all 11 amendment-binding tokens; line 207-233 asserts the slippery_slope prompt-entry guard surfaces all 9 forbidden output words verbatim. |

### Test coverage + structure (6 items)

| # | Item | Verdict | Evidence |
| - | ---- | ------- | -------- |
| O | Test forecast +178 over +95-115 design forecast; +8 Jest within | PASS (with analysis below) | +178 Deno is +63 over the 105 midpoint but matches the design §5's own 176-test upper-band raw sum (within +2). Design §5 explicitly said "Implementer may consolidate the 5-way matrix into a single parameterized test set; the +95 lower bound is the binding minimum." Implementer chose breadth over consolidation. See "Test forecast overshoot analysis" below for per-file breakdown. Not test-bloat. |
| P | `familyEKeys.test.ts` asserts 16 keys; parity test asserts A∩E=B∩E=C∩E=D∩E=∅ | PASS | `familyEKeys.test.ts` (11 Deno.test) + `familyEKeysParity.test.ts` (9 Deno.test). Per design §5 plan covers 16-key length, no extras, no dupes, cross-family empty intersection. |
| Q | `familyEDispatch.test.ts` asserts 5-way cross-family rejection | PASS | `familyEDispatch.test.ts` (17 Deno.test). Includes Family A/B/C/D rawKey under `argument_scheme` rejection AND Family E rawKey under each of A/B/C/D rejection. |
| R | `familyEDoctrineFixtures.test.ts` asserts all 16 schemes use neutral descriptive language | PASS | `familyEDoctrineFixtures.test.ts` (13 Deno.test). Per design §5 covers the three doctrine-risk schemes plus broad descriptive-language scan. |
| S | Edge familyRegistry Family E entry assertion test exists | PASS | `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` (8 Jest assertions; FE-1 through FE-8). FE-2 locks productionEnabled=false; FE-8 locks A→J position 4 invariant. |
| T | Family E hosted MCP smoke checks added (smoke script extended to 17 checks) | PASS | `scripts/mcp-server-001-smoke.sh` lines 450-490 add `[16-compat-boolean-family-e]` and `[17-mcp-tools-call-boolean-family-e]`. Both check for `'family-e-v1'` in response. Smoke tally was 15 (Family D); is now 17. |

### Operational (5 items)

| # | Item | Verdict | Evidence |
| - | ---- | ------- | -------- |
| U | `familyRegistryInit.ts` one-line additive register call | PASS | `familyRegistryInit.ts:96-99` adds one block: `register('argument_scheme', { rawKeys: new Set(FAMILY_E_RAW_KEYS), classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION });`. Family A/B/C/D registration blocks unchanged. |
| V | `classifyArgumentBooleanObservations.ts` extends `pickFamilyProviders` for Family E | PASS | `classifyArgumentBooleanObservations.ts:273-280` adds the `family === 'argument_scheme'` branch. Family A/B/C/D branches unchanged. Imports extended at lines 90-91, 100, 106. Tool description extended at lines 111-112 to advertise Family E. |
| W | No taxonomy / prompt change for A/B/C/D | PASS | `git diff fda7a80..HEAD -- 'src/features/nodeLabels/' 'mcp-server/lib/familyA*.ts' 'mcp-server/lib/familyB*.ts' 'mcp-server/lib/familyC*.ts' 'mcp-server/lib/familyD*.ts'` is empty. |
| X | No new uniqueness index / forceRerun / idempotency mechanism | PASS | `git diff fda7a80..HEAD --name-only` shows zero supabase/migrations changes. Existing idempotency mechanisms unchanged. |
| Y | Working tree clean (only 10 known operator-territory untracked) | PASS | `git status --porcelain | grep "^??" | wc -l` = 10. Matches design Phase 1 pre-flight expectation: docs/testing-runs/2026-05-25-* (4 files), mcp021c-edge-smoke-* (3 files), netlify-prod.git, phase5-mcpserver002-* (2 files). |

**Matrix verdict: 25/25 PASS.**

---

## 24 HALT triggers re-evaluation

Per design §8, all 24 HALT triggers were evaluated NOT FIRED at design time. Re-evaluating at review time:

| # | Trigger | Status | Confirmation |
| - | ------- | ------ | ------------ |
| 1 | Card 2 audit missing | RESOLVED | `b324dae` is on main; Card 2 audit landed. |
| 2 | Cross-family key collision | NOT FIRED | Cross-family intersections in `familyEKeysParity.test.ts` (9 tests) all pass; no collision. |
| 3 | Family F/G/H/I/J registration | NOT FIRED | `familyRegistryInit.ts` registers exactly 5 families. |
| 4 | A/B/C/D behavior changes | NOT FIRED | All A/B/C/D files byte-equal. |
| 5 | F-J rejection envelope change | NOT FIRED | `familyBooleanRequestSchema.ts` byte-equal; updated test files use F/G/H instead of E for the unsupported-family probe but the envelope shape is unchanged. |
| 6 | Schema mirror response shape change | NOT FIRED | `mcpBooleanObservationSchemaMirror.ts` byte-equal. |
| 7 | New taxonomy keys | NOT FIRED | 16 keys from upstream `familyE.ts` verbatim. |
| 8 | MCP schema version change | NOT FIRED | `mcp-021.machine-observations.boolean.v1` preserved across response/request fixtures + prompt response-shape block (`familyEPrompt.ts:179`). |
| 9 | A/B/C/D prompt changes | NOT FIRED | All `familyA*.ts/familyB*.ts/familyC*.ts/familyD*.ts` byte-equal. |
| 10 | Client-side MCP call | NOT FIRED | No `src/`/`app/` files changed. |
| 11 | Secret exposure | NOT FIRED | Only `FAKE_KEY` test fixture; never read from env, never logged. |
| 12 | Logs raw body/key/token | NOT FIRED | `familyEAnthropic.ts:35-50` delegates to `callAnthropic` which has the existing redaction; `familyEAnthropic.test.ts` includes "API key never appears in success/failure log line" tests. |
| 13 | Schema mirror change required | NOT FIRED | No compound-key collision; flat-keyed shape preserved. |
| 14 | MAX_TOKENS change | NOT FIRED | 1500 (matches Family A/B/C). |
| 15 | Subset filter needed | NOT FIRED | Uniform `ai_classifier`. |
| 16 | Test forecast > +300 | NOT FIRED | +178 well under +300 HALT. |
| 17 | Edge productionEnabled=true (must be false) | NOT FIRED | FE-2 in Jest asserts `productionEnabled: false`. Edge `familyRegistry.ts:91` shows `productionEnabled: false`. |
| **18** | **slippery_slope prompt copy as fallacy** | **NOT FIRED** | **`familyEPrompt.ts:83-88` explicitly forbids the framing. Per-key falsePositiveGuards at `familyEKeys.ts:337` reproduces the design §3 verbatim guard.** |
| **19** | **Any Family E scheme framed as fallacy with critical-question unmet** | **NOT FIRED** | **System prompt `familyEPrompt.ts:77-79` states critical questions live in Family F; Family E only detects PATTERN. Test `familyEDoctrineFixtures.test.ts` (13 tests) verifies.** |
| **20** | **Ban-list misses slippery_slope-specific tokens** | **NOT FIRED** | **`familyEBanListScan.ts:65-83` enumerates 12 patterns. `familyEAdversarialSlipperySlope.test.ts:181-205` asserts all 11 amendment-binding tokens are covered.** |
| **21** | **No adversarial slippery_slope fixture** | **NOT FIRED** | **3 fixtures present and structurally verified: clear, adversarial-fallacy-word, multi-scheme.** |
| 22 | Verdict tokens in user-facing strings | NOT FIRED | Banned-token scan over diff returns only inside-negation hits + ban-list test inputs. |
| 23 | Scheme framed as inherently good/bad | NOT FIRED | All `familyEKeys.ts` doctrine notes use neutral descriptive framing. |
| 24 | Unclassified untracked files at PR | NOT FIRED | 10/10 known operator-territory files. |

**All 24 triggers NOT FIRED at review time.**

---

## Test forecast overshoot analysis

The implementer reported +178 Deno tests vs the design's +95-115 forecast band. Reviewer audit:

### Per-file count (actual vs design plan)

| File | Design plan | Actual | Delta |
| ---- | ----------- | ------ | ----- |
| `familyEKeys.test.ts` | 9-10 | 11 | +1 |
| `familyEKeysParity.test.ts` | 8-9 | 9 | 0 |
| `familyEPrompt.test.ts` | 22-25 | 23 | 0 (within band) |
| `familyEAnthropic.test.ts` | 11 | 11 | 0 |
| `familyEBanListScan.test.ts` | 22-24 | 28 | +4 (full amendment §3 + edge cases) |
| `familyEFixtureParity.test.ts` | 16-18 | 17 | 0 (within band) |
| `familyEResponseValidator.test.ts` | 17 | 17 | 0 |
| `familyEDispatch.test.ts` | 14-16 | 17 | +1 (5-way matrix expansion not consolidated) |
| `familyEDoctrineFixtures.test.ts` | 10-12 | 13 | +1 |
| `familyEAdversarialSlipperySlope.test.ts` | 10-12 | 15 | +3 (full 11-token ban-list coverage + prompt-guard verification) |
| `familyRegistryInit.test.ts` | +3 | +~5 (estimated from diff) | +2 |
| `familyRegistry.test.ts` | +3 | +~5 (estimated; 150 insertion lines) | +2 |
| `familyBooleanRequestSchema.test.ts` | +6-8 | +~9 (190 insertions) | +1 |
| Family B/C/D dispatch updates | (folding) | +6 (test renames + extension) | +6 |
| **Subtotal** | **~152-181** | **~178** | **within upper-band** |

### Verdict on overshoot

**Not test-bloat.** The design's §5 closing note states: "the +176 raw sum includes 5-way cross-family rejection coverage (A↔E, B↔E, C↔E, D↔E pairs). Implementer may consolidate the 5-way matrix into a single parameterized test set; the +95 lower bound is the binding minimum." The implementer chose breadth (one test per pair) over consolidation (one parameterized test for all pairs). +178 is ~+2 over the design's own pre-folding raw upper sum of 176.

The overshoot category:
1. **+4 in `familyEBanListScan.test.ts`** — full amendment §3 token coverage (the design said 22-24; implementer shipped 28, exercising every banned token individually with edge cases like compound words). Defensive, net-additive.
2. **+3 in `familyEAdversarialSlipperySlope.test.ts`** — the design said 10-12; implementer shipped 15 by covering all 9 ban-list rejection tokens + the prompt-guard verification + the FAMILY_E_BAN_PATTERNS coverage assertion. Defends the existential doctrine constraint with maximum granularity.
3. **+6 in Family B/C/D dispatch updates** — natural consequence of expanding the supportedFamilies envelope from 4 to 5 in 3 existing test files, plus replacing the now-stale `argument_scheme` unsupported-family probes with Family F/G/H. Surgical.

The full Deno tally (792 / 0 failed in 3s) and the fact that every new test is in the doctrine-defense path (not in the routine response-shape path) confirm the expansion is net-additive defending the slippery_slope doctrine boundary + multi-scheme coverage.

**Item O verdict: PASS.** Overshoot is justified and pre-authorized by design §5's own upper-band sum.

---

## Doctrine self-check (all PASS)

- [x] No truth/winner/loser language in user-facing strings — all hits in diff are inside negation patterns ("MUST NOT call this fallacy") or ban-list test inputs
- [x] Score never blocks posting — Family E is purely advisory metadata
- [x] No service-role in client code — no `src/`/`app/` changes
- [x] No direct insert into `public.arguments` — no Edge or migration changes
- [x] No AI calls in production app paths — all AI calls live in `mcp-server/lib/familyE*.ts` (Deno-only)
- [x] Plain language only (no raw internal codes in UI strings) — no UI strings added
- [x] Epic-specific doctrine (cdiscourse-doctrine §10a) — every Family E output is a Machine Observation; source: `ai_classifier`; never a person attribution
- [x] **slippery_slope doctrine binding** — 5-layer defense verified across system prompt (`familyEPrompt.ts:83-88`) + per-key guards (`familyEKeys.ts:337`) + Family E ban-list (`familyEBanListScan.ts:65-83`) + 3 adversarial fixtures + dedicated 15-test file

---

## Reviewer matrix — slippery_slope doctrine item (per intent brief Decision 11)

| Sub-check | What it verifies | Reviewer verdict |
| --------- | ---------------- | ----------------- |
| (1) System prompt frames slippery_slope descriptively | `familyEPrompt.ts:83-88` "slippery_slope_reasoning_present is a SCHEME. CDiscourse treats it descriptively — the move uses a chain-of-consequences inference pattern. The output MUST NOT call this a fallacy, fallacious, weak, invalid, bad reasoning, a logical error, flawed, wrong, or proof of anything." | PASS |
| (2) Per-key falsePositiveGuards for slippery_slope contain verbatim forbidden-output text | `familyEKeys.ts:337` reproduces design §3 verbatim. Test `familyEAdversarialSlipperySlope.test.ts:207-233` asserts all 9 forbidden words appear in the guard. | PASS |
| (3) `familyEBanListScan.ts` enumerates all tokens AND scans evidenceSpan + modelInfo | `familyEBanListScan.ts:65-83` lists 12 patterns; lines 103-125 scan evidenceSpan, modelInfo.serverName, modelInfo.classifierSetVersion. All 11 amendment-binding tokens present + 1 additive defense-in-depth pattern. | PASS |
| (4) Adversarial fixtures exist (≥3, ≥1 with "fallacy" in input) | 3 fixtures verified by file inspection. `…-adversarial-fallacy-word-request.json:7` contains "Critics call this a slippery-slope fallacy when I make the case". | PASS |
| (5) Smoke plan includes Phase 4b adversarial slippery_slope verification | Design §6 Phase 4b specifies 4-step adversarial verification protocol; the audit template at `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-template.md` has the Phase 4b section. | PASS |
| (6) Phase 4b PASS criterion is doctrine-clean output regardless of fire/no-fire | Design §6 "PASS: All slippery_slope-positive evidenceSpans are doctrine-clean; OR all 3 fixtures produce all-false (documented PARTIAL)." Captured verbatim in audit template. | PASS |
| (7) Phase 4b FAIL criterion is any banned token in output | Design §6 "FAIL: Any slippery_slope-positive evidenceSpan contains a banned token (fallacy etc.)." Captured verbatim in audit template. | PASS |

**Reviewer matrix verdict: 7/7 PASS.**

---

## Blockers

None.

---

## Suggestions (non-blocking)

1. **Phase 4b template completeness check (operator step, not implementer)**: `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-template.md` is the operator's post-merge fillable. Reviewer did not exhaustively read every section but the file is +365 lines and ~12KB; structurally it mirrors prior audit templates. Operator should confirm the Phase 4b section explicitly captures both the OUTPUT evidenceSpan content and the ban-list scan result so any post-deploy audit reviewer can verify the doctrine binding without re-reading the original design. Not gating.

2. **`FAMILY_E_BAN_PATTERNS` includes `invalid argument` as defense-in-depth** (line 74) which is bonus over the amendment §3 list of 11 tokens. The amendment lists "weak argument" but not "invalid argument" — both are now in the ban list, which is additive and safe. No action required; flagging for transparency.

3. **Working-tree-clean note**: the 10 untracked files in working tree are all known operator-territory files (testing-runs / smoke logs / netlify-prod.git). They should be added to `.gitignore` or moved out of the repo root in a separate housekeeping card. Not gating; pre-existing condition unrelated to this card.

---

## Operator next steps

1. **Push the branch:**
   ```
   git push -u origin feat/MCP-SERVER-006-FAMILY-E
   ```

2. **Open PR:**
   ```
   gh pr create --title "MCP-SERVER-006-FAMILY-E: Argument-scheme classifier (16 keys, admin_validation-only, 5-layer slippery_slope doctrine defense)" --body-file docs/reviews/MCP-SERVER-006-FAMILY-E.md
   ```

3. **Deploy steps:** None for Card 3. The MCP server auto-deploys on merge to main via Deno Deploy. The Edge familyRegistry Family E entry was pre-existing per design §1; no Edge code change. No migrations.

4. **Post-merge smoke (operator-run):**
   ```
   bash scripts/mcp-server-001-smoke.sh \
     --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
     --token <hosted-bearer-token>
   ```
   Expected: 17 PASSES / 0 FAILS / EXIT 0.

5. **Phase 4 Edge admin_validation smoke**: POST to `classify-argument-boolean-observations` with `requestedFamilies=['argument_scheme'], runMode='admin_validation'`. PASS requires ≥1 plausible Family E positive OR documented PARTIAL per amendment §5.

6. **Phase 4b doctrine verification (BINDING)**: POST 3 admin_validation requests matching the 3 adversarial fixtures. Verify NO `evidence_span` contains `fallacy`/`fallacious`/`weak`/`invalid`/`flawed`/`wrong`/`proof of`/`logical error`/`bad reasoning`/`informal fallacy`. ANY hit = HALT and revert.

7. **Post-merge worktree cleanup** (commands in `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)"):
   ```
   git worktree list | grep "feat/MCP-SERVER-006-FAMILY-E"
   git worktree remove -f -f "<worktree-path>"
   git branch -D feat/MCP-SERVER-006-FAMILY-E
   ```

---

## PR title + body

### Title
```
MCP-SERVER-006-FAMILY-E: Argument-scheme classifier (16 keys, admin_validation-only, 5-layer slippery_slope doctrine defense)
```

### Body
```
## Summary

Lands Family E (`argument_scheme`) of the MCP boolean-observation classifier — 16 Walton (1995, 2008) argumentation schemes (causal, analogy, example, authority, consequence, principle, definition, classification, precedent, means-end, tradeoff, abductive, exception, slippery-slope, cost-benefit, risk). Ships in admin-validation-only posture per Edge familyRegistry entry; production-mode flip deferred to a separate card.

The doctrine load on this card is existential: `slippery_slope_reasoning_present` is the highest-risk single key in the family batch because the literature frames slippery-slope as a fallacy, and CDiscourse treats it descriptively. This PR ships a five-layer defense:

1. System prompt CRITICAL DOCTRINE block (`familyEPrompt.ts:81-94`) naming the 3 doctrine-risk schemes (slippery_slope / abductive / analogy)
2. Per-key `falsePositiveGuards` with verbatim forbidden-output language (`familyEKeys.ts:337`)
3. Family E-specific 12-pattern ban-list scan covering all 11 amendment §3 binding tokens (`familyEBanListScan.ts:65-83`)
4. Three adversarial fixtures including one whose input contains "fallacy" (`mcp-server/fixtures/family-e-slippery-slope-{clear,adversarial-fallacy-word,multi-scheme}-request.json`)
5. Dedicated 15-test file (`familyEAdversarialSlipperySlope.test.ts`) exercising every banned token + the prompt-guard surface

## Scope

- 16 new files (Family E lib + tests + fixtures + smoke + Edge registry Jest test + audit template)
- 4 updated files (familyRegistryInit + familyRegistry + familyBooleanRequestSchema test files; classifyArgumentBooleanObservations.ts dispatch path; Family B/C/D dispatch tests updated to use F/G/H for unsupported-family probes)
- Family A/B/C/D files: BYTE-EQUAL preserved
- `mcp-server/lib/doctrineBanList.ts`: BYTE-EQUAL (Family E extensions live in own scan file)
- `supabase/functions/`: BYTE-EQUAL (Edge familyRegistry Family E entry pre-existing)
- `supabase/migrations/`: no changes

## Verification

- `npm run typecheck`: pass (exit 0)
- `npm run lint`: pass (exit 0)
- Deno: **614 → 792 tests / 0 failed** (+178)
- Jest: **18,008 → 18,016 tests / 569 suites** (+8)
- Secret scan: clean (only a `FAKE_KEY` test fake matches)
- Doctrine scan: clean (all hits inside negation patterns or as inputs to ban-list-rejection tests)

## Test count overshoot rationale

+178 vs the design's +95-115 forecast midpoint is +63 over but ~+2 over the design §5's own pre-folding 176-test upper-band raw sum. The implementer shipped the full 5-way cross-family matrix (not consolidated), full 11-token ban-list coverage, and the dedicated adversarial slippery_slope file with maximum granularity. Net-additive doctrine defense; not test-bloat.

## Doctrine self-check

All 5 layers verified by the reviewer (see docs/reviews/MCP-SERVER-006-FAMILY-E.md). 25-item verdict matrix PASS 25/25. 24 HALT triggers all NOT FIRED. 7-item slippery_slope reviewer sub-matrix PASS 7/7.

## Test plan

- [ ] Hosted MCP smoke (17/17 PASS)
- [ ] Phase 4 Edge admin_validation smoke (≥1 positive OR documented PARTIAL)
- [ ] **Phase 4b adversarial slippery_slope doctrine verification** (existential — any banned token in evidence_span = HALT + revert)
- [ ] Phase 5 unsupported-family rejection regression (F/G/H/I/J)
- [ ] Phase 6 targeted Jest regression sweep
- [ ] Phase 7 OPS observability summary

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
