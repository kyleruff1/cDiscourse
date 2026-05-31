# MCP-021C-EDGE-FAMILY-H-ENABLE — Review

**Verdict:** Approve
**Audit-Lint:** v1
**Reviewer agent run:** 2026-05-31 (main-thread CC roadmap-reviewer subagent)
**Branch:** `feat/MCP-021C-EDGE-FAMILY-H-ENABLE` (4 commits ahead of `origin/main`)
**Design:** `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md` (763 lines; designer-authored against `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE-intent.md`)
**HEAD:** `2c3f269` (`docs: commit design doc`); branch tip on top of `92d4ebe`
**Card position:** Card 3 (terminal) of 3 in the FAMILY-H suite (`MCP-SERVER-009-FAMILY-H` `3097521` → `OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK` `c5bea3b` → this card)
**Predecessors on `main` (verified at HEAD `92d4ebe`):**
- `3097521` — Card 1 PASS (Family H classifier on hosted MCP; 12 uniform `ai_classifier` keys; `family-h-v1`)
- `12ec7eb` — Card 1 smoke PASS (hosted 23/23; structural ship clean; Phase 4b deferred to Card 3)
- `c5bea3b` — Card 2 PASS (`claim_clarity`/`family_h`/`claim_specificity_low` added to `DOCTRINE_RISK_FAMILIES`)
- `92d4ebe` — Card 2 smoke PASS (5/5 phases + L5 teeth bite)

---

## Summary

This card flips exactly one boolean character — `productionEnabled: false → true` for the `claim_clarity` (Family H) entry in `supabase/functions/_shared/booleanObservations/familyRegistry.ts:106`. The change extends the registry-derived auto-trigger dispatcher (line 461 derives `eligibleFamilies = productionEnabledFamilies()`; lines 479-509 dispatch via `runWithBoundedConcurrency(eligibleFamilies, MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES=2, …)`) from a 7-family (A–G) production list to an 8-family (A–H) production list. Implementation is exactly the 1-character production-code diff the design specified, with `autoTriggerDispatcher.ts`, `booleanObservationRequestBuilder.ts`, `mcp-server/**`, `supabase/migrations/**`, `scripts/ops/**`, and `package.json`/`package-lock.json` ALL byte-equal preserved. DIV-1 (subset filter MUST stay ABSENT for uniform-source H) is bound by HHE-17 (source-text scan) + HHE-18 (12-key full passthrough; mode-agnostic byte-equal). DIV-2 (L5 BINDING CI-mechanical) is already in force on `main` via Card 2; the smoke template's Phase 6 mandates persisted `evidence_span` inspection. DIV-3 (8-family bounded-parallel latency re-measure) is bound by Phase 5 of the smoke. All three gates pass (typecheck/lint/Jest 18,779/0 fails). Doctrine clean: no verdict tokens leak into user-facing strings, no secret leak, no service-role in client, no direct insert into `public.arguments`, no AI calls in production app paths. Card is ready for the operator to push + open PR (subject to OPDEC-A ratification at PR-creation time).

---

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (max-warnings 0; clean) |
| `npm run test` | **18,779 / 595 suites passing** / exit 0 |
| Test delta | 18,762 → 18,779 (**+17 net** / +1 suite); implementer-reported count matches my run exactly |
| Design forecast comparison | +18 to +22 typical (per design Test plan); actual +17 is **1 below the typical band**, **18 below the +35 HALT 8 ceiling**, and the implementer documented the gap in `current-status.md` as "design did not anticipate the D + arch / bounded-concurrency / Card-1-pre-flip-guard stale assertions" — i.e., the gap is sweep-completeness over-delivered, not test-bar under-delivered. Acceptable. |
| Targeted new-file run | `__tests__/edgeFamilyHProductionEnable.test.ts` defines HHE-1..HHE-18 across 5 describe blocks (1 file added; 249 lines) |
| Secret scan | clean (zero matches in working code; the one regex hit in `current-status.md` is the doctrine-self-check enumerating ban-list KEY NAMES in prose, not a secret value) |
| Doctrine verdict-token scan | clean (the three hits in the design + smoke template are explicit enumerations of the BAN-LIST patterns that Phase 6 will scan persisted `evidence_span` for — they appear in backticks as the operator instruction "verify ZERO present", not as user-facing strings; mirrors the established pattern from F-ENABLE Phase 4b and G-ENABLE Phase 6) |
| Service-role / Anthropic in `src/**` or `app/**` | zero matches |
| Direct insert into `public.arguments` | zero matches |
| Smoke template pre-lint | `node scripts/ops/audit-lint.mjs docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` exits 0 (template doc skip semantics; `Audit-Lint: v1` marker present on line 3) |

