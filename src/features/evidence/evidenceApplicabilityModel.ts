/**
 * QOL-037 — Evidence applicability dispute flow — pure-TS model.
 *
 * The behaviour spec for the QOL-030 `respond_to_evidence` box type. Defines:
 *   - the seven structured evidence-response choices (closed set);
 *   - the applicability status axis — distinct from EV-001's `SourceChainStatus`
 *     (existence / source-chain) and EV-003's evidence-debt (obligation) axis;
 *   - the rule that any non-`accept` choice requires a clarification body;
 *   - the render-time derivation of an evidence object's applicability status
 *     from the moves responding to it;
 *   - the view-model the `respond_to_evidence` box renders.
 *
 * Pure TypeScript: no React, no Supabase, no network, no mutation, no async.
 * Sits beside `evidenceModel.ts` / `evidenceDebtModel.ts`. JSON-serializable
 * inputs and outputs so it runs identically on client and (if ever needed) in
 * an Edge Function.
 *
 * Doctrine (design §12, cdiscourse-doctrine §1, evidence-doctrine):
 *   - The applicability axis describes a STATUS (`undisputed` / `disputed` /
 *     `supported`). None of the three is a truth verdict. There is deliberately
 *     no "applicability proven / disproven / true / false" value — the model
 *     has no truth-negative state.
 *   - Disputing applicability flips a status; it never declares the evidence
 *     false. Existence, source-chain, and applicability are three independent
 *     axes that never read each other.
 *   - `applicability_supported` is reachable ONLY via corroborating MOVES —
 *     never via popularity, heat, replies, or views (anti-amplification).
 *   - The required-clarification rule is a VALIDATION gate (it may block a
 *     post). It is not a score gate; score never blocks (cdiscourse-doctrine §1).
 */

// ── The structured evidence-response choice set ────────────────

/**
 * The seven structured responses to an evidence object. Closed set — no UI
 * surface may add an eighth. A new evidence-response kind is a new card that
 * edits this union and the descriptor table below.
 */
export type EvidenceResponseChoice =
  | 'accept'
  | 'accept_with_caveat'
  | 'dispute_date'
  | 'dispute_amount'
  | 'dispute_applicability'
  | 'request_source'
  | 'request_clarification';

/**
 * The applicability axis — distinct from `SourceChainStatus` (EV-001) and the
 * EV-003 evidence-debt status.
 *
 * `applicability_undisputed` is NOT a truth claim — it only means no
 * applicability dispute is open. There is no truth-negative value by design.
 */
export type ApplicabilityStatus =
  | 'applicability_undisputed'
  | 'applicability_disputed'
  | 'applicability_supported';

/**
 * A single recorded evidence response — the advisory block persisted into the
 * argument's `client_validation` / `server_validation` JSONB snapshot. The
 * applicability status is render-time-derivable from a chronological list of
 * these; QOL-037 adds no `evidence_applicability` table in v1.
 */
export interface EvidenceResponseRecord {
  /** The evidence object (EV-001 `EvidenceArtifact.id`) this response targets. */
  evidenceArtifactId: string;
  /** The argument (move) that carried this response. */
  argumentId: string;
  /** One of the seven choices. */
  choice: EvidenceResponseChoice;
  /** Required for every choice except `accept`. May be '' only when
   *  `choice === 'accept'`. */
  clarificationBody: string;
  /** The author of the response move. */
  respondedByUserId: string;
  /** ISO-8601 — copied from the argument's `created_at`. Used to order the
   *  derivation walk. */
  respondedAt: string;
}

/**
 * The per-choice descriptor the `respond_to_evidence` box renders. Frozen at
 * design time — the box renders these, it never invents them.
 */
