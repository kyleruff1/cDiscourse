# REF-006-RAIL — Open Issues rail for the Disagreement Contract loop

**Status:** Design draft (GATE-A artifact)
**Epic:** Sidecar Rail (Rules UX track)
**Release:** 6.7
**Priority/Effort/Lane/Risk:** P1 · M · src UI (composition only) · Medium
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/599
**Verified-at-HEAD:** `4505b2f` (every source `file:line` below re-resolved at this SHA)
**Consumes (SHIPPED):** REF-002 `openIssueModel` · REF-003 `refereeCardAssembly` + `RefereeCardView` · REF-004 `enterBoxForActEntry` / `InspectOpenIssueDetail` / `issueStateToGoLens` · REF-ADR-001 (ratified)
**Branch:** `feat/REF-006-RAIL-open-issues-rail-for-the-disagr`

This is a **UI composition** card. It builds the missing room-wide **Open Issues rail** on top of the already-shipped
per-node Disagreement Contract derivation. It writes **no derivation logic** — REF-002's `buildOpenIssue` stays the
single derivation home; the rail consumes, orders, and renders.

---

## Goal (one paragraph)

The Referee Card explains the **active** issue. Without a rail, a newcomer is trapped in node-by-node inspection — they
can read one referee note but cannot see the shape of the dispute or find the next useful move. REF-006-RAIL renders the
Disagreement Contract as a **navigable issue ledger** so a person who has never heard of CDiscourse can land in one
debate and answer five questions without learning the Constitution: *What are we arguing about? Which point is open?
What is owed? What can I do next? Where do I click?* The rail is a **pure projection** over many nodes' already-derived
`OpenIssue` objects — it adds a thin iterator that filters to the genuinely-open set, orders them by **procedural
urgency (never engagement)**, caps the list, and renders compact rows that reuse the shipped loop mechanics (Go jump +
lens, Inspect overlay, the Act/one-box bridge). The doctrine that shapes every line: the deterministic engine
(`src/domain/constitution/engine.ts`, mirrored at `supabase/functions/_shared/constitution/`) is the sole submission
gate; this surface is consultative, post-storage, display-only, and never sits in any post path. Every label is the
frozen REF-001/REF-002 plain-language set; the rail never claims truth, winner, loser, motive, or "bad faith"; it orders
by `IssueState`/`IssueBurden`, never by heat, popularity, or a strength band (cdiscourse-doctrine §1/§2/§3/§4/§5/§9/§10a;
REF-ADR-001 ratified — plain moves only, type codes never in rail copy).

---

## Central design decisions (decided with evidence)

### D1 — Multi-node derivation: a thin pure iterator over host-built issues (card option (a), CHOSEN)

`buildOpenIssue` (`src/features/refereeLoop/openIssueModel.ts:961`) is **per-node** — it returns one
`DisagreementContract` for one selected target. The rail needs the open-issue set across the room. **Decision:** add a
thin, pure iterator `buildOpenIssuesLedger(candidates, options)` in a NEW file
`src/features/arguments/openIssuesRail/openIssuesRailModel.ts`. The **host** (`ArgumentGameSurface.tsx`) builds each
candidate's `OpenIssue` by calling the shipped `buildRefereeCardInput` → `buildOpenIssue` per candidate node (REF-002
stays the single derivation home). The iterator receives the **already-built** `OpenIssue[]` plus two cheap host-supplied
facts per candidate (recency index + isActive) and only **filters → orders → caps → shapes rows**. It re-derives
nothing: it never calls `buildOpenIssue`, `buildActPopout`, `selectBanner`, `deriveSuggestedMoves`, or
`adaptAllSourcesForNode`.

Rejected alternative (extending `refereeLoop/` with a room-level builder): it would either pull the room's
message/lifecycle/debt maps into the pure `refereeLoop/` module (breaking its "types-only, no surface coupling" boundary
that `refereeLoopForbiddenImports.test.ts` pins) or duplicate the host's per-node data gathering. The card's mandate is
explicit — "the rail consumes, never re-derives" — so the iterator stays a presentation-layer projection under
`arguments/`, exactly where `goPopoutModel.ts` and `argumentGameSurfaceModel.ts` live.

### D2 — Bounded node set: cheap host pre-filter (superset) → iterator open-issue filter (exact)

Two layers, so the build cost is bounded **before** any expensive work and the open/closed decision stays in the pure
iterator (testable in isolation):

**Layer 1 — host pre-filter (performance bound; a conservative superset).** Before building any issue, the host selects
candidate node ids using only **cheap signals already in memoized maps** — no `buildOpenIssue`, no
`adaptAllSourcesForNode`. A node is a *candidate* when ANY of:
- it has ≥1 **open evidence debt** (`getNodeEvidenceDebtSummary(id, evidenceDebts)` filtered to
  `OPEN_EVIDENCE_DEBT_STATUSES`), OR
- its lifecycle `clusterState` (`lifecycleMap.byMessage.get(id)?.clusterState`) is **not** in the closed set
  `{answered, clarified, sourced, confirmed, archived_or_resolved, moved_on_by_affirmative, moved_on_by_negative,
  ignored_by_affirmative, ignored_by_negative, ignored_by_both, exhausted, branch_recommended}` — i.e. it is one of
  `{open, rebutted, quote_requested, source_requested, narrowed, conceded, synthesis_ready}`, OR
