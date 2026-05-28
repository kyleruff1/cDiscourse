/**
 * MCP-SERVER-006-FAMILY-E — Test: Edge family registry Family E entry parity.
 *
 * Post `MCP-021C-EDGE-FAMILY-E-ENABLE` (Card 2 of the FAMILY-E chain):
 *   - The Edge `familyRegistry.ts` entry for `argument_scheme` is at
 *     `supabase/functions/_shared/booleanObservations/familyRegistry.ts:89-93`
 *     with `productionEnabled: true, adminValidationEnabled: true`.
 *   - The MCP-021C-EDGE-FAMILY-E-ENABLE card flipped the Edge gate from
 *     admin-validation-only to production-enabled.
 *
 * The 8 assertions below lock in the CURRENT (production + admin) shape:
 *   FE-1 entry exists, FE-2 productionEnabled=true (post Card 2 flip),
 *   FE-3 adminValidationEnabled=true, FE-4 production list DOES include E
 *   (post Card 2 flip), FE-5 admin_validation list DOES include E,
 *   FE-6/7 mode filter behavior, FE-8 Family E is the 5th entry in
 *   EDGE_FAMILY_REGISTRY (A→J order).
 *
 * If a future card accidentally reverts the Family E production flag,
 * this file fails the build with a Family-E-specific error message.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeAdminValidationEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-SERVER-006-FAMILY-E — Edge familyRegistry Family E entry (production-enabled post Card 2 flip)', () => {
  it('FE-1 — Family E entry exists in EDGE_FAMILY_REGISTRY', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('argument_scheme');
  });

  it('FE-2 — Family E entry has productionEnabled: true (post MCP-021C-EDGE-FAMILY-E-ENABLE flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FE-3 — Family E entry has adminValidationEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FE-4 — edgeProductionEnabledFamilies() includes argument_scheme (post Card 2 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toContain('argument_scheme');
  });

  it('FE-5 — edgeAdminValidationEnabledFamilies() includes argument_scheme', () => {
    expect(edgeAdminValidationEnabledFamilies()).toContain('argument_scheme');
  });

  it('FE-6 — edgeFilterFamiliesForMode([argument_scheme], production) returns [argument_scheme] (post Card 2 flip)', () => {
    expect(edgeFilterFamiliesForMode(['argument_scheme'], 'production')).toEqual([
      'argument_scheme',
    ]);
  });

  it('FE-7 — edgeFilterFamiliesForMode([argument_scheme], admin_validation) returns [argument_scheme]', () => {
    expect(edgeFilterFamiliesForMode(['argument_scheme'], 'admin_validation')).toEqual([
      'argument_scheme',
    ]);
  });

  it('FE-8 — Family E is the 5th entry in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    // The Edge registry lists all 10 families in MCP-021A A→J order.
    // Family E occupies index 4 (zero-indexed).
    expect(EDGE_FAMILY_REGISTRY[4].family).toBe('argument_scheme');
  });
});