export interface EvidenceResponseChoiceDescriptor {
  choice: EvidenceResponseChoice;
  /** Plain-language label. Never a snake_case code. */
  label: string;
  /** Plain-language helper, one line. */
  helper: string;
  /** True when a clarification body is structurally required. */
  requiresClarification: boolean;
  /** The applicability transition this choice drives, or null. Only
   *  `dispute_applicability` opens a dispute; `dispute_date` / `dispute_amount`
   *  touch other axes and never change `ApplicabilityStatus`. */
  appliesApplicabilityTransition: 'open_dispute' | null;
  /** True when this choice opens an EV-003 evidence debt (only `request_source`). */
  opensEvidenceDebt: boolean;
}

/**
 * Structural validity of a `respond_to_evidence` draft. Pure.
 */
export interface EvidenceResponseValidation {
  isValid: boolean;
  /** Plain-language reason when `!isValid` — shown on the disabled Post button.
   *  null when the draft is valid. */
  blockingReason: string | null;
}

/**
 * The plain-language chip contract for the applicability axis. A renderer maps
 * `tone` to a color token; the `label` is the primary signal (the chip is never
 * color-only — accessibility-targets color-independence).
 */
export interface ApplicabilityChipContract {
  /** Plain-language label, e.g. "Applicability disputed". Never snake_case.
   *  Empty string for `applicability_undisputed` (the chip is not rendered). */
  label: string;
  /** Plain-language helper. Empty string for `applicability_undisputed`. */
  helper: string;
  /** Logical tone — renderers map to a token. NOT a truth label. */
  tone: 'neutral' | 'info' | 'attention';
  /** False for `applicability_undisputed` — the chip is not rendered then. */
  isVisible: boolean;
  status: ApplicabilityStatus;
}

/**
 * The full view-model the `respond_to_evidence` box renders. Pure.
 */
export interface RespondToEvidenceViewModel {
  evidenceArtifactId: string;
  /** The current applicability status of the target, for the box preview line
   *  and the Inspect §E read-view. */
  currentApplicabilityStatus: ApplicabilityStatus;
  /** All seven choice descriptors, frozen, in display order. */
  choices: ReadonlyArray<EvidenceResponseChoiceDescriptor>;
  /** The Inspect §E "claimed applicability" read field — from QOL-036's
   *  `ClaimedApplicability.statement`. null when QOL-036 metadata is absent
   *  (edge case 9 — the read-view renders "Not specified"). */
  claimedApplicability: string | null;
  /** The Inspect §E "disputed applicability" read field — the clarification of
   *  the most recent OPEN `dispute_applicability` move. null when no dispute is
   *  open. */
  disputedApplicability: string | null;
}

// ── Imports of the locked plain-language copy ──────────────────

import {
  EVIDENCE_RESPONSE_CHOICE_LABELS,
  EVIDENCE_RESPONSE_CHOICE_HELPERS,
  APPLICABILITY_CHIP_LABELS,
  APPLICABILITY_CHIP_HELPERS,
  CLARIFICATION_REQUIRED_REASON,
  CLARIFICATION_TOO_SHORT_REASON,
} from './evidenceApplicabilityCopy';

// ── Frozen enums ───────────────────────────────────────────────

/**
 * The seven choice ids, frozen — for exhaustive iteration in tests and
 * defensive `choice` validation (a `choice` not in this set is ignored by
 * `deriveApplicabilityStatus`, edge case 13).
 */
export const ALL_EVIDENCE_RESPONSE_CHOICES: ReadonlyArray<EvidenceResponseChoice> =
  Object.freeze([
    'accept',
    'accept_with_caveat',
    'dispute_date',
    'dispute_amount',
    'dispute_applicability',
    'request_source',
    'request_clarification',
  ]);

/** The three applicability statuses, frozen — for exhaustive iteration. */
export const ALL_APPLICABILITY_STATUSES: ReadonlyArray<ApplicabilityStatus> =
  Object.freeze([
    'applicability_undisputed',
    'applicability_disputed',
    'applicability_supported',
  ]);

