/**
 * ADMIN-CONV-INACTIVE-001 — §10a POISONED-FIXTURE for the room-header path.
 *
 * The room-group header derives the DEBATE-level (whole conversation) inactive
 * badge from the parent debate's `inactive_at` ONLY. The leak vector is the
 * debate's `inactive_reason`. This test feeds the loader a raw `arguments` row
 * whose embedded `debates` relation carries a poisoned `inactive_reason` and
 * asserts:
 *
 *   1. the loader maps `debateInactiveAt` from `debates.inactive_at` (WHAT);
 *   2. the loader NEVER threads any debate reason onto the AdminArgumentRow;
 *   3. the full pure pipeline (loader → groupArgumentsIntoArtifacts →
 *      groupArtifactsByRoom) surfaces `isDebateInactive` from the timestamp
 *      ONLY and never carries the poison anywhere in the produced structure.
 *
 * The supabase client is mocked so the loader runs without a live DB; the
 * mocked query resolves to the poisoned raw row.
 */

// The poisoned reason on the embedded debate. Defined inside the factory below
// (jest hoists jest.mock above imports); duplicated as a const here for the
// assertions.
const DEBATE_REASON_CANARY = 'debate-leak-canary-REASON';
const DEBATE_INACTIVE_AT = '2026-06-05T00:00:00.000Z';

jest.mock('../src/lib/supabase', () => {
  // A chainable thenable mimicking the PostgREST query builder. Every chained
  // method returns the same object; awaiting it resolves to the poisoned data.
  const poisonedRow = {
    id: 'arg-1',
    debate_id: 'room-1',
    author_id: 'u-1',
    argument_type: 'claim',
    side: 'affirmative',
    body: 'A neutral on-topic claim body.',
    status: 'posted',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
    disagreement_axis: null,
    argument_tags: null,
    target_excerpt: null,
    server_validation: null,
    // The per-ARGUMENT inactive columns (the #480 card) — active here.
    inactive_at: null,
    inactive_by: null,
    inactive_reason: null,
    // The embedded DEBATE relation carries the DEBATE-level inactive_at PLUS a
    // poisoned inactive_reason. The loader must surface inactive_at and DROP
    // the reason entirely (it should never even SELECT it, but a defensive
    // fixture proves the mapper never reads it either).
    debates: {
      title: 'A neutral room title',
      inactive_at: '2026-06-05T00:00:00.000Z',
      inactive_reason: 'debate-leak-canary-REASON',
      inactive_by: 'admin-9',
    },
    profiles: { display_name: 'Alice' },
  };
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'eq', 'neq', 'is']) {
    builder[m] = jest.fn(() => builder);
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: [poisonedRow], error: null });
  return {
    supabase: { from: jest.fn(() => builder) },
    SUPABASE_CONFIGURED: true,
  };
});

import { loadAdminArguments } from '../src/features/admin/adminArgumentsApi';
import { groupArgumentsIntoArtifacts } from '../src/features/arguments/argumentArtifactModel';
import { groupArtifactsByRoom } from '../src/features/admin/adminArgumentsRoomGroupingModel';

describe('ADMIN-CONV-INACTIVE-001 — loader maps DEBATE-level inactive_at, drops the reason', () => {
  it('threads debateInactiveAt from debates.inactive_at (WHAT)', async () => {
    const rows = await loadAdminArguments();
    expect(rows).toHaveLength(1);
    expect(rows[0].debateInactiveAt).toBe(DEBATE_INACTIVE_AT);
  });

  it('never threads the debate reason onto the AdminArgumentRow (never WHY)', async () => {
    const rows = await loadAdminArguments();
    const serialized = JSON.stringify(rows[0]);
    expect(serialized).not.toContain(DEBATE_REASON_CANARY);
    // No debate reason / inactivator key is present on the mapped row.
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'debateInactiveReason')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'debateInactiveBy')).toBe(false);
  });
});

describe('ADMIN-CONV-INACTIVE-001 — full pipeline surfaces isDebateInactive without the reason', () => {
  it('produces an inactive-conversation room group whose fields never carry the poison', async () => {
    const rows = await loadAdminArguments();
    const artifacts = groupArgumentsIntoArtifacts(
      rows.map((r) => ({
        id: r.id,
        debateId: r.debateId,
        debateTitle: r.debateTitle,
        authorId: r.authorId,
        body: r.body,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        inactiveAt: r.inactiveAt,
        debateInactiveAt: r.debateInactiveAt,
        selectedTagCodes: r.selectedTagCodes,
      })),
    );
    const groups = groupArtifactsByRoom(artifacts);
    expect(groups).toHaveLength(1);

    // The badge state is derived from inactive_at ONLY.
    expect(groups[0].isDebateInactive).toBe(true);
    expect(groups[0].debateInactiveAt).toBe(DEBATE_INACTIVE_AT);

    // The poison never appears anywhere in the produced structure.
    const blob = JSON.stringify(groups);
    expect(blob).not.toContain(DEBATE_REASON_CANARY);
    expect(blob).not.toContain('inactiveReason');
    expect(blob).not.toContain('inactive_reason');
  });
});
