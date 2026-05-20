/**
 * MCP-014 — Referee banner: classifier-id / feedback-code → banner maps.
 *
 * `CLASSIFIER_TO_BANNERS` is keyed off ALL 23 `SemanticClassifierId` catalog
 * v0 ids (MCP-011). `FEEDBACK_CODE_TO_BANNER` is keyed off ALL 22
 * `RefereeFeedbackCode` codes (MCP-013). Both are the authoritative maps from
 * already-classified metadata to a `bannerCode` in `REFEREE_BANNER_LIBRARY`.
 *
 * Documented deviation (MCP-014 design § "Documented deviation from MCP-008"):
 * MCP-008 §5 keyed the map off the 90 MCP-002 seed ids. That contract is
 * superseded — a real `SemanticBinarySample.classifierId` is the 23-id union,
 * so the map is keyed off `ALL_SEMANTIC_CLASSIFIER_IDS`. The coverage test
 * asserts the key set equals the catalog automatically.
 *
 * Pure TypeScript. No network. No Supabase. No React.
 */

import type { SemanticClassifierId } from '../semanticReferee/semanticRefereeTypes';
import type { RefereeFeedbackCode } from '../refereeLedger/types';

/**
 * Each of the 23 catalog v0 classifier ids → an ordered list of candidate
 * `bannerCode`s. The first usable candidate after confidence handling wins
 * within its category. `contains_unplayable_insult_only` maps to `[]` — it is
 * an `INTENTIONALLY_SILENT_CLASSIFIERS` member (a routing signal, never a
 * banner; the move is never labelled "an insult").
 */
export const CLASSIFIER_TO_BANNERS: Readonly<
  Record<SemanticClassifierId, readonly string[]>
> = Object.freeze({
  // Continuity-family — the move ties to / answers the parent.
  responds_to_parent: Object.freeze([
    'continuity_clean_tie',
    'continuity_engages_mechanism',
    'continuity_picks_up_thread',
  ]),
  // A new issue is structurally a tangent — route, do not scold.
  introduces_new_issue: Object.freeze([
    'tangent_new_issue_here',
    'branch_belongs_on_branch',
  ]),
  // Asking for evidence opens an evidence debt — a prompt, never a penalty.
  asks_for_evidence: Object.freeze([
    'evidence_debt_opened',
    'evidence_debt_a_source_would_help',
  ]),
  // A source artifact is attached.
  provides_evidence: Object.freeze([
    'evidence_debt_source_attached',
    'evidence_debt_resolved',
  ]),
  // The evidence connects to the claim.
  evidence_supports_claim: Object.freeze([
    'evidence_debt_resolved',
    'evidence_debt_source_attached',
  ]),
  // A quote anchors the move to the parent's exact words.
  quote_anchors_parent: Object.freeze([
    'clever_rebuttal_anchored',
    'continuity_clean_tie',
  ]),
  // Narrowing keeps the broad point — a repair, never a defeat.
  narrows_claim: Object.freeze([
    'synthesis_nice_narrowing',
    'synthesis_narrow_concession_noted',
  ]),
  // A narrow concession — the broad point still stands.
  concedes_narrow_point: Object.freeze([
    'synthesis_narrow_concession_noted',
    'synthesis_nice_narrowing',
  ]),
  // Asking for clarification keeps the thread precise.
  requests_clarification: Object.freeze([
    'continuity_clarification_landed',
    'quote_needed_pin_the_passage',
  ]),
  // Answering a clarification clears up what is argued.
  answers_clarification: Object.freeze([
    'continuity_clarification_landed',
    'continuity_answers_question',
  ]),
  // A drift toward the person — route back to the claim, never label.
  shifts_to_person_or_intent: Object.freeze([
    'hot_take_keeps_it_about_the_claim',
  ]),
  // Popularity is named ONLY to say it is not proof and route to a source.
  uses_popularity_as_evidence: Object.freeze([
    'source_chain_gap_popularity_not_proof',
  ]),
  // A coherent hot take — playable, gives the room something to engage.
  contains_playable_hot_take: Object.freeze([
    'hot_take_playable',
    'hot_take_has_an_edge',
    'hot_take_room_can_engage',
  ]),
  // Intentionally silent — a routing signal, never a banner.
  contains_unplayable_insult_only: Object.freeze([]),
  // Satire / parody — note it so it is not read as a literal claim.
  is_satire_or_parody: Object.freeze([
    'hot_take_invites_a_reply',
  ]),
  // Satire used as evidence — satire is not evidence; ask for a real source.
  uses_satire_as_evidence: Object.freeze([
    'source_chain_gap_satire_not_evidence',
  ]),
  // A retraction is cited — flag the source chain.
  cites_retraction: Object.freeze([
    'source_chain_gap_retraction_noted',
  ]),
  // The source trail has a gap — ask where this came from.
  creates_source_chain_gap: Object.freeze([
    'source_chain_gap_chain_breaks',
    'source_chain_gap_trace_it_back',
    'source_chain_gap_one_more_link',
  ]),
  // A chime-in branch fits a new voice on the same topic.
  suggests_side_branch: Object.freeze([
    'branch_new_voice_welcome',
    'branch_belongs_on_branch',
  ]),
  // A diagonal tangent — a side issue keeps the main thread clear.
  suggests_diagonal_tangent: Object.freeze([
    'tangent_different_axis',
    'tangent_new_issue_here',
  ]),
  // The move fits the selected room mode.
  fits_selected_debate_mode: Object.freeze([
    'mode_mismatch_fits_the_room',
  ]),
  // A pre-send pause would help — pacing nudge.
  needs_pre_send_pause: Object.freeze([
    'pacing_a_pause_before_sending',
    'pacing_take_a_short_pause',
  ]),
  // The point is ready for a synthesis.
  ready_for_synthesis: Object.freeze([
    'synthesis_shared_ground_named',
    'synthesis_almost_there',
    'synthesis_sides_converging',
  ]),
});

