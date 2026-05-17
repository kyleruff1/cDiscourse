/**
 * Stage 6.1.5.1 — Message qualifier taxonomy.
 *
 * Pure TypeScript. No network. No Supabase. No AI. Encodes the playful
 * labels for argument-room UI nudges + the Admin Arguments view.
 *
 * Categories describe the broad SHAPE of a message (claim / challenge /
 * concession / etc.). Qualifiers describe the SPECIFIC tactic the message
 * uses (ask_receipts / quote_exact_bit / narrow_scope / etc.). Both are
 * advisory — the production app never declares a winner / loser / truth.
 */

import type { MixedAgreementFlags } from '../engagementIntelligence/types';

// ── Category + qualifier taxonomy ──────────────────────────────

export type MessageCategory =
  | 'claim'
  | 'challenge'
  | 'evidence'
  | 'clarification'
  | 'concession'
  | 'synthesis'
  | 'receipt_request'
  | 'quote_request'
  | 'mixed_agreement'
  | 'branch_candidate'
  | 'tangent'
  | 'repair'
  | 'unresolved_pressure';

export type MessageQualifier =
  | 'fact_challenge'
  | 'definition_challenge'
  | 'causal_challenge'
  | 'value_challenge'
  | 'evidence_challenge'
  | 'logic_challenge'
  | 'scope_challenge'
  | 'ask_receipts'
  | 'quote_exact_bit'
  | 'narrow_scope'
  | 'define_term'
  | 'counterexample'
  | 'concede_small_point'
  | 'concede_broad_point'
  | 'synthesize_agreement'
  | 'synthesize_open_question'
  | 'branch_this_off'
  | 'mixed_agree_disagree'
  | 'broad_accept_narrow_decline'
  | 'narrow_accept_broad_decline'
  | 'pure_accept'
  | 'pure_decline'
  | 'tangent_or_joke'
  | 'unresolved_debt'
  | 'repair_attempt'
  | 'evasion_possible';

// ── Inputs ─────────────────────────────────────────────────────

/**
 * The minimum shape a deriver needs. Everything is optional — derivers
 * gracefully degrade as fewer fields are populated.
 */
export interface ArgumentLike {
  argumentType?: string | null;
  side?: string | null;
  disagreementAxis?: string | null;
  selectedTagCodes?: string[] | null;
  targetExcerpt?: string | null;
  body?: string | null;
  attachedEvidence?: Array<{ url?: string | null; label?: string | null; sourceText?: string | null }> | null;
  clientValidation?: Record<string, unknown> | null;
  serverValidation?: Record<string, unknown> | null;
  /** Optional Stage 6.1.3.3 flags. */
  mixedFlags?: MixedAgreementFlags | null;
  /** Optional Stage 6.1.4 deltas / debt. */
  pointStanding?: {
    hasUnresolvedDebt?: boolean;
    isRepairAttempt?: boolean;
    isEvasionPossible?: boolean;
  } | null;
}

// ── Derivers ───────────────────────────────────────────────────

const ASK_RECEIPT_LEXEMES = ['source', 'receipts', 'receipt', 'evidence?', 'citation', 'where is this from', 'prove it', 'link?'];
const ASK_QUOTE_LEXEMES = ['quote the exact', 'which part exactly', 'point to the sentence', 'show me the words', 'exact words', 'highlight the bit'];
const DEFINE_LEXEMES = ['define ', 'what counts as', 'what do you mean', 'that word'];
const NARROW_LEXEMES = ['too broad', 'overgeneralized', 'narrow the claim', 'narrow that down', 'goalposts', 'scope creep'];
const COUNTEREXAMPLE_LEXEMES = ['counterexample', 'counter-example', 'what about', 'one example', 'edge case'];
const TANGENT_LEXEMES = ['speaking of', 'unrelated', 'tangent', 'side note', 'off topic'];

function lower(s: string | null | undefined): string { return String(s || '').toLowerCase(); }
function hasAny(text: string, patterns: string[]): boolean {
  const lc = lower(text);
  return patterns.some((p) => lc.includes(p));
}

export function deriveMessageCategory(arg: ArgumentLike): MessageCategory {
  const body = String(arg.body || '');
  const t = String(arg.argumentType || '').toLowerCase();
  if (arg.mixedFlags?.mixedAgreementClass === 'tangent_or_joke') return 'tangent';
  if (arg.pointStanding?.hasUnresolvedDebt && !arg.pointStanding?.isRepairAttempt) return 'unresolved_pressure';
  if (arg.pointStanding?.isRepairAttempt) return 'repair';
  if (t === 'thesis' || t === 'claim') return 'claim';
  if (t === 'rebuttal' || t === 'counter_rebuttal') return 'challenge';
  if (t === 'evidence') return 'evidence';
  if (t === 'clarification_request') {
    if (hasAny(body, ASK_RECEIPT_LEXEMES)) return 'receipt_request';
    if (hasAny(body, ASK_QUOTE_LEXEMES)) return 'quote_request';
    return 'clarification';
  }
  if (t === 'concession') return 'concession';
  if (t === 'synthesis') return 'synthesis';
  if (arg.mixedFlags?.mixedAgreementClass === 'broad_accept_narrow_decline'
    || arg.mixedFlags?.mixedAgreementClass === 'narrow_accept_broad_decline'
    || arg.mixedFlags?.mixedAgreementClass === 'broad_accept_broad_decline'
    || arg.mixedFlags?.mixedAgreementClass === 'narrow_accept_narrow_decline') {
    return 'mixed_agreement';
  }
  if (hasAny(body, TANGENT_LEXEMES)) return 'tangent';
  return 'claim';
}

