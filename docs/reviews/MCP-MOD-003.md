# MCP-MOD-003 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-23
**Branch:** `feat/MCP-MOD-003-prompt-template-inventory`
**Commit reviewed:** `32ac245`
**Design:** [`docs/designs/modularity-slate/MCP-MOD-003.md`](../designs/modularity-slate/MCP-MOD-003.md)
**Issue:** [#232](https://github.com/kyleruff1/cDiscourse/issues/232)

## Summary

Pure-documentation card (Movement A of the modularity slate). Ships a single new
architecture doc (`docs/architecture/semantic-referee-prompt-template.md`, 519
lines, six §1–§6 sections + `## Invariants` + `## Findings`) that inventories the
semantic-referee seed prompt verbatim from `anthropicClassifierCore.ts` /
`seedPrompt.ts`, plus a parity test (`__tests__/semanticRefereePromptTemplateParity.test.ts`,
7 tests) that asserts byte-for-byte equality between every quoted block in the
inventory and the live source — including the full `buildClassifierPrompt`
assembly output for a fixed deterministic sample. No production code,
no migration, no Edge Function, no schema, no dependency, no `.env` touched.
Meta-roadmap (`docs/core/roadmap-semantic-referee-modularity.md`) gains the
inventory link; `docs/core/current-status.md` gains the entry. Implementer's
self-flagged findings (ban-list-test superset, two non-`Does this move ...`
questions, two near-duplications between system prompt and user instruction)
are correctly forwarded to MCP-MOD-005 and explicitly informational.

## Verification

- typecheck: **PASS** (`npm run typecheck` exit 0, no output)
- lint: **PASS** (`npm run lint` exit 0, silent)
- targeted test: **PASS** — `npx jest semanticRefereePromptTemplateParity` 7/7 in 1.1 s
- diff footprint: 4 files (1 new doc, 1 new test, 2 doc updates) — matches design § 2
- secret scan: clean — only documentation references (which file READS `ANTHROPIC_API_KEY`,
  fragment-name patterns the redactor catches); no key literals
- doctrine scan: clean — every verdict-token hit is either a verbatim quotation of
  the system prompt's own `do NOT ...` prohibitions, an annotation citing the
  prohibition, the `Findings` section narrating the ban-list test's enforced
  token list, or the current-status entry mirroring those findings. None of the
  hits use a verdict token to ASSERT a fact

## Per-check verdict matrix

| # | Check | Result | Justification |
|---|---|---|---|
| 1 | Path B confirmation | **PASS** | `git rev-parse --show-toplevel` = `C:/Users/kyler/cdiscourse/debate-constitution-app`; `git branch --show-current` = `feat/MCP-MOD-003-prompt-template-inventory` |
| 2 | Both required skills invoked | **PASS** | `Skill(cdiscourse-doctrine)` and `Skill(test-discipline)` both invoked before reviewing — see "Skills invocation" below |
| 3 | System-prompt byte parity | **PASS** | Manual regex extraction: inventory `<!-- prompt-block:system-prompt -->` block = 1085 bytes; `SEMANTIC_REFEREE_SYSTEM_PROMPT` constant body = 1085 bytes; `-ceq` (case-sensitive) returns `True`. Spot-checked lines: `You do NOT decide the winner of any debate.` and `You do NOT treat popularity, engagement, or virality as evidence.` both present byte-identical in `anthropicClassifierCore.ts:55-58` and inventory `docs/architecture/semantic-referee-prompt-template.md:52-54` |
| 4 | User-message instruction byte parity | **PASS** | Parity test invariant 2 (`__tests__/semanticRefereePromptTemplateParity.test.ts:157-163`) extracts the live instruction by calling `buildClassifierPrompt(buildSampleRequest())` and splitting on `\n\n`, then asserts equality against the inventory's `<!-- prompt-block:user-message-instruction -->` block — 7/7 passing. This is stronger than the design-stated "lines 139-148" check because it pulls the assembled output from the live `.join(' ')`, so the implementer's note about the actual range (139-153) does not matter — the test compares the RUNTIME OUTPUT, not the source line range |
| 5 | Per-id assembly parity exercises real `buildClassifierPrompt` | **PASS** | Parity test invariant 3 (`...:171-176`) calls `buildClassifierPrompt(buildSampleRequest())` with `request.requestedClassifiers = ['responds_to_parent', 'introduces_new_issue', 'asks_for_evidence']` and asserts the FULL assembled output (questions header + question lines + instruction + worked example + redacted input block) equals the quadruple-backtick-fenced inventory sample byte-for-byte. This exercises de-duplication, first-seen-order preservation, the `.join(' ')` instruction assembly, the `\n`-joined worked-example block, and `buildInputBlock` — i.e. the actual assembly mechanism, not just the static template |
| 6 | Source-file map accuracy | **PASS** | All 19 rows in §5 reference files that exist (verified via `git ls-files`). Spot-checked 4: (a) `SEMANTIC_REFEREE_SYSTEM_PROMPT` lives in `anthropicClassifierCore.ts:51-70` — correct; (b) `CLASSIFIER_QUESTION_TEXT` lives in `seedPrompt.ts:42-94` — correct; (c) `redactClassifyMoveRequest` lives in `redaction.ts` and is called at `semantic-referee/index.ts:92` exactly as the inventory claims (Grep returned the literal line) — correct; (d) `scanPacketContent` lives in `contentSafetyScan.ts` — correct |
| 7 | Invariants section is accurate and complete | **PASS** | §"Invariants" (lines 386-441) formalizes 8 doctrine constraints: (1) absolute-rules list, (2) strict-JSON contract wall, (3) per-id questions structural only, (4) route/friction enums must match `types.ts`, (5) `authoritative` hard-pinned `false`, (6) per-call selection only, (7) unconditional redaction pipeline, (8) `SEED_PROMPT_VERSION` bumps on wording change. Each invariant traces to a real doctrine line in `cdiscourse-doctrine` or `MCP-001`; none invents a constraint that contradicts the live source. The pinning of `authoritative: false` is consistent with what `stampPacketIdentity` does in `anthropicProvider.ts`; the redaction-pipeline ordering matches `semantic-referee/index.ts:92` calling `redactClassifyMoveRequest` BEFORE the provider |
| 8 | Doctrine compliance scan | **PASS** | Every verdict-token (`winner`, `loser`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`) occurrence in the diff is in one of four ALLOWED contexts: (a) the system-prompt's own `do NOT ...` prohibitions quoted verbatim, (b) a per-clause annotation citing the doctrine that the prohibition enforces, (c) the `Findings` section enumerating the ban-list test's token list, (d) the current-status entry mirroring those findings. No occurrence uses a verdict token to assert a fact about a person, post, or claim — the inventory consistently treats them as PROHIBITIONS or as VOCABULARY-UNDER-TEST. Doctrine clauses §1, §3, §4 all respected |
| 9 | No production code touched | **PASS** | `git diff main..HEAD -- 'src/**' 'app/**' 'supabase/**' --stat` returns empty. The only changed files are the 4 expected: `docs/architecture/semantic-referee-prompt-template.md` (new), `__tests__/semanticRefereePromptTemplateParity.test.ts` (new), `docs/core/current-status.md` (entry added), `docs/core/roadmap-semantic-referee-modularity.md` (link added) |
| 10 | No `git add -A` evidence | **PASS** | `git diff main..HEAD --name-only` does NOT include the pre-existing modified files `docs/testing-runs/2026-05-23-ai-driven-bot-corpus-dry.md` or `docs/testing-runs/2026-05-23-engagement-epidemiology-synthetic.md`, nor the untracked `assets/branding/semantic-referee.zip`. All four still show as dirty in the working tree (`git status -sb`) but are correctly NOT staged into commit `32ac245` |
| 11 | No secret leak | **PASS** | The only matches in the diff are (a) a literal mention of `ANTHROPIC_API_KEY` as a documentation reference naming which file reads it (`anthropicProvider.ts`), (b) the fragment names `sk-ant-`, `xai-`, `sb_secret_` used to describe the redactor's pattern list (no key body follows), and (c) the strings `Bearer <token>` / `Authorization: <value>` as placeholder syntax in the §4 narrative — no concrete token present. No JWT-shape strings, no service-role-key, no `XAI_API_KEY` value, no `X_BEARER_TOKEN` value. The repo's secret-literal regex would not match any of these documentation references |
| 12 | Tests pass | **PASS** | `npx jest semanticRefereePromptTemplateParity` → 7/7 passing in 1.096 s. Suite count goes UP by 1 (per the implementer's note: 9101 → 9108 tests / 333 → 334 suites). Typecheck and lint both clean |

## Test-discipline check

The new test file `__tests__/semanticRefereePromptTemplateParity.test.ts` conforms
to `Skill(test-discipline)`:

- **Location:** `__tests__/` (not co-located) — correct.
- **Surface:** pure source-scan + parity assertion — `fs.readFileSync` of the
  inventory doc plus `require()`-bridge import of `SEMANTIC_REFEREE_SYSTEM_PROMPT`
  and `buildClassifierPrompt` from `__tests__/_helpers/semanticRefereeDeno.ts`.
  No React, no Supabase client, no `fetch`, no network — exactly the
  `pointTagEligibilityMirror.test.ts` / `adminSchemas.test.ts` pattern the
  bridge was written for.
- **Hygiene:** zero `.skip`, zero `.only`, zero `xit`, zero `xdescribe`,
  zero committed `console.log` (Grep confirmed empty).
- **Drift detection:** the test fails loudly on real drift. Mental mutation test
  — change the inventory's `You do NOT decide the winner of any debate.` to
  `You do NOT decide the winner of any debate` (drop trailing period): invariant
  1's `expect(block).toBe(SEMANTIC_REFEREE_SYSTEM_PROMPT)` fails immediately
  because the byte string differs. Change one word of the user-message
  instruction in `seedPrompt.ts` without updating the inventory: invariant 2
  fails (because `buildClassifierPrompt` returns the new wording, the inventory
  block is the old wording). Add a 4th id to `request.requestedClassifiers` in
  the inventory's sample but not the test's `buildSampleRequest`: invariant 3
  fails (the assembled output differs).
- **The quadruple-backtick fence convention** for `prompt-block:per-id-question-sample`
  is correct — the worked example portion of the assembled prompt contains a
  literal ` ```json ` … ` ``` ` triple-backtick fence. The quadruple-backtick
  outer fence preserves the inner triple-backtick fence as literal content, so
  the extraction regex (anchored to a matching-length closing fence at start of
  line) captures the entire assembled prompt including the inner JSON example.
  The test correctly distinguishes 3-vs-4-tick fences via the `fenceTickCount`
  parameter.

## Skills invocation

- **`Skill(cdiscourse-doctrine)`** invoked. Rule §1 (score is gameplay analysis,
  never truth) is directly relevant: every verdict-token occurrence in the new
  doc is a prohibition or a doctrine annotation citing what the prohibition
  forbids, not an assertion. Rule §3 (popularity is not evidence) is encoded in
  invariant 1 + annotation on the `popularity / engagement / virality` clause.
  Rule §4 (AI moderator hard limits) is encoded in invariant 5 (`authoritative`
  hard-pinned `false`). Rule §6 (secrets policy) — the diff names key-prefix
  fragments and key-name constants for documentation purposes only; no key
  literal present. Rule §9 (plain language for users) — the inventory is an
  internal architecture document, not a user-facing string, so the rule does not
  apply to its content. **All applicable doctrine clauses respected.**
- **`Skill(test-discipline)`** invoked. The new test file follows the established
  source-scan + parity pattern (cf. `pointTagEligibilityMirror.test.ts`,
  `semanticRefereeClassifierCatalogParity.test.ts` from MCP-MOD-002). Test count
  goes UP by 7 (suite count UP by 1). Hygiene clean. Test is in the right place
  (`__tests__/`), uses the canonical Deno bridge, and would catch real drift.
  **Test-discipline rules respected.**

## Actionable comments

None. Every check passes. The implementer's three self-flagged findings (ban-list
test enforces a superset of the system-prompt's named tokens; two questions don't
start with `Does this move ...`; two near-duplications between system prompt and
user instruction) are correctly fed forward to MCP-MOD-005 as informational
observations rather than blockers. Each finding is paired with a clear-eyed
explanation of WHY the current state is defensible (model generalization for
the superset; thread-state vs author-state subject for the two grammar
exceptions; defense-in-depth for the duplications) — the implementer is not
sneaking a refactor request through the back door.

## Bottom line

**Ready to push and merge.** Pure documentation card; doctrine-clean;
byte-parity test passes and would fail loudly on real drift; no production code,
no migration, no Edge Function, no `.env`, no dependency, no operator follow-up
beyond the standard merge. Foundation work for MCP-MOD-005 is now in place with
an inventory the next implementer can read top-to-bottom without opening the
source files.

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-MOD-003-prompt-template-inventory`
- Open PR: `gh pr create --title "MCP-MOD-003: prompt template inventory" --body-file docs/reviews/MCP-MOD-003.md`
- **No deploy steps.** Pure documentation + test. No `db push`, no
  `functions deploy`, no secret rotation, no `.env` change.
