/**
 * QOL-038 — schema mirror tests for the manage-room-invite Edge Function.
 *
 * `supabase/functions/_shared/inviteSchemas.ts` uses Deno's
 * `npm:zod@4` import and cannot be loaded by Jest. We re-declare the
 * five action schemas locally using the Node-installed `zod` and assert
 * the same behaviour the Edge Function relies on. If you change the
 * Edge Function schemas, mirror the change here.
 *
 * The mirror also asserts the token shape (length + regex) is
 * byte-identical to the client's `isValidInviteTokenShape` — a token
 * that passes the client gate must also pass the server gate.
 */
import { z } from 'zod';
import {
  INVITE_TOKEN_MAX_LENGTH,
  INVITE_TOKEN_MIN_LENGTH,
  isValidInviteTokenShape,
} from '../src/features/invites/inviteDeepLink';

// ── Mirrored schemas ──────────────────────────────────────────

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

// EMAIL-TRANSPORT-002 (Option B) — mirror of the new provision_and_accept
// action. If you change the Edge Function schema, mirror the change here.
const Password = z.string().min(6).max(128);

const ProvisionAndAccept = z.object({
  action: z.literal('provision_and_accept'),
  token: Token,
  email: Email,
  password: Password,
});

const ManageRoomInviteRequestSchema = z.discriminatedUnion('action', [
  CreateInvite,
  RevokeInvite,
  ListForDebate,
  LookupByToken,
  AcceptInvite,
  ProvisionAndAccept,
]);

const VALID_TOKEN = 'aB12345678901234567890123456789012345678901';
// Real UUID v4 — Zod's `.uuid()` validator checks the version + variant
// nibbles, so a literal '11111111-...' fails. This is a deterministic
// random v4.
const UUID = '12345678-1234-4123-8123-1234567890ab';

describe('manage-room-invite — create schema', () => {
  it('accepts a well-formed body and defaults intendedSeat to respondent', () => {
    const parsed = ManageRoomInviteRequestSchema.parse({
      action: 'create',
      debateId: UUID,
      inviteeEmail: 'alice@example.com',
    });
    expect(parsed).toEqual({
      action: 'create',
      debateId: UUID,
      inviteeEmail: 'alice@example.com',
      intendedSeat: 'respondent',
    });
  });

  it('accepts an explicit intendedSeat: co_primary', () => {
    const parsed = ManageRoomInviteRequestSchema.parse({
      action: 'create',
      debateId: UUID,
      inviteeEmail: 'alice@example.com',
      intendedSeat: 'co_primary',
    });
    // Narrow the discriminated union before reading the action-specific
    // field.
    if (parsed.action !== 'create') throw new Error('schema parsed wrong action');
    expect(parsed.intendedSeat).toBe('co_primary');
  });

  it('rejects an invalid email', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'create',
        debateId: UUID,
        inviteeEmail: 'not-an-email',
      }),
    ).toThrow();
  });

  it('rejects an intendedSeat outside the enum', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'create',
        debateId: UUID,
        inviteeEmail: 'alice@example.com',
        intendedSeat: 'challenger',
      }),
    ).toThrow();
  });

  it('rejects a non-uuid debateId', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'create',
        debateId: 'not-a-uuid',
        inviteeEmail: 'alice@example.com',
      }),
    ).toThrow();
  });
});

describe('manage-room-invite — revoke schema', () => {
  it('accepts a uuid inviteId', () => {
    expect(
      ManageRoomInviteRequestSchema.parse({ action: 'revoke', inviteId: UUID }),
    ).toEqual({ action: 'revoke', inviteId: UUID });
  });

  it('rejects a non-uuid inviteId', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({ action: 'revoke', inviteId: 'bad' }),
    ).toThrow();
  });
});

describe('manage-room-invite — list_for_debate schema', () => {
  it('accepts a uuid debateId', () => {
    expect(
      ManageRoomInviteRequestSchema.parse({ action: 'list_for_debate', debateId: UUID }),
    ).toEqual({ action: 'list_for_debate', debateId: UUID });
  });
});

