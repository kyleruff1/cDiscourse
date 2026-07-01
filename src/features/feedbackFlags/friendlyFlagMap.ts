/**
 * UX-FLAGS-001 — MCP family → friendly feedback flag mapping (pure TypeScript).
 *
 * The translation/mapping layer ONLY. Turns a `(family, rawKey)` machine
 * observation into at most one friendly, plain-language, advisory
 * `FriendlyFlag` descriptor — or `null` (suppressed). It does NOT build the
 * flag UI (#834) and does NOT build the 1–3 cap / priority ranking (#835).
 *
 * Doctrine anchors (cdiscourse-doctrine):
 *  - §1  no verdict/truth labels; module is display-only, never blocks posting.
 *  - §3  popularity is not evidence — every Family D descriptor carries
 *        `neverGrantsStanding:true`; the anti-amplification module is neither
 *        imported nor touched (the flag is descriptive of evidence only).
 *  - §9  unknown family/rawKey → null (mirrors `toPlainLanguage`).
 *  - §10a Family J (`sensitive_composer`) is excluded entirely; challenge/
 *        verdict-adjacent flags carry `ownBubbleSuppressed:true` so #834 can
 *        mirror the own-bubble rail restriction.
 *
 * Pure TS. No React. No Supabase. No network. No side effects. Deterministic,
 * JSON-serializable in/out — same constraints as `messageQualifiers.ts` and
 * `refereeBannerLibrary.ts`.
 */

import type { MachineObservationFamily } from '../nodeLabels/nodeLabelTypes';
import { toPlainLanguage } from '../arguments/gameCopy';

// ── Types ─────────────────────────────────────────────────────────

/** Tone band — word/shape-carried, never color-only (accessibility-targets). */
export type FriendlyFlagTone = 'positive' | 'prompt' | 'descriptive';

/** Stable internal key for a friendly flag. snake_case, NEVER user-visible. */
export type FriendlyFlagKey =
  // Family A — parent_relation
  | 'nice_bridge'
  | 'direct_challenge'
  | 'builds_on_point'
  | 'callback_material'
  // Family B — disagreement_axis
  | 'disagrees_on_scope'
  | 'disagrees_on_facts'
  | 'clean_disagreement'
  // Family C — misunderstanding_repair
  | 'asks_for_clarification'
  | 'cleared_that_up'
  // Family D — evidence_source_chain
  | 'needs_a_receipt'
  | 'brought_receipts'
  | 'open_receipt'
  | 'complete_the_chain'
  // Family E — argument_scheme
  | 'strong_comparison'
  | 'cause_and_effect_claim'
  | 'names_the_pattern'
  // Family F — critical_question
  | 'unanswered_question'
  | 'names_the_uncertainty'
  // Family G — resolution_progress
  | 'clean_concession'
  | 'found_common_ground'
  | 'narrowed_the_claim'
  | 'synthesis_on_the_table'
  // Family H — claim_clarity
  | 'clear_claim'
  | 'could_be_more_specific'
  | 'reads_as_hedged'
  // Family I — thread_topology
  | 'new_issue'
  | 'back_to_earlier_point'
  | 'brings_in_outside_context';

/**
 * DESCRIPTOR ONLY — deliberately no priority, no rank, no cap, no score, no
 * authoritative, no verdict, no React. (#835 owns ranking; #834 owns render.)
 */
