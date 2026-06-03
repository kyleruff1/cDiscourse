# META-1E — Cards-detail metadata diff inspector

**Status:** Design draft — **read-only UI surface; no new user-facing copy; no mutation; append-only audit-style display.**
**Epic:** Epic 5 — Stack as detail view (`epic:stack-detail`)
**Release:** 6.7 — Profiles and prefs (`release:6.7`)
**Priority / Effort:** P2 · M (1–2 days)
**Issue:** https://github.com/CDiscourse/debate-constitution-app/issues/80

---

## Status / boundary (read first)

- **Read-only.** The inspector renders the `MetadataEvent` list for one selected move. It never writes, never posts, never edits, never opens the composer, never mutates the ledger. The component imports no Supabase, no `fetch`, no router, no AI.
- **No new copy.** Every rendered string is sourced from the existing plain-language tables (`PLAIN_LANGUAGE_COPY` via `toPlainLanguage`, plus the META-001 typed helpers `getManualTagPlainLabel` / `getAutoMetadataPlainLabel`). META-1E authors **zero** new user-facing strings except the four filter-chip labels, which are **reused verbatim from the issue scope** ("added tag" / "removed tag" / "resolved request" / "triggered transition") and one empty-state line that reuses the established pattern wording. (See "Open question 2" — if the reviewer reads the four chip labels as "new copy," they move into a tiny additive `gameCopy` block; the predicates are unaffected.)
- **Observation framing (doctrine §10a).** `MetadataEvent`s are **machine Observations** about a move's structure / lifecycle. They are rendered as "what changed on this move," never as "what a person did" and never as a verdict. The `code` is always mapped through plain language; an unknown code is **suppressed, not echoed**.
- **`cause` is never rendered.** The `MetadataEvent.cause` field is debug-only (AN-003). The view-model strips it; no render path reads it.
- **Append-only.** The inspector shows the event timeline as a fixed, chronological audit list. It exposes no edit / delete / dismiss affordance.

---

## Goal (one paragraph)

