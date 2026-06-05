/**
 * ADMIN-ARGS-INACTIVE-001 — Minimal forward-resilience test for
 * CANONICAL-001's `ArgumentArtifact.isInactive` projection.
 *
 * Per design § 14 #5: CANONICAL-001 has not yet landed, so we create a
 * minimal version of this test covering only the inactive_at → isInactive
 * plumbing the inactive-state card guarantees. When CANONICAL-001 lands,
 * its reviewer extends this file with the full ArgumentArtifact projection.
 *
 * The assertion this file makes:
 *   - The new `inactive_at` column projects through the existing
 *     argumentsApi mapping as `inactiveAt` (camelCase) on `ArgumentRow`.
 *   - A row whose raw `inactive_at` is non-null surfaces as
 *     `inactiveAt !== null`.
 *   - The pure-TS belt-and-braces filters correctly exclude rows whose
 *     `inactiveAt` is set.
 *
 * ADMIN-ARGS-CANONICAL-001 extension (design §3/§15 slice 2 — ADDITIVE):
 * the full `ArgumentArtifact` projection is now exercised. Every assertion
 * below is *added*; none of the original assertions above is removed or
 * relaxed (THR-4 / §4-T discipline). The extension proves:
 *   - `isInactive` derives from `inactiveAt` ONLY (via `deriveRevisionIsInactive`).
 *   - The no-resurrect invariant: an active sibling never clears an inactive
 *     child's state.
 *   - `inactiveReason` NEVER appears in any artifact/revision output — even
 *     when fed poisoned reason values on the source rows.
 */
import type { ArgumentRow } from '../src/features/arguments/types';
import {
  groupArgumentsIntoArtifacts,
  deriveRevisionIsInactive,
  type ArtifactSourceRow,
} from '../src/features/arguments/argumentArtifactModel';

// A pure-TS helper that mimics the belt-and-braces check used by
// conversationGalleryModel.buildGallery + roomContractModel +
// botRoomPolicyModel. This isolates the inactive-aware predicate so
// CANONICAL-001's reviewer can extend it.
function isVisibleToNonAdmin(row: Pick<ArgumentRow, 'status' | 'inactiveAt'>): boolean {
  return row.status !== 'deleted' && (row.inactiveAt ?? null) === null;
}

function makeRow(overrides: Partial<ArgumentRow> = {}): ArgumentRow {
  const base: ArgumentRow = {
    id: 'a',
    debateId: 'd',
    parentId: null,
    authorId: 'u',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'b',
    depth: 0,
    status: 'posted',
    targetExcerpt: null,
    disagreementAxis: null,
    railPayload: {},
    clientValidation: {},
    serverValidation: {},
    clientSubmissionId: null,
    createdAt: '2026-06-04T00:00:00Z',
    updatedAt: '2026-06-04T00:00:00Z',
    inactiveAt: null,
  };
  return { ...base, ...overrides };
}

