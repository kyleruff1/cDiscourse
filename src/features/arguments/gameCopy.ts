/**
 * Gamified copy strings for the argument room UI.
 * Pure TypeScript — no React, no Supabase.
 *
 * Playful labels are for UI display only.
 * Neutral codes are used in data/logic layers.
 * The system never claims to know truth, winner, or loser.
 *
 * Stage 6.1.0
 */

import { CATALOG_BY_ID as SEMANTIC_CLASSIFIER_CATALOG_BY_ID } from '../../lib/constitution/semanticClassifierCatalog';

// ── Room copy ──────────────────────────────────────────────────

export const ROOM_COPY = {
  title: 'Argument Room',
  startArgument: 'Start an argument',
  inviteChallenger: 'Invite a challenger',
  whatAreClaiming: 'What are you claiming?',
  teeUpCounter: 'Tee up the obvious counter',
  dropBasis: 'Drop your basis',
  noRoomSelected: 'Pick an argument room or start one.',
  createRoom: 'New Argument Room',
  joinRoom: 'Join',
  leaveRoom: 'Leave Room',
  roomResolution: 'Claim',
} as const;

// ── Move copy ──────────────────────────────────────────────────

export const MOVE_COPY = {
  challenge: 'Challenge',
  clarify: 'Clarify',
  dropReceipts: 'Drop receipts',
  concede: 'Concede',
  narrow: 'Narrow it',
  synthesize: 'Synthesize',
  branchOff: 'Branch this off',
  reply: 'Reply',
  counter: 'Counter',
  yourMove: 'Your Move',
} as const;

// ── Receipt copy ───────────────────────────────────────────────

export const RECEIPT_COPY = {
  receipts: 'Receipts',
  dropReceipts: 'Drop receipts',
  showMeSource: 'Show me the source',
  basis: 'Basis',
  counterExample: 'Counterexample',
  receiptsLabel: 'Receipts',
  receiptsHint: 'Drop a link, citation, or source text.',
  receiptsRequired: 'Required for receipt/evidence arguments.',
} as const;

// ── Concession copy ────────────────────────────────────────────

export const CONCESSION_COPY = {
  concedePoint: 'Concede the point',
  surrenderCompletely: 'Surrender completely',
  onlyMostlyWrong: "I'm only MOSTLY wrong",
  misunderstoodContext: 'I misunderstood the context',
  narrowDispute: 'Narrow the dispute',
  concessionSelfDirected: "I'm conceding this point.",
  concessionNote: 'Concession is self-directed — you own it.',
} as const;

// ── Resting status copy ────────────────────────────────────────

export const STATUS_COPY = {
  open: 'Open',
  currentlyAhead: 'Currently ahead',
  moreSupported: 'More supported',
  needsReceipts: 'Needs receipts',
  offTrack: 'Off track',
  branchRecommended: 'Branch recommended',
  peaceTreatyIsh: 'Peace treaty-ish',
  mightBothBeWrong: 'You might both be wrong',
  restingStatus: 'Resting status',
  claimStanding: 'Claim standing',
  noObjectiveTruth: 'This reflects the current state of the argument, not objective fact.',
} as const;

// ── Timeline / track copy ──────────────────────────────────────

export const TIMELINE_COPY = {
  core: 'Core',
  counters: 'Counters',
  receipts: 'Receipts',
  clarifications: 'Clarifications',
  concessions: 'Concessions',
  tangents: 'Tangents',
  branchThisOff: 'Branch this off',
  followThisTrack: 'Follow this track',
  backToCore: 'Back to core',
  showReceipts: 'Show receipts',
  showConcessions: 'Show concessions',
  noArguments: 'No arguments yet. Start one.',
} as const;

// ── Invite copy ────────────────────────────────────────────────

export const INVITE_COPY = {
  inviteSomeone: 'Invite someone to take the other side.',
  theyCanJoin:
    'They can join, counter, add receipts, concede, or branch the argument.',
  copyInviteText: 'Copy invite text',
  copyRoomLink: 'Copy room link',
  inviteBackendComingSoon: 'Invite sending coming later.',
  markAsPlanned: 'Mark as planned invite',
} as const;

// ── Composer copy ──────────────────────────────────────────────

export const COMPOSER_COPY = {
  yourMove: 'Your Move',
  pickMove: 'Pick your move',
  beSpecific: 'Be specific',
  quoteExactBit: 'Quote the exact bit',
  bodyPlaceholder: 'Make your point…',
  advancedControls: 'Advanced controls',
  showAdvanced: 'Show advanced',
  hideAdvanced: 'Hide advanced',
  discard: 'Discard',
  submit: 'Submit',
  draftsaved: 'Draft saved',
  submitDisabled: 'Fill in required fields to submit.',
} as const;

// ── Validation copy ────────────────────────────────────────────

export const VALIDATION_COPY = {
  validationPreview: 'Validation preview',
  noIssues: 'Looks good.',
  blockingErrors: 'Fix before submitting:',
  warnings: 'Heads up:',
  topicScore: 'Topic match',
  constitutionSource: 'Constitution',
} as const;

// ── Stage 6.4 — Plain-language mapping for normal-user surfaces ─

/**
 * Maps internal validation / pipeline codes to human prose. Used in the
 * gallery, action rail, sidecar, composer panel — anywhere a NORMAL user
 * might encounter an internal code from a Flag, a runner stop reason, or
 * a validation rail. Admin / Debug / Dev surfaces may still show the raw
 * code; the helpers in this section are for the normal player flow.
 */
