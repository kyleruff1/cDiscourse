/**
 * META-1E — Cards-detail metadata diff inspector (pure TypeScript model).
 *
 * Derives a read-only "what changed on this move" timeline from the existing
 * `MetadataEvent[]` stream (META-001) for one selected move, plus the view
 * state for four filter chips. This file authors NO new persisted data, NO
 * new event kind, and NO new user-facing copy — the chip labels + connective
 * verbs are sourced from `METADATA_DIFF_INSPECTOR_COPY` in `gameCopy.ts`.
 *
 * Doctrine anchor — read before changing anything:
 *
 *   §9 / §10a (plain language; Observations vs Allegations): every event
 *     `code` is mapped through `toPlainLanguage`. An unknown / unmapped code
 *     is DROPPED (suppressed), never echoed. The rendered rows describe
 *     WHAT CHANGED ON THE MOVE (a machine Observation), never "what a person
 *     did" — no person id, no `appliedByUserId`, ever reaches a row.
 *   §1–§3 (no verdict / heat / popularity): the model reads only
 *     `MetadataEvent` (tag / auto / lifecycle / override codes). It reads no
 *     heat, engagement, view-count, or popularity field — none exist on the
 *     event. Authored connective verbs are ban-list-clean.
 *   AN-003: `MetadataEvent.cause` is debug-only. It is NEVER copied onto a
 *     `MetadataDiffRow` and NEVER read by any code path here.
 *
 * Pure TS. No React. No Supabase. No network. No `Date.now()`. No mutation
 * of any input. JSON-serializable I/O. Deterministic.
 */

import type { MetadataEvent } from './moveMetadataLedger';
import {
  METADATA_DIFF_INSPECTOR_COPY,
  toPlainLanguage,
} from '../arguments/gameCopy';

// ── Filter vocabulary ──────────────────────────────────────────

/** The four Cards-detail filter chips (issue #80 scope, binding). */
export type MetadataDiffFilterId =
  | 'added_tag'
  | 'removed_tag'
  | 'resolved_request'
  | 'triggered_transition';

/** Frozen array — tests + the chip strip iterate this. */
export const ALL_METADATA_DIFF_FILTERS: ReadonlyArray<MetadataDiffFilterId> =
  Object.freeze([
    'added_tag',
    'removed_tag',
    'resolved_request',
    'triggered_transition',
  ]);

/** Plain-language chip labels (sourced from gameCopy; issue #80 verbatim). */
export const METADATA_DIFF_FILTER_LABEL: Readonly<
  Record<MetadataDiffFilterId, string>
> = Object.freeze({
  added_tag: METADATA_DIFF_INSPECTOR_COPY.chipAddedTag,
  removed_tag: METADATA_DIFF_INSPECTOR_COPY.chipRemovedTag,
  resolved_request: METADATA_DIFF_INSPECTOR_COPY.chipResolvedRequest,
  triggered_transition: METADATA_DIFF_INSPECTOR_COPY.chipTriggeredTransition,
});

/** Verbose a11y labels for each chip (screen-reader, ≤ 80 chars). */
export const METADATA_DIFF_FILTER_ACCESSIBILITY_LABEL: Readonly<
  Record<MetadataDiffFilterId, string>
> = Object.freeze({
  added_tag: METADATA_DIFF_INSPECTOR_COPY.chipAddedTagA11y,
  removed_tag: METADATA_DIFF_INSPECTOR_COPY.chipRemovedTagA11y,
  resolved_request: METADATA_DIFF_INSPECTOR_COPY.chipResolvedRequestA11y,
  triggered_transition:
    METADATA_DIFF_INSPECTOR_COPY.chipTriggeredTransitionA11y,
});

// ── One rendered diff row ──────────────────────────────────────

/**
 * One render-ready row. The component renders these verbatim; it derives
 * nothing. `cause` is NEVER carried onto this shape — it is stripped at
 * derivation time and never reaches a render path.
 */
