# RULE-003 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Branch:** feat/RULE-003-lifecycle-to-ux-doctrine-map
**Design:** docs/designs/RULE-003.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/65

## Summary

RULE-003 lands the single source of truth that maps every LIFE-001 point-lifecycle state (19), every META-001 manual tag (10), and every META-001 auto-derived metadata code (16) to a render-ready `{ label, helperLine, iconHint, allowedDockActions[] }` UX triple. The `label` field is read at module-load time through `getPointLifecyclePlainLabel` / `getManualTagPlainLabel` / `getAutoMetadataPlainLabel` — never freshly authored — which is the cardinal anti-drift guarantee the design promised. Implementation is pure-TS, frozen, side-effect-free, and 31 new tests pin every doctrine checkpoint (coverage, label parity, ban-list scans against both shared `_forbidden*Tokens()` helpers with word-boundary matching, person-attribution scan, heat-token scan, ≤80-char length cap, icon-hint validity + no-verdict-glyph, action-vocabulary subset + `expand_branch` / `mark_moved_on` / `mark_ignored` exclusion, reader reference-equality, cross-map label reuse, freeze invariants). No UI, no migration, no Edge Function, no dependency, no `.env*`, no service-role. Ready to merge.

## Verification

- **typecheck:** pass (`npm run typecheck` exit 0)
- **lint:** pass (`npm run lint` exit 0)
- **test:** 3375 passing / 19 failing / 3394 total / 5 failed suites / 123 total suites. The 19 failing tests (5 suites) are the pre-existing operator-gated engagement-intelligence baseline — sample failure: `claudeMessagesClient ... refuses when ANTHROPIC_API_KEY is missing` rejects with `env_file_missing` instead of `api_key_missing` because no `.env.engagement-intelligence` is present on the reviewer host. These failures exist on `main` (commit `f516afd`) and are unrelated to RULE-003.
- **RULE-003 suite alone:** 31/31 pass in 1.05s.
- **Test delta:** +31 tests, +1 suite (passing-baseline 3344 → 3375; suites 122 → 123).
- **secret scan:** clean (`git diff main..HEAD | grep -iE 'ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN|SUPABASE_SERVICE_ROLE_KEY|sb_secret_|sk-ant-|Bearer |Authorization:|eyJ[A-Za-z0-9_-]{20,}'` → 0 hits).
- **doctrine scan:** clean. The `git diff main..HEAD -- 'src/**/*.ts'` scan for `SERVICE_ROLE|ANTHROPIC_API_KEY|console\.log|from .public\.arguments|insert.*public\.arguments` returned 0 hits. No `any` suppression, no `.skip` / `.only` / `xit`.

## Design conformance

- [x] All design file-changes are present (`src/features/rulesUx/lifecycleUxMap.ts`, `__tests__/lifecycleUxMap.test.ts`, plus `docs/designs/RULE-003.md` and a small entry to `docs/core/current-status.md`).
- [x] No undocumented file-changes. `git diff main..HEAD --stat` shows exactly 4 files: 1 design doc, 1 status note, 1 source, 1 test. No `package.json` / `package-lock.json` / `app/` / `supabase/` / `.env*` touched.
- [x] Data model matches design. Three `Readonly<Record<Union, Entry>>` maps with the exact entry shape the design specifies. `LIFECYCLE_UX_MAP` (19), `MANUAL_TAG_UX_MAP` (10), `AUTO_METADATA_UX_MAP` (16) = 45 entries total.
- [x] `IconHint` is the 24-value union from the design. Verdict glyphs excluded.
- [x] `DockAction` is `type DockAction = TimelineNodeActionDockActionCode` — `import type` alias of SC-004's union, NOT a redefined union (confirmed in `src/features/arguments/timelineNodeActionDockModel.ts:94-111`).
- [x] Readers return the frozen map entry by direct `Record` lookup — no fallback, no null branch.
- [x] API contracts match design: `LIFECYCLE_UX_MAP`, `MANUAL_TAG_UX_MAP`, `AUTO_METADATA_UX_MAP`, `ALL_ICON_HINTS`, `getLifecycleUx`, `getManualTagUx`, `getAutoMetadataUx`, `IconHint`, `DockAction`, `LifecycleUxEntry`, `ManualTagUxEntry`, `AutoMetadataUxEntry` all exported with the design's shapes.