export function deriveMessageQualifiers(arg: ArgumentLike): MessageQualifier[] {
  const out = new Set<MessageQualifier>();
  const body = String(arg.body || '');
  const t = String(arg.argumentType || '').toLowerCase();
  const axis = String(arg.disagreementAxis || '').toLowerCase();

  // Axis-driven challenge qualifiers.
  if (t === 'rebuttal' || t === 'counter_rebuttal') {
    if (axis === 'fact') out.add('fact_challenge');
    if (axis === 'definition') out.add('definition_challenge');
    if (axis === 'causal') out.add('causal_challenge');
    if (axis === 'value') out.add('value_challenge');
    if (axis === 'evidence') out.add('evidence_challenge');
    if (axis === 'logic') out.add('logic_challenge');
    if (axis === 'scope') out.add('scope_challenge');
  }

  // Body-derived qualifiers (tactics).
  if (hasAny(body, ASK_RECEIPT_LEXEMES)) out.add('ask_receipts');
  if (hasAny(body, ASK_QUOTE_LEXEMES)) out.add('quote_exact_bit');
  if (arg.targetExcerpt) out.add('quote_exact_bit');
  if (hasAny(body, DEFINE_LEXEMES) || axis === 'definition') out.add('define_term');
  if (hasAny(body, NARROW_LEXEMES) || axis === 'scope') out.add('narrow_scope');
  if (hasAny(body, COUNTEREXAMPLE_LEXEMES)) out.add('counterexample');
  if (hasAny(body, TANGENT_LEXEMES)) out.add('branch_this_off');

  // Concession / synthesis qualifiers from argument type.
  if (t === 'concession') {
    if (arg.mixedFlags?.broadAcceptor && arg.mixedFlags?.narrowDecliner) out.add('concede_small_point');
    else if (arg.mixedFlags?.broadDecliner) out.add('concede_broad_point');
    else out.add('concede_small_point');
  }
  if (t === 'synthesis') {
    if (lower(body).includes('open question')) out.add('synthesize_open_question');
    else out.add('synthesize_agreement');
  }

  // Mixed-agreement class flags.
  const klass = arg.mixedFlags?.mixedAgreementClass;
  if (klass === 'broad_accept_narrow_decline') out.add('broad_accept_narrow_decline');
  if (klass === 'narrow_accept_broad_decline') out.add('narrow_accept_broad_decline');
  if (klass === 'pure_accept') out.add('pure_accept');
  if (klass === 'pure_decline') out.add('pure_decline');
  if (klass === 'tangent_or_joke') out.add('tangent_or_joke');
  if (
    klass === 'broad_accept_narrow_decline'
    || klass === 'narrow_accept_broad_decline'
    || klass === 'broad_accept_broad_decline'
    || klass === 'narrow_accept_narrow_decline'
  ) out.add('mixed_agree_disagree');

  // Point-standing signals.
  if (arg.pointStanding?.hasUnresolvedDebt) out.add('unresolved_debt');
  if (arg.pointStanding?.isRepairAttempt) out.add('repair_attempt');
  if (arg.pointStanding?.isEvasionPossible) out.add('evasion_possible');

  return Array.from(out);
}

/**
 * Pick the most informative single qualifier for compact UI badges.
 * Ordered preference: explicit class > tactic > axis > none.
 */
export function derivePrimaryQualifier(arg: ArgumentLike): MessageQualifier | null {
  const all = deriveMessageQualifiers(arg);
  if (all.length === 0) return null;
  // Class-level signals trump axis-level.
  const classPreference: MessageQualifier[] = [
    'broad_accept_narrow_decline',
    'narrow_accept_broad_decline',
    'mixed_agree_disagree',
    'repair_attempt',
    'unresolved_debt',
    'evasion_possible',
    'tangent_or_joke',
    'concede_small_point',
    'concede_broad_point',
    'synthesize_agreement',
    'synthesize_open_question',
    'ask_receipts',
    'quote_exact_bit',
    'define_term',
    'narrow_scope',
    'counterexample',
    'fact_challenge',
    'evidence_challenge',
    'scope_challenge',
    'definition_challenge',
    'causal_challenge',
    'value_challenge',
    'logic_challenge',
    'branch_this_off',
    'pure_accept',
    'pure_decline',
  ];
  for (const q of classPreference) if (all.includes(q)) return q;
  return all[0];
}

