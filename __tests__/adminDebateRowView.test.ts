/**
 * ADMIN-CONV-INACTIVE-001 — pure projector tests for toAdminDebateRowView.
 *
 * This is the runtime half of the §10a leak gate: the projector DROPS
 * `inactiveReason` (and `inactiveBy`) so the rendered view-model has no field
 * carrying the admin-only reason. A 'leak-canary' reason on the input never
 * appears on any value of the output object.
 *
 * Pure-TS — no React, no Supabase.
 */
import { toAdminDebateRowView } from '../src/features/admin/adminDebateRowView';
import type { AdminDebateRow } from '../src/features/admin/types';

const activeRow: AdminDebateRow = {
  id: 'd-active',
  title: 'A title',
  resolution: 'Bike lanes improve safety.',
  status: 'open',
  visibility: 'public',
  createdBy: 'u-1',
  createdByDisplayName: 'Alice',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-02T00:00:00Z',
  inactiveAt: null,
  inactiveBy: null,
  inactiveReason: null,
};

const inactiveRow: AdminDebateRow = {
  id: 'd-inactive',
  title: null,
  resolution: 'Some resolution.',
  status: 'locked',
  visibility: 'private',
  createdBy: 'u-2',
  createdByDisplayName: 'Bob',
  createdAt: '2026-06-03T00:00:00Z',
  updatedAt: '2026-06-04T00:00:00Z',
  inactiveAt: '2026-06-05T00:00:00Z',
  inactiveBy: 'admin-7',
  inactiveReason: 'leak-canary',
};

describe('toAdminDebateRowView — derives isInactive', () => {
  it('isInactive is false when inactiveAt is null', () => {
    expect(toAdminDebateRowView(activeRow).isInactive).toBe(false);
  });

  it('isInactive is true when inactiveAt is set', () => {
    expect(toAdminDebateRowView(inactiveRow).isInactive).toBe(true);
  });
});

describe('toAdminDebateRowView — preserves display fields', () => {
  it('round-trips the display columns for an active row', () => {
    const v = toAdminDebateRowView(activeRow);
    expect(v.id).toBe('d-active');
    expect(v.title).toBe('A title');
    expect(v.resolution).toBe('Bike lanes improve safety.');
    expect(v.status).toBe('open');
    expect(v.visibility).toBe('public');
    expect(v.createdByDisplayName).toBe('Alice');
    expect(v.createdAt).toBe('2026-06-01T00:00:00Z');
    expect(v.updatedAt).toBe('2026-06-02T00:00:00Z');
    expect(v.inactiveAt).toBeNull();
  });

  it('preserves inactiveAt for an inactive row', () => {
    expect(toAdminDebateRowView(inactiveRow).inactiveAt).toBe('2026-06-05T00:00:00Z');
  });
});

describe('toAdminDebateRowView — §10a leak gate (reason structurally absent)', () => {
  it('the projected object has no inactiveReason own-property', () => {
    const v = toAdminDebateRowView(inactiveRow);
    expect(Object.prototype.hasOwnProperty.call(v, 'inactiveReason')).toBe(false);
  });

  it('the projected object has no inactiveBy own-property', () => {
    const v = toAdminDebateRowView(inactiveRow);
    expect(Object.prototype.hasOwnProperty.call(v, 'inactiveBy')).toBe(false);
  });

  it('the leak-canary reason never appears anywhere in the serialized view', () => {
    const v = toAdminDebateRowView(inactiveRow);
    expect(JSON.stringify(v)).not.toContain('leak-canary');
  });

  it('no view value equals the reason text', () => {
    const v = toAdminDebateRowView(inactiveRow);
    for (const value of Object.values(v)) {
      expect(value).not.toBe('leak-canary');
    }
  });
});
