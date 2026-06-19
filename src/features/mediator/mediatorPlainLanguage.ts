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
  // UX-MEDIATOR-003 (O-1) — canonical v4 vocabulary label. Renamed from the
  // shipped "Blocked evidence path" to match the v4 nine-state vocabulary
  // (index O-6) + the issue §5 chip copy. This is a copy-VALUE change, not a
  // state-code rename: the internal code `evidence_blocked` is unchanged, only
  // its displayed label. `key_detail_unavailable` projects onto this same
  // display label via `v4DisplayStateFor`, so the collapse case reads the same.
  evidence_blocked: 'Evidence blocked',
  key_detail_unavailable: 'Key detail unavailable',
  definition_not_shared: 'Definition not shared',
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
  // UX-MEDIATOR-003 — person-neutral structural obligation copy. "Needs
  // evidence" is a state about a POINT (it owes a source/record), never about a
  // person failing or owing. Lead + help, operator-locked.
  needs_evidence: 'This point needs a source or record. A source would make this point easier to test.',
  // UX-MEDIATOR-003 — the doctrine-load-bearing copy. Describes the evidence
  // PATH only — its availability — and NEVER anyone's conduct. Deliberately
  // carries NO reassurance / negation line (per operator: even a negation like
  // "not about the person" surfaces the accusation). Lead + help + advisory
  // next-move phrasing, all person-neutral, all ban-list clean. The advisory
  // next moves ship as COPY ONLY — no write/action is wired (the persisted
  // "mark evidence unavailable" action is deferred to a GATE-C card).
  evidence_blocked:
    'The evidence path is not available right now. ' +
    'Name what kind of record would test this point, without demanding private access. ' +
    'Mark evidence unavailable, branch the provable part, or ask what kind of record would test this.',
  key_detail_unavailable: 'A detail this turns on cannot be settled from what is available.',
  definition_not_shared: 'A shared definition would make this point easier to test.',
  scope_mismatch: 'A scope bridge keeps the reply anchored to the exact point.',
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
  // UX-MEDIATOR-003 (O-2) — warmer, shorter next-move verb for the needs-evidence
  // pathway. Person-neutral; advisory, never a posting gate.
  provide_source: 'Add a source.',
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
    'disproven', 'lost', 'defeated', 'won', 'validated', 'truth', 'score',
    // UX-MEDIATOR-003 (operator-expanded) — accusation / blame / conduct
    // tokens. "Evidence blocked" describes an unavailable PATH, never a
    // person's conduct: a blocked path must never read as someone hiding,
    // withholding, concealing, refusing, or failing to provide a record. The
    // copy describes the evidence PATH only — never anyone's intent or fault.
    'hiding', 'withheld', 'concealed', 'refused', 'failed', 'blame', 'fault',
    'not about the person', 'ai thinks', 'decide for me',
    // Amplification / popularity
    'likes', 'retweets', 'shares', 'views', 'followers', 'verified',
    'engagement', 'amplification', 'trending', 'virality', 'popular', 'viral',
    // Prevent / gate (the board is advisory, never blocking).
    // `block` is deliberately NOT in this list — "Evidence blocked" is the
    // operator-preferred v4 term for an UNAVAILABLE record, never a posting
    // block. Non-gating is guaranteed by architecture (this module is a
    // pure projection, never a submission gate), not by banning the word.
    // Mirrors the `hot` carve-out in pointLifecycleModel._forbiddenLifecycleTokens.
    'prevent', 'reject', 'forbid', 'disallow', 'denied',
  ];
}
