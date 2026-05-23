/**
 * MCP-MOD-004 — Semantic classifier catalog (Node-side source of truth).
 *
 * Single TypeScript object that holds, per catalog-v0 classifier id, every
 * piece of per-id metadata: the binary signal, the structural yes/no question
 * asked of the AI, the family grouping, the primary banner code, the primary
 * ledger feedback code, and an optional plain-language label.
 *
 * Authority chain (post-MCP-MOD-004):
 *
 *   1. `SemanticClassifierId` union (`semanticRefereeTypes.ts`) — the canonical
 *      id union. This catalog imports the union, never widens it.
 *   2. `ALL_SEMANTIC_CLASSIFIER_IDS` (`semanticRefereeTypes.ts`) — the canonical
 *      ordered id list. This catalog's entries declare in the same order.
 *   3. `SEMANTIC_CLASSIFIER_CATALOG` (this file) — the canonical per-id metadata
 *      table. `seedPrompt.ts`'s `CLASSIFIER_QUESTION_TEXT` derives from this
 *      catalog (via the byte-identical Deno mirror); the banner library's
 *      primary per-id code and the ledger's primary per-id feedback code are
 *      cross-checked against this catalog by parity tests.
 *
 * This file is PURE TYPESCRIPT — same purity rules as `engine.ts`. NO imports
 * from Supabase, React, or any network library. NO runtime side effect. NO
 * mutation. JSON-serializable inputs / outputs.
 *
 * Doctrine (`cdiscourse-doctrine` §1 / §4):
 *   - Every `structuralQuestion` asks about the move's STRUCTURE — never about
 *     truth, popularity, person, or outcome. The ban-list test in
 *     `__tests__/semanticAnthropicSeedPromptBanList.test.ts` scans every entry.
 *   - Every `binarySignal` is plain-language description of a structural
 *     property — never a verdict, never a person label.
 *   - `bannerCode` / `ledgerFeedbackCode` are deterministic mapping anchors.
 *     They surface user-visible language only after passing through the banner
 *     library and the ledger reconciliation; the catalog never authors a
 *     user-facing string itself.
 *
 * Documented design departures (MCP-MOD-004 task spec):
 *   - The catalog exposes a single `bannerCode` field — the PRIMARY banner code
 *     for an id. The banner library's `selectBanner` consumes the FULL priority
 *     list per id (`CLASSIFIER_TO_BANNERS[id]: readonly string[]`), so the
 *     library keeps that table while the catalog holds the primary entry. A
 *     parity test asserts `CATALOG_BY_ID.get(id).bannerCode ===
 *     CLASSIFIER_TO_BANNERS[id][0]` (or both `null` / `[]` for intentionally
 *     silent ids).
 *   - The catalog exposes a single `ledgerFeedbackCode` field — the PRIMARY
 *     feedback code for an id. The ledger's `classifierFor` table is structured
 *     as `RefereePointCategory → SemanticClassifierId` (the inverse direction),
 *     and a single classifier may surface on multiple categories (e.g.
 *     `responds_to_parent` maps the `continuity` and `direct_response`
 *     categories). The ledger keeps that table; the catalog records the
 *     primary feedback code per id for parity / documentation.
 */

