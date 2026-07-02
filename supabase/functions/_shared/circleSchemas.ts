/**
 * PRIVATE-GROUPS-002 (#859) — Zod schemas for the manage-circle and
 * manage-circle-invite Edge Functions.
 *
 * Mirrors the inviteSchemas.ts pattern. Each action's body is its own zod
 * object; a discriminated union on `action` is the request schema. Deno-only
 * (`npm:zod@4`) — the __tests__ scan the source text, they do not import this.
 */
import { z } from 'npm:zod@4';
import { INVITE_TOKEN_MAX_LENGTH, INVITE_TOKEN_MIN_LENGTH } from './inviteTokenShape.ts';

const Uuid = z.string().uuid();
const Email = z.string().email().max(320);

const Token = z
  .string()
  .min(INVITE_TOKEN_MIN_LENGTH)
  .max(INVITE_TOKEN_MAX_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/);

// Password mirrors the manage-room-invite Password (client validateNewPassword
// + DB minimum_password_length = 6; Supabase Auth caps bcrypt at 72 bytes).
const Password = z.string().min(6).max(128);

// Circle name + description mirror the DB checks (name 1..80; description free).
const CircleName = z.string().trim().min(1).max(80);
const CircleDescription = z.string().max(2000).optional();

// ── manage-circle ──────────────────────────────────────────────

const CreateCircle = z.object({
  action: z.literal('create'),
  name: CircleName,
  description: CircleDescription,
});

const RenameCircle = z.object({
  action: z.literal('rename'),
  circleId: Uuid,
  name: CircleName,
  description: CircleDescription,
});

const SoftDeleteCircle = z.object({
  action: z.literal('soft_delete'),
  circleId: Uuid,
});

const TransferOwnership = z.object({
  action: z.literal('transfer_ownership'),
  circleId: Uuid,
  newOwnerUserId: Uuid,
});

const RemoveMember = z.object({
  action: z.literal('remove_member'),
  circleId: Uuid,
  memberUserId: Uuid,
});

const ListMine = z.object({
  action: z.literal('list_mine'),
});

export const ManageCircleRequestSchema = z.discriminatedUnion('action', [
  CreateCircle,
  RenameCircle,
  SoftDeleteCircle,
  TransferOwnership,
  RemoveMember,
  ListMine,
]);

export type ManageCircleRequest = z.infer<typeof ManageCircleRequestSchema>;
export type ManageCircleAction = ManageCircleRequest['action'];

// ── manage-circle-invite ───────────────────────────────────────

const CreateCircleInvite = z.object({
  action: z.literal('create'),
  circleId: Uuid,
  inviteeEmail: Email,
});

const RevokeCircleInvite = z.object({
  action: z.literal('revoke'),
  inviteId: Uuid,
});

const ListForCircle = z.object({
  action: z.literal('list_for_circle'),
  circleId: Uuid,
});

const LookupByToken = z.object({
  action: z.literal('lookup_by_token'),
  token: Token,
});

const AcceptCircleInvite = z.object({
  action: z.literal('accept'),
  token: Token,
});

const ProvisionAndAccept = z.object({
  action: z.literal('provision_and_accept'),
  token: Token,
  email: Email,
  password: Password,
});

export const ManageCircleInviteRequestSchema = z.discriminatedUnion('action', [
  CreateCircleInvite,
  RevokeCircleInvite,
  ListForCircle,
  LookupByToken,
  AcceptCircleInvite,
  ProvisionAndAccept,
]);

export type ManageCircleInviteRequest = z.infer<typeof ManageCircleInviteRequestSchema>;
export type ManageCircleInviteAction = ManageCircleInviteRequest['action'];
