/**
 * REF-005 — Request review / Mark concern (structured allegations).
 *
 * Pure-TS model for a *moderation concern* — a procedural allegation object
 * about another participant's move. A concern is only ever expressible as
 * three bounded inputs:
 *
 *   1. a required target quote (the exact passage),
 *   2. a bounded concern type (six values — never free text), and
 *   3. a bounded requested remedy (six values).
 *
 * This is the THIRD object in the node-label doctrine (cdiscourse-doctrine
 * §10a): distinct from machine Observations and from gameplay Allegations.
 * The wall (`requestReviewWall.test.ts`) proves the three never
 * cross-contaminate — this module imports nothing from `nodeLabels/`
 * registries or `moveMetadataLedger`, and emits no `NodeLabelMark`.
 *
 * Doctrine encoded here:
 *   - **No person-verdict labels (§1 / §2.2).** The two person-directed
 *     concern types are bounded *procedural* chips — never a free-text
 *     characterization. A user cannot author "liar / troll / bad faith".
 *   - **Person-directed-never-public (§10a sensitive surfaces).** The two
 *     person-directed types are ALWAYS `moderator_visible`, never
 *     `public_after_review` pre-review.
 *   - **Zero `public_after_review` in v1.** `deriveConcernVisibility` never
 *     returns it for any of the 36 (type × remedy) combinations; the value
 *     remains in the union (binding from the issue) reserved for REF-005B.
 *   - **Nothing hides automatically.** Moderator-queue remedies return a
 *     descriptor; a human moderator performs any action.
 *
 * Pure TypeScript. No React. No Supabase. No network. No AI. The only
 * import is a TYPE-ONLY `ActEntryId` from the (pure-TS) act popout model, so
 * the claim-level remedies can route into the SHIPPED disagreement loop via
 * the host's `enterBoxForActEntry` bridge.
 */

// Type-only — `actPopoutModel.ts` is pure TS (no React / Supabase / network),
// and importing only its type keeps this module side-effect free.
import type { ActEntryId } from '../arguments/oneBox/actPopoutModel';

// ── Bounded vocabularies (verbatim from the issue — binding) ───────

/**
 * The six bounded concern types. A concern about another participant's move
 * is one of exactly these — never a free-text label on a person.
 */
export type ReviewConcernType =
  | 'about_person_not_claim'
  | 'needs_source'
  | 'needs_quote'
  | 'side_issue'
  | 'unclear_term'
  | 'harassment_concern';

/**
 * The six bounded requested remedies. The first four are claim-level (they
 * launch an engine-gated move via the disagreement loop); the last two are
 * moderator-queue (a human decides — nothing hides automatically).
 */
export type ReviewRequestedRemedy =
  | 'ask_source'
  | 'ask_quote'
  | 'branch'
  | 'narrow'
  | 'hide_pending_review'
  | 'moderator_review';

/**
 * The structured concern draft. `visibility` is a stored field but in v1 it
 * is ALWAYS derived (never free-set by the UI): the composer calls
 * `deriveConcernVisibility(...)` and writes the result before submit.
 */
export interface StructuredConcernDraft {
  targetNodeId: string;
  targetQuote: string;
  concernType: ReviewConcernType;
  requestedRemedy: ReviewRequestedRemedy;
  visibility: 'composer_only' | 'moderator_visible' | 'public_after_review';
}

/** The visibility a concern carries. */
export type ConcernVisibility = StructuredConcernDraft['visibility'];

/**
 * Routing of a remedy to its procedural surface. Claim-level remedies carry
 * an `ActEntryId` into the SHIPPED disagreement loop; moderator-queue
 * remedies carry a queue action a HUMAN moderator performs.
 */
export type ConcernRemedyRouting =
  | { kind: 'act_entry'; actEntryId: ActEntryId }
  | { kind: 'moderator_queue'; queueAction: 'hide_pending_review' | 'moderator_review' };

// ── Frozen vocabularies (tests iterate these) ─────────────────────

/** Frozen, ordered list of every concern type. */
export const ALL_REVIEW_CONCERN_TYPES: ReadonlyArray<ReviewConcernType> = Object.freeze([
  'about_person_not_claim',
  'needs_source',
  'needs_quote',
  'side_issue',
  'unclear_term',
  'harassment_concern',
]);

/** Frozen, ordered list of every requested remedy. */
export const ALL_REVIEW_REQUESTED_REMEDIES: ReadonlyArray<ReviewRequestedRemedy> = Object.freeze([
  'ask_source',
  'ask_quote',
  'branch',
  'narrow',
  'hide_pending_review',
  'moderator_review',
]);

/**
 * The two person-directed concern types — the §10a sensitive set. These read
 * as accusation if surfaced on the target's node, so they are gated
 * composer-only / moderator-visible and NEVER `public_after_review`.
 */
export const PERSON_DIRECTED_CONCERN_TYPES: ReadonlySet<ReviewConcernType> = new Set<ReviewConcernType>([
  'about_person_not_claim',
  'harassment_concern',
]);

// ── Plain-language copy maps (verbatim from the issue; ban-scanned) ─

/** Plain-language label for each concern type. No verdict / snake_case. */
export const CONCERN_TYPE_LABELS: Readonly<Record<ReviewConcernType, string>> = Object.freeze({
  about_person_not_claim: 'About the person rather than the claim',
  needs_source: 'Needs source',
  needs_quote: 'Quote missing',
  side_issue: 'Side issue',
  unclear_term: 'Unclear term',
  harassment_concern: 'Harassment concern',
});