/**
 * The seven choice descriptors, frozen, in display order. The single source of
 * truth for `requiresClarification`, the applicability transition, and the
 * evidence-debt route. Verbatim from design §5.
 *
 * Notes the §5 table fixes:
 *   - Only `dispute_applicability` carries `appliesApplicabilityTransition:
 *     'open_dispute'`. `dispute_date` / `dispute_amount` are separate axes
 *     (QOL-036's date / amount fields) and never touch `ApplicabilityStatus`.
 *   - `request_source` is the only non-`accept` choice with
 *     `requiresClarification: false` — its body is seeded from EV-002's
 *     `ASK_SOURCE_PRESET_BODY`, so the clarification requirement is satisfied
 *     by construction (see `validateEvidenceResponseDraft`).
 *   - `accept` is the only choice with `requiresClarification: false` and no
 *     seeded body — it is unconditional; a clarification would be noise.
 */
export const EVIDENCE_RESPONSE_CHOICES: ReadonlyArray<EvidenceResponseChoiceDescriptor> =
  Object.freeze([
    Object.freeze({
      choice: 'accept' as const,
      label: EVIDENCE_RESPONSE_CHOICE_LABELS.accept,
      helper: EVIDENCE_RESPONSE_CHOICE_HELPERS.accept,
      requiresClarification: false,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    }),
    Object.freeze({
      choice: 'accept_with_caveat' as const,
      label: EVIDENCE_RESPONSE_CHOICE_LABELS.accept_with_caveat,
      helper: EVIDENCE_RESPONSE_CHOICE_HELPERS.accept_with_caveat,
      requiresClarification: true,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    }),
    Object.freeze({
      choice: 'dispute_date' as const,
      label: EVIDENCE_RESPONSE_CHOICE_LABELS.dispute_date,
      helper: EVIDENCE_RESPONSE_CHOICE_HELPERS.dispute_date,
      requiresClarification: true,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    }),
    Object.freeze({
      choice: 'dispute_amount' as const,
      label: EVIDENCE_RESPONSE_CHOICE_LABELS.dispute_amount,
      helper: EVIDENCE_RESPONSE_CHOICE_HELPERS.dispute_amount,
      requiresClarification: true,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    }),
    Object.freeze({
      choice: 'dispute_applicability' as const,
      label: EVIDENCE_RESPONSE_CHOICE_LABELS.dispute_applicability,
      helper: EVIDENCE_RESPONSE_CHOICE_HELPERS.dispute_applicability,
      requiresClarification: true,
      appliesApplicabilityTransition: 'open_dispute',
      opensEvidenceDebt: false,
    }),
    Object.freeze({
      choice: 'request_source' as const,
      label: EVIDENCE_RESPONSE_CHOICE_LABELS.request_source,
      helper: EVIDENCE_RESPONSE_CHOICE_HELPERS.request_source,
      // The body is seeded from EV-002's preset — the clarification requirement
      // is satisfied by construction, so this is false.
      requiresClarification: false,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: true,
    }),
    Object.freeze({
      choice: 'request_clarification' as const,
      label: EVIDENCE_RESPONSE_CHOICE_LABELS.request_clarification,
      helper: EVIDENCE_RESPONSE_CHOICE_HELPERS.request_clarification,
      requiresClarification: true,
      appliesApplicabilityTransition: null,
      opensEvidenceDebt: false,
    }),
  ]);

/**
 * Minimum length of a clarification body, after trimming, for a non-`accept`
 * choice to be structurally valid. Long enough to be a sentence fragment,
 * short enough not to be a busywork gate (design §5.1, open question 5).
 */
export const MIN_CLARIFICATION_CHARS = 12;

// ── Internal helpers ───────────────────────────────────────────

/** Type guard — is the value one of the seven known choices. */
function isKnownChoice(value: unknown): value is EvidenceResponseChoice {
  return (
    typeof value === 'string' &&
    (ALL_EVIDENCE_RESPONSE_CHOICES as ReadonlyArray<string>).includes(value)
  );
}

