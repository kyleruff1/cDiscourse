/**
 * REF-006-RAIL — Open Issues rail model (the thin pure iterator).
 *
 * Pure TypeScript. No React. No Supabase. No network. No AI. No `Date.now`.
 *
 * This module is a PRESENTATION-LAYER PROJECTION over many nodes'
 * already-derived `OpenIssue` (`DisagreementContract`) objects. REF-002's
 * `buildOpenIssue` stays the SINGLE derivation home; the HOST builds each
 * candidate's issue and hands this iterator the already-built `OpenIssue[]`
 * plus two cheap ordering facts per candidate (a recency index + an isActive
 * flag). The iterator only:
 *   1. FILTERS to the genuinely-open set (`isOpenIssue`).
 *   2. ORDERS by procedural urgency, then recency, then id (`compareLedgerCandidates`).
 *   3. CAPS the list (`maxEntries`) with an honest overflow count.
 *   4. SHAPES compact rows (`OpenIssueLedgerEntry`).
 *
 * It re-derives NOTHING: it never calls `buildOpenIssue`, `buildActPopout`,
 * `selectBanner`, `deriveSuggestedMoves`, or `adaptAllSourcesForNode`. Any
 * change to issue SEMANTICS belongs in `refereeLoop/`, not here.
 *
 * Doctrine that shapes every line (cdiscourse-doctrine §1/§2/§3/§4/§5/§9/§10a;
 * REF-ADR-001 ratified):
 *   - Consultative, post-storage, display-only. NEVER in any submit/accept
 *     path; the deterministic Constitution engine is the sole gate.
 *   - Ordering reads ONLY `IssueBurden` / `IssueState` / chronological index /
 *     `issue.id`. Heat / popularity / engagement / virality / view count /
 *     strength band / score are NEVER an input anywhere in this module.
 *   - Every emitted user-facing string is a frozen REF-002 plain-language atom
 *     (`ISSUE_STATE_LABEL` / `BURDEN_LABEL` / `AXIS_LABEL` /
 *     `ISSUE_STATE_TERMINAL_LINE`) or an `OPEN_ISSUES_RAIL_COPY` chrome string;
 *     no truth / winner / loser / motive / "bad faith" token; no raw code.
 *   - Renders ZERO `userAllegations` and ZERO raw Observation codes; Family J
 *     is re-asserted out upstream by REF-002 and never read here.
 */

import type {
  OpenIssue,
  IssueState,
  IssueBurden,
  DisagreementAxis,
  RelationToParent,
  MoveSuggestion,
} from '../../refereeLoop';
import {
  ISSUE_STATE_LABEL,
  BURDEN_LABEL,
  AXIS_LABEL,
  ISSUE_STATE_TERMINAL_LINE,
} from '../../refereeLoop';
import type { PointLifecycleState } from '../../lifecycle';

// ════════════════════════════════════════════════════════════════
// Layer-1 host pre-filter vocabulary (D2)
//
// Frozen data the HOST consults to pick a cheap candidate superset BEFORE any
// expensive per-node build (no `buildOpenIssue`, no `adaptAllSourcesForNode`).
// The pure iterator below still makes the exact open/closed decision via
// `isOpenIssue`; these sets only bound the build cost. They live here (not in
// the host file) so the frozen vocabulary is unit-testable and so the host
// never inlines a raw classifier code literal.
// ════════════════════════════════════════════════════════════════

/** Defensive build ceiling: only the K most-recent candidates are assembled. */
export const OPEN_ISSUES_RAIL_BUILD_CAP = 48;

/**
 * Lifecycle cluster states that are CLOSED for rail purposes — a node whose
 * cluster state is one of these (and has no open debt / live tag) is dropped
 * by the cheap pre-filter. The complement {open, rebutted, quote_requested,
 * source_requested, narrowed, conceded, synthesis_ready} makes a node a
 * candidate.
 */
export const CLOSED_LIFECYCLE_STATES: ReadonlySet<PointLifecycleState> =
  new Set<PointLifecycleState>([
    'answered',
    'clarified',
    'sourced',
    'confirmed',
    'archived_or_resolved',
    'moved_on_by_affirmative',
    'moved_on_by_negative',
    'ignored_by_affirmative',
    'ignored_by_negative',
    'ignored_by_both',
    'exhausted',
    'branch_recommended',
  ]);