import type { SemanticClassifierId } from '../../features/semanticReferee/semanticRefereeTypes';

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
   * The structural yes/no question asked of the model. The Deno mirror's
   * `CLASSIFIER_QUESTION_TEXT` derives from this field, so any wording change
   * here propagates to the live prompt.
   */
  readonly structuralQuestion: string;
  /** The MCP-MOD-002 family grouping this id belongs to. */
  readonly family: SemanticClassifierFamily;
  /**
   * The primary banner code surfaced when this binary fires `value=1` with
   * medium/high confidence. `null` when the id is intentionally silent (the
   * `INTENTIONALLY_SILENT_CLASSIFIERS` carve-out — currently only
   * `contains_unplayable_insult_only`).
   *
   * For ids with multiple candidate codes in the banner library, this is the
   * FIRST entry of `CLASSIFIER_TO_BANNERS[id]` (the primary). The full priority
   * list is owned by the banner library; `selectBanner` consumes it.
   */
  readonly bannerCode: string | null;
  /**
   * The primary referee-ledger feedback code emitted when this binary fires
   * `value=1` on its primary category. `null` when the id contributes only
   * through `scoreHints`, the anti-amplification context, or layer-1 facts
   * (12 of the 23 ids fall in this bucket per MCP-MOD-002 inventory).
   */
  readonly ledgerFeedbackCode: string | null;
  /**
   * Optional plain-language label for downstream UI surfaces. Catalog v0 has
   * no entry here for any id — left as a forward-compatibility seam.
   */
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
      ledgerFeedbackCode: 'clean_parent_tie',
    }),
    Object.freeze({
      id: 'introduces_new_issue',
      binarySignal:
        "The move raises a separately-debatable issue that does not engage the parent's current axis.",
      structuralQuestion:
        'Does this move raise a new issue that could be debated separately from the parent?',
      family: 'parent_continuity',
      bannerCode: 'tangent_new_issue_here',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'asks_for_evidence',
      binarySignal:
        'The move requests a source, citation, primary source, receipt, or exact quote from the participant being replied to.',
      structuralQuestion:
        'Does this move request a source, citation, primary source, receipt, or exact quote?',
      family: 'evidence',
      bannerCode: 'evidence_debt_opened',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'provides_evidence',
      binarySignal:
        'The move includes or references an attached source, excerpt, quotation, or record.',
      structuralQuestion:
        'Does this move include or reference an attached source, excerpt, quotation, or record?',
      family: 'evidence',
      bannerCode: 'evidence_debt_source_attached',
      ledgerFeedbackCode: 'source_attached',
    }),
    Object.freeze({
      id: 'evidence_supports_claim',
      binarySignal:
        'The attached evidence appears to attach to the exact claim being made in the move.',
      structuralQuestion:
        'Does the attached evidence appear to attach to the exact claim being made in this move?',
      family: 'evidence',
      bannerCode: 'evidence_debt_resolved',
      ledgerFeedbackCode: 'evidence_connects',
    }),
    Object.freeze({
      id: 'quote_anchors_parent',
      binarySignal:
        'The move quotes or paraphrases a span of the parent and engages that span in its body.',
      structuralQuestion:
        'Does this move quote or paraphrase a span of the parent and then engage that span in its body?',
      family: 'parent_continuity',
      bannerCode: 'clever_rebuttal_anchored',
      ledgerFeedbackCode: 'nicely_anchored',
    }),
    Object.freeze({
      id: 'narrows_claim',
      binarySignal:
        'The move limits a broader claim to a more specific, more defensible scope.',
      structuralQuestion:
        'Does this move limit a broader claim to a more specific, more defensible scope?',
      family: 'movement',
      bannerCode: 'synthesis_nice_narrowing',
      ledgerFeedbackCode: 'nice_narrowing',
    }),
    Object.freeze({
      id: 'concedes_narrow_point',
      binarySignal:
        'The move accepts a specific, limited point raised by the other participant; the broad point still stands.',
      structuralQuestion:
        'Does this move accept a specific, limited point raised by the other participant?',
      family: 'movement',
      bannerCode: 'synthesis_narrow_concession_noted',
      ledgerFeedbackCode: 'concession_noted',
    }),
    Object.freeze({
      id: 'requests_clarification',
      binarySignal:
        'The move asks what the other participant means by a term or statement.',
      structuralQuestion:
        'Does this move ask what the other participant means by a term or statement?',
      family: 'parent_continuity',
      bannerCode: 'continuity_clarification_landed',
      ledgerFeedbackCode: 'clarification_in_play',
    }),
    Object.freeze({
      id: 'answers_clarification',
      binarySignal:
        'The move answers a clarification request that was raised earlier in the thread.',
      structuralQuestion:
        'Does this move answer a clarification request raised earlier in the thread?',
      family: 'parent_continuity',
      bannerCode: 'continuity_clarification_landed',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'shifts_to_person_or_intent',
      binarySignal:
        'The move redirects from the argument toward the other participant or their intent — a routing signal, never a person label.',
      structuralQuestion:
        'Does this move redirect from the argument toward the other participant or their intent?',
      family: 'friction',
      bannerCode: 'hot_take_keeps_it_about_the_claim',
      ledgerFeedbackCode: 'back_to_the_claim',
    }),
    Object.freeze({
      id: 'uses_popularity_as_evidence',
      binarySignal:
        'The move uses likes, shares, virality, or an "everyone says" appeal as evidentiary support — never a verdict about the participant.',
      structuralQuestion:
        'Does this move use likes, shares, virality, or an "everyone says" appeal as evidentiary support?',
      family: 'evidence',
      bannerCode: 'source_chain_gap_popularity_not_proof',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'contains_playable_hot_take',
      binarySignal:
        'The move is spicy, contrarian, or provocative while still being a coherent, answerable claim.',
      structuralQuestion:
        'Is this move spicy, contrarian, or provocative while still being a coherent, answerable claim?',
      family: 'mode_fit',
      bannerCode: 'hot_take_playable',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'contains_unplayable_insult_only',
      binarySignal:
        'The move is only an insult, with no claim, question, or evidence the room can engage.',
      structuralQuestion:
        'Is this move only an insult, with no claim, question, or evidence to engage?',
      family: 'friction',
      bannerCode: null,
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'is_satire_or_parody',
      binarySignal:
        'The move itself reads as satire, parody, a meme, or fiction rather than a literal claim.',
      structuralQuestion:
        'Does this move itself read as satire, parody, a meme, or fiction rather than a literal claim?',
      family: 'mode_fit',
      bannerCode: 'hot_take_invites_a_reply',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'uses_satire_as_evidence',
      binarySignal:
        'The move uses satire, parody, a meme, or fiction as factual support for a claim.',
      structuralQuestion:
        'Does this move use satire, parody, a meme, or fiction as factual support for a claim?',
      family: 'evidence',
      bannerCode: 'source_chain_gap_satire_not_evidence',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'cites_retraction',
      binarySignal:
        'The move cites a retraction, correction, update, or changed record relevant to the source chain.',
      structuralQuestion:
        'Does this move cite a retraction, correction, update, or changed record?',
      family: 'evidence',
      bannerCode: 'source_chain_gap_retraction_noted',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'creates_source_chain_gap',
      binarySignal:
        'The move leaves a gap in the source trail — a missing origin, quote, context, or link — that prevents the move from carrying factual-standing weight.',
      structuralQuestion:
        'Does this move leave a gap in the source trail — a missing origin, quote, context, or link?',
      family: 'evidence',
      bannerCode: 'source_chain_gap_chain_breaks',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'suggests_side_branch',
      binarySignal:
        'The move would read more cleanly on a same-topic side branch than on the main line.',
      structuralQuestion:
        'Would this move read more cleanly on a same-topic side branch than on the main line?',
      family: 'routing',
      bannerCode: 'branch_new_voice_welcome',
      ledgerFeedbackCode: 'clean_branch',
    }),
    Object.freeze({
      id: 'suggests_diagonal_tangent',
      binarySignal:
        'The move steps to a related but distinct issue that fits its own tangent branch.',
      structuralQuestion:
        'Does this move step to a related but distinct issue that fits its own tangent branch?',
      family: 'routing',
      bannerCode: 'tangent_different_axis',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'fits_selected_debate_mode',
      binarySignal: "The move's register fits the room's selected debate mode.",
      structuralQuestion: "Does this move's register fit the room's selected debate mode?",
      family: 'mode_fit',
      bannerCode: 'mode_mismatch_fits_the_room',
      ledgerFeedbackCode: 'fits_the_room',
    }),
    Object.freeze({
      id: 'needs_pre_send_pause',
      binarySignal:
        'The move could be tightened by its author before it is sent — a pacing nudge, never a block.',
      structuralQuestion: 'Could this move be tightened by its author before it is sent?',
      family: 'movement',
      bannerCode: 'pacing_a_pause_before_sending',
      ledgerFeedbackCode: null,
    }),
    Object.freeze({
      id: 'ready_for_synthesis',
      binarySignal:
        'There is clear shared ground in the thread plus only limited unresolved debt — the point is ready to be summarized as a synthesis.',
      structuralQuestion:
        'Is there clear shared ground in the thread plus only limited unresolved debt?',
      family: 'movement',
      bannerCode: 'synthesis_shared_ground_named',
      ledgerFeedbackCode: 'synthesis_named',
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
