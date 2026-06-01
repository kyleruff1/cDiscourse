/**
 * MCP-SERVER-009-FAMILY-H — Test: Edge family registry Family H entry parity
 * (admin_validation-only ship; pre Card 3 production flip).
 *
 * The Edge `familyRegistry.ts` entry for `claim_clarity` is at
 * `supabase/functions/_shared/booleanObservations/familyRegistry.ts:104-108`
 * with `productionEnabled: false, adminValidationEnabled: true`. The
 * MCP-021C-EDGE-FAMILY-H-ENABLE card (Card 3 of the FAMILY-H chain) will
 * flip the Edge gate from admin-validation-only to production-enabled.
 *
 * The 8 assertions below lock in the CURRENT (admin-only) shape:
 *   FH-1 entry exists, FH-2 productionEnabled=false (pre Card 3 flip),
 *   FH-3 adminValidationEnabled=true, FH-4 production list does NOT
 *   include H (pre Card 3 flip), FH-5 admin_validation list does include
 *   H, FH-6/7 mode filter behavior, FH-8 Family H is the 8th entry in
 *   EDGE_FAMILY_REGISTRY (A→J order; index 7).
 *
 * If a future card accidentally promotes Family H to production before
 * the Card 3 chain is complete (smoke audit + Phase 4b doctrine
 * verification), this file fails the build with a Family-H-specific
 * error message. Conversely, when Card 3 lands, FH-2/FH-4/FH-6 will need
 * to flip (mirror the E + F + G analog files).
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeAdminValidationEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-SERVER-009-FAMILY-H — Edge familyRegistry Family H entry (admin-only; pre Card 3 flip)', () => {
  it('FH-1 — Family H entry exists in EDGE_FAMILY_REGISTRY', () => {
    const entry = edgeLookupFamilyRegistryEntry('claim_clarity');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('claim_clarity');
  });

  it('FH-2 — Family H entry has productionEnabled: false (pre MCP-021C-EDGE-FAMILY-H-ENABLE flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('claim_clarity');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(false);
  });

  it('FH-3 — Family H entry has adminValidationEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('claim_clarity');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FH-4 — edgeProductionEnabledFamilies() does NOT include claim_clarity (pre Card 3 flip)', () => {
    expect(edgeProductionEnabledFamilies()).not.toContain('claim_clarity');
  });

  it('FH-5 — edgeAdminValidationEnabledFamilies() includes claim_clarity', () => {
    expect(edgeAdminValidationEnabledFamilies()).toContain('claim_clarity');
  });

  it('FH-6 — edgeFilterFamiliesForMode([claim_clarity], production) returns [] (filtered out of production pre Card 3 flip)', () => {
    expect(edgeFilterFamiliesForMode(['claim_clarity'], 'production')).toEqual([]);
  });

  it('FH-7 — edgeFilterFamiliesForMode([claim_clarity], admin_validation) returns [claim_clarity]', () => {
    expect(edgeFilterFamiliesForMode(['claim_clarity'], 'admin_validation')).toEqual([
      'claim_clarity',
    ]);
  });

  it('FH-8 — Family H is the 8th entry in EDGE_FAMILY_REGISTRY (A→J order preserved; index 7)', () => {
    // The Edge registry lists all 10 families in MCP-021A A→J order.
    // Family H occupies index 7 (zero-indexed).
    expect(EDGE_FAMILY_REGISTRY[7].family).toBe('claim_clarity');
  });
});