When a user opens a move in the Cards-detail surface (the Inspect popout — QOL-032's read-only "understand" panel anchored to the selected node), today they see the move's **current** content + metadata snapshot. They do not see **change**: "this move added evidence", "this move resolved a source request", "this move triggered a branch suggestion". META-1E adds a read-only Cards-detail panel, `MetadataDiffInspector`, that renders the `MoveMetadataLedger.metadataEvents` stream (from META-001, persisted-in-session) filtered to the selected move's `messageId`, as a **from → to + signal-description** timeline. Four filter chips ("added tag" / "removed tag" / "resolved request" / "triggered transition") let the user narrow the timeline to one kind of change. The design is shaped by three doctrine constraints: (1) **Observations, not Allegations** (§10a) — these are machine signals about the move's structure, rendered without implying a person made an accusation; (2) **plain language only** (§9) — every `code` maps through the existing label tables, unknown codes are suppressed; (3) **no verdict / heat / popularity framing** (§1–§3) — the panel describes the move's contribution to the game, never who is right.

---

## Data model

### No new persisted data model

META-1E adds **no** SQL, **no** migration, **no** new event type. It consumes the existing `MetadataEvent[]` already produced by `buildMoveMetadataLedger` (META-001) and already held in `ArgumentGameSurface.tsx` as `metadataLedger.metadataEvents`. It reuses the existing plain-language tables. It introduces exactly **one** new pure-TS view-model file and **one** new React component.

### New pure-TS view-model — `src/features/metadata/metadataDiffInspectorModel.ts`

Pure TypeScript. No React, no Supabase, no network, no `Date.now()`, no mutation of any input. Mirrors the `inspectPopoutModel.ts` / `computeNodeLabelInspectGroups` shape conventions verbatim. Estimated **~260–320 lines** incl. doc comments + the frozen filter table.

```ts
import type { MetadataEvent } from './moveMetadataLedger';

// ── Filter vocabulary ──────────────────────────────────────────

/** The four Cards-detail filter chips (issue #80 scope, binding). */
export type MetadataDiffFilterId =
  | 'added_tag'
  | 'removed_tag'
  | 'resolved_request'
  | 'triggered_transition';

/** Frozen array — tests + the chip strip iterate this. */
export const ALL_METADATA_DIFF_FILTERS: ReadonlyArray<MetadataDiffFilterId>;

/** Plain-language chip labels (reused verbatim from the issue scope). */
export const METADATA_DIFF_FILTER_LABEL: Readonly<Record<MetadataDiffFilterId, string>>;
//   added_tag            → 'Added tag'
//   removed_tag          → 'Removed tag'
//   resolved_request     → 'Resolved request'
//   triggered_transition → 'Triggered transition'

/** Verbose a11y labels for each chip (screen-reader, ≤ 80 chars, ban-list-clean). */
export const METADATA_DIFF_FILTER_ACCESSIBILITY_LABEL:
  Readonly<Record<MetadataDiffFilterId, string>>;

// ── One rendered diff row ──────────────────────────────────────

/**
 * One render-ready row. The component renders these verbatim; it derives
 * nothing. `cause` is NEVER carried onto this shape — it is stripped at
 * derivation time and never reaches a render path.
 */
export interface MetadataDiffRow {
  /** Stable key = the source `MetadataEvent.eventId`. */
  rowId: string;
  /** The event kind, retained for the per-row icon/marker + a11y. */
  kind: 'add' | 'remove' | 'transition';
  /** Which filter buckets this row belongs to (0..n; usually exactly 1). */
  filterIds: ReadonlyArray<MetadataDiffFilterId>;
  /**
   * The "from" half. Non-null ONLY for a lifecycle transition row
   * (the pre-move state, plain-language-mapped). Null for add/remove rows.
   */
  fromLabel: string | null;
  /**
   * The "to" half. The plain-language label of the code that changed:
   *  - add/remove   → the tag/metadata code's plain label.
   *  - transition   → the post-move state's plain label.
   * ALWAYS a non-empty plain-language string for a row that survived
   * derivation (a row whose code maps to null is DROPPED, not emitted).
   */
  toLabel: string;
  /**
   * The one-line "what changed on this move" signal description — a plain
   * sentence assembled ONLY from already-plain labels + a fixed connective
   * verb per kind (no new descriptive copy beyond the connective). E.g.
   *   add manual_tag      → "Tag added: <toLabel>."
   *   remove manual_tag   → "Tag removed: <toLabel>."
   *   add auto_metadata   → "Observed: <toLabel>."
   *   resolved request    → "Request resolved: <toLabel>."
   *   transition          → "<fromLabel> → <toLabel>."
   * The connective verbs are the ONLY authored fragments; they are
   * ban-list-scanned and carry no verdict/heat/person token.
   */
  signalDescription: string;
  /** ISO-8601 timestamp from the source event (for stable chronological order). */
  at: string;
  /** Provenance — which code family produced this row (for the a11y read + tests). */
  codeFamily: MetadataEvent['codeFamily'];
}

// ── The full view-model ────────────────────────────────────────

export interface MetadataDiffInspectorModel {
  /** All derived rows for the selected move, chronological (oldest→newest). */
  allRows: ReadonlyArray<MetadataDiffRow>;
  /**
   * The rows after the active-filter mask is applied. Equal to `allRows`
   * when `activeFilters` is empty (no chip selected = show everything).
   */
  visibleRows: ReadonlyArray<MetadataDiffRow>;
  /**
   * Per-chip availability + count. A chip whose bucket has zero rows for
   * this move is `available: false` (rendered disabled, not hidden) so the
   * chip set is stable across moves.
   */
  filters: ReadonlyArray<{
    id: MetadataDiffFilterId;
    label: string;
    accessibilityLabel: string;
    available: boolean;
    count: number;
    active: boolean;
  }>;
  /** True when `allRows` is empty — the host renders the empty state. */
  isEmpty: boolean;
}

// ── Public functions ───────────────────────────────────────────

/**
 * Derive every diff row for one move from the full event stream.
 * - Filters `events` to `event.messageId === messageId`.
 * - Maps each event's `code` through plain language; DROPS any event whose
 *   code maps to null (unknown code → suppressed, never echoed).
 * - Computes `fromLabel`/`toLabel`/`signalDescription`/`filterIds`.
 * - Sorts chronologically by `at` (real Date.getTime()), stable secondary
 *   key = `eventId`.
 * Pure. Deterministic. O(n) over the move's events.
 */
export function deriveMetadataDiffRows(
  events: ReadonlyArray<MetadataEvent>,
  messageId: string,
): ReadonlyArray<MetadataDiffRow>;

/**
 * Map one `MetadataEvent` to the filter buckets it belongs to. The exact
 * predicates are defined in "Filter-chip predicates" below. Returns [] for
 * an event that matches no chip (it still renders in the unfiltered list,
 * but no chip selects it).
 */
export function filterIdsForEvent(
  event: MetadataEvent,
): ReadonlyArray<MetadataDiffFilterId>;

/**
 * Build the full inspector view-model for a move + the active filter set.
 * `activeFilters` empty → `visibleRows === allRows`. Multiple active
 * filters are OR-combined (a row visible if it is in ANY active bucket).
 * Pure. Deterministic. Idempotent.
 */
export function buildMetadataDiffInspectorModel(input: {
  events: ReadonlyArray<MetadataEvent>;
  messageId: string;
  activeFilters: ReadonlyArray<MetadataDiffFilterId>;
}): MetadataDiffInspectorModel;
```

**Why a `resolved_request` predicate needs the prior-event context (important):** "resolved request" is not a single field on one event — it is an `auto_metadata` **add** of `source_attached` / `quote_attached` that follows a prior `source_requested` / `quote_requested` **on the same move**. `deriveMetadataDiffRows` therefore computes, per move, whether a request was ever opened (scan the move's events for an `add auto_metadata source_requested | quote_requested`) before classifying a later `source_attached | quote_attached` add as `resolved_request`. This is why `filterIdsForEvent(event)` (context-free) handles the simple three predicates, and the resolved-request bucket is finalized inside `deriveMetadataDiffRows` (which has the per-move event set). The model exposes both so tests can target each. See "Filter-chip predicates" for the exact rule + the fallback.

---

## File changes (for the implementation card)

**New files**
- `src/features/metadata/metadataDiffInspectorModel.ts` — pure view-model (above). **~260–320 lines.**
- `src/features/metadata/MetadataDiffInspector.tsx` — the read-only RN component (below). **~200–260 lines.**
- `__tests__/metadataDiffInspectorModel.test.ts` — pure-model unit tests (happy path + every predicate + edge cases + ban-list). **~300–380 lines.**
- `__tests__/MetadataDiffInspector.test.tsx` — component source-scan + (optional) RTL render of empty/populated states. **~120–160 lines.**

**Modified files**
- `src/features/metadata/index.ts` — re-export the new model + component (mirrors how `moveMetadataLedger` exports flow through `index.ts`). **~4–8 lines added; nothing removed.**
- `src/features/arguments/ArgumentGameSurface.tsx` — mount `MetadataDiffInspector` as a sibling overlay beside `NodeLabelInspectGroups`, gated on `inspectVisible && activeMessageId`, fed `metadataLedger.metadataEvents` + `activeMessageId`. **~14–22 lines added** (one JSX block + the import). **No existing logic changes; the existing `InspectPopout` and `NodeLabelInspectGroups` mounts are untouched.** This is the **only** production-host edit, and it follows the exact precedent the host already documents at lines 1620–1646.

**Deleted files**
- None.

---

## API / interface contracts

### Component — `MetadataDiffInspector.tsx`

```ts
export interface MetadataDiffInspectorProps {
  /** The selected move's id — the host's `activeMessageId`. */
  messageId: string;
  /**
   * The full in-session event stream, READ-ONLY, from the host's
   * `metadataLedger.metadataEvents`. The component filters to `messageId`
   * via the model; it never reads any other ledger field.
   */
  events: ReadonlyArray<MetadataEvent>;
  /** Resolved band for layout parity with the Inspect overlay siblings;
   *  defaults to 'tablet'. (Same prop convention as NodeLabelInspectGroups.) */
  band?: AnnotationBand;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough; default 'metadata-diff-inspector'. */
  testID?: string;
}
```

Internal behavior:
- Holds **only** local UI state: the active filter set (`Set<MetadataDiffFilterId>` via `useState`). No other state. The set starts empty (all rows shown).
- Computes the model with `useMemo(() => buildMetadataDiffInspectorModel({ events, messageId, activeFilters }), [events, messageId, activeFilters])`.
- Returns `null` when `model.isEmpty` **and** the host wants the silent path — but per the issue's acceptance criterion ("Empty state graceful"), the default is to render a one-line empty state (see Edge cases). The host gates mount on `inspectVisible && activeMessageId`, so the panel only appears while Inspect is open.

### Render structure + testIDs

- Root `View` testID=`metadata-diff-inspector`.
- A panel header row (reuses an existing `InspectGroupHeader` primitive from `src/features/nodeAnnotations/` for visual parity — **no new copy primitive**; the header label is sourced, not authored). testID=`metadata-diff-inspector-header`.
- Filter chip strip: one `Pressable` per chip, `accessibilityRole="button"`, `accessibilityState={{ selected: active, disabled: !available }}`, `hitSlop` to ≥ 44×44, testID=`metadata-diff-chip-<id>` (e.g. `metadata-diff-chip-added_tag`). A `count` badge per chip. An unavailable chip renders disabled (not removed) so the set is stable across moves.
- Row list: one row per `visibleRows` entry, testID=`metadata-diff-row-<rowId>`. Each row renders:
  - a leading kind marker (text glyph, not color — e.g. `+` add, `−` remove, `→` transition) with `accessibilityElementsHidden`,
  - the `signalDescription` line (`from → to` rendered as text for transitions),
  - the timestamp via the existing `formatDateTime` + `formatRelativeShort` helpers (already used by the admin events surface and Inspect), as **separate stacked `<Text>`** (no prose concatenation — same convention as Stage 6.1.6b tables).
- Empty state: testID=`metadata-diff-empty`, one line (see Edge cases for the exact sourced wording).

### What the component does NOT expose

No `onPress` that writes. No edit / delete / dismiss. No callback that mutates the ledger. The only interactivity is toggling local filter chips, which is pure view-state.

---

## Filter-chip predicates (exact mapping to `MetadataEvent` fields)

`MetadataEvent` fields in play: `kind ∈ {add, remove, transition}`, `codeFamily ∈ {manual_tag, auto_metadata, lifecycle_causation, semantic_override}`, `code` (string). The four chips map as follows. **Each predicate is a pure boolean over the event (plus, for `resolved_request`, the move's prior events).**

| Chip | `MetadataDiffFilterId` | Predicate |
| --- | --- | --- |
| **added tag** | `added_tag` | `kind === 'add' && codeFamily === 'manual_tag'`. A participant **applied** a manual gameplay tag to this move. (Does NOT include `auto_metadata` adds — those are Observations, not user tags; they surface in the unfiltered list and, where applicable, under `resolved_request`.) |
| **removed tag** | `removed_tag` | `kind === 'remove' && codeFamily === 'manual_tag'`. A participant **removed** a manual tag they had applied (or the move was deleted, which emits a `remove manual_tag` with debug `cause: 'message_deleted'` — `cause` is not rendered; the row still classifies as `removed_tag`). |
| **triggered transition** | `triggered_transition` | `kind === 'transition' && codeFamily === 'lifecycle_causation'`. This move **caused** a per-message or per-cluster lifecycle state change (snapshot-diff). The `code` is `${fromState}->${toState}`; the row splits it on `->` and maps each half through plain language for the `from → to` render. |
| **resolved request** | `resolved_request` | `kind === 'add' && codeFamily === 'auto_metadata' && (code === 'source_attached' || code === 'quote_attached')` **AND** the same move's earlier events contain a matching open request (`add auto_metadata source_requested` for a `source_attached`; `add auto_metadata quote_requested` for a `quote_attached`). This is the "a source/quote was asked for here, and this move answered it" case. **Fallback (no matching prior request found in-session):** the `source_attached` / `quote_attached` add is still a real Observation, so it renders in the **unfiltered** list, but it is **not** placed in the `resolved_request` bucket (we never claim a request was "resolved" when we have no in-session record of the request being opened — this avoids over-claiming when the request event predates the session). This fallback is the in-session-only honesty boundary the issue's dependency note (META-1A) flags. |

Notes that bind the implementer:
- **`semantic_override` events are intentionally unmapped by all four chips.** A `semantic_override` event (MCP-015) is neither a manual tag add/remove, nor a lifecycle transition, nor a request resolution. It therefore renders in the **unfiltered** list (its `code` is the contested classifier id, mapped through plain language — and **suppressed if it maps to null**), but no chip selects it. This is correct: the four chips are the issue's exact scope; we do not invent a fifth chip. (See Open question 1 if the operator wants a `semantic_override` chip later — that is a follow-up card, not META-1E.)
- A single event maps to **at most one** chip (the four predicates are mutually exclusive by construction: distinct `kind`×`codeFamily` combinations). `filterIds` is modeled as an array only for forward-compatibility and to let the resolved-request finalize step add a bucket without a type change.
- "No chip selected" = show all rows (the unfiltered timeline). Selecting one chip masks to that bucket. Selecting multiple chips OR-combines.

---

## Mount point (Cards-detail integration)

**LOCATED — the Cards-detail host surface exists.** It is the **Inspect popout** (`src/features/arguments/oneBox/InspectPopout.tsx`, QOL-032): the strictly read-only "understand" panel anchored to the selected node, mounted inside the Cards/Timeline game surface. The selected move is the host's `activeMessageId` (the single selection source of truth).

**Host file:** `src/features/arguments/ArgumentGameSurface.tsx`.

**Exact mount contract (follow the existing precedent verbatim):**
- The host already builds the metadata ledger once per render:
  `ArgumentGameSurface.tsx:570` — `const metadataLedger = useMemo(() => buildMoveMetadataLedger({...}), [...])`. `metadataLedger.metadataEvents` is the `MetadataEvent[]` the inspector consumes.
- The host already mounts the Inspect popout at `ArgumentGameSurface.tsx:1605` (`<InspectPopout visible={inspectVisible} … />`), gated by `inspectVisible` (`useState` at `:397`).
- The host already mounts a **sibling overlay** beside Inspect — `NodeLabelInspectGroups` at `ArgumentGameSurface.tsx:1626–1646` — under the comment "rendered alongside the Inspect popout when both Inspect is visible AND there is an active selected message. **Zero modification to InspectPopout.tsx.**" `MetadataDiffInspector` mounts the **same way**, immediately after that block:

```tsx
{inspectVisible && activeMessageId ? (
  <MetadataDiffInspector
    messageId={activeMessageId}
    events={metadataLedger.metadataEvents}
    band={inspectBand /* same band the NodeLabel overlay resolves */}
    testID="metadata-diff-inspector"
  />
) : null}
```

This means: **no modification to `InspectPopout.tsx` or `inspectContentBuilder.ts`.** The inspector is a self-contained sibling overlay, visible only while Inspect is open on a selected move, fed entirely from data the host already holds. The component is also fully self-contained (its only required prop is `messageId` + `events`), so it carries a documented mount contract and can be re-hosted by any future Cards-detail variant without change.

(An alternative — adding an eighth `InspectSection` inside `InspectPopout` via the `buildInspectLinkedPriorSection` additive-section precedent at `inspectPopoutModel.ts:757` — is viable but **rejected** for v1: it would couple META-1E to the fixed seven-section set and require touching `inspectContentBuilder`. The sibling-overlay path is lower-risk and is the host's own established pattern.)

---

## Edge cases

- **No events for the move (empty).** `model.isEmpty === true`. Render a single sourced empty-state line — reuse the established "nothing here" pattern (e.g. the Inspect `INSPECT_EMPTY_BODY.matters`-style wording "No recorded changes on this move yet." — see Open question 2 on whether this counts as new copy; if so it becomes a one-key `gameCopy` addition). Never render a blank panel; never render a chip count of a non-existent bucket as anything but disabled-with-0.
- **Exactly one event.** Renders one row; no `from` half unless it is a transition. The chip whose bucket it belongs to shows `count: 1` and is available; the other three chips render disabled with `count: 0`.
- **`semantic_override` event.** Renders in the unfiltered list with its contested-classifier code mapped through `toPlainLanguage`; **suppressed (row dropped) if the code maps to null.** No chip selects it (by design — see predicates). No `from`/`to` halves (it is not a transition).
- **Unknown / unmapped `code` (any family).** The row is **dropped** at derivation (`deriveMetadataDiffRows` skips any event whose `code` maps to `null` via plain language). The raw code is **never echoed**. This is the doctrine §9 / §10a "suppress, don't echo" rule, enforced by a test.
- **`lifecycle_causation` code that does not split cleanly on `->`** (defensive — should never happen given META-001's format). If either half maps to null, drop the row (do not render a half-mapped `… → ` line). Covered by a test.
- **`cause` is present on the event.** Ignored. The view-model never copies `cause` onto `MetadataDiffRow`; no render path can reach it. Covered by a test that asserts `JSON.stringify(rows)` contains no `cause` key.
- **Many events (long timeline).** The list is plain (chronological, oldest→newest). No pagination in v1 (a single move's event count is bounded by its tag/metadata/transition activity). The container is scrollable via the host overlay; the component itself adds no `FlatList` (consistent with `NodeLabelInspectGroups`, which renders a bounded list).
- **Move changes while Inspect stays open.** `messageId` prop changes → `useMemo` recomputes → the panel re-renders for the new move, active filters reset is **not** required (filters are view preferences; keeping them is fine and matches the Inspect section-expand behavior). Covered by a model test (different `messageId` → different rows).
- **Events for other moves in the stream.** `deriveMetadataDiffRows` filters by `messageId`; events for sibling moves never appear. Covered by a test with a mixed-move stream.
- **Duplicate `eventId` (defensive).** `rowId` = `eventId`; React key collisions are avoided because META-001's `eventId` is `${kind}:${family}:${code}:${messageId}:${at}` (stable + unique per logical change). The stable secondary sort key (`eventId`) keeps order deterministic when two events share a millisecond.
- **Permission / observer viewer.** The panel is read-only and shows **machine Observations** only; there is no apply/remove affordance, so observer-vs-participant has no effect on what renders. (META-1E never gates by role — the data it shows is not role-sensitive; it is the move's own change history. The apply/remove **write** eligibility lives in META-001/SC-004, out of scope here.)

---

## Test plan

All counts must go UP. Pure-model tests import the model directly (no React/Supabase). Component tests follow the repo's source-scan + pure-helper pattern (`NodeLabelInspectGroups.test.tsx` precedent).

**`__tests__/metadataDiffInspectorModel.test.ts` (pure model — required coverage on every public function)**
- `deriveMetadataDiffRows` happy path: a move with one add, one remove, one transition, one resolved-request → four rows, correct `kind`/`toLabel`/`signalDescription`/`fromLabel`, chronological order.
- `deriveMetadataDiffRows` filters by `messageId`: a mixed-move stream yields only the target move's rows.
- `deriveMetadataDiffRows` drops unknown codes: an event with a bogus `code` (every family) → row dropped, raw code never present in output.
- `deriveMetadataDiffRows` transition split: `code='open->rebutted'` → `fromLabel='Open for response'`, `toLabel='Under pressure'`; malformed `'open->'` → dropped.
- `filterIdsForEvent` — one assertion per predicate:
  - `add`+`manual_tag` → `['added_tag']`.
  - `remove`+`manual_tag` (incl. a `cause:'message_deleted'` event) → `['removed_tag']`.
  - `transition`+`lifecycle_causation` → `['triggered_transition']`.
  - `add`+`auto_metadata source_attached` with a prior `source_requested` on the move → `['resolved_request']`; without a prior request → `[]` (renders unfiltered, not in bucket).
  - `add`+`auto_metadata` non-attach code (e.g. `has_reply`) → `[]`.
  - `semantic_override` event → `[]` (unmapped by all chips).
- `buildMetadataDiffInspectorModel`:
  - empty events → `isEmpty: true`, all chips `available:false count:0`, `visibleRows: []`.
  - no active filters → `visibleRows === allRows`.
  - single active filter → masks correctly; `count` per chip matches.
  - multiple active filters → OR-combined.
  - `available` reflects per-move bucket presence; `active` reflects the input set.
- `cause` never leaks: `expect(JSON.stringify(rows)).not.toContain('"cause"')` and no row value equals any event's `cause` string.

**`__tests__/MetadataDiffInspector.test.tsx` (component)**
- Source-scan: imports `metadataDiffInspectorModel`; imports no `supabase`, no `fetch`, no router (`metadataForbiddenImports.test.ts` precedent — extend or mirror).
- Source-scan: no hex color literals (uses `designTokens`).
- Source-scan: renders the four chip testIDs + the row/empty testIDs; chips carry `accessibilityRole="button"` + `accessibilityState`.
- (Optional RTL, JSDOM) empty-events render → `metadata-diff-empty` present, no rows. Populated render → expected `metadata-diff-row-*` count, chip counts correct.

**Doctrine / plain-language (required — ban-list)**
- **No raw code leaks:** build a model over a stream covering **every** `ManualTagCode`, **every** `AutoMetadataCode`, a representative set of lifecycle `from->to` codes, and a `semantic_override` code; assert no rendered string (`toLabel`/`fromLabel`/`signalDescription`/empty line/chip labels) matches `looksLikeInternalCode` and contains no `_`-snake_case token from the source vocabularies.
- **No verdict tokens:** reuse `_forbiddenMetadataTokens()` from `moveMetadataLedger.ts` — assert no rendered string contains any banned token (verdict / amplification / block-prevent). This is the same helper `metadataDoctrineAnchors.test.ts` already uses, so the ban-list stays single-source.
- **Observation framing:** assert the authored connective verbs ("Tag added", "Tag removed", "Observed", "Request resolved") contain no person-attribution ("you"/"they"/a username) and no verdict token — these describe the **move**, not a person (§10a).

---

## Dependencies (cards / docs / files)

- **Assumes META-001 is complete** (it is — merged). META-1E consumes `MetadataEvent` + `MoveMetadataLedger.metadataEvents` verbatim; it adds no new event kind. Reads `moveMetadataLedger.ts` at `buildMoveMetadataLedger` (the event stream producer) and the plain-language helpers `getManualTagPlainLabel` / `getAutoMetadataPlainLabel`.
- **Reads `gameCopy.ts`** at `toPlainLanguage` / `PLAIN_LANGUAGE_COPY` — the single plain-language source. All 19 `PointLifecycleState` values + all 10 manual + all 16 auto codes are already mapped there (verified), so the from→to render and the add/remove render have full label coverage today.
- **Reads `ArgumentGameSurface.tsx`** at the `metadataLedger` memo (`:570`) + the `NodeLabelInspectGroups` sibling-overlay mount (`:1626–1646`) — the exact integration precedent.
- **Reuses `formatDateTime` + `formatRelativeShort`** (`src/lib/formatDateTime.ts`) for the per-row timestamp, and the `InspectGroupHeader` / `designTokens` primitives for visual parity — **no new visual primitive, no new copy primitive.**
- **HIST-001 (not yet filed) — soft dependency / shared UX, NOT a blocker for design.** The issue says "Do not implement yet — wait for HIST-001 to land (they share UX patterns)." That is an **implementation-sequencing** gate the operator owns, not a design gate. This design is self-contained and does not depend on any HIST-001 artifact. **Open question 1** surfaces the sequencing decision for the operator. When HIST-001 lands, the two surfaces should share the row/header/timestamp grammar defined here.
- **META-1A (persistence) — optional, recommended.** META-1A persists manual tags to `public.point_tags`, which the host already hydrates into the ledger (`pointTagsByArgumentId` → `manualTagsByMessageId`). Without META-1A, the inspector shows **in-session** events only (e.g. tag adds/removes + transitions that occurred this session). This is the honesty boundary baked into the `resolved_request` fallback. **No code dependency** — the inspector consumes whatever events the ledger holds.

**This card blocks:** nothing hard. It is a leaf consumer of META-001. HIST-001 should reuse this row grammar.

---

## Risks

- **Risk 1 — `resolved_request` is in-session-only without META-1A.** `auto_metadata` is computed per-render and is **not** persisted (the admin META-1C surface explicitly dropped its lifecycle/auto chip for this reason). So a request opened in a prior session, then resolved this session, will not be recognized as "resolved" (no in-session record of the open). **Mitigation:** the predicate's documented fallback renders the `source_attached`/`quote_attached` add in the unfiltered list but does not over-claim "resolved." A test pins this. The operator should know the chip is best-effort until/unless META-1A persists the auto layer (it currently persists only manual tags). **Surface to operator** (Open question 3).
- **Risk 2 — `metadataEvents` is a diff between two ledger renders.** `composeMetadataEvents` (META-001) emits events by diffing `previousLedger` vs the new ledger. In `ArgumentGameSurface.tsx:570` the `buildMoveMetadataLedger` call does **not** pass `previousLedger`/`previousLifecycleMap`, so on a cold render the event stream may be sparse (the host accumulates events across renders elsewhere, or via the apply/remove operations which append events directly). **Mitigation:** the inspector treats `events` as an opaque read — it renders exactly what the ledger holds and degrades gracefully (empty state) when the stream is thin. The implementer must **not** try to re-derive events inside the inspector (that would duplicate META-001 and risk drift). A test asserts the inspector renders correctly for both a rich and a thin stream. **Note for the implementer:** confirm at build time whether the host's `metadataLedger.metadataEvents` is the accumulated stream or a single-render diff; if it is single-render-thin, the host wiring (not the inspector) is where any accumulation belongs, and that is a host concern outside this card's component.
- **Risk 3 — chip label "new copy" interpretation.** The four chip labels + the empty-state line are arguably "new user-facing copy," which the issue says is not required. **Mitigation:** they are sourced verbatim from the issue's own scope text; if the reviewer rules them as new copy, they move into a tiny additive `gameCopy` block (4–5 keys) covered by the existing plain-language coverage test. The predicates/structure are unaffected. **Open question 2.**
- **Risk 4 — `formatDateTime` import surface.** Confirm `formatDateTime` / `formatRelativeShort` are exported where the admin surface imports them; reuse the same import path to avoid a second formatter. Low risk (already used in multiple surfaces).
- **Risk 5 — overlay stacking with `NodeLabelInspectGroups`.** Both overlays mount while Inspect is open. The implementer must ensure they stack/scroll sanely (the host already places `NodeLabelInspectGroups` as a sibling; `MetadataDiffInspector` goes adjacent). This is a layout detail for the host edit, verified visually/by the host's existing overlay container. No model impact.

---

## Out of scope (explicit — reduces scope creep)

- **HIST-001 lifecycle event history** — separate card. META-1E renders the per-move `MetadataEvent` diff; HIST-001 is the broader lifecycle history surface. Do not build it here.
- **Editing event history / any write path** — the surface is strictly read-only, append-only display. No apply, remove, dismiss, undo.
- **The `cause` field** — debug-only (AN-003); never rendered.
- **A fifth filter chip** (e.g. `semantic_override`, `observed metadata`) — the issue's four chips are binding. `semantic_override` and non-resolving `auto_metadata` events render in the unfiltered list but get no chip. A new chip is a follow-up card.
- **Persisting the auto-metadata / event layer** — META-1A persists manual tags only; persisting auto metadata is a separate data-model card.
- **Admin restyle / reuse** — META-1E does NOT reuse `AdminMetadataEventsTab` styling or its `MetadataAuditEvent` type (that surface reads the persisted `point_tags` table and handles manual tags only). META-1E reads the richer in-session `MoveMetadataLedger.metadataEvents`.
- **Pagination / virtualization** — a single move's event count is bounded; no `FlatList` in v1.
- **Role gating / eligibility** — the inspector shows non-role-sensitive change history; apply/remove eligibility lives in META-001/SC-004.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; no service-role):** the inspector renders **machine Observations** about a move's structural/lifecycle change. It carries no strength band, no winner/loser, no truth value. It is pure display — it cannot block anything. No Supabase, no service-role, no Edge call (it reads in-memory props). The ban-list test (`_forbiddenMetadataTokens`) enforces zero verdict tokens in any rendered string. **Respected.**
- **§2 (heat = activity, not truth) / §3 (popularity ≠ evidence):** the inspector reads only `MetadataEvent` (tag/auto/lifecycle/override codes). It reads **no** heat, engagement, view-count, or popularity field — none exist on `MetadataEvent`. The ban-list includes amplification tokens; a test pins their absence. **Respected.**
- **§4 (AI moderator limits):** no AI call, no flag authoring, no client-side inference. Pure render of existing deterministic events. **Respected.**
- **§9 (plain language for users):** every `code` maps through `toPlainLanguage` / the META-001 typed helpers; **unknown codes are dropped (suppressed), never echoed.** A test maps every vocabulary code and asserts no snake_case / `looksLikeInternalCode` string survives to render. **Respected.**
- **§10a (Observations vs Allegations — the load-bearing constraint for this card):**
  - The events rendered are **machine-generated** (auto metadata, lifecycle causation, semantic override) and **participant-applied manual tags**. Manual tags are user-applied gameplay annotations (the "Allegation"-adjacent class), but META-1E renders them as **change facts about the move** ("Tag added: Needs source"), never as "User X accused this of Y." No event field carries a person's identity into the render (the inspector does not render `appliedByUserId`); it renders only *what changed on the move*.
  - The connective verbs ("Tag added", "Observed", "Request resolved", "<from> → <to>") describe the **move's contribution**, never a person's intent or a verdict. A test asserts no person-attribution token and no verdict token in any authored fragment.
  - No raw classifier IDs reach the UI (the `semantic_override` contested-classifier `code` is mapped through plain language and **suppressed if unmapped**). **Respected.**
- **§10 v1 scope guards:** no voting/winner, no editing, no OAuth, no public API, no push, no search. Read-only display. **Respected.**
- **test-discipline:** new pure model with unit coverage on every public function; component tested via source-scan + optional RTL; ban-list + plain-language coverage tests; counts go up. **Respected.**

---

## Open questions for the operator

1. **HIST-001 sequencing.** The issue says "wait for HIST-001 to land (shared UX patterns)." This **design** is complete and self-contained, but should the **implementation** be held until HIST-001 is filed so the two share one row/header grammar — or should META-1E ship first and define the grammar HIST-001 inherits? (Design recommends: META-1E may ship first; it defines a clean row grammar HIST-001 can reuse. No hard dependency.)
2. **Chip + empty-state strings as "new copy."** The four chip labels ("Added tag" / "Removed tag" / "Resolved request" / "Triggered transition") and the empty-state line come from the issue scope, but the issue also says "no new copy required." Confirm whether these may be authored inline as sourced-from-issue strings, or must be added as a tiny `gameCopy` block (4–5 keys) under the plain-language coverage test. (Design recommends: add them to `gameCopy` so the plain-language coverage test owns them — safest.)
3. **`resolved_request` honesty boundary.** Without META-1A persisting the **auto** layer, "resolved request" is in-session-only (Risk 1). Confirm the operator accepts the documented fallback (render the attach as a normal Observation, do not claim "resolved" when the open-request event isn't in the session). (Design recommends: accept the fallback; it is the doctrine-safe non-over-claiming choice.)

## Operator steps (if any)

**None — pure code change.** No migration, no Edge Function deploy, no env var. The inspector reads in-memory props the host already holds. (If META-1A persistence is deployed later, the `resolved_request` chip improves automatically with no META-1E change.)
