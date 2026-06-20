/**
 * UX-NEXT-MOVE-001 — "What would move this forward?" next-move guidance (pure TS).
 *
 * Converts a v4 mediator DISPLAY state (`V4MediatorStateCode`, one of the nine)
 * into a DETERMINISTIC, ordered list of STRUCTURAL next moves — the dominant
 * move first, then the operator-locked alternates (§3 of the design). Each move
 * is COPY + a routing hint to an EXISTING action (no new action semantics, no
 * new persisted state). This module:
 *
 *   - reads NOTHING but the display state (no I/O, no clock, no randomness),
 *   - derives NO new board state (it consumes the already-derived display state),
 *   - returns the SAME ordered list for the same input (pure + total),
 *   - never asserts who is right / won / true / credible, and never infers
 *     what anyone intended (cdiscourse-doctrine §1/§2/§3/§4/§9/§10a),
 *   - collapses any insufficient / unknown signal to the neutral `open` set
 *     ("Respond to the exact point" / "Ask a clarifying question").
 *
 * The pathway STEP codes mirror `pathwayForState` (deriveMediatorBoardState.ts)
 * so the dominant move shares one source with the Act target. The `available`
 * flag mirrors that derivation: a move that is not actionable now (the
 * `await_record` steps for evidence_blocked / accounts_differ / impasse) is
 * rendered as structural GUIDANCE copy, never as a live submit-changing action.
 *
 * A discrete tappable chooser with NEW action semantics is DEFERRED to
 * UX-NEXT-MOVE-002. The persisted "mark evidence unavailable" write is a
 * separate GATE-C deferral; here it is guidance copy only.
 *
 * Pure TS. No React. No Supabase. No fetch. No MCP. No clock. No randomness.
 * No mutation of any input. Deterministic. JSON-serializable output.
 */
import type {
  ResolutionPathwayStepCode,
  V4MediatorStateCode,
} from './mediatorBoardTypes';
import { _forbiddenMediatorTokens } from './mediatorPlainLanguage';

/**
 * One advisory next move shown in the "What would move this forward?" card.
 * DISPLAY ONLY — never persisted, never a field on the board, never a write.
 * `stepCode` is an EXISTING `ResolutionPathwayStepCode` (the move routes to the
 * matching EXISTING action — no new action semantics). `available` honors the
 * underlying pathway's `available` flag: false → rendered as structural
 * guidance copy, never a live action.
 */
export interface NextMove {
  /** Stable id for keys / testIDs; `<state>-<stepCode>-<index>`. */
  id: string;
  /** Ban-list-clean operator copy (the visible label). */
  label: string;
  /** Structure-only one-line rationale (never a verdict / who's-right claim). */
  rationale: string;
  /** The underlying pathway step code this move corresponds to (existing union). */
  stepCode: ResolutionPathwayStepCode;
  /** True only when the underlying pathway step is actionable now. */
  available: boolean;
  /** True for the single dominant move (rendered first / emphasized). */
  isDominant: boolean;
}

/**
 * The operator-locked alternate-move labels (§3). Sourced as structure-only
 * copy; ban-list clean (asserted by tests). The dominant labels and the
 * shared alternates live here so the nine-state switch reads as data.
 */
const NEXT_MOVE_COPY = Object.freeze({
  ask_source: 'Ask for a source',
  add_evidence: 'Add evidence',
  mark_evidence_unavailable: 'Mark evidence unavailable',
  branch_provable: 'Branch the provable part',
  name_record_kind: 'Name what kind of record would test this point',
  define_term: 'Define the key term',
  // UX-IMPASSE-002 (#710) — the dominant move for a surfaced value_tradeoff. The
  // `name_tradeoff` pathway step already exists; this adds the next-move COPY
  // entry, not a new action semantic.
  name_tradeoff: 'Name the tradeoff',
  narrow_claim: 'Narrow the claim',
  respond_exact: 'Respond to the exact point',
  accept_narrower: 'Accept the narrower scope',
  add_missing_link: 'Add the missing link',
  ask_mechanism: 'Ask for the mechanism',
  continue_smaller: 'Continue on the smaller point',
  concede_resolved: 'Concede the resolved part',
  separate_memory: 'Separate memory from records',
  name_verify: 'Name what could verify it',
  preserve_disagreement: 'Preserve the disagreement',
  reopen_with: 'Reopen with a source, definition, or narrower claim',
  ask_clarifying: 'Ask a clarifying question',
});