- it carries a **live manual tag / auto-metadata** in the frozen set `{needs_source, needs_quote, definition_issue,
  scope_issue, causal_mechanism, evidence_debt, concession_offered, narrowed_claim, ready_for_synthesis, tangent,
  branch_suggested, no_response_after_n_turns}`.

This is a **correctness-preserving superset** of what Layer 2 keeps: any node that could derive a non-`none` burden or a
non-terminal state is included (an open debt forces `source_owed`/`quote_owed`; a live lifecycle state maps to a kept
`IssueState`; the live tags drive burden/relation). Closed, answered, debt-free nodes are skipped outright — in a healthy
300-message room that is the large majority. The host caps the built set at **K = 48 most-recent candidates** (a
defensive ceiling; realistic live counts are 5–40) and passes any rare beyond-K remainder as a count, so the build cost
is bounded regardless of room size (see Performance).

**Layer 2 — iterator open-issue filter (exact, pure, tested).** `buildOpenIssuesLedger` keeps a built issue iff
`isOpenIssue(issue)`:

```
isOpenIssue(issue) ≡ issue.burden !== 'none' || !TERMINAL_DISPLAY_STATES.has(issue.state)
TERMINAL_DISPLAY_STATES = new Set<IssueState>(['answered', 'moved_on'])
```

This is the card's stated rule ("nodes with non-`none` burden or non-`answered`/`moved_on` state"). It keeps
`open`, `source_requested`, `quote_requested`, `narrowed`, `conceded`, `synthesis_ready` and every live-burden issue;
it drops `answered`/`moved_on` issues whose burden is `none`. (`conceded` is kept per the card's explicit rule — it is
borderline "resolved"; see Out of scope / Operator-deferred. `synthesis_ready` and `narrowed` are kept because their
`nextBestMoves` are exactly the satisfying close moves a newcomer should see — Confirm / Synthesize.)

### D3 — Ordering: procedural urgency, then recency — never engagement

A frozen rank function orders by **what is owed**, descending urgency, then by recency of the target node. No field reads
heat, popularity, virality, view count, or a strength band.

```
ledgerRank(issue):
  if burden === 'source_owed'        → 0   // most concrete owed task
  if burden === 'quote_owed'         → 1
  if burden === 'clarification_owed' → 2
  if burden === 'reply_owed'         → 3
  // burden === 'none', non-terminal state (the resolution-arc tail):
  if state === 'synthesis_ready'     → 4   // ready to wrap up — the payoff move
  if state === 'narrowed'            → 5
  if state === 'conceded'            → 6
  else                               → 7   // defensive (no other state reaches here)
```

Total order on candidates: **(1) `ledgerRank` ascending → (2) `recencyIndex` descending (most-recent target first) →
(3) `issue.id` lexicographic ascending** (stable, fully deterministic tiebreak). `recencyIndex` is the target node's
position in the host's `chronologicalIds` (`ArgumentGameSurface.tsx:504`). Most-recent-first within a tier matches the
room's default-active-latest posture and surfaces the freshest live fight first for a newcomer; the active issue is
highlighted regardless of position, so order never hides it. (Alternative — oldest-owed-first "clear your debts" queue —
is noted as Operator-deferred.)

### D4 — Mount + layout: a SEPARATE collapsed-by-default rail panel (not a side-rail section, not a Go view)

The card asks me to choose between (a) a new section of `ArgumentSideActionRail`, (b) a separate panel, (c) a Go-popout
view. **Decision: a separate, self-contained `OpenIssuesRail` panel** mounted as a sibling in `ArgumentGameSurface`,
collapsed by default, honoring the Stage 6.4 observer-first posture.

- **Not a section of `ArgumentSideActionRail`** (`ArgumentSideActionRail.tsx`): that rail is **per-bubble tactical
  actions** keyed to `viewerRole` × `bubbleActor` (Watch / Join / Reply / Disagree / Share), shaped as
  `RailAction[]` with category groups (`railActionCategories.ts`). The Open Issues ledger is **room-wide** and
  issue-shaped (state + burden + contested point + next moves) — it does not fit the `RailAction` contract, and bolting
  it on would couple two unrelated models and the `railActionGrouping.test.ts` lock. Rejected.
- **Not a Go-popout view** (`goPopoutModel.ts`): Go is a transient navigate/re-view menu of **static** config entries
  (Jump / View / Density / Lens); its `GoPopoutEntry` has no burden line and no next-move affordance, and Go closes on
  jump. The Open Issues rail is a **persistent, glanceable orientation** surface that must show *what is open right now*
  beside the board. It **reuses** Go's jump + `issueStateToGoLens` mechanics, but it is not a Go view. Rejected as home;
  reused as mechanics.