export const PLAIN_LANGUAGE_COPY = {
  // Validation rail codes
  topic_satisfaction_lexical: 'This reply needs a clearer link to the active card.',
  weak_relevance: 'Needs a stronger tie-in',
  parent_nonresponsive: 'Optional: tie this more directly to the parent.',
  tangent_shift: 'Looks like it drifted from the parent.',
  off_topic: 'This may be drifting from the topic.',
  weak_topic: 'Topic coverage is light.',
  unclear_claim: 'Short body — a longer reply is usually clearer.',
  excessive_length: 'Too long — trim it down.',
  invalid_transition: "That move type isn't allowed here.",
  evidence_required: 'Evidence post needs at least one source.',
  missing_parent: "There's nothing to reply to yet.",
  loaded_clarification: 'Clarification reads loaded — keep it neutral.',
  duplicate: "That's very similar to an existing reply.",
  concession_evasion: 'Concession looks like it dodges the original point.',
  fact_confusion: "There's uncertainty mixed with a factual challenge.",
  ad_hominem: 'Keep it about the claim, not the person.',
  civility_risk: 'Tone is getting heated.',
  // Semantic-corpus axes / risks
  source_chain: 'Source trail',
  anti_amplification: 'Popularity is not proof',
  // META-001 — `evidence_debt` updated from prior 'Receipts needed' to
  // 'Evidence debt' to match the manual-tag table verbatim. The pipeline
  // reads the code, not the label, so no runner-side regression. This is
  // the same precedent LIFE-001 set when it updated `synthesis_ready`.
  evidence_debt: 'Evidence debt',
  platform_support_warning: 'Do not score as proven yet',
  // RULE-001 — additional semantic axes used by the rule-to-UI map.
  scope: 'Scope dispute',
  definition: 'Definition dispute',
  logic: 'Logic challenge',
  causal: 'Mechanism challenge',
  // Runner / pipeline status
  validation_failed_after_retries: 'The move needs a clearer shape before it can play well.',
  max_depth_reached: 'Deep unresolved chain',
  // LIFE-001 — synthesis_ready is also a lifecycle state. Updated from the
  // earlier "Near resolution" to match roadmap §6 verbatim. The runner
  // pipeline reads the code, not the label, so no runner-side regression.
  synthesis_ready: 'Ready for synthesis',
  synthesis: 'Resolved',
  concession: 'Conceded',
  submit_failed: 'Posting failed',
  three_in_a_row_failures: 'Posting kept failing — try a different angle.',
  // Participant / role
  observer: 'Watching',
  moderator: 'Observer',
  // ARG-ROOM-002 — room creation / capacity denial codes. Surfaced to the
  // creator when the create-argument-room Edge Function (or its RPC / the
  // capacity trigger) refuses. Structural availability, NEVER a verdict on a
  // person; "full" is a seat fact. Ban-list clean, no snake_case leak.
  private_requires_invite: 'A private argument needs one person invited to start it.',
  room_capacity_reached: 'This argument already has the most people it can hold.',
  // ADMIN-ARGS-INACTIVE-001 — admin-only lifecycle visibility state codes.
  // Surfaced in admin row detail + audit; NEVER on a target argument's
  // public-facing node (doctrine §10a sensitive composer-only). Plain
  // English, no snake_case leak, ban-list clean.
  inactive: 'Inactive (hidden from default views)',
  inactive_at: 'Marked inactive at',
  inactive_by: 'Marked inactive by',
  inactive_reason: 'Admin note (admin-only)',
  affirmative: 'For',
  negative: 'Against',
  neutral: 'Neutral',
  // LIFE-001 — Point lifecycle state vocabulary. 17 new entries (the
  // 18th, `synthesis_ready`, is updated in place above). Each label is a
  // gameplay signal, NEVER a verdict. Zero verdict tokens / amplification
  // tokens / person-attribution tokens. ≤ 32 chars. Plain English.
  open: 'Open for response',
  answered: 'Has a reply',
  rebutted: 'Under pressure',
  clarified: 'Clarified',
  sourced: 'Source attached',
  quote_requested: 'Quote requested',
  source_requested: 'Source requested',
  narrowed: 'Narrowed',
  conceded: 'Conceded by author',
  confirmed: 'Confirmed by other side',
  moved_on_by_affirmative: 'Affirmative moved on',
  moved_on_by_negative: 'Negative moved on',
  ignored_by_affirmative: 'Affirmative did not respond',
  ignored_by_negative: 'Negative did not respond',
  ignored_by_both: 'Nobody followed up',
  exhausted: 'Out of new angles',
  branch_recommended: 'Branch suggested',
  archived_or_resolved: 'Resolved',
  // REF-002 — the Open Issue `moved_on` IssueState. The lifecycle layer
  // only carries side-specific `moved_on_by_*` codes; the person-neutral
  // bare `moved_on` collapses those for the issue card / Open Issues rail.
  moved_on: 'Moved on',
  // META-001 — Manual tag plain labels (9 new; `evidence_debt` is updated
  // above to match the manual-tag table). Each label is a gameplay signal,
  // NEVER a verdict. Zero verdict / amplification / person-attribution
  // tokens. ≤ 32 chars. Plain English.
  needs_source: 'Needs source',
  needs_quote: 'Needs quote',
  definition_issue: 'Definition fight',
  scope_issue: 'Scope challenge',
  causal_mechanism: 'Mechanism challenge',
  concession_offered: 'Concession offered',
  narrowed_claim: 'Narrowed claim',
  tangent: 'Tangent / side issue',
  ready_for_synthesis: 'Ready for synthesis',
  // META-001 — Auto-derived metadata plain labels (14 new; shared codes
  // `source_requested`, `quote_requested`, `synthesis_ready` are owned by
  // LIFE-001 above and reused here intentionally — the two layers describe
  // the same observation from two angles).
  has_reply: 'Has a reply',
  has_rebuttal: 'Has a challenge',
  has_counter_rebuttal: 'Has a counter-challenge',
  has_evidence: 'Evidence attached',
  source_attached: 'Source attached',
  quote_attached: 'Quote attached',
  participant_skipped_node: 'Same side skipped',
  no_response_after_n_turns: 'No follow-up yet',
  repeated_axis_pressure: 'Repeated challenge on same axis',
  branch_suggested: 'Branch suggested',
  branch_created: 'Branch created here',
  point_stalled: 'Point stalled',
  point_exhausted: 'Point exhausted',
  synthesis_candidate: 'Synthesis candidate',
  // MCP-013 — Referee ledger feedbackCode family (21 codes). Every code is a
  // gameplay signal about the MOVE, never a verdict, never a person label.
  // Plain English, no snake_case leak, ban-list-clean. Read by refereeLedgerCopy.ts
  // and MCP-008's banner library. `source_attached` is NOT re-declared here —
  // the existing META-001 `source_attached` key (value 'Source attached')
  // already covers the ledger's `source_attached` feedback code; the ledger and
  // META-001 describe the same observation (MCP-013 design § "gameCopy.ts
  // extension" key-collision check).
  clean_parent_tie: 'Clean parent tie.',
  partial_parent_tie: 'Answers part of it — the main point is still open.',
  answered_the_question: 'That answers the question on the table.',
  question_still_open: 'The question on the table is still waiting for an answer.',
  evidence_debt_open: 'Good pressure — evidence debt opened.',
  evidence_connects: 'The evidence lines up with the claim.',
  evidence_needs_connecting: 'Evidence is here — connect it to the exact claim.',
  nicely_anchored: 'Nicely anchored to their words.',
  nice_narrowing: 'Nice narrowing move — the broader point holds.',
  concession_noted: 'Narrow concession noted — the broad point still stands.',
  broad_point_set_down: 'Broad point set down — an honest move.',
  clarification_in_play: "Good — that clears up what's being argued.",
  almost_a_synthesis: 'Almost a synthesis — name the shared point.',
  synthesis_named: 'Shared ground named — nice synthesis.',
  clean_branch: 'Clean branch — both threads stay readable.',
  belongs_on_a_branch: 'This probably belongs on a branch.',
  back_to_the_claim: 'This is about the claim, not the person — bring it back to the claim.',
  debt_resolved: 'Evidence debt resolved — nice.',
  fits_the_room: 'Fits the room.',
  pacing_is_on: 'Pacing is on in this room — a short beat helps.',
  you_decide_the_lane: 'Reply here, branch, or tangent? — you decide.',
  // MCP-014 — Referee banner library bannerCode family (103 codes). Every
  // code is a gameplay signal about the MOVE, never a verdict, never a person
  // label. Plain English, no snake_case leak, ban-list-clean. The VALUE is the
  // banner's `headline` verbatim. Read by toPlainLanguage so an unmapped
  // bannerCode is suppressed, not echoed. Append-only — no existing key
  // changed. Every bannerCode is category-prefixed so it cannot collide with a
  // pre-existing key. Softened siblings (`*_soft`) each get their own entry.
  // continuity (10)
  continuity_clean_tie: 'Clean parent tie.',
  continuity_clean_tie_soft: 'This looks like it ties to the parent.',
  continuity_engages_mechanism: 'Good — this engages the actual point above.',
  continuity_engages_mechanism_soft: 'This may be engaging the point above.',
  continuity_answers_question: 'That answers the question on the table.',
  continuity_answers_question_soft: 'This reads as an answer to the open question.',
  continuity_picks_up_thread: 'Nice — the thread keeps moving here.',
  continuity_picks_up_thread_soft: 'This looks like it keeps the thread moving.',
  continuity_clarification_landed: "Good — that clears up what's being argued.",
  continuity_clarification_landed_soft: 'This may help clear up what is being argued.',
  // evidence_debt (9)
  evidence_debt_opened: 'Good pressure — an evidence debt opened.',
  evidence_debt_opened_soft: 'This might open an evidence debt.',
  evidence_debt_resolved: 'Evidence debt resolved — nice.',
  evidence_debt_resolved_soft: 'This looks like it resolves an evidence debt.',
  evidence_debt_source_attached: 'Source attached — that backs the claim.',
  evidence_debt_source_attached_soft: 'A source may be attached to this claim.',
  evidence_debt_connect_it: 'Evidence is here — connect it to the exact claim.',
  evidence_debt_open_still: 'A source is still open on this point.',
  evidence_debt_a_source_would_help: 'A source would carry this point further.',
  // MCP-CAT-001 evidence_debt extensions (8) — applicability / debt-marker /
  // corroborating-document banners introduced with catalog v1.
  evidence_debt_applicability_disputed:
    'Applicability disputed — what the evidence covers is in play.',
  evidence_debt_applicability_disputed_soft:
    'This may dispute what the evidence covers.',
  evidence_debt_marker_opened:
    'Source requested — a tracked evidence-debt marker is open.',
  evidence_debt_marker_opened_soft: 'A tracked source request may be opening here.',
  evidence_debt_marker_closed: 'Source supplied — evidence-debt marker closed.',
  evidence_debt_marker_closed_soft:
    'This looks like it closes a tracked source request.',
  evidence_debt_corroborating_document:
    'Corroborating document attached — supports a prior claim.',
  evidence_debt_corroborating_document_soft:
    'This may attach a corroborating document.',
  // hot_take (9)
  hot_take_playable: 'Bold move — and it stays playable.',
  hot_take_playable_soft: 'This reads as a bold but playable move.',
  hot_take_has_an_edge: 'This has an edge — and a foothold to reply to.',
  hot_take_has_an_edge_soft: 'This may have an edge worth replying to.',
  hot_take_coherent: 'Strong take — it holds together.',
  hot_take_coherent_soft: 'This take looks like it holds together.',
  hot_take_invites_a_reply: 'A spicy take — it invites a real reply.',
  hot_take_room_can_engage: 'Sharp angle — the room has something to engage.',
  hot_take_keeps_it_about_the_claim: 'A bold claim that stays about the claim.',
  // clever_rebuttal (9)
  clever_rebuttal_sharp_counter: 'Sharp counter — it lands on the point.',
  clever_rebuttal_sharp_counter_soft: 'This reads as a sharp counter.',
  clever_rebuttal_anchored: 'Nicely anchored to their words.',
  clever_rebuttal_anchored_soft: 'This may be anchored to their words.',
  clever_rebuttal_finds_the_seam: 'Good eye — this finds the seam in the claim.',
  clever_rebuttal_finds_the_seam_soft: 'This might find the seam in the claim.',
  clever_rebuttal_counterexample: 'A counterexample — it tests the claim directly.',
  clever_rebuttal_tight_pressure: 'Tight pressure — the claim has to answer this.',
  clever_rebuttal_names_the_gap: 'Clear pushback — it names where the claim falls short.',
  // source_chain_gap (9)
  source_chain_gap_popularity_not_proof: "Popularity isn't proof — what's the source?",
  source_chain_gap_trace_it_back: 'Where did this come from? Trace it back a step.',
  source_chain_gap_chain_breaks: 'The source trail has a gap — name the origin.',
  source_chain_gap_chain_breaks_soft: 'The source trail may have a gap here.',
  source_chain_gap_retraction_noted: 'This cites a retraction — worth flagging the chain.',
  source_chain_gap_retraction_noted_soft: 'This may be pointing at a retracted source.',
  source_chain_gap_satire_not_evidence: 'Satire is not evidence — a real source helps here.',
  source_chain_gap_ask_for_origin: 'Ask for the origin before this carries weight.',
  source_chain_gap_one_more_link: 'One more link would close the source trail.',
  // branch_suggestion (8)
  branch_belongs_on_branch: 'This probably belongs on a branch.',
  branch_clean_branch: 'Clean branch — both threads stay readable.',
  branch_clean_branch_soft: 'This looks like a clean branch.',
  branch_new_voice_welcome: 'A new voice on the same topic — a chime-in branch fits.',
  branch_side_issue_home: 'A side branch is a tidy home for this.',
  branch_keeps_mainline_clear: 'Branch this — the main line stays clear.',
  branch_two_threads_at_once: 'Two threads at once — a branch separates them.',
  branch_open_it_on_the_side: 'Open this on the side without losing the thread.',
  // tangent_suggestion (8)
  tangent_new_issue_here: 'This opens a new issue — a tangent keeps it tidy.',
  tangent_drifts_from_parent: 'This drifts from the point above — try a side issue.',
  tangent_drifts_from_parent_soft: 'This may be drifting from the point above.',
  tangent_different_axis: 'A different axis than the one above — a tangent fits.',
  tangent_park_it_alongside: 'Park this alongside the main thread as a tangent.',
  tangent_worth_its_own_lane: 'Worth its own lane — a tangent keeps both readable.',
  tangent_fresh_thread_reads_clearer: 'A fresh thread reads clearer for this one.',
  tangent_side_trip_keeps_focus: 'A side trip here keeps the main point in focus.',
  // synthesis_readiness (9)
  synthesis_shared_ground_named: 'Shared ground named — nice synthesis.',
  synthesis_shared_ground_named_soft: 'This reads as naming shared ground.',
  synthesis_almost_there: 'Almost a synthesis — name the shared point.',
  synthesis_sides_converging: 'The two sides are converging here.',
  synthesis_sides_converging_soft: 'The two sides may be converging here.',
  synthesis_narrow_concession_noted: 'Narrow concession noted — the broad point still stands.',
  synthesis_narrow_concession_noted_soft:
    'This may be a narrow concession that keeps the broad point.',
  synthesis_nice_narrowing: 'Nice narrowing — the broader point holds.',
  synthesis_nice_narrowing_soft: 'This looks like a narrowing that keeps the broader point.',
  // MCP-CAT-001 synthesis_readiness extensions (16) — movement / qualified-
  // concession / sub-axis / settlement banners introduced with catalog v1.
  // Every line names a STRUCTURAL move shape; settlement copy follows the
  // band-space-rent scenario's `permittedSettlementLanguage` (settled /
  // resolved / accepted) and avoids `forbiddenSettlementLanguage`.
  synthesis_prior_agreement_cited: 'Prior agreement cited — context for the dispute.',
  synthesis_prior_agreement_cited_soft:
    'This may be citing a prior agreement between participants.',
  synthesis_temporal_anchor_added:
    'Temporal anchor added — a date or boundary for the dispute.',
  synthesis_temporal_anchor_added_soft: 'A date or boundary may be added here.',
  synthesis_qualified_concession_with_caveat:
    'Agreed with caveat — the point lands; a qualifier stays.',
  synthesis_qualified_concession_with_caveat_soft:
    'This reads as a partial agreement with a caveat.',
  synthesis_alternate_interpretation_offered:
    'Alternate reading offered for an existing artifact.',
  synthesis_alternate_interpretation_offered_soft:
    'An alternate reading may be offered for an existing artifact.',
  synthesis_sub_axis_introduced: 'New sub-dispute opened on the same mainline.',
  synthesis_sub_axis_introduced_soft:
    'A more specific sub-dispute may be opening here.',
  synthesis_concession_with_new_dispute:
    'Conceded on one axis; a new dispute opens on another.',
  synthesis_concession_with_new_dispute_soft:
    'This may concede on one axis and open another.',
  synthesis_settlement_proposed:
    'Settlement proposed — resolution terms on the table.',
  synthesis_settlement_proposed_soft: 'This may be proposing resolution terms.',
  synthesis_settlement_accepted:
    'Settlement accepted — resolution terms agreed.',
  synthesis_settlement_accepted_soft:
    'This looks like an acceptance of proposed resolution terms.',
  // quote_needed (8)
  quote_needed_exact_excerpt: 'Source is here — the exact quote is still needed.',
  quote_needed_pin_the_passage: 'Pin the exact passage you mean.',
  quote_needed_which_line: 'Which line in the source? Quote it directly.',
  quote_needed_anchor_to_their_words: 'Anchor this to their exact words.',
  quote_needed_paraphrase_only: 'A paraphrase so far — the quoted text would help.',
  quote_needed_ask_for_quote: 'Ask for the exact quote before building on it.',
  quote_needed_show_the_words: 'Show the words — a quote makes this concrete.',
  quote_needed_excerpt_anchors_it: 'An excerpt would anchor this to the source.',
  // mechanism_needed (8)
  mechanism_needed_how_does_it_work: 'How does this work? Name the mechanism.',
  mechanism_needed_connect_cause_effect: 'Connect the cause to the effect here.',
  mechanism_needed_why_does_that_follow: 'Why does that follow? Show the link.',
  mechanism_needed_steps_are_missing: 'A step is missing between the claim and the result.',
  mechanism_needed_spell_out_the_chain: 'Spell out the chain from premise to conclusion.',
  mechanism_needed_what_drives_it: 'What drives this outcome? Name it.',
  mechanism_needed_logic_gap: 'There is a gap in the logic — fill it in.',
  mechanism_needed_show_the_working: 'Show the working behind this claim.',
  // mode_mismatch (8)
  mode_mismatch_register_off: 'This reads off-register for the room.',
  mode_mismatch_register_off_soft: 'This may read off-register for the room.',
  mode_mismatch_fits_the_room: 'Fits the room.',
  mode_mismatch_fits_the_room_soft: 'This looks like it fits the room.',
  mode_mismatch_check_the_mode: 'Check the room mode — this move type may not fit.',
  mode_mismatch_room_expects_more_structure: 'This room expects a bit more structure here.',
  mode_mismatch_tone_for_a_casual_room: 'This room runs casual — a lighter tone fits.',
  mode_mismatch_match_the_room_style: 'A small tweak matches this to the room style.',
  // pacing_cooldown (8)
  pacing_you_decide_the_lane: 'Reply here, branch, or tangent? — you decide.',
  pacing_take_a_short_pause: 'A short pause helps before the next move.',
  pacing_is_on_in_this_room: 'Pacing is on in this room — a short pause helps.',
  pacing_let_the_reply_land: 'Let the last reply land before the next one.',
  pacing_room_for_the_other_side: 'Leave room for the other side to respond.',
  pacing_cooldown_is_active: 'A short cooldown is on — the next move is soon.',
  pacing_one_move_at_a_time: 'One move at a time keeps the thread followable.',
  pacing_a_pause_before_sending: 'A pause before sending is worth it here.',
  // MCP-015 — Semantic override UX copy. Each string is about WHERE the move
  // goes / WHAT the user decided — never about the move being wrong, never
  // about the person. Plain English, no snake_case leak, ban-list-clean.
  // Overriding is never a penalty: no "you were warned" framing anywhere.
  // Append-only — no existing key changed. `tangent` is NOT re-declared here:
  // the existing META-001 `tangent` key (value 'Tangent / side issue') already
  // covers the override layer's `tangent` lane — the two layers describe the
  // same lane vocabulary (MCP-015 design § "gameCopy.ts copy extension"
  // key-collision check).
  mainline: 'Mainline reply',
  branch: 'Branch',
  answers_parent: 'Marked as a direct reply',
  semantic_override_prompt_low_conf: 'Not a reply? Choose where this goes.',
  semantic_override_prompt_conflict: 'You choose the lane for this move.',
  semantic_override_prompt_soft: 'You decide the lane here.',
  semantic_override_lane_mainline: 'Reply here — this stays on the mainline.',
  semantic_override_lane_branch: 'Branch — this opens a related thread.',
  semantic_override_lane_tangent: 'Tangent — this is a separate side issue.',
  semantic_override_answers_parent:
    'This answers the parent — count it as a direct reply.',
  semantic_override_confirm_changed: 'Set the lane',
  semantic_override_confirm_keep: 'Keep referee suggestion',
  semantic_override_recorded_lane: 'You set the lane.',
  semantic_override_recorded_answers: 'You marked this as a direct reply.',
  semantic_override_original_suggestion: 'Referee had suggested another lane.',
  semantic_override_change: 'Change',
  // QOL-039 — Room visibility reason codes (plain-language, never raw).
  // The action is HIDDEN when ineligible (no silent no-op), but a rare
  // surface — e.g. an admin tool — may need to label the reason; this
  // routes the internal code through toPlainLanguage just like every
  // other internal code in the system.
  eligible: 'You can make this argument private.',
  already_private: 'This argument is already private.',
  not_room_creator:
    'Only the person who started this argument can change its visibility.',
  room_archived: 'This argument is closed — its visibility is fixed.',
  // MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — plain-language for the
  // observation-mapping evaluator's adopted observation codes. Every value is
  // a verdict-free, move-level description ("what the referee noticed about
  // this reply"), advisory, never a verdict or an author label. The codes are
  // dotted (e.g. parent_relation.single_true.challenges_parent); toPlainLanguage
  // preserves dots and lowercases, so the keys match the codes verbatim. An
  // unmapped code is suppressed (null) and the evaluator falls back to the
  // rule's verdict-free labelNeutral — a raw code can never leak.
  'evidence_source_chain.single_true.provides_evidence':
    'This reply gives some reasoning and can support productive disagreement.',
  'evidence_source_chain.single_false.provides_evidence':
    'This reply states opposition but may need more reasons or evidence.',
  'parent_relation.single_true.challenges_parent':
    'This reply pushes back on the parent move on at least one point.',
  'parent_relation.single_true.refines_parent':
    'This reply keeps the parent direction and proposes a more precise version.',
  'resolution_progress.single_true.concedes_narrow_point':
    'This reply concedes a narrow point while leaving the broader point in play.',
  'evidence_source_chain.single_false.has_evidence':
    'No attached evidence was observed on this move; a later move can add a source.',
  'parent_relation.pair_true_true.challenges_parent.quote_anchors_parent':
    'This reply pushes back and anchors to a quoted part of the parent, making the disagreement precise.',
  'evidence_source_chain.pair_true_true.source_attached.quote_attached':
    'This reply attaches both a source and a quote, which makes the evidence chain easier to inspect.',
  'resolution_progress.pair_true_true.narrows_claim.concedes_narrow_point':
    'This reply narrows the claim and concedes a narrow point, a common repair move.',
  'parent_relation.pair_true_false.challenges_parent.no_quote_anchor':
    'This reply pushes back but does not anchor to a quoted part; quoting the exact part can sharpen the exchange.',
  'evidence_source_chain.pair_false_true.asks_for_evidence.no_evidence':
    'This reply asks for evidence and does not attach its own; the reply it targets can answer with a source.',
  'parent_relation.curated_triple.anchored_detail_challenge':
    'This reply pushes back, anchors to a quoted part, and corrects a specific detail, engaging a precise point.',
  'cross_family.disputes_evidence_applicability.provides_evidence':
    'This reply challenges how the evidence applies and provides evidence of its own, which can deepen the exchange.',
  // MCP-BUILD2a (Family B disagreement_axis expansion) — plain-language for the
  // 3 new disagreement-quality booleans' mapping rows. Every value is verdict-
  // free, move-level, and describes the MOVE never the author. No underscores
  // (the registry review-gate asserts the displayed string is snake-free).
  // ── isolates_main_disagreement ──
  'disagreement_axis.single_true.isolates_main_disagreement':
    'This reply points to the specific part it disagrees with, which keeps the exchange precise.',
  'disagreement_axis.single_false.isolates_main_disagreement':
    'This reply disagrees in general terms; naming the specific point can sharpen the exchange.',
  // ── distinguishes_fact_value_disagreement ──
  'disagreement_axis.single_true.distinguishes_fact_value_disagreement':
    'This reply separates a question of fact from a question of values, which can clarify the disagreement.',
  'disagreement_axis.single_false.distinguishes_fact_value_disagreement':
    'This reply does not separate fact from values; drawing that line can clarify the disagreement.',
  // ── preserves_face_while_disagreeing ──
  'disagreement_axis.single_true.preserves_face_while_disagreeing':
    'This reply disagrees while keeping the focus on the argument rather than the person.',
  'disagreement_axis.single_false.preserves_face_while_disagreeing':
    'This reply disagrees in a plain register; this is only an observation about phrasing, not a concern.',
  // ── pairs over the 3 new booleans ──
  'disagreement_axis.pair_true_true.isolates_main_disagreement.distinguishes_fact_value_disagreement':
    'This reply pins the specific point and separates fact from values, which keeps the exchange precise.',
  'disagreement_axis.pair_true_false.isolates_main_disagreement.no_fact_value_split':
    'This reply pins the specific point but does not separate fact from values; drawing that line can clarify it.',
  'disagreement_axis.pair_false_true.distinguishes_fact_value_disagreement.no_point_isolated':
    'This reply separates fact from values but disagrees in general terms; naming the point can sharpen it.',
  'disagreement_axis.pair_true_true.isolates_main_disagreement.preserves_face_while_disagreeing':
    'This reply pins the specific point and keeps the focus on the argument rather than the person.',
  'disagreement_axis.pair_true_false.isolates_main_disagreement.no_face_preservation':
    'This reply pins the specific point in a plain register; this is only an observation about phrasing.',
  'disagreement_axis.pair_false_true.preserves_face_while_disagreeing.no_point_isolated':
    'This reply keeps the focus on the argument but disagrees in general terms; naming the point can sharpen it.',
  'disagreement_axis.pair_true_true.distinguishes_fact_value_disagreement.preserves_face_while_disagreeing':
    'This reply separates fact from values and keeps the focus on the argument rather than the person.',
  'disagreement_axis.pair_true_false.distinguishes_fact_value_disagreement.no_face_preservation':
    'This reply separates fact from values in a plain register; this is only an observation about phrasing.',
  'disagreement_axis.pair_false_true.preserves_face_while_disagreeing.no_fact_value_split':
    'This reply keeps the focus on the argument but does not separate fact from values; drawing that line can clarify it.',
  // MCP-BUILD2b (Family A parent_relation expansion) — plain-language for the
  // 3 new parent-relation booleans' mapping rows. Every value is verdict-free,
  // move-level, and describes the MOVE never the author. No underscores (the
  // registry review-gate asserts the displayed string is snake-free). The
  // acknowledges_parent_strength (A1) values are fenced: they describe the
  // move's structure (grants a point before disagreeing) and never assert the
  // parent point is correct/true/strong.
  // ── acknowledges_parent_strength ──
  'parent_relation.single_true.acknowledges_parent_strength':
    'This reply grants a point of the parent before disagreeing, which can keep the exchange constructive.',
  'parent_relation.single_false.acknowledges_parent_strength':
    'This reply disagrees without granting a point first; this is only an observation about phrasing, not a concern.',
  // ── compares_parent_to_sibling_branch ──
  'parent_relation.single_true.compares_parent_to_sibling_branch':
    'This reply compares the parent move to a sibling branch in the same thread, which can place the disagreement in context.',
  'parent_relation.single_false.compares_parent_to_sibling_branch':
    'This reply stays within the parent line without comparing to a sibling branch.',
  // ── identifies_parent_scope_limit ──
  'parent_relation.single_true.identifies_parent_scope_limit':
    'This reply names a specific scope limit on the parent claim, which can sharpen where it applies.',
  'parent_relation.single_false.identifies_parent_scope_limit':
    'This reply does not name a specific scope limit; naming where the claim stops applying can sharpen the exchange.',
  // ── pairs over the 3 new booleans ──
  'parent_relation.pair_true_true.acknowledges_parent_strength.compares_parent_to_sibling_branch':
    'This reply grants a point before disagreeing and compares the parent to a sibling branch, which can keep the exchange constructive and in context.',
  'parent_relation.pair_true_false.acknowledges_parent_strength.no_sibling_comparison':
    'This reply grants a point before disagreeing but does not compare to a sibling branch.',
  'parent_relation.pair_false_true.compares_parent_to_sibling_branch.no_point_granted':
    'This reply compares the parent to a sibling branch but does not grant a point before disagreeing.',
  'parent_relation.pair_true_true.acknowledges_parent_strength.identifies_parent_scope_limit':
    'This reply grants a point before disagreeing and names a specific scope limit, which can sharpen where the claim applies.',
  'parent_relation.pair_true_false.acknowledges_parent_strength.no_scope_limit':
    'This reply grants a point before disagreeing but does not name a specific scope limit.',
  'parent_relation.pair_false_true.identifies_parent_scope_limit.no_point_granted':
    'This reply names a specific scope limit but does not grant a point before disagreeing.',
  'parent_relation.pair_true_true.compares_parent_to_sibling_branch.identifies_parent_scope_limit':
    'This reply compares the parent to a sibling branch and names a specific scope limit, which can place the disagreement in context.',
  'parent_relation.pair_true_false.compares_parent_to_sibling_branch.no_scope_limit':
    'This reply compares the parent to a sibling branch but does not name a specific scope limit.',
  'parent_relation.pair_false_true.identifies_parent_scope_limit.no_sibling_comparison':
    'This reply names a specific scope limit but does not compare to a sibling branch.',
  // MCP-BUILD2c (Family C misunderstanding_repair expansion) — plain-language
  // for the 3 new repair booleans' mapping rows. Every value is verdict-free,
  // move-level, and describes the MOVE never the author. No underscores (the
  // registry review-gate asserts the displayed string is snake-free). The
  // accepts_correction (C3) values are fenced "repair-not-defeat": they
  // describe taking up a point a prior move offered and never frame it as a
  // defeat / concession of the whole; the standalone verdict token "correct"
  // never appears (word-boundary clean).
  // ── offers_repair_path ──
  'misunderstanding_repair.single_true.offers_repair_path':
    'This reply proposes a concrete way to resolve a misunderstanding, which can move the exchange forward.',
  'misunderstanding_repair.single_false.offers_repair_path':
    'This reply does not propose a concrete resolution path; this is only an observation about phrasing, not a concern.',
  // ── names_ambiguity_source ──
  'misunderstanding_repair.single_true.names_ambiguity_source':
    'This reply names the specific term or reference that is ambiguous and why, which can sharpen the exchange.',
  'misunderstanding_repair.single_false.names_ambiguity_source':
    'This reply does not name a specific ambiguity source; naming which term is unclear can sharpen the exchange.',
  // ── accepts_correction (repair-not-defeat fence) ──
  'misunderstanding_repair.single_true.accepts_correction':
    'This reply takes up a point a prior move offered, which can keep the exchange constructive; this is a repair, not a concession of the whole.',
  'misunderstanding_repair.single_false.accepts_correction':
    'This reply does not take up a point a prior move offered; this is only an observation about phrasing, not a concern.',
  // ── pairs over the 3 new booleans ──
  'misunderstanding_repair.pair_true_true.offers_repair_path.names_ambiguity_source':
    'This reply names the specific ambiguity source and proposes a concrete way to resolve it, which can move the exchange forward.',
  'misunderstanding_repair.pair_true_false.offers_repair_path.no_ambiguity_source':
    'This reply proposes a concrete way to resolve a misunderstanding but does not name a specific ambiguity source.',
  'misunderstanding_repair.pair_false_true.names_ambiguity_source.no_repair_path':
    'This reply names the specific ambiguity source but does not propose a concrete way to resolve it.',
  'misunderstanding_repair.pair_true_true.offers_repair_path.accepts_correction':
    'This reply takes up a point a prior move offered and proposes a concrete way to resolve the misunderstanding, which can keep the exchange constructive.',
  'misunderstanding_repair.pair_true_false.offers_repair_path.no_point_taken_up':
    'This reply proposes a concrete way to resolve a misunderstanding but does not take up a point a prior move offered.',
  'misunderstanding_repair.pair_false_true.accepts_correction.no_repair_path':
    'This reply takes up a point a prior move offered but does not propose a concrete way to resolve; this is a repair, not a concession of the whole.',
  'misunderstanding_repair.pair_true_true.names_ambiguity_source.accepts_correction':
    'This reply names the specific ambiguity source and takes up a point a prior move offered, which can keep the exchange constructive.',
  'misunderstanding_repair.pair_true_false.names_ambiguity_source.no_point_taken_up':
    'This reply names the specific ambiguity source but does not take up a point a prior move offered.',
  'misunderstanding_repair.pair_false_true.accepts_correction.no_ambiguity_source':
    'This reply takes up a point a prior move offered but does not name a specific ambiguity source; this is a repair, not a concession of the whole.',
  // MCP-BUILD2e (Family E argument_scheme expansion) — plain-language for the 3
  // new argument-structure booleans' mapping rows. Every value is verdict-free,
  // move-level, and describes the MOVE never the author. No underscores (the
  // registry review-gate asserts the displayed string is snake-free). The
  // argumentation-theory terms `linked` / `convergent` / `enthymeme` NEVER
  // appear in any value (GATE-A §8.2 rule 4 — theory labels never surfaced
  // raw); they are described in plain language. The enthymeme_gap_detected (E3)
  // values are fenced "gap-is-not-a-verdict": they describe relying on an
  // unstated step and never imply the argument is weak / wrong.
  // ── linked_premise_structure ──
  'argument_scheme.single_true.linked_premise_structure':
    'This reply uses premises that depend on each other, so they stand or fall together.',
  'argument_scheme.single_false.linked_premise_structure':
    'This reply does not use premises that depend on each other; this is only an observation about its structure, not a concern.',
  // ── convergent_premise_structure ──
  'argument_scheme.single_true.convergent_premise_structure':
    'This reply uses premises that each independently support its conclusion.',
  'argument_scheme.single_false.convergent_premise_structure':
    'This reply does not use premises that each stand on their own; this is only an observation about its structure, not a concern.',
  // ── enthymeme_gap_detected (gap-is-not-a-verdict fence) ──
  'argument_scheme.single_true.enthymeme_gap_detected':
    'This reply relies on an unstated step; naming that step can make the reasoning easier to follow. This is an invitation to state it, not a concern about the reply.',
  'argument_scheme.single_false.enthymeme_gap_detected':
    'This reply does not appear to rely on an unstated step; this is only an observation about its structure, not a concern.',
  // ── pairs: linked_premise_structure × convergent_premise_structure ──
  'argument_scheme.pair_true_true.linked_premise_structure.convergent_premise_structure':
    'This reply uses both premises that depend on each other and premises that each stand on their own.',
  'argument_scheme.pair_true_false.linked_premise_structure.no_convergent':
    'This reply uses premises that depend on each other rather than premises that each stand on their own.',
  'argument_scheme.pair_false_true.convergent_premise_structure.no_linked':
    'This reply uses premises that each stand on their own rather than premises that depend on each other.',
  // ── pairs: linked_premise_structure × enthymeme_gap_detected ──
  'argument_scheme.pair_true_true.linked_premise_structure.enthymeme_gap_detected':
    'This reply uses premises that depend on each other and relies on an unstated step; naming that step can make the reasoning easier to follow.',
  'argument_scheme.pair_true_false.linked_premise_structure.no_enthymeme_gap':
    'This reply uses premises that depend on each other and states the steps its conclusion needs.',
  'argument_scheme.pair_false_true.enthymeme_gap_detected.no_linked':
    'This reply relies on an unstated step without using premises that depend on each other; naming that step can make the reasoning easier to follow.',
  // ── pairs: convergent_premise_structure × enthymeme_gap_detected ──
  'argument_scheme.pair_true_true.convergent_premise_structure.enthymeme_gap_detected':
    'This reply uses premises that each stand on their own and relies on an unstated step; naming that step can make the reasoning easier to follow.',
  'argument_scheme.pair_true_false.convergent_premise_structure.no_enthymeme_gap':
    'This reply uses premises that each stand on their own and states the steps its conclusion needs.',
  'argument_scheme.pair_false_true.enthymeme_gap_detected.no_convergent':
    'This reply relies on an unstated step without using premises that each stand on their own; naming that step can make the reasoning easier to follow.',
  // MCP-BUILD2f (Family F critical_question expansion) — plain-language for the 3
  // new question-quality booleans' mapping rows. Every value is verdict-free,
  // move-level, and describes the MOVE never the author. No underscores (the
  // registry review-gate asserts the displayed string is snake-free). Unlike the
  // 14 baseline critical-question keys (which flag an unanswered question), these
  // describe a POSITIVE feature of the QUESTION the move poses. The
  // question_invites_revision (F3) values are fenced
  // "invites-revision-not-a-verdict": they describe a question that leaves room
  // to refine (a constructive move) and never imply the parent is wrong / weak /
  // NEEDS revision.
  // ── question_names_uncertainty ──
  'critical_question.single_true.question_names_uncertainty':
    'This reply poses a question that names a specific source of uncertainty.',
  'critical_question.single_false.question_names_uncertainty':
    'This reply does not pose a question that names a specific source of uncertainty; this is only an observation about its structure, not a concern.',
  // ── question_separates_claim_evidence ──
  'critical_question.single_true.question_separates_claim_evidence':
    'This reply poses a question that separates the claim from the evidence for it.',
  'critical_question.single_false.question_separates_claim_evidence':
    'This reply does not pose a question that separates the claim from its evidence; this is only an observation about its structure, not a concern.',
  // ── question_invites_revision (invites-revision-not-a-verdict fence) ──
  'critical_question.single_true.question_invites_revision':
    'This reply poses a question that leaves room to refine the point rather than demanding a final answer; this is a constructive move, not a concern about the other reply.',
  'critical_question.single_false.question_invites_revision':
    'This reply does not pose a question that leaves room to refine; this is only an observation about its structure, not a concern.',
  // ── pairs: question_names_uncertainty × question_separates_claim_evidence ──
  'critical_question.pair_true_true.question_names_uncertainty.question_separates_claim_evidence':
    'This reply poses a question that names a specific source of uncertainty and separates the claim from the evidence for it.',
  'critical_question.pair_true_false.question_names_uncertainty.no_claim_evidence_separation':
    'This reply poses a question that names a source of uncertainty without separating the claim from its evidence.',
  'critical_question.pair_false_true.question_separates_claim_evidence.no_named_uncertainty':
    'This reply poses a question that separates the claim from its evidence without naming a specific source of uncertainty.',
  // ── pairs: question_names_uncertainty × question_invites_revision ──
  'critical_question.pair_true_true.question_names_uncertainty.question_invites_revision':
    'This reply poses a question that names a specific source of uncertainty and leaves room to refine the point.',
  'critical_question.pair_true_false.question_names_uncertainty.no_invites_revision':
    'This reply poses a question that names a source of uncertainty and seeks a specific answer rather than leaving room to refine.',
  'critical_question.pair_false_true.question_invites_revision.no_named_uncertainty':
    'This reply poses a question that leaves room to refine the point without naming a specific source of uncertainty; this is a constructive move, not a concern about the other reply.',
  // ── pairs: question_separates_claim_evidence × question_invites_revision ──
  'critical_question.pair_true_true.question_separates_claim_evidence.question_invites_revision':
    'This reply poses a question that separates the claim from its evidence and leaves room to refine the point.',
  'critical_question.pair_true_false.question_separates_claim_evidence.no_invites_revision':
    'This reply poses a question that separates the claim from its evidence and seeks a specific answer rather than leaving room to refine.',
  'critical_question.pair_false_true.question_invites_revision.no_claim_evidence_separation':
    'This reply poses a question that leaves room to refine the point without separating the claim from its evidence; this is a constructive move, not a concern about the other reply.',
  // ── curated_triple: all 3 question-quality flags ──
  'critical_question.curated_triple.question_names_uncertainty.question_separates_claim_evidence.question_invites_revision':
    'This reply poses a question that names a specific source of uncertainty, separates the claim from the evidence for it, and leaves room to refine the point; this is a constructive move, not a concern about the other reply.',
  // MCP-BUILD2d (Family D evidence_source_chain expansion) — plain-language for
  // the 3 new evidence-dynamic booleans' mapping rows. Every value is
  // verdict-free, move-level, and describes the MOVE never the author. No
  // underscores (the registry review-gate asserts the displayed string is
  // snake-free). EVIDENCE-DOCTRINE FENCE: each value surfaces an evidence
  // DYNAMIC (method difference / observation-vs-inference / context limit) and
  // NEVER grants or denies factual standing or truth (anti-amplification module
  // untouched).
  // ── names_method_difference ──
  'evidence_source_chain.single_true.names_method_difference':
    'This reply names a difference in method or measurement between two pieces of evidence.',
  'evidence_source_chain.single_false.names_method_difference':
    'This reply does not name a method or measurement difference; this is only an observation about its structure, not a concern.',
  // ── separates_observation_from_inference ──
  'evidence_source_chain.single_true.separates_observation_from_inference':
    'This reply distinguishes what was observed in the data from what was inferred on top of it.',
  'evidence_source_chain.single_false.separates_observation_from_inference':
    'This reply does not separate what was observed from what was inferred; this is only an observation about its structure, not a concern.',
  // ── flags_context_limit ──
  'evidence_source_chain.single_true.flags_context_limit':
    'This reply flags a context or applicability limit on a piece of evidence — where it does and does not apply.',
  'evidence_source_chain.single_false.flags_context_limit':
    'This reply does not flag a context or applicability limit on the evidence; this is only an observation about its structure, not a concern.',
  // ── pairs: names_method_difference × separates_observation_from_inference ──
  'evidence_source_chain.pair_true_true.names_method_difference.separates_observation_from_inference':
    'This reply names a method or measurement difference and separates what was observed from what was inferred.',
  'evidence_source_chain.pair_true_false.names_method_difference.no_observation_inference_split':
    'This reply names a method or measurement difference but does not separate what was observed from what was inferred.',
  'evidence_source_chain.pair_false_true.separates_observation_from_inference.no_method_difference':
    'This reply separates what was observed from what was inferred but does not name a method or measurement difference.',
  // ── pairs: names_method_difference × flags_context_limit ──
  'evidence_source_chain.pair_true_true.names_method_difference.flags_context_limit':
    'This reply names a method or measurement difference and flags a context or applicability limit on the evidence.',
  'evidence_source_chain.pair_true_false.names_method_difference.no_context_limit':
    'This reply names a method or measurement difference but does not flag a context or applicability limit on the evidence.',
  'evidence_source_chain.pair_false_true.flags_context_limit.no_method_difference':
    'This reply flags a context or applicability limit on the evidence but does not name a method or measurement difference.',
  // ── pairs: separates_observation_from_inference × flags_context_limit ──
  'evidence_source_chain.pair_true_true.separates_observation_from_inference.flags_context_limit':
    'This reply separates what was observed from what was inferred and flags a context or applicability limit on the evidence.',
  'evidence_source_chain.pair_true_false.separates_observation_from_inference.no_context_limit':
    'This reply separates what was observed from what was inferred but does not flag a context or applicability limit on the evidence.',
  'evidence_source_chain.pair_false_true.flags_context_limit.no_observation_inference_split':
    'This reply flags a context or applicability limit on the evidence but does not separate what was observed from what was inferred.',
  // MCP-BUILD2g (Family G resolution_progress expansion) — plain-language for
  // the 3 new resolution-progress bookkeeping booleans' mapping rows. Every
  // value is verdict-free, move-level, and describes the MOVE never the author.
  // No underscores (the registry review-gate asserts the displayed string is
  // snake-free). EVIDENCE-DOCTRINE FENCE: the defines_next_evidence_needed
  // values name a next evidence step and NEVER grant or deny factual standing
  // or truth (anti-amplification module untouched). G is verdict-free
  // (resolution-progress bookkeeping never asserts who won / lost / is ahead).
  // ── records_remaining_disagreement ──
  'resolution_progress.single_true.records_remaining_disagreement':
    'This reply records the set of points that remain in dispute.',
  'resolution_progress.single_false.records_remaining_disagreement':
    'This reply does not record what remains in dispute; this is only an observation about its structure, not a concern.',
  // ── defines_next_evidence_needed ──
  'resolution_progress.single_true.defines_next_evidence_needed':
    'This reply defines the specific evidence that would resolve the open point next.',
  'resolution_progress.single_false.defines_next_evidence_needed':
    'This reply does not define the next evidence that would resolve the open point; this is only an observation about its structure, not a concern.',
  // ── separates_normative_from_empirical ──
  'resolution_progress.single_true.separates_normative_from_empirical':
    'This reply separates a values dispute from a factual one.',
  'resolution_progress.single_false.separates_normative_from_empirical':
    'This reply does not separate a values dispute from a factual one; this is only an observation about its structure, not a concern.',
  // ── pairs: records_remaining_disagreement × defines_next_evidence_needed ──
  'resolution_progress.pair_true_true.records_remaining_disagreement.defines_next_evidence_needed':
    'This reply records the set of points that remain in dispute and defines the specific evidence that would resolve the open point next.',
  'resolution_progress.pair_true_false.records_remaining_disagreement.no_next_evidence_defined':
    'This reply records the set of points that remain in dispute but does not define the next evidence that would resolve the open point.',
  'resolution_progress.pair_false_true.defines_next_evidence_needed.no_remaining_disagreement_recorded':
    'This reply defines the specific evidence that would resolve the open point next but does not record what remains in dispute.',
  // ── pairs: records_remaining_disagreement × separates_normative_from_empirical ──
  'resolution_progress.pair_true_true.records_remaining_disagreement.separates_normative_from_empirical':
    'This reply records the set of points that remain in dispute and separates a values dispute from a factual one.',
  'resolution_progress.pair_true_false.records_remaining_disagreement.no_normative_empirical_split':
    'This reply records the set of points that remain in dispute but does not separate a values dispute from a factual one.',
  'resolution_progress.pair_false_true.separates_normative_from_empirical.no_remaining_disagreement_recorded':
    'This reply separates a values dispute from a factual one but does not record what remains in dispute.',
  // ── pairs: defines_next_evidence_needed × separates_normative_from_empirical ──
  'resolution_progress.pair_true_true.defines_next_evidence_needed.separates_normative_from_empirical':
    'This reply defines the specific evidence that would resolve the open point next and separates a values dispute from a factual one.',
  'resolution_progress.pair_true_false.defines_next_evidence_needed.no_normative_empirical_split':
    'This reply defines the specific evidence that would resolve the open point next but does not separate a values dispute from a factual one.',
  'resolution_progress.pair_false_true.separates_normative_from_empirical.no_next_evidence_defined':
    'This reply separates a values dispute from a factual one but does not define the next evidence that would resolve the open point.',
} as const;