export interface FriendlyFlag {
  /** The production family this flag translates. Never user-facing. */
  family: MachineObservationFamily;
  /** Stable internal key. Never user-facing. */
  key: FriendlyFlagKey;
  /** The friendly, plain-language chip label. Ban-list clean. <= 40 chars. */
  label: string;
  /** Optional one-line helper ("why?" / what next). Ban-list clean. <= 80 chars. */
  helper?: string;
  /** Tone band (drives icon/word prefix in #834; never color-only). */
  tone: FriendlyFlagTone;
  /**
   * True when tapping the flag should pre-fill the composer with a matching
   * intent. #834 wires the composer; this only DECLARES the affordance exists.
   */
  actionable: boolean;
  /** Composer preset intent code when actionable, else null. Never user-facing. */
  composerIntent: string | null;
  /**
   * True when this flag is challenge/verdict-adjacent and must be SUPPRESSED on
   * the flag-owner's own bubble (mirrors the own-bubble rail restriction).
   */
  ownBubbleSuppressed: boolean;
  /**
   * True when the family is currently client-render-suppressed (mirrors the
   * live `HUB_NON_PRODUCTION_FAMILIES` complement). `false` for all A–I at ship
   * because the live suppress-set is J-only; the field + mirror constant exist
   * so #834 honors the real gate and a future I re-scope is a one-line flip.
   */
  clientSuppressed: boolean;
  /**
   * Family D descriptors ONLY: always `true`. A hard, test-asserted invariant
   * that this flag describes the evidence dynamic and NEVER grants or denies
   * factual standing (anti-amplification, cdiscourse-doctrine §3).
   */
  neverGrantsStanding?: boolean;
  /** Optional non-user-facing engineering note (I re-scope, D fence, etc.). */
  notes?: string;
}

// ── Mirror constants (single source of truth) ─────────────────────

/** Families NEVER mapped into a product flag. J by design (§10a). */
export const FRIENDLY_FLAG_EXCLUDED_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze(['sensitive_composer']);

/**
 * Families whose flags are client-render-suppressed today. Mirrors the live
 * `HUB_NON_PRODUCTION_FAMILIES` complement at the flag layer. EMPTY at ship
 * (only J is suppressed at the hub, and J is already excluded above). A future
 * Family I re-scope adds 'thread_topology' here — a one-line change.
 */
export const CLIENT_SUPPRESSED_FLAG_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze([]);

// ── The descriptor table ──────────────────────────────────────────

/**
 * Helper lines for D/G delegate to the shared plain-language vocabulary in
 * `gameCopy.PLAIN_LANGUAGE_COPY` rather than re-typing the sentence. `?? ''`
 * only guards the (impossible) unknown-key path; every key below is a real
 * `PLAIN_LANGUAGE_COPY` entry verified against gameCopy.ts.
 */
const OPEN_RECEIPT_HELPER = toPlainLanguage('evidence_debt_open_still') ?? '';
const COMPLETE_CHAIN_HELPER = toPlainLanguage('source_chain_gap_one_more_link') ?? '';
const CLEAN_CONCESSION_HELPER = toPlainLanguage('concession_noted') ?? '';
const COMMON_GROUND_HELPER = toPlainLanguage('synthesis_named') ?? '';

/**
 * Internal (pre-freeze) descriptor table. `clientSuppressed` is populated per
 * entry from `CLIENT_SUPPRESSED_FLAG_FAMILIES` membership so the descriptor
 * tells the truth about the live client gate (not a hard-coded literal).
 */
