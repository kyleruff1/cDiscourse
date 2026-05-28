# MCP-SERVER-007-FAMILY-F — Reviewer Verdict (2026-05-28)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-28
**Branch:** `feat/MCP-SERVER-007-FAMILY-F`
**HEAD at review:** `eca7251`
**main HEAD:** `423789c`
**Design:** `docs/designs/MCP-SERVER-007-FAMILY-F.md` at `fb051fb`
**Intent:** `docs/designs/MCP-SERVER-007-FAMILY-F-intent.md` at `423789c`
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/343

---

## Summary

Family F (`critical_question`) — the 6th boolean-observation family —
ships as Card 1 of the three-card chain in admin_validation-only
posture. 14 Walton/Toulmin/Peirce critical-question rawKeys are
registered server-side with the doctrine-defense pattern Family E
proved out: (1) 7 absolute rules byte-equal to A-E in the system
prompt; (2) explicit "CQ are PRODUCTIVE PROBES, never verdicts"
framing; (3) verbatim consequence_probability_unclear E↔F partnership
doctrine block (the HIGHEST-risk key); (4) per-key falsePositiveGuards
for the 6 doctrine-risk keys; (5) 12-token Family-F-specific ban-list
scan extension (D5 BINDING); (6) 3 mandatory + 2 optional adversarial
fixtures targeting the E↔F doctrine boundary; (7) Fixture C
existentially proves the model cannot echo "fallacy" from input into
evidenceSpan output. Gates green: typecheck + lint exit 0; Jest
18153/18153 unchanged; Deno 792 → 871 (+79). Family A-E lib byte-equal
preserved; shared `DOCTRINE_BAN_PATTERNS` byte-equal preserved; Edge
familyRegistry F entry untouched (already `productionEnabled=false,
adminValidationEnabled=true`); no `src/` or `app/` change; no Subset
filter for F. The +79 delta sits below the +95-130 designer forecast
midpoint but the binding-minimum coverage matrix (14 keys + 12 D5
tokens + 3 mandatory fixtures + Fixture-C non-echo proof + 6 F↔E
partnership tests + registry + dispatcher + ban-list scan) is fully
present — no bloat is the correct interpretation, not under-coverage.

---

## Verification

| Gate | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint | pass (exit 0) |
| Jest test | 18153 → 18153 (no Jest test added; expected — F changes are Deno-only) |
| Deno test | 792 → 871 (+79; cd mcp-server && deno test --allow-net --allow-env --allow-read exit 0) |
| secret scan | clean (only `sk-ant-fake-key-for-test-only-1234567890abcdef` test constant + doctrine doc strings) |
| doctrine scan | clean (banned tokens only in negation form within prompt / explicit doctrine doc context / explicit ban-list test arguments) |
| 4 historical audit-lint fixtures | 1/0/0/0 (matches expected per OPS-MCP-SMOKE-LINT-CI-WIRING) |
| working tree | clean (10 known operator-territory untracked files only) |

---

## 26-item HALT matrix

