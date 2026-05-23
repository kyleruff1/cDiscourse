/**
 * MCP-MOD-004 / MCP-MOD-006 — Semantic classifier catalog (Deno-side mirror).
 *
 * DOCUMENTED MIRROR of the canonical Node-side source of truth:
 *   src/lib/constitution/semanticClassifierCatalog.ts
 *
 * The Deno tree cannot import the Node file directly — the Node file uses
 * extensionless imports (Jest / Node toolchain) while the Deno tree needs
 * `.ts`-extension specifiers. Same dual-mirror arrangement as
 * `supabase/functions/_shared/semanticReferee/types.ts` (mirror of
 * `src/features/semanticReferee/semanticRefereeTypes.ts`).
 *
 * PARITY: `__tests__/semanticClassifierCatalogDenoNodeParity.test.ts` reads
 * BOTH this file and the Node upstream as source text and fails the build if
 * the per-id catalog entry literals drift. The 23 entries must be byte-equal
 * on the structural rows: id, binarySignal, structuralQuestion, family,
 * bannerCode, bannerCodePriorityList, ledgerFeedbackCode, ledgerCategories.
 *
 * This file is PURE TYPESCRIPT — type declarations + a single frozen `const`
 * array. NO `npm:` import. NO Supabase / React / network import. The
 * `_helpers/semanticRefereeDeno.ts` Jest bridge `require()`s it directly.
 *
 * Doctrine (`cdiscourse-doctrine` §1 / §4):
 *   - Every `structuralQuestion` asks about the move's STRUCTURE — never about
 *     truth, popularity, person, or outcome. The ban-list test in
 *     `__tests__/semanticAnthropicSeedPromptBanList.test.ts` scans every entry
 *     directly (post-MCP-MOD-005 the catalog is the sole source of truth for
 *     per-id question text — `seedPrompt.ts`'s `buildClassifierPrompt`
 *     iterates this catalog directly, no lookup table).
 *   - `bannerCode` / `bannerCodePriorityList` / `ledgerFeedbackCode` /
 *     `ledgerCategories` are deterministic mapping anchors. They surface
 *     user-visible language only after passing through the banner library /
 *     ledger reconciliation; this catalog never authors a user-facing string
 *     itself.
 */

import type { SemanticClassifierId } from './types.ts';

/** The six family groupings the catalog uses to organise the 23 ids. */
export type SemanticClassifierFamily =
  | 'parent_continuity'
  | 'evidence'
  | 'movement'
  | 'mode_fit'
  | 'routing'
  | 'friction';

/** One catalog entry — every piece of per-id metadata for one classifier. */
export interface SemanticClassifierCatalogEntry {
  /** The id-string — must match a member of `ALL_SEMANTIC_CLASSIFIER_IDS`. */
  readonly id: SemanticClassifierId;
  /** Plain-language description of what the binary detects. */
  readonly binarySignal: string;
  /**
   * The structural yes/no question asked of the model. `seedPrompt.ts`'s
   * `buildClassifierPrompt` reads this field directly when iterating the
   * catalog (post-MCP-MOD-005), so any wording change here propagates to the
   * live prompt.
   */
  readonly structuralQuestion: string;
  /** The MCP-MOD-002 family grouping this id belongs to. */
  readonly family: SemanticClassifierFamily;
  /**
   * The primary banner code surfaced when this binary fires `value=1` with
   * medium/high confidence. `null` for the `INTENTIONALLY_SILENT_CLASSIFIERS`
   * carve-out. Kept in sync with `bannerCodePriorityList[0]` (parity test).
   */
  readonly bannerCode: string | null;
  /**
   * The FULL ordered list of candidate banner codes for this id (MCP-MOD-006).
   * Empty for intentionally-silent ids. The Node-side banner library's
   * `CLASSIFIER_TO_BANNERS` is a derived view over this field.
   */
  readonly bannerCodePriorityList: readonly string[];
  /**
   * The primary referee-ledger feedback code emitted when this binary fires
   * `value=1` on its primary category. `null` when the id contributes only
   * through `scoreHints`, the anti-amplification context, or layer-1 facts.
   */
  readonly ledgerFeedbackCode: string | null;
  /**
   * The list of `RefereePointCategory` values this id surfaces under in the
   * ledger's `l2SignalForCategory` lookup (MCP-MOD-006). Empty when the id
   * contributes only through `scoreHints`, the anti-amplification context, or
   * layer-1 facts. The Node-side ledger's `classifierFor` table is a derived
   * view (inverse) over this field. Typed as `readonly string[]` (matching
   * `bannerCodePriorityList`'s posture) so this catalog mirror stays
   * standalone (no cross-file Deno type import). The Node-side parity test
   * enforces every value is a member of `ALL_REFEREE_POINT_CATEGORIES`.
   */
  readonly ledgerCategories: readonly string[];
  /** Optional plain-language label for downstream UI surfaces. */
  readonly plainLanguageLabel?: string;
}