- **Separate panel (chosen):** mirrors the SC-005 contextual-dock chassis — a small **collapsed chip** ("Open issues ·
  N") that expands into a **compact panel** (side-anchored on wide viewports, a capped bottom sheet on narrow ones). It
  reuses the existing layout helpers `resolveObserverDockVariant(width)` and `resolveSheetMaxHeightPx(height)` from
  `ObserverActionDockLayout.ts` (no new layout math). Mobile-first: collapsed footprint is one 44 px chip; expanded is a
  capped sheet (~28 % viewport, never full-screen). It sits **below the Timeline** as bottom chrome, so it contributes
  **zero** to the UX-001.2 first-row offset cap. Mutual exclusion with the side action rail reuses the shipped
  single-owner pattern (`isAnyPanelOpen` + `onExpandedChange`).

### D5 — Affordances per entry: jump · Inspect · 1–2 next moves (all reuse REF-003/REF-004 mechanics)

Each row exposes the existing loop verbs against the row's `targetNodeId` — **no new routing**:
- **Jump** (whole-row tap): host sets the active node + applies `issueStateToGoLens(entry.state)` + switches to Timeline
  view so the lens can dim. This is `handleRefereeFocusIssue` (`ArgumentGameSurface.tsx:1588`) generalized to an
  arbitrary target.
- **Inspect** (compact secondary affordance): host sets the active node + opens the shipped Inspect popout; the
  `InspectOpenIssueDetail` sibling overlay (`ArgumentGameSurface.tsx:2210`) re-derives on the new active node and shows
  the issue's full provenance.
- **1–2 next moves**: the head of `entry.nextBestMoves` (already engine + role survivors from REF-002), each routed
  through the shared `enterBoxForActEntry` bridge (`ArgumentGameSurface.tsx:1426`). Empty for observers / own bubble /
  fully-resolved issues — the zone collapses, exactly like Referee Card zone 3.

---

## Data model

**No new persisted data model. No migration. No DB column.** The rail is derived-only, identical to REF-001's
derived-only v1 decision. The only new types are the in-memory shapes the pure iterator produces.

```ts
// src/features/arguments/openIssuesRail/openIssuesRailModel.ts  (NEW — pure TS)

import type {
  OpenIssue, IssueState, IssueBurden, DisagreementAxis,
  RelationToParent, MoveSuggestion,
} from '../../refereeLoop';

/** A built OpenIssue + the cheap ordering facts the host supplies per candidate node.
 *  The HOST builds `issue` via REF-002's buildOpenIssue (single derivation home);
 *  the iterator never re-derives. */
export interface OpenIssueLedgerCandidate {
  issue: OpenIssue;
  /** Target node's index in chronologicalIds. Higher = more recent. */
  recencyIndex: number;
  /** True when this candidate's target node is the currently-active node. */
  isActive: boolean;
}

/** One rendered ledger row. Every string is plain-language, ban-list clean,
 *  and free of raw codes (no issue.id, no sourceCode, no rawKey). */
export interface OpenIssueLedgerEntry {
  /** React key + test handle — equals issue.id; NEVER rendered as text. */
  key: string;
  /** For jump / inspect / move routing. */
  targetNodeId: string;
  state: IssueState;
  burden: IssueBurden;
  axis: DisagreementAxis;
  relationToParent: RelationToParent;
  /** Primary plain label — the REF-001 §rail state vocabulary (ISSUE_STATE_LABEL). */
  stateLabel: string;
  /** Secondary plain line — `${BURDEN_LABEL} · ${AXIS_LABEL}` OR the terminal-state
   *  line when burden === 'none'. Composed from exported REF-002 atoms; no new copy. */
  openTaskLine: string;
  /** Deterministic excerpt of the contested point (≤ RAIL_PROPOSITION_CAP). Verbatim;
   *  never AI-synthesized. May be ''. */
  contestedProposition: string;
  /** Non-color tone glyph carried from the issue's banner-seeded observation, else null. */
  toneGlyph: 'star' | 'arrow' | 'branch' | null;
  /** 1–2 head moves (engine + role survivors). Empty → row shows no move chips. */
  nextBestMoves: ReadonlyArray<MoveSuggestion>;
  /** True when this is the active node's issue → highlight (geometry, not color alone). */
  isActive: boolean;
  /** One complete screen-reader sentence for the row. */
  accessibilityLabel: string;
}

export interface OpenIssuesLedger {
  entries: ReadonlyArray<OpenIssueLedgerEntry>;
  /** Total open issues in the room (kept candidates + host-omitted remainder). */
  totalOpenCount: number;
  /** Count beyond the displayed entries → "+N more". 0 when none. */
  overflowCount: number;
  /** True when there are zero open issues → render the teaching empty state. */
  isEmpty: boolean;
}

export interface BuildOpenIssuesLedgerOptions {
  /** Max rows to display before overflow. Default 8. */
  maxEntries?: number;
  /** Live candidates the host could not build (beyond the K build-cap). Default 0;
   *  added honestly into totalOpenCount + overflowCount. */
  omittedCandidateCount?: number;
  /** Max next-move chips per row. Default 2. */
  maxMovesPerEntry?: number;
}
```

---

## API / interface contracts

```ts
// ── openIssuesRailModel.ts — the pure iterator (NEW) ──

/** The exact open/closed predicate (Layer 2). Pure, total. Exported for tests. */
export function isOpenIssue(issue: OpenIssue): boolean;

/** Procedural urgency rank (0 = most owed). Pure, total. Exported for tests. */
export function ledgerRank(issue: OpenIssue): number;

/** Total order: rank asc → recency desc → id asc. Exported for tests. */
export function compareLedgerCandidates(
  a: OpenIssueLedgerCandidate, b: OpenIssueLedgerCandidate,
): number;

/** Filters (isOpenIssue) → orders (compareLedgerCandidates) → caps (maxEntries) →
 *  shapes rows. Deterministic, pure, no Date.now, no React, no network. */
export function buildOpenIssuesLedger(
  candidates: ReadonlyArray<OpenIssueLedgerCandidate>,
  options?: BuildOpenIssuesLedgerOptions,
): OpenIssuesLedger;

/** The rail's only authored chrome strings (everything else reuses REF-002 atoms).
 *  Frozen; scanned by the ban-list + no-raw-codes tests. */
export const OPEN_ISSUES_RAIL_COPY: Readonly<{
  railTitle: string;          // 'Open issues'
  collapsedLabel: string;     // 'Open issues'  (component appends "· N")
  emptyPrimary: string;       // 'No open issues right now.'
  emptyHelper: string;        // 'When a point needs a source, a quote, a reply, or is ready to wrap up, it shows up here.'
  jumpLabel: string;          // 'Go to point'
  jumpHint: string;           // 'Move the board to this point and focus it.'
  inspectLabel: string;       // 'Details'
  inspectHint: string;        // 'Open the full referee detail for this point.'
  activeSuffix: string;       // 'Currently active'
  overflowWord: string;       // 'more'  (component renders "+N more")
  collapseLabel: string;      // 'Collapse'
}>;

export const RAIL_PROPOSITION_CAP: number; // 88 — compact-row excerpt cap
```

```tsx
// ── OpenIssuesRail.tsx — the panel (NEW) ──
interface OpenIssuesRailProps {
  ledger: OpenIssuesLedger;
  windowWidth?: number;
  windowHeight?: number;
  reduceMotionOverride?: boolean;
  /** Default true (observer-first). */
  defaultCollapsed?: boolean;
  /** Force-collapse when another bottom panel owns the space. */
  isAnyPanelOpen?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onJump: (entry: OpenIssueLedgerEntry) => void;
  onInspect: (entry: OpenIssueLedgerEntry) => void;
  onMove: (entry: OpenIssueLedgerEntry, move: MoveSuggestion) => void;
  testID?: string;
}
export function OpenIssuesRail(props: OpenIssuesRailProps): JSX.Element | null;
```

```ts
// ── ArgumentGameSurface.tsx host handlers (generalize REF-004 bridges; no new routing) ──

// Jump (reuses handleRefereeFocusIssue mechanics for an arbitrary target):
function handleOpenIssueFocus(entry: OpenIssueLedgerEntry): void;
//   setActiveMessageId(entry.targetNodeId); setSelectionStatus('explicit');
//   setMicroMomentDismissed(true); if (mode !== 'timeline') setMode('timeline');
//   setGoLens(issueStateToGoLens(entry.state));

// Inspect (reuses the shipped Inspect popout + InspectOpenIssueDetail overlay):
function handleOpenIssueInspect(entry: OpenIssueLedgerEntry): void;
//   setActiveMessageId(entry.targetNodeId); setSelectionStatus('explicit');
//   setInspectVisible(true);

// Next move (reuses the SAME enterBoxForActEntry bridge):
function handleOpenIssueMove(entry: OpenIssueLedgerEntry, move: MoveSuggestion): void;
//   const parentType = parentTypeForMessage(entry.targetNodeId);   // O(1) via nodeByMessageId + messageById
//   setActiveMessageId(entry.targetNodeId);
//   enterBoxForActEntry(move.actEntryId, entry.targetNodeId, parentType);

// enterBoxForActEntry generalized — explicit target overrides the active node
// (existing call sites pass no extra args → byte-identical behavior):
const enterBoxForActEntry = useCallback(
  (entryId: ActEntryId, targetMessageId?: string, targetParentType?: ArgumentType | null) => {
    const messageId = targetMessageId ?? activeMessageId ?? '';
    const parentType = targetParentType !== undefined ? targetParentType : activeParentType;
    const quickAction = actEntryToQuickAction(entryId);
    const preset = quickAction !== null
      ? quickActionToPreset(quickAction as QuickActionLabel, parentType) : null;
    handleAction('reply', messageId, preset);
  },
  [activeMessageId, activeParentType, handleAction],
);
```

---

## File changes

**New files:**
- `src/features/arguments/openIssuesRail/openIssuesRailModel.ts` — the pure iterator + frozen copy + helpers
  (`isOpenIssue`, `ledgerRank`, `compareLedgerCandidates`, `buildOpenIssuesLedger`, `OPEN_ISSUES_RAIL_COPY`,
  `RAIL_PROPOSITION_CAP`). **~190–230 lines.**
- `src/features/arguments/openIssuesRail/OpenIssuesRail.tsx` — the collapsed-chip → expanded-panel component; collapsed
  count badge, expanded scrollable rows, per-row jump/Inspect/move affordances, empty + overflow states, reduce-motion +
  full a11y. Reuses `resolveObserverDockVariant` / `resolveSheetMaxHeightPx`. **~280–340 lines.**
- `src/features/arguments/openIssuesRail/index.ts` — re-export barrel. **~6 lines.**

**Modified file:**
- `src/features/arguments/ArgumentGameSurface.tsx`:
  - **Add** memoized O(1) lookup maps `messageById: Map<string, Message>` and `nodeByMessageId: Map<string, TimelineNode>`
    (built once from `sorted` / `timelineMap.nodes`) — replaces the O(n) `sorted.find` / `timelineMap.nodes.find` in the
    existing `activeParentType` (`:971`) and the active-node memo (`:1024`, `:1073`), a free de-quadratic win and the
    prerequisite for per-candidate assembly.
  - **Extract** the active-node assembly body (`:1003`–`:1109`) into a closure
    `assembleRefereeCardInputForMessage(messageId): BuildOpenIssueInput | null` so the active-node memo
    (`refereeCardIssue`) and the rail candidates share ONE code path (no duplicated gathering). Active node keeps its
    `bannerSelection: refereeBanner`; candidate nodes pass `bannerSelection: null` (see Performance — keeps the candidate
    memo independent of `activeMessageId`).
  - **Add** a memoized candidate pre-filter + build (`openIssueCandidates`) keyed on the data maps **but not**
    `activeMessageId`, and a thin `openIssuesLedger` memo applying `isActive` + `buildOpenIssuesLedger`.
  - **Add** the three handlers above; **generalize** `enterBoxForActEntry` (`:1426`) with the optional target args.
  - **Mount** `<OpenIssuesRail>` as a sibling immediately above `<ArgumentSideActionRail>` (`:2000`), wired to the three
    handlers + `isAnyPanelOpen`/`onExpandedChange` coordination.
  - Net **~+120–160 lines**; existing behavior unchanged (the refactor is byte-equivalent for the active node).

**Deleted files:** none.

**Explicitly NOT modified:** `src/features/refereeLoop/openIssueModel.ts` (single derivation home — untouched;
the rail composes from its already-**exported** `ISSUE_STATE_LABEL` / `BURDEN_LABEL` / `RELATION_LABEL` / `AXIS_LABEL` /
`ISSUE_STATE_TERMINAL_LINE` atoms), `cardView/refereeCardAssembly.ts`, `goPopoutModel.ts`, `ArgumentSideActionRail.tsx`,
`RefereeCardView.tsx`, `InspectOpenIssueDetail.tsx`, `gameCopy.ts` (the 8 `IssueState` codes are already registered at
`:214`–`:235`), anything under `supabase/**` or `mcp-server/**`.

---

## Row composition (the five questions → frozen surface)

| Question | Row element | Source (no re-derivation) |
|---|---|---|
| What are we arguing about? | `contestedProposition` excerpt (≤88, verbatim) | `issue.contestedProposition` (deterministic, already ≤160) |
| Which point is open? | `stateLabel` chip + tone glyph | `ISSUE_STATE_LABEL[issue.state]`, `issue.refereeObservations[0]?.toneGlyph` |
| What is owed? | `openTaskLine` | `${BURDEN_LABEL[burden]} · ${AXIS_LABEL[axis]}` or `ISSUE_STATE_TERMINAL_LINE[state]` when `burden==='none'` |
| What can I do next? | 1–2 move chips | head of `issue.nextBestMoves` (engine+role survivors) |
| Where do I click? | row tap = Jump · Details = Inspect · chip = move | `handleOpenIssueFocus` / `handleOpenIssueInspect` / `handleOpenIssueMove` |

The rail renders **zero** raw observation codes and **zero** `userAllegations` (person-directed marks stay off public
surfaces — REF-002 already gates them; the rail simply never reads that field). `toneGlyph` is a non-color shape marker.

---

## Performance (300-message room — required statement)

The existing active-node `refereeCardIssue` memo (`:1000`–`:1127`) builds **one** issue but uses two O(n) `sorted.find`
calls; naively mapping it over all nodes would be O(n²) (~90k scans) plus 300× `adaptAllSourcesForNode` + 300×
`buildOpenIssue`. The design avoids this:

1. **O(1) lookups.** New memoized `messageById` / `nodeByMessageId` maps replace every `sorted.find` /
   `timelineMap.nodes.find` in the per-node assembly (and retroactively de-quadratic the existing `activeParentType` and
   active memo — a free win).
2. **Cheap candidate scan (Layer 1).** One O(n) pass over the nodes reading only `lifecycleMap.byMessage` /
   `metadataLedger.byMessage` / `manualTagsByMessageId` / open-debt presence — **no** `buildOpenIssue`, **no**
   `adaptAllSourcesForNode`. ~300 Map lookups. Closed/answered/debt-free nodes (the majority) are dropped here.
3. **Bounded build.** Only the ≤ **K = 48** most-recent candidates are assembled + built (`buildRefereeCardInput` →
   `buildOpenIssue`, each now O(1)-lookup + one `adaptAllSourcesForNode` + one `buildActPopout`/`deriveSuggestedMoves`).
   Realistic live counts are 5–40; 48 is a defensive ceiling. Worst case ≤48 `buildOpenIssue` calls, not 300.
4. **Memoization that excludes `activeMessageId`.** `openIssueCandidates` (the ≤48 built issues) is memoized on the data
   maps (`lifecycleMap`, `metadataLedger`, `evidenceDebts`, `messageById`, `manualTagsByMessageId`,
   `persistedObservationsByArgumentId`, `timelineMap`, `constitution.activeRules`, `debate.id`, `boardActRole`) **but not**
   on `activeMessageId` — candidate issues use `bannerSelection: null`, so they don't depend on the active node's banner.
   Changing the active node does **not** rebuild 48 issues; only the cheap `isActive` overlay + `buildOpenIssuesLedger`
   (filter + sort ≤48 + cap to 8 — O(K log K)) re-runs. The active-node Referee Card path is unchanged.

Net: a 300-message room costs one O(n) scan + ≤48 cheap builds, recomputed only when the underlying data actually changes
(new message, new classifier row), never on selection or idle re-render.

---

## Edge cases

- **No active room / empty room** → no candidates; `buildOpenIssuesLedger([])` → `isEmpty: true`; the rail renders the
  collapsed chip with count 0 and the teaching empty state on expand ("No open issues right now.").
- **All issues resolved** (every node `answered`/`moved_on`, no debts) → `entries: []`, `isEmpty: true` — same teaching
  empty state. The empty rail teaches that quiet ≠ broken.
- **Active node has no open issue** (e.g. it is `answered`) → no row carries `isActive: true`; nothing is highlighted.
  Valid — the rail does not fabricate a row for a closed active node.
- **Observer role / own bubble** → the candidate issues' `nextBestMoves` are empty (REF-002: observer survivors don't map
  to suggested codes; own-bubble survivors are `view_qualifiers` + `request_deletion` only). Rows still render (state +
  burden + contested point + Jump + Details); the move chips collapse. The rail stays informative, read-only.