export type PlainLanguageKey = keyof typeof PLAIN_LANGUAGE_COPY;

/**
 * Lookup helper. Returns the plain-language string for a known internal
 * code, or `null` for unknown codes (callers can decide to surface raw or
 * suppress). Case-insensitive. Stage 6.4: normal-user surfaces SHOULD pass
 * the result through `toPlainLanguageOrSuppress` to drop unknown codes.
 *
 * MCP-MOD-006: when the normalized code matches a `SemanticClassifierId`
 * whose catalog entry carries a `plainLanguageLabel`, that label wins over
 * the gameCopy table fallback. Catalog v0 has no `plainLanguageLabel` set on
 * any of the 23 entries, so behavior is byte-identical to pre-MCP-MOD-006;
 * the seam exists so a future per-id label edit lands in the catalog without
 * touching `gameCopy.ts`. Unknown codes fall through to the gameCopy table,
 * preserving the pre-existing fallback path for non-classifier codes.
 */
export function toPlainLanguage(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = String(code).trim().toLowerCase().replace(/[\s-]+/g, '_');
  // Catalog override path — MCP-MOD-006. A typed lookup against the catalog
  // by id. The catalog is imported lazily via a require to keep the gameCopy
  // module free of cyclic imports if the catalog ever pulls a gameCopy
  // string in (currently it does not).
  const catalogLabel = catalogPlainLanguageLabelFor(key);
  if (catalogLabel !== null) return catalogLabel;
  if (Object.prototype.hasOwnProperty.call(PLAIN_LANGUAGE_COPY, key)) {
    return PLAIN_LANGUAGE_COPY[key as PlainLanguageKey];
  }
  return null;
}

