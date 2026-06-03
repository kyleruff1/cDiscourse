# CORPUS-30-POOL-DRIVEN-PLANNER — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-03
**Branch:** feat/CORPUS-30-POOL-DRIVEN-PLANNER (HEAD 4bdaf35; 3 commits over main e44aa5d)
**Design:** docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md

## Summary

The branch closes the `POOL_DRIVEN_MISSING` halt verdict from the Phase 1+2
audit by introducing the deterministic option-bank planner the design called
for, the post-processor that derives the six banks per seed, and the renderer
hook that binds each move to a planner-picked option. The `runId.slice(0,8)`
room-title bug (which returned `2026-06-` for every same-month run) is
replaced by a structured `buildRunTag(runId, kind)` of the form
`<kind>-YYYYMMDD-HHMM-<8hex>` (≤48 chars; substring-filterable).

Doctrine is honored end-to-end: zero `mcp-server/`, `supabase/`,
`package.json`, `package-lock.json`, `src/familyRegistry.ts`,
`src/lib/constitution/engine.ts`, or `SKILL.md` files appear in the diff;
no truth/winner/loser/person-label tokens leak into any user-rendered field;
the implementer's reply-function bridge (between the existing classifier's
11-element vocab and the design's 10-element vocab) correctly routes
`insult_only` / `tangent` / `unclear` to NO bank (the doctrine-correct
case), and routes every other classifier label to a bank that preserves the
design's spirit. The new diversity-check helpers operate purely on JSONL
attribution and emit counts + move-id pairs only — never body text.

The single intentional bridge (`REPLY_FUNCTION_TO_BANKS`) and the
synthetic-default templates are doctrinally clean and have explicit
provenance tagging (`'paraphrase_rule'` / `'synthetic_default'` /
`'harvester_post_processed'`) so the reporter can later distinguish derived
options from harvester-sourced ones.

## Verification

| Gate | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint | pass (exit 0) |
| test | pass — 603 → 614 suites, 18985 → 19056 tests (+11 / +71); exit 0 |
| secret scan | clean (the only `ANTHROPIC_API_KEY` / `XAI_API_KEY` / `sk-ant-` hits are env-var name references in tests and a redaction-pattern regex in scan code — no actual values) |
| doctrine scan | clean (one hit on `winner|loser|…` is the docstring `No truth labels appear here. No person-label, winner/loser, verdict, or forbidden-user-label token is part of any voice id, spine id, or bank name.` in `corpusPoolDrivenPlannerConstants.js`) |
| boundary check | clean (zero changes to `mcp-server/`, `supabase/`, `package.json`, `package-lock.json`, `src/familyRegistry.ts`, `supabase/functions/_shared/booleanObservations/familyRegistry.ts`, `src/lib/constitution/engine.ts`, or any `SKILL.md`) |
| baseline confirmation | pre-card `main` test run: 603 suites / 18985 tests / exit 0 — confirms the implementer's +11/+71 delta exactly |

## Design conformance

- [x] All design file-changes are present (15 new files + 6 modified files match §11.1/§11.2 exactly)
- [x] No undocumented file-changes (every diff line lives in `scripts/bot-fixtures/`, `scripts/engagement-intelligence/`, `__tests__/`, `fixtures/bot-fixtures/`, `docs/designs/`, or `.gitignore`)
- [x] Data model matches design (Seed + Option shapes at `xaiAdversarialOptionBankBuilder.js:101-133` mirror §4.1; banks at §4.3 line up with `PROVOCATEUR_BANKS`/`REVOCATEUR_BANKS` constants)
- [x] API contracts match design (`seedAssignment`, `selectOption`, `assignVoiceId`, `assignSpineId`, `resolveMoveBank`, `buildRunTag`, `SeedPoolUndersizedError` all exported with the signatures the design names)

Specific design-citation checks:

