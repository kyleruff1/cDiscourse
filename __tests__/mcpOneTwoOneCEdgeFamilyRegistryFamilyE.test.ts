/**
 * MCP-SERVER-006-FAMILY-E — Test: Edge family registry Family E entry parity.
 *
 * Card 3 ships Family E (argument_scheme) in admin-validation-only posture:
 *   - The Edge `familyRegistry.ts` entry for `argument_scheme` already
 *     exists at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:89-93`
 *     with `productionEnabled: false, adminValidationEnabled: true`.
 *   - This card does NOT flip the Edge gate; production-mode enablement
 *     is deferred to a separate card (`MCP-021C-EDGE-FAMILY-E-ENABLE`,
 *     authorized on PASS of MCP-SERVER-006-FAMILY-E smoke).
 *
 * The 8 assertions below lock in the CURRENT (admin-validation-only) shape:
 *   FE-1 entry exists, FE-2 productionEnabled=false, FE-3
 *   adminValidationEnabled=true, FE-4 production list does NOT include E,
 *   FE-5 admin_validation list DOES include E, FE-6/7 mode filter behavior,
 *   FE-8 Family E is the 5th entry in EDGE_FAMILY_REGISTRY (A→J order).
 *
 * If a future card accidentally flips Family E's production posture
 * before the explicit ENABLE card lands, this file fails the build with
 * a Family-E-specific error message.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeAdminValidationEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-SERVER-006-FAMILY-E — Edge familyRegistry Family E entry (admin-validation-only)', () => {
  it('FE-1 — Family E entry exists in EDGE_FAMILY_REGISTRY', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('argument_scheme');
  });

  it('FE-2 — Family E entry has productionEnabled: false (admin-validation-only per Card 3 scope)', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(false);
  });

  it('FE-3 — Family E entry has adminValidationEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FE-4 — edgeProductionEnabledFamilies() does NOT include argument_scheme', () => {
    expect(edgeProductionEnabledFamilies()).not.toContain('argument_scheme');
  });

  it('FE-5 — edgeAdminValidationEnabledFamilies() includes argument_scheme', () => {
    expect(edgeAdminValidationEnabledFamilies()).toContain('argument_scheme');
  });

  it('FE-6 — edgeFilterFamiliesForMode([argument_scheme], production) returns [] (production-mode gate)', () => {
    expect(edgeFilterFamiliesForMode(['argument_scheme'], 'production')).toEqual([]);
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