/**
 * Live manual-tag / auto-metadata codes that, when present on a node, force it
 * into the candidate set regardless of lifecycle state (a debt / clarify /
 * scope signal that has not yet flowed into a non-terminal lifecycle state).
 */
export const CANDIDATE_SIGNAL_TAGS: ReadonlySet<string> = new Set<string>([
  'needs_source',
  'needs_quote',
  'definition_issue',
  'scope_issue',
  'causal_mechanism',
  'evidence_debt',
  'concession_offered',
  'narrowed_claim',
  'ready_for_synthesis',
  'tangent',
  'branch_suggested',
  'no_response_after_n_turns',
]);

// ════════════════════════════════════════════════════════════════
// Public shapes
// ════════════════════════════════════════════════════════════════

/**
 * A built `OpenIssue` + the cheap ordering facts the host supplies per
 * candidate node. The HOST builds `issue` via REF-002's `buildOpenIssue`
 * (single derivation home); this iterator never re-derives.
 */
export interface OpenIssueLedgerCandidate {
  issue: OpenIssue;
  /** Target node's index in `chronologicalIds`. Higher = more recent. */
  recencyIndex: number;
  /** True when this candidate's target node is the currently-active node. */
  isActive: boolean;
}

/**
 * One rendered ledger row. Every string is plain-language, ban-list clean,
 * and free of raw codes (no `issue.id`, no `sourceCode`, no `rawKey`).
 */
export interface OpenIssueLedgerEntry {
  /** React key + test handle — equals `issue.id`; NEVER rendered as text. */
  key: string;
  /** For jump / inspect / move routing. */
  targetNodeId: string;
  state: IssueState;
  burden: IssueBurden;
  axis: DisagreementAxis;
  relationToParent: RelationToParent;
  /** Primary plain label — `ISSUE_STATE_LABEL[state]`. */
  stateLabel: string;
  /**
   * Secondary plain line — `${BURDEN_LABEL} · ${AXIS_LABEL}` when a task is
   * owed, else the terminal-state line. Composed from exported REF-002 atoms;
   * no new copy.
   */
  openTaskLine: string;
  /** Deterministic excerpt of the contested point (≤ RAIL_PROPOSITION_CAP).
   *  Verbatim; never AI-synthesized. May be ''. */
  contestedProposition: string;
  /** Non-color tone glyph carried from the issue's banner-seeded observation,
   *  else null. */
  toneGlyph: 'star' | 'arrow' | 'branch' | null;
  /** 1–2 head moves (engine + role survivors). Empty → row shows no move chips. */
  nextBestMoves: ReadonlyArray<MoveSuggestion>;
  /** True when this is the active node's issue → highlight (geometry, not
   *  color alone). */
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
  /** Max rows to include before overflow. Default 8. */
  maxEntries?: number;
  /** Live candidates the host could not build (beyond the K build-cap).
   *  Default 0; added honestly into totalOpenCount + overflowCount. */
  omittedCandidateCount?: number;
  /** Max next-move chips per row. Default 2. */
  maxMovesPerEntry?: number;
}

// ════════════════════════════════════════════════════════════════
// Frozen authored chrome copy (the rail's ONLY new strings)
// ════════════════════════════════════════════════════════════════

/**
 * The rail's only authored chrome strings — everything else reuses the frozen
 * REF-002 plain-language atoms. Frozen; scanned by the ban-list +
 * no-raw-codes tests.
 */
export const OPEN_ISSUES_RAIL_COPY = Object.freeze({
  railTitle: 'Open issues',
  collapsedLabel: 'Open issues',
  emptyPrimary: 'No open issues right now.',
  emptyHelper:
    'When a point needs a source, a quote, a reply, or is ready to wrap up, it shows up here.',
  jumpLabel: 'Go to point',
  jumpHint: 'Move the board to this point and focus it.',
  inspectLabel: 'Details',
  inspectHint: 'Open the full referee detail for this point.',
  activeSuffix: 'Currently active',
  overflowWord: 'more',
  collapseLabel: 'Collapse',
});