- **§4.3 PROVOCATEUR_BANKS / REVOCATEUR_BANKS** — `corpusPoolDrivenPlannerConstants.js:45-57` exactly match.
- **§4.4 MOVE_PLAN** — `corpusPoolDrivenPlannerConstants.js:93-128` exactly match (M1→opening_claim, M2→objection, M9→concession_or_narrowing, M10→resolution_pressure fixed; M3-M8 rotation sets verbatim).
- **§5 Fisher-Yates** — `corpusPoolDrivenPlanner.js:135-141` implements the byte-stable shuffle; `SeedPoolUndersizedError` with per-bank floor-pass details (`corpusPoolDrivenPlanner.js:127-130`) matches §5 step 2.
- **§6 selectOption** — base-index hash key at `corpusPoolDrivenPlanner.js:247` is `${runId}:opt:${threadIndex}:${role}:${moveIndex}:${bankName}` per §6 step 1; linear probe at lines 252-258 is O(bank.length); per-thread used Set + reset on exhaustion + `bank_exhausted_reset` callback (`onReset`) at lines 239-244 match §6 steps 2-5.
- **§7.1 voiceId** — `assignVoiceId(runId, botUserId) = VOICES[hash(runId+':voice:'+botUserId) % 8]` at `corpusPoolDrivenPlanner.js:272-274`; 8 voices match.
- **§7.2 spineId** — `assignSpineId(runId, threadIndex, moveIndex, prevSpine)` at lines 276-292; the no-repeat-prior constraint advances `(idx + 1) % SPINES.length` on collision per §7.2; 9 spines match.
- **§7.3 renderer becomes selection-aware** — `renderAlignedAdversarialMove` at `xaiAdversarialMoveRenderer.js:590-763` carries the BINDING prompt directive ("Render this exact option in your assigned voice; do NOT substitute") at line 667, the 40% non-stopword-overlap option-alignment validator at lines 494-509, the per-spine regex spine-alignment validator at lines 511-517, and the deterministic skeleton-fill fallback at lines 525-564 that always satisfies option alignment.
- **§8.2 runTag fix** — `buildRunTag` at lines 310-329 produces `corpus-prod-synthetic-20260603-1422-a1b2c3d4` (test fixture verified at `corpusPoolDrivenPlanner.runTag.test.ts:18-21`); legacy `runId.slice(0, 8)` is GONE from the runner (test at `runTag.test.ts:43-47` re-reads the file and asserts `not.toMatch(/runId\.slice\(\s*0\s*,\s*8\s*\)/)`).
- **§8.3 room title format** — `runXaiAdversarialBotCorpus.js:455` uses `${runTag} t${String(threadIndex).padStart(2, '0')}` per the design's `t{NN}` convention; total width ≤53 chars.
- **§9 reporter checks** — all four categories present: duplicate-seed (`runDiversityChecks` → `checkDuplicateSeed`), repeated-option (`checkRepeatedOption` with both within-thread and ≥3-thread cross-thread collision), spine saturation (`checkSpineSaturation` with the >35% threshold per §9.3), voice distribution (`checkVoiceDistribution` with the 5-12 band per §9.4), samey-move (`checkSameyMove` with 0.60 pairwise and 0.35 mean thresholds per §9.5). Each helper returns a `severityBand` of `green` / `yellow` / `red`.

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — only docstring negations; the canonical fixture, every paraphrase template, and the Anthropic prompt block all stay free of verdict tokens
- [x] Score never blocks posting — N/A (this card does not touch scoring or the acceptance gate; `submit-argument` path is unchanged)
- [x] No service-role in client code — diff scan for `SERVICE_ROLE` returns zero hits
- [x] No direct insert into public.arguments — diff scan for `from .public\.arguments|insert.*public\.arguments` returns zero hits; the runner still posts through `submit-argument` exactly as it did pre-card
- [x] No AI calls in production app paths — every Anthropic touchpoint lives in `scripts/bot-fixtures/` and is gated by `claudeMessagesClient.refuseIfNotGated`; the planner itself never calls Anthropic (pure deterministic)
- [x] Plain language only — no raw internal codes are emitted in any user-rendered field (the `bankName` strings stay structural; they do not surface to debate UI)
- [x] Epic-specific doctrine (cdiscourse-doctrine §1/§9/§10a): The renderer's BINDING block names the option **structurally** ("bank: evidence_pressure_options / summary: …") and the option's `summary` is a redacted/paraphrased structural label, never a person/post label. The bridge's omission of `insult_only` / `tangent` / `unclear` from `REPLY_FUNCTION_TO_BANKS` is doctrinally correct — an insult is NOT pressure and must not be routed to opening_claim_options or any other bank.

## Test coverage

- [x] New public functions have unit tests — every exported function in `corpusPoolDrivenPlanner.js` (`uintHash`, `seedAssignment`, `selectOption`, `assignVoiceId`, `assignSpineId`, `resolveMoveBank`, `buildRunTag`, `SeedPoolUndersizedError`, `seedMeetsAllFloors`) has at least one explicit assertion across the 5 planner test files
- [x] Doctrine ban-list assertions present — `xaiAdversarialOptionBankBuilder.derivation.test.ts` includes a no-raw-X-content assertion on the canonical fixture and the derived options
- [x] Edge cases from design § "Edge cases" have tests — bank exhaustion + reset; seed-pool undersized; raw harvester JSONL rejected by `readBankedPoolFile`; renderer fallback when Anthropic ignores option after retry; existing validators (banned canned phrase) still fire under the new aligned renderer
- [x] Live-mode gate test enforces `--pilot`, `ANTHROPIC_API_KEY`, `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC`, `.env.bot-tests`, `XAI_API_KEY` all required
- [x] No `.only`, `.skip`, `xit`, `xdescribe`, `fdescribe` introduced; no committed `console.log` in `src/` or `app/`
- [x] Test count delta strictly positive (+11 suites / +71 tests); zero flake on full-suite run