/**
 * Structure-only one-line rationales, keyed by the same copy key. Each says
 * what the move does for the SHAPE of the disagreement — never a who's-right
 * recommendation, never a person-attribution. Ban-list clean (tested).
 */
const NEXT_MOVE_RATIONALE = Object.freeze({
  ask_source: 'A source makes this point easier to test.',
  add_evidence: 'A record gives this point something to stand on.',
  mark_evidence_unavailable: 'Noting the record is unavailable keeps the shape honest.',
  branch_provable: 'A branch isolates the part that can be tested now.',
  name_record_kind: 'Naming the record kind shows what would settle this point.',
  define_term: 'A shared definition makes this point easier to test.',
  // UX-IMPASSE-002 (#710) — structure-only rationale for the value_tradeoff
  // dominant move. Names what the move does for the SHAPE of the disagreement.
  name_tradeoff: 'Naming the priority being weighed separates it from the part a record could test.',
  narrow_claim: 'A narrower claim keeps the reply anchored to the exact point.',
  respond_exact: 'Answering the exact point keeps the exchange on the same point.',
  accept_narrower: 'Accepting the narrower scope settles the part that already lines up.',
  add_missing_link: 'Spelling out the step connects the claim to its conclusion.',
  ask_mechanism: 'Asking for the step surfaces the link the conclusion depends on.',
  continue_smaller: 'A smaller point is the part still open for a response.',
  concede_resolved: 'Marking the resolved part as settled is a repair that keeps the rest open.',
  separate_memory: 'Separating memory from records shows what could be checked.',
  name_verify: 'Naming what could verify it shows the kind of record that would help.',
  preserve_disagreement: 'Keeping the disagreement on record leaves the structure intact.',
  reopen_with: 'A new source, definition, or narrower claim opens a fresh pathway.',
  ask_clarifying: 'A clarifying question pins down what the point is about.',
});

type CopyKey = keyof typeof NEXT_MOVE_COPY;

/** A move spec before the id is stamped: copy key + step code + availability. */
interface MoveSpec {
  key: CopyKey;
  stepCode: ResolutionPathwayStepCode;
  available: boolean;
}

/**
 * The dominant-first move specs per v4 display state (§3, operator-locked).
 * The FIRST entry is the dominant move. The map is total over the eleven
 * display states (UX-IMPASSE-002 #710 added `key_detail_unavailable` +
 * `value_tradeoff`). `available` mirrors `pathwayForState`'s flag:
 * `await_record` steps (evidence_blocked / key_detail_unavailable /
 * accounts_differ / structured_impasse) are guidance copy (available: false);
 * everything else is actionable now.
 */
