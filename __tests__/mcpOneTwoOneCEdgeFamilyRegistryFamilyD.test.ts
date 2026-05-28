/**
 * MCP-SERVER-005-FAMILY-D — Test: Edge family registry Family D entry parity.
 *
 * Post `MCP-021C-EDGE-FAMILY-D-ENABLE` (Card 2 of the FAMILY-D chain):
 *   - Family D ships in production + admin_validation posture.
 *   - The Edge `familyRegistry.ts` entry for `evidence_source_chain`
 *     now has `productionEnabled: true` AND `adminValidationEnabled: true`.
 *   - The Card 2 flip is locked in by FD-2 (productionEnabled is true),
 *     FD-4 (productionEnabledFamilies() INCLUDES evidence_source_chain),
 *     and FD-6 (production-mode filter keeps D).
 *
 * If a future card accidentally reverts Family D's production posture
 * to admin-only, this file fails the build with a Family-D-specific
 * error message.
 *
 * Per the Edge family registry primer
 * (`supabase/functions/_shared/booleanObservations/familyRegistry.ts:84-88`)
 * the Family D entry was pre-existing from MCP-021C-EDGE-FAMILIES-B-C-ENABLE
 * (admin-only) and was flipped to production by MCP-021C-EDGE-FAMILY-D-ENABLE.
 * This test asserts the CURRENT (post-flip) shape.
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

  it('FD-2 — Family D entry has productionEnabled: true (post MCP-021C-EDGE-FAMILY-D-ENABLE Card 2 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FD-3 — Family D entry has adminValidationEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FD-4 — edgeProductionEnabledFamilies() includes evidence_source_chain (post Card 2 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toContain('evidence_source_chain');
  });

  it('FD-5 — edgeAdminValidationEnabledFamilies() includes evidence_source_chain', () => {
    expect(edgeAdminValidationEnabledFamilies()).toContain('evidence_source_chain');
  });

  it('FD-6 — edgeFilterFamiliesForMode([evidence_source_chain], production) keeps evidence_source_chain (post Card 2 flip)', () => {
    expect(edgeFilterFamiliesForMode(['evidence_source_chain'], 'production')).toEqual([
      'evidence_source_chain',
    ]);
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