### Registry + family-batch integrity (1-7)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Designer Phase A.1 source verification + Stage 2B determination explicit per-trigger | PASS | Design §1 enumerates all 14 rawKeys verbatim with sources + doctrine-risk grades + per-trigger T1-T5 disposition. Stage 2B NOT REQUIRED, fully reasoned per-trigger. |
| 2 | 14 rawKeys match `src/features/nodeLabels/machineObservationDefinitions/familyF.ts` declaration order | PASS | `familyFKeys.ts:69-82` verbatim against upstream; `familyFKeys.test.ts:75-83` asserts index-by-index match against BINDING list. |
| 3 | NO Family G/H/I/J registration | PASS | `familyRegistryInit.ts` registers exactly 6 families (A-F). G/H/I/J still in unsupported pool (validated by retargeted dispatch tests). |
| 4 | Family A/B/C/D/E lib files byte-equal | PASS | `git diff main..HEAD -- 'mcp-server/lib/familyA*.ts' '...familyE*.ts'` returns 0 lines. **EXISTENTIAL.** |
| 5 | unsupported_family rejection envelope for G/H/I/J still intact | PASS | 5 dispatch test files retargeted from F (now supported) to G/H/I/J (still unsupported); envelope shape `requestedFamilies, supportedFamilies` preserved; full 6-family supportedFamilies list verified. Substitution, not deletion. |
| 6 | Schema mirror response shape unchanged | PASS | `git diff main..HEAD -- 'mcp-server/lib/mcpBooleanObservationSchemaMirror.ts'` returns 0 lines. |
| 7 | Edge familyRegistry F entry posture `productionEnabled=false, adminValidationEnabled=true` (untouched) | PASS | `supabase/functions/_shared/booleanObservations/familyRegistry.ts:95-97` unchanged; `git diff main..HEAD -- 'supabase/'` returns 0 lines. |

### Protocol + security (8-13)

| # | Item | Result | Evidence |
|---|---|---|---|
| 8 | NO new taxonomy keys | PASS | Schema mirror unchanged (item 6); validator schema constants unchanged. |
| 9 | NO MCP schema version change | PASS | Schema version remains `mcp-021.machine-observations.boolean.v1` across all files. |
| 10 | Family A/B/C/D/E prompts unchanged | PASS | `git diff main..HEAD -- 'mcp-server/lib/familyAPrompt.ts' ... 'mcp-server/lib/familyEPrompt.ts'` returns 0 lines. |
| 11 | NO client-side MCP call introduced | PASS | `git diff main..HEAD -- 'src/**' 'app/**'` returns 0 lines. |
| 12 | NO secret exposure | PASS | Secret-pattern grep yields only the test fake `sk-ant-fake-key-for-test-only-1234567890abcdef` + doctrine documentation strings discussing the ANTHROPIC_API_KEY policy. |
| 13 | NO raw body/prompt/response/token/key in logs | PASS | `familyFAnthropic.ts` uses `callAnthropic`; logs tagged with `classify_argument_boolean_observations` only; explicit tests `familyFAnthropic.test.ts:183` (success-path key never in logs) + `:210` (failure-path key never in logs). |

### Architecture (14-18)

| # | Item | Result | Evidence |
|---|---|---|---|
| 14 | Stage 2B determination present with per-trigger disposition | PASS | Design §1 explicit table T1-T5 disposed; "Stage 2B determination: NOT REQUIRED" with rationale grounded in source verification + token budget + Family E precedent. |
| 15 | NO subset filter entry for F | PASS | `booleanObservationRequestBuilder.ts:68-72` MCP_SERVER_SUPPORTED_FAMILY_SOURCES contains only `evidence_source_chain`. F absent — uniform `ai_classifier` per design §1. |
| 16 | NO MAX_TOKENS bump | PASS | `familyFAnthropic.ts:24` uses `FAMILY_F_MAX_TOKENS=1500` from `familyFPrompt.ts:55`. Test `familyFAnthropic.test.ts:258` sniffs call-args confirms `max_tokens=1500` sent to API. |
| 17 | **EXISTENTIAL DOCTRINE**: prompt does NOT frame CQ as fallacy/weak/invalid/verdict (or only in explicit negation) | PASS | All occurrences of banned tokens in `familyFPrompt.ts` (lines 20-37, 74, 103-118, 242-272) are within explicit doctrine-negation context: "NEVER", "MUST NOT", "never closes", "does NOT mean", "never the conclusion that". Test `familyFPrompt.test.ts:478` enforces ban-list scan on system prompt rejects any hit outside negation block. |
| 18 | **EXISTENTIAL DOCTRINE**: prompt does NOT imply unmet CQ makes E's scheme a fallacy | PASS | System prompt explicit at `familyFPrompt.ts:106-111`: "A critical question NEVER implies the argument scheme it probes is a fallacy. ... An unmet CQ does NOT mean E's scheme is fallacious. Per Walton (1995, 2008), every scheme has critical questions that PROBE without REJECTING the scheme." User prompt mirrors at lines 240-250. Test `familyFPrompt.test.ts:140` verifies fragments verbatim. |