export interface MetadataDiffRow {
  /** Stable key = the source `MetadataEvent.eventId`. */
  rowId: string;
  /** The event kind, retained for the per-row marker + a11y. */
  kind: 'add' | 'remove' | 'transition';
  /** Which filter buckets this row belongs to (0..n; usually exactly 1). */
  filterIds: ReadonlyArray<MetadataDiffFilterId>;
  /**
   * The "from" half. Non-null ONLY for a lifecycle transition row (the
   * pre-move state, plain-language-mapped). Null for add/remove rows.
   */
  fromLabel: string | null;
  /**
   * The "to" half. The plain-language label of the code that changed:
   *  - add/remove → the tag/metadata code's plain label.
   *  - transition → the post-move state's plain label.
   * ALWAYS a non-empty plain-language string for a row that survived
   * derivation (a row whose code maps to null is DROPPED, not emitted).
   */
  toLabel: string;
  /**
   * The one-line "what changed on this move" signal description, assembled
   * ONLY from already-plain labels + a fixed connective verb per kind.
   */
  signalDescription: string;
  /** ISO-8601 timestamp from the source event (stable chronological order). */
  at: string;
  /** Provenance — which code family produced this row (a11y + tests). */
  codeFamily: MetadataEvent['codeFamily'];
}

// ── The full view-model ────────────────────────────────────────

/** Per-chip view-state row in the model. */
export interface MetadataDiffFilterState {
  id: MetadataDiffFilterId;
  label: string;
  accessibilityLabel: string;
  /** False when this move has zero rows in the bucket — render disabled. */
  available: boolean;
  /** Rows in this bucket for this move. */
  count: number;
  /** True when the chip is in the active-filter set. */
  active: boolean;
}

export interface MetadataDiffInspectorModel {
  /** All derived rows for the selected move, chronological (oldest→newest). */
  allRows: ReadonlyArray<MetadataDiffRow>;
  /**
   * Rows after the active-filter mask. Equal to `allRows` when
   * `activeFilters` is empty (no chip selected = show everything).
   */
  visibleRows: ReadonlyArray<MetadataDiffRow>;
  /** Per-chip availability + count + active state (stable across moves). */
  filters: ReadonlyArray<MetadataDiffFilterState>;
  /** True when `allRows` is empty — the host renders the empty state. */
  isEmpty: boolean;
}

// ── Internal — auto-metadata "request" codes ───────────────────

/** Auto codes that OPEN a request (the prior half of `resolved_request`). */
const REQUEST_OPEN_CODE_BY_ATTACH: Readonly<Record<string, string>> =
  Object.freeze({
    source_attached: 'source_requested',
    quote_attached: 'quote_requested',
  });

function isResolvingAttachCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    REQUEST_OPEN_CODE_BY_ATTACH,
    code,
  );
}

// ── Internal — sort + safety helpers ───────────────────────────