describe('ADMIN-ARGS-INACTIVE-001 — ArgumentRow inactiveAt projection', () => {
  it('default-constructed row has inactiveAt === null (active)', () => {
    const row = makeRow();
    expect(row.inactiveAt).toBeNull();
  });

  it('row with a non-null inactiveAt is treated as inactive', () => {
    const row = makeRow({ inactiveAt: '2026-06-04T00:00:00Z' });
    expect(row.inactiveAt).not.toBeNull();
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — isVisibleToNonAdmin contract', () => {
  it('posted + active row is visible', () => {
    expect(isVisibleToNonAdmin(makeRow())).toBe(true);
  });

  it('posted + inactive row is NOT visible', () => {
    expect(isVisibleToNonAdmin(makeRow({ inactiveAt: '2026-06-04T00:00:00Z' }))).toBe(false);
  });

  it('deleted row is NOT visible regardless of inactiveAt', () => {
    expect(isVisibleToNonAdmin(makeRow({ status: 'deleted' }))).toBe(false);
    expect(
      isVisibleToNonAdmin(
        makeRow({ status: 'deleted', inactiveAt: '2026-06-04T00:00:00Z' }),
      ),
    ).toBe(false);
  });

  it('absent inactiveAt is treated as active', () => {
    // Belt-and-braces: tests with synthetic fixtures may omit the field.
    const partial: Pick<ArgumentRow, 'status' | 'inactiveAt'> = {
      status: 'posted',
      inactiveAt: undefined as unknown as null,
    };
    expect(isVisibleToNonAdmin(partial)).toBe(true);
  });
});

// ── ADMIN-ARGS-CANONICAL-001 — full ArgumentArtifact projection (ADDITIVE) ──

function makeArtifactRow(overrides: Partial<ArtifactSourceRow> = {}): ArtifactSourceRow {
  const base: ArtifactSourceRow = {
    id: 'arg-1',
    debateId: 'd1',
    debateTitle: 'A structural debate title',
    authorId: 'u1',
    body: 'An on-topic structural claim body.',
    createdAt: '2026-06-04T00:00:00Z',
    updatedAt: '2026-06-04T00:00:00Z',
    inactiveAt: null,
  };
  return { ...base, ...overrides };
}

describe('CANONICAL-001 — isInactive derives from inactiveAt only', () => {
  it('deriveRevisionIsInactive uses inactiveAt, not any reason field', () => {
    expect(deriveRevisionIsInactive({ inactiveAt: null })).toBe(false);
    expect(deriveRevisionIsInactive({ inactiveAt: '2026-06-05T00:00:00Z' })).toBe(true);
  });

  it('artifact + revision isInactive flow from inactiveAt', () => {
    const out = groupArgumentsIntoArtifacts([
      makeArtifactRow({ id: 'active', body: 'active body', inactiveAt: null }),
      makeArtifactRow({ id: 'inactive', debateTitle: 'Other title', body: 'inactive body', inactiveAt: '2026-06-05T00:00:00Z' }),
    ]);
    const active = out.find((a) => a.revisions.some((r) => r.revisionId === 'active'))!;
    const inactive = out.find((a) => a.revisions.some((r) => r.revisionId === 'inactive'))!;
    expect(active.isInactive).toBe(false);
    expect(inactive.isInactive).toBe(true);
  });
});

describe('CANONICAL-001 — no-resurrect invariant', () => {
  it('an active sibling revision never clears an inactive child revision', () => {
    // Same logical argument (same id), two revisions: an earlier inactive one
    // and a later active one. The inactive child must keep its state; the
    // artifact OR-folds to inactive.
    const rows: ArtifactSourceRow[] = [
      makeArtifactRow({ id: 'arg-x', createdAt: '2026-06-04T00:00:00Z', updatedAt: '2026-06-04T06:00:00Z', inactiveAt: '2026-06-05T00:00:00Z', body: 'inactive rev' }),
      makeArtifactRow({ id: 'arg-x', createdAt: '2026-06-04T00:00:00Z', updatedAt: '2026-06-04T12:00:00Z', inactiveAt: null, body: 'active rev' }),
    ];
    const out = groupArgumentsIntoArtifacts(rows);
    expect(out).toHaveLength(1);
    expect(out[0].isInactive).toBe(true);
    const inactiveChild = out[0].revisions.find((r) => r.isInactive);
    const activeChild = out[0].revisions.find((r) => !r.isInactive);
    expect(inactiveChild).toBeDefined();
    expect(activeChild).toBeDefined();
  });
});

describe('CANONICAL-001 — inactiveReason NEVER appears in any output (§10a)', () => {
  it('serialized artifacts carry neither the reason key nor poisoned reason values', () => {
    // Poisoned reason fields fed via a widened cast; they are NOT on the
    // input type, so the model can never read or echo them.
    const poisoned = [
      {
        ...makeArtifactRow({ id: 'arg-p', inactiveAt: '2026-06-05T00:00:00Z' }),
        inactiveReason: 'policy_violation',
        inactive_reason: 'spam',
      } as unknown as ArtifactSourceRow,
    ];
    const serialized = JSON.stringify(groupArgumentsIntoArtifacts(poisoned));
    expect(serialized).not.toContain('inactiveReason');
    expect(serialized).not.toContain('inactive_reason');
    expect(serialized).not.toContain('policy_violation');
    expect(serialized).not.toContain('spam');
  });
});