## Notes on the implementer-flagged bridge

The implementer's `REPLY_FUNCTION_TO_BANKS` map at
`xaiAdversarialOptionBankBuilder.js:101-113` is the load-bearing bridge
between the existing `xaiDissentDetector.js` vocabulary
(`ask_source, ask_quote, ask_definition, counterexample, narrow_scope,
rebut, support, caveat, tangent, insult_only, unclear`) and the design §4.2
routing language (`restatement, rebuttal, source_chain_attack, evidence_challenge,
…`). I verified each routing:

| Classifier label | Routed to | Verdict |
|---|---|---|
| `ask_source` | `evidence_pressure_options` | doctrinally correct |
| `ask_quote` | `evidence_pressure_options` | doctrinally correct |
| `ask_definition` | `alternative_explanation_options` | defensible (definition pressure ↔ alternative reading of terms); marginal — see Suggestion 1 |
| `counterexample` | `alternative_explanation_options`, `objection_options` | doctrinally correct |
| `narrow_scope` | `alternative_explanation_options`, `concession_or_narrowing_options` | doctrinally correct |
| `rebut` | `objection_options` | doctrinally correct |
| `support` | `opening_claim_options` (restatement) | doctrinally correct |
| `caveat` | `concession_or_narrowing_options` | doctrinally correct |
| `tangent` | (none) | doctrinally correct — tangents do not belong in any bank |
| `insult_only` | (none) | doctrinally correct — an insult is NOT pressure |
| `unclear` | (none) | doctrinally correct |

The bridge **preserves the design's spirit** in every case. The synthetic-default
templates ensure each bank reaches floor without classifier coverage, with
explicit `provenance: 'synthetic_default'` on every template-derived option so
the diversity reporter can later (post-tiny-run) distinguish derived from
harvester-sourced options. This is a v2-tuning concern at most, not a v1
blocker. Implementer recommendation accepted: per design §14 R1 and §15 R1,
xAI-direct bank generation remains an optional v2 enhancement.

## Suggestions (non-blocking)

1. **`ask_definition` routing is the marginal call.** It currently maps only
   to `alternative_explanation_options`. A future tweak could ALSO route it
   to a hypothetical `definition_clarity_options` bank, or to
   `evidence_pressure_options` ("show the page where the definition is
   used"). Defer to tiny-stage observation — if the tiny corpus shows
   `ask_definition` replies under-represented in the action surface, revisit.

2. **`bank_exhausted_reset` event is emitted with `runTag`/`scenarioId`/`seedId`
   in the M3+ loop** (`runXaiAdversarialBotCorpus.js:1170`) **but only with
   `runId, threadIndex, role, moveIndex, bankName, bankSize` in the M1/M2
   pathway** (lines 731, 747). Functionally identical for the M1/M2 case
   because the first selection from a bank cannot exhaust it, but cosmetic
   consistency would be nice for the reporter. Non-blocking.

3. **Per-thread JSONL file at `logs/engagement-intelligence/{runTag}/thread-{NN}.json`
   (design §8.4) is not yet emitted by the runner** — only the unified
   `…-semantic-corpus.jsonl` carries the attribution. The Markdown
   distribution section is sufficient for the dry stage; if the operator
   wants per-thread inspection after tiny-30, file a follow-up. Non-blocking.

4. **Migration apply** | N/A — no `supabase/migrations/` files touched
   (boundary check confirms). The migration-bearing card heightened-review
   section does not apply.

## Operator next steps

- Push the branch: `git push -u origin feat/CORPUS-30-POOL-DRIVEN-PLANNER`
- Open PR: `gh pr create --title "CORPUS-30: pool-driven planner + post-processor + reporter checks" --body-file docs/reviews/CORPUS-30-POOL-DRIVEN-PLANNER.md`
- This is a **dev-tooling-only** PR — no `mcp-server/`, `supabase/`,
  `src/`, or `app/` changes. Merge has no deploy side-effect; the Supabase
  migration / Edge Function auto-deploy chain is not triggered.
- After PR opens, **stop at GATE B** (operator design review of the diff
  against the design doc) per the design's §17 sequencing. Do NOT proceed
  to the dry/tiny/30/classify stages without explicit operator gate; each
  is separately operator-gated per the governance contract.
- Per design §16 acceptance #10, this card is **auto-merge-eligible** on
  green because it is non-deploy / dev-tooling-only. Operator decides at
  GATE C.
- Post-merge worktree cleanup (operator step) follows the standard
  procedure in `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree
  cleanup (operator step)" — `git worktree remove -f -f
  ".claude/worktrees/agent-<hash>"` then `git branch -D feat/CORPUS-30-POOL-DRIVEN-PLANNER`.