const RAW_DESCRIPTORS: Record<FriendlyFlagKey, FriendlyFlag> = {
  // ── Family A — parent_relation ──
  nice_bridge: {
    family: 'parent_relation',
    key: 'nice_bridge',
    label: 'Nice bridge',
    helper: 'Ties cleanly to the point above.',
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Describes the relation to the parent; never good/bad.',
  },
  direct_challenge: {
    family: 'parent_relation',
    key: 'direct_challenge',
    label: 'Direct challenge',
    helper: 'Pushes back on the point above.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: true,
    clientSuppressed: false,
    notes: 'Challenge-adjacent — own-bubble suppressed.',
  },
  builds_on_point: {
    family: 'parent_relation',
    key: 'builds_on_point',
    label: 'Builds on the point',
    helper: 'Extends the parent instead of opposing it.',
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
  },
  callback_material: {
    family: 'parent_relation',
    key: 'callback_material',
    label: 'Callback material',
    helper: 'Anchors to a quoted line — good callback fodder.',
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Feeds Quote Forge / Lore.',
  },

  // ── Family B — disagreement_axis ──
  disagrees_on_scope: {
    family: 'disagreement_axis',
    key: 'disagrees_on_scope',
    label: 'Disagrees on scope',
    helper: 'The dispute is about how broad the claim is.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: true,
    clientSuppressed: false,
    notes: 'Axis is descriptive; never a verdict on the person.',
  },
  disagrees_on_facts: {
    family: 'disagreement_axis',
    key: 'disagrees_on_facts',
    label: 'Disagrees on the facts',
    helper: 'The dispute is about a factual point.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: true,
    clientSuppressed: false,
  },
  clean_disagreement: {
    family: 'disagreement_axis',
    key: 'clean_disagreement',
    label: 'Clean disagreement',
    helper: 'Disagrees while keeping it about the argument.',
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
  },

  // ── Family C — misunderstanding_repair ──
  asks_for_clarification: {
    family: 'misunderstanding_repair',
    key: 'asks_for_clarification',
    label: 'Asks for clarification',
    helper: 'Wants the term or reference pinned down.',
    tone: 'prompt',
    actionable: true,
    composerIntent: 'ask_clarify',
    ownBubbleSuppressed: false,
    clientSuppressed: false,
  },
  cleared_that_up: {
    family: 'misunderstanding_repair',
    key: 'cleared_that_up',
    label: 'Cleared that up',
    helper: 'Resolves a misunderstanding — the thread can move on.',
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
  },

  // ── Family D — evidence_source_chain (neverGrantsStanding) ──
  needs_a_receipt: {
    family: 'evidence_source_chain',
    key: 'needs_a_receipt',
    label: 'Needs a receipt',
    helper: 'A source would carry this point further.',
    tone: 'prompt',
    actionable: true,
    composerIntent: 'ask_for_source',
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    neverGrantsStanding: true,
    notes: 'Anti-amplification fence — describes evidence dynamic only.',
  },
  brought_receipts: {
    family: 'evidence_source_chain',
    key: 'brought_receipts',
    label: 'Brought receipts',
    helper: 'A source is attached to this claim.',
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    neverGrantsStanding: true,
    notes: '"attached", NOT "proven" — no standing granted.',
  },
  open_receipt: {
    family: 'evidence_source_chain',
    key: 'open_receipt',
    label: 'Open receipt',
    helper: OPEN_RECEIPT_HELPER,
    tone: 'prompt',
    actionable: true,
    composerIntent: 'ask_for_source',
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    neverGrantsStanding: true,
  },
  complete_the_chain: {
    family: 'evidence_source_chain',
    key: 'complete_the_chain',
    label: 'Complete the source chain',
    helper: COMPLETE_CHAIN_HELPER,
    tone: 'prompt',
    actionable: true,
    composerIntent: 'ask_for_source',
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    neverGrantsStanding: true,
    notes: 'Popularity is not evidence — describes the source trail only.',
  },

  // ── Family E — argument_scheme ──
  strong_comparison: {
    family: 'argument_scheme',
    key: 'strong_comparison',
    label: 'Strong comparison',
    helper: 'Uses an analogy or comparison to make the point.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Detects the pattern only; never a scheme quality verdict.',
  },
  cause_and_effect_claim: {
    family: 'argument_scheme',
    key: 'cause_and_effect_claim',
    label: 'Cause-and-effect claim',
    helper: 'Makes a claim about what causes what.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Never a fallacy call-out.',
  },
  names_the_pattern: {
    family: 'argument_scheme',
    key: 'names_the_pattern',
    label: 'Names a reasoning pattern',
    helper: 'Points at the shape of the reasoning.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'No fallacy framing — an invitation to state the pattern.',
  },

  // ── Family F — critical_question ──
  unanswered_question: {
    family: 'critical_question',
    key: 'unanswered_question',
    label: 'Unanswered question',
    helper: 'A question on the table is still waiting.',
    tone: 'prompt',
    actionable: true,
    composerIntent: 'answer_question',
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Opens inquiry; no gotcha framing.',
  },
  names_the_uncertainty: {
    family: 'critical_question',
    key: 'names_the_uncertainty',
    label: 'Names the uncertainty',
    helper: "Points at exactly what's unclear.",
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
  },

  // ── Family G — resolution_progress ──
  clean_concession: {
    family: 'resolution_progress',
    key: 'clean_concession',
    label: 'Clean concession',
    helper: CLEAN_CONCESSION_HELPER,
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Concession is a repair, not a defeat.',
  },
  found_common_ground: {
    family: 'resolution_progress',
    key: 'found_common_ground',
    label: 'Found common ground',
    helper: COMMON_GROUND_HELPER,
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
  },
  narrowed_the_claim: {
    family: 'resolution_progress',
    key: 'narrowed_the_claim',
    label: 'Narrowed the claim',
    helper: "Tightens the claim to what's defensible.",
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
  },
  synthesis_on_the_table: {
    family: 'resolution_progress',
    key: 'synthesis_on_the_table',
    label: 'Synthesis on the table',
    helper: 'A resolution or settlement is proposed.',
    tone: 'positive',
    actionable: true,
    composerIntent: 'propose_synthesis',
    ownBubbleSuppressed: false,
    clientSuppressed: false,
  },

  // ── Family H — claim_clarity ──
  clear_claim: {
    family: 'claim_clarity',
    key: 'clear_claim',
    label: 'Clear claim',
    helper: 'The claim is stated plainly.',
    tone: 'positive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Descriptive formulation-state.',
  },
  could_be_more_specific: {
    family: 'claim_clarity',
    key: 'could_be_more_specific',
    label: 'Could be more specific',
    helper: 'A little more detail would sharpen this.',
    tone: 'prompt',
    actionable: true,
    composerIntent: 'sharpen_claim',
    ownBubbleSuppressed: true,
    clientSuppressed: false,
    notes: 'Challenge-adjacent on another bubble — own-bubble suppressed.',
  },
  reads_as_hedged: {
    family: 'claim_clarity',
    key: 'reads_as_hedged',
    label: 'Reads as hedged',
    helper: 'The claim is stated tentatively.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Descriptive; never "weak".',
  },

  // ── Family I — thread_topology (clientSuppressed mechanism) ──
  new_issue: {
    family: 'thread_topology',
    key: 'new_issue',
    label: 'New issue',
    helper: 'Opens a new point in the thread.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'A new issue is not a derailment. Available server-side; if a future re-scope re-adds I to the client-suppress set, flip CLIENT_SUPPRESSED_FLAG_FAMILIES.',
  },
  back_to_earlier_point: {
    family: 'thread_topology',
    key: 'back_to_earlier_point',
    label: 'Back to an earlier point',
    helper: 'Returns to a point raised earlier.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Available server-side; client-suppress gate mirrored via CLIENT_SUPPRESSED_FLAG_FAMILIES.',
  },
  brings_in_outside_context: {
    family: 'thread_topology',
    key: 'brings_in_outside_context',
    label: 'Brings in outside context',
    helper: 'Pulls in context from outside this thread.',
    tone: 'descriptive',
    actionable: false,
    composerIntent: null,
    ownBubbleSuppressed: false,
    clientSuppressed: false,
    notes: 'Feeds Memory Lane / callbacks. Available server-side; client-suppress gate mirrored via CLIENT_SUPPRESSED_FLAG_FAMILIES.',
  },
};

