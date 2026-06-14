/**
 * EMAIL-TRANSPORT-001 — Zod schemas for the shared email module's inputs
 * (Lane B / product email).
 *
 * Mirrors the `inviteSchemas.ts` pattern: the Deno-only `npm:zod@4` import here
 * cannot load in Jest, so a dependency-free, IMPORTABLE twin lives in
 * `src/features/email/emailSchemasMirror.ts` (an improvement over the prior
 * inline re-declaration pattern). The `emailSchemasMirror.test.ts` asserts the
 * two are byte-equal on field/regex contract.
 *
 * No schema carries a secret. The `to`/`from`/`replyTo` are validated email
 * shapes; the redemption URL is a bounded string (the token lives inside it,
 * never as a standalone field).
 */
import { z } from 'npm:zod@4';

const Email = z.string().email().max(320);
/** Sender shape: a display-name-and-angle-bracket form OR a bare address. */
const SenderAddress = z.string().min(3).max(320);
/** Bounded redemption URL (origin + /invite/<token>). */
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