/**
 * MCP-MOD-006 — catalog plain-language label resolver.
 *
 * Returns `CATALOG_BY_ID.get(id).plainLanguageLabel` when the input is a
 * known `SemanticClassifierId` AND the catalog entry carries a label.
 * Returns `null` in every other case (including unknown ids and ids whose
 * catalog entry has no `plainLanguageLabel` set). Pure data lookup. The
 * `Map.get` is typed against `SemanticClassifierId`; the input is widened
 * to `string` by `toPlainLanguage`'s normalize step, so the cast on the
 * Map narrows the parameter back to the known id union. The catalog's
 * `CATALOG_BY_ID` returns `undefined` for any id outside the union — the
 * `if (!entry)` guard covers that path.
 */
function catalogPlainLanguageLabelFor(normalizedKey: string): string | null {
  const entry = (
    SEMANTIC_CLASSIFIER_CATALOG_BY_ID as ReadonlyMap<string, { plainLanguageLabel?: string }>
  ).get(normalizedKey);
  if (!entry) return null;
  const label = entry.plainLanguageLabel;
  return typeof label === 'string' && label.length > 0 ? label : null;
}

/** Suppresses unknown codes for normal-user surfaces. */
export function toPlainLanguageOrSuppress(code: string | null | undefined): string | null {
  return toPlainLanguage(code);
}