// Populate `clientSuppressed` from the mirror (single source of truth) so the
// descriptor reflects the live client gate rather than a hard-coded literal.
for (const key of Object.keys(RAW_DESCRIPTORS) as FriendlyFlagKey[]) {
  const descriptor = RAW_DESCRIPTORS[key];
  descriptor.clientSuppressed = CLIENT_SUPPRESSED_FLAG_FAMILIES.includes(descriptor.family);
}

/** Deep-frozen descriptor table, keyed by FriendlyFlagKey. */
export const FRIENDLY_FLAG_DESCRIPTORS: Readonly<Record<FriendlyFlagKey, FriendlyFlag>> = (() => {
  for (const key of Object.keys(RAW_DESCRIPTORS) as FriendlyFlagKey[]) {
    Object.freeze(RAW_DESCRIPTORS[key]);
  }
  return Object.freeze(RAW_DESCRIPTORS);
})();

/** Every FriendlyFlagKey, frozen — for test enumeration. */
export const ALL_FRIENDLY_FLAG_KEYS: ReadonlyArray<FriendlyFlagKey> = Object.freeze(
  Object.keys(FRIENDLY_FLAG_DESCRIPTORS) as FriendlyFlagKey[],
);

// ── rawKey → FriendlyFlagKey routing (per family) ─────────────────

