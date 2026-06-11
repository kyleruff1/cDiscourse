/**
 * MCP-SERVER-011-FAMILY-J — Test: Edge family registry Family J entry parity
 * (HELD-OUT; admin-validation-only ceiling — design §11 E4).
 *
 * The Edge `familyRegistry.ts` entry for `sensitive_composer` is at
 * `supabase/functions/_shared/booleanObservations/familyRegistry.ts:114-118`
 * with `productionEnabled: false, adminValidationEnabled: true`. Family J is
 * the LAST and only held-out family. This card (the MCP server build) makes
 * NO Edge change; the entry remains byte-equal.
 *
 * The 8 assertions below lock in the HELD-OUT shape — the doctrinal inverse of
 * Family I (which was flipped to production by MCP-I-D2):
 *   FJ-1 entry exists, FJ-2 productionEnabled=false, FJ-3
 *   adminValidationEnabled=true, FJ-4 production list does NOT include J,
 *   FJ-5 admin_validation list DOES include J, FJ-6 production mode filter
 *   drops J (returns []), FJ-7 admin_validation mode filter keeps J, FJ-8
 *   Family J is the 10th entry in EDGE_FAMILY_REGISTRY (A→J order; index 9).
 *
 * This file is the leak-tripwire: if a future card accidentally flips Family J
 * to production WITHOUT the required fresh cdiscourse-doctrine §10a doctrine
 * review (design §11 E4 ceiling), this file fails the build with a
 * Family-J-specific error message. A production flip is NOT part of the J chain.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeAdminValidationEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-SERVER-011-FAMILY-J — Edge familyRegistry Family J entry (HELD-OUT; admin-validation-only ceiling)', () => {
  it('FJ-1 — Family J entry exists in EDGE_FAMILY_REGISTRY', () => {
    const entry = edgeLookupFamilyRegistryEntry('sensitive_composer');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('sensitive_composer');
  });

  it('FJ-2 — Family J entry has productionEnabled: false (held out; NO Card-3 production flip in this chain)', () => {
    const entry = edgeLookupFamilyRegistryEntry('sensitive_composer');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(false);
  });

  it('FJ-3 — Family J entry has adminValidationEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('sensitive_composer');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FJ-4 — edgeProductionEnabledFamilies() does NOT include sensitive_composer (held out)', () => {
    expect(edgeProductionEnabledFamilies()).not.toContain('sensitive_composer');
  });

  it('FJ-5 — edgeAdminValidationEnabledFamilies() includes sensitive_composer', () => {
    expect(edgeAdminValidationEnabledFamilies()).toContain('sensitive_composer');
  });

  it('FJ-6 — edgeFilterFamiliesForMode([sensitive_composer], production) returns [] (dropped in production)', () => {
    expect(edgeFilterFamiliesForMode(['sensitive_composer'], 'production')).toEqual([]);
  });

  it('FJ-7 — edgeFilterFamiliesForMode([sensitive_composer], admin_validation) returns [sensitive_composer]', () => {
    expect(edgeFilterFamiliesForMode(['sensitive_composer'], 'admin_validation')).toEqual([
      'sensitive_composer',
    ]);
  });

  it('FJ-8 — Family J is the 10th entry in EDGE_FAMILY_REGISTRY (A→J order preserved; index 9)', () => {
    // The Edge registry lists all 10 families in MCP-021A A→J order.
    // Family J occupies index 9 (zero-indexed) — the last entry.
    expect(EDGE_FAMILY_REGISTRY[9].family).toBe('sensitive_composer');
  });
});