- **More than `maxEntries` open issues** → the first `maxEntries` (default 8) render; an overflow control reads
  "+N more"; tapping it lifts the local display cap to the full built set (≤48). Any rare beyond-K remainder
  (`omittedCandidateCount`) stays counted in `overflowCount`/`totalOpenCount` but is not individually listed (those are
  the oldest live issues; reachable by scrolling the timeline). The count is always honest.
- **Concurrent edits / late classifier arrival** → the candidate memo re-derives from current maps on the next render; a
  new debt or lifecycle change adds/removes a row. Nothing blocks or delays a post in the meantime.
- **Permission-denied / no compose rights** → identical to observer: rows render read-only; no move chip can open a box
  the engine would reject (chips are engine+role survivors by construction).
- **Family J / sensitive observation in upstream marks** → never reaches the rail: REF-002's `buildOpenIssue` re-asserts
  the `HUB_NON_PRODUCTION_FAMILIES` gate; the rail consumes the gated `OpenIssue` and never reads raw marks.
- **Doctrine-constraint edge — "what if heat / popularity tries to order the rail? — it doesn't"**: `ledgerRank` and the
  recency tiebreak read only `IssueBurden` / `IssueState` / chronological index / `issue.id`. No engagement, view count,
  virality, or strength band is an input anywhere in the model.
