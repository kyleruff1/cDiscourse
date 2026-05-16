/**
 * Schema tests mirror the structure of supabase/functions/_shared/adminSchemas.ts.
 * The function file itself uses Deno-style imports (`npm:zod@4`) and cannot be
 * loaded by Jest. We re-declare the schemas using the local zod and assert
 * the same behavior the Edge Function relies on.
 *
 * If you change the Edge Function schemas, mirror the change here.
 */
import { z } from 'zod';

const Role = z.enum(['user', 'moderator', 'admin']);

const ListUsers = z.object({
  action: z.literal('list_users'),
  search: z.string().max(200).optional(),
  role: Role.optional(),
  botOnly: z.boolean().optional(),
  page: z.number().int().min(1).max(1000).optional(),
  perPage: z.number().int().min(1).max(50).optional(),
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

const SoftDeleteUser = z.object({
  action: z.literal('soft_delete_user'),
  userId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  confirm: z.literal(true),
});

const AddBlock = z.object({
  action: z.literal('add_block'),
  blockType: z.enum(['email', 'email_domain', 'ip', 'ip_cidr', 'profile']),
  value: z.string().min(1).max(500),
  reason: z.string().min(1).max(500),
});

const Union = z.discriminatedUnion('action', [
  ListUsers,
  CreateUser,
  CreateBotUser,
  UpdateRole,
  SoftDeleteUser,
  AddBlock,
]);

const VALID_UUID = '4ba8e6c2-1d3e-4b8d-9c4a-1b2c3d4e5f6a';

describe('adminSchemas (mirror of Edge Function)', () => {
  describe('union dispatch', () => {
    it('rejects unknown action', () => {
      const r = Union.safeParse({ action: 'frob_widget' });
      expect(r.success).toBe(false);
    });

    it('accepts list_users with no options', () => {
      const r = Union.safeParse({ action: 'list_users' });
      expect(r.success).toBe(true);
    });
  });

  describe('update_role', () => {
    it('rejects missing reason', () => {
      const r = Union.safeParse({ action: 'update_role', userId: VALID_UUID, role: 'user' });
      expect(r.success).toBe(false);
    });

    it('rejects empty reason', () => {
      const r = Union.safeParse({ action: 'update_role', userId: VALID_UUID, role: 'user', reason: '' });
      expect(r.success).toBe(false);
    });

    it('accepts demote to user with reason', () => {
      const r = Union.safeParse({ action: 'update_role', userId: VALID_UUID, role: 'user', reason: 'demote' });
      expect(r.success).toBe(true);
    });

    it('rejects promote to admin without confirmAdminGrant', () => {
      const r = Union.safeParse({ action: 'update_role', userId: VALID_UUID, role: 'admin', reason: 'promote' });
      expect(r.success).toBe(false);
    });

    it('rejects promote to admin with confirmAdminGrant=false', () => {
      const r = Union.safeParse({
        action: 'update_role', userId: VALID_UUID, role: 'admin', reason: 'promote', confirmAdminGrant: false,
      });
      expect(r.success).toBe(false);
    });

    it('accepts promote to admin with confirmAdminGrant=true', () => {
      const r = Union.safeParse({
        action: 'update_role', userId: VALID_UUID, role: 'admin', reason: 'promote', confirmAdminGrant: true,
      });
      expect(r.success).toBe(true);
    });

    it('rejects invalid uuid', () => {
      const r = Union.safeParse({ action: 'update_role', userId: 'not-uuid', role: 'user', reason: 'x' });
      expect(r.success).toBe(false);
    });
  });

  describe('create_user', () => {
    it('accepts a basic user creation', () => {
      const r = Union.safeParse({ action: 'create_user', email: 'test@example.com' });
      expect(r.success).toBe(true);
    });

    it('rejects role=admin without confirmAdminCreate', () => {
      const r = Union.safeParse({ action: 'create_user', email: 'test@example.com', role: 'admin' });
      expect(r.success).toBe(false);
    });

    it('accepts role=admin with confirmAdminCreate=true', () => {
      const r = Union.safeParse({
        action: 'create_user', email: 'test@example.com', role: 'admin', confirmAdminCreate: true,
      });
      expect(r.success).toBe(true);
    });

    it('rejects short password', () => {
      const r = Union.safeParse({ action: 'create_user', email: 'a@b.co', password: 'short' });
      expect(r.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const r = Union.safeParse({ action: 'create_user', email: 'not-an-email' });
      expect(r.success).toBe(false);
    });
  });

  describe('create_bot_user', () => {
    it('requires label and email', () => {
      const r = Union.safeParse({ action: 'create_bot_user', email: 'bot@example.com' });
      expect(r.success).toBe(false);
    });

    it('accepts label+email', () => {
      const r = Union.safeParse({
        action: 'create_bot_user', label: 'Bot1', email: 'bot@example.com',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('soft_delete_user', () => {
    it('rejects without confirm=true', () => {
      const r = Union.safeParse({ action: 'soft_delete_user', userId: VALID_UUID, reason: 'x' });
      expect(r.success).toBe(false);
    });

    it('rejects confirm=false', () => {
      const r = Union.safeParse({ action: 'soft_delete_user', userId: VALID_UUID, reason: 'x', confirm: false });
      expect(r.success).toBe(false);
    });

    it('accepts confirm=true', () => {
      const r = Union.safeParse({ action: 'soft_delete_user', userId: VALID_UUID, reason: 'x', confirm: true });
      expect(r.success).toBe(true);
    });
  });

  describe('add_block', () => {
    it('rejects unknown block type', () => {
      const r = Union.safeParse({ action: 'add_block', blockType: 'phone', value: 'x', reason: 'x' });
      expect(r.success).toBe(false);
    });

    it('accepts email block', () => {
      const r = Union.safeParse({ action: 'add_block', blockType: 'email', value: 'x@y.com', reason: 'x' });
      expect(r.success).toBe(true);
    });

    it('accepts IP CIDR block', () => {
      const r = Union.safeParse({ action: 'add_block', blockType: 'ip_cidr', value: '10.0.0.0/8', reason: 'x' });
      expect(r.success).toBe(true);
    });

    it('rejects empty value', () => {
      const r = Union.safeParse({ action: 'add_block', blockType: 'email', value: '', reason: 'x' });
      expect(r.success).toBe(false);
    });
  });
});