/** Look up the frozen descriptor for a choice. */
function descriptorFor(
  choice: EvidenceResponseChoice,
): EvidenceResponseChoiceDescriptor {
  // Safe: EVIDENCE_RESPONSE_CHOICES covers every member of the union.
  return EVIDENCE_RESPONSE_CHOICES.find((d) => d.choice === choice)!;
}

// ── validateEvidenceResponseDraft ──────────────────────────────

/**
 * Structural validity of a `respond_to_evidence` draft (design §5.1).
 *
 * A draft is structurally valid iff:
 *   choice === 'accept'
 *   OR the choice does not require a clarification (only `request_source`,
 *      whose body is seeded — but if the user clears the seeded body below the
 *      floor, the rule re-engages here exactly as for any other non-accept
 *      choice)
 *   OR the trimmed clarification body length ≥ MIN_CLARIFICATION_CHARS.
 *
 * This is a VALIDATION rule — it may block the post (the box disables Post with
 * a visible reason). It is not a score rule; score never blocks
 * (cdiscourse-doctrine §1). Pure.
 *
 * @param choice the selected response choice.
 * @param clarificationBody the clarification text as typed (un-trimmed).
 */
export function validateEvidenceResponseDraft(
  choice: EvidenceResponseChoice,
  clarificationBody: string,
): EvidenceResponseValidation {
  // `accept` is unconditional — a clarification is allowed but never required.
  if (choice === 'accept') {
    return { isValid: true, blockingReason: null };
  }

  const trimmed = (clarificationBody ?? '').trim();
  const descriptor = descriptorFor(choice);

  // `request_source` does not demand a free clarification — its body is seeded
  // from EV-002's preset. A non-empty body satisfies the rule. If the user
  // cleared the seeded body entirely, fall through to the empty-body branch so
  // the rule re-engages (design §5 notes, §5.1).
  if (!descriptor.requiresClarification && trimmed.length > 0) {
    return { isValid: true, blockingReason: null };
  }

  if (trimmed.length === 0) {
    return { isValid: false, blockingReason: CLARIFICATION_REQUIRED_REASON };
  }

  if (trimmed.length < MIN_CLARIFICATION_CHARS) {
    return { isValid: false, blockingReason: CLARIFICATION_TOO_SHORT_REASON };
  }

  return { isValid: true, blockingReason: null };
}

// ── deriveApplicabilityStatus ──────────────────────────────────

/** Options for `deriveApplicabilityStatus`. */
export interface DeriveApplicabilityStatusOptions {
  /**
   * Argument ids of later corroborating moves that resolve an open dispute
   * (design §7.2 rule 5). In v1, `add_evidence` corroboration is not yet wired
   * (QOL-036 dependency), so the caller passes corroborating move ids
   * explicitly. When any of these ids appears while a dispute is open, the
   * dispute resolves to `applicability_supported`. Absent → only an `accept`
   * by the disputing party advances to `supported` (rule 4).
   */
  corroboratedByArgumentIds?: ReadonlyArray<string>;
}

/**
 * Derive the applicability status of one evidence object from the full set of
 * responses targeting it (design §7.2). Pure, deterministic, no I/O.
 *
 * Algorithm — walk the responses oldest-first:
 *   1. Start at `applicability_undisputed`.
 *   2. `dispute_applicability` → `applicability_disputed`, dispute opened,
 *      remember the disputing user.
 *   3. `accept` while a dispute is open AND by the disputing party → dispute
 *      resolved → `applicability_supported`. (An `accept` by anyone else does
 *      NOT resolve it.)
 *   4. A corroborating move (its argumentId is in
 *      `options.corroboratedByArgumentIds`) while a dispute is open → dispute
 *      resolved → `applicability_supported`.
 *   5. `dispute_applicability` after `applicability_supported` re-opens →
 *      `applicability_disputed`.
 *   6. `dispute_date`, `dispute_amount`, `accept_with_caveat`,
 *      `request_source`, `request_clarification` never change the status — they
 *      touch other axes. The walk ignores them.
 *   7. A record whose `choice` is unknown (a future client) is ignored — the
 *      derivation degrades as if the record were absent (edge case 13).
 *
 * The walk is sorted by `respondedAt`; equal timestamps keep input order so the
 * derivation is stable. Records targeting different evidence objects are NOT
 * filtered here — the caller passes the slice for ONE object.
 *
 * @param responses the evidence responses targeting one evidence object.
 * @param options optional corroborating-move ids (§7.2 rule 5, §11 fallback).
 */
