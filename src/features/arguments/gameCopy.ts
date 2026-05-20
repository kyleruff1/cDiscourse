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
  noObjectiveTruth: 'This reflects current game state, not objective fact.',
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
} as const;

export type PlainLanguageKey = keyof typeof PLAIN_LANGUAGE_COPY;

/**
 * Lookup helper. Returns the plain-language string for a known internal
 * code, or `null` for unknown codes (callers can decide to surface raw or
 * suppress). Case-insensitive. Stage 6.4: normal-user surfaces SHOULD pass
 * the result through `toPlainLanguageOrSuppress` to drop unknown codes.
 */
export function toPlainLanguage(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = String(code).trim().toLowerCase().replace(/[\s-]+/g, '_') as PlainLanguageKey;
  if (Object.prototype.hasOwnProperty.call(PLAIN_LANGUAGE_COPY, key)) return PLAIN_LANGUAGE_COPY[key];
  return null;
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
  flagHelp: 'Send to moderators for review.',
  replyHelp: 'Post your move on this card.',
  disagreeHelp: 'Challenge this move directly.',
  askQuoteHelp: 'Ask the speaker to quote the exact passage.',
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
} as const;
