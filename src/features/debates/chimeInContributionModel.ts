/**
 * CHIMEIN-P8 Round 2 (#761) — chime-in contribution derived model.
 *
 * Pure TypeScript. NO React, NO Supabase, NO network, NO AI imports; no mutation,
 * no clock, no randomness. JSON-serializable in and out; frozen outputs;
 * deterministic — mirrors the sibling pure-model discipline
 * (oneToOneRoomModel.ts, publicSeatModel.ts).
 *
 * WHAT THIS IS
 *   The read-time projection over the loaded public.chime_in_contributions rows —
 *   the NEW persisted marker Round 2 adds. It produces exactly the three things
 *   the display surfaces need and nothing more:
 *     - openChimeInSeatCount (0..3)  -> the ArgumentStateRail reserved input.
 *     - the per-point active-chime grouping (by target_argument_id).
 *     - contributionKindByArgumentId  -> the mediator DisagreementPointsRail
 *       dormant `contributionKind` slot adapter (an argument that carries an
 *       active chime marker is a `chime_in`; everything else is left undecided so
 *       the rail synthesizes nothing from absent data — doctrine section 4).
 *
 * WHAT THIS IS NOT
 *   - It NEVER touches or derives the principal count. The state object carries NO
 *     principal-seat field, so a chime row can never move the 2-principal count —
 *     the structural proof of the never-a-third-principal-voice invariant.
 *   - It writes NO argument structural state (argument_type / status). It carries
 *     no such field. A chime marker feeds display subordination + the seat count,
 *     NEVER factual standing (anti-amplification separation).
 *   - It counts ONLY active rows (retracted_at is null). A retracted chime frees
 *     its seat and disappears from every projection.
 *
 * DOCTRINE (cdiscourse-doctrine sections 1 / 2 / 3 / 10a): seat order + count carry
 * no heat / popularity input; the model imports nothing from any score / standing /
 * anti-amplification module. contributionKind='chime_in' is a machine-derived
 * structural Observation (a seat role), never an accusation, never a verdict.
 */

import { PUBLIC_ROOM_SEAT_CAP, PRIMARY_SEAT_COUNT } from './publicSeatModel';

/**
 * Room-level chime capacity = PUBLIC_ROOM_SEAT_CAP (5) - PRIMARY_SEAT_COUNT (2) =
 * 3. Imported + derived from GAME-005, never re-literal'd — one source of truth
 * with the seat map and (via a parity test) the Edge chime cap.
 */
export const CHIME_IN_CONTRIBUTION_CAP = PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT;

/**
 * One loaded chime_in_contributions row, narrowed. `retractedAt` non-null means
 * the chime was retracted (its seat is free); such rows are excluded from every
 * active projection.
 */
export interface ChimeInContributionRow {
  id: string;
  debateId: string;
  /** The chime CONTENT argument (posted through submit-argument). */
  argumentId: string;
  /** The point the chime attaches to (point-scoping). */
  targetArgumentId: string;
  authorId: string;
  /** 1..3 bounded seat index. */
  seatIndex: number;
  /** null = active; a timestamp = retracted (seat freed). */
  retractedAt: string | null;
}

/**
 * The derived chime-in contribution state for one room. Flat + JSON-serializable +
 * frozen. NOTE the fields it does NOT have: NO principal-seat field, NO score /
 * standing field, NO argument-structural field. A chime projection can only ever
 * move the seat count + the display grouping.
 */
export interface ChimeInContributionState {
  /** Count of ACTIVE chime-ins in the room (0..CHIME_IN_CONTRIBUTION_CAP). */
  activeCount: number;
  /** Free chime seats remaining (CAP - activeCount, clamped 0..CAP). */
  openChimeInSeatCount: number;
  /** True when every chime seat is taken. */
  isFull: boolean;
  /**
   * Active chime CONTENT argument ids grouped by the point they attach to
   * (target_argument_id), each list in ascending seat order. The per-point
   * chime list the rail / mediator adapter reads.
   */
  chimeArgumentIdsByPointId: Readonly<Record<string, ReadonlyArray<string>>>;
  /**
   * The mediator `contributionKind` adapter: every ACTIVE chime CONTENT argument
   * id maps to 'chime_in'. An argument id absent from this map has NO chime
   * marker — the rail must synthesize nothing (doctrine section 4). Only ever the
   * single literal 'chime_in'; a principal is simply absent, never labelled here.
   */
  contributionKindByArgumentId: Readonly<Record<string, 'chime_in'>>;
}