export function deriveApplicabilityStatus(
  responses: ReadonlyArray<EvidenceResponseRecord>,
  options?: DeriveApplicabilityStatusOptions,
): ApplicabilityStatus {
  if (!Array.isArray(responses) || responses.length === 0) {
    return 'applicability_undisputed';
  }

  const corroborating = new Set(options?.corroboratedByArgumentIds ?? []);

  // Stable chronological sort — equal timestamps keep input order.
  const ordered = responses
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      const ta = a.record?.respondedAt ?? '';
      const tb = b.record?.respondedAt ?? '';
      if (ta < tb) return -1;
      if (ta > tb) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.record);

  let status: ApplicabilityStatus = 'applicability_undisputed';
  let disputeOpen = false;
  let disputingUserId: string | null = null;

  for (const record of ordered) {
    if (!record || !isKnownChoice(record.choice)) {
      // Unknown / malformed record — ignore it (edge case 13).
      continue;
    }

    // A corroborating move resolves an open dispute regardless of its choice
    // (the move itself need not be a `respond_to_evidence`).
    if (disputeOpen && corroborating.has(record.argumentId)) {
      status = 'applicability_supported';
      disputeOpen = false;
      disputingUserId = null;
      // Fall through so a record that is BOTH corroborating and a fresh
      // dispute (unusual) is still considered below.
    }

    if (record.choice === 'dispute_applicability') {
      status = 'applicability_disputed';
      disputeOpen = true;
      disputingUserId = record.respondedByUserId;
      continue;
    }

    if (record.choice === 'accept') {
      // Resolves the dispute only when posted by the disputing party.
      if (disputeOpen && record.respondedByUserId === disputingUserId) {
        status = 'applicability_supported';
        disputeOpen = false;
        disputingUserId = null;
      }
      continue;
    }

    // dispute_date / dispute_amount / accept_with_caveat / request_source /
    // request_clarification — never touch the applicability axis.
  }

  return status;
}

// ── previewApplicabilityTransition ─────────────────────────────

/**
 * Preview the applicability status a choice would produce, for the box's
 * preview line (design §6.1). Pure.
 *
 * Only `dispute_applicability` changes the status — it opens a dispute, so the
 * preview is `applicability_disputed` (from any current status, since a fresh
 * dispute always re-opens). Every other choice previews the unchanged current
 * status.
 *
 * @param choice the selected response choice.
 * @param currentStatus the target's current applicability status.
 */
export function previewApplicabilityTransition(
  choice: EvidenceResponseChoice,
  currentStatus: ApplicabilityStatus,
): ApplicabilityStatus {
  if (!isKnownChoice(choice)) return currentStatus;
  const descriptor = descriptorFor(choice);
  if (descriptor.appliesApplicabilityTransition === 'open_dispute') {
    return 'applicability_disputed';
  }
  return currentStatus;
}

// ── summarizeApplicabilityChip ─────────────────────────────────

/**
 * Build the plain-language chip contract for an applicability status
 * (design §8). Pure.
 *
 * `applicability_undisputed` returns `isVisible: false` with empty strings —
 * uncontested evidence shows no applicability chip (no clutter). The two
 * visible statuses carry the locked label + helper from
 * `evidenceApplicabilityCopy`.
 *
 * `tone` is a logical token, never a truth label: `attention` for `disputed`
 * (an axis is contested), `info` for `supported` (the dispute was addressed).
 *
 * @param status the applicability status to summarise.
 */