/** Compact-row excerpt cap (chars). */
export const RAIL_PROPOSITION_CAP = 88;

/** Default rows included before overflow. */
export const DEFAULT_MAX_ENTRIES = 8;

/** Default next-move chips per row. */
export const DEFAULT_MAX_MOVES_PER_ENTRY = 2;

// ════════════════════════════════════════════════════════════════
// The open/closed predicate (Layer 2 — exact, pure, tested)
// ════════════════════════════════════════════════════════════════

/**
 * Display-terminal states whose `none` burden drops them from the rail. A
 * `conceded` issue is intentionally NOT terminal here (kept per the card's
 * explicit rule — one-line removable by adding `'conceded'`).
 */
export const TERMINAL_DISPLAY_STATES: ReadonlySet<IssueState> = new Set<IssueState>([
  'answered',
  'moved_on',
]);

/**
 * The exact open/closed predicate. Pure, total. An issue is OPEN iff it has a
 * non-`none` burden OR its state is not a display-terminal one.
 */
export function isOpenIssue(issue: OpenIssue): boolean {
  return issue.burden !== 'none' || !TERMINAL_DISPLAY_STATES.has(issue.state);
}

// ════════════════════════════════════════════════════════════════
// Procedural-urgency rank (frozen; never engagement)
// ════════════════════════════════════════════════════════════════

/**
 * Burden → rank (most-concrete owed task first). The four owed burdens; the
 * `none` burden falls through to the state table below.
 */
const BURDEN_RANK: Readonly<Record<Exclude<IssueBurden, 'none'>, number>> = Object.freeze({
  source_owed: 0,
  quote_owed: 1,
  clarification_owed: 2,
  reply_owed: 3,
});

/**
 * `none`-burden, non-terminal state → rank (the resolution-arc tail). Any
 * other state falls through to `DEFAULT_RANK` (defensive — no other state
 * reaches here once `isOpenIssue` has filtered the terminal ones out).
 */
const NONE_BURDEN_STATE_RANK: Readonly<Partial<Record<IssueState, number>>> = Object.freeze({
  synthesis_ready: 4,
  narrowed: 5,
  conceded: 6,
});

const DEFAULT_RANK = 7;

/**
 * Procedural urgency rank (0 = most owed). Pure, total. Reads ONLY
 * `issue.burden` and `issue.state` — never heat, popularity, or a band.
 */
export function ledgerRank(issue: OpenIssue): number {
  if (issue.burden !== 'none') return BURDEN_RANK[issue.burden];
  return NONE_BURDEN_STATE_RANK[issue.state] ?? DEFAULT_RANK;
}

/**
 * Total order on candidates:
 *   (1) `ledgerRank` ascending (most owed first) →
 *   (2) `recencyIndex` descending (most-recent target first) →
 *   (3) `issue.id` lexicographic ascending (stable, fully deterministic).
 * Reads ONLY burden / state / recency-index / id.
 */
export function compareLedgerCandidates(
  a: OpenIssueLedgerCandidate,
  b: OpenIssueLedgerCandidate,
): number {
  const rankDelta = ledgerRank(a.issue) - ledgerRank(b.issue);
  if (rankDelta !== 0) return rankDelta;
  const recencyDelta = b.recencyIndex - a.recencyIndex;
  if (recencyDelta !== 0) return recencyDelta;
  if (a.issue.id < b.issue.id) return -1;
  if (a.issue.id > b.issue.id) return 1;
  return 0;
}

// ════════════════════════════════════════════════════════════════
// Row shaping helpers (verbatim atoms only)
// ════════════════════════════════════════════════════════════════

function resolveNonNegativeInt(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  return Math.floor(value);
}