- **Unknown / malformed state code** (defensive) → cannot occur from `OpenIssue` (the union is total), but the row
  renderer routes any label that would trip `looksLikeInternalCode` to suppression — verified by the no-raw-codes test.
- **Reduce-motion enabled** → the expand animation snaps (no slide), mirroring `ArgumentSideActionRail`.

---

## Test plan (the issue's named files + anchors)

- **`__tests__/openIssuesRailModel.test.ts`** — pure-model coverage:
  - `isOpenIssue`: keeps non-`none` burden; keeps `narrowed`/`conceded`/`synthesis_ready`/`source_requested`/
    `quote_requested`/`open`; drops `answered`+`none` and `moved_on`+`none`.
  - `ledgerRank`: the seven-tier order (source→quote→clarification→reply→synthesis_ready→narrowed→conceded).
  - `compareLedgerCandidates`: rank asc → recency desc → id asc; full determinism (shuffle → identical output).
  - `buildOpenIssuesLedger`: filter + order + cap (`maxEntries`), `overflowCount`/`totalOpenCount` honesty (incl.
    `omittedCandidateCount`), `maxMovesPerEntry` truncation, `isActive` propagation, empty input → `isEmpty: true`,
    `openTaskLine` = burden·axis vs terminal-state line, `contestedProposition` truncation at `RAIL_PROPOSITION_CAP`.
  - A purity assertion: the module source contains no `import ... 'react'` / `'react-native'` / `@supabase` / `fetch(` /
    `Date.now(` (mirrors `refereeLoopForbiddenImports`).
