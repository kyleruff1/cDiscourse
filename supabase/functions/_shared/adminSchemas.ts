/**
 * Zod schemas for admin-users Edge Function.
 *
 * Each schema validates the body of a specific action. Unknown actions
 * are rejected by the discriminated union in AdminUsersRequestSchema.
 */
import { z } from 'npm:zod@4';
import {
  GetSemanticConfigSchema,
  SetSemanticConfigSchema,
} from './adminSemanticConfigSchemas.ts';

const Role = z.enum(['user', 'moderator', 'admin']);

const PaginatedQuery = z.object({
  page: z.number().int().min(1).max(1000).optional(),
  perPage: z.number().int().min(1).max(50).optional(),
});

const ListUsers = z.object({
  action: z.literal('list_users'),
  search: z.string().max(200).optional(),
  role: Role.optional(),
  botOnly: z.boolean().optional(),
  page: PaginatedQuery.shape.page,
  perPage: PaginatedQuery.shape.perPage,
});

const GetUserDetail = z.object({
  action: z.literal('get_user_detail'),
  userId: z.string().uuid(),
});

const CreateUser = z.object({
  action: z.literal('create_user'),
  email: z.string().email().max(320),
  password: z.string().min(8).max(200).optional(),
  displayName: z.string().min(1).max(120).optional(),
  role: Role.default('user'),
  isBot: z.boolean().default(false),
  persona: z.string().max(200).optional(),
  emailConfirm: z.boolean().default(true),
  confirmAdminCreate: z.boolean().optional(),
}).refine(
  (data) => data.role !== 'admin' || data.confirmAdminCreate === true,
  { message: 'confirmAdminCreate=true required to create an admin', path: ['confirmAdminCreate'] },
);

const CreateBotUser = z.object({
  action: z.literal('create_bot_user'),
  label: z.string().min(1).max(120),
  email: z.string().email().max(320),
  password: z.string().min(8).max(200).optional(),
  persona: z.string().max(200).optional(),
  displayName: z.string().min(1).max(120).optional(),
  enabled: z.boolean().default(true),
});

const UpdateRole = z.object({
  action: z.literal('update_role'),
  userId: z.string().uuid(),
  role: Role,
  reason: z.string().min(1).max(500),
  confirmAdminGrant: z.boolean().optional(),
}).refine(
  (data) => data.role !== 'admin' || data.confirmAdminGrant === true,
  { message: 'confirmAdminGrant=true required to promote to admin', path: ['confirmAdminGrant'] },
);

const InviteUser = z.object({
  action: z.literal('invite_user'),
  email: z.string().email().max(320),
  displayName: z.string().min(1).max(120).optional(),
  // 'admin' is intentionally NOT allowed — an unauthenticated invite link must
  // never be able to mint an admin. Admin promotion stays with update_role +
  // confirmAdminGrant. See QOL-024 design § "Role restriction".
  role: z.enum(['user', 'moderator']).default('user'),
  redirectTo: z.string().url().max(500).optional(),
});

const SendPasswordReset = z.object({
  action: z.literal('send_password_reset'),
  userId: z.string().uuid().optional(),
  email: z.string().email().max(320).optional(),
  redirectTo: z.string().url().max(500).optional(),
}).refine(
  (data) => data.userId !== undefined || data.email !== undefined,
  { message: 'userId or email required', path: ['userId'] },
);

const SetTemporaryPassword = z.object({
  action: z.literal('set_temporary_password'),
  userId: z.string().uuid(),
  temporaryPassword: z.string().min(8).max(200),
  reason: z.string().min(1).max(500),
  botOnly: z.boolean().default(true),
});

const DisableUser = z.object({
  action: z.literal('disable_user'),
  userId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  until: z.string().datetime().optional(),
});

const EnableUser = z.object({
  action: z.literal('enable_user'),
  userId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const SoftDeleteUser = z.object({
  action: z.literal('soft_delete_user'),
  userId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  confirm: z.literal(true),
});

const ListBlocks = z.object({
  action: z.literal('list_blocks'),
  active: z.boolean().optional(),
});

const AddBlock = z.object({
  action: z.literal('add_block'),
  blockType: z.enum(['email', 'email_domain', 'ip', 'ip_cidr', 'profile']),
  value: z.string().min(1).max(500),
  reason: z.string().min(1).max(500),
});

const RemoveBlock = z.object({
  action: z.literal('remove_block'),
  blockRuleId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const ViewAsSnapshot = z.object({
  action: z.literal('view_as_snapshot'),
  targetUserId: z.string().uuid(),
  context: z.object({
    roomId: z.string().uuid().optional(),
    includeRecentArguments: z.boolean().default(true),
    includeRooms: z.boolean().default(true),
    includeBotRegistry: z.boolean().default(true),
  }).optional(),
});

export const AdminUsersRequestSchema = z.discriminatedUnion('action', [
  ListUsers,
  GetUserDetail,
  CreateUser,
  CreateBotUser,
  UpdateRole,
  InviteUser,
  SendPasswordReset,
  SetTemporaryPassword,
  DisableUser,
  EnableUser,
  SoftDeleteUser,
  ListBlocks,
  AddBlock,
  RemoveBlock,
  ViewAsSnapshot,
  // ADMIN-AI-001 — semantic-referee runtime provider-mode config.
  GetSemanticConfigSchema,
  SetSemanticConfigSchema,
]);

export type AdminUsersRequest = z.infer<typeof AdminUsersRequestSchema>;
export type AdminUsersAction = AdminUsersRequest['action'];

// ── Normalization helpers ─────────────────────────────────────

export function normalizeBlockValue(blockType: string, value: string): string {
  const trimmed = value.trim();
  if (blockType === 'email' || blockType === 'email_domain') {
    return trimmed.toLowerCase();
  }
  if (blockType === 'ip' || blockType === 'ip_cidr') {
    return trimmed;
  }
  return trimmed;
}
