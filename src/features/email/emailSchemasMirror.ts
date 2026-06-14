/**
 * EMAIL-TRANSPORT-001 — dependency-free, IMPORTABLE Jest mirror of the Deno
 * `supabase/functions/_shared/email/emailSchemas.ts` shapes.
 *
 * WHY THIS FILE EXISTS
 *   The Edge schema file imports zod via a Deno specifier which Jest's module
 *   loader cannot resolve. Rather than re-declare the schemas inline in the
 *   test (the older `inviteSchemas.test.ts` pattern), this importable twin uses
 *   the Node-installed `zod` so the contract is asserted in one place and
 *   reused. The `emailSchemasMirror.test.ts` proves byte-equal field/regex
 *   parity with the Deno source.
 *
 * NOT a client runtime module — it is types/validators only. It reads NO
 * secret, makes NO network call, and is imported only by tests.
 *
 * If you change `emailSchemas.ts`, change this mirror (and vice-versa); the
 * parity test catches a drift.
 */
import { z } from 'zod';

const Email = z.string().email().max(320);
const SenderAddress = z.string().min(3).max(320);
const RedemptionUrl = z.string().min(1).max(2048);

export const ArgumentRoomInviteEmailInputSchema = z.object({
  roomTitle: z.string().max(200),
  roomVisibility: z.enum(['public', 'private']),
  inviterDisplayName: z.string().max(80).nullish(),
  redemptionUrl: RedemptionUrl,
});

export const RenderedEmailSchema = z.object({
  subject: z.string().min(1).max(300),
  html: z.string().min(1),
  text: z.string().min(1),
});

export const SendTransactionalEmailInputSchema = z.object({
  to: Email,
  rendered: RenderedEmailSchema,
});

export const TransactionalEmailMessageSchema = z.object({
  to: Email,
  from: SenderAddress,
  replyTo: z.string().max(320).optional(),
  subject: z.string().min(1).max(300),
  html: z.string().min(1),
  text: z.string().min(1),
});

export type ArgumentRoomInviteEmailInputParsed = z.infer<typeof ArgumentRoomInviteEmailInputSchema>;
export type SendTransactionalEmailInputParsed = z.infer<typeof SendTransactionalEmailInputSchema>;
export type TransactionalEmailMessageParsed = z.infer<typeof TransactionalEmailMessageSchema>;
