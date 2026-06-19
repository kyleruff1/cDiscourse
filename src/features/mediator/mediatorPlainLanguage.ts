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
  // UX-IMPASSE-001 (#689) — narrowing is PROGRESS, not a defeat. Lead aligned to
  // the §4 operator-locked dignified wording: the disagreement got smaller and a
  // remaining point is still open for a response. Person-neutral, ban-list clean.
  narrowed: 'The disagreement is smaller now. Continue on the remaining point.',
  off_point: 'This does not address the point it replies to yet.',
  accounts_differ: 'The two sides recall this differently; separate memory from the record.',
  // UX-IMPASSE-001 (#689) — dignified structured-impasse lead + help, aligned to
  // the §4 operator-locked wording. An impasse is a CALM, complete destination:
  // the disagreement is preserved clearly and no available next move would test it
  // further yet — never a deadlock / failure / verdict. The reopen line ("Reopen
  // with a source, shared definition, or narrower claim.") is delivered through the
  // next-move guidance + the rail row (IMPASSE_SUBTYPE_COPY.structured_impasse.next),
  // so the helper sentence stays a tight lead + help.
  structured_impasse: 'The disagreement is preserved. No available next move would test this point further yet.',
  resolved_or_settled: 'This point was settled, synthesized, or resolved.',
});

/**
 * UX-IMPASSE-001 (#689) — Dignified impasse-family copy, keyed by the v4 DISPLAY
 * state it dresses. `chip` mirrors `MEDIATOR_STATE_COPY` (UNCHANGED — the chip
 * labels stay shipped so UX-MEDIATOR-002/005 label tests keep passing); `lead` /
 * `help` / `next` are the §4 operator-locked, person-neutral, ban-list-clean
 * strings. This is a one-source copy block so the Inspect / rail / next-move
 * surfaces read the SAME dignified wording.
 *
 * `no_current_pathway` is a COPY KEY, not a new mediator state. It dresses a
 * `structured_impasse` point with `pathway.anyAvailable === false`; per the
 * design Q4 recommendation the surfaces FOLD it into the single Structured
 * impasse chip (no chip soup) and keep this entry as a reserved alternate.
 *
 * Doctrine: impasse is a STRUCTURAL state, never a truth / verdict / defeat
 * (cdiscourse-doctrine §1). Every line describes the disagreement's shape, never
 * who is right; the board never blocks posting; all copy is advisory guidance.
 */
export const IMPASSE_SUBTYPE_COPY: Readonly<
  Record<
    'structured_impasse' | 'evidence_blocked' | 'narrowed' | 'no_current_pathway',
    { chip: string; lead: string; help: string; next: string }
  >
> = Object.freeze({
  structured_impasse: {
    chip: MEDIATOR_STATE_COPY.structured_impasse, // 'Structured impasse' (unchanged)
    lead: 'The disagreement is preserved.',
    help: 'No available next move would test this point further yet.',
    next: 'Reopen with a source, shared definition, or narrower claim.',
  },
  evidence_blocked: {
    // KEEP the shipped UX-MEDIATOR-003 wording; mirrored here only so one-source
    // reads stay in lockstep. Describes an unavailable PATH, never anyone's conduct.
    chip: MEDIATOR_STATE_COPY.evidence_blocked, // 'Evidence blocked' (unchanged)
    lead: 'The evidence path is not available right now.',
    help: 'Name what kind of record would test this point, without demanding private access.',
    next: 'Mark evidence unavailable, or branch the provable part.',
  },
  narrowed: {
    // Concession is PROGRESS, not a defeat — the disagreement got smaller and a
    // remaining point is still open.
    chip: MEDIATOR_STATE_COPY.narrowed, // 'Partially narrowed' (shipped label kept)
    lead: 'The disagreement is smaller now.',
    help: 'Continue on the remaining point.',
    next: 'Continue on the smaller point, or concede the resolved part.',
  },
  no_current_pathway: {
    // Reserved alternate copy (folded into Structured impasse for the chip — Q4).
    chip: MEDIATOR_STATE_COPY.structured_impasse, // folds into 'Structured impasse'
    lead: 'No available step would test this further yet.',
    help: 'The point can be reopened if a source, shared definition, or narrower claim appears.',
    next: 'Preserve the disagreement.',
  },
});

/**
 * UX-IMPASSE-002 (#710): dormant — intentionally not surfaced; surfacing requires
 * a v4DisplayStateFor map flip (deferred).
 *
 * `value_tradeoff` is computed internally but `V4_DISPLAY_STATE_BY_CODE.value_tradeoff`
 * stays `'open'`, so a value-axis point shows as Open (no chip) today. This copy
 * constant is authored so the future surfacing decision is a one-line map flip,
 * NOT a re-author. It is NOT referenced from any render path in this card.
 */
export const VALUE_TRADEOFF_DISPLAY_COPY = Object.freeze({
  chip: 'Different priorities',
  lead: 'This is a value tradeoff.',
  help: 'Name the priority at stake instead of asking for a source.',
  next: 'State the tradeoff clearly.',
});

/**
 * UX-IMPASSE-002 (#710): dormant — intentionally not surfaced; surfacing requires
 * a v4DisplayStateFor map flip (deferred).
 *
 * `key_detail_unavailable` is computed internally but
 * `V4_DISPLAY_STATE_BY_CODE.key_detail_unavailable` stays `'evidence_blocked'`,
 * so it FOLDS into Evidence blocked for display today. Authored for the future
 * distinct-surfacing decision; NOT referenced from any render path in this card.
 */
export const KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY = Object.freeze({
  chip: 'Key detail unavailable',
  lead: 'A key detail is not available.',
  help: 'Branch the parts that can still be tested.',
  next: 'Branch the provable part.',
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