/**
 * The catalog — one entry per `SemanticClassifierId`, declared in the order of
 * `ALL_SEMANTIC_CLASSIFIER_IDS`. Frozen at module load.
 */
export const SEMANTIC_CLASSIFIER_CATALOG: ReadonlyArray<SemanticClassifierCatalogEntry> =
  Object.freeze([
    Object.freeze({
      id: 'responds_to_parent',
      binarySignal:
        "The move directly engages the parent's claim, mechanism, question, evidence, or requested clarification.",
      structuralQuestion:
        "Does this move directly engage the parent's claim, mechanism, question, evidence, or requested clarification?",
      family: 'parent_continuity',
      bannerCode: 'continuity_clean_tie',
      bannerCodePriorityList: Object.freeze([
        'continuity_clean_tie',
        'continuity_engages_mechanism',
        'continuity_picks_up_thread',
      ]),
      ledgerFeedbackCode: 'clean_parent_tie',
      ledgerCategories: Object.freeze(['continuity', 'direct_response']),
    }),
    Object.freeze({
      id: 'introduces_new_issue',
      binarySignal:
        "The move raises a separately-debatable issue that does not engage the parent's current axis.",
      structuralQuestion:
        'Does this move raise a new issue that could be debated separately from the parent?',
      family: 'parent_continuity',
      bannerCode: 'tangent_new_issue_here',
      bannerCodePriorityList: Object.freeze([
        'tangent_new_issue_here',
        'branch_belongs_on_branch',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'asks_for_evidence',
      binarySignal:
        'The move requests a source, citation, primary source, receipt, or exact quote from the participant being replied to.',
      structuralQuestion:
        'Does this move request a source, citation, primary source, receipt, or exact quote?',
      family: 'evidence',
      bannerCode: 'evidence_debt_opened',
      bannerCodePriorityList: Object.freeze([
        'evidence_debt_opened',
        'evidence_debt_a_source_would_help',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'provides_evidence',
      binarySignal:
        'The move includes or references an attached source, excerpt, quotation, or record.',
      structuralQuestion:
        'Does this move include or reference an attached source, excerpt, quotation, or record?',
      family: 'evidence',
      bannerCode: 'evidence_debt_source_attached',
      bannerCodePriorityList: Object.freeze([
        'evidence_debt_source_attached',
        'evidence_debt_resolved',
      ]),
      ledgerFeedbackCode: 'source_attached',
      ledgerCategories: Object.freeze(['evidence_provided']),
    }),
    Object.freeze({
      id: 'evidence_supports_claim',
      binarySignal:
        'The attached evidence appears to attach to the exact claim being made in the move.',
      structuralQuestion:
        'Does the attached evidence appear to attach to the exact claim being made in this move?',
      family: 'evidence',
      bannerCode: 'evidence_debt_resolved',
      bannerCodePriorityList: Object.freeze([
        'evidence_debt_resolved',
        'evidence_debt_source_attached',
      ]),
      ledgerFeedbackCode: 'evidence_connects',
      ledgerCategories: Object.freeze(['evidence_relevance']),
    }),
    Object.freeze({
      id: 'quote_anchors_parent',
      binarySignal:
        'The move quotes or paraphrases a span of the parent and engages that span in its body.',
      structuralQuestion:
        'Does this move quote or paraphrase a span of the parent and then engage that span in its body?',
      family: 'parent_continuity',
      bannerCode: 'clever_rebuttal_anchored',
      bannerCodePriorityList: Object.freeze([
        'clever_rebuttal_anchored',
        'continuity_clean_tie',
      ]),
      ledgerFeedbackCode: 'nicely_anchored',
      ledgerCategories: Object.freeze(['quote_anchoring']),
    }),
    Object.freeze({
      id: 'narrows_claim',
      binarySignal:
        'The move limits a broader claim to a more specific, more defensible scope.',
      structuralQuestion:
        'Does this move limit a broader claim to a more specific, more defensible scope?',
      family: 'movement',
      bannerCode: 'synthesis_nice_narrowing',
      bannerCodePriorityList: Object.freeze([
        'synthesis_nice_narrowing',
        'synthesis_narrow_concession_noted',
      ]),
      ledgerFeedbackCode: 'nice_narrowing',
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'concedes_narrow_point',
      binarySignal:
        'The move accepts a specific, limited point raised by the other participant; the broad point still stands.',
      structuralQuestion:
        'Does this move accept a specific, limited point raised by the other participant?',
      family: 'movement',
      bannerCode: 'synthesis_narrow_concession_noted',
      bannerCodePriorityList: Object.freeze([
        'synthesis_narrow_concession_noted',
        'synthesis_nice_narrowing',
      ]),
      ledgerFeedbackCode: 'concession_noted',
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'requests_clarification',
      binarySignal:
        'The move asks what the other participant means by a term or statement.',
      structuralQuestion:
        'Does this move ask what the other participant means by a term or statement?',
      family: 'parent_continuity',
      bannerCode: 'continuity_clarification_landed',
      bannerCodePriorityList: Object.freeze([
        'continuity_clarification_landed',
        'quote_needed_pin_the_passage',
      ]),
      ledgerFeedbackCode: 'clarification_in_play',
      ledgerCategories: Object.freeze(['clarification']),
    }),
    Object.freeze({
      id: 'answers_clarification',
      binarySignal:
        'The move answers a clarification request that was raised earlier in the thread.',
      structuralQuestion:
        'Does this move answer a clarification request raised earlier in the thread?',
      family: 'parent_continuity',
      bannerCode: 'continuity_clarification_landed',
      bannerCodePriorityList: Object.freeze([
        'continuity_clarification_landed',
        'continuity_answers_question',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'shifts_to_person_or_intent',
      binarySignal:
        'The move redirects from the argument toward the other participant or their intent — a routing signal, never a person label.',
      structuralQuestion:
        'Does this move redirect from the argument toward the other participant or their intent?',
      family: 'friction',
      bannerCode: 'hot_take_keeps_it_about_the_claim',
      bannerCodePriorityList: Object.freeze([
        'hot_take_keeps_it_about_the_claim',
      ]),
      ledgerFeedbackCode: 'back_to_the_claim',
      ledgerCategories: Object.freeze(['person_intent_drift']),
    }),
    Object.freeze({
      id: 'uses_popularity_as_evidence',
      binarySignal:
        'The move uses likes, shares, virality, or an "everyone says" appeal as evidentiary support — never a verdict about the participant.',
      structuralQuestion:
        'Does this move use likes, shares, virality, or an "everyone says" appeal as evidentiary support?',
      family: 'evidence',
      bannerCode: 'source_chain_gap_popularity_not_proof',
      bannerCodePriorityList: Object.freeze([
        'source_chain_gap_popularity_not_proof',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'contains_playable_hot_take',
      binarySignal:
        'The move is spicy, contrarian, or provocative while still being a coherent, answerable claim.',
      structuralQuestion:
        'Is this move spicy, contrarian, or provocative while still being a coherent, answerable claim?',
      family: 'mode_fit',
      bannerCode: 'hot_take_playable',
      bannerCodePriorityList: Object.freeze([
        'hot_take_playable',
        'hot_take_has_an_edge',
        'hot_take_room_can_engage',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'contains_unplayable_insult_only',
      binarySignal:
        'The move is only an insult, with no claim, question, or evidence the room can engage.',
      structuralQuestion:
        'Is this move only an insult, with no claim, question, or evidence to engage?',
      family: 'friction',
      bannerCode: null,
      bannerCodePriorityList: Object.freeze([]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'is_satire_or_parody',
      binarySignal:
        'The move itself reads as satire, parody, a meme, or fiction rather than a literal claim.',
      structuralQuestion:
        'Does this move itself read as satire, parody, a meme, or fiction rather than a literal claim?',
      family: 'mode_fit',
      bannerCode: 'hot_take_invites_a_reply',
      bannerCodePriorityList: Object.freeze([
        'hot_take_invites_a_reply',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'uses_satire_as_evidence',
      binarySignal:
        'The move uses satire, parody, a meme, or fiction as factual support for a claim.',
      structuralQuestion:
        'Does this move use satire, parody, a meme, or fiction as factual support for a claim?',
      family: 'evidence',
      bannerCode: 'source_chain_gap_satire_not_evidence',
      bannerCodePriorityList: Object.freeze([
        'source_chain_gap_satire_not_evidence',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'cites_retraction',
      binarySignal:
        'The move cites a retraction, correction, update, or changed record relevant to the source chain.',
      structuralQuestion:
        'Does this move cite a retraction, correction, update, or changed record?',
      family: 'evidence',
      bannerCode: 'source_chain_gap_retraction_noted',
      bannerCodePriorityList: Object.freeze([
        'source_chain_gap_retraction_noted',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'creates_source_chain_gap',
      binarySignal:
        'The move leaves a gap in the source trail — a missing origin, quote, context, or link — that prevents the move from carrying factual-standing weight.',
      structuralQuestion:
        'Does this move leave a gap in the source trail — a missing origin, quote, context, or link?',
      family: 'evidence',
      bannerCode: 'source_chain_gap_chain_breaks',
      bannerCodePriorityList: Object.freeze([
        'source_chain_gap_chain_breaks',
        'source_chain_gap_trace_it_back',
        'source_chain_gap_one_more_link',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'suggests_side_branch',
      binarySignal:
        'The move would read more cleanly on a same-topic side branch than on the main line.',
      structuralQuestion:
        'Would this move read more cleanly on a same-topic side branch than on the main line?',
      family: 'routing',
      bannerCode: 'branch_new_voice_welcome',
      bannerCodePriorityList: Object.freeze([
        'branch_new_voice_welcome',
        'branch_belongs_on_branch',
      ]),
      ledgerFeedbackCode: 'clean_branch',
      ledgerCategories: Object.freeze(['branch_hygiene']),
    }),
    Object.freeze({
      id: 'suggests_diagonal_tangent',
      binarySignal:
        'The move steps to a related but distinct issue that fits its own tangent branch.',
      structuralQuestion:
        'Does this move step to a related but distinct issue that fits its own tangent branch?',
      family: 'routing',
      bannerCode: 'tangent_different_axis',
      bannerCodePriorityList: Object.freeze([
        'tangent_different_axis',
        'tangent_new_issue_here',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'fits_selected_debate_mode',
      binarySignal: "The move's register fits the room's selected debate mode.",
      structuralQuestion: "Does this move's register fit the room's selected debate mode?",
      family: 'mode_fit',
      bannerCode: 'mode_mismatch_fits_the_room',
      bannerCodePriorityList: Object.freeze([
        'mode_mismatch_fits_the_room',
      ]),
      ledgerFeedbackCode: 'fits_the_room',
      ledgerCategories: Object.freeze(['staying_in_mode']),
    }),
    Object.freeze({
      id: 'needs_pre_send_pause',
      binarySignal:
        'The move could be tightened by its author before it is sent — a pacing nudge, never a block.',
      structuralQuestion: 'Could this move be tightened by its author before it is sent?',
      family: 'movement',
      bannerCode: 'pacing_a_pause_before_sending',
      bannerCodePriorityList: Object.freeze([
        'pacing_a_pause_before_sending',
        'pacing_take_a_short_pause',
      ]),
      ledgerFeedbackCode: null,
      ledgerCategories: Object.freeze([]),
    }),
    Object.freeze({
      id: 'ready_for_synthesis',
      binarySignal:
        'There is clear shared ground in the thread plus only limited unresolved debt — the point is ready to be summarized as a synthesis.',
      structuralQuestion:
        'Is there clear shared ground in the thread plus only limited unresolved debt?',
      family: 'movement',
      bannerCode: 'synthesis_shared_ground_named',
      bannerCodePriorityList: Object.freeze([
        'synthesis_shared_ground_named',
        'synthesis_almost_there',
        'synthesis_sides_converging',
      ]),
      ledgerFeedbackCode: 'synthesis_named',
      ledgerCategories: Object.freeze(['synthesis']),
    }),
  ]);

/**
 * Index by id for O(1) lookup. Built at module load from
 * `SEMANTIC_CLASSIFIER_CATALOG`. Same purity rules — pure data, no side effect.
 */
export const CATALOG_BY_ID: ReadonlyMap<SemanticClassifierId, SemanticClassifierCatalogEntry> =
  (() => {
    const map = new Map<SemanticClassifierId, SemanticClassifierCatalogEntry>();
    for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
      map.set(entry.id, entry);
    }
    return map;
  })();