- **`__tests__/OpenIssuesRail.test.tsx`** — render + routing (React Testing Library, JSDOM):
  - collapsed chip shows the count badge; expand reveals rows; collapse hides them.
  - row tap fires `onJump(entry)`; Details fires `onInspect(entry)`; a move chip fires `onMove(entry, move)` with the
    correct `MoveSuggestion`.
  - empty ledger renders the teaching empty state; overflow renders "+N more" and expands the cap on press.
  - observer ledger (empty `nextBestMoves`) renders rows with no move chips.
- **`__tests__/openIssuesRailBanList.test.ts`** — scans every rendered string + `OPEN_ISSUES_RAIL_COPY` + every
  `ISSUE_STATE_LABEL`/`BURDEN_LABEL`/`RELATION_LABEL`/`AXIS_LABEL`/`ISSUE_STATE_TERMINAL_LINE` value the rail emits,
  against the **16 prohibited tokens** (verbatim from `openIssueModel.banlist.test.ts:34`): `winner, loser, correct,
  incorrect, truth, untrue, dishonest, liar, manipulative, extremist, propagandist, stupid, idiot, verdict, bad faith,
  proof of`.
- **`__tests__/openIssuesRailNoRawCodes.test.ts`** — no rendered string trips `looksLikeInternalCode`
  (`gameCopy.ts:906`); `issue.id` (`issue:<node>:<relation>:<axis>`) and every `sourceCode`/`rawKey` never appear in the
  rendered tree; the row key is the id but is never text content.
