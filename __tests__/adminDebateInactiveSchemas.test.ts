/**
 * ADMIN-CONV-INACTIVE-001 — schema tests.
 *
 * Schema tests mirror the structure of
 * supabase/functions/_shared/adminDebateInactiveSchemas.ts.
 *
 * The Edge file uses Deno-style imports (`npm:zod@4`) and cannot be loaded by
 * Jest. We re-declare the schemas using the local zod (following the
 * adminInactiveSchemas.test.ts precedent) and assert the same behaviour the
 * Edge Function relies on. If you change the Edge schemas, mirror the change
 * here.
 */
import { z } from 'zod';

// Mirrored constant — must match BULK_DEBATE_INACTIVE_ID_CAP in the Edge file.
const BULK_DEBATE_INACTIVE_ID_CAP = 100;

const InactiveReason = z.string().min(1).max(2000).optional();

const SetDebateInactiveSchema = z.object({
  action: z.literal('set_debate_inactive'),
  debateId: z.string().uuid(),
  inactive: z.boolean(),
  reason: InactiveReason,
});

const BulkSetDebateInactiveSchema = z.object({
  action: z.literal('bulk_set_debate_inactive'),
  debateIds: z.array(z.string().uuid()).min(1).max(BULK_DEBATE_INACTIVE_ID_CAP),
  inactive: z.boolean(),
  reason: InactiveReason,
});

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const ALT_UUID = '22222222-2222-4222-9222-222222222222';

function freshUuids(n: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const hex = i.toString(16).padStart(12, '0');
    out.push(`33333333-3333-4333-8333-${hex}`);
  }
  return out;
}

describe('ADMIN-CONV-INACTIVE-001 — bulk cap constant', () => {
  it('BULK_DEBATE_INACTIVE_ID_CAP equals 100', () => {
    expect(BULK_DEBATE_INACTIVE_ID_CAP).toBe(100);
  });
});

describe('ADMIN-CONV-INACTIVE-001 — SetDebateInactiveSchema', () => {
  it('accepts inactive=true with no reason', () => {
    const r = SetDebateInactiveSchema.safeParse({
      action: 'set_debate_inactive',
      debateId: VALID_UUID,
      inactive: true,
    });
    expect(r.success).toBe(true);
  });

  it('accepts inactive=false (Mark active path) with reason', () => {
    const r = SetDebateInactiveSchema.safeParse({
      action: 'set_debate_inactive',
      debateId: VALID_UUID,
      inactive: false,
      reason: 'admin note',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a missing inactive field', () => {
    const r = SetDebateInactiveSchema.safeParse({
      action: 'set_debate_inactive',
      debateId: VALID_UUID,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-uuid debateId', () => {
    const r = SetDebateInactiveSchema.safeParse({
      action: 'set_debate_inactive',
      debateId: 'not-a-uuid',
      inactive: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty reason string', () => {
    const r = SetDebateInactiveSchema.safeParse({
      action: 'set_debate_inactive',
      debateId: VALID_UUID,
      inactive: true,
      reason: '',
    });
    expect(r.success).toBe(false);
  });

  it('rejects reason longer than 2000 characters', () => {
    const r = SetDebateInactiveSchema.safeParse({
      action: 'set_debate_inactive',
      debateId: VALID_UUID,
      inactive: true,
      reason: 'x'.repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it('accepts a reason of exactly 2000 characters', () => {
    const r = SetDebateInactiveSchema.safeParse({
      action: 'set_debate_inactive',
      debateId: VALID_UUID,
      inactive: true,
      reason: 'x'.repeat(2000),
    });
    expect(r.success).toBe(true);
  });
});

describe('ADMIN-CONV-INACTIVE-001 — BulkSetDebateInactiveSchema', () => {
  it('accepts a single-id batch with no reason', () => {
    const r = BulkSetDebateInactiveSchema.safeParse({
      action: 'bulk_set_debate_inactive',
      debateIds: [VALID_UUID],
      inactive: true,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a batch of exactly 100 ids (the cap)', () => {
    const r = BulkSetDebateInactiveSchema.safeParse({
      action: 'bulk_set_debate_inactive',
      debateIds: freshUuids(BULK_DEBATE_INACTIVE_ID_CAP),
      inactive: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects an empty debateIds array', () => {
    const r = BulkSetDebateInactiveSchema.safeParse({
      action: 'bulk_set_debate_inactive',
      debateIds: [],
      inactive: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a batch of 101 ids (one over the cap)', () => {
    const r = BulkSetDebateInactiveSchema.safeParse({
      action: 'bulk_set_debate_inactive',
      debateIds: freshUuids(BULK_DEBATE_INACTIVE_ID_CAP + 1),
      inactive: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a batch that contains a non-uuid id', () => {
    const r = BulkSetDebateInactiveSchema.safeParse({
      action: 'bulk_set_debate_inactive',
      debateIds: [VALID_UUID, 'not-a-uuid', ALT_UUID],
      inactive: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a missing inactive field', () => {
    const r = BulkSetDebateInactiveSchema.safeParse({
      action: 'bulk_set_debate_inactive',
      debateIds: [VALID_UUID],
    });
    expect(r.success).toBe(false);
  });
});
