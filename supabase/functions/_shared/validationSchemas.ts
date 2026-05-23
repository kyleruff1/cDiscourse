/**
 * Zod validation schemas for Edge Function request/response bodies.
 * Imported by submit-argument and any future functions.
 */
import { z } from 'npm:zod@4';

export const ArgumentTypeSchema = z.enum([
  'thesis',
  'claim',
  'rebuttal',
  'counter_rebuttal',
  'evidence',
  'clarification_request',
  'concession',
  'synthesis',
]);

export const SideSchema = z.enum(['affirmative', 'negative', 'neutral']);

export const DisagreementAxisSchema = z.enum([
  'fact',
  'definition',
  'causal',
  'value',
  'evidence',
  'logic',
  'scope',
]);

export const EvidenceAttachmentSchema = z.object({
  url: z.string().optional(),
  label: z.string().optional(),
  source_text: z.string().optional(),
});

export const TargetSchema = z.object({
  target_excerpt: z.string().optional(),
  disagreement_axis: DisagreementAxisSchema.optional(),
  concession_scope: z.string().optional(),
  user_stated_uncertainty: z.boolean().optional(),
});

/**
 * QOL-037 — the structured evidence-response block carried on a
 * `respond_to_evidence` move. ADVISORY: submit-argument copies it verbatim
 * into the validation snapshot — it never hard-blocks on it and never branches
 * the insert path. `choice` is a free string (one of QOL-037's seven choice
 * ids); the field set is kept permissive so a malformed block can never block
 * a post (an unknown choice degrades gracefully in the client-side
 * `deriveApplicabilityStatus`). The clarification-required rule is enforced
 * client-side in the box, not re-asserted here.
 */
export const EvidenceResponseSchema = z.object({
  evidence_artifact_id: z.string(),
  choice: z.string(),
  clarification_body: z.string(),
});

/**
 * QOL-041 — the 5-level acceptance gradient vocabulary. The text values
 * mirror `AcceptanceLevel` in
 * `src/features/concessions/acceptanceGradient.ts` and the
 * `concession_acceptances.acceptance_level` CHECK in
 * `supabase/migrations/20260522000012_qol_041_concession_acceptance.sql`.
 * Drift between the three would be caught by tests.
 */
export const AcceptanceLevelSchema = z.enum([
  'agree',
  'agree_with_caveat',
  'disagree_framing',
  'disagree_context',
  'disagree_fact',
]);

/**
 * QOL-041 — one entry of the optional `concession_items[]` array on a
 * `respond` move. The conceding party's authored point + its ordinal in
 * the forced list. `ordinal` >= 0; `item_text` is 1..600 chars after
 * trim (mirrors the migration CHECK). The Edge Function trims before
 * the length check.
 */
export const ConcessionItemPayloadSchema = z.object({
  ordinal: z.number().int().min(0),
  item_text: z.string().min(1).max(600),
});

/**
 * QOL-041 — one entry of the optional `concession_acceptances[]` array
 * on a `respond_to_concession` move. `concession_item_id` is the id of
 * an incoming `concession_items` row; `acceptance_level` is one of the
 * 5 levels; `clarification_body` is REQUIRED whenever the level is not
 * `agree`. The required-when-non-agree rule is enforced by the
 * `.refine` below AND by the migration CHECK `clarification_required_unless_agree`
 * AND by the client `respondToConcessionModel.isPostable()` — three
 * walls of defense (design §5.2 / §7.2 / §11).
 */
export const ConcessionAcceptancePayloadSchema = z.object({
  concession_item_id: z.string().uuid(),
  acceptance_level: AcceptanceLevelSchema,
  clarification_body: z.string().default(''),
}).refine(
  (v) => v.acceptance_level === 'agree' || v.clarification_body.trim().length >= 1,
  { message: 'clarification_required_unless_agree', path: ['clarification_body'] },
);

export const SubmitArgumentSchema = z.object({
  debate_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  argument_type: ArgumentTypeSchema,
  side: SideSchema,
  body: z.string().min(1),
  selected_tag_codes: z.array(z.string()),
  attached_evidence: z.array(EvidenceAttachmentSchema).optional(),
  target: TargetSchema.optional(),
  client_validation: z.record(z.unknown()).optional(),
  /** Client-generated UUID for idempotent submission. Same UUID on retry returns the existing argument. */
  client_submission_id: z.string().uuid().optional(),
  /**
   * QOL-037 — optional advisory evidence-response block. Copied verbatim into
   * the validation snapshot. Optional → an older client that omits it is
   * unaffected.
   */
  evidence_response: EvidenceResponseSchema.optional(),
  /**
   * QOL-041 — optional concession-items array carried on a `respond` move.
   * The conceding party's itemized forced list (design §5.1 / §5.6). When
   * absent or empty, the response is a pure refutation (concession section
   * is optional — design §9). The Edge Function inserts these rows in the
   * SAME transaction as the parent argument (design §5.6). Cap of 8 items
   * mirrors the client model + the design §15 Q1 default.
   */
  concession_items: z.array(ConcessionItemPayloadSchema).max(8).optional(),
  /**
   * QOL-041 — optional concession-acceptances array carried on a
   * `respond_to_concession` move. Each entry grades one incoming
   * `concession_items` row with a 5-level acceptance + a clarification
   * (required when non-`agree`; defense-in-depth with the migration CHECK
   * and the client model). The Edge Function inserts these rows in the
   * SAME transaction as the parent argument.
   */
  concession_acceptances: z.array(ConcessionAcceptancePayloadSchema).optional(),
});

export type SubmitArgumentPayload = z.infer<typeof SubmitArgumentSchema>;
