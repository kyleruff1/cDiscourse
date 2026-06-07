/**
 * ADMIN-CONV-INACTIVE-001 — §10a POISONED-FIXTURE INVARIANT (binding).
 *
 * The admin sees WHAT is inactive (an inactive_at-derived badge), NEVER WHY.
 * `inactive_reason` is the leak vector. This test mounts AdminDebatesTab with a
 * loader fixture whose row carries a 'leak-canary-REASON' reason and asserts
 * the rendered tree NEVER contains that string.
 *
 * The loader/wrapper modules are mocked so the component never touches Supabase.
 * The mocked loader returns the raw AdminDebateRow (carrying the reason); the
 * component projects to the reason-free AdminDebateRowView before rendering, so
 * the canary must be dropped at the projection boundary.
 *
 * jest hoists jest.mock() above imports/consts; a factory closure may only
 * reference `mock`-prefixed module-scope identifiers, so the poisoned fixture is
 * defined INSIDE the factory.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';

const LEAK_CANARY = 'leak-canary-REASON';

// AdminDebatesTab transitively imports edgeFunctions -> lib/supabase ->
// @react-native-async-storage/async-storage (a native module not available in
// the jest-expo JSDOM env). Mock the supabase client so the import graph stays
// pure JS. The tab only needs ADMIN_BULK_DEBATE_INACTIVE_ID_CAP from
// edgeFunctions, which does not touch the client at module-load time.
jest.mock('../src/lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
  SUPABASE_CONFIGURED: false,
}));

// The poisoned fixture lives inside the factory (jest hoisting rule). It is an
// inactive AdminDebateRow carrying the admin-only reason.
jest.mock('../src/features/admin/adminDebatesApi', () => ({
  loadAdminDebates: jest.fn(async () => [
    {
      id: 'd-poisoned',
      title: 'Poisoned room',
      resolution: 'A resolution that is fine to show.',
      status: 'locked',
      visibility: 'public',
      createdBy: 'u-1',
      createdByDisplayName: 'Alice',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-02T00:00:00Z',
      inactiveAt: '2026-06-05T00:00:00Z',
      inactiveBy: 'admin-7',
      inactiveReason: 'leak-canary-REASON',
    },
  ]),
}));

// Mutation wrappers — never invoked in this test, but mock them so the import
// graph does not pull the real edge-function client.
jest.mock('../src/features/admin/adminDebatesInactiveApi', () => ({
  markDebateInactive: jest.fn(async () => ({ ok: true, data: { result: { debateId: 'd-poisoned', ok: true } } })),
  markDebateActive: jest.fn(async () => ({ ok: true, data: { result: { debateId: 'd-poisoned', ok: true } } })),
  bulkMarkDebateInactive: jest.fn(async () => ({ ok: true, data: { results: [], appliedCount: 0, failedCount: 0 } })),
  bulkMarkDebateActive: jest.fn(async () => ({ ok: true, data: { results: [], appliedCount: 0, failedCount: 0 } })),
}));

// Import AFTER the mocks are registered.
import { AdminDebatesTab } from '../src/features/admin/AdminDebatesTab';

function serialize(tree: ReturnType<ReturnType<typeof render>['toJSON']>): string {
  return JSON.stringify(tree);
}

describe('ADMIN-CONV-INACTIVE-001 — §10a poisoned-fixture: reason never rendered', () => {
  it('does not render the leak-canary reason after the initial load', async () => {
    const result = render(<AdminDebatesTab />);
    await act(async () => { await Promise.resolve(); });
    const serialized = serialize(result.toJSON());
    expect(serialized).not.toContain(LEAK_CANARY);
    // Sanity: the row's safe fields DID render — so the absence of the canary
    // is meaningful (the component actually mounted the poisoned row).
    expect(serialized).toContain('Poisoned room');
  });

  it('renders the Inactive badge (admin sees WHAT) but never the reason (never WHY)', async () => {
    const result = render(<AdminDebatesTab />);
    await act(async () => { await Promise.resolve(); });
    const serialized = serialize(result.toJSON());
    expect(serialized).toContain('Inactive');
    expect(serialized).not.toContain(LEAK_CANARY);
  });
});