/**
 * Returns true if the string looks like an internal code that must NOT
 * appear in normal-user UI (snake_case identifier, all-lowercase token
 * surrounded by underscores). Used by tests + defensive renderers.
 */
export function looksLikeInternalCode(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = String(s).trim();
  // Underscored / colon / arrow code shapes.
  if (/^[a-z][a-z0-9_]{4,}$/.test(t)) return true;
  if (/^[A-Z][A-Z0-9_]{4,}$/.test(t)) return true;
  if (/^[a-z_]+:[a-z0-9_:.-]+$/.test(t)) return true;
  if (/^http_\d{3}_/.test(t)) return true;
  return false;
}

// ── Stage 6.4 — Observer-first room copy ────────────────────────

export const OBSERVER_COPY = {
  badge: 'Watching',
  enterRoom: 'Observe',
  enterRoomSecondary: 'Jump in',
  joinAff: 'Join — argue For',
  joinNeg: 'Join — argue Against',
  joinAffShort: 'Join For',
  joinNegShort: 'Join Against',
  watchHelp: 'Read the room without joining a side yet.',
  joinHelp: 'Pick a side to start posting moves.',
  askSourceHelp: 'Ask the speaker for their primary source.',
  openTimelineHelp: 'Inspect the move-by-move history.',
  shareHelp: 'Copy a link to this room.',
  qualifiersHelp: 'See how the move was classified.',
  requestDeletionHelp: 'Request that your message be removed.',
  splitBranchHelp: 'Open a side issue without losing the main thread.',
  flagHelp: 'Send to admins for review.',
  replyHelp: 'Post your move on this card.',
  disagreeHelp: 'Challenge this move directly.',
  askQuoteHelp: 'Ask the speaker to quote the exact passage.',
} as const;

// ── ARG-ROOM-005 — public seat-claim copy ───────────────────────
//
// The minimal seat-availability vocabulary surfaced when a public room shows
// open-slot count + the observe affordance. Owned MINIMALLY here so ARG-ROOM-005
// stays testable + ban-list-covered; ARG-ROOM-007 consolidates the final
// capacity/visibility vocabulary and may rename / move this block (flagged in
// the 007 design). The observe label itself reuses `OBSERVER_COPY.watch` /
// `OBSERVER_COPY.enterRoom` — these strings only name the seat facts.
//
// Doctrine (§1): every value is person-neutral and verdict-free. "full" and
// "observe" are STRUCTURAL seat facts, never judgments — a full room is not a
// loss and observing is a first-class state, not a demotion. No snake_case, no
// verdict / amplification / person-attribution tokens (scanned by
// `_forbiddenSeatClaimTokens` in `__tests__/seatClaimModel.doctrine.test.ts`).
export const SEAT_CLAIM_COPY = Object.freeze({
  openSeatsZero: 'No open seats',
  openSeatsOne: '1 open seat',
  openSeatsMany: '{count} open seats',
  fullRoomObserve: 'This argument is full. You can still watch.',
  youAreActive: "You're in this argument.",
  youAreWatching: "You're watching.",
});

// ── META-1E — Cards-detail metadata diff inspector copy ─────────
//
// The only user-facing strings the metadata diff inspector authors. Per
// the META-1E design (Open question 2, operator-decided), the four filter
// chip labels + the empty-state line + the per-kind connective verbs live
// here so the plain-language coverage + ban-list tests own them — the
// component and the pure model never embed a raw string.
//
// Doctrine (§9 / §10a / §1–§3): every value describes WHAT CHANGED ON THE
// MOVE (a machine Observation), never a person, never a verdict, never
// heat / popularity. Zero verdict / amplification / person-attribution
// tokens (enforced by `_forbiddenMetadataTokens` in the META-1E tests).
// No snake_case / internal-code shape (enforced by `looksLikeInternalCode`).
//
// `panelTitle` is the panel header (sourced, not a new primitive).
// `header*` strip is the per-kind connective verb assembled around an
// already-plain label by the model's `signalDescription`. `transitionArrow`
// is the fixed connective for a lifecycle transition's `from → to` render.
export const METADATA_DIFF_INSPECTOR_COPY = {
  // Panel chrome.
  panelTitle: 'What changed on this move',
  emptyState: 'No recorded changes on this move yet.',
  // Filter chip labels (issue #80 scope, verbatim).
  chipAddedTag: 'Added tag',
  chipRemovedTag: 'Removed tag',
  chipResolvedRequest: 'Resolved request',
  chipTriggeredTransition: 'Triggered transition',
  // Verbose screen-reader labels for each chip (≤ 80 chars).
  chipAddedTagA11y: 'Show only moves where a tag was added',
  chipRemovedTagA11y: 'Show only moves where a tag was removed',
  chipResolvedRequestA11y: 'Show only moves that resolved a source or quote request',
  chipTriggeredTransitionA11y: 'Show only moves that triggered a state change',
  // Per-kind connective verbs for the signal description. The label that
  // follows is always an already-plain label; these verbs are the ONLY
  // authored fragments in a row sentence.
  signalTagAdded: 'Tag added',
  signalTagRemoved: 'Tag removed',
  signalObserved: 'Observed',
  signalRequestResolved: 'Request resolved',
  // Fixed connective for a lifecycle transition `from → to` line.
  transitionArrow: '→',
} as const;

// ── GAL-001 — Section headlines for the gallery entry (10 play lanes) ──
//
// Stage 6.4 shipped a 6-entry catalogue (`jump_in` / `needs_rebuttal` /
// `source_trail` / `hot_unresolved` / `easy_first_move` / `my_rooms`).
// GAL-001 replaces it with 10 "play lanes" matching the kind of move a
// user wants to make. The 4 stable codes carry forward; `easy_first_move`
// was renamed to `quiet_beginner_rooms` for plain-language clarity, and
// `hot_unresolved` was retired (its cards now split between `jump_in`
// and `logic_traps` per the lifecycle / bucket priority order in
// `conversationGalleryModel.ts`).
//
// Each entry carries three render-ready strings:
//   - `label`      ≤ 64 chars AND ≤ 8 whitespace-separated tokens.
//   - `helperLine` ≤ 80 chars. Secondary sub-heading under the label.
//   - `emptyCopy`  ≤ 120 chars. Shown when the lane has zero cards.
//
// Doctrine: every string is ban-list-clean (no winner / loser / truth /
// proven / verdict / popular / trending / viral / correct / liar /
// dishonest / bad faith / manipulative / extremist / propagandist).
// Heat is framed as activity / friction, never popularity or correctness.

export interface GallerySectionDefinition {
  id:
    | 'my_rooms'
    | 'needs_rebuttal'
    | 'jump_in'
    | 'source_trail'
    | 'evidence_needed'
    | 'definition_fights'
    | 'logic_traps'
    | 'tangents_branches'
    | 'almost_synthesis'
    | 'quiet_beginner_rooms';
  label: string;
  helperLine: string;
  emptyCopy: string;
}

