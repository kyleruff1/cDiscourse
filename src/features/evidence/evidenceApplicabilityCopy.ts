/**
 * QOL-037 — Evidence applicability dispute flow — locked plain-language copy.
 *
 * Every user-facing string the QOL-037 model and components emit lives here as
 * a frozen constant, so the doctrine ban-list test can import the whole surface
 * and scan it. No component or model authors copy of its own — they read these.
 *
 * Pure constants. No React, no Supabase, no network.
 *
 * Doctrine anchors (design §8, cdiscourse-doctrine §1 / §9, evidence-doctrine):
 *   - Disputing applicability changes a STATUS, never declares the evidence
 *     true or false. No "proof" / "true" / "false" / "winner" / "loser" /
 *     "verdict" / "wrong" appears in any string here.
 *   - "Undisputed" is NOT a truth claim — it only means no dispute is open.
 *   - "Supported (stronger)" means "better supported than when the dispute
 *     opened", never "proven".
 *   - No amplification language (likes / views / followers / viral / trending /
 *     engagement) — popularity is not evidence.
 *   - No snake_case internal code (`applicability_disputed`, `dispute_*`) ever
 *     reaches a user-facing string; the internal ids stay in the model.
 */

// ── Choice-set copy — the seven structured evidence responses (design §5) ──

/** Plain-language label for each `EvidenceResponseChoice`, keyed by id. */
export const EVIDENCE_RESPONSE_CHOICE_LABELS = Object.freeze({
  accept: 'Accept evidence',
  accept_with_caveat: 'Accept with caveat',
  dispute_date: 'Dispute the date',
  dispute_amount: 'Dispute the amount',
  dispute_applicability: 'Dispute what it applies to',
  request_source: 'Ask for the source',
  request_clarification: 'Ask for clarification',
} as const);

/** One-line plain-language helper for each `EvidenceResponseChoice`. */
export const EVIDENCE_RESPONSE_CHOICE_HELPERS = Object.freeze({
  accept: 'This evidence holds up for me as presented.',
  accept_with_caveat: 'Mostly fine — note one reservation alongside it.',
  dispute_date: "The date on this record is not what it's being used for.",
  dispute_amount: "The amount is not what it's being used for.",
  dispute_applicability:
    'The record is real, but it applies to something other than the point being made.',
  request_source: 'Ask where this record comes from.',
  request_clarification: 'Ask the author to explain how this record supports the point.',
} as const);

// ── Applicability chip copy — the status axis (design §8) ──

/** Plain-language chip label per visible `ApplicabilityStatus`. The
 *  `applicability_undisputed` state renders no chip, so it has no label. */
export const APPLICABILITY_CHIP_LABELS = Object.freeze({
  applicability_disputed: 'Applicability disputed',
  applicability_supported: 'Applicability supported',
} as const);

/** Plain-language chip helper per visible `ApplicabilityStatus`. */
export const APPLICABILITY_CHIP_HELPERS = Object.freeze({
  applicability_disputed:
    'A participant disagrees about what this evidence applies to.',
  applicability_supported:
    "After the dispute, this evidence is better supported for what it's used for.",
} as const);

// ── Disabled-Post reasons — the required-clarification rule (design §5.1, §8) ──

/** Shown on the disabled Post button when a non-accept choice has an empty
 *  clarification body. */
export const CLARIFICATION_REQUIRED_REASON =
  'Add a note explaining your response before posting.';

/** Shown on the disabled Post button when a non-accept choice has a
 *  clarification body shorter than the minimum. */
export const CLARIFICATION_TOO_SHORT_REASON =
  'Your note is too short — add a sentence explaining your response.';

// ── Preview line — the status consequence shown before posting (design §6.1) ──

/** Prefix for the box's preview line. The status word is appended by the
 *  renderer from the chip label, e.g. "This will mark the evidence:
 *  Applicability disputed". When a choice changes nothing, the unchanged-status
 *  copy below is shown instead. */
export const APPLICABILITY_PREVIEW_PREFIX = 'This will mark the evidence: ';

/** Preview line when the selected choice changes no applicability status. */
export const APPLICABILITY_PREVIEW_NO_CHANGE =
  'This response does not change the evidence applicability status.';

// ── Read-view copy — Inspect §E evidence detail, QOL-030/032 fallback (design §6.2) ──

/** Section heading for the applicability read-view block. */
export const APPLICABILITY_READ_VIEW_HEADING = 'Applicability';

/** Field label — what the submitter says the evidence applies to. */
export const CLAIMED_APPLICABILITY_LABEL = 'Claimed applicability';

/** Field label — what a disputing participant says it applies to instead. */
export const DISPUTED_APPLICABILITY_LABEL = 'Disputed applicability';

/** Placeholder when QOL-036 metadata is absent (edge case 9) — the claimed
 *  side is simply unknown, never inferred. */
export const APPLICABILITY_NOT_SPECIFIED = 'Not specified';

/** Placeholder when no dispute has been opened yet. */
export const APPLICABILITY_NO_DISPUTE = 'No dispute opened';

// ── Clarification field copy (design §6.1) ──

/** Label above the required clarification text field. */
export const CLARIFICATION_FIELD_LABEL = 'Clarification — required for this choice';

/** Placeholder inside the clarification text field. */
export const CLARIFICATION_FIELD_PLACEHOLDER =
  'Explain your response so the other participant can follow it.';

// ── Role-gate copy — own-evidence + observer fallback (design §9) ──

/** Read-only line shown when the active viewer authored the evidence — the
 *  author responds to their own evidence by attaching a new evidence move,
 *  never by responding to themselves. */
export const OWN_EVIDENCE_NOTICE = 'You attached this evidence.';

/** Disabled-Post reason for an observer (read-mode) — they must join a side
 *  before they can respond. Mirrors EV-002's observer contract. */
export const OBSERVER_RESPONSE_DISABLED_REASON = 'Join a side to respond.';

/**
 * Every QOL-037 system-generated string, frozen, so the ban-list test can
 * iterate the whole surface in one place. Keep this in sync when adding a
 * string above — a missing entry is a test gap.
 */
export const ALL_EVIDENCE_APPLICABILITY_STRINGS: ReadonlyArray<string> = Object.freeze([
  ...Object.values(EVIDENCE_RESPONSE_CHOICE_LABELS),
  ...Object.values(EVIDENCE_RESPONSE_CHOICE_HELPERS),
  ...Object.values(APPLICABILITY_CHIP_LABELS),
  ...Object.values(APPLICABILITY_CHIP_HELPERS),
  CLARIFICATION_REQUIRED_REASON,
  CLARIFICATION_TOO_SHORT_REASON,
  APPLICABILITY_PREVIEW_PREFIX,
  APPLICABILITY_PREVIEW_NO_CHANGE,
  APPLICABILITY_READ_VIEW_HEADING,
  CLAIMED_APPLICABILITY_LABEL,
  DISPUTED_APPLICABILITY_LABEL,
  APPLICABILITY_NOT_SPECIFIED,
  APPLICABILITY_NO_DISPUTE,
  CLARIFICATION_FIELD_LABEL,
  CLARIFICATION_FIELD_PLACEHOLDER,
  OWN_EVIDENCE_NOTICE,
  OBSERVER_RESPONSE_DISABLED_REASON,
]);
