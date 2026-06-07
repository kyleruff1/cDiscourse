/**
 * MCP-SERVER-010-FAMILY-I — Test: Edge family registry Family I entry parity
 * (admin_validation-only ship; pre Card 3 production flip).
 *
 * The Edge `familyRegistry.ts` entry for `thread_topology` is at
 * `supabase/functions/_shared/booleanObservations/familyRegistry.ts:110-113`
 * with `productionEnabled: false, adminValidationEnabled: true`. The
 * MCP-021C-EDGE-FAMILY-I-ENABLE card (Card 3 of the FAMILY-I chain) will
 * flip the Edge gate from admin-validation-only to production-enabled.
 *
 * This Card 1 (MCP-SERVER-010-FAMILY-I) does NOT touch the Edge
 * familyRegistry.ts (the I entry is byte-equal; HALT #13). The 8 assertions
 * below lock in the CURRENT (admin-only) shape:
 *   FI-1 entry exists, FI-2 productionEnabled=false (pre Card 3 flip),
 *   FI-3 adminValidationEnabled=true, FI-4 production list does NOT
 *   include I (pre Card 3 flip), FI-5 admin_validation list does include
 *   I, FI-6/7 mode filter behavior, FI-8 Family I is the 9th entry in
 *   EDGE_FAMILY_REGISTRY (A→J order; index 8).
 *
 * If a future card accidentally promotes Family I to production before
 * the Card 3 chain is complete (smoke audit + Phase 4b doctrine
 * verification), this file fails the build with a Family-I-specific
 * error message. Conversely, when Card 3 lands, FI-2/FI-4/FI-6 will need
 * to flip (mirror the E + F + G + H analog files).
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeAdminValidationEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-SERVER-010-FAMILY-I — Edge familyRegistry Family I entry (admin-only; pre Card 3 flip)', () => {
  it('FI-1 — Family I entry exists in EDGE_FAMILY_REGISTRY', () => {
    const entry = edgeLookupFamilyRegistryEntry('thread_topology');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('thread_topology');
  });

  it('FI-2 — Family I entry has productionEnabled: false (pre MCP-021C-EDGE-FAMILY-I-ENABLE flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('thread_topology');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(false);
  });

  it('FI-3 — Family I entry has adminValidationEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('thread_topology');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FI-4 — edgeProductionEnabledFamilies() does NOT include thread_topology (pre Card 3 flip)', () => {
    expect(edgeProductionEnabledFamilies()).not.toContain('thread_topology');
  });

  it('FI-5 — edgeAdminValidationEnabledFamilies() includes thread_topology', () => {
    expect(edgeAdminValidationEnabledFamilies()).toContain('thread_topology');
  });

  it('FI-6 — edgeFilterFamiliesForMode([thread_topology], production) returns [] (filtered out of production pre Card 3 flip)', () => {
    expect(edgeFilterFamiliesForMode(['thread_topology'], 'production')).toEqual([]);
  });

  it('FI-7 — edgeFilterFamiliesForMode([thread_topology], admin_validation) returns [thread_topology]', () => {
    expect(edgeFilterFamiliesForMode(['thread_topology'], 'admin_validation')).toEqual([
      'thread_topology',
    ]);
  });

  it('FI-8 — Family I is the 9th entry in EDGE_FAMILY_REGISTRY (A→J order preserved; index 8)', () => {
    // The Edge registry lists all 10 families in MCP-021A A→J order.
    // Family I occupies index 8 (zero-indexed).
    expect(EDGE_FAMILY_REGISTRY[8].family).toBe('thread_topology');
  });
});