describe('manage-room-invite — lookup_by_token schema', () => {
  it('accepts a valid token shape', () => {
    expect(
      ManageRoomInviteRequestSchema.parse({ action: 'lookup_by_token', token: VALID_TOKEN }),
    ).toEqual({ action: 'lookup_by_token', token: VALID_TOKEN });
  });

  it('rejects a too-short token', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({ action: 'lookup_by_token', token: 'short' }),
    ).toThrow();
  });

  it('rejects a token with forbidden characters', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'lookup_by_token',
        token: 'aB1+345678901234567890123456789012345678901',
      }),
    ).toThrow();
  });
});

describe('manage-room-invite — accept schema', () => {
  it('accepts a valid token shape', () => {
    expect(
      ManageRoomInviteRequestSchema.parse({ action: 'accept', token: VALID_TOKEN }),
    ).toEqual({ action: 'accept', token: VALID_TOKEN });
  });

  it('rejects a too-long token', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'accept',
        token: 'A'.repeat(INVITE_TOKEN_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });
});

describe('manage-room-invite — provision_and_accept schema (EMAIL-TRANSPORT-002)', () => {
  it('accepts a valid token + email + password', () => {
    const parsed = ManageRoomInviteRequestSchema.parse({
      action: 'provision_and_accept',
      token: VALID_TOKEN,
      email: 'alice@example.com',
      password: 'secret123',
    });
    expect(parsed).toEqual({
      action: 'provision_and_accept',
      token: VALID_TOKEN,
      email: 'alice@example.com',
      password: 'secret123',
    });
  });

  it('rejects a too-short password (< 6)', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'provision_and_accept',
        token: VALID_TOKEN,
        email: 'alice@example.com',
        password: 'short',
      }),
    ).toThrow();
  });

  it('rejects an over-long password (> 128)', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'provision_and_accept',
        token: VALID_TOKEN,
        email: 'alice@example.com',
        password: 'a'.repeat(129),
      }),
    ).toThrow();
  });

  it('rejects an invalid email', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'provision_and_accept',
        token: VALID_TOKEN,
        email: 'not-an-email',
        password: 'secret123',
      }),
    ).toThrow();
  });

  it('rejects a malformed token', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'provision_and_accept',
        token: 'short',
        email: 'alice@example.com',
        password: 'secret123',
      }),
    ).toThrow();
  });

  it('rejects a missing password', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({
        action: 'provision_and_accept',
        token: VALID_TOKEN,
        email: 'alice@example.com',
      }),
    ).toThrow();
  });
});

describe('manage-room-invite — discriminated union', () => {
  it('rejects an unknown action', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({ action: 'delete', token: VALID_TOKEN }),
    ).toThrow();
  });

  it('rejects a body with no action', () => {
    expect(() =>
      ManageRoomInviteRequestSchema.parse({ inviteeEmail: 'a@b.com' }),
    ).toThrow();
  });
});

// ── Client / server shape-alignment ────────────────────────────

describe('client / server token shape parity', () => {
  it('the server schema and the client predicate agree on a valid token', () => {
    const ok = ManageRoomInviteRequestSchema.safeParse({
      action: 'lookup_by_token',
      token: VALID_TOKEN,
    });
    expect(ok.success).toBe(true);
    expect(isValidInviteTokenShape(VALID_TOKEN)).toBe(true);
  });

  it('the server schema and the client predicate agree on rejection', () => {
    const bad = 'too-short';
    const serverRes = ManageRoomInviteRequestSchema.safeParse({
      action: 'lookup_by_token',
      token: bad,
    });
    expect(serverRes.success).toBe(false);
    expect(isValidInviteTokenShape(bad)).toBe(false);
  });

  it('both sides use the same length window', () => {
    expect(INVITE_TOKEN_MIN_LENGTH).toBe(32);
    expect(INVITE_TOKEN_MAX_LENGTH).toBe(64);
  });
});