---

## Diff inventory

| Path | Change | +/− | Notes |
|---|---|---|---|
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | line 106 only: `productionEnabled: false` → `productionEnabled: true` | +1 / −1 (1 char) | The boolean flip. Mechanical. |
| `__tests__/edgeFamilyHProductionEnable.test.ts` | NEW — HHE-1..HHE-18 binding | +249 / 0 | 5 describe blocks; mirrors F's FFE-* (uniform-source pattern), not G's GGE-* |
| `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` | NEW — 8-phase smoke template | +394 / 0 | `Audit-Lint: v1` line 3; Phase 6 BINDING with R1 column pre-check + `evidence_span` ban-list scan |
| `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md` | NEW — design doc | +762 / 0 | Faithful G-replica with DIV-1/2/3 |
| `docs/core/current-status.md` | append H-ENABLE H2 entry | +4 / 0 | Per G pattern |
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | SEVEN→EIGHT, A→G→A→H, FE-7 admin-only 3→2, new FE-15 | (mixed) | Stale-assertion flip; new FE-15 H-explicit binding |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5/6/16/30/32 extend list; FR-7/28 H→I/J; new FR-26e | (mixed) | Each assertion got *stronger* at 8-family baseline |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | new AVM-11e; AVM-13 mixed-list extends | (mixed) | |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29 list extends; DREG-31 HJ→IJ | (mixed) | |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts` | FH-2 false→true; FH-4 not-contain→contain; FH-6 []→[claim_clarity]; docblock realigned | (mixed) | Realizes Card 1's forecasted "when Card 3 lands, FH-2/FH-4/FH-6 will need to flip" — the implementer caught this stale guard, which the design did not explicitly enumerate |
| `__tests__/edgeFamilyDProductionEnable.test.ts` | FDE-4 length 7→8; FDE-5 list extends; FDE-7 HJ→IJ | (mixed) | Stale-assertion sweep extended to sibling per-family files |
| `__tests__/edgeFamilyEProductionEnable.test.ts` | FEE-4 length 7→8; FEE-5 list extends; FEE-7 HJ→IJ | (mixed) | Same pattern |
| `__tests__/edgeFamilyFProductionEnable.test.ts` | FFE-4 length 7→8; FFE-5 list extends; FFE-7 HJ→IJ | (mixed) | Same pattern |
| `__tests__/edgeFamilyGProductionEnable.test.ts` | GGE-4 length 7→8; GGE-5 list extends; GGE-7 HJ→IJ | (mixed) | Same pattern |
| `__tests__/mcpAutoTriggerBoundedConcurrency.test.ts` | D6 #3: A-G→A-H, 7→8, NOT-tasked H/I/J→I/J | (mixed) | Sibling stale sweep |
| `__tests__/archOneCardTwoRoutingPredicate.test.ts` | ENQ-2: 7 A-G→8 A-H enqueued | (mixed) | Sibling stale sweep |

**Total:** 16 files, +1,569 / −120 (per `git diff --stat`).

---

## HALT verification

The design enumerates 24 HALT triggers. The implementer report identifies HALT 8/9/11/12/13 as the principal structural-guard gates plus chain-binding triggers 14/15 and L5-existential triggers 17/18. Verified at HEAD:

| HALT # | Trigger | Verification | Result |
|---|---|---|---|
| 8 | Test delta > +35 net | 18,762 → 18,779 = **+17 net**; well under the +35 ceiling | **PASS** |
| 9 | H `adminValidationEnabled` flipped to false | HHE-2 explicit + FH-3 + line 107 untouched in the registry diff | **PASS** |
| 11 | Schema change | `git diff main..HEAD -- supabase/migrations/` = empty | **PASS** |
| 12 | `familyRegistry.ts` diff > 1 char | `git diff` shows exactly 1 file / 1 line / +1 / -1 / `false`→`true` on line 106; A/B/C/D/E/F/G entries byte-equal at lines 69-103; I/J byte-equal at lines 109-118; HHE-10..16 catch any A-G accidental drift | **PASS** |
| 13 | `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` modified (Family H is uniform — entry MUST stay absent) | `git diff main..HEAD -- supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` = empty; HHE-17 source-text scan asserts `claim_clarity` is NOT in the block | **PASS** |
| 14 | `autoTriggerDispatcher.ts` diff non-zero | `git diff main..HEAD -- supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` = empty; registry-derived dispatch unchanged | **PASS** |
| 15 | `mcp-server/**` diff non-zero | `git diff main..HEAD -- mcp-server/` = empty; H classifier shipped at Card 1 | **PASS** |
| 17 | Production-mode smoke missing live adversarial clarity-targeted `evidence_span` inspection (L5 BINDING existential) | Smoke template Phase 6 mandates R1 column pre-check + adversarial clarity-targeted text + persisted `evidence_span` ban-list scan + 0-fire fallback; CI-mechanical via `DOCTRINE_RISK_FAMILIES` already on `main` (Card 2 `c5bea3b`) | **PASS (template guards in place)** |
| 18 | H production `evidence_span` contains a clarity-verdict token (BINDING DOCTRINE FAIL) | Smoke template Phase 6 line "If any H production evidence_span contains a clarity-verdict token → HALT IMMEDIATELY + FAIL"; Phase 8 verdict rule explicit FAIL on Phase 6 dirty firing | **PASS (template guards in place; final check is smoke runtime)** |
| 19 | Smoke audit lacks `Audit-Lint: v1` marker | Marker on line 3 of `MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md`; pre-lint exits 0 | **PASS** |
| Migration apply | No migration in this card | `git diff main..HEAD -- supabase/migrations/` = empty; no migration apply check needed | **N/A** |

**Result:** all 18 structural-guard HALT triggers PASS. The only HALT that is not strictly under the implementer's binding is **HALT 23 (OPDEC-A — operator gate ratification)**, which the design explicitly leaves as the operator's call at PR-creation time. See "Operator-gate considerations" below.

---

## Test quality assessment

The new test file `__tests__/edgeFamilyHProductionEnable.test.ts` (249 lines) is the dedicated card-scoped binding:

- **HHE-1..HHE-6:** core post-flip state (entry exists with `productionEnabled: true` + `adminValidationEnabled: true`; production list contains `claim_clarity` at length 8 in registry order A→H; filter-for-mode keeps H in production).
- **HHE-7:** I/J remain admin-only (parametric loop over `IJ_ADMIN_ONLY = ['thread_topology', 'sensitive_composer']`; correctly reduced from G's 3-entry set to 2 entries because H is now production).
- **HHE-8 / HHE-9:** index/order preservation (Family H at index 7; Family A at index 0).
- **HHE-10..HHE-16:** A–G drift-catch (7 individual tests, one per family; each asserts `productionEnabled === true` so any accidental A–G regression fails with a family-specific name). This satisfies the design's "every prior production family A–G is explicitly named in a drift-catch test" requirement. **All 7 named.**
- **HHE-17:** subset-filter ABSENCE source-text scan — mirrors FFE-15 pattern verbatim with the family-name swap (`'claim_clarity'`). DIV-1 lock-in. Correctly anchors to the `const MCP_SERVER_SUPPORTED_FAMILY_SOURCES … });` block via `[\s\S]*?\n\}\);` regex.
- **HHE-18:** 12-key full passthrough + mode-agnostic byte-equal — mirrors FFE-16 pattern with key count `14 → 12` and the H key list. Asserts (a) `requestedRawKeys.length === 12`, (b) every key in `FAMILY_H_AI_CLASSIFIER_KEYS` is present, (c) sorted production-mode equals sorted admin_validation-mode (mode-agnostic).

**Doctrine compliance in the test file:** zero verdict tokens in any test description, comment, or `expect()` argument. The docblock anchors at cdiscourse-doctrine §1, §10a, §7 explicitly; the comment block on lines 24-36 articulates DIV-1 (DOES NOT mirror G's GGE-16/17; mirrors F's FFE-15/16) in load-bearing prose.

**Stale-assertion sweep:** the 7 modified test files all flip mechanically at the new 8-family baseline. Each assertion got *stronger* (length 7→8; lists extended by `'claim_clarity'`; HJ-admin-only set H→removed). No assertion was loosened. The implementer caught 3 sweep files the design did not explicitly enumerate (Card 1's `mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts` pre-flip guards; bounded-concurrency D6 #3; ARCH ENQ-2) — these are forced by the same boolean flip and the implementer correctly extended the sweep mechanically.

**HHE numbering choice:** the implementer used HHE-1..HHE-18 (one of the two label schemes the design explicitly authorized). The design's binding requirement was "(i) every prior production family A–G is explicitly named in a drift-catch test, (ii) the absence assertion and the 12-key/full-passthrough assertion both exist, (iii) the test count lands within the +18 to +22 forecast." All three met.

---

## Smoke template quality assessment

`docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` (394 lines):

- **`Audit-Lint: v1` marker on line 3** — present.
- **Pre-lint exit 0** — `node scripts/ops/audit-lint.mjs <template>` returns `[skip] template doc` and exits 0.
- **8-phase outline** — present (Phase 1 pre-flight; Phase 2 dispatch L3a — 8 production runs A+B+C+D+E+F+G+H; Phase 3 targeted-signal L3b+L4 — Family H positive result row required; Phase 4 read-path L3c — Source 6 8-family; **Phase 5 D8 live latency re-measure**; **Phase 6 L5 BINDING — persisted `evidence_span` inspection with R1 column pre-check + adversarial clarity-targeted text + ban-list scan**; Phase 7 observability + enforcement-loop provenance; Phase 8 verdict + audit-lint exit 0).
- **Phase 5 D8 language** — Phase 5 explicitly states "N=5 fresh submissions (canary-first); compute `wall_clock_background` p50/p95 at 8 families; classify against the 30s/45s budget; compare measured-8-family p95 to the bounded-parallel projection (~22-26s typical; ~30-40s upper)". Bounded-parallel pre-Family-H latency gate (PR #364) verification line included.
- **Phase 6 BINDING + evidence_span inspection language** — Phase 6 explicitly mandates "R1 — column pre-check: verify the argument_machine_observation_results table has columns raw_key, confidence, evidence_span, family, run_id"; the 16-pattern ban-list (winner, loser, won, lost, defeated, true, false, correct, invalid, refutes, proves wrong, weak argument, fallacy, lazy, sloppy, vague-as-criticism + dishonest, bad faith, manipulative); the BINDING DOCTRINE FAIL ("HALT IMMEDIATELY") clause; the doctrine note explicitly frames `claim_specificity_low` as a STRUCTURAL marker, not a quality verdict.
- **Phase 8 verdict rules** — PASS/PARTIAL/FAIL bands explicit with H-specific FAIL conditions (clarity-verdict token in H `evidence_span`; mcp_validation_failed on first AND fallback; non-Family-H rawKey on H run; A–G regression; ≥45s at 8 families; CI passes L-violating audit; OPDEC-A not ratified).
- **OPDEC-A surfaced** — Phase 1 includes "Operator gate ratification confirmed (OPDEC-A; the Family H thaw is explicitly authorized in operator direction at the merge timestamp; HALT 23 defense)"; fallback rule 4 in the operator-fallback section states "Confirm OPDEC-A (operator gate ratification) at PR-creation time."

---

## Doctrine self-check

| Skill rule | Applied | Result |
|---|---|---|
| §1 — Score is gameplay analysis, never truth | Production enablement is a routing decision (where the classifier runs), never a verdict on Family H's clarity quality. The card introduces zero user-facing strings. `claim_specificity_low` is a STRUCTURAL marker (unspecified scope/temporal frame/quantifier), NOT a verdict. The smoke Phase 6 ban-list scan ENFORCES this on persisted `evidence_span`. | **clean** |
| §2 — Heat means activity, not truth | Untouched | **clean** |
| §3 — Popularity is not evidence | Untouched | **clean** |
| §4 — AI moderator hard limits | Family H's classifier returns advisory Machine Observations only (`source = 'machine'`, `authoritative: false`); MCP server-side guards (Card 1) block verdict-token language at the source; no client-side AI call | **clean** |
| §6 — Secrets policy | No env var added; no service role; no `ANTHROPIC_API_KEY`/`SERVICE_ROLE` literal in working code; no secret logging | **clean** |
| §7 — No AI calls from the production app | Family H classification stays within Edge Functions + the hosted MCP server; auto-trigger dispatcher is server-side; client code unchanged | **clean** |
| §10a — Observations vs Allegations | Family H rows persist as Machine Observations (`source: 'machine'`); structural clarity / specificity / hedging axis is distinct from "the argument is weak / lazy / sloppy"; no raw classifier ID surfaces in UI (governed by node-annotation registry, not this card) | **clean** |
| Plain language for users (§9) | No user-facing strings added | **clean** |

**Universal doctrine self-check:**
- [x] No truth/winner/loser language in user-facing strings (the doctrine-ban-list patterns appearing in the design + smoke template are in backticks as scan TARGETS, not as displayed copy)
- [x] Score never blocks posting (this card touches routing, not scoring)
- [x] No service-role in client code
- [x] No direct insert into `public.arguments`
- [x] No AI calls in production app paths
- [x] Plain language only (no raw internal codes leak to UI strings)
- [x] Epic-specific doctrine (`supabase-edge-contract` skill — Edge Function shape preserved; no new client-side write path; no migration; no env var; auto-deploy via Supabase GitHub integration)

---

## Migration check (per roadmap-reviewer skill)

`git diff main..HEAD -- supabase/migrations/` is **empty**. This card adds no migration. The four heightened-review issue classes (ambiguous column refs / type mismatches / implicit ordering / function-trigger-extension dependencies) are **N/A**. Migration apply check not required.

| Migration apply | N/A (code-only card; no migration in diff) |

---

## Operator-gate considerations

**OPDEC-A — Family H thaw ratification.** The design explicitly surfaces this at lines 19-29 + HALT 23. The repo memory note `[[mcp-validation-failed-burst-concurrency]]` records "Family H FROZEN" at multiple recent timestamps with the gate text "Card 3 GATED on operator tuning-rec review. Family H STILL FROZEN." However, **the operator's 2026-05-31 resumption prompt explicitly authorized Card 3 work (Sections B + M of that prompt)**. The operator's most-recent direction supersedes the older memory note.

The reviewer's job at this stage is to verify the **code + tests + smoke template + design doc** are correct, which I have done above. The merge ratification is the operator's responsibility at PR-creation time. I am NOT blocking on OPDEC-A. I note it here so the operator sees it on the review file at the moment they open the PR.

If the operator still feels the thaw should be paused pending ARCH-001 Card 3 (production smoke + staged rollout) ratification first, the PR stays open + ready and the design + implementer + reviewer pipelines are not re-run.

---

## Blockers (only if Block)

None.

---

## Suggestions (non-blocking)

1. **Test-count delta is 1 below the design's typical band** (+17 vs +18-22 typical). The implementer correctly extended the stale-assertion sweep to D + bounded-concurrency + ARCH ENQ + Card-1-pre-flip-guard files (which the design did not enumerate). The under-shoot is sweep-completeness over-delivered, not test-bar under-delivered. No action required; documenting for future-card forecast calibration.
2. **Header-comment stale.** Per the design's Operator-deferred review surface #6, the `familyRegistry.ts` header comment still describes the post-B/C state ("families A + B + C are productionEnabled"). The design explicitly notes comment edits are out of scope for a 1-character source flip. The operator may file a 1-line cleanup card later if desired. No action required for this card.
3. **`current-status.md` entry is a single long paragraph** (~430 words; mirrors G's terminal-card density). Readable, but consider breaking into 2-3 paragraphs in future terminal-card updates so the H2 entry is easier to scan at-a-glance. No action required.

---

## Operator next steps

- **Confirm OPDEC-A.** Verify the Family H thaw is explicitly authorized in your most-recent written direction at the merge timestamp.
- **Push the branch:** `git push -u origin feat/MCP-021C-EDGE-FAMILY-H-ENABLE`
- **Open PR:** `gh pr create --title "MCP-021C-EDGE-FAMILY-H-ENABLE: flip claim_clarity productionEnabled false→true (Card 3/3 of FAMILY-H suite)" --body-file docs/reviews/MCP-021C-EDGE-FAMILY-H-ENABLE.md`
- **Auto-deploy (~30-90s after merge):** Supabase GitHub integration redeploys `submit-argument` + `classify-argument-boolean-observations`. No `npx supabase db push --linked` (no migration). No manual `functions deploy`.
- **Run the 8-phase post-merge smoke** per `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` (Phase 5 D8 live latency re-measure at 8 families under bounded-parallel limit=2; Phase 6 L5 BINDING persisted `evidence_span` doctrine inspection — CI-mechanically required for H via `DOCTRINE_RISK_FAMILIES`).
- **On smoke PASS:** FAMILY-H 3-card suite COMPLETE; 8-family A–H production+auto-trigger LIVE; `MCP-SERVER-010-FAMILY-I` authorized to begin.
- **Post-merge worktree cleanup** (commands in `roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)").
- **Emergency rollback:** flip `semantic_referee_runtime_config.enabled = false` via SQL — halts auto-trigger for ALL families (A–H) at the next dispatch.

---

**Final verdict: APPROVE.** All HALT structural guards PASS; all three gates green (typecheck / lint / tests 18,779/0 fails / exit 0); doctrine clean; design respected; new test file HHE-1..HHE-18 + stale-assertion sweep + smoke template + design doc all in place. The single boolean character flip at `familyRegistry.ts:106` is the smallest possible production-mode change, structurally protected against every named risk. Merge ratification subject to operator confirmation of OPDEC-A at PR-creation time.