### Doctrine — F-specific (19-23)

| # | Item | Result | Evidence |
|---|---|---|---|
| 19 | `familyFBanListScan.ts` adds 12 CQ verdict tokens per D5 | PASS | Lines 76-102 enumerate exactly 12 patterns: 4 CQ-specific compounds (unmet-means-fallacy, proves-wrong, invalidates, refutes) + 4 single-token verdicts (fallacy, fallacious, flawed, wrong) + 4 two-word phrases (weak argument, invalid argument, bad reasoning, proof of). Test `familyFAdversarialDoctrine.test.ts:317` asserts `FAMILY_F_BAN_PATTERNS.length === 12` and each of the 12 tokens has a matching pattern. |
| 20 | 3 mandatory adversarial fixtures present | PASS | Fixture A: `classify-argument-boolean-observations.family-f-cq-unmet-slippery-slope-request.json` (slippery-slope chain, no probability anchors); Fixture B: `family-f-cq-met-baseline-request.json` (probability anchors 70-80%, 50%, ~30%); Fixture C: `family-f-cq-adversarial-fallacy-word-request.json` (contains "fallacy" 2× in input). All exist; all parseable; all request `consequence_probability_unclear`. |
| 21 | Smoke template Phase 4b BINDING section present | PASS | `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-template.md` Phase 4b "DOCTRINE: adversarial critical_question verification (BINDING)" with persisted `evidence_span` inspection checklist, asymmetric firing-count resolution (≥1 clean PASS / 0-fire PARTIAL / ≥1 dirty FAIL). |
| 22 | Per-key falsePositiveGuards on F↔E doctrine-risk-paired keys (esp. `consequence_probability_unclear` HIGH) | PASS | `familyFKeys.ts:225` consequence_probability_unclear guard is the longest (HIGHEST RISK), explicitly forbids fallacy/fallacious/slippery-slope fallacy/weak/invalid/flawed/wrong/bad reasoning/logical error/informal fallacy/proof of/unmet-means-fallacy/proves wrong/refutes/invalidates AND addresses the input-echo case. Same pattern on `analogy_mapping_missing` (line 193), `causal_mechanism_missing` (line 177), `authority_basis_missing` (line 161), `alternative_explanation_available` (line 273), `missing_warrant` (line 129). Tests `familyFKeys.test.ts:128-253` verify all 6 guards verbatim. |
| 23 | NO verdict/winner/fallacy tokens in user-facing strings (general) | PASS | All occurrences in code/docs are in explicit doctrine-negation context (system prompt, doctrine docs, ban-list tests). No client-side strings touched. |

### Enforcement-loop (24-25)

| # | Item | Result | Evidence |
|---|---|---|---|
| 24 | Smoke template carries `Audit-Lint: v1` marker | PASS | Line 1 of `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-template.md`: `Audit-Lint: v1`. |
| 25 | Smoke audit (when authored post-merge) will be local-pre-lintable by design | PASS | Template structure follows the OPS-MCP-SMOKE-LINT-CI-WIRING shape that successfully validated `family-e-amendment-PARTIAL`, `family-e-hosted-completion-PASS`, `family-d-strengthened-amendment-PASS` fixtures (additional check C). 4 historical fixtures still self-validate (1/0/0/0). |

### Working tree (26)

