/**
 * QOL-038 — Zod schemas for the manage-room-invite Edge Function.
 *
 * Mirrors the adminSchemas pattern. Each action's body is its own zod
 * object; a discriminated union on `action` is the request schema. The
 * mirrored, dependency-free `inviteSchemasMirror` in
 * `src/features/invites/inviteSchemasMirror.ts` is what `__tests__/`
 * imports — the Deno-only `npm:zod@4` import here cannot load in Jest.
 */
import { z } from 'npm:zod@4';
import { INVITE_TOKEN_MAX_LENGTH, INVITE_TOKEN_MIN_LENGTH } from './inviteTokenShape.ts';

const Token = z
  .string()
  .min(INVITE_TOKEN_MIN_LENGTH)
  .max(INVITE_TOKEN_MAX_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/);

const Email = z.string().email().max(320);

const Uuid = z.string().uuid();

const IntendedSeat = z.enum(['respondent', 'co_primary']);

const CreateInvite = z.object({
  action: z.literal('create'),
  debateId: Uuid,
  inviteeEmail: Email,
  intendedSeat: IntendedSeat.default('respondent'),
});

const RevokeInvite = z.object({
  action: z.literal('revoke'),
  inviteId: Uuid,
});

const ListForDebate = z.object({
  action: z.literal('list_for_debate'),
  debateId: Uuid,
});

const LookupByToken = z.object({
  action: z.literal('lookup_by_token'),
  token: Token,
});

const AcceptInvite = z.object({
  action: z.literal('accept'),
  token: Token,
});

export const ManageRoomInviteRequestSchema = z.discriminatedUnion('action', [
  CreateInvite,
  RevokeInvite,
  ListForDebate,
  LookupByToken,
  AcceptInvite,
]);

export type ManageRoomInviteRequest = z.infer<typeof ManageRoomInviteRequestSchema>;
export type ManageRoomInviteAction = ManageRoomInviteRequest['action'];