export const GALLERY_SECTION_DEFINITIONS: ReadonlyArray<GallerySectionDefinition> = Object.freeze([
  Object.freeze({
    id: 'my_rooms',
    label: 'My active rooms',
    helperLine: 'Rooms you have joined for or against.',
    emptyCopy: "You haven't joined a room yet — try another lane to find one.",
  }),
  Object.freeze({
    id: 'needs_rebuttal',
    label: 'Needs first rebuttal',
    helperLine: 'Someone posted a claim and nobody has replied yet.',
    emptyCopy: 'No rooms are waiting on a first rebuttal right now.',
  }),
  Object.freeze({
    id: 'jump_in',
    label: 'Jump in now',
    helperLine: 'Active back-and-forth — a fresh move lands cleanly.',
    emptyCopy: 'No rooms have active back-and-forth at the moment.',
  }),
  Object.freeze({
    id: 'source_trail',
    label: 'Source trail fights',
    helperLine: 'Open disputes over what the source actually says.',
    emptyCopy: 'No active source-trail disputes right now.',
  }),
  Object.freeze({
    id: 'evidence_needed',
    label: 'Evidence needed',
    helperLine: 'Open requests for primary evidence are waiting.',
    emptyCopy: 'No rooms have open evidence requests right now.',
  }),
  Object.freeze({
    id: 'definition_fights',
    label: 'Definition fights',
    helperLine: 'Key terms or scope are being argued out.',
    emptyCopy: 'No rooms have open definition or scope disputes.',
  }),
  Object.freeze({
    id: 'logic_traps',
    label: 'Logic traps',
    helperLine: 'Same-axis pressure has repeated without new information.',
    emptyCopy: 'No rooms are stuck on the same axis right now.',
  }),
  Object.freeze({
    id: 'tangents_branches',
    label: 'Tangents and branches',
    helperLine: 'Off-axis pressure built up — a branch reads cleaner.',
    emptyCopy: 'No rooms are showing branch pressure right now.',
  }),
  Object.freeze({
    id: 'almost_synthesis',
    label: 'Almost synthesis',
    helperLine: 'The two sides have converged enough to summarise.',
    emptyCopy: 'No rooms are close to a synthesis right now.',
  }),
  Object.freeze({
    id: 'quiet_beginner_rooms',
    label: 'Quiet beginner rooms',
    helperLine: 'Low-activity rooms — an easy place to start.',
    emptyCopy: 'No quiet rooms found — every room has back-and-forth.',
  }),
] as const);

export type GallerySectionId = GallerySectionDefinition['id'];

/**
 * Legacy export name retained for one release so existing callers that
 * import `GALLERY_SECTIONS` keep working without a name-only churn. The
 * legacy `sub` field is mapped from the new `helperLine` field so any
 * downstream render that read `s.sub` continues to render the helper line.
 */
export const GALLERY_SECTIONS = GALLERY_SECTION_DEFINITIONS;

// ── RULE-005 — Structured argument channel copy ─────────────────
//
// A "channel" describes the STRUCTURAL PURPOSE of a composed move
// ("you are challenging", "you are asking for a source"). It is never a
// verdict — it labels what the move DOES, never whether it is right,
// popular, or strong. RULE-005 adds three frozen copy blocks:
//
//   - `CHANNEL_LABEL_COPY`    — the short plain-language chip label.
//   - `CHANNEL_PURPOSE_COPY`  — a one-sentence purpose line per channel.
//   - `CHANNEL_RATIONALE_COPY`— a one-line "why this channel" line keyed
//                               by suggestion reason.
//
// Doctrine: every string is plain English (no snake_case leak), ≤ 48
// chars for labels, ≤ 90 chars for purpose / rationale, and carries zero
// verdict / amplification / person-attribution tokens. The 12 active
// channel codes are deliberately DISTINCT from existing PLAIN_LANGUAGE_COPY
// keys: the channel code `synthesize` ≠ the existing `synthesis` key, and
// `branch_tangent` ≠ the existing `tangent` key (RULE-005 design §3.3 / R1).
//
// `channelModel.ts` reads these tables — it never authors a label inline
// (mirrors `getPointLifecyclePlainLabel` / `getManualTagPlainLabel`).

/** RULE-005 — short plain-language label for each move channel. */
export const CHANNEL_LABEL_COPY = Object.freeze({
  reply: 'Reply',
  challenge: 'Challenge',
  clarify: 'Clarify',
  ask_source: 'Ask for a source',
  ask_quote: 'Ask for a quote',
  add_evidence: 'Add evidence',
  narrow: 'Narrow the claim',
  concede: 'Concede the point',
  confirm: 'Confirm the point',
  synthesize: 'Synthesize the thread',
  branch_tangent: 'Branch a side issue',
  meta_process: 'Process note',
} as const);

/** RULE-005 — one-sentence purpose line for each move channel. */
export const CHANNEL_PURPOSE_COPY = Object.freeze({
  reply: 'Add your move on this point.',
  challenge: 'Push back on the point and name where it falls short.',
  clarify: 'Ask the other side to pin down a term, scope, or premise.',
  ask_source: 'Ask the other side for the primary source behind a claim.',
  ask_quote: 'Ask the other side to quote the exact passage they mean.',
  add_evidence: 'Back a factual point with a cited source.',
  narrow: 'Keep the broad point but tighten the part under dispute.',
  concede: 'Acknowledge the point and move the thread forward.',
  confirm: 'Confirm the point so the thread can move on.',
  synthesize: 'Summarize where the two sides have landed.',
  branch_tangent: 'Open a side issue without losing the main thread.',
  meta_process: 'Leave a note about the room, not the argument itself.',
} as const);

/** RULE-005 — one-line rationale, keyed by suggestion reason. */
export const CHANNEL_RATIONALE_COPY = Object.freeze({
  deterministic_match: 'This matches the move you started composing.',
  lifecycle_state: 'This is the move that usually fits the parent here.',
  parent_demands_evidence: 'The parent asked for a source — adding evidence fits here.',
  no_signal: 'Start anywhere — Reply works when nothing else is set.',
  // `branch_tangent` gets its own non-punitive line: it describes the
  // move shape ("a new issue"), never the person ("you are dodging").
  branch_tangent: 'This reads like a new issue — branching keeps the thread clear.',
} as const);

// ── RULE-004 — Pause-before-send move review copy ────────────────
//
// RULE-004 shows one short, NON-JUDGEMENTAL review chance on the Post
// intent. The advisories are info / soft only — they never block a post;
// "Post anyway" is always available unless an EXISTING structural block
// (from `evaluateArgumentDraft`) is already hit.
//
// Doctrine: every string is plain English (no snake_case leak), ≤ 90
// chars, carries zero verdict / amplification / person-attribution
// tokens, and is non-punitive ("friction with payoff", not scolding).
// The `permanent_record_warning` line is HONEST and NEUTRAL — it states
// the record is permanent and offers a non-punitive option; it is NOT
// fear-based ("you will be judged" is forbidden). Enforced by
// `__tests__/preSendReviewBanList.test.ts`.
//
// `preSendReviewModel.ts` reads these tables — it never authors a line
// inline (mirrors `channelModel.ts` reading `CHANNEL_*` blocks).

/** RULE-004 — plain-language line per advisory kind. */
export const PRESEND_ADVISORY_COPY = Object.freeze({
  broad_claim: 'This is a wide claim — narrowing it makes it easier to defend.',
  topic_drift: 'This may be drifting from the resolution.',
  asks_new_question: 'This opens a new question — a side branch keeps it tidy.',
  no_source_attached: 'This is an Evidence move with no source attached yet.',
  depth_warning: 'This sits deep in the thread — a fresh branch may read clearer.',
  permanent_record_warning:
    'Posted moves stay on the record. Take a beat if you need it.',
  channel_mismatch: 'This reads more like a different move — switch channel?',
} as const);

/** RULE-004 — plain-language line per structural-block display kind. */
export const PRESEND_BLOCK_COPY = Object.freeze({
  empty_body: 'Add a body before posting.',
  invalid_transition: 'This move type is not allowed as a reply here.',
  evidence_without_source: 'An Evidence move needs at least one source.',
  over_length: 'This move is over the length limit — trim it to post.',
  cooldown_active: 'A short cooldown is active — you can post again shortly.',
} as const);

// ── BR-003 — Tangent / outer-orbit routing copy ──────────────────
//
// BR-003 surfaces ONE advisory inside RULE-004's existing
// `PreSendReviewSheet` when a draft reads as a structural redirect away
// from the point it replies to. The copy describes the MOVE's structural
// relationship to its parent — "this move", "the thread" — NEVER the
// person. "Side issue" is the consistent user-facing term (it matches
// `timeline-grammar`'s `branch` node label and RULE-005's `branch_tangent`
// channel label "Branch a side issue"). The internal "Outer Realm" framing
// is NOT used, not even in code.
//
// Doctrine: every string is plain English (no snake_case leak), ≤ 100
// chars, carries zero verdict / amplification / person-attribution tokens,
// and is non-punitive. `reason_user_marked_tangent` uses "You marked" —
// the author describing their OWN prior action, not an accusation.
// `tangentRoutingModel.ts` reads this table — it never authors a line
// inline (mirrors `channelModel.ts` / `preSendReviewModel.ts`). Enforced
// by `__tests__/tangentRoutingNoPersonLabel.test.ts`.

/** BR-003 — plain-language line per redirect reason. Move-level, never
 *  person-level. Read by tangentRoutingModel; authored nowhere else. */
export const TANGENT_ROUTING_COPY = Object.freeze({
  // The advisory headline shown inside the RULE-004 sheet.
  advisory_possible:
    'This may open a new issue — a side branch keeps the main thread clear.',
  advisory_strong:
    'This reads like a new issue — a side branch is a better home for it.',
  // Per-reason detail line (optional second line in the advisory card).
  reason_introduces_new_axis: 'It picks up a different point than the one above.',
  reason_no_signal_about_parent:
    'It does not connect back to the point it replies to.',
  reason_mode_demands_response:
    'The point above is still waiting for a direct reply.',
  reason_repeated_off_path:
    'The thread has drifted from its main point a few times.',
  reason_user_marked_tangent: 'You marked this as a side issue.',
  // Mainline-demotion advisory — describes the THREAD, never the person.
  demotion_advisory:
    'The main thread has drifted. A direct reply brings it back on point.',
} as const);

/**
 * BR-004 — plain-language copy for the three teachable branch
 * directions, the collapsed-summary templates, and the depth-cap
 * advisory prompt. Every string describes a STRUCTURAL position — never
 * a verdict, never amplification, never the person. `evidence_passthrough`
 * has no label here on purpose: BR-004 yields to BR-001/VG-002 for
 * evidence branches and does not relabel them. OD-2 confirms final
 * wording.
 */
export const BRANCH_GRAMMAR_COPY = Object.freeze({
  // Direction labels (the teachable names).
  direction_mainline: 'Main thread',
  direction_chime_in_vertical: 'Chime-in',
  direction_tangent_diagonal: 'Side issue',

  // One-line direction explainers (for a legend / first-run teach).
  explain_mainline: 'The main back-and-forth between the two main debaters.',
  explain_chime_in: 'A new voice weighing in on the same topic.',
  explain_tangent: 'A side issue kept off the main thread so it stays clear.',

  // Collapsed-summary fragments (assembled into summaryLine).
  summary_replies_one: '1 reply',
  summary_replies_many: '{count} replies',
  summary_people_one: '1 person',
  summary_people_many: '{count} people',
  summary_open_one: '1 open item',
  summary_open_many: '{count} open items',
  summary_no_open: 'nothing open',
  summary_principals_in: 'main debaters joined in',
  summary_principals_out: 'a side conversation',

  // Relative-recency fallback when a branch has no parsable timestamp.
  recency_none: 'no activity yet',

  // Depth-cap advisory — describes the offshoot, never the person.
  depth_cap_prompt:
    'This side thread has gone a few layers deep. A short summary keeps it readable.',
} as const);

/**
 * GAME-005 — plain-language copy for chime-in governance. Structural,
 * never a verdict, never person-attribution, never "booted/kicked/banned".
 * A governance reaction describes participation STRUCTURE, never
 * correctness; a moved-to-observer transition is a structural transition,
 * never a penalty. OD-2 confirms final wording.
 */
export const CHIME_IN_GOVERNANCE_COPY = Object.freeze({
  // Reaction labels — participation-structure, never correctness.
  reaction_useful: 'Helpful here',
  reaction_off_track: 'Off the current thread',
  reaction_needs_source: 'Ask for a source',
  reaction_move_to_tangent: 'Better as a side issue',

  // Reaction one-line explainers (for the control's a11y hint).
  explain_useful: 'Marks this chime-in as helping the current thread.',
  explain_off_track: 'Notes this chime-in does not fit the current thread.',
  explain_needs_source: 'Asks this chime-in for a primary source.',
  explain_move_to_tangent: 'Suggests moving this chime-in to a side branch.',

  // Observer-fallback — calm, non-punitive. Explains access remains.
  moved_to_observer_title: 'Moved to observer',
  moved_to_observer_body:
    'This chime-in moved to observer for this room. They can still read ' +
    'everything and their side branch stays in the record.',
  // Overflow (cap full) — never a failure, never "rejected".
  // Note: "right now" was reworded to "at the moment" — the ban-list test
  // (GAME-005 design §10) flags the doctrine token "right".
  overflow_observer_body:
    'This room has a full set of active seats at the moment. New voices ' +
    'join as observers and can still read and follow along.',

  // Seat / metrics strip — counts only, never a ranking.
  seat_count: '{active} of {cap} seats active',
  chime_in_count_one: '1 person chiming in',
  chime_in_count_many: '{count} people chiming in',
  chime_in_count_none: 'No chime-ins yet',
  side_branches_heading: 'Side branches',
} as const);