- **`__tests__/openIssuesRailA11y.test.tsx`** — every interactive element has `accessibilityRole="button"`, a populated
  `accessibilityLabel`, `accessibilityState` (`selected` for the active row, `expanded` for the chip), and ≥44×44 hit
  target (size or `hitSlop`); the row's screen-reader sentence reads naturally (no key badge, no raw code); the active
  row is distinguishable by geometry (left bar + bold), not color alone (grayscale-legible); reduce-motion path snaps.
- **Anchor suites that must stay green (non-decreasing):** `openIssueModel*` (all four), `refereeCardA11y`,
  `refereeCardBanList`, `refereeCardNoRawCodes`, `RefereeCardView`, `actPopoutModel`, `goPopoutModel`,
  `refereeLoopForbiddenImports`, plus any `ArgumentGameSurface` / `refereeCardAssembly` mount tests touched by the
  assembly extraction.

---

## Dependencies (cards / docs / files)

- **Assumes SHIPPED:** REF-002 `buildOpenIssue` + the frozen label atoms (`openIssueModel.ts:283`–`:338`); REF-003
  `buildRefereeCardInput` (`cardView/refereeCardAssembly.ts:105`) + the active-node assembly in `ArgumentGameSurface.tsx`
  (`:1000`); REF-004 `enterBoxForActEntry` (`:1426`), `handleRefereeFocusIssue` (`:1588`), `issueStateToGoLens`
  (`goPopoutModel.ts:339`), `InspectOpenIssueDetail` mount (`:2210`); REF-ADR-001 (ratified — plain moves only).
- **Reads existing code at:** `ArgumentSideActionRail` chassis + `ObserverActionDockLayout` (`resolveObserverDockVariant`,
  `resolveSheetMaxHeightPx`); `lifecycleMap` / `metadataLedger` / `evidenceDebts` / `manualTagsByMessageId` /
  `persistedObservationsByArgumentId` / `chronologicalIds` / `timelineMap` (all already memoized on the surface);
  `gameCopy.looksLikeInternalCode` + the registered `IssueState` codes.
- **Complements, never duplicates:** `timelineMiniMapModel` (spatial density / hot zone) and `timelineDensityLensModel`
  (focus lenses) give *where activity is*; the Open Issues rail gives *which procedural issues are open and what they
  owe*. The rail reuses the lens (`issueStateToGoLens`) for jump focus but renders a distinct ledger surface.
