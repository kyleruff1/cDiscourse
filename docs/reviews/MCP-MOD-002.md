# MCP-MOD-002 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-23
**Branch:** feat/MCP-MOD-002-classifier-catalog-inventory
**Commit:** 7decc52
**Design:** docs/designs/modularity-slate/MCP-MOD-002.md

## Summary

Documentation-only card that introduces `docs/architecture/semantic-referee-classifier-catalog.md` — a 23-section
inventory walking every catalog v0 classifier id and naming its binary signal, exact AI question text, first banner
candidate, ledger feedback code, and source-of-truth file. Paired with `__tests__/semanticRefereeClassifierCatalogParity.test.ts`
(4 tests) that exhaustively pins the inventory to `ALL_SEMANTIC_CLASSIFIER_IDS` and `CLASSIFIER_QUESTION_TEXT`
byte-for-byte via `<!-- ai-question:<id> -->` markers. Findings (1 intentionally-silent banner, 12 ids without per-id
ledger rows, 1 near-duplicate question pair, zero family drift) are spot-check accurate against the actual source.
No production code touched, no doctrine violations, all checks pass. Ready to push and merge.

## Verification

| Check | Result |
|---|---|
| Working dir / branch | `C:/Users/kyler/cdiscourse/debate-constitution-app` on `feat/MCP-MOD-002-classifier-catalog-inventory` — Path B confirmed |
| `npm run typecheck` | pass (exit 0) |
| `npm run lint` | pass (exit 0, `--max-warnings 0`) |
| `npm run test` | **9101 tests / 333 suites** all pass (matches implementer's 9097 → 9101 / +4 claim) |
| `npx jest semanticRefereeClassifierCatalogParity` | 4 / 4 pass |
| Secret scan on 4 changed files | clean |
| Doctrine verdict-token scan | clean |
| Commit file footprint | exactly the 4 expected files; no `git add -A` evidence |

## Per-point findings (review checklist)

### 1. Path B confirmation
- `git rev-parse --show-toplevel` → `C:/Users/kyler/cdiscourse/debate-constitution-app` (main checkout, no worktree)
- `git branch --show-current` → `feat/MCP-MOD-002-classifier-catalog-inventory`
- Working tree shows two pre-existing modifications to `docs/testing-runs/2026-05-23-*.md` and one untracked
  `assets/branding/semantic-referee.zip` — none staged in the review commit.

### 2. Inventory completeness — PASS
Counted 23 section headings (`### \`<id>\``) and 24 `<!-- ai-question:` markers (24th is the documentation of the
marker convention on line 24; lines 51–457 contain the 23 per-id markers). Family grouping matches the design §3
exactly: §A 5 ids, §C 7 ids, §D 4 ids, §E 3 ids, §B/§G 4 ids = 23. The harness prompt noted the symbol "lives in
`semanticRefereeTypes.ts`" — the actual symbol `ALL_SEMANTIC_CLASSIFIER_IDS` exists in BOTH `supabase/functions/_shared/semanticReferee/types.ts`
(Deno mirror — what the inventory cites) AND `src/features/semanticReferee/semanticRefereeTypes.ts` (Node canonical),
parity-tested by `__tests__/semanticDenoNodeParity.test.ts`. The inventory's choice of the Deno file as the cited
source-of-truth matches the design doc (§2 / §3).

### 3. AI question parity (spot check across 5 families) — PASS
| Family | Id | Match |
|---|---|---|
| §A | `responds_to_parent` | byte-for-byte equal to `seedPrompt.ts:45` |
| §C | `provides_evidence` | byte-for-byte equal to `seedPrompt.ts:58` |
| §D | `narrows_claim` | byte-for-byte equal to `seedPrompt.ts:71` |
| §E | `fits_selected_debate_mode` | byte-for-byte equal to `seedPrompt.ts:80` |
| §B/§G | `contains_unplayable_insult_only` | byte-for-byte equal to `seedPrompt.ts:93` |

The remaining 18 ids are exhaustively covered by the parity test (point 6).

### 4. Banner mapping honesty — PASS
`src/features/refereeBanners/classifierBannerMap.ts:97` confirms `contains_unplayable_insult_only: Object.freeze([])`
— the array is empty.
`src/features/refereeBanners/refereeBannerLibrary.ts:1040` confirms `INTENTIONALLY_SILENT_CLASSIFIERS = new Set(['contains_unplayable_insult_only'])`
— the set exists and contains exactly the claimed id. The inventory's claim is fully grounded.

Spot-checked first-banner-code claims for 6 ids — all match:
- `responds_to_parent` → `continuity_clean_tie` (map line 32) ✓
- `quote_anchors_parent` → `clever_rebuttal_anchored` (map line 58) ✓
- `requests_clarification` → `continuity_clarification_landed` (map line 73) ✓
- `is_satire_or_parody` → `hot_take_invites_a_reply` (map line 99) ✓
- `suggests_diagonal_tangent` → `tangent_different_axis` (map line 122) ✓
- `fits_selected_debate_mode` → `mode_mismatch_fits_the_room` (map line 127) ✓

### 5. Ledger mapping honesty — PASS
The `classifierFor` table in `src/features/refereeLedger/reconcileMove.ts:166-177` keys 10 categories off 9 distinct
classifier ids (`responds_to_parent` is used twice — `continuity` + `direct_response`). The inventory says 11 ids have
ledger feedback codes; this is reconciled by `narrows_claim` + `concedes_narrow_point`, which have category authority
`economy` (`src/features/refereeLedger/reconciliation.ts:53-54`) and adopt the point-standing-economy delta directly
rather than going through `classifierFor`. The inventory captures this nuance precisely in the per-id rows ("category
authority is `economy`; the ledger adopts the point-standing-economy delta bit-for-bit").

Spot-checked 3 "no ledger mapping" claims (per harness instruction):
- `cites_retraction` — not in `classifierFor` (confirmed by reading lines 166-177)
- `is_satire_or_parody` — not in `classifierFor` ✓
- `contains_playable_hot_take` — not in `classifierFor` ✓

Also verified the anti-amplification claims: `uses_popularity_as_evidence` (line 347) and `creates_source_chain_gap`
(line 348) both feed into `amplificationContextFromAnnotationFields` in `reconcileMove.ts`, exactly as the inventory
claims. All 12 "no ledger mapping" claims hold up.

### 6. Parity test correctness — PASS
`__tests__/semanticRefereeClassifierCatalogParity.test.ts` (107 lines, 4 tests):

1. **Section-heading coverage** — iterates `DENO_ALL_SEMANTIC_CLASSIFIER_IDS` (re-exported from the actual Deno
   `types.ts` via the existing `_helpers/semanticRefereeDeno.ts` bridge), regexes `^### \`<id>\`\s*$` against the
   inventory. Builds `missing[]` and asserts empty — a missing heading fails loudly with the id name.
2. **Exactly 23** — independent sanity check pinning catalog v0 size.
3. **AI question byte-for-byte parity** — for each id, extracts the fenced content under `<!-- ai-question:<id> -->`
   via regex (line 53, with `\r?\n` support for Windows line endings) and asserts strict `===` equality with
   `CLASSIFIER_QUESTION_TEXT[id]`. Builds `mismatches[]` of `{id, expected, actual}` triples and asserts empty.
4. **No missing marker / fenced block** — guards against a section without a marker.

Mental mutation check: if I changed one byte in any question in either the doc or `seedPrompt.ts`, test 3 would fail
with the offending id, expected text, and actual text. If I deleted a section heading, test 1 would fail listing the
missing id. If catalog v0 widened/shrank, test 2 would fail. The test is well-engineered for the documentation-drift
guard role.

The test relies on the `_helpers/semanticRefereeDeno.ts` bridge — which `require()`s the live Deno `seedPrompt.ts` and
`types.ts` at runtime. So `CLASSIFIER_QUESTION_TEXT` and `DENO_ALL_SEMANTIC_CLASSIFIER_IDS` in the test are the
authoritative source values, not local re-declarations.

### 7. No production code touched — PASS
`git diff main..HEAD --name-status`:
```
A  __tests__/semanticRefereeClassifierCatalogParity.test.ts
A  docs/architecture/semantic-referee-classifier-catalog.md
M  docs/core/current-status.md
M  docs/core/roadmap-semantic-referee-modularity.md
```
Exactly the 4 files in the design. No touches to `seedPrompt.ts`, `types.ts`, `classifierBannerMap.ts`,
`reconcileMove.ts`, any Edge Function, any migration, or any source file under `src/` or `app/`.

### 8. Doctrine compliance — PASS
- No verdict tokens (`winner`, `loser`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`,
  `stupid`, `idiot`) in the new inventory doc or test file.
- Soft-adjacent tokens (`factual`, `factual-standing`, `factual support`) appear only in the doctrine's own
  evidentiary terminology (e.g. "satire is not factual support for a claim"), describing structural / evidentiary
  signals — not truth verdicts about persons or posts. Consistent with §1 / §3 of `cdiscourse-doctrine`.
- The "source-of-truth file" phrase is architectural meta (which file holds the canonical id list) and is unrelated
  to truth claims about user content.
- Banner labels like `back_to_the_claim`, `hot_take_keeps_it_about_the_claim`, `branch_belongs_on_branch` are routing
  / pacing labels, never person labels. The intentionally-silent posture for `contains_unplayable_insult_only` is
  documented and reinforced.
- The inventory describes STRUCTURAL signals only, matching the design's §3 promise.

### 9. No secret leak — PASS
Grepping the 4 changed files for `ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN|SUPABASE_SERVICE_ROLE_KEY|sb_secret_|sk-ant-|^\+xai-|Bearer |Authorization:|eyJ[A-Za-z0-9_-]{20,}`
returns zero matches.

### 10. Tests pass — PASS
- `npx jest semanticRefereeClassifierCatalogParity` — 4 / 4 pass in 1.467 s.
- `npm run typecheck` — exit 0, no diagnostics.
- `npm run lint` — exit 0, `--max-warnings 0`.
- `npm run test` — **333 suites / 9101 tests** all pass (25.895 s wall time). Matches the implementer's claim of
  9097 → 9101 / +4.

### 11. No `git add -A` evidence — PASS
`git status -sb` shows two pre-existing modifications in `docs/testing-runs/2026-05-23-*.md` and one untracked
`assets/branding/semantic-referee.zip`. **None** of these appear in `git diff main..HEAD --name-only`. The implementer
correctly staged only the 4 intended files.

## Suggestions (non-blocking)

1. Inventory §`asks_for_evidence` ledger row says "surfaces upstream through `scoreHints.evidencePressure` rather than
   a per-id `classifierFor` entry" — accurate, but the same upstream-via-scoreHints pattern applies to several other
   ids. A future revision (or MCP-MOD-004 source-of-truth) could classify the 12 unmapped ids by mechanism
   (anti-amplification / scoreHints / l1-fact / routing-only) and surface that as a column. Defer; the Findings section
   already calls out the pattern.
2. The inventory cites `src/features/refereeBanners/classifierBannerMap.ts` (banner source-of-truth) and
   `src/features/refereeLedger/reconcileMove.ts` (ledger source-of-truth). MCP-MOD-004 will replace these with a
   single `SEMANTIC_CLASSIFIER_CATALOG` — at that point the "Source-of-truth file (today)" row will all need a single
   update (one column, 23 rows). The design anticipates this; just flagging the future churn.
3. No accessibility / banner-rendering / `selectBanner` per-move-selection detail in the inventory (deliberate per
   design §3 — the row reports the per-id *candidate* list, not the runtime *selection*). Worth a sentence reminding
   readers that `selectBanner` ranks across `BANNER_CATEGORY_PRIORITY` and picks one per move — the inventory does
   briefly note this in "How to read each section" line 28-29, so this is already addressed; defer.

None of the three suggestions block.

## Operator next steps

1. Push the branch:
   ```
   git push -u origin feat/MCP-MOD-002-classifier-catalog-inventory
   ```
2. Open PR:
   ```
   gh pr create --title "MCP-MOD-002: classifier catalog inventory" --body-file docs/reviews/MCP-MOD-002.md
   ```
3. No deploy steps — documentation-only card. No `db push`, no `functions deploy`, no env var, no migration.
4. After merge: nothing else. MCP-MOD-004 will consume this inventory as input.

**Bottom line: ready to push and merge.**