/**
 * GAME-006 — plain-language copy for Jump Branch. A Jump describes structural
 * MOVEMENT, never a verdict, never the person. No "booted / kicked / abandoned
 * / quit" — a participant who jumps has not "left" in a punitive sense; their
 * old branch is kept on the record. OD-1 / OD-2 confirm wording.
 */
export const JUMP_BRANCH_COPY = Object.freeze({
  // The action control.
  action_label: 'Jump to this branch',
  action_explainer:
    'Move your participation to this branch. You can do this once per room.',

  // The confirm step — deliberate, never one-tap-accidental.
  confirm_prompt:
    'Move your participation to this branch? You can only Jump Branch ' +
    'once per room, so this uses your jump.',
  confirm_label: 'Yes, jump',
  cancel_label: 'Stay here',

  // The screen-reader hint shown on the disabled control.
  disabled_hint: 'This action is not available. The reason is shown next to it.',

  // Disabled-state reasons — one per JumpDenyReason. No silent no-op.
  disabled_not_a_chime_in:
    'Jump Branch is for chime-in participants. The two main debaters ' +
    'stay on the main thread.',
  disabled_no_active_seat:
    'You are observing this room, so there is no branch to jump from.',
  disabled_jump_already_used:
    'You have already used your one jump for this room.',
  disabled_destination_is_home: 'You are already engaging on this branch.',
  disabled_destination_closed:
    'This branch is not open to join at the moment.',
  disabled_destination_unknown: 'That branch is no longer part of this room.',
  disabled_destination_needs_approval:
    'This branch asks new voices to be welcomed in first.',

  // Old-branch marker — structural, never punitive.
  marker_departed_title: 'Moved to another branch',
  marker_departed_body: 'This chime-in moved to engage another branch.',

  // Destination arrival marker — auditable, structural.
  marker_arrived_title: 'A chime-in joined this branch',
  marker_arrived_body: 'A chime-in jumped here from another branch.',

  // Relative-time fragments.
  when_moved: 'moved {rel}',
  when_joined: 'joined {rel}',
  when_unknown: 'a little while ago',
} as const);

/**
 * GAME-008 — plain-language copy for the bot marker. Neutral, never
 * alarming, never a verdict, never a "this is a human" framing.
 * "Test bot" / "Test room" are deliberately calm and honest. OD-1
 * confirms final wording + placement.
 */
export const BOT_MARKER_COPY = Object.freeze({
  // In-room, per-participant.
  participant_marker: 'Test bot',
  participant_marker_persona: '{persona} · test bot', // when a persona label exists
  participant_a11y:
    'This participant is a test bot, not a person. Test bots help '
    + 'exercise public rooms; they never judge an argument.',

  // Gallery card + in-room room-level marker.
  room_marker: 'Test room',
  room_marker_seeded: 'Bot-seeded test room',
  room_a11y_seeded:
    'This is a public test room seeded by a test bot. You can read and '
    + 'follow along; a test bot started it.',
  room_a11y_has_bot:
    'This public room includes one or more test bots. Each test bot is '
    + 'marked individually.',

  // Short helper line shown under a bot-seeded gallery card.
  gallery_helper:
    'A test bot started this public room. Test bots help exercise '
    + 'public-room features.',
} as const);

/**
 * GAME-003 — plain-language copy for argument modes. A "mode" is a
 * consented, visible strictness profile both parties accept at room setup.
 * It changes FRICTION, never truth: nothing in this block declares a
 * winner / loser / verdict, and no string carries an amplification token
 * (popular / viral / trending / engagement / likes / …) or a
 * person-attribution token. `argumentModeModel.ts` reads these tables — it
 * never authors a label inline (mirrors `channelModel.ts` /
 * `preSendReviewModel.ts` reading `CHANNEL_*` / `PRESEND_*` blocks).
 *
 * Every internal `ArgumentModeDefinition` enum value (`loose`,
 * `restricted`, `metadata_and_chip`, …) is mapped to prose here so no
 * snake_case code reaches a `ModeRuleRow`. The two sensitive-mode
 * disclaimers are DESIGN-ONLY copy: they are committed so tests can assert
 * their presence and the stub definitions can reference them, but the
 * modes themselves stay `design_only` until a later card promotes them
 * (which routes this copy through operator review). Each disclaimer states
 * the app gives NO legal / therapy advice and contains NO advice itself.
 * Enforced by `__tests__/argumentModeBanList.test.ts` and
 * `__tests__/argumentModeNoLegalAdvice.test.ts`.
 */
export const ARGUMENT_MODE_COPY = Object.freeze({
  // ── Display names — one per mode. Unique across the 13. ──
  name_casual_disagreement: 'Friendly disagreement',
  name_court_record_strict: 'Court-of-record style',
  name_internet_fact_check: 'Fact-check this claim',
  name_debate_club: 'Practice argument club',
  name_domestic_bickering: 'Household disagreement',
  name_co_parenting_custody: 'Co-parenting discussion',
  name_political_debate: 'Political-issue argument',
  name_historical_debate: 'Historical question',
  name_recollection_disconnect: 'Different memories',
  name_workplace_decision: 'Workplace decision',
  name_research_evidence_review: 'Evidence review',
  name_relationship_repair: 'Relationship discussion',
  name_negotiation_tradeoff: 'Negotiation and trade-offs',

  // ── One-line descriptions for the mode picker. ──
  desc_casual_disagreement:
    'A relaxed back-and-forth between friends. Slang and jokes are fine.',
  desc_court_record_strict:
    'A strict, careful, on-the-record format. Precise language and sources.',
  desc_internet_fact_check:
    'Check a claim source by source. Asking for a source is the main move.',
  desc_debate_club:
    'A structured practice argument with gentle turn-taking and a wrap-up.',
  desc_domestic_bickering:
    'A relaxed disagreement between people who share a home.',
  desc_co_parenting_custody:
    'A calm space to talk through a co-parenting question together.',
  desc_political_debate:
    'A political-issue argument where sources matter and reactivity is cooled.',
  desc_historical_debate:
    'A disputed historical question worked through with sources.',
  desc_recollection_disconnect:
    'Two people remember the same thing differently — find the shared parts.',
  desc_workplace_decision:
    'A workplace decision talked through carefully between two people.',
  desc_research_evidence_review:
    'A literature-review style room with the strictest source expectations.',
  desc_relationship_repair:
    'A calm space to talk through a disagreement in your own words.',
  desc_negotiation_tradeoff:
    'Work toward an agreed trade-off, term by term.',

  // ── Rule-row labels — the stable "the rules" column schema. ──
  rule_label_tone: 'Tone',
  rule_label_evidence: 'Evidence',
  rule_label_pacing: 'Pacing',
  rule_label_informality: 'Everyday speech',
  rule_label_branches: 'Side issues',
  rule_label_source_requests: 'Source asks',
  rule_label_synthesis: 'Wrap-up',
  rule_label_permanent_record: 'Record',
  rule_label_semantic: 'AI helper',
  rule_label_observers: 'Observers',
  rule_label_invite_only: 'Invite-only',

  // ── Rule-row values — every enum value mapped to plain prose. ──
  // toneStrictness
  rule_value_tone_loose: 'Relaxed — speak however feels natural.',
  rule_value_tone_normal: 'Even-handed — a measured tone is encouraged.',
  rule_value_tone_strict: 'Formal — a careful, measured tone is expected.',
  // evidenceStrictness
  rule_value_evidence_loose: 'Optional — you can say what you think.',
  rule_value_evidence_normal: 'Encouraged — a source helps but is not required.',
  rule_value_evidence_strict: 'Expected — claims should come with a source.',
  // allowedInformality
  rule_value_informality_permissive:
    'Welcome — slang, jokes, and "you had to be there" all fit.',
  rule_value_informality_normal: 'Fine — natural everyday phrasing is fine.',
  rule_value_informality_restricted:
    'Trimmed back — precise wording is preferred over slang.',
  // pacing (derived: none vs paced)
  rule_value_pacing_none: 'No time limits between moves.',
  rule_value_pacing_paced: 'A short pause between moves keeps turns even.',
  // branchesEncouraged
  rule_value_branches_yes: 'Encouraged — side issues are welcome.',
  rule_value_branches_no: 'Kept aside — the room stays on the main question.',
  // sourceRequestsCentral
  rule_value_source_central: 'A first-class move — asking is front and centre.',
  rule_value_source_not_central: 'Allowed, but not the focus of the room.',
  // finalSynthesisExpected
  rule_value_synthesis_yes: 'A short wrap-up is expected at the end.',
  rule_value_synthesis_no: 'No wrap-up is required.',
  // permanentRecordWarning
  rule_value_record_on: 'Moves stay on a lasting record.',
  rule_value_record_off: 'A casual chat, not a lasting record.',
  // semanticClassification
  rule_value_semantic_off: 'No AI helper runs in this room.',
  rule_value_semantic_metadata_only:
    'A quiet AI helper may add advisory notes behind the scenes.',
  rule_value_semantic_metadata_and_chip:
    'An advisory AI helper may add a small, optional note on a move.',
  // observerModeAllowed
  rule_value_observers_yes: 'Allowed — others may watch without joining.',
  rule_value_observers_no: 'Closed — only the two participants are in the room.',
  // inviteOnly
  rule_value_invite_yes: 'Yes — this room is set up between invited people.',
  rule_value_invite_no: 'No — this room can be open to others.',

  // ── "Your view" lines — second-person, for the part-B setup screen. ──
  view_casual_disagreement:
    "Speak naturally — slang and jokes are fine. There are no time limits, side tangents are welcome, and this is a casual chat, not a permanent record.",
  view_court_record_strict:
    'Take your time and choose precise wording. A short pause follows each move, sources are expected, and what you post stays on the record.',
  view_internet_fact_check:
    'Bring a source for each claim and ask the other side for theirs. The pace is quick and asking for a source is the move that matters most.',
  view_debate_club:
    'Make your case with structure. A short pause keeps turns even, a wrap-up closes the round, and your moves are kept for review afterward.',
  view_domestic_bickering:
    'Speak naturally — this is a relaxed disagreement at home. No time limits, side tangents are fine, and nothing here is a lasting record.',
  view_co_parenting_custody:
    'Take a calm beat between moves. The room stays on one question, what you post is kept, and this room is just for the two of you.',
  view_political_debate:
    'Bring a source for each claim. A short pause cools reactivity, and an advisory note may appear — it only suggests a move, it never rules on a claim.',
  view_historical_debate:
    'Work the question through with sources. Side issues are welcome, and a short wrap-up names where you both landed.',
  view_recollection_disconnect:
    "Describe what you remember in your own words. There is no need to source a memory — the wrap-up names the parts you both agree on.",
  view_workplace_decision:
    'Talk the decision through carefully. The room stays on the one decision, sources are welcome, and a wrap-up records what you chose.',
  view_research_evidence_review:
    'Bring careful sources and precise wording. A long response window leaves room to consider, and a wrap-up summarises the review.',
  view_relationship_repair:
    'Speak in your own words and take a calm beat between moves. The point is a shared understanding, named in a short wrap-up.',
  view_negotiation_tradeoff:
    'Work toward a trade-off, term by term. Side terms are welcome, and a wrap-up records the agreement you reach.',

  // ── Sensitive-mode disclaimers (DESIGN-ONLY copy). ──
  // co_parenting_custody — non-legal. States NO legal advice is given;
  // contains no advice itself; no verdict, no alarm.
  disclaimer_co_parenting_custody:
    'This space is for talking through a co-parenting question together. ' +
    'CDiscourse is not a law firm and does not give legal advice. Nothing ' +
    'here is a legal opinion, a custody recommendation, or a substitute for ' +
    'talking with a qualified family-law professional. For anything with ' +
    'legal weight, please speak with a licensed attorney in your area.',
  // relationship_repair — non-therapy. States NO therapeutic advice is
  // given; contains no advice itself; no verdict, no alarm.
  disclaimer_relationship_repair:
    'This space is for talking through a disagreement in your own words. ' +
    'CDiscourse is not a counseling or therapy service and does not give ' +
    'therapeutic, medical, or mental-health advice. Nothing here is a ' +
    'substitute for talking with a qualified counselor or therapist. If a ' +
    'conversation feels like more than this tool is for, please reach out ' +
    'to a licensed professional.',

  // ── Setup-screen helper strings. ──
  helper_picker_label: 'Mode',
  helper_your_view_heading: 'Your view',
  helper_the_rules_heading: 'The rules',
  helper_picker_hint: 'The room creator picks the mode for this argument.',
} as const);