/** Coerce a value to a valid 1..CAP seat index, or null. */
function safeSeatIndex(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > CHIME_IN_CONTRIBUTION_CAP) return null;
  return value;
}

/** Only active rows with a valid seat index, sorted by seat then argument id. */
function activeRowsSorted(
  rows: ReadonlyArray<ChimeInContributionRow>,
): ChimeInContributionRow[] {
  return rows
    .filter((r) => r && r.retractedAt == null && safeSeatIndex(r.seatIndex) !== null)
    .slice()
    .sort((a, b) => {
      if (a.seatIndex !== b.seatIndex) return a.seatIndex - b.seatIndex;
      if (a.argumentId < b.argumentId) return -1;
      if (a.argumentId > b.argumentId) return 1;
      return 0;
    });
}

/**
 * Derive the chime-in contribution state from the loaded rows. Pure +
 * deterministic + frozen. An empty / malformed input yields the empty-room state
 * (all seats free, no groupings) — graceful degradation, no crash. Duplicate
 * active rows for the same argument are collapsed (the DB one-active-per-argument
 * UNIQUE prevents them, but the model is defensive).
 */
export function deriveChimeInContributionState(
  rows: ReadonlyArray<ChimeInContributionRow> | null | undefined,
): ChimeInContributionState {
  const safeRows = Array.isArray(rows) ? activeRowsSorted(rows) : [];

  const byPoint: Record<string, string[]> = {};
  const kindByArg: Record<string, 'chime_in'> = {};
  const seenArg = new Set<string>();

  for (const row of safeRows) {
    if (seenArg.has(row.argumentId)) continue;
    seenArg.add(row.argumentId);
    kindByArg[row.argumentId] = 'chime_in';
    const list = byPoint[row.targetArgumentId] ?? (byPoint[row.targetArgumentId] = []);
    list.push(row.argumentId);
  }

  const activeCount = seenArg.size;
  const openChimeInSeatCount = Math.max(0, CHIME_IN_CONTRIBUTION_CAP - activeCount);

  const frozenByPoint: Record<string, ReadonlyArray<string>> = {};
  for (const pointId of Object.keys(byPoint)) {
    frozenByPoint[pointId] = Object.freeze(byPoint[pointId].slice());
  }

  return Object.freeze({
    activeCount,
    openChimeInSeatCount,
    isFull: openChimeInSeatCount <= 0,
    chimeArgumentIdsByPointId: Object.freeze(frozenByPoint),
    contributionKindByArgumentId: Object.freeze(kindByArg),
  });
}

/** True when the given argument carries an active chime marker. */
export function isChimeInArgument(
  state: ChimeInContributionState,
  argumentId: string,
): boolean {
  return state.contributionKindByArgumentId[argumentId] === 'chime_in';
}

/** The count of active chime-ins attached to one point. */
export function chimeInCountForPoint(
  state: ChimeInContributionState,
  pointId: string,
): number {
  return state.chimeArgumentIdsByPointId[pointId]?.length ?? 0;
}

/**
 * The mediator `contributionKind` adapter for one argument: 'chime_in' when the
 * argument carries an active chime marker, otherwise undefined (never 'principal'
 * — the model does not know principals; absence keeps the rail slot dormant).
 */
export function contributionKindForArgument(
  state: ChimeInContributionState,
  argumentId: string,
): 'chime_in' | undefined {
  return state.contributionKindByArgumentId[argumentId] === 'chime_in' ? 'chime_in' : undefined;
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/chimeInContributionModel.test.ts`. This
 * model emits no user-facing copy (only ids + counts), so the scan is a
 * belt-and-braces guard over any literal the model could ever surface: verdict,
 * amplification, and person / third-voice tokens. A chime-in is a bounded
 * contribution role, never a verdict, never a third principal voice.
 */
export function _forbiddenChimeInContributionTokens(): string[] {
  return [
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'won',
    'lost',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'popular',
    'trending',
    'viral',
    'upvote',
    'downvote',
    'third principal',
    'third voice',
    'troll',
    'bot',
  ];
}