const STATE_MOVE_SPECS: Readonly<Record<V4MediatorStateCode, ReadonlyArray<MoveSpec>>> =
  Object.freeze({
    needs_evidence: [
      { key: 'ask_source', stepCode: 'provide_source', available: true },
      { key: 'add_evidence', stepCode: 'provide_source', available: true },
    ],
    evidence_blocked: [
      { key: 'mark_evidence_unavailable', stepCode: 'await_record', available: false },
      { key: 'branch_provable', stepCode: 'narrow_or_branch', available: true },
      { key: 'name_record_kind', stepCode: 'await_record', available: false },
    ],
    // UX-IMPASSE-002 (#710) — reuses the evidence_blocked move SHAPE (branch the
    // provable part is the dominant, actionable move; naming the record kind is
    // guidance). No new action semantics — both keys / step codes already exist.
    key_detail_unavailable: [
      { key: 'branch_provable', stepCode: 'narrow_or_branch', available: true },
      { key: 'name_record_kind', stepCode: 'await_record', available: false },
    ],
    definition_not_shared: [
      { key: 'define_term', stepCode: 'define_term', available: true },
    ],
    scope_mismatch: [
      { key: 'narrow_claim', stepCode: 'narrow_or_branch', available: true },
      { key: 'branch_provable', stepCode: 'narrow_or_branch', available: true },
      { key: 'respond_exact', stepCode: 'respond_to_point', available: true },
      { key: 'accept_narrower', stepCode: 'respond_to_point', available: true },
    ],
    missing_mechanism: [
      { key: 'add_missing_link', stepCode: 'supply_mechanism', available: true },
      { key: 'ask_mechanism', stepCode: 'supply_mechanism', available: true },
    ],
    narrowed: [
      { key: 'continue_smaller', stepCode: 'respond_to_point', available: true },
      { key: 'concede_resolved', stepCode: 'respond_to_point', available: true },
    ],
    accounts_differ: [
      { key: 'separate_memory', stepCode: 'await_record', available: false },
      { key: 'name_verify', stepCode: 'await_record', available: false },
    ],
    structured_impasse: [
      { key: 'preserve_disagreement', stepCode: 'await_record', available: false },
      { key: 'reopen_with', stepCode: 'await_record', available: false },
    ],
    // UX-IMPASSE-002 (#710) — the dominant move is to name the tradeoff (an
    // actionable move via the existing `name_tradeoff` pathway step). No new
    // action semantics.
    value_tradeoff: [
      { key: 'name_tradeoff', stepCode: 'name_tradeoff', available: true },
    ],
    open: [
      { key: 'respond_exact', stepCode: 'respond_to_point', available: true },
      { key: 'ask_clarifying', stepCode: 'respond_to_point', available: true },
    ],
  });

/**
 * The ordered next-move list for a v4 display state. Dominant first. Total over
 * the nine display states; an unknown / insufficient state collapses to the
 * neutral `open` set. Pure, deterministic — same input → same output.
 */
export function nextMovesForState(state: V4MediatorStateCode): ReadonlyArray<NextMove> {
  const specs = STATE_MOVE_SPECS[state] ?? STATE_MOVE_SPECS.open;
  return Object.freeze(
    specs.map((spec, index) => ({
      id: `${state}-${spec.stepCode}-${index}`,
      label: NEXT_MOVE_COPY[spec.key],
      rationale: NEXT_MOVE_RATIONALE[spec.key],
      stepCode: spec.stepCode,
      available: spec.available,
      isDominant: index === 0,
    })),
  );
}

/**
 * Person-attribution tokens (mirrors ST-002's PERSON_ATTRIBUTION_TOKENS). A
 * move is about the POINT, never the person — these must never appear in any
 * label or rationale.
 */
const NEXT_MOVE_PERSON_ATTRIBUTION_TOKENS: ReadonlyArray<string> = Object.freeze([
  'you',
  'your',
  "you're",
  'yours',
  'they',
  'their',
  "they're",
  'theirs',
  'the user',
  'the author',
  'the poster',
  'the speaker',
  'the participant',
  'this person',
  'this user',
]);

/**
 * Test-only ban-list for the next-move copy. Re-exports the mediator ban-list
 * plus the person-attribution tokens (mirrors ST-002's
 * `_forbiddenSuggestionTokens`), so a move label / rationale can never name a
 * person or imply a verdict. Not a content filter — a doctrine guard over the
 * card's OWN copy.
 */
export function _forbiddenNextMoveTokens(): string[] {
  const merged = new Set<string>(_forbiddenMediatorTokens());
  for (const t of NEXT_MOVE_PERSON_ATTRIBUTION_TOKENS) merged.add(t);
  return Array.from(merged);
}