/** Procedural description for each concern type — describes the MOVE, not the person. */
export const CONCERN_TYPE_DESCRIPTIONS: Readonly<Record<ReviewConcernType, string>> = Object.freeze({
  about_person_not_claim: 'This reply seems aimed at the speaker rather than the point they made.',
  needs_source: 'This claim relies on a source that has not been shown.',
  needs_quote: 'This refers to a passage without quoting it.',
  side_issue: 'This raises a separate point that belongs on its own branch.',
  unclear_term: 'A key term here has not been defined.',
  harassment_concern: "This reply may cross into harassment and needs a moderator's eyes.",
});

/** Plain-language label for each requested remedy. */
export const REMEDY_LABELS: Readonly<Record<ReviewRequestedRemedy, string>> = Object.freeze({
  ask_source: 'Ask for source',
  ask_quote: 'Ask for quote',
  branch: 'Branch',
  narrow: 'Narrow',
  hide_pending_review: 'Hide from public pending review',
  moderator_review: 'Moderator review',
});

// ── Validation ────────────────────────────────────────────────────

/**
 * True iff `draft` is submittable: target node id present, target quote
 * non-empty after trim, concern type in the bounded set, remedy in the
 * bounded set. `visibility` is NOT required (it is derived). Pure. Never
 * throws. Returns false for null / undefined / partial / foreign values.
 */
export function canSubmitConcern(
  draft: Partial<StructuredConcernDraft> | null | undefined,
): boolean {
  if (!draft || typeof draft !== 'object') return false;
  if (typeof draft.targetNodeId !== 'string' || draft.targetNodeId.length === 0) {
    return false;
  }
  if (typeof draft.targetQuote !== 'string' || draft.targetQuote.trim().length === 0) {
    return false;
  }
  if (
    typeof draft.concernType !== 'string' ||
    !ALL_REVIEW_CONCERN_TYPES.includes(draft.concernType as ReviewConcernType)
  ) {
    return false;
  }
  if (
    typeof draft.requestedRemedy !== 'string' ||
    !ALL_REVIEW_REQUESTED_REMEDIES.includes(draft.requestedRemedy as ReviewRequestedRemedy)
  ) {
    return false;
  }
  return true;
}

// ── Remedy → procedural-action routing ────────────────────────────

/**
 * Map a remedy to the surface that carries it out. Pure, total over the
 * bounded union. Claim-level remedies route into the SHIPPED disagreement
 * loop via an `ActEntryId` (consumed by the host's `enterBoxForActEntry`
 * bridge). Moderator-queue remedies route to the human-moderator queue —
 * nothing hides automatically.
 */
export function routeRemedy(remedy: ReviewRequestedRemedy): ConcernRemedyRouting {
  switch (remedy) {
    case 'ask_source':
      return { kind: 'act_entry', actEntryId: 'ask_source' };
    case 'ask_quote':
      return { kind: 'act_entry', actEntryId: 'ask_quote' };
    case 'branch':
      return { kind: 'act_entry', actEntryId: 'branch_tangent' };
    case 'narrow':
      return { kind: 'act_entry', actEntryId: 'narrow' };
    case 'hide_pending_review':
      return { kind: 'moderator_queue', queueAction: 'hide_pending_review' };
    case 'moderator_review':
      return { kind: 'moderator_queue', queueAction: 'moderator_review' };
    default: {
      // Exhaustiveness guard — unreachable for the typed union.
      const never: never = remedy;
      return never;
    }
  }
}

// ── Visibility derivation (the §10a pin) ──────────────────────────

/**
 * Derive the visibility a concern must carry. Pure, total. v1 is
 * conservative:
 *
 *   1. Person-directed concern types are ALWAYS `moderator_visible` —
 *      never composer-leaked-to-public, never public. (A harassment concern
 *      must reach a moderator to be actionable, but reads as accusation on
 *      the target's node, so it stays moderator-only.)
 *   2. A moderator-queue remedy is `moderator_visible`.
 *   3. Otherwise (claim-level type + claim-level remedy) → `composer_only`:
 *      the concern is a launcher; the *resulting move* becomes public via
 *      the engine gate — the concern object itself stays composer-local.
 *
 * It NEVER returns `public_after_review` for any of the 36 (type × remedy)
 * combinations — that value is reserved for REF-005B's post-review
 * moderator-publish path. Pinned by `requestReviewModel.test.ts`.
 */
export function deriveConcernVisibility(
  concernType: ReviewConcernType,
  requestedRemedy: ReviewRequestedRemedy,
): ConcernVisibility {
  if (PERSON_DIRECTED_CONCERN_TYPES.has(concernType)) {
    return 'moderator_visible';
  }
  if (routeRemedy(requestedRemedy).kind === 'moderator_queue') {
    return 'moderator_visible';
  }
  return 'composer_only';
}

// ── Finalize ──────────────────────────────────────────────────────

/**
 * Build a submittable, frozen `StructuredConcernDraft` from a partial. Returns
 * null when `canSubmitConcern(partial)` is false; otherwise a frozen draft
 * with `visibility` set from `deriveConcernVisibility`. The `targetQuote` is
 * trimmed. Pure.
 */
export function buildSubmittableConcern(
  partial: Partial<StructuredConcernDraft> | null | undefined,
): StructuredConcernDraft | null {
  if (!canSubmitConcern(partial)) return null;
  const p = partial as StructuredConcernDraft;
  return Object.freeze({
    targetNodeId: p.targetNodeId,
    targetQuote: p.targetQuote.trim(),
    concernType: p.concernType,
    requestedRemedy: p.requestedRemedy,
    visibility: deriveConcernVisibility(p.concernType, p.requestedRemedy),
  });
}