export function summarizeApplicabilityChip(
  status: ApplicabilityStatus,
): ApplicabilityChipContract {
  if (status === 'applicability_disputed') {
    return {
      label: APPLICABILITY_CHIP_LABELS.applicability_disputed,
      helper: APPLICABILITY_CHIP_HELPERS.applicability_disputed,
      tone: 'attention',
      isVisible: true,
      status,
    };
  }

  if (status === 'applicability_supported') {
    return {
      label: APPLICABILITY_CHIP_LABELS.applicability_supported,
      helper: APPLICABILITY_CHIP_HELPERS.applicability_supported,
      tone: 'info',
      isVisible: true,
      status,
    };
  }

  // applicability_undisputed — no chip.
  return {
    label: '',
    helper: '',
    tone: 'neutral',
    isVisible: false,
    status: 'applicability_undisputed',
  };
}

// ── buildRespondToEvidenceViewModel ────────────────────────────

/**
 * Find the clarification of the most recent OPEN `dispute_applicability` move.
 *
 * "Open" means a dispute that the derivation has not resolved. We compute the
 * derived status; if it is `applicability_disputed`, the latest
 * `dispute_applicability` (by `respondedAt`, stable on ties) is the open one
 * and its clarification is the "disputed applicability" read field. If the
 * status is not `disputed`, there is no open dispute → null.
 */
function findOpenDisputeClarification(
  responses: ReadonlyArray<EvidenceResponseRecord>,
  options?: DeriveApplicabilityStatusOptions,
): string | null {
  if (deriveApplicabilityStatus(responses, options) !== 'applicability_disputed') {
    return null;
  }

  // Status is `disputed` → at least one `dispute_applicability` record exists.
  // Pick the most recent one by `respondedAt`; ties keep the later array index
  // (the last-seen `>=` wins) so the choice is deterministic.
  const disputes = responses.filter(
    (record): record is EvidenceResponseRecord =>
      !!record && record.choice === 'dispute_applicability',
  );
  let open = disputes[0];
  for (let i = 1; i < disputes.length; i += 1) {
    if ((disputes[i].respondedAt ?? '') >= (open.respondedAt ?? '')) {
      open = disputes[i];
    }
  }

  const body = (open.clarificationBody ?? '').trim();
  return body.length > 0 ? body : null;
}

/**
 * Build the full view-model the `respond_to_evidence` box renders (design §7.1).
 * Pure.
 *
 * @param evidenceArtifactId the evidence object the box targets.
 * @param responses the evidence responses targeting that object (any order).
 * @param claimedApplicability QOL-036's `ClaimedApplicability.statement`, or
 *   null when QOL-036 metadata is absent (edge case 9 — the read-view renders
 *   "Not specified"; the dispute flow still works).
 * @param options optional corroborating-move ids (§7.2 rule 5, §11 fallback).
 */
export function buildRespondToEvidenceViewModel(
  evidenceArtifactId: string,
  responses: ReadonlyArray<EvidenceResponseRecord>,
  claimedApplicability: string | null,
  options?: DeriveApplicabilityStatusOptions,
): RespondToEvidenceViewModel {
  const safeResponses = Array.isArray(responses) ? responses : [];
  const trimmedClaimed =
    typeof claimedApplicability === 'string' && claimedApplicability.trim().length > 0
      ? claimedApplicability.trim()
      : null;

  return {
    evidenceArtifactId,
    currentApplicabilityStatus: deriveApplicabilityStatus(safeResponses, options),
    choices: EVIDENCE_RESPONSE_CHOICES,
    claimedApplicability: trimmedClaimed,
    disputedApplicability: findOpenDisputeClarification(safeResponses, options),
  };
}
