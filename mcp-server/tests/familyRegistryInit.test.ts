/**
 * OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Family registry init module tests.
 *
 * These tests target the production singleton (via the side-effect import of
 * `familyRegistryInit.ts`). The init module is idempotent — re-calling
 * `initializeFamilyRegistry()` after the first invocation is a no-op, which
 * the last test asserts.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — init registers structural-observation
 *     groupings; the tests assert only registration shape and counts.
 *   - test-discipline — init module is part of the validator surface;
 *     covered with dedicated unit tests.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { initializeFamilyRegistry } from '../lib/familyRegistryInit.ts';
import {
  getClassifierSetVersion,
  getRawKeysForFamily,
  getSupportedFamilies,
  isFamilySupported,
} from '../lib/familyRegistry.ts';

Deno.test('familyRegistryInit-registers-family-a-on-import', () => {
  // The import above triggered the top-of-file side effect, which calls
  // initializeFamilyRegistry() once. Family A must be present in the singleton.
  assertEquals(isFamilySupported('parent_relation'), true);
});

Deno.test('familyRegistryInit-registers-family-b-on-import', () => {
  // MCP-SERVER-003-FAMILY-B added the second register() call. Family B must
  // be present in the singleton after the side-effect import.
  assertEquals(isFamilySupported('disagreement_axis'), true);
});

Deno.test('familyRegistryInit-registers-both-families-in-insertion-order', () => {
  // The singleton is shared across test files; however, init registers
  // exactly two families: Family A first, Family B second. Other test
  // files may add fake families via createFamilyRegistry() factories
  // (which yield isolated instances and never touch the singleton).
  // The singleton's getSupportedFamilies() must remain exactly
  // ['parent_relation', 'disagreement_axis'] in the current server build.
  const families = getSupportedFamilies();
  assertEquals(families, ['parent_relation', 'disagreement_axis']);
  assertEquals(families.length, 2);
});

Deno.test('familyRegistryInit-family-a-has-16-rawKeys', () => {
  const rawKeys = getRawKeysForFamily('parent_relation');
  assertEquals(rawKeys.size, 16);
});

Deno.test('familyRegistryInit-family-b-has-14-rawKeys', () => {
  const rawKeys = getRawKeysForFamily('disagreement_axis');
  assertEquals(rawKeys.size, 14);
});

Deno.test('familyRegistryInit-family-a-classifier-version-is-family-a-v1', () => {
  assertEquals(getClassifierSetVersion('parent_relation'), 'family-a-v1');
});

Deno.test('familyRegistryInit-family-b-classifier-version-is-family-b-v1', () => {
  assertEquals(getClassifierSetVersion('disagreement_axis'), 'family-b-v1');
});

Deno.test('familyRegistryInit-initializeFamilyRegistry-is-idempotent', () => {
  // Second invocation must not throw (idempotent guard per design §5.2).
  // Without the guard, the underlying registry.register() would throw
  // 'family already registered: parent_relation'.
  initializeFamilyRegistry();
  initializeFamilyRegistry();
  // Still exactly two families registered, in the same insertion order.
  assertEquals(getSupportedFamilies(), ['parent_relation', 'disagreement_axis']);
});