- **Blocks / enables:** the Recruitable Demo Corridor card (filed after this ships) and the REF-006 founder dogfood pass
  (#589) — both depend on the rail existing as the newcomer's orientation surface.

---

## Risks

- **Per-node build cost regresses.** Mitigation: the two-layer bound (cheap pre-filter + K-cap) + O(1) lookup maps +
  `activeMessageId`-independent memo; the Performance statement quantifies the ≤48-build worst case. The reviewer should
  confirm the candidate memo's dependency array excludes `activeMessageId`.
- **The assembly extraction silently changes the active-node Referee Card.** Mitigation: the extracted
  `assembleRefereeCardInputForMessage` must be byte-equivalent for the active node (same inputs, `bannerSelection:
  refereeBanner` for active vs `null` for candidates); the existing REF-003/REF-004 mount tests are the regression gate.
- **Rail copy drifts toward verdict tokens** (one synthesized ledger is tempting to editorialize). Mitigation: the rail
  authors only `OPEN_ISSUES_RAIL_COPY`; all state/burden/axis labels reuse the already-scanned REF-002 atoms; the
  ban-list + no-raw-codes tests scan the full rendered tree.
- **Ordering accidentally reads engagement.** Mitigation: `ledgerRank` + tiebreak read only burden/state/recency-index/id;
  the model imports no heat/standing source; a model test asserts shuffled-input determinism.
- **Mobile crowding** (two bottom rails). Mitigation: both collapsed-by-default; `isAnyPanelOpen` mutual exclusion; the
  expanded panel is a capped sheet (~28 % viewport), never full-screen.
- **`conceded` borderline.** Keeping conceded issues in the rail (per the card's explicit rule) may read as clutter once a
  point is settled. Flagged as Operator-deferred; trivially removable by adding `conceded` to `TERMINAL_DISPLAY_STATES`.

---

## Out of scope

- **No persistence** — no `OpenIssue` table, no migration, no Edge read path (REF-002B remains the named future card).
- **No `supabase/**` change, no `mcp-server/**` change, no new MCP family, no Family J exposure, no provider call.**
- **No derivation logic outside the thin iterator** — REF-002 stays the single derivation home; the iterator filters,
  orders, caps, and shapes rows only.
- **No submit gating** — the rail is post-storage, display-only; no path blocks/rejects/routes/delays a post.
- **No new routing** — jump/Inspect/move reuse the shipped `setActiveMessageId` / Inspect popout / `enterBoxForActEntry`
  paths.
- **No new copy vocabulary for states/burdens/axes/moves** — those reuse the frozen REF-002 atoms; the rail authors only
  its chrome strings.
- **No reordering by heat/popularity, no winner/loser/truth labels, no strength band, no score.**
- **No user-editable issue title** (deterministic excerpt only — REF-001 boundary).
- **No oldest-owed-first queue mode** (recency-desc only in v1; Operator-deferred).
- **No Family-J path of any kind.**
- **v1 scope guards:** no voting, no winner-producing scoring, no OAuth, no push, no public API, no argument search.

---

## Doctrine self-check

**Acceptance-gate invariant (verbatim):**
*AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine
(`src/domain/constitution/engine.ts`, mirrored for the server at `supabase/functions/_shared/constitution/`) is the sole
gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post.*
→ **Respected.** The rail is consultative, post-storage, display-only. It consumes already-built `OpenIssue` objects and
emits no block. Its move chips are a *subset* of `buildActPopout` engine+role survivors (via REF-002's `nextBestMoves`) —
it can never present a button the engine would reject, and it never sits in the post path.

- **cdiscourse-doctrine §1 (no truth labels; score never blocks).** Every emitted label is a frozen REF-002 atom or an
  `OPEN_ISSUES_RAIL_COPY` chrome string; the 16 prohibited tokens appear here only as the ban-scan list. The rail
  describes a point's procedural state, never its truth/winner/loser standing.
- **§2 (heat = activity/friction).** The rail neither displays nor orders by heat. "Open" / "Moved on" describe
  procedural state, not importance.
- **§3 (popularity is not evidence).** No field reads engagement, views, virality, or a strength band; ordering is purely
  procedural (burden/state/recency/id).
- **§4 (AI moderator limits).** No AI call from the production app; the rail consumes already-persisted, already-derived
  state; it never classifies, never assigns truth, never returns an authoritative flag.
- **§5 (the engine is sacred).** The new model is pure TS — no React/Supabase/network/`Date.now`; it imports only REF-002
  types + label atoms; it never re-validates or contradicts the engine.
- **§9 (plain language).** Every user-facing string is plain English; the row renderer suppresses anything that trips
  `looksLikeInternalCode`; `issue.id` / `sourceCode` / `rawKey` never reach the UI.
- **§10a (Observations vs Allegations).** The rail renders zero `userAllegations` (person-directed marks stay off public
  surfaces) and zero raw Observation codes; Family J is re-asserted out upstream by REF-002 and never read by the rail.
- **§10 (v1 scope guards).** No voting/winner scoring, OAuth, push, public API, or search is introduced.
- **REF-ADR-001 (ratified — plain moves only).** No type code (`CLM`/`RBT`/…) and no raw `replies` relation reaches rail
  copy; move chips read their plain Act labels.
- **timeline-grammar (the rail sits beside the timeline).** No strength band, no heat saturation, no truth glyph; the
  state chip is text + a non-color tone glyph; the active row is distinguished by geometry, not color alone.

---

## Operator steps (if any)

**None — pure code change.** No `db push`, no `functions deploy`, no env var, no migration. UI composition over shipped
models; no data writes. Automerge-eligible per the issue's posture if all gates are green (typecheck · lint · targeted +
full Jest non-decreasing · a11y · ban-list + no-raw-codes scans · reviewer UI-only risk classification).

---

## Operator-deferred review

Where this design resolved an interpretation by orchestrator default rather than explicit operator direction:

- **`conceded` kept in the open set.** Adopted per the card's explicit bounded rule ("non-`answered`/`moved_on` state").
  Borderline "resolved"; one-line removable (add `conceded` to `TERMINAL_DISPLAY_STATES`). Operator may review.
- **Recency direction = most-recent-first within a tier.** Chosen to match the room's default-active-latest posture and
  newcomer freshness; the oldest-owed-first "clear your debts" alternative is deferred.
- **Display cap = 8, build ceiling K = 48.** Defaults; tunable. Chosen to bound build cost while comfortably covering
  realistic live-issue counts.
- **Mount as a separate panel** (vs a side-rail section or a Go view). Justified in D4 against mobile-first +
  observer-first constraints; operator may prefer folding it into Go if menu consolidation is later prioritized.