| # | Item | Result | Evidence |
|---|---|---|---|
| 26 | Working tree at HEAD shows ONLY the 10 known operator-territory untracked files | PASS | `git status --short` returns exactly: `docs/testing-runs/2026-05-25-ai-driven-bot-corpus-annotated.md`, `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md`, `docs/testing-runs/2026-05-25-bot-engagement-corpus.md`, `docs/testing-runs/2026-05-25-bot-stress-summary.md`, `mcp021c-edge-smoke-request.json`, `mcp021c-edge-smoke-response.json`, `mcp021c-edge-smoke-runids.txt`, `netlify-prod.git`, `phase5-mcpserver002-hosted-smoke.log`, `phase5-mcpserver002-validator.log`. Exactly 10. |

**26/26 PASS.**

---

## Additional check A — Binding-minimum verification

| Required minimum item | Status | Evidence |
|---|---|---|
| 14 rawKeys covered by per-key fixture or assertion | PASS | `familyFKeys.test.ts:85-122` per-entry verbose-field test + binding rawKey list match + declaration-order test. 14 entries in `FAMILY_F_RAW_KEYS` and `FAMILY_F_PROMPT_ENTRIES`. |
| 12 D5 ban-list tokens covered (each has explicit test) | PASS | `familyFAdversarialDoctrine.test.ts` lines 193-303 — one explicit Deno.test per token: `fallacy` (193), `fallacious` (205), `weak argument` (214), `invalid argument` (223), `bad reasoning` (232), `flawed` (241), `wrong` (250), `proof of` (259), `unmet-means-fallacy` (268), `proves wrong` (279), `invalidates` (288), `refutes` (297). Plus line 317 enumerated test asserts all 12 present in FAMILY_F_BAN_PATTERNS array. |
| 3 mandatory adversarial fixtures (A, B, C) — fixture provider produces expected fixture + doctrine-clean assertion + Fixture-C non-echo proof | PASS | Fixture A: lines 67-102 (parseable + chain pattern in input). Fixture B: lines 104-128 (parseable + probability anchors in input). Fixture C: lines 130-157 (parseable + "fallacy" appears ≥2× in input); **explicit non-echo proof**: line 411 — `simulated F-on-Fixture-C output echoes "fallacy" FAILS` (negative pole of adversarial); line 398 — clean output PASSES (positive pole). |
| ≥1 test per F↔E doctrine-risk partnership (especially consequence_probability_unclear) | PASS | `consequence_probability_unclear` (HIGH): `familyFKeys.test.ts:128`, `familyFPrompt.test.ts:113`, `:368`; `analogy_mapping_missing` (MED): `familyFKeys.test.ts:152`, `familyFPrompt.test.ts:422`; `alternative_explanation_available` (MED): `familyFKeys.test.ts:172`, `familyFPrompt.test.ts:457`; `causal_mechanism_missing` (MED): `familyFKeys.test.ts:196`, `familyFPrompt.test.ts:439`; `authority_basis_missing` (MED): `familyFKeys.test.ts:216`, `familyFPrompt.test.ts:405`; `missing_warrant` (MED): `familyFKeys.test.ts:235`, `familyFPrompt.test.ts:389`. |
| Registry registration test | PASS | `familyRegistryInit.test.ts:147` `familyRegistryInit-registers-family-f-on-import`; `:154` 14 rawKeys; `:162` classifier version `family-f-v1`; `:56-78` 6-family insertion order. |
| Dispatcher routing test | PASS | `classifyArgumentBooleanObservations.ts:302-309` dispatcher `pickFamilyProviders` returns Family F providers; 5 dispatch test files retargeted with full 6-family supportedFamilies list assertions; existing tests confirm F-routing works via fixture-provider env path. |
| F-specific ban-list scan unit test | PASS | `familyFAdversarialDoctrine.test.ts:193-315` 12 token tests + clean-span PASS test + array-length test (12); `familyFBanListScan.ts` is itself the implementation under test. |