function eventTimeMs(at: string): number {
  const t = new Date(at).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Stable chronological sort: by `at` (real ms), tie-break by `eventId`. */
function chronologicalByEvent(a: MetadataEvent, b: MetadataEvent): number {
  const ta = eventTimeMs(a.at);
  const tb = eventTimeMs(b.at);
  if (ta !== tb) return ta - tb;
  return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
}

// ── Public — context-free predicate ────────────────────────────

/**
 * Map one `MetadataEvent` to the filter buckets it belongs to (context-free
 * portion). Three of the four predicates are pure single-event booleans:
 *
 *   added_tag            → kind 'add'        + family 'manual_tag'
 *   removed_tag          → kind 'remove'     + family 'manual_tag'
 *   triggered_transition → kind 'transition' + family 'lifecycle_causation'
 *
 * The fourth — `resolved_request` — needs the move's prior events to know a
 * matching request was opened in-session, so it is finalized inside
 * `deriveMetadataDiffRows`. This function therefore returns [] for an
 * `auto_metadata` attach add (it is bucketed later if a prior open exists),
 * and [] for `semantic_override` and every non-matching event (those still
 * render in the unfiltered list, but no chip selects them).
 */
export function filterIdsForEvent(
  event: MetadataEvent,
): ReadonlyArray<MetadataDiffFilterId> {
  if (!event) return [];
  if (event.kind === 'add' && event.codeFamily === 'manual_tag') {
    return ['added_tag'];
  }
  if (event.kind === 'remove' && event.codeFamily === 'manual_tag') {
    return ['removed_tag'];
  }
  if (
    event.kind === 'transition' &&
    event.codeFamily === 'lifecycle_causation'
  ) {
    return ['triggered_transition'];
  }
  // `resolved_request` is context-dependent → finalized in derivation.
  // `auto_metadata` adds + `semantic_override` events return [] here.
  return [];
}

// ── Internal — build one row (or null to drop) ─────────────────

interface BuildRowContext {
  /** True when this move had an in-session matching open request for an
   *  `auto_metadata` attach event (drives the `resolved_request` bucket). */
  resolvedRequest: boolean;
}

function buildRow(
  event: MetadataEvent,
  ctx: BuildRowContext,
): MetadataDiffRow | null {
  const family = event.codeFamily;

  // ── Lifecycle transition: split `${from}->${to}` and map each half. ──
  if (event.kind === 'transition' && family === 'lifecycle_causation') {
    const parts = String(event.code).split('->');
    if (parts.length !== 2) return null; // malformed → drop (defensive).
    const fromRaw = parts[0];
    const toRaw = parts[1];
    if (!fromRaw || !toRaw) return null; // empty half (e.g. 'open->') → drop.
    const fromLabel = toPlainLanguage(fromRaw);
    const toLabel = toPlainLanguage(toRaw);
    if (fromLabel === null || toLabel === null) return null; // half unmapped.
    return {
      rowId: event.eventId,
      kind: 'transition',
      filterIds: filterIdsForEvent(event),
      fromLabel,
      toLabel,
      signalDescription: `${fromLabel} ${METADATA_DIFF_INSPECTOR_COPY.transitionArrow} ${toLabel}`,
      at: event.at,
      codeFamily: family,
    };
  }

  // ── Add / remove rows: map the single code; drop if unmapped. ──
  if (event.kind === 'add' || event.kind === 'remove') {
    const toLabel = toPlainLanguage(event.code);
    if (toLabel === null) return null; // unknown code → suppressed, never echoed.

    const filterIds = [...filterIdsForEvent(event)];
    let verb: string;
    if (event.kind === 'add' && family === 'manual_tag') {
      verb = METADATA_DIFF_INSPECTOR_COPY.signalTagAdded;
    } else if (event.kind === 'remove' && family === 'manual_tag') {
      verb = METADATA_DIFF_INSPECTOR_COPY.signalTagRemoved;
    } else if (
      event.kind === 'add' &&
      family === 'auto_metadata' &&
      ctx.resolvedRequest &&
      isResolvingAttachCode(event.code)
    ) {
      // In-session open request found → this attach resolved it.
      verb = METADATA_DIFF_INSPECTOR_COPY.signalRequestResolved;
      if (!filterIds.includes('resolved_request')) {
        filterIds.push('resolved_request');
      }
    } else {
      // Every other Observation add/remove (auto_metadata without a prior
      // open request, `semantic_override`, etc.) → neutral "Observed".
      verb = METADATA_DIFF_INSPECTOR_COPY.signalObserved;
    }

    return {
      rowId: event.eventId,
      kind: event.kind,
      filterIds: Object.freeze(filterIds),
      fromLabel: null,
      toLabel,
      signalDescription: `${verb}: ${toLabel}.`,
      at: event.at,
      codeFamily: family,
    };
  }

  // Unhandled kind (defensive) → drop.
  return null;
}

// ── Public — derive all rows for one move ──────────────────────

/**
 * Derive every diff row for one move from the full event stream.
 * - Filters `events` to `event.messageId === messageId`.
 * - Maps each event's `code` through plain language; DROPS any event whose
 *   code maps to null (unknown code → suppressed, never echoed).
 * - Computes `fromLabel` / `toLabel` / `signalDescription` / `filterIds`.
 * - Sorts chronologically by `at` (real Date.getTime()), stable secondary
 *   key = `eventId`.
 * Pure. Deterministic. O(n) over the move's events.
 */
export function deriveMetadataDiffRows(
  events: ReadonlyArray<MetadataEvent>,
  messageId: string,
): ReadonlyArray<MetadataDiffRow> {
  if (!Array.isArray(events) || typeof messageId !== 'string' || messageId.length === 0) {
    return Object.freeze([]);
  }

  // Filter to this move, then sort chronologically (stable).
  const moveEvents = events
    .filter((e) => e && e.messageId === messageId)
    .slice()
    .sort(chronologicalByEvent);

  // Per-move pre-pass: which attach codes have a matching in-session open
  // request that PRECEDES them chronologically. We only treat an attach as
  // "resolved" when its open request appears earlier in the (sorted) move
  // stream — this is the design's in-session honesty boundary.
  const openSeen = new Set<string>(); // open codes seen so far (e.g. 'source_requested').
  const resolvedEventIds = new Set<string>();
  for (const e of moveEvents) {
    if (e.kind === 'add' && e.codeFamily === 'auto_metadata') {
      if (e.code === 'source_requested' || e.code === 'quote_requested') {
        openSeen.add(e.code);
        continue;
      }
      if (isResolvingAttachCode(e.code)) {
        const needed = REQUEST_OPEN_CODE_BY_ATTACH[e.code];
        if (openSeen.has(needed)) {
          resolvedEventIds.add(e.eventId);
        }
      }
    }
  }

  const rows: MetadataDiffRow[] = [];
  for (const e of moveEvents) {
    const row = buildRow(e, { resolvedRequest: resolvedEventIds.has(e.eventId) });
    if (row !== null) rows.push(row);
  }
  return Object.freeze(rows);
}

// ── Public — build the full inspector view-model ───────────────

/**
 * Build the full inspector view-model for a move + the active filter set.
 * `activeFilters` empty → `visibleRows === allRows`. Multiple active filters
 * are OR-combined (a row is visible if it is in ANY active bucket). Pure.
 * Deterministic. Idempotent.
 */
export function buildMetadataDiffInspectorModel(input: {
  events: ReadonlyArray<MetadataEvent>;
  messageId: string;
  activeFilters: ReadonlyArray<MetadataDiffFilterId>;
}): MetadataDiffInspectorModel {
  const allRows = deriveMetadataDiffRows(input.events, input.messageId);

  // Normalize the active set to the four known ids only (defensive).
  const activeSet = new Set<MetadataDiffFilterId>();
  if (Array.isArray(input.activeFilters)) {
    for (const f of input.activeFilters) {
      if (ALL_METADATA_DIFF_FILTERS.includes(f)) activeSet.add(f);
    }
  }

  // Per-bucket counts for this move.
  const countById: Record<MetadataDiffFilterId, number> = {
    added_tag: 0,
    removed_tag: 0,
    resolved_request: 0,
    triggered_transition: 0,
  };
  for (const row of allRows) {
    for (const fid of row.filterIds) {
      countById[fid] += 1;
    }
  }

  // Visible rows: empty active set → all rows; else OR-combine the buckets.
  const visibleRows =
    activeSet.size === 0
      ? allRows
      : Object.freeze(
          allRows.filter((row) =>
            row.filterIds.some((fid) => activeSet.has(fid)),
          ),
        );

  const filters: MetadataDiffFilterState[] = ALL_METADATA_DIFF_FILTERS.map(
    (id) => ({
      id,
      label: METADATA_DIFF_FILTER_LABEL[id],
      accessibilityLabel: METADATA_DIFF_FILTER_ACCESSIBILITY_LABEL[id],
      available: countById[id] > 0,
      count: countById[id],
      active: activeSet.has(id),
    }),
  );

  return {
    allRows,
    visibleRows,
    filters: Object.freeze(filters),
    isEmpty: allRows.length === 0,
  };
}
