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
});

export type SubmitArgumentPayload = z.infer<typeof SubmitArgumentSchema>;