/**
 * Per-family routing. Keys are the ACTUAL rawKey strings present in
 * `machineObservationDefinitions/family{A..I}.ts` (cross-checked at build
 * time). A rawKey inside a mapped family that matches no entry here returns
 * `null` (under-flag on uncertainty — doctrine-safe). `*_false` / `no_*`
 * readings are never routed. J has no routing table (excluded before lookup).
 */
const RAWKEY_ROUTING: Partial<Record<MachineObservationFamily, Record<string, FriendlyFlagKey>>> = {
  parent_relation: {
    acknowledges_parent_strength: 'nice_bridge',
    quote_anchors_parent: 'callback_material',
    supports_parent: 'nice_bridge',
    acknowledges_parent: 'nice_bridge',
    answers_parent_question: 'nice_bridge',
    challenges_parent: 'direct_challenge',
    identifies_parent_scope_limit: 'direct_challenge',
    contrasts_with_parent: 'direct_challenge',
    corrects_parent_detail: 'direct_challenge',
    refines_parent: 'builds_on_point',
    extends_parent: 'builds_on_point',
    distinguishes_parent: 'builds_on_point',
    reframes_parent: 'builds_on_point',
    compares_parent_to_sibling_branch: 'builds_on_point',
    summarizes_parent: 'builds_on_point',
  },
  disagreement_axis: {
    disputes_scope: 'disagrees_on_scope',
    disputes_generalization: 'disagrees_on_scope',
    identifies_parent_scope_limit: 'disagrees_on_scope',
    disputes_fact: 'disagrees_on_facts',
    disputes_causal_link: 'disagrees_on_facts',
    disputes_evidence_applicability: 'disagrees_on_facts',
    distinguishes_fact_value_disagreement: 'disagrees_on_facts',
    isolates_main_disagreement: 'disagrees_on_scope',
    preserves_face_while_disagreeing: 'clean_disagreement',
  },
  misunderstanding_repair: {
    requests_clarification: 'asks_for_clarification',
    requests_restatement: 'asks_for_clarification',
    flags_ambiguous_reference: 'asks_for_clarification',
    flags_term_ambiguity: 'asks_for_clarification',
    names_ambiguity_source: 'asks_for_clarification',
    offers_repair_path: 'asks_for_clarification',
    clarified: 'cleared_that_up',
    answers_clarification: 'cleared_that_up',
    confirms_understanding: 'cleared_that_up',
    accepts_correction: 'cleared_that_up',
    acknowledges_misread: 'cleared_that_up',
    confirms_shared_definition: 'cleared_that_up',
  },
  evidence_source_chain: {
    asks_for_evidence: 'needs_a_receipt',
    evidence_gap_present: 'needs_a_receipt',
    quote_requested: 'needs_a_receipt',
    concrete_example_requested: 'needs_a_receipt',
    burden_request_present: 'needs_a_receipt',
    provides_evidence: 'brought_receipts',
    source_attached: 'brought_receipts',
    source_provided: 'brought_receipts',
    quote_attached: 'brought_receipts',
    quote_provided: 'brought_receipts',
    sourced: 'brought_receipts',
    supplies_corroborating_document: 'brought_receipts',
    concrete_example_provided: 'brought_receipts',
    statistic_used: 'brought_receipts',
    source_requested: 'open_receipt',
    opens_evidence_debt_marker: 'open_receipt',
    creates_source_chain_gap: 'complete_the_chain',
    flags_context_limit: 'complete_the_chain',
    source_chain_repair: 'complete_the_chain',
  },
  argument_scheme: {
    analogy_reasoning_present: 'strong_comparison',
    precedent_reasoning_present: 'strong_comparison',
    classification_reasoning_present: 'strong_comparison',
    causal_reasoning_present: 'cause_and_effect_claim',
    consequence_reasoning_present: 'cause_and_effect_claim',
    means_end_reasoning_present: 'cause_and_effect_claim',
    example_reasoning_present: 'names_the_pattern',
    authority_reasoning_present: 'names_the_pattern',
    principle_reasoning_present: 'names_the_pattern',
    definition_reasoning_present: 'names_the_pattern',
    tradeoff_reasoning_present: 'names_the_pattern',
    cost_benefit_reasoning_present: 'names_the_pattern',
    risk_reasoning_present: 'names_the_pattern',
    abductive_explanation_present: 'names_the_pattern',
    exception_reasoning_present: 'names_the_pattern',
  },
  critical_question: {
    question_names_uncertainty: 'names_the_uncertainty',
    question_separates_claim_evidence: 'names_the_uncertainty',
    question_invites_revision: 'names_the_uncertainty',
    missing_warrant: 'unanswered_question',
    unstated_assumption: 'unanswered_question',
    counterexample_available: 'unanswered_question',
    alternative_explanation_available: 'unanswered_question',
    qualification_missing: 'unanswered_question',
    comparison_baseline_missing: 'unanswered_question',
  },
  resolution_progress: {
    conceded: 'clean_concession',
    concedes_narrow_point: 'clean_concession',
    concedes_broader_point: 'clean_concession',
    accepts_partial_with_caveat: 'clean_concession',
    common_ground_identified: 'found_common_ground',
    separates_normative_from_empirical: 'found_common_ground',
    narrowed: 'narrowed_the_claim',
    narrows_claim: 'narrowed_the_claim',
    records_remaining_disagreement: 'narrowed_the_claim',
    unresolved_point_isolated: 'narrowed_the_claim',
    synthesis_proposed: 'synthesis_on_the_table',
    synthesis_ready: 'synthesis_on_the_table',
    synthesis_candidate: 'synthesis_on_the_table',
    ready_for_synthesis: 'synthesis_on_the_table',
    proposes_settlement_terms: 'synthesis_on_the_table',
    accepts_settlement_terms: 'synthesis_on_the_table',
    defines_next_evidence_needed: 'synthesis_on_the_table',
  },
  claim_clarity: {
    claim_present: 'clear_claim',
    reason_present: 'clear_claim',
    claim_specificity_high: 'clear_claim',
    claim_specificity_low: 'could_be_more_specific',
    unclear_reference_present: 'could_be_more_specific',
    hedging_present: 'reads_as_hedged',
    modal_language_present: 'reads_as_hedged',
  },
  thread_topology: {
    introduces_new_issue: 'new_issue',
    introduces_sub_axis: 'new_issue',
    splits_thread: 'new_issue',
    returns_to_prior_issue: 'back_to_earlier_point',
    references_prior_agreement: 'back_to_earlier_point',
    references_ancestor_node: 'back_to_earlier_point',
    repeated_axis_pressure: 'back_to_earlier_point',
    references_external_context: 'brings_in_outside_context',
    references_sibling_node: 'brings_in_outside_context',
    compares_options: 'brings_in_outside_context',
  },
};

