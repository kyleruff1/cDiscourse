# REF-006-RAIL — Review

**Verdict:** Approve
**UI-only risk classification:** **YES — UI-only** (evidence below). Automerge-eligible per the card's posture; all gates green.
**Reviewer agent run:** 2026-06-12
**Branch:** feat/REF-006-RAIL-open-issues-rail-for-the-disagr
**Range reviewed:** `b709b6a..8fab9d8` (4 commits)
**Design:** docs/designs/REF-006-RAIL.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/599 (#599)

## Summary

REF-006-RAIL ships the room-wide **Open Issues rail** as pure UI composition over the
already-shipped per-node Disagreement Contract derivation. A new pure iterator
(`openIssuesRailModel.ts`) filters → orders → caps → shapes `OpenIssue` objects that the
**host** builds via REF-002's `buildOpenIssue` (single derivation home); a new
collapsed-by-default panel (`OpenIssuesRail.tsx`) renders them with jump / Inspect / next-move
affordances that route through the shipped loop mechanics. The host change is a faithful
composition plus an O(1) de-quadratic refactor (`messageById`/`nodeByMessageId` maps) and an
extracted assembly closure that is byte-equivalent for the active node. No persistence, no
migration, no Edge, no provider/AI, no submit-path change, no service-role, no new routing.
The doctrine surface is tight and test-proven: procedural-only ordering, frozen plain-language
copy, zero raw codes, zero `userAllegations`, full a11y. Every gate is green and the test count
moves up. **Nothing blocking; nothing changes-requested. Approve.**

## UI-only risk classification — evidence

| Risk surface | Touched? | Evidence |
|---|---|---|
| Persistence / DB column / migration | No | No `supabase/migrations/**` in diff; `--name-only` out-of-scope grep empty. Design §"Data model": "No new persisted data model. No migration. No DB column." |
| `supabase/**` / Edge Functions | No | Zero files under `supabase/**`. |
| `mcp-server/**` / MCP deploy-bearing | No | Zero files under `mcp-server/**`. |
| Providers / AI calls | No | Model purity test scans source: no `fetch(`, no `XMLHttpRequest`, no Anthropic/xAI. Display-only over already-derived state. |
| Routing | No (reuse only) | Handlers reuse pre-existing `setActiveMessageId`/`setGoLens`/`setInspectVisible`/`enterBoxForActEntry` (all present on `b709b6a`); `enterBoxForActEntry` generalized with optional args, existing call sites byte-identical. |
| Auth / secrets | No | Secret scan clean (only test-assertion + status-doc-prose hits); `SERVICE_ROLE`/`ANTHROPIC_API_KEY` grep over `src/**` empty. |
| Submit acceptance | No | Rail is consultative, post-storage; move chips are engine+role survivors (REF-002 `nextBestMoves`) — can never open a box the engine rejects, never in any post path. |
| Public sensitive-allegation visibility | No | Rail renders zero `userAllegations`; Family J re-asserted out upstream by REF-002 and never read here. |

All 11 changed files are `src/features/arguments/**` (3 new + 1 modified host) + `__tests__/**` (6)
+ `docs/core/current-status.md`. Conclusion: **UI-only → automerge-eligible**.

## Verification (measured this run)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **pass** (exit 0) |
| scoped `eslint` (openIssuesRail/ + ArgumentGameSurface.tsx) | **pass** (exit 0) |
| targeted `npx jest openIssuesRail OpenIssuesRail` | **pass** — 5 suites / 114 tests, exit 0 |
| FULL `npx jest --silent` | **pass** — **738 suites / 30156 passed + 1 skipped (30157 total), exit 0** |
| anchor suites (REF-002/003/004, actPopoutModel, goPopoutModel, uxOneOneTwoDoctrine, boardActPopoutMountSite, refereeLoopForbiddenImports) | **pass** — 13 suites / 467 tests, exit 0 |
| secret scan | **clean** (only `expect(src.includes('ANTHROPIC_API_KEY')).toBe(false)` test lines + status-doc prose) |
| doctrine scan (winner/loser/truth; service-role; direct insert `public.arguments`) | **clean** |

Test count: baseline 733 / 30042 → **738 / 30156** (+5 suites / +114 tests). **Non-decreasing.**
1 skip is pre-existing (unchanged from baseline). No documented wall-clock flake fired (full run 23.5 s).

## Design conformance

- [x] All design file-changes present (3 new src + 1 modified host + tests + status), exactly the 11 expected files.
- [x] No undocumented file-changes (out-of-scope dir grep empty).
- [x] Data model matches design (derived-only in-memory shapes; no persistence).
- [x] API contracts match design (`isOpenIssue`, `ledgerRank`, `compareLedgerCandidates`, `buildOpenIssuesLedger`, `OPEN_ISSUES_RAIL_COPY`, `RAIL_PROPOSITION_CAP`, props shape all as specified).

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — ban-list test scans `OPEN_ISSUES_RAIL_COPY` + every REF-002 atom + a full sample-entry spread against the exact 16-token list.
- [x] Score never blocks posting — rail is post-storage, display-only; no submit path touched.
- [x] No service-role in client code — grep over `src/**` empty.
- [x] No direct insert into `public.arguments` — scan empty.
- [x] No AI calls in production app paths — model purity test bans `fetch`/`XMLHttpRequest`/`Date.now`; no provider import.
- [x] Plain language only — `displaySafe` suppresses anything tripping `looksLikeInternalCode`; no-raw-codes test renders the real tree and asserts no leaf text / a11y label carries `issue.id`/`sourceCode`/raw relation tokens.
- [x] Epic-specific (cdiscourse-doctrine §3 + timeline-grammar): **ordering reads only procedural fields.** `ledgerRank` reads `issue.burden`/`issue.state`; tiebreak reads `recencyIndex`/`issue.id`. A member-access source scan in `openIssuesRailModel.test.ts` bans `.heat/.popularity/.virality/.score/.standingBand/...`, and a shuffle-determinism test proves order stability. Confirmed real (read the test, exit 0).
- [x] §10a Observations vs Allegations — rail renders zero `userAllegations`; tone glyph is a non-color shape hidden from the SR tree.

## Per-checklist findings (with evidence)

**a. Host diff (`ArgumentGameSurface.tsx` +478/−129).** Clean. O(1) `messageById`/`nodeByMessageId`
maps replace the O(n) `sorted.find`/`timelineMap.nodes.find` in `activeParentType` and the active
memo — behavior-identical for unique keys (find→first, Map.get→last; ids are unique). The candidate
memo (`openIssueCandidates`) dependency array is `[timelineMap, evidenceDebts, lifecycleMap,
manualTagsByMessageId, metadataLedger, recencyIndexById, assembleRefereeCardInputForMessage]` —
**excludes `activeMessageId`** (the performance contract holds); `assembleRefereeCardInputForMessage`
likewise excludes `activeMessageId`. The **−129 lines are fully accounted for**: the old inline
`refereeCardIssue` gathering body was *extracted* (not deleted) into the shared closure; `refereeCardIssue`
now calls `assembleRefereeCardInputForMessage(activeMessageId, refereeBanner ?? null)`. For the active node
`parentType: parentTypeForMessage(messageId)` computes identically to the prior `activeParentType` (same
node→parent→argumentType chain). No submit/scoring/observation-loading change. Regression gate (REF-003/004
mount suites) green. No removal beyond the specified map-refactor + extraction.

**b. Derivation containment.** The iterator only filters/orders/caps/shapes; purity test bans
`buildOpenIssue(`/`buildActPopout(`/`selectBanner(`/`deriveSuggestedMoves(`/`adaptAllSourcesForNode(`
call syntax in the model source (exit 0). `refereeLoop/**` and `refereeBanners/**` are **zero-diff**
(name-only grep empty); the panel only *reads* `BANNER_TONE_GLYPH_CHAR` (a glyph-char map), never mounts a banner.

**c. Ordering doctrine.** `ledgerRank` + `compareLedgerCandidates` read only procedural fields
(`openIssuesRailModel.ts:269-292`). The member-access source-scan (`openIssuesRailModel.test.ts:480-484`)
genuinely reads the file and asserts the engagement-field regex never matches. Shuffle-determinism test
(`:183-200`) is real (3 permutations → identical `issue.id` ordering).

**d. The two surfaced deviations — both honest.**
(1) Pre-filter constants (`CLOSED_LIFECYCLE_STATES`, `CANDIDATE_SIGNAL_TAGS`, `OPEN_ISSUES_RAIL_BUILD_CAP`)
live in the model and are **imported** by the host (diff lines 25-33). Verified load-bearing: `evidence_debt`
and `synthesis_ready` appear in BOTH the model's frozen sets AND the `uxOneOneTwoDoctrine.test.ts`
`INTERNAL_CODES` scan list (`:134-144`), and that test scans `ArgumentGameSurface.tsx` (`:32`). Had the host
inlined those code literals, the guard would fire; importing the named constant keeps the host clean. The
guard still passed (anchor run, exit 0) and still meaningfully scans the host. Honest.
(2) Extra fixtures helper `__tests__/fixtures/openIssuesRailFixtures.ts` — no `.test.` suffix, mirrors the
`openIssueFixtures.ts` factory pattern, fully typed; no `.skip`/`.only`. Fine per precedent.

**e. Raw-code containment + copy.** Ban-list + no-raw-codes tests render the real component, collect every
leaf string + every `accessibilityLabel`, and assert clean. Default UI uses frozen `OPEN_ISSUES_RAIL_COPY`
+ REF-002 atoms; Inspect is the only raw-detail handoff (opens the shipped `InspectOpenIssueDetail` overlay).
Empty state teaches ("No open issues right now." + "When a point needs a source, a quote, a reply, or is ready
to wrap up, it shows up here.").

**f. Mount + a11y.** Collapsed-by-default (`defaultCollapsed ?? true`), entry-count badge ("Open issues · N ▾"),
active row distinguished by geometry (left accent bar + bold/underline + "Currently active" word) — color-independent.
Every interactive element has role=button, populated label, `accessibilityState` (`expanded` chip / `selected` row /
`disabled:false` move), and ≥44px via `TOUCH_TARGET.minSizePx` + `hitSlop`. Glyph hidden from the SR tree.
Reduce-motion snaps (`progress.setValue` under `effectiveReducedMotion`). SC-005 dock chassis reuse confirmed:
panel imports `resolveObserverDockVariant`/`resolveSheetMaxHeightPx` from `ObserverActionDockLayout`. Mounted as a
sibling immediately above `<ArgumentSideActionRail>`; mutual exclusion via two-state `isAnyPanelOpen`.

**g. Routing honesty.** Jump = `handleOpenIssueFocus`, a faithful generalization of the shipped
`handleRefereeFocusIssue` (identical mechanics, arbitrary target, reads only `entry.state`). Inspect reuses the
shipped Inspect popout + `InspectOpenIssueDetail` overlay. Next-move chips are the head of `entry.nextBestMoves`
(REF-002 engine+role survivors) through the SAME `enterBoxForActEntry` bridge. No new routing, no bypass. Move
chips are siblings (not nested) of the jump zone — test proves a move press does **not** also fire jump
(`OpenIssuesRail.test.tsx:110-122`).

**h. Gates.** All green and non-decreasing (see Verification table). No `.skip`/`.only`/`xit`/`fdescribe`/`fit`
in any new test file (sweep empty). No guard loosened — `uxOneOneTwoDoctrine.test.ts` itself is untouched (not in
diff) and still green. No `console.log` in new src.

**i. Boundary + hygiene.** Exactly the 11 expected files; nothing in `supabase/**`, `mcp-server/**`, `src/domain/**`,
`refereeLoop/**`, `refereeBanners/**`, `requestReview/**`. No secrets. 4 conventional commits (feat/feat/test/docs),
all authored `Kyler`, no merge commits, no main movement. (`--no-verify` is not retroactively recorded by git; all
hook-equivalent checks — typecheck/lint/full jest — pass green now, so any pre-commit hook would pass if re-run.)
Status entry accurate, including the operator-deferred `conceded`-in-ledger flag.

## Blockers

None.

## Suggestions (non-blocking)

1. The current-status entry estimates file sizes (`~330` model / `~430` panel lines) below the actuals
   (415 / 662). Cosmetic; no action required, but worth tightening if the status line is ever cited for LOC.
2. The row jump zone sets `accessibilityLabel={`${entry.accessibilityLabel} ${jumpHint}`}` **and**
   `accessibilityHint={jumpHint}`, so the jump hint is voiced twice (once in label, once as hint). Harmless
   redundancy; a screen-reader-listening QA pass could drop the in-label copy. Defer.

## Notes for the Recruitable Demo Corridor card (what the rail gives it)

- A **room-wide orientation surface** a first-time visitor can read without learning the Constitution: the rail
  answers "what's open / what's owed / what can I do / where do I click" as a glanceable ledger, ordered by
  procedural urgency (source→quote→clarification→reply→synthesis_ready→narrowed→conceded), never by engagement.
- **Stable entry points** for a scripted demo: the collapsed chip (`open-issues-rail-toggle`), each row
  (`open-issues-rail-row-<id>`), Details (`open-issues-rail-details-<id>`), and move chips
  (`open-issues-rail-move-<id>-<actEntryId>`) are all testID-addressable and route through the shipped jump /
  Inspect / Act bridges — no new wiring needed for a guided corridor.
- The **teaching empty state** ("quiet ≠ broken") is a ready-made first-screen for a freshly-seeded demo room.
- **Operator-deferred toggles** the corridor card may want to revisit: `conceded` inclusion (one-line removable),
  oldest-owed-first ordering mode, and the display-cap defaults (8 rows / K=48 build ceiling) — all recorded in
  the design's Operator-deferred section.

## Operator next steps

- Push the branch: `git push -u origin feat/REF-006-RAIL-open-issues-rail-for-the-disagr`
- Open PR: `gh pr create --title "REF-006-RAIL: Open Issues rail for the Disagreement Contract loop" --body-file docs/reviews/REF-006-RAIL.md`
- Deploy steps: **none** — pure `src` UI change. No `db push`, no `functions deploy`, no env var, no migration. Merge is not a deploy.
- Automerge: **eligible** (UI-only + all gates green). Squash-merge once CI mirrors the local green.
- Post-merge worktree cleanup (operator step; commands in roadmap-reviewer.md § "Post-merge worktree cleanup").
