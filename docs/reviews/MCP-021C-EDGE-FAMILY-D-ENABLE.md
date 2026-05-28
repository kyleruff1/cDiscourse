# MCP-021C-EDGE-FAMILY-D-ENABLE — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-27
**Branch:** `feat/MCP-021C-EDGE-FAMILY-D-ENABLE`
**Design:** `docs/designs/MCP-021C-EDGE-FAMILY-D-ENABLE.md`
**Intent brief:** `docs/designs/MCP-021C-EDGE-FAMILY-D-ENABLE-intent.md`
**HEAD:** `1ad343b` (4 commits on top of `21f9874`)
**Card position:** Card 2 of 3 in the FAMILY-D-COVERAGE → EDGE-FAMILY-D-ENABLE → FAMILY-E chain. Card 3 (FAMILY-E) is sequence-blocked on this card's smoke PASS via INTER-CARD CHECKPOINT B.

---

## Summary

This card flips one boolean — `productionEnabled: false → true` for the `evidence_source_chain` (Family D) entry in `supabase/functions/_shared/booleanObservations/familyRegistry.ts:86`. The change extends auto-trigger from a 3-family (A+B+C) production list to a 4-family (A+B+C+D) production list. Implementation is exactly the 1-line production-code diff the design specified, with `booleanObservationRequestBuilder.ts`, `autoTriggerDispatcher.ts`, `mcp-server/**`, and `supabase/migrations/**` all byte-equal preserved. The CRITICAL HALT trigger #14 (production-mode Family D bypasses the 19-key Subset filter) is bound by the new `mcpFamilyDSubsetFilterProductionMode.test.ts` (SFP-1..SFP-7), which is a structural mirror of the admin-mode `mcpFamilyDEdgeMcpSubsetFilter.test.ts` SF-1..SF-5/SF-10 with `mode: 'production'`. All four gates pass (typecheck/lint/Jest 18,008/0 fails). Doctrine clean: no verdict tokens, no secret leak, no service-role in client, no direct insert into `public.arguments`, no AI calls in production app paths. Card is ready for the operator to push + open PR + run the 6-phase post-merge smoke.

