/**
 * UX-MEDIATOR-001 — Plain-language mapping for mediator board states.
 *
 * Every user-facing string the mediator board can render is defined here and
 * scanned by the ban-list test. Doctrine: no verdict / person / intent /
 * amplification tokens. Prefer "pathway to resolution / verification",
 * "needs evidence", "scope mismatch", "structured impasse" — never "winner",
 * "loser", "truth", "liar", etc.
 *
 * Pure TS. No imports beyond the state-code types. Deterministic.
 */
import type {
  MediatorStateCode,
  ResolutionPathwayStepCode,
} from './mediatorBoardTypes';

/** The plain-language label for each mediator state. Locked, ban-list clean. */
export const MEDIATOR_STATE_COPY: Readonly<Record<MediatorStateCode, string>> = Object.freeze({
  open: 'Open',
  needs_evidence: 'Needs evidence',
  evidence_blocked: 'Blocked evidence path',
  key_detail_unavailable: 'Key detail unavailable',
  definition_not_shared: 'Definition needed',
  scope_mismatch: 'Scope mismatch',
  missing_mechanism: 'Missing link',
  value_tradeoff: 'Value tradeoff',
  narrowed: 'Partially narrowed',
  off_point: 'Off-point response',
  accounts_differ: 'Difference of recollection',
  structured_impasse: 'Structured impasse',
  resolved_or_settled: 'Resolved',
});

/**
 * A one-line helper sentence for each state — what it means + a neutral,
 * non-accusatory next step. Never asserts a person did anything wrong.
 */
export const MEDIATOR_STATE_HELPER: Readonly<Record<MediatorStateCode, string>> = Object.freeze({
  open: 'This point is open for a response.',
  needs_evidence: 'A source or quote was asked for and is still owed.',
  evidence_blocked: 'The record that would settle this is not available at the moment.',
  key_detail_unavailable: 'A detail this turns on cannot be settled from what is available.',
  definition_not_shared: 'The two sides are using a term differently — pin it down together.',
  scope_mismatch: 'This answers a broader or narrower claim than the point — narrow or branch it.',
  missing_mechanism: 'The conclusion depends on a step that has not been spelled out.',
  value_tradeoff: 'This is a difference in priorities, not a point that more evidence settles.',
  narrowed: 'Part of this was conceded or narrowed; a smaller disagreement remains.',
  off_point: 'This does not address the point it replies to yet.',
  accounts_differ: 'The two sides recall this differently; separate memory from the record.',
  structured_impasse: 'Both sides made the case and no new pathway is available at the moment.',
  resolved_or_settled: 'This point was settled, synthesized, or resolved.',
});

/** Plain-language label for each resolution-pathway step. Ban-list clean. */
export const PATHWAY_STEP_COPY: Readonly<Record<ResolutionPathwayStepCode, string>> = Object.freeze({
  provide_source: 'Provide a source',
  define_term: 'Define the term',
  narrow_or_branch: 'Narrow or branch the claim',
  respond_to_point: 'Respond to the open point',
  name_tradeoff: 'Name the tradeoff',
  supply_mechanism: 'Supply the missing step',
  await_record: 'A primary record would distinguish these claims',
});

/**
 * Typed lookup for a mediator state's plain-language label. Unknown codes
 * fall back to the code string (never echoed raw in the UI — the union type
 * makes unknowns unreachable in practice).
 */
export function plainLanguageForMediatorState(code: MediatorStateCode): string {
  const label = MEDIATOR_STATE_COPY[code];
  return typeof label === 'string' && label.length > 0 ? label : String(code);
}

/** Typed lookup for a mediator state's helper sentence. */
export function helperForMediatorState(code: MediatorStateCode): string {
  const helper = MEDIATOR_STATE_HELPER[code];
  return typeof helper === 'string' && helper.length > 0 ? helper : '';
}

/** Typed lookup for a pathway step's plain-language label. */
export function plainLanguageForPathwayStep(code: ResolutionPathwayStepCode): string {
  const label = PATHWAY_STEP_COPY[code];
  return typeof label === 'string' && label.length > 0 ? label : String(code);
}

/**
 * Forbidden tokens scanned by the ban-list test. NOT a content filter — a
 * doctrine guard over the mediator's OWN copy. Mirrors
 * `pointLifecycleModel._forbiddenLifecycleTokens` (note: `hot` is excluded
 * there for the legitimate "hot = activity" usage; the mediator copy uses no
 * such term, so the list stays strict).
 */
export function _forbiddenMediatorTokens(): string[] {
  return [
    // Verdict / correctness
    'winner', 'loser', 'correct', 'incorrect', 'true', 'false',
    'right', 'wrong', 'liar', 'dishonest', 'bad faith', 'manipulative',
    'extremist', 'propagandist', 'troll', 'verdict', 'proof', 'proven',
    'disproven', 'lost', 'defeated', 'won', 'validated',
    // Amplification / popularity
    'likes', 'retweets', 'shares', 'views', 'followers', 'verified',
    'engagement', 'amplification', 'trending', 'virality', 'popular', 'viral',
    // Prevent / gate (the board is advisory, never blocking).
    // `block` is deliberately NOT in this list — "Blocked evidence path" is
    // the operator-preferred term for an UNAVAILABLE record, never a posting
    // block. Non-gating is guaranteed by architecture (this module is a
    // pure projection, never a submission gate), not by banning the word.
    // Mirrors the `hot` carve-out in pointLifecycleModel._forbiddenLifecycleTokens.
    'prevent', 'reject', 'forbid', 'disallow', 'denied',
  ];
}