// ── Labels + nudges ────────────────────────────────────────────

const CATEGORY_LABELS: Record<MessageCategory, string> = {
  claim: 'Claim',
  challenge: 'Challenge',
  evidence: 'Evidence',
  clarification: 'Clarification',
  concession: 'Concession',
  synthesis: 'Synthesis',
  receipt_request: 'Receipt request',
  quote_request: 'Quote request',
  mixed_agreement: 'Mixed agreement',
  branch_candidate: 'Branch candidate',
  tangent: 'Tangent',
  repair: 'Repair',
  unresolved_pressure: 'Unresolved pressure',
};

const QUALIFIER_LABELS: Record<MessageQualifier, string> = {
  fact_challenge: 'Fact challenge',
  definition_challenge: 'Definition challenge',
  causal_challenge: 'Cause / effect challenge',
  value_challenge: 'Value challenge',
  evidence_challenge: 'Evidence challenge',
  logic_challenge: 'Logic challenge',
  scope_challenge: 'Scope challenge',
  ask_receipts: 'Receipts, please',
  quote_exact_bit: 'Quote the exact bit',
  narrow_scope: 'Scope got wobbly',
  define_term: 'Define the term',
  counterexample: 'Counterexample dropped',
  concede_small_point: 'Tiny concession, big save',
  concede_broad_point: 'Big concession (honest)',
  synthesize_agreement: 'Peace treaty-ish',
  synthesize_open_question: 'Open question on the table',
  branch_this_off: 'This tangent wants its own room',
  mixed_agree_disagree: 'Mixed: agree-and-disagree',
  broad_accept_narrow_decline: 'Agrees broadly, disputes narrowly',
  narrow_accept_broad_decline: 'Accepts a sub-point, rejects the frame',
  pure_accept: 'Pure agreement',
  pure_decline: 'Pure disagreement',
  tangent_or_joke: 'Tangent or joke',
  unresolved_debt: 'Point needs repair',
  repair_attempt: 'Repair attempt',
  evasion_possible: 'Evasion possible',
};

/** Map a qualifier to a one-line UI nudge ("what should this move do next?"). */
const QUALIFIER_NUDGES: Record<MessageQualifier, string> = {
  fact_challenge: 'Pin the disputed fact and ask for the source.',
  definition_challenge: 'Settle the definition before continuing.',
  causal_challenge: 'Separate correlation from causation in the next move.',
  value_challenge: 'Surface the value priority underneath.',
  evidence_challenge: 'Offer evidence or concede the evidence is thin.',
  logic_challenge: 'Repair the inference or accept the premise change.',
  scope_challenge: 'Narrow the claim to the scope you can defend.',
  ask_receipts: 'Drop the receipts in the next move.',
  quote_exact_bit: 'Quote the parent verbatim and respond to that phrase.',
  narrow_scope: 'Narrow the claim — clarify the case it covers.',
  define_term: 'Pin the definition in the next move.',
  counterexample: 'Respond to the counterexample or narrow the claim.',
  concede_small_point: 'A tiny concession preserves the broader point.',
  concede_broad_point: 'Broad concession recorded — synthesis next.',
  synthesize_agreement: 'Synthesize what changed and close the thread.',
  synthesize_open_question: 'Flag the open question for a separate room.',
  branch_this_off: 'Branch this tangent into its own room.',
  mixed_agree_disagree: 'Name what you accept vs. what you decline.',
  broad_accept_narrow_decline: 'Surface the broad agreement and the narrow defect.',
  narrow_accept_broad_decline: 'Surface the small concession and the larger rejection.',
  pure_accept: 'Extend, add evidence, or identify a caveat to make this playable.',
  pure_decline: 'Name the axis of disagreement.',
  tangent_or_joke: 'Branch the tangent or connect it to the parent point.',
  unresolved_debt: 'Address the open debt — repair, concede, or escalate.',
  repair_attempt: 'Acknowledge the repair attempt; close the debt if accepted.',
  evasion_possible: 'Re-anchor on the open debt — do not let it drift.',
};

export function formatCategoryLabel(category: MessageCategory): string {
  return CATEGORY_LABELS[category] ?? String(category);
}

export function formatQualifierLabel(qualifier: MessageQualifier): string {
  return QUALIFIER_LABELS[qualifier] ?? String(qualifier);
}

export function getQualifierUiNudge(qualifier: MessageQualifier): string {
  return QUALIFIER_NUDGES[qualifier] ?? '';
}

// ── Forbidden-verdict sanity check (used by tests) ─────────────

/**
 * The qualifier vocabulary must NEVER include verdict words like "winner",
 * "loser", "truth", "liar", "dishonest", "bad faith", etc. Tests assert
 * this against every label + nudge.
 */
export function _forbiddenVerdictTokens(): string[] {
  return [
    'winner', 'loser', 'truth', 'verdict', 'liar', 'dishonest',
    'bad faith', 'manipulative', 'manipulation', 'extremist', 'propagandist',
  ];
}
