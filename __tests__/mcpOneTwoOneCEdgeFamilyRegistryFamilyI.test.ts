/**
 * MCP-SERVER-010-FAMILY-I — Test: Edge family registry Family I entry parity
 * (production + admin_validation; post MCP-021C-EDGE-FAMILY-I-ENABLE / MCP-I-D2 flip).
 *
 * The Edge `familyRegistry.ts` entry for `thread_topology` is at
 * `supabase/functions/_shared/booleanObservations/familyRegistry.ts:109-113`
 * with `productionEnabled: true, adminValidationEnabled: true` after the
 * MCP-021C-EDGE-FAMILY-I-ENABLE (MCP-I-D2) card flipped the Edge gate from
 * admin-validation-only to production-enabled.
 *
 * The 8 assertions below lock in the CURRENT (post-flip) shape:
 *   FI-1 entry exists, FI-2 productionEnabled=true (post MCP-I-D2 flip),
 *   FI-3 adminValidationEnabled=true, FI-4 production list DOES include I
 *   (post MCP-I-D2 flip), FI-5 admin_validation list does include I,
 *   FI-6/7 mode filter behavior, FI-8 Family I is the 9th entry in
 *   EDGE_FAMILY_REGISTRY (A→J order; index 8).
 *
 * If a future card accidentally reverts the Family I production flag,
 * this file fails the build with a Family-I-specific error message.
 * (The pre-MCP-I-D2 docblock note that "FI-2/FI-4/FI-6 will need to flip
 * when the production card lands — mirror the E/F/G/H analog files" was
 * authored at Card 1 to forecast the flip; that forecast is now realized.)
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

  it('FI-2 — Family I entry has productionEnabled: true (post MCP-021C-EDGE-FAMILY-I-ENABLE / MCP-I-D2 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('thread_topology');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FI-3 — Family I entry has adminValidationEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('thread_topology');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FI-4 — edgeProductionEnabledFamilies() includes thread_topology (post MCP-I-D2 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toContain('thread_topology');
  });

  it('FI-5 — edgeAdminValidationEnabledFamilies() includes thread_topology', () => {
    expect(edgeAdminValidationEnabledFamilies()).toContain('thread_topology');
  });

  it('FI-6 — edgeFilterFamiliesForMode([thread_topology], production) returns [thread_topology] (kept in production post MCP-I-D2 flip)', () => {
    expect(edgeFilterFamiliesForMode(['thread_topology'], 'production')).toEqual([
      'thread_topology',
    ]);
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
