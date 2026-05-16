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
});

export type SubmitArgumentPayload = z.infer<typeof SubmitArgumentSchema>;