// ── Normalization + guards ────────────────────────────────────────

/** Same transform `toPlainLanguage` uses: trim, lowercase, spaces/dashes → `_`. */
function normalizeCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized.length > 0 ? normalized : null;
}

/** True for a `*_false` / `no_*` (negative) reading — never routed to a flag. */
function isNegativeReading(rawKey: string): boolean {
  return rawKey.endsWith('_false') || rawKey.startsWith('no_') || rawKey.startsWith('not_');
}

// ── Public API ────────────────────────────────────────────────────

/**
 * The primary mapping. Given a production family and a boolean-observation
 * rawKey, return the single FriendlyFlag descriptor, or `null` (suppressed).
 *
 * Suppression (returns `null`) when ANY of:
 *   - family is in `FRIENDLY_FLAG_EXCLUDED_FAMILIES` (J), OR
 *   - family or rawKey is unknown / unmapped, OR
 *   - the rawKey is a non-positive (`*_false` / `no_*`) reading.
 * The returned descriptor's `clientSuppressed` reflects the mirror; the CALLER
 * (#834) decides whether to render a clientSuppressed flag.
 */
export function friendlyFlagFor(
  family: MachineObservationFamily | string,
  rawKey: string,
): FriendlyFlag | null {
  const normalizedFamily = normalizeCode(family);
  const normalizedRawKey = normalizeCode(rawKey);
  if (normalizedFamily === null || normalizedRawKey === null) return null;

  // J-exclusion — guard BEFORE any rawKey lookup (§10a).
  if (FRIENDLY_FLAG_EXCLUDED_FAMILIES.includes(normalizedFamily as MachineObservationFamily)) {
    return null;
  }

  const familyRouting = RAWKEY_ROUTING[normalizedFamily as MachineObservationFamily];
  if (!familyRouting) return null; // unknown family (or a family with no routing).

  if (isNegativeReading(normalizedRawKey)) return null;

  const flagKey = familyRouting[normalizedRawKey];
  if (!flagKey) return null; // unmapped rawKey inside a mapped family → null.

  return FRIENDLY_FLAG_DESCRIPTORS[flagKey] ?? null;
}