## Doctrine self-check (all ✓)

- [x] **No truth/winner/loser language in user-facing strings.** Helper lines describe move structure / cluster state ("A reply was posted under this move.", "An admin or synthesis closed this cluster."), never verdicts. Ban-list scan iterates `_forbiddenLifecycleTokens()` ∪ `_forbiddenMetadataTokens()` and refuses any match across 45 labels and 45 helper lines.
- [x] **Score never blocks posting.** No score-anywhere — RULE-003 is a UX-copy map.
- [x] **No service-role in client code.** No Supabase client, no env reads, no network.
- [x] **No direct insert into public.arguments.** No DB at all.
- [x] **No AI calls in production app paths.** Pure constants.
- [x] **Plain language only (no raw internal codes in UI strings).** The snake_case scan (`/[a-z]+_[a-z]+/`) and the `looksLikeInternalCode` scan both pass across every helper line. Labels are sourced from `PLAIN_LANGUAGE_COPY` via the typed helpers — no fresh authoring.
- [x] **Epic-specific doctrine (cdiscourse-doctrine + accessibility-targets + timeline-grammar):**
  - **cdiscourse-doctrine §1 (score is gameplay analysis, never truth):** ban-list scan covers `winner`, `loser`, `correct`, `incorrect`, `true`, `false`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `right`, `wrong`, `validated`, `verdict`, `proof`, `proven`, `disproven`, `lost`, `defeated`, `won`. All 45 + 45 strings pass.
  - **cdiscourse-doctrine §2 (heat = activity):** dedicated test asserts NONE of `hot`, `viral`, `popular`, `trending`, `engagement` appear in any helper line. The `GALLERY_SECTIONS` carveout (heat = activity is OK there) is intentionally NOT extended to RULE-003 helper lines — the test comment documents this nuance. The shared `_forbidden*Tokens()` helpers correctly OMIT `hot` (because of the gallery carveout), and RULE-003's local heat-token scan adds `hot` back at the helper-line layer where it would imply correctness. This is exactly the layering the design specified.
  - **cdiscourse-doctrine §3 (popularity is not evidence):** ban-list includes `likes`, `retweets`, `shares`, `views`, `followers`, `verified`, `engagement`, `amplification`, `trending`, `virality`, `popular`, `viral` — all scanned, all clean.
  - **cdiscourse-doctrine §4 (AI moderator limits):** zero AI calls; this is pure data.
  - **cdiscourse-doctrine §5 (engine sacred):** no import from `src/lib/constitution/engine.ts`.
  - **cdiscourse-doctrine §6 (secrets policy):** no env reads, no keys.
  - **cdiscourse-doctrine §7 (no AI from production app):** N/A — pure constants.
  - **cdiscourse-doctrine §8 (Supabase conventions):** no DB.
  - **cdiscourse-doctrine §9 (plain language for users):** every `label` flows through `PLAIN_LANGUAGE_COPY`; ban-list + snake_case + `looksLikeInternalCode` scans guard against drift.
  - **cdiscourse-doctrine §10 (v1 scope):** no voting / collab edit / push / search.
  - **timeline-grammar (no truth labels on nodes):** `IconHint` deliberately excludes `checkmark`, `x_mark`, `cross`, `crown`, `trophy`, `flame`, `thumbs_up`, `thumbs_down`, `shield`, `warning`, `star`, `medal`, `gavel` — verified by `ALL_ICON_HINTS contains no verdict glyph names`.
  - **accessibility-targets (≤ 80-char helper line):** `every helperLine.length <= 80` runs across all 45 helper lines. Pass.
  - **person-attribution (design edge case #7):** scan refuses `you `, ` your `, ` they `, ` their `, ` he `, ` she `, `the user`, `the author`, `the poster`. The `conceded` helper was rewritten from the design's "The author conceded the broad point." to "The broad point was conceded on this cluster." to comply. This is a legitimate doctrine-tightening at implementation time, not a slip — the new wording passes the scan AND is semantically equivalent (passive voice over the cluster, not the person).

## Test coverage

- [x] **New public functions have unit tests.** All three readers (`getLifecycleUx`, `getManualTagUx`, `getAutoMetadataUx`) have reference-equality tests against the frozen entries.
- [x] **User-facing strings have ban-list assertion.** Three ban-list tests, two against helper lines (one with lifecycle bans, one with metadata bans) and one against labels (union of both). All use `_forbiddenLifecycleTokens()` and `_forbiddenMetadataTokens()` imported from the source-of-truth lifecycle / metadata modules — NOT a redefined inline ban-list. This is exactly the "ban-lists must consume the helpers, not redefine them" requirement.
- [x] **Edge cases from design § "Edge cases" have tests:**
  - Future code added without entry → caught by `Readonly<Record<Union, Entry>>` typing + coverage test.
  - Verdict-shaped icon hint → caught by `ALL_ICON_HINTS contains no verdict glyph names` (scans 14 banned glyph names).
  - Helper line > 80 chars → caught by length-cap test.
  - Snake_case leak in helper → caught by `/[a-z]+_[a-z]+/` + `looksLikeInternalCode`.
  - Person-attribution → caught by 9-token literal scan.
  - Heat/popularity leak → caught by 5-token literal scan (`hot`, `viral`, `popular`, `trending`, `engagement`).
  - `allowedDockActions: []` for `archived_or_resolved` → verified explicitly.
  - At-least-one entry with ≥ 3 actions → verified (proves non-empty path).
  - No duplicate code in `allowedDockActions[]` → verified.
  - `expand_branch` / `mark_moved_on` / `mark_ignored` excluded → verified.
- [x] **Accessibility assertions present (≤ 80-char a11y / tooltip budget).** Covered.
- [x] **Cross-map label reuse for shared codes** (`quote_requested`, `source_requested`) — verified. The design also mentioned `synthesis_ready` as shared, but the test comment correctly notes that `synthesis_ready` is lifecycle-only and the auto-metadata counterpart is `synthesis_candidate` (different observation, different icon, different helper). The test asserts only the codes that are truly shared. This is a correct refinement, not a doctrine slip.
- [x] **Freeze invariants** — `Object.isFrozen` checks on every entry + the top-level map for all three maps.

## Spot checks against reviewer-supplied checkpoints

1. **Label parity (anti-drift):** verified — 3 dedicated tests iterate `ALL_POINT_LIFECYCLE_STATES` / `ALL_MANUAL_TAG_CODES` / `ALL_AUTO_METADATA_CODES` and assert `<map>[code].label === get<X>PlainLabel(code)`.
2. **Shared ban-list helpers, not inline:** verified — test file imports `_forbiddenLifecycleTokens` from `src/features/lifecycle` and `_forbiddenMetadataTokens` from `src/features/metadata`, both of which were updated by COPY-001 to include `right` / `wrong` / `validated`. No inline ban-list redefinition.
3. **`DockAction` alias reuses SC-004's union:** verified — `type DockAction = TimelineNodeActionDockActionCode` is an `import type` alias; SC-004's union is `'reply' | 'challenge' | 'ask_source' | 'ask_quote' | 'clarify' | 'add_evidence' | 'narrow' | 'concede' | 'confirm' | 'mark_moved_on' | 'mark_ignored' | 'branch' | 'synthesize' | 'flag' | 'open_cards_detail' | 'expand_branch'`. Test #335 explicitly excludes the three forbidden codes from every entry's `allowedDockActions[]`.
4. **`IconHint` excludes verdict glyphs:** verified — union has 24 values; none are `checkmark` / `x` / `cross` / `crown` / `flame` / `trophy` / `thumbs_up` / `thumbs_down` / `shield` / `warning` / `star` / `medal` / `gavel`. Banned-glyph test enumerates 14 banned names.
5. **`conceded` helper rewritten from design:** verified — the design said "The author conceded the broad point." (person-attribution); the implementation says "The broad point was conceded on this cluster." (passive, cluster-scoped). The person-attribution scan now passes. Legitimate design-time tightening.
6. **`synthesis_candidate` vs `synthesis_ready`:** verified — auto-metadata uses `synthesis_candidate` (with icon `spark`, helper "This move sits at a point where a summary would land."); lifecycle uses `synthesis_ready` (with icon `eye`, helper "The two sides have converged enough to summarise."). The cross-map test correctly tests only `quote_requested` + `source_requested` and explicitly comments why `synthesis_ready` is NOT shared.
7. **≤ 80-char helper cap:** verified by dedicated test.
8. **Empty + multi-action examples:** `archived_or_resolved` has `[]`; `open` has 5 actions. Both verified.
9. **No console.log / no `any`:** verified — Grep returned 0 hits in the new source/test files.
10. **No dependency change:** verified — `git diff main..HEAD -- package.json package-lock.json` returned empty.

## Heat-token nuance verified

The reviewer flagged that `hot` must:
- Be banned in RULE-003 helper lines (the new local scan), AND
- Still NOT appear in the shared `_forbiddenLifecycleTokens()` / `_forbiddenMetadataTokens()` helpers (because of the COPY-001 audit §5.1 + §8 carveout for `GALLERY_SECTIONS`).

Both are true. The shared helpers explicitly comment `'hot' is deliberately NOT in this list — doctrine §2 carves out a legitimate "hot = activity" usage in GALLERY_SECTIONS`. RULE-003's test adds `'hot'` to its own local heat-token scan (`['hot', 'viral', 'popular', 'trending', 'engagement']`) so the helper-line layer remains correctness-clean without disturbing the gallery layer.

## Worktree state note

Two untracked files exist in `docs/testing-runs/`:
- `2026-05-19-ai-driven-bot-corpus-dry.md`
- `2026-05-19-engagement-epidemiology-synthetic.md`

These are run-artifact outputs generated by the engagement-intelligence test suites (operator-gated baseline) and follow the existing date-stamped pattern of unrelated corpus runs in that directory. They are unrelated to RULE-003 and were correctly left out of the commit. They do not need to be tracked; they regenerate on every test run.

## Blockers

None.

## Suggestions (non-blocking)

1. (Defer to v1.1 if a SC-004 / RULE-003 drift is observed) Consider adding a follow-up test that asserts `LIFECYCLE_UX_MAP[state].allowedDockActions` is a SUPERSET of SC-004's `LIFECYCLE_PRIMARY_ACTION_TABLE[state].primary + .fallback`. The design's "Risks" section already calls this out as a v1.1 spot-check — no action required in this card.
2. (Stylistic, non-blocking) The cross-map sanity test currently asserts label equality for `quote_requested` + `source_requested` only. If META-001 ever adds another truly shared code (i.e., the same string key appears in both `ALL_POINT_LIFECYCLE_STATES` and `ALL_AUTO_METADATA_CODES`), the test would not auto-detect it. A future hardening could iterate the intersection of the two unions at runtime. Not required — current coverage is correct for today's vocabulary.

## Operator next steps

- Push the branch: `git push -u origin feat/RULE-003-lifecycle-to-ux-doctrine-map`
- Open PR: `gh pr create --title "RULE-003: Lifecycle/manual-tag/auto-metadata UX doctrine map" --body-file docs/reviews/RULE-003.md`
- No deploy steps. No migration. No Edge Function. No env var. No secret. Pure local code change.
- After merge, `docs/core/current-status.md` already carries the RULE-003 entry; bump CLAUDE.md's "Current stage" line only when the wave (RULE-003 + SC-003 + ST-002 + GAL-002 + IX-002) lands as a stage rollup.