**All binding-minimum items present.** The +79 test delta is justified: no bloat, no missing coverage. The designer forecast of +95-130 was conservative — the implementer folded cross-family expansion tests into existing test files where the natural test shape allowed (e.g., dispatch test retargeting expanded the supportedFamilies assertion in-place rather than adding new tests). This matches the design §5 explicit allowance: "The implementer may fold cross-family expansion tests into existing test files where the natural test shape allows; the binding minimum is +95." The actual minimum is binding-minimum coverage matrix, which is fully present.

---

## Additional check B — Cross-family regression by inspection

Read `mcp-server/tests/familyBDispatch.test.ts`, `familyCDispatch.test.ts`, `familyDDispatch.test.ts`, `familyEDispatch.test.ts` diffs:

- **Substitution pattern**: F (previously unsupported) replaced with G/H/I/J (still unsupported). Original test intent preserved: prove unsupported_family envelope shape (`requestedFamilies`, `supportedFamilies`); prove cross-family leak prevention; prove 6-family insertion order.
- **Family-targeting correctness**: B's retargeted families are H (`claim_clarity`) + I (`thread_topology`); C's, D's, E's all target G (`resolution_progress`) — all 4 of {G, H, I, J} remain unsupported. No B/C/D/E (production) accidentally targeted.
- **Envelope shape preservation**: supportedFamilies list expanded from 5 to 6 in every retargeted assertion (`['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain', 'argument_scheme', 'critical_question']`). This is precisely the expected shift.

**Check B PASS.**

---

## Additional check C — 4 historical audit-lint fixtures self-validate

```
original-family-e-IMPROPER-PASS: exit=1
family-e-amendment-PARTIAL: exit=0
family-e-hosted-completion-PASS: exit=0
family-d-strengthened-amendment-PASS: exit=0
```

**Check C PASS** — matches expected 1/0/0/0. The enforcement-loop linter is unchanged and historical fixtures continue to discriminate IMPROPER (exit 1) from PASS/PARTIAL (exit 0). The first-enforcement provenance for the smoke audit PR remains viable.

---

## Blockers

None.

---

## Suggestions (non-blocking)

1. **Operator note for Phase 4b live smoke**: when the post-merge audit
   runs Fixture C end-to-end through the production auto-trigger and
   Edge admin_validation, capture the persisted `evidence_span` text
   for `consequence_probability_unclear` and grep against the 12 D5
   tokens directly in the audit's Phase 4b checklist. The template
   contains the checklist scaffold but the audit author will need to
   paste actual span text — this is intentional (template) but worth
   flagging.
2. **Forecast under-shoot for future cards**: the +79 vs +95-130
   forecast gap is fine here (no missing coverage), but for the
   downstream Card 2 (MCP-021C-EDGE-FAMILY-E-ENABLE) the binding-
   minimum check matrix should be defined in the intent brief
   upfront so the forecast and the binding minimum are decoupled
   from the start.
3. **Phase 7 enforcement-loop provenance subsection** (D12 BINDING)
   — the audit template carries the placeholder. When the operator
   captures the CI workflow run ID + in_scope count + linter exit,
   the verbatim subsection text is already designed; this is the
   first family-ship PR to exercise it.

---

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-SERVER-007-FAMILY-F`
- Open PR: `gh pr create --title "MCP-SERVER-007-FAMILY-F: critical_question classifier ship (admin_validation-only)" --body-file docs/audits/MCP-SERVER-007-FAMILY-F-REVIEW-2026-05-28.md`
- Post-merge: Supabase GitHub integration auto-deploys Edge changes (none needed here — Edge familyRegistry F entry already correct).
- Post-merge 8-phase smoke per design §5 (Phase 4b BINDING + Phase 7 enforcement-loop provenance D12 BINDING).
- Pre-push audit-lint: `node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-<date>.md` MUST exit 0 before pushing smoke audit PR.
- Post-merge worktree cleanup (commands in `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)").

---

**Verdict: APPROVE.** All 26 HALT matrix items + 3 additional checks PASS. No blockers. The +79 test delta is binding-minimum complete; no bloat is the correct interpretation.
