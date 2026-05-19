# COMPOSER-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-18
**Branch:** `worktree-agent-abce4939621571956` (operator will rename to `feat/COMPOSER-001-wire-preset-prefill` before push)
**Spec:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\COMPOSER-001.md` (no design doc — issue body is the spec; roadmap-implementer-direct was correct given EV-002 + SC-004 already shipped the seam shape)
**Related designs:** `docs/designs/SC-004.md` (§"Composer preset contract"), `docs/designs/EV-002.md`

## Summary

A clean two-file seam-wiring patch that closes the SC-004 review's only material follow-up. SC-004 shipped `actionDockToComposerPreset(action, target, parentType)` returning the right `MoveDraftPatch` for `narrow` / `confirm` / `synthesize`, but `ArgumentGameSurface.handleActionDockAction` discarded the patch and routed every fall-through case through `handleAction('reply', ...)`, which then triggered `FullRoomGameSurfaceMount.handleAction` to compute a `presetLabel='reply'` (null) and clobber any preset the dock had chosen. Net effect: the dock advertised a one-click playable move but the user landed in a blank composer. This card threads the patch through an additive optional third argument on the `onAction` prop, so the room shell can hand the dock-resolved preset verbatim to `onComposerPreset` before opening the composer. Every doctrine guardrail (SC-004 frozen surfaces, EV-002 fallback, no new dependency, no new preset bodies, no new `QuickActionLabel` codes, no service-role, no migration, no Edge Function, no AI call, no `.env*` change) is intact. EV-002's existing prefill path is preserved untouched for any non-dock dispatch.

## Verification

- typecheck: **pass** (clean, no output)
- lint: **pass** (clean, no output)
- test: **3071 → 3136 tests / 113 → 114 suites** (+65 tests, +1 suite — exactly matches the implementer report and the coordinator-verified baseline)
- secret scan: **clean** — no `ANTHROPIC_API_KEY` / `XAI_API_KEY` / `X_BEARER_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY` / `sb_secret_` / `sk-ant-` / `Bearer ` / `Authorization:` / JWT-shape literal in the diff
- doctrine scan: **clean** — the two `winner` / `loser` / `liar` etc. hits are inside the new test's `BANNED` array constant (`__tests__/argumentGameSurfaceDockComposerWiring.test.ts:229-233`) used as the input to `expect(body.toLowerCase()).not.toContain(token)` — expected false-positive
- service-role scan: **clean** — no `SERVICE_ROLE` / `supabase.from(` / `fetch(` in any diff under `src/**`
- direct-insert scan: **clean** — no `from('arguments').insert` / `insert.*public.arguments` in the diff (one match in the diff was a comment phrase already present on `main`)
- forbidden-paths scan: **clean** — no `supabase/migrations/`, no `supabase/functions/`, no `.env*` change
- console.log scan: **clean** — zero new `console.log` statements
- env-isolation context: worktree had `.env`, `.env.engagement-intelligence`, and `logs/engagement-intelligence/` already present (coordinator pre-arranged), so all 3136 tests passed without the env-gated false-failures seen on a vanilla worktree

## Design / spec conformance

- [x] All acceptance-criteria file-changes are present (2 source files + 1 new test file)
- [x] No undocumented file-changes (the `agentIssueRunner.js` chore and 2 docs files are called out in the implementer report)
- [x] `actionDockToComposerPreset(action, target, parentType)` shape matches SC-004 design verbatim — `parentType` resolved from `sorted.find((m) => m.id === targetMessageId)?.argumentType ?? null`
- [x] Composer preset is applied via the EV-002 seam (`onComposerPreset(preset)` BEFORE `onReply(messageId, arg)`)
- [x] User-edit doctrine preserved: `initialPatch` is applied once on composer mount (existing Stage 6.2 M7 reference-equality `useEffect`); user typing thereafter wins

### `confirm` argumentType note

The SC-004 design's §"Composer preset contract" round-trip table (`docs/designs/SC-004.md:634`) lists `confirm` as `{ argumentType: 'confirmation', body: CONFIRM_PRESET_BODY }`. The shipped SC-004 implementation in `quickActionPresets.ts:162-172` intentionally leaves `argumentType` unset (the comment at lines 163-169 explains the constitution's `ArgumentType` union does not have a dedicated `confirmation` value — LIFE-001 detects confirmations from `kindLabel` + `pure_accept` qualifier instead). The new test on line 86-93 of `argumentGameSurfaceDockComposerWiring.test.ts` correctly asserts `expect(patch!.argumentType).toBeUndefined()` — i.e. it tests the actual frozen SC-004 behaviour, not the design-table prose. **This is consistent and approved.** The design-vs-implementation drift on the literal `'confirmation'` string is SC-004's pre-existing decision; COMPOSER-001 is not responsible for it and correctly does not re-litigate it.

## Doctrine self-check

- [x] No truth / winner / loser / person-attribution copy added to UI strings or preset bodies — the ban-list block in `argumentGameSurfaceDockComposerWiring.test.ts:225-243` re-asserts on each of the three SC-004 bodies
- [x] Score never blocks posting — N/A (no scoring change)
- [x] No service-role in client code (`src/` / `app/` diff scanned, zero hits)
- [x] No direct insert into `public.arguments` (the only diff line that mentions the table is a preserved doctrine comment in `ArgumentGameSurface.tsx:332` that says `// Never inserts directly into public.arguments`)
- [x] No AI calls in production app paths — no `fetch(`, no Anthropic/xAI/X client import added
- [x] Plain-language only — no new user-facing copy added; no raw `snake_case` codes leak
- [x] Epic-specific doctrine (cite skill):
  - `timeline-grammar`: the dock dispatch surface still produces ArgumentBubbleControl events; node shape / strength encoding untouched
  - `cdiscourse-doctrine §1 / §4 / §6 / §7`: scoring/truth/AI/secrets all intact
  - `test-discipline`: +65 tests for a +2-file seam patch; ratio is generous and covers the contract, the source-scan, the EV-002 regression, and the ban-list
- [x] `quickActionPresets.ts` zero-diff (SC-004's preset bodies untouched)
- [x] `timelineNodeActionDockModel.ts` zero-diff (SC-004 model untouched)
- [x] `gameCopy.ts` zero-diff
- [x] `TimelineNodeActionDock.tsx` zero-diff
- [x] No new `QuickActionLabel` codes; no new preset body constants
- [x] No new dependency (`git diff --name-only origin/main..HEAD | grep package` returns nothing)

## Frozen-surface check

Verified `git diff --name-only origin/main..HEAD` is exactly:

```
__tests__/argumentGameSurfaceDockComposerWiring.test.ts    (NEW)
__tests__/timelineNodeActionDockSelectionExclusion.test.ts (regex-only)
docs/current-status.md                                     (docs)
docs/ux-ui-project-board.md                                (docs)
scripts/github/agentIssueRunner.js                         (single prefix add)
src/features/arguments/ArgumentGameSurface.tsx             (seam wiring)
src/features/arguments/ArgumentTreeScreen.tsx              (seam wiring)
```

All other frozen surfaces are zero-diff: `quickActionPresets.ts`, `timelineNodeActionDockModel.ts`, `TimelineNodeActionDock.tsx`, `gameCopy.ts`, `ArgumentReplySidecar.tsx`, `ArgumentComposer.tsx`, `ArgumentTimelineMap.tsx`, `timelineNodePopoverModel.ts`, `TimelineNodePopover.tsx`, `branchTopologyModel.ts`, `argumentGameSurfaceModel.ts`, `GradientWaveRail.tsx`, `railSegmentModel.ts`, everything under `src/features/lifecycle/`, `src/features/metadata/`, `src/features/evidence/`. Confirmed via direct `git diff` against the listed paths.

## Preset-body byte-identity check

Verified verbatim against `src/features/arguments/quickActionPresets.ts` lines 48-64:

- `NARROW_PRESET_BODY` = `"I'd narrow this to: [the part I still accept]. Where I'd push back is: [the more limited scope]."` — **identical** to spec.
- `CONFIRM_PRESET_BODY` = `"I accept this narrowed point. Moving on with the rest of the claim."` — **identical** to spec.
- `SYNTHESIZE_PRESET_BODY` = `"Synthesis: where I think we landed is — [shared point]. Open questions still on the table: [list]."` — **identical** to spec.

The file `quickActionPresets.ts` is zero-diff vs `origin/main`, confirming the strings were not redefined by this card. All three bodies pass the COMPOSER-001 14-token ban-list (`__tests__/argumentGameSurfaceDockComposerWiring.test.ts:229-243`).

## Composer-prefill seam location verification

End-to-end trace verified:

1. **`src/features/arguments/ArgumentGameSurface.tsx:340-405`** — `handleActionDockAction`:
   - Line 353: `const targetMsg = sorted.find((m) => m.id === targetMessageId) || null;`
   - Line 354: `const parentType = (targetMsg?.argumentType ?? null) as ArgumentType | null;`
   - Line 355: `const preset = actionDockToComposerPreset(action, target, parentType);`
   - Line 379: `reply` → `handleAction('reply', targetMessageId, null)` (explicit null, clears any stale preset)
   - Lines 382, 386, 390: `challenge` / `ask_source` / `ask_quote` → `handleAction(<bubble-control>, targetMessageId, preset)`
   - Line 394: `branch` → `handleAction('branch', targetMessageId, null)` (no preset for branch)
   - Line 405: fall-through (`narrow` / `concede` / `confirm` / `synthesize` / `clarify` / `add_evidence`) → `handleAction('reply', targetMessageId, preset)`

2. **`src/features/arguments/ArgumentGameSurface.tsx:316-325`** — `handleAction`:
   - Forwards the preset via `onAction?.(control, messageId, preset)` (line 322)

3. **`src/features/arguments/ArgumentTreeScreen.tsx:296-336`** — `FullRoomGameSurfaceMount.handleAction`:
   - Line 299: accepts `explicitPreset?: MoveDraftPatch | null`
   - Lines 320-330: `const preset = explicitPreset !== undefined ? explicitPreset : (() => { ... return quickActionToPreset(presetLabel, arg.argumentType); })();`
   - Line 331: `onComposerPreset(preset);` — fires BEFORE `onReply(messageId, arg)` on line 333

4. **`App.tsx`** — zero-diff. The existing `onComposerPreset={setComposerPreset}` → `<ArgumentComposer initialPatch={composerPreset} />` wiring from EV-002 / Stage 6.2 M7 is reused.

The key correctness detail: `explicitPreset !== undefined` (not `!= null`) — so a `null` explicit preset from `reply` / `branch` is preserved as "force clear", not "fall back to EV-002". Reviewed and verified correct.

## EV-002 regression status

Verified the EV-002 prefill path remains intact:

- The arrow IIFE in `ArgumentTreeScreen.tsx:322-330` preserves the original `presetLabel = control === 'disagree' ? 'challenge' : ...` mapping and calls `quickActionToPreset(presetLabel, arg.argumentType)` verbatim.
- 3 explicit tests in `argumentGameSurfaceDockComposerWiring.test.ts:103-131` assert `ask_source`, `ask_quote`, and `weak_source` still produce their EV-002 patches (`ASK_SOURCE_PRESET_BODY`, `ASK_QUOTE_PRESET_BODY`, `ASK_STRONGER_SOURCE_PRESET_BODY`).
- The pre-existing `__tests__/sourceChainPresetWiring.test.ts` suite (passing in the run output) continues to lock the EV-002 contract directly.

## `agentIssueRunner.js` single-line change verification

Diff is exactly one line, only adds the `'COMPOSER'` entry to `ROADMAP_PREFIXES`:

```diff
-const ROADMAP_PREFIXES = ['QOL', 'TL', 'VG', 'BR', 'SC', 'ST', 'EV', 'SW', 'IX', 'PR', 'HOST', 'GAL', 'RULE', 'AN', 'PM', 'LIFE', 'META', 'GAME', 'BRAND', 'COPY', 'HIST', 'NAV', 'LEG', 'A11Y'];
+const ROADMAP_PREFIXES = ['QOL', 'TL', 'VG', 'BR', 'SC', 'ST', 'EV', 'SW', 'IX', 'PR', 'HOST', 'GAL', 'RULE', 'AN', 'PM', 'LIFE', 'META', 'GAME', 'BRAND', 'COPY', 'HIST', 'NAV', 'LEG', 'A11Y', 'COMPOSER'];
```

No other change to the file. Manually ran `node scripts/github/agentIssueRunner.js queue` and confirmed issue #84 COMPOSER-001 now appears in the open queue (`84  COMPOSER-001  p2   6.6   s    COMPOSER-001 - Wire SC-004 narrow/confirm/synthesize preset bodies into composer prefill`).

## `timelineNodeActionDockSelectionExclusion.test.ts` regex change verification

The regex update at line 73 widens the dependency-array match from `\[handleAction\]` to `\[handleAction(?:, sorted)?\]`. The three doctrine assertions on lines 76-78 (`router.push`, `router.navigate`, `Linking.openURL` are absent) are **unchanged and still enforced** against the captured function body. The other four mutual-exclusion tests in the file are untouched. Non-semantic test-only adjustment — approved.

## Test coverage check

- [x] All three preset wirings have dedicated assertions (narrow / confirm / synthesize)
- [x] EV-002 regression (`ask_source` / `ask_quote` / `weak_source`) is explicitly covered
- [x] Non-preset null-patch coverage for `reply` / `branch` / `flag` / `mark_moved_on` / `mark_ignored` / `open_cards_detail` / `expand_branch`
- [x] Source-scan assertions on `ArgumentGameSurface.tsx` lock the threading contract (6 scan tests)
- [x] Source-scan assertions on `ArgumentTreeScreen.tsx` lock the `explicitPreset !== undefined` preference (4 scan tests)
- [x] 42-token ban-list regression on the SC-004 preset bodies
- [x] No `accessibilityLabel` assertion in this test file — acceptable because COMPOSER-001 does not add new UI; the composer surface (`ArgumentComposer.tsx`) is zero-diff and its existing accessibility coverage is unchanged. SC-004's accessibility tests on the dock itself remain in `__tests__/timelineNodeActionDockModel.test.ts` and are unaffected.

## Blockers

None.

## Suggestions (non-blocking)

1. **`docs/current-status.md` test count drift** — the entry says `"3117 tests / 114 suites passing (+65, baseline 3052 / 113 measured locally; pre-existing 19 xAI/anthropic env-file failures persist on main 03f91d6 and are unrelated)"`. The actual coordinator-verified and reviewer-verified count is **3136 / 114** when the worktree has `.env.engagement-intelligence` and `logs/engagement-intelligence/`. The implementer wrote the entry from a vanilla-worktree measurement (3117 = 3136 minus 19 env-gated failures-as-failed-but-not-counted-passing?). Not blocking — the docs entry's other facts are accurate — but the operator may want a one-line patch to read `3071 → 3136 / 113 → 114 (+65)` before merging to keep the project's `CLAUDE.md` count line trackable. (Could be folded into the next stage-completion update.)
2. **Implementer-report branch name** — the spawn-card.ps1 left the worktree on the auto-generated branch `worktree-agent-abce4939621571956` instead of the conventional `feat/COMPOSER-001-…` slug. Cosmetic only; operator can rename via `git branch -m feat/COMPOSER-001-wire-preset-prefill` before push.
3. **Future-proofing** the dispatch path: `ArgumentGameSurface.handleActionDockAction` now has both `actionDockToComposerPreset` (line 355) and the existing `handleAction(...)` per-action branches. ST-002 (Cards-detail suggested-reply flags) will land another consumer of the same seam. A small follow-up could thin the per-action `handleAction` mapping into a single table, but that's a refactor and out of scope here.

## Operator next steps

1. **Rename branch (optional)**: from inside the worktree, `git branch -m feat/COMPOSER-001-wire-preset-prefill`.
2. **Push the branch**: `git push -u origin feat/COMPOSER-001-wire-preset-prefill` (from the worktree, not the main checkout).
3. **Open PR**: `gh pr create --title "COMPOSER-001: Wire SC-004 narrow/confirm/synthesize preset bodies into composer prefill" --body-file docs/reviews/COMPOSER-001.md`.
4. **No deploy steps** — pure UI seam-wiring patch. No migration. No Edge Function. No `.env*` change. No client AI call. No service-role.
5. **After merge**: bump the `CLAUDE.md` "Current stage" test count line from `1805` (Stage 6.4) to whatever the next stage-completion gathers; COMPOSER-001 itself is part of the in-flight Release 6.6 wave and does not need its own stage-completion line.