/**
 * Each of the 22 `RefereeFeedbackCode`s → exactly one `bannerCode`. A reading
 * is a richer, reconciled signal than a raw binary, so a single banner per
 * code is sufficient. `you_decide_the_lane` maps to the routing banner;
 * `selectBanner` also force-selects that banner for any `conflict_routed`
 * reading independently of this map.
 */
export const FEEDBACK_CODE_TO_BANNER: Readonly<
  Record<RefereeFeedbackCode, string>
> = Object.freeze({
  clean_parent_tie: 'continuity_clean_tie',
  partial_parent_tie: 'continuity_clean_tie_soft',
  answered_the_question: 'continuity_answers_question',
  question_still_open: 'continuity_answers_question_soft',
  source_attached: 'evidence_debt_source_attached',
  evidence_debt_open: 'evidence_debt_opened',
  evidence_connects: 'evidence_debt_resolved',
  evidence_needs_connecting: 'evidence_debt_connect_it',
  nicely_anchored: 'clever_rebuttal_anchored',
  nice_narrowing: 'synthesis_nice_narrowing',
  concession_noted: 'synthesis_narrow_concession_noted',
  broad_point_set_down: 'synthesis_narrow_concession_noted_soft',
  clarification_in_play: 'continuity_clarification_landed',
  almost_a_synthesis: 'synthesis_almost_there',
  synthesis_named: 'synthesis_shared_ground_named',
  clean_branch: 'branch_clean_branch',
  belongs_on_a_branch: 'branch_belongs_on_branch',
  back_to_the_claim: 'hot_take_keeps_it_about_the_claim',
  debt_resolved: 'evidence_debt_resolved',
  fits_the_room: 'mode_mismatch_fits_the_room',
  pacing_is_on: 'pacing_is_on_in_this_room',
  you_decide_the_lane: 'pacing_you_decide_the_lane',
});