---

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test` | 568 suites / **18,008 tests passing** / exit 0; matches implementer-reported delta exactly |
| Test delta | 17,984 → 18,008 (**+24** = 17 in `edgeFamilyDProductionEnable.test.ts` + 7 in `mcpFamilyDSubsetFilterProductionMode.test.ts`); within design forecast +20-50; well below HALT #15 +100 |
| Targeted new-file run | `edgeFamilyDProductionEnable.test.ts` 17/17 pass; `mcpFamilyDSubsetFilterProductionMode.test.ts` 7/7 pass |
| Secret scan | clean (zero matches against `ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN|SUPABASE_SERVICE_ROLE_KEY|sb_secret_|sk-ant-|^xai-|Bearer |Authorization:|eyJ[…]`) |
| Doctrine scan | clean — `winner`/`loser`/`liar`/`correct`/`dishonest`/etc.: zero hits; `true`/`false` hits are all boolean literals on `productionEnabled` (the entire point of this card) |
| Service-role / Anthropic in `src/**` or `app/**` | zero matches |
| Direct insert into `public.arguments` | zero matches (all hits are doctrine self-check affirmations in design doc) |
| evidence_span / raw body leakage | zero matches |
| Migration apply | not-applicable (zero migration changes; `supabase/migrations/**` byte-equal preserved) |

---

## Top 3 findings

1. **The CRITICAL Subset-under-production gate is bound correctly.** `__tests__/mcpFamilyDSubsetFilterProductionMode.test.ts:80-149` provides 7 structural assertions that production-mode Family D requests emit exactly 19 ai_classifier rawKeys (SFP-1, SFP-4), enumerate the precise 19-key set (SFP-2), exclude the 6 deduped deterministic keys (SFP-3, SFP-7), and confirm production-mode + admin_validation-mode emit byte-equal rawKey sets (SFP-6) — proving the subset filter is structurally mode-agnostic. This binds HALT trigger #14 (Family D production runs send all 27 keys) into an impossibility. The 6-key deterministic excluded count matches the SF-3 admin-mode equivalent and reflects the compound-key dedupe in `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY` (auto_metadata `source_requested` + `quote_requested` collide with lifecycle, dedupe to one string each — see the file comment at SF-3 lines 7-13 of `mcpFamilyDEdgeMcpSubsetFilter.test.ts` for the math).

2. **A/B/C production posture is asserted preserved by THREE independent test files.** `edgeFamilyDProductionEnable.test.ts:99-115` (FDE-10/11/12) directly asserts A/B/C remain `productionEnabled: true`; `mcpOneTwoOneCEdgeFamilyRegistry.test.ts:67-73` (FR-5 widened) cross-checks via the FAMILY_REGISTRY filter; `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts:309-315` (DREG-29) cross-checks via the auto-trigger dispatcher's runtime resolution. HALT trigger #2 (A/B/C productionEnabled flipped) is impossible to fire without three test failures.

3. **Stale-assertion updates are tightening, not loosening.** Every one of the 7 edited test files updates pre-flip literals (`'3'` / `[A,B,C]` / `false`) to post-flip literals (`'4'` / `[A,B,C,D]` / `true`). No assertion is removed or weakened; each becomes a stronger post-flip binding. Notable strengthening: `mcpFamilyDEdgeMcpSubsetFilter.test.ts` SF-9 evolved from a single-line "0 rawKeys" assertion (lines 143-152 pre-flip) to a 10-line three-part assertion (lines 143-160 post-flip): exact-19 count + 19-key inclusion + 6-key exclusion. This is the load-bearing example of the "every assertion becomes stronger" pattern.

---

## 18-item verdict matrix

### Scope (8 items)

| # | Item | Verdict | Notes |
|---|---|---|---|
| A | `familyRegistry.ts:86` D `productionEnabled false → true` | **PASS** | Verified at HEAD `1ad343b`: line 86 reads `productionEnabled: true,` (was `false,` at main `21f9874`). |
| B | A/B/C `productionEnabled` remain `true` | **PASS** | Lines 71, 76, 81 still `true`; FDE-10/11/12 + FR-5 + DREG-29 all assert post-flip. |
| C | E-J `productionEnabled` remain `false` | **PASS** | Lines 91, 96, 101, 106, 111, 116 all `false`; FDE-7 + FR-7 + FE-7 + DREG-31 + FR-32 all assert post-flip. |
| D | `booleanObservationRequestBuilder.ts` byte-equal preserved | **PASS** | `git diff --name-only` shows zero touches; SFP-1..SFP-7 + SF-1..SF-10 still pass. |
| E | `autoTriggerDispatcher.ts` byte-equal preserved | **PASS** | `git diff --name-only` shows zero touches; DREG-2 (no AUTO_TRIGGER_FAMILIES literal) + DREG-3 (runtime resolution) + DREG-29 (4-family return) all pass. |
| F | `mcp-server/**` byte-equal preserved | **PASS** | `git diff --name-only -- 'mcp-server/**'` returns empty. |
| G | `supabase/migrations/**` unchanged | **PASS** | `git diff --name-only -- 'supabase/migrations/**'` returns empty. |
| H | `src/**` unchanged except test files | **PASS** | `git diff --name-only -- 'src/**'` returns empty. All test changes are in `__tests__/`. |

### Subset filter under production (CRITICAL — 3 items)

| # | Item | Verdict | Notes |
|---|---|---|---|
| I | `mcpFamilyDSubsetFilterProductionMode.test.ts` exists | **PASS** | New file at `__tests__/mcpFamilyDSubsetFilterProductionMode.test.ts`, 150 lines, 7 tests. |
| J | Test asserts production-mode Family D request contains exactly 19 ai_classifier keys | **PASS** | SFP-1 (line 82: `expect(req.requestedRawKeys.length).toBe(19)`); SFP-2 (lines 85-92: enumerates the 19-key set + `expect(sent.size).toBe(19)`); SFP-4 (line 104: `expect(Object.keys(req.definitions).length).toBe(19)`); SFP-5 (line 113: every definition has `source === 'ai_classifier'`). |
| K | Test asserts deterministic keys NOT in production-mode Family D request | **PASS** | SFP-3 (lines 94-100) iterates the 6 unique deterministic strings and asserts each is absent; SFP-7 (lines 132-149) re-asserts the same exclusion under multi-family composition. The "8 deterministic keys" of the matrix language dedupe to 6 unique strings — same shape as SF-3 in the admin-mode mirror file. The structurally-meaningful version is asserted. |

### Auto-trigger 4-family (3 items)

| # | Item | Verdict | Notes |
|---|---|---|---|
| L | DREG-* tests updated to reflect 4-family production list | **PASS** | DREG-29 (line 309) expanded from `[A,B,C]` to `[A,B,C,D]`; DREG-31 (line 335) narrowed admin-only iteration from D-J to E-J. DREG-2/3/5/6/7/8 (registry-derived dispatcher invariants) unchanged because the dispatcher itself is unchanged. |
| M | FR-7 (and family) updated: D in production-enabled list | **PASS** | FR-5/6 (mcpOneTwoOneCEdgeFamilyRegistry.test.ts:64-78) expanded production list to A+B+C+D; FR-7 (line 80) flipped admin-only iteration to E-J; FR-16 (line 156) widened to 4 families; FR-26 (line 225) flipped D from "returns empty" to "keeps D"; FR-28/30/32 widened similarly. AVM-11 + AVM-13 (mcpOneTwoOneCEdgeAdminValidationMode.test.ts) flipped to keep D in production filter output. FA-14 (mcpOneTwoOneCEdgeFamilyARequest.test.ts) widened ALLOWED_PRODUCTION_FAMILIES to include `evidence_source_chain`. |
| N | SF-9 updated: production-mode Family D now returns 19 keys (not 0) | **PASS** | SF-9 (mcpFamilyDEdgeMcpSubsetFilter.test.ts:143-160) now asserts exactly 19 rawKeys + 19 ai_classifier inclusion + 6-key deterministic exclusion under `mode: 'production'`, with a cross-reference to the dedicated SFP-1..SFP-7 binding in the new file. |

### Test coverage + safety (4 items)

| # | Item | Verdict | Notes |
|---|---|---|---|
| O | Test forecast +24 within +20-50 band | **PASS** | Design forecast was +20 to +50 (intent brief §8); actual +24 sits in lower-middle of band; well below HALT #15 +100. |
| P | 17 new tests in edgeFamilyDProductionEnable + 7 in mcpFamilyDSubsetFilterProductionMode | **PASS** | Verified via direct jest count: `Tests: 17 passed, 17 total` and `Tests: 7 passed, 7 total` respectively. 17 + 7 = 24 = full delta. |
| Q | No verdict tokens in any new code/test | **PASS** | `git diff … -- '__tests__/**' \| grep -iE 'winner\|loser\|liar\|…'` returns zero hits in test diff. |
| R | No raw bodies / secrets / evidence_span leakage | **PASS** | `git diff … \| grep -iE 'evidence_span\|raw_body\|raw_text'` returns zero matches. Lone match for "Anthropic" in test diff is the doctrine comment `"no Anthropic inference of deterministic facts"` in `mcpFamilyDSubsetFilterProductionMode.test.ts:28` — a doctrine reaffirmation, not a secret/key reference. |

**Matrix verdict: 18/18 PASS.**

---

## 18 HALT triggers re-evaluation (intent brief §6)

All 18 triggers clean. The implementer's handoff in `current-status.md` enumerates these correctly; I re-checked each.

### Registry + data safety (1-6)

1. **familyRegistry.ts edit affects only D** — clean. `git diff --stat` shows 2 line changes, both inside the D entry (lines 85-87); A/B/C and E-J unchanged at the byte level.
2. **A/B/C productionEnabled unchanged** — clean. Lines 71/76/81 still `true`; FDE-10/11/12 + FR-5 + DREG-29 verify.
3. **Auto-trigger dispatcher hard-codes families** — structurally impossible. `autoTriggerDispatcher.ts` byte-equal preserved; DREG-2 (no AUTO_TRIGGER_FAMILIES literal) + DREG-3 (runtime resolution from registry) still hold.
4. **Source 6 filter change** — clean. `machineObservationPersistenceQuery.ts` not touched.
5. **Persistence schema change** — clean. `supabase/migrations/**` byte-equal preserved.
6. **Family D Edge subset filter removed/weakened** — structurally impossible. `booleanObservationRequestBuilder.ts` byte-equal preserved; `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain'] = {'ai_classifier'}` (lines 68-72) unchanged; SFP-1..SFP-7 are the runtime binding gates.

### Protocol + security (7-12)

7. **New taxonomy keys** — clean. No registry of definitions touched; `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY` byte-equal preserved.
8. **MCP schema version change** — clean. `mcp-server/**` byte-equal preserved.
9. **Family A/B/C/D prompt changes** — clean. No prompt file touched.
10. **Hosted MCP server file changes** — clean. `mcp-server/**` byte-equal preserved.
11. **Secret exposure** — clean. Secret scan returns zero matches.
12. **Logs raw body/prompt/response/token/key** — clean. No log statement added; no log shape change.

### Architecture (13-16)

13. **Auto-trigger broken for A/B/C** — structurally impossible. Per-family iteration helper `dispatchOneFamilyIteration` (autoTriggerDispatcher.ts:224) has its own try/catch (DREG-10 verifies); one family's failure does not abort the next. A/B/C iteration #1/2/3 unchanged.
14. **Family D production runs send all 27 keys** — structurally impossible. SFP-1..SFP-7 bind exactly 19 ai_classifier keys under production mode; the builder is mode-agnostic (SFP-6 byte-equal mode comparison).
15. **Test forecast > +100** — clean. Actual +24, well below.
16. **Family D production runs don't persist** — clean. `classifyArgumentCore.ts` byte-equal preserved (persistence path unchanged); the `argument_machine_observation_runs` table already accepts `run_mode = 'production'` for any family per the existing schema.

### Doctrine (17)

17. **Verdict tokens in user-facing strings** — clean. Test diff has zero verdict-token matches. The lone `winner` hit in design doc is `"§10 (v1 scope guards) | No voting, no winner determination ..."` — a doctrine-compliance affirmation, not a verdict.

### Working tree (18)

18. **Unclassified untracked files at PR creation** — present but explainable. `git status` shows 10 untracked files:
    - `docs/testing-runs/2026-05-25-ai-driven-bot-corpus-annotated.md`
    - `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md`
    - `docs/testing-runs/2026-05-25-bot-engagement-corpus.md`
    - `docs/testing-runs/2026-05-25-bot-stress-summary.md`
    - `mcp021c-edge-smoke-request.json`
    - `mcp021c-edge-smoke-response.json`
    - `mcp021c-edge-smoke-runids.txt`
    - `netlify-prod.git`
    - `phase5-mcpserver002-hosted-smoke.log`
    - `phase5-mcpserver002-validator.log`

    All 10 are operator-territory artifacts from prior smoke runs (testing corpus runs, MCP-021C-EDGE-* smoke outputs, MCP-SERVER-002 Phase 5 logs, netlify reference). None are touched by this card's diff; the implementer correctly did not commit them. **Recommendation:** the operator should add the appropriate `.gitignore` entries (or move into a gitignored subdirectory) in a future housekeeping card to clear this noise — but it does NOT block this card's PR.

---

## FAIL comments

None. All 18 matrix items PASS; all 18 HALT triggers clean.

---

## Optional polish (non-blocking)

1. **`familyRegistry.ts:5-25` header comment is technically stale post-flip.** The header text says "`parent_relation` (A), `disagreement_axis` (B), and `misunderstanding_repair` (C)" are production-enabled at Card 1 ship and "D–J remain `false`." After this card, D is no longer in that list. The design doc explicitly flags this (`Operator-deferred review surface` § Risk 6 + line 161 of design). The comment is documentation, not behavior — non-blocking — but a 4-line patch updating lines 7-13 of the registry file to reference the post-Card-2 state would be tidy. Acceptable to defer to a future doc-only PR.

2. **Top-level 10 untracked files (item 18 above) are operator-territory.** Not a card defect; suggest filing a tiny housekeeping card to `.gitignore` the `mcp021c-edge-smoke-*` + `phase5-*.log` patterns + the testing-runs that should be gitignored, so future review subagents don't have to explain them.

3. **The `mcpOneTwoOneCEdgeFamilyARequest.test.ts:FA-14` describe label** was updated from `"filters out D-J"` to `"filters out E-J"` (correct), and the inner "forbidden family" assertion was repurposed from `evidence_source_chain` to `misunderstanding_repair` (Family C, not requested in the test input). This is a defensible reuse — it still proves a non-requested family is absent — but it's slightly less doctrinally tight than the pre-flip version, because Family C is not the "admin-only forbidden" case the test was originally framing. A future tightening might add a separate iteration over E-J families and assert each is absent (mirroring the FR-7/FE-7 / DREG-31 admin-only loop pattern); the current shape is acceptable but a candidate for a follow-up sharpen.

---

## Operator next steps

1. **Push the branch:**
   ```powershell
   git push -u origin feat/MCP-021C-EDGE-FAMILY-D-ENABLE
   ```

2. **Open PR:**
   ```powershell
   gh pr create --title "MCP-021C-EDGE-FAMILY-D-ENABLE: flip Family D productionEnabled true" --body-file docs/reviews/MCP-021C-EDGE-FAMILY-D-ENABLE.md
   ```
   (Title is under the 70-character convention.)

3. **Squash-merge to main.** No manual deploy required — the Supabase GitHub integration auto-deploys the `submit-argument` and `classify-argument-boolean-observations` Edge Functions on merge per `supabase-merge-autodeploy.md` memory. Wait ~30-90s post-merge for the auto-deploy.

4. **Run the 6-phase post-merge smoke** per intent brief §9. Audit at `docs/audits/MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-<date>.md`. Key gates:
   - **Phase 2:** Submit a new argument; verify 4 production runs (A+B+C+D) created with `status='success'`. Wait ~25-35s for 4-family dispatch.
   - **Phase 3 (CRITICAL):** Family D production results ⊆ 19-key Subset; 0 deterministic keys.
   - **Phase 4:** Source 6 multi-family read shows A+B+C+D raw_keys.
   - **Phase 5:** Observability Q11/Q14/Q15 adapt.
   - **Phase 6:** Targeted Jest regression exit 0; Family D admin_validation still works.

5. **On smoke PASS:** AUTHORIZED to proceed to INTER-CARD CHECKPOINT B (~2-min window) → spawn designer for **Card 3: MCP-SERVER-006-FAMILY-E**.

6. **Emergency rollback** (if Family D production produces systemic failures): flip `semantic_referee_runtime_config.enabled = false` via SQL to halt auto-trigger for ALL families until re-enabled. Per-family-D rollback requires a follow-up PR flipping the boolean back.

7. **Post-merge worktree cleanup:** not applicable — this card was reviewed in the main checkout, not in an isolated worktree.

---

## PR title + body

### Title
`MCP-021C-EDGE-FAMILY-D-ENABLE: flip Family D productionEnabled true`

### Body

```markdown
## Summary
- Flip one boolean in `supabase/functions/_shared/booleanObservations/familyRegistry.ts:86`: `evidence_source_chain.productionEnabled false → true`. Auto-trigger now fires 4 production runs (A+B+C+D) per new argument instead of 3 (A+B+C).
- Bind HALT #14 (production-mode Family D bypasses 19-key Subset filter): new `__tests__/mcpFamilyDSubsetFilterProductionMode.test.ts` (7 tests) mirrors the admin-mode subset filter binding with `mode: 'production'`, asserting exactly 19 ai_classifier rawKeys + 6 deterministic-key exclusions + byte-equal parity between production and admin_validation modes.
- Bind A/B/C unchanged + E-J still admin-only: new `__tests__/edgeFamilyDProductionEnable.test.ts` (17 tests) + stale-assertion updates across 7 existing test files (FR-5/6/7/16/26/28/30/32, FE-1/2/3/4/7/11, FD-2/4/6, AVM-11/13, SF-9, FA-14, DREG-29/31) — every updated literal tightens, not loosens.

## Test plan
- [x] `npm run typecheck` exit 0
- [x] `npm run lint` exit 0
- [x] `npm run test` 568 suites / 18,008 tests passing (was 17,984; +24)
- [x] Both new test files run independently and pass (17 + 7)
- [x] Doctrine scan clean (no verdict tokens; only boolean true/false on `productionEnabled`)
- [x] Secret scan clean (zero matches against API key / JWT / Bearer / Authorization patterns)
- [x] `booleanObservationRequestBuilder.ts`, `autoTriggerDispatcher.ts`, `mcp-server/**`, `supabase/migrations/**`, `src/**` all byte-equal preserved
- [ ] Operator: 6-phase post-merge smoke per intent brief §9
- [ ] Operator: Verify 4-family dispatch under ~25s
- [ ] Operator: Verify Family D production Subset filter holds (0 deterministic keys)
- [ ] Operator: On smoke PASS, proceed to INTER-CARD CHECKPOINT B → Card 3 (FAMILY-E)

Reviewer: `docs/reviews/MCP-021C-EDGE-FAMILY-D-ENABLE.md`

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```
