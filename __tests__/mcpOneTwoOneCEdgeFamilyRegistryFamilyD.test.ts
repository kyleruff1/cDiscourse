/**
 * MCP-SERVER-005-FAMILY-D — Test: Edge family registry Family D entry parity.
 *
 * Per Stage 2B operator binding (recorded in
 * `docs/designs/MCP-SERVER-005-FAMILY-D.md` § "Stage 2B"):
 *   - Family D ships in admin_validation-only posture.
 *   - The Edge `familyRegistry.ts` entry for `evidence_source_chain`
 *     MUST keep `productionEnabled: false` AND `adminValidationEnabled: true`.
 *   - HALT trigger #17 in the intent brief forbids any Edge edit that
 *     flips `productionEnabled: true` in this card.
 *
 * The existing `mcpOneTwoOneCEdgeFamilyRegistry.test.ts:FR-7` already
 * asserts every NON-A/B/C family has `productionEnabled: false`,
 * including Family D. This dedicated Family D file makes the assertion
 * explicit + load-bearing — if a future card accidentally flips Family
 * D's production posture, this file fails the build with a Family-D-
 * specific error message.
 *
 * Per the Edge family registry primer
 * (`supabase/functions/_shared/booleanObservations/familyRegistry.ts:84-88`)
 * the Family D entry is pre-existing from MCP-021C-EDGE-FAMILIES-B-C-ENABLE;
 * this test does NOT introduce or modify the Edge code, only asserts the
 * current shape.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeAdminValidationEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-SERVER-005-FAMILY-D — Edge familyRegistry Family D entry (Stage 2B binding)', () => {
  it('FD-1 — Family D entry exists in EDGE_FAMILY_REGISTRY', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('evidence_source_chain');
  });

  it('FD-2 — Family D entry has productionEnabled: false (Stage 2B HALT trigger #17)', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(false);
  });

  it('FD-3 — Family D entry has adminValidationEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FD-4 — edgeProductionEnabledFamilies() does NOT include evidence_source_chain', () => {
    expect(edgeProductionEnabledFamilies()).not.toContain('evidence_source_chain');
  });

  it('FD-5 — edgeAdminValidationEnabledFamilies() includes evidence_source_chain', () => {
    expect(edgeAdminValidationEnabledFamilies()).toContain('evidence_source_chain');
  });

  it('FD-6 — edgeFilterFamiliesForMode([evidence_source_chain], production) returns empty (D admin-only)', () => {
    expect(edgeFilterFamiliesForMode(['evidence_source_chain'], 'production')).toEqual([]);
  });

  it('FD-7 — edgeFilterFamiliesForMode([evidence_source_chain], admin_validation) keeps evidence_source_chain', () => {
    expect(edgeFilterFamiliesForMode(['evidence_source_chain'], 'admin_validation')).toEqual([
      'evidence_source_chain',
    ]);
  });

  it('FD-8 — Family D is the 4th entry in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    // The Edge registry lists all 10 families in MCP-021A A→J order.
    // Family D occupies index 3 (zero-indexed).
    expect(EDGE_FAMILY_REGISTRY[3].family).toBe('evidence_source_chain');
  });
});