/**
 * Convenience: map a batch of positive (family, rawKey) observations to their
 * FriendlyFlag descriptors, dropping nulls and de-duping by `key`. Order is
 * input order (stable). NO cap, NO ranking (that is #835) — a pure fan-out.
 */
export function friendlyFlagsFor(
  observations: ReadonlyArray<{ family: MachineObservationFamily | string; rawKey: string }>,
): ReadonlyArray<FriendlyFlag> {
  if (!Array.isArray(observations)) return Object.freeze([]);
  const out: FriendlyFlag[] = [];
  const seen = new Set<FriendlyFlagKey>();
  for (const observation of observations) {
    if (!observation) continue;
    const flag = friendlyFlagFor(observation.family, observation.rawKey);
    if (flag === null) continue;
    if (seen.has(flag.key)) continue;
    seen.add(flag.key);
    out.push(flag);
  }
  return Object.freeze(out);
}

/**
 * A thin caller helper: a flag is eligible on the flag-owner's OWN bubble only
 * when it is not challenge/verdict-adjacent. #834 filters own-bubble flags
 * exactly as the existing rail does (own bubble → Qualifiers · Request deletion
 * only). The module never itself knows whose bubble it is.
 */
export function isOwnBubbleEligible(flag: FriendlyFlag): boolean {
  return !flag.ownBubbleSuppressed;
}

/**
 * Verdict tokens that must never appear in any label/helper. Mirrors
 * `messageQualifiers._forbiddenVerdictTokens` (superset — adds the additional
 * §1 truth/quality tokens the ban-list test enumerates).
 */
export function _forbiddenVerdictTokens(): string[] {
  return [
    'winner',
    'loser',
    'won',
    'lost',
    'win',
    'lose',
    'right',
    'wrong',
    'true',
    'false',
    'correct',
    'incorrect',
    'proven',
    'disproven',
    'fallacy',
    'liar',
    'lying',
    'dishonest',
    'bad faith',
    'manipulative',
    'propagandist',
    'extremist',
    'troll',
    'bot',
    'stupid',
    'idiot',
    'truth',
    'verdict',
  ];
}
