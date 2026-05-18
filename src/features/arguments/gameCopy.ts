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
  evidence_debt: 'Receipts needed',
  platform_support_warning: 'Do not score as proven yet',
  // Runner / pipeline status
  validation_failed_after_retries: 'The move needs a clearer shape before it can play well.',
  max_depth_reached: 'Deep unresolved chain',
  synthesis_ready: 'Near resolution',
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

// ── Stage 6.4 — Section headlines for the gallery entry ─────────

export const GALLERY_SECTIONS = [
  { id: 'jump_in', label: 'Jump into a live dispute', sub: 'Hot rooms with active back-and-forth.' },
  { id: 'needs_rebuttal', label: 'Needs first rebuttal', sub: 'Someone planted a claim; nobody has pushed back yet.' },
  { id: 'source_trail', label: 'Source trail fights', sub: 'Disputes over what the source actually says.' },
  { id: 'hot_unresolved', label: 'Hot but unresolved', sub: 'Long threads still searching for a resolution.' },
  { id: 'easy_first_move', label: 'Easy first move', sub: 'Quiet rooms — an easy place to start.' },
  { id: 'my_rooms', label: 'My rooms', sub: 'Rooms you have already joined.' },
] as const;

export type GallerySectionId = typeof GALLERY_SECTIONS[number]['id'];

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
