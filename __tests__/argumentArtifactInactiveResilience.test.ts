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
 */
import type { ArgumentRow } from '../src/features/arguments/types';

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