/** Deterministic word-boundary truncation (mirrors REF-002's helper). */
function truncateAtWordBoundary(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${base.trimEnd()}…`;
}

/** Ensure exactly one terminal sentence punctuation (avoids double periods). */
function withPeriod(s: string): string {
  const t = s.trim();
  if (t.length === 0) return t;
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/** The per-burden + axis open-task line (mirrors REF-002's `burdenAxisLine`). */
function buildOpenTaskLine(burden: IssueBurden, axis: DisagreementAxis, state: IssueState): string {
  if (burden !== 'none') return `${BURDEN_LABEL[burden]} · ${AXIS_LABEL[axis]}`;
  return ISSUE_STATE_TERMINAL_LINE[state];
}

/** One complete screen-reader sentence for the row — frozen atoms + verbatim. */
function buildRowAccessibilityLabel(args: {
  stateLabel: string;
  openTaskLine: string;
  contestedProposition: string;
  moves: ReadonlyArray<MoveSuggestion>;
  isActive: boolean;
}): string {
  const parts: string[] = [withPeriod(args.stateLabel), withPeriod(args.openTaskLine)];
  if (args.contestedProposition.length > 0) {
    parts.push(`On the point: "${args.contestedProposition}".`);
  }
  const moveLabels = args.moves.map((m) => m.label).filter((l) => l.length > 0);
  if (moveLabels.length > 0) {
    parts.push(`Suggested next moves: ${moveLabels.join(', ')}.`);
  }
  if (args.isActive) parts.push(`${OPEN_ISSUES_RAIL_COPY.activeSuffix}.`);
  return parts.join(' ');
}

function buildEntry(
  candidate: OpenIssueLedgerCandidate,
  maxMoves: number,
): OpenIssueLedgerEntry {
  const issue = candidate.issue;
  const stateLabel = ISSUE_STATE_LABEL[issue.state];
  const openTaskLine = buildOpenTaskLine(issue.burden, issue.axis, issue.state);
  const contestedProposition = truncateAtWordBoundary(
    issue.contestedProposition,
    RAIL_PROPOSITION_CAP,
  );
  const toneGlyph = issue.refereeObservations[0]?.toneGlyph ?? null;
  const nextBestMoves = issue.nextBestMoves.slice(0, maxMoves);
  return {
    key: issue.id,
    targetNodeId: issue.targetNodeId ?? '',
    state: issue.state,
    burden: issue.burden,
    axis: issue.axis,
    relationToParent: issue.relationToParent,
    stateLabel,
    openTaskLine,
    contestedProposition,
    toneGlyph,
    nextBestMoves,
    isActive: candidate.isActive,
    accessibilityLabel: buildRowAccessibilityLabel({
      stateLabel,
      openTaskLine,
      contestedProposition,
      moves: nextBestMoves,
      isActive: candidate.isActive,
    }),
  };
}

// ════════════════════════════════════════════════════════════════
// Public iterator
// ════════════════════════════════════════════════════════════════

/**
 * Filters (`isOpenIssue`) → orders (`compareLedgerCandidates`) → caps
 * (`maxEntries`) → shapes rows. Deterministic, pure, non-mutating: no
 * `Date.now`, no React, no network. The input array is never sorted in place.
 */
export function buildOpenIssuesLedger(
  candidates: ReadonlyArray<OpenIssueLedgerCandidate>,
  options?: BuildOpenIssuesLedgerOptions,
): OpenIssuesLedger {
  const maxEntries = resolveNonNegativeInt(options?.maxEntries, DEFAULT_MAX_ENTRIES);
  const maxMoves = resolveNonNegativeInt(options?.maxMovesPerEntry, DEFAULT_MAX_MOVES_PER_ENTRY);
  const omittedCandidateCount = resolveNonNegativeInt(options?.omittedCandidateCount, 0);

  const open = candidates.filter((c) => isOpenIssue(c.issue));
  // Copy before sorting — the caller's array is never mutated.
  const ordered = open.slice().sort(compareLedgerCandidates);
  const displayed = ordered.slice(0, maxEntries);
  const entries = displayed.map((c) => buildEntry(c, maxMoves));

  const totalOpenCount = open.length + omittedCandidateCount;
  const overflowCount = Math.max(0, totalOpenCount - entries.length);

  return {
    entries,
    totalOpenCount,
    overflowCount,
    isEmpty: totalOpenCount === 0,
  };
}