/**
 * QOL-039 — Room visibility transition copy.
 *
 * A "make private" transition is a STRUCTURAL access change, never a
 * verdict, never a penalty, never shaming. Every string is plain English
 * (no snake_case leak), neutral, and ban-list-clean: zero
 * winner / loser / true / false / correct / liar / dishonest / bad faith /
 * booted / kicked / removed / rejected / unwanted (person) / shame tokens.
 *
 * The `effect_*` keys map 1:1 to the `TransitionEffect` codes in
 * `roomVisibilityModel.ts`. The two `effect_chime_in_branches_retained_*`
 * variants pick which copy renders based on `retainedChimeInBranchCount`:
 *   - `_zero` for 0 (omits the count-specific nuance but is still shown)
 *   - `_one`  for 1 (singular wording)
 *   - `_many` for N > 1 (with a `{count}` placeholder)
 *
 * The `reason_*` keys map 1:1 to the `TransitionReason` codes — these are
 * what `toPlainLanguage` returns for the surface that needs a neutral
 * "why can't I do this?" line (in v1, only the create-time path needs
 * them; the action is HIDDEN, not errored, when ineligible).
 *
 * Read by:
 *   - `CreateDebateForm.tsx` (visibility segmented control + helpers)
 *   - `roomVisibilityModel.test.ts` (ban-list scan)
 *   - the room shell that hosts the `make private` action + confirmation
 *
 * Authored nowhere else — `roomVisibilityModel.ts` re-exports this block
 * but never inlines a label.
 */
export const ROOM_VISIBILITY_COPY = Object.freeze({
  // Visibility option labels (the segmented control + the chip).
  option_public_label: 'Public',
  option_public_helper: 'Anyone can find and read this argument.',
  option_private_label: 'Private',
  option_private_helper: 'Only people you invite can find and read this argument.',
  group_label: 'Who can see this argument',

  // Action labels.
  action_make_private_label: 'Make this argument private',
  action_make_private_hint: 'Only the people already in this argument will be able to read it.',

  // Confirmation modal scaffolding.
  confirmation_title: 'Make this argument private?',
  confirmation_intro: 'Here is what will change:',
  confirmation_primary: 'Make private',
  confirmation_cancel: 'Cancel',
  confirmation_post_action_toast: 'This argument is now private.',

  // Effect bullets (one per TransitionEffect code).
  effect_leaves_public_list:
    'This argument leaves the public list — it will not show up for people browsing.',
  effect_non_participants_lose_read:
    'People who are not already in this argument will no longer be able to read it.',
  effect_participants_keep_access:
    'Everyone currently in this argument keeps full access.',
  effect_content_unchanged:
    'Nothing is deleted or hidden — every message stays exactly as it is.',
  effect_chime_in_branches_retained_zero:
    'Any side branches stay in the record, visible to the people in this argument.',
  effect_chime_in_branches_retained_one:
    'The 1 side branch stays in the record, visible to the people in this argument.',
  effect_chime_in_branches_retained_many:
    'The {count} side branches stay in the record, visible to the people in this argument.',
  effect_one_way:
    'This cannot be undone — a private argument stays private.',

  // Private-room read-time chrome.
  badge_private: 'Private',
  badge_private_a11y:
    'This argument is private — only invited people can read it.',

  // Reason codes — neutral plain-language for the rare surface that
  // needs to explain "why isn't the action available?". The default UI
  // simply omits the action (no silent no-op surface needed).
  reason_eligible: 'You can make this argument private.',
  reason_already_private: 'This argument is already private.',
  reason_not_room_creator:
    'Only the person who started this argument can change its visibility.',
  reason_room_archived: 'This argument is closed — its visibility is fixed.',

  // Neutral error copy (RLS denial / network failure mid-transition).
  error_not_allowed: "You cannot change this argument's visibility.",
  error_network: 'Could not save the change. Try again in a moment.',
  error_already_private:
    'This argument was already made private. The list will refresh.',

  // Deep-link no-access state — a non-participant opening a private-room
  // deep link. Plain, never accusatory.
  no_access_title: 'This argument is not available to you',
  no_access_body: 'It is private — only invited people can read it.',
} as const);

/**
 * ARG-ROOM-006 — Room access / feed / seat-state copy.
 *
 * Authored beside `ROOM_VISIBILITY_COPY` (the same module the ban-list +
 * plain-language tests scan). Every string describes ACCESS (public/private)
 * or SEAT ACTIVITY (open/reserved/full) — never a verdict, never a person,
 * never heat/popularity. Scanned by `__tests__/roomAccessModel.test.ts`
 * (ban-list + non-internal-code). ARG-ROOM-007 owns final vocabulary polish;
 * 006 authors only what it needs to function.
 *
 * Doctrine — no enumeration: the `unavailable_*` pair is the CAUSE-NEUTRAL
 * deep-link state. It is IDENTICAL for a private-no-access room and a
 * nonexistent/typo'd id — it must NEVER assert "it is private" (that would
 * confirm a private room exists at the URL, a soft enumeration). The existing
 * `ROOM_VISIBILITY_COPY.no_access_*` (which DOES assert "It is private") is
 * reserved for the positive-knowledge member view, NOT the deep-link path.
 */
export const ROOM_ACCESS_COPY = Object.freeze({
  // Public access lines (one per public_* state).
  public_open_line: 'Open seat — observe or step in.',
  public_reserved_line: 'A seat is saved for an invited person. You can still observe.',
  public_full_line: 'Seats are full — you can still observe.',
  // Private (member view; the chip reuses ROOM_VISIBILITY_COPY.badge_private).
  private_member_line: 'Private — you are in this argument.',
  // Unified deep-link "unavailable" — IDENTICAL for nonexistent and
  // private-no-access (no enumeration; never asserts the room is private).
  unavailable_title: 'This argument isn’t available',
  unavailable_body: 'This link may not work, or the argument may be limited to its members.',
} as const);

/** Plain-language labels for the visibility taxonomy. Toggled-radio chip. */
export const ROOM_VISIBILITY_LABEL: Readonly<Record<'public' | 'private', string>> =
  Object.freeze({
    public: ROOM_VISIBILITY_COPY.option_public_label,
    private: ROOM_VISIBILITY_COPY.option_private_label,
  });

/**
 * ARG-ROOM-003 — copy for the "Who can join" section on the live create
 * surface (`StartArgumentPage`). The visibility OPTION labels/helpers reuse
 * `ROOM_VISIBILITY_COPY` (already ban-list scanned); this block owns only the
 * create-time framing that surface adds: the section heading, the one
 * direct-invite field, and the capacity explainer.
 *
 * Doctrine:
 *  - Verdict-free / person-neutral. Scanned by
 *    `__tests__/argumentRoomCreateCopyDoctrine.test.ts` against the same
 *    forbidden tokens as the invite layer (incl. `challenger` / `opponent`)
 *    and an account-enumeration token list (never `existing` / `new user` /
 *    `account` / `registered`).
 *  - The "Who can see this argument" radiogroup label (`ROOM_VISIBILITY_COPY
 *    .group_label`) is a READ-ACCESS phrase; announcing it inside a
 *    participation ("Who can join") section reads incoherently to a screen
 *    reader. `visibility_group_a11y` is the JOIN-framed label this surface
 *    gives the radiogroup instead (design-review comment #3).
 *  - The capacity cap is NEVER hard-coded here: `capacity_public_*` carry a
 *    `{capacity}` / `{open}` placeholder filled from the
 *    `deriveArgumentRoomCreation` output, so the reconciled 5 (vs the legacy
 *    GAME-005 6) has exactly one source of truth — the validator.
 */
export const ARGUMENT_ROOM_CREATE_COPY = Object.freeze({
  // Section
  who_can_join_label: 'Who can join',
  who_can_join_helper:
    'Pick who can find this argument. You can invite one person as you start.',
  // JOIN-framed radiogroup label (reconciles with the "Who can join" section
  // so a screen reader announces a participation label, not a read-access one).
  visibility_group_a11y: 'Who can join this argument',

  // One direct-invite field (create-time framing; helper varies by visibility)
  invite_field_label: 'Invite one person (email)',
  invite_field_placeholder: 'name@example.com',
  invite_helper_private: 'A private argument needs one person. Add their email.',
  invite_helper_public:
    'Optional. Add one person to save them a seat — or leave this empty.',

  // Capacity explainer. The numbers ({capacity} / {open}) are filled from the
  // validator output — never written as a literal here.
  capacity_private: 'Just the two of you. Invite one person to start.',
  capacity_public_open:
    'Up to {capacity} people can take part. {open} seats stay open for the first to reply.',
  capacity_public_reserved:
    'Up to {capacity} people can take part. One seat is saved for the person you invite; {open} stay open for the first to reply.',
} as const);

/**
 * ARG-ROOM-003 — fill the `{capacity}` / `{open}` placeholders in a capacity
 * explainer string with the validator's own numbers. Kept tiny + pure so the
 * "form drives off the validator, not a hard-coded cap" test can pin that the
 * rendered number is exactly the validator's `capacity` / `openSlots`.
 */
export function fillArgumentRoomCapacityCopy(
  template: string,
  values: { capacity: number; open: number },
): string {
  return template
    .replace('{capacity}', String(values.capacity))
    .replace('{open}', String(values.open));
}

/**
 * META-1B — Plain-language strings for the realtime point-tags layer.
 *
 * The realtime channel makes other participants' tag changes visible
 * without a refresh. The visual surface is silent (the tag simply appears
 * in the metadata ledger via the existing read path); these strings are
 * used only for `AccessibilityInfo.announceForAccessibility` and the
 * optional subscription-status diagnostic.
 *
 * Doctrine:
 *   - Move-anchored, NEVER person-anchored. No slot for tagger identity.
 *   - The tag label is the META-001 plain-language label (passed in by the
 *     caller). No verdict prose. No popularity / engagement framing.
 *   - The "paused — reconnecting" diagnostic describes the transport, not
 *     the user or the move.
 */
export const ROOM_REALTIME_COPY = Object.freeze({
  /** Announced when another participant applies a manual tag to any move
   *  in the open room. `label` is the META-001 plain-language label. */
  tagAppliedAnnouncement: (label: string): string => `A "${label}" tag was added to a move.`,
  /** Announced when a manual tag is removed from any move in the open room. */
  tagRemovedAnnouncement: (label: string): string => `A "${label}" tag was removed from a move.`,
  /** Optional diagnostic chip — shown while the channel is subscribed. */
  statusOn: 'Live updates: on',
  /** Optional diagnostic chip — shown while the channel is mid-reconnect. */
  statusReconnecting: 'Live updates: paused — reconnecting',
  /** Optional diagnostic chip — shown after backoff is exhausted. */
  statusFailed: 'Live updates: paused — open the room again to retry',
} as const);

/** RULE-004 — header + button labels for the pre-send review sheet. */
export const PRESEND_SHEET_COPY = Object.freeze({
  header: 'One quick look before you post',
  blocksHeading: 'Fix this before posting',
  advisoriesHeading: 'A couple of things to consider',
  postAnyway: 'Post anyway',
  saveDraft: 'Save draft',
  backToEditing: 'Back to editing',
  // Per-advisory transformation button labels.
  transformation_narrow: 'Narrow the claim',
  transformation_branch_tangent: 'Branch a side issue',
  transformation_ask_source: 'Ask for a source',
  transformation_add_quote: 'Ask for a quote',
  transformation_add_evidence: 'Add a source',
  transformation_save_draft: 'Save draft',
  transformation_post_anyway: 'Post anyway',
} as const);

// ── Helper: look up a copy key by path ────────────────────────

export type CopyGroup =
  | typeof ROOM_COPY
  | typeof MOVE_COPY
  | typeof RECEIPT_COPY
  | typeof CONCESSION_COPY
  | typeof STATUS_COPY
  | typeof TIMELINE_COPY
  | typeof INVITE_COPY
  | typeof COMPOSER_COPY
  | typeof VALIDATION_COPY;

export const ALL_COPY = {
  room: ROOM_COPY,
  move: MOVE_COPY,
  receipt: RECEIPT_COPY,
  concession: CONCESSION_COPY,
  status: STATUS_COPY,
  timeline: TIMELINE_COPY,
  invite: INVITE_COPY,
  composer: COMPOSER_COPY,
  validation: VALIDATION_COPY,
  argumentMode: ARGUMENT_MODE_COPY,
} as const;
