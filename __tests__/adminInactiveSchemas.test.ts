/**
 * ADMIN-ARGS-INACTIVE-001 — schema tests.
 *
 * Schema tests mirror the structure of
 * supabase/functions/_shared/adminInactiveSchemas.ts.
 *
 * The Edge file uses Deno-style imports (`npm:zod@4`) and cannot be loaded
 * by Jest. We re-declare the schemas using the local zod (following the
 * adminSchemas.test.ts precedent) and assert the same behavior the Edge
 * Function relies on. If you change the Edge schemas, mirror the change
 * here.
 */
import { z } from 'zod';

// Mirrored constant — must match BULK_INACTIVE_ID_CAP in the Edge file.
const BULK_INACTIVE_ID_CAP = 100;

const InactiveReason = z.string().min(1).max(2000).optional();

const SetArgumentInactiveSchema = z.object({
  action: z.literal('set_argument_inactive'),
  argumentId: z.string().uuid(),
  inactive: z.boolean(),
  reason: InactiveReason,
});

const BulkSetArgumentInactiveSchema = z.object({
  action: z.literal('bulk_set_argument_inactive'),
  argumentIds: z.array(z.string().uuid()).min(1).max(BULK_INACTIVE_ID_CAP),
  inactive: z.boolean(),
  reason: InactiveReason,
});

// Real v4-shaped UUIDs (zod 4's `.uuid()` requires the version nibble
// in {1..8} and the variant nibble in {8,9,a,b}). Synthetic all-zeros
// would be rejected.
const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const ALT_UUID = '22222222-2222-4222-9222-222222222222';

function freshUuids(n: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const hex = i.toString(16).padStart(12, '0');
    // 8-4-4-4-12 with version 4 + variant 8.
    out.push(`33333333-3333-4333-8333-${hex}`);
  }
  return out;
}

describe('ADMIN-ARGS-INACTIVE-001 — bulk cap constant', () => {
  it('BULK_INACTIVE_ID_CAP equals 100 (matches deep design source acceptance)', () => {
    expect(BULK_INACTIVE_ID_CAP).toBe(100);
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — SetArgumentInactiveSchema', () => {
  it('accepts inactive=true with no reason', () => {
    const r = SetArgumentInactiveSchema.safeParse({
      action: 'set_argument_inactive',
      argumentId: VALID_UUID,
      inactive: true,
    });
    expect(r.success).toBe(true);
  });

  it('accepts inactive=false (Mark active path) with reason', () => {
    const r = SetArgumentInactiveSchema.safeParse({
      action: 'set_argument_inactive',
      argumentId: VALID_UUID,
      inactive: false,
      reason: 'admin note',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a missing inactive field', () => {
    const r = SetArgumentInactiveSchema.safeParse({
      action: 'set_argument_inactive',
      argumentId: VALID_UUID,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-uuid argumentId', () => {
    const r = SetArgumentInactiveSchema.safeParse({
      action: 'set_argument_inactive',
      argumentId: 'not-a-uuid',
      inactive: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty reason string', () => {
    const r = SetArgumentInactiveSchema.safeParse({
      action: 'set_argument_inactive',
      argumentId: VALID_UUID,
      inactive: true,
      reason: '',
    });
    expect(r.success).toBe(false);
  });

  it('rejects reason longer than 2000 characters', () => {
    const r = SetArgumentInactiveSchema.safeParse({
      action: 'set_argument_inactive',
      argumentId: VALID_UUID,
      inactive: true,
      reason: 'x'.repeat(2001),
    });
    expect(r.success).toBe(false);
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — BulkSetArgumentInactiveSchema', () => {
  it('accepts a single-id batch with no reason', () => {
    const r = BulkSetArgumentInactiveSchema.safeParse({
      action: 'bulk_set_argument_inactive',
      argumentIds: [VALID_UUID],
      inactive: true,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a batch of exactly 100 ids (the cap)', () => {
    const r = BulkSetArgumentInactiveSchema.safeParse({
      action: 'bulk_set_argument_inactive',
      argumentIds: freshUuids(BULK_INACTIVE_ID_CAP),
      inactive: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects an empty argumentIds array', () => {
    const r = BulkSetArgumentInactiveSchema.safeParse({
      action: 'bulk_set_argument_inactive',
      argumentIds: [],
      inactive: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a batch of 101 ids (one over the cap)', () => {
    const r = BulkSetArgumentInactiveSchema.safeParse({
      action: 'bulk_set_argument_inactive',
      argumentIds: freshUuids(BULK_INACTIVE_ID_CAP + 1),
      inactive: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a batch that contains a non-uuid id', () => {
    const r = BulkSetArgumentInactiveSchema.safeParse({
      action: 'bulk_set_argument_inactive',
      argumentIds: [VALID_UUID, 'not-a-uuid', ALT_UUID],
      inactive: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a missing inactive field', () => {
    const r = BulkSetArgumentInactiveSchema.safeParse({
      action: 'bulk_set_argument_inactive',
      argumentIds: [VALID_UUID],
    });
    expect(r.success).toBe(false);
  });
});
